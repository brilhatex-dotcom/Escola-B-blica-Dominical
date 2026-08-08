import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import {
  alvoDaConsulta,
  dataOu,
  MINIMO_DE_CHAMADAS,
  periodoPadrao,
  recorteSql,
} from "@/lib/relatorios/comum";
import {
  calcularIGS,
  classificarIGS,
  scoreDeVariacao,
  tendenciaDe,
  variacaoPct,
  type ComponentesIGS,
} from "@/lib/relatorios/indices";
import {
  gerarAlertas,
  gerarAnalise,
  temDadoSuficiente,
  type CampoBI,
  type ClasseSemChamada,
  type CongregacaoBI,
} from "@/lib/relatorios/analise";

/**
 * O Painel — Índice de Saúde por congregação (IGS), Índice Geral da EBD (IGE),
 * alertas automáticos e análise em texto.
 *
 *   ?de=&ate=   período (padrão: os últimos 90 dias — mesmo padrão de Frequência)
 *
 * ============================================================================
 * TUDO NUMA CHAMADA SÓ, POR DESENHO
 *
 * A tela de painel é a PRIMEIRA que a liderança abre, e ela mistura dados de
 * cinco naturezas diferentes: frequência, regularidade de chamada, tendência,
 * visitantes e faltosos recorrentes — por congregação e para o campo inteiro,
 * mais as classes atrasadas. Buscar isso em seis requisições faria a tela
 * montar aos pedaços, com números mudando de lugar enquanto a pessoa ainda está
 * lendo o primeiro.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("rel-painel");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const recorte = recorteDaSessao(sessao);
    const alvo = alvoDaConsulta(recorte, null);

    const { de: deP, ate: ateP } = periodoPadrao();
    const de = dataOu(url.searchParams.get("de"), deP);
    const ate = dataOu(url.searchParams.get("ate"), ateP);
    const meio = new Date((de.getTime() + ate.getTime()) / 2);

    /*
     * SEM recorte nas quatro linhas abaixo — de propósito, e é a mudança da
     * Fase 23.
     *
     * `porCongregacao`, `domingosCampo`, `serieMensalCampo` e
     * `faltososPorCong` são a base de DUAS coisas: o `campo: CampoBI` (o IGE
     * que abre a tela, a evolução de 12 meses, a primeira frase da análise) e
     * o `congregacoes: CongregacaoBI[]` (o detalhe por congregação). O
     * pedido da liderança foi "quem só enxerga a própria congregação
     * continua vendo só o PRÓPRIO detalhe, mas o retrato do campo que abre a
     * tela precisa ser o campo de verdade, não uma congregação sozinha
     * disfarçada de campo". Por isso as quatro consultas rodam SEM filtro, e
     * só depois — depois de calcular `campo` a partir de TUDO — é que
     * `congregacoesBI` é recortada para o que a sessão pode ver (mais abaixo,
     * `congregacoesVisiveis`). `classesSemChamada` e `totais` continuam
     * recortados como sempre: são detalhe operacional de outras
     * congregações, não o retrato geral.
     */
    const soCongFreq = Prisma.empty;
    const soCongVis = Prisma.empty;
    const soCongG = Prisma.empty;
    const soCongAluno = Prisma.empty;

    /*
     * QUANTOS DOMINGOS O PERÍODO TEM — calculado em JavaScript, não em SQL.
     *
     * É um número só, o mesmo para toda congregação; resolver isso no banco
     * exigiria uma função de data mais complicada que um `for` de seis linhas.
     */
    let domingosNoPeriodo = 0;
    for (let d = new Date(de); d <= ate; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() === 0) domingosNoPeriodo++;
    }

    /*
     * Chamadas e frequência por congregação, com as duas metades do período.
     *
     * O CTE agrega ANTES do JOIN com `Congregacoes` de propósito: juntar
     * `Frequencias` e `Visitantes` direto na mesma consulta multiplicaria as
     * linhas (produto cruzado) e inflaria as duas contagens. Pré-agregando cada
     * tabela por congregação, o JOIN final é 1 linha por congregação, sem risco
     * de inflar nada.
     */
    const porCongregacao = await prisma.$queryRaw<
      Array<{
        congId: number;
        congregacao: string;
        chamadas: bigint;
        presentes: bigint;
        domingosComChamada: bigint;
        chamadasAnt: bigint;
        presentesAnt: bigint;
        chamadasRec: bigint;
        presentesRec: bigint;
        visitantesAnt: bigint;
        visitantesRec: bigint;
      }>
    >`
      WITH chamadas AS (
        SELECT
          "congId",
          count(*)                                            AS total,
          count(*) FILTER (WHERE presente)                    AS presentes,
          count(DISTINCT data)                                AS domingos,
          count(*) FILTER (WHERE data < ${meio})               AS total_ant,
          count(*) FILTER (WHERE presente AND data < ${meio})  AS presentes_ant,
          count(*) FILTER (WHERE data >= ${meio})              AS total_rec,
          count(*) FILTER (WHERE presente AND data >= ${meio}) AS presentes_rec
        FROM "Frequencias"
        WHERE data BETWEEN ${de} AND ${ate} ${soCongFreq}
        GROUP BY "congId"
      ),
      visitas AS (
        SELECT
          "congId",
          count(*) FILTER (WHERE data < ${meio})  AS ant,
          count(*) FILTER (WHERE data >= ${meio}) AS rec
        FROM "Visitantes"
        WHERE data BETWEEN ${de} AND ${ate} ${soCongVis}
        GROUP BY "congId"
      )
      SELECT
        g.id                            AS "congId",
        g.nome                          AS congregacao,
        COALESCE(c.total, 0)            AS chamadas,
        COALESCE(c.presentes, 0)        AS presentes,
        COALESCE(c.domingos, 0)         AS "domingosComChamada",
        COALESCE(c.total_ant, 0)        AS "chamadasAnt",
        COALESCE(c.presentes_ant, 0)    AS "presentesAnt",
        COALESCE(c.total_rec, 0)        AS "chamadasRec",
        COALESCE(c.presentes_rec, 0)    AS "presentesRec",
        COALESCE(v.ant, 0)              AS "visitantesAnt",
        COALESCE(v.rec, 0)              AS "visitantesRec"
      FROM "Congregacoes" g
      LEFT JOIN chamadas c ON c."congId" = g.id
      LEFT JOIN visitas v  ON v."congId" = g.id
      WHERE g.nome IS NOT NULL ${soCongG}
      ORDER BY g.id
    `;

    /*
     * Faltosos recorrentes por congregação.
     *
     * Mesmo cálculo de "sequência de faltas" do Alerta de Faltas
     * (ROW_NUMBER + posição da presença mais recente), agregado por
     * congregação em vez de listar nomes: quantos alunos "elegíveis" (foram
     * chamados ao menos uma vez no período) acumulam 3 ou mais faltas seguidas
     * a partir da chamada mais recente.
     */
    const faltososPorCong = await prisma.$queryRaw<
      Array<{ congId: number; elegiveis: bigint; faltosos: bigint }>
    >`
      WITH ordenadas AS (
        SELECT f."alunoId", a."congId", f.data, f.presente,
               ROW_NUMBER() OVER (PARTITION BY f."alunoId" ORDER BY f.data DESC) AS pos
        FROM "Frequencias" f
        JOIN "Alunos" a ON a.id = f."alunoId" AND a.ativo
        WHERE f.data BETWEEN ${de} AND ${ate} ${soCongAluno}
      ),
      primeira_presenca AS (
        SELECT "alunoId", MIN(pos) AS pos_presenca
        FROM ordenadas WHERE presente GROUP BY "alunoId"
      ),
      resumo AS (
        SELECT o."alunoId", o."congId",
               COALESCE(p.pos_presenca - 1, MAX(o.pos)) AS seguidas
        FROM ordenadas o
        LEFT JOIN primeira_presenca p ON p."alunoId" = o."alunoId"
        GROUP BY o."alunoId", o."congId", p.pos_presenca
      )
      SELECT "congId",
             count(*)                                   AS elegiveis,
             count(*) FILTER (WHERE seguidas >= 3)       AS faltosos
      FROM resumo
      GROUP BY "congId"
    `;
    const faltososPorId = new Map(
      faltososPorCong.map((f) => [f.congId, { elegiveis: Number(f.elegiveis), faltosos: Number(f.faltosos) }]),
    );

    /*
     * Classes atrasadas: a última chamada de cada classe ATIVA, mesmo a que
     * nunca teve nenhuma.
     */
    const classes = await prisma.$queryRaw<
      Array<{ classeId: number; classe: string; congregacao: string | null; congId: number | null; ultimaChamada: Date | null }>
    >`
      SELECT
        c.id                       AS "classeId",
        c.nome                     AS classe,
        g.nome                     AS congregacao,
        c."congId"                 AS "congId",
        (SELECT max(f.data) FROM "Frequencias" f WHERE f."classeId" = c.id) AS "ultimaChamada"
      FROM "Classes" c
      LEFT JOIN "Congregacoes" g ON g.id = c."congId"
      WHERE c.ativa ${recorteSql(Prisma.sql`c."congId"`, alvo)}
      ORDER BY g.id, c.nome
    `;

    /* ------------------------------------------------------------ *
     * Monta os objetos por congregação
     * ------------------------------------------------------------ */
    const congregacoesBI: CongregacaoBI[] = porCongregacao.map((c) => {
      const chamadas = Number(c.chamadas);
      const presentes = Number(c.presentes);
      const taxaFrequencia = chamadas > 0 ? (presentes / chamadas) * 100 : null;

      const taxaAnt =
        Number(c.chamadasAnt) > 0 ? (Number(c.presentesAnt) / Number(c.chamadasAnt)) * 100 : null;
      const taxaRec =
        Number(c.chamadasRec) > 0 ? (Number(c.presentesRec) / Number(c.chamadasRec)) * 100 : null;
      const tendenciaPct = taxaAnt !== null && taxaRec !== null ? variacaoPct(taxaAnt, taxaRec) : null;

      const domingosComChamada = Number(c.domingosComChamada);
      const regularidade =
        domingosNoPeriodo > 0 ? Math.min(100, (domingosComChamada / domingosNoPeriodo) * 100) : null;

      const visitantesAnt = Number(c.visitantesAnt);
      const visitantesRec = Number(c.visitantesRec);
      const visitantesScore =
        visitantesAnt === 0 && visitantesRec === 0
          ? null
          : scoreDeVariacao(variacaoPct(visitantesAnt, visitantesRec));

      const falt = faltososPorId.get(c.congId);
      const faltososScore =
        falt && falt.elegiveis > 0 ? 100 - (falt.faltosos / falt.elegiveis) * 100 : null;

      const componentes: ComponentesIGS = {
        frequencia: taxaFrequencia,
        regularidade,
        tendencia: scoreDeVariacao(tendenciaPct),
        visitantes: visitantesScore,
        faltosos: faltososScore,
      };

      const suficiente = chamadas >= MINIMO_DE_CHAMADAS;
      const igs = suficiente ? calcularIGS(componentes) : null;
      const classificacao = igs ? classificarIGS(igs.nota) : null;

      return {
        congId: c.congId,
        nome: c.congregacao?.trim() || `Congregação ${c.congId}`,
        chamadas,
        taxaFrequencia,
        tendenciaPct,
        visitantesAnt,
        visitantesRec,
        igs,
        classificacao,
        /*
         * Os cinco números CRUS que compõem a nota — não só o resultado final.
         * Sem eles o Radar (Fase 14b) teria de recalcular tudo de novo no
         * navegador, com o risco real de a conta do cliente um dia divergir da
         * conta do servidor. A rota que decide a nota é a mesma que expõe as
         * peças dela.
         */
        componentes,
      };
    });

    // O detalhe por congregação continua recortado — `campo` (calculado
    // abaixo, a partir de `porCongregacao` inteiro) é que passou a ser
    // sempre o campo de verdade.
    const congregacoesVisiveis = alvo ? congregacoesBI.filter((c) => alvo.includes(c.congId)) : congregacoesBI;

    /* ------------------------------------------------------------ *
     * O campo — a MESMA fórmula, sobre a soma de tudo (não a média das
     * médias): evita o paradoxo de Simpson de misturar congregações de
     * tamanhos muito diferentes.
     * ------------------------------------------------------------ */
    const somaCampo = porCongregacao.reduce(
      (acc, c) => ({
        chamadas: acc.chamadas + Number(c.chamadas),
        presentes: acc.presentes + Number(c.presentes),
        domingos: 0, // recalculado abaixo, distinto por natureza
        chamadasAnt: acc.chamadasAnt + Number(c.chamadasAnt),
        presentesAnt: acc.presentesAnt + Number(c.presentesAnt),
        chamadasRec: acc.chamadasRec + Number(c.chamadasRec),
        presentesRec: acc.presentesRec + Number(c.presentesRec),
        visitantesAnt: acc.visitantesAnt + Number(c.visitantesAnt),
        visitantesRec: acc.visitantesRec + Number(c.visitantesRec),
      }),
      {
        chamadas: 0,
        presentes: 0,
        domingos: 0,
        chamadasAnt: 0,
        presentesAnt: 0,
        chamadasRec: 0,
        presentesRec: 0,
        visitantesAnt: 0,
        visitantesRec: 0,
      },
    );

    // Domingos do campo com QUALQUER chamada — distinto da soma por
    // congregação, porque o mesmo domingo conta uma vez só.
    const domingosCampo = await prisma.$queryRaw<Array<{ domingos: bigint }>>`
      SELECT count(DISTINCT data) AS domingos
      FROM "Frequencias"
      WHERE data BETWEEN ${de} AND ${ate} ${soCongFreq}
    `;
    const domingosComChamadaCampo = Number(domingosCampo[0]?.domingos ?? 0);

    const faltososCampo = [...faltososPorId.values()].reduce(
      (acc, f) => ({ elegiveis: acc.elegiveis + f.elegiveis, faltosos: acc.faltosos + f.faltosos }),
      { elegiveis: 0, faltosos: 0 },
    );

    const taxaCampo = somaCampo.chamadas > 0 ? (somaCampo.presentes / somaCampo.chamadas) * 100 : null;
    const taxaCampoAnt =
      somaCampo.chamadasAnt > 0 ? (somaCampo.presentesAnt / somaCampo.chamadasAnt) * 100 : null;
    const taxaCampoRec =
      somaCampo.chamadasRec > 0 ? (somaCampo.presentesRec / somaCampo.chamadasRec) * 100 : null;
    const tendenciaCampoPct =
      taxaCampoAnt !== null && taxaCampoRec !== null ? variacaoPct(taxaCampoAnt, taxaCampoRec) : null;

    const componentesCampo: ComponentesIGS = {
      frequencia: taxaCampo,
      regularidade:
        domingosNoPeriodo > 0 ? Math.min(100, (domingosComChamadaCampo / domingosNoPeriodo) * 100) : null,
      tendencia: scoreDeVariacao(tendenciaCampoPct),
      visitantes:
        somaCampo.visitantesAnt === 0 && somaCampo.visitantesRec === 0
          ? null
          : scoreDeVariacao(variacaoPct(somaCampo.visitantesAnt, somaCampo.visitantesRec)),
      faltosos:
        faltososCampo.elegiveis > 0
          ? 100 - (faltososCampo.faltosos / faltososCampo.elegiveis) * 100
          : null,
    };

    const igsCampo = somaCampo.chamadas >= MINIMO_DE_CHAMADAS ? calcularIGS(componentesCampo) : null;
    const campo: CampoBI = {
      taxaFrequencia: taxaCampo,
      tendenciaPct: tendenciaCampoPct,
      visitantesAnt: somaCampo.visitantesAnt,
      visitantesRec: somaCampo.visitantesRec,
      igs: igsCampo,
      classificacao: igsCampo ? classificarIGS(igsCampo.nota) : null,
      componentes: componentesCampo,
    };

    /*
     * A evolução de 12 meses — o gráfico de ÁREA.
     *
     * O resto desta rota compara duas metades de um período de 90 dias, o que
     * responde "subiu ou caiu nas últimas semanas". Isto responde uma pergunta
     * diferente — "como estivemos no ano" — e é só com os 12 meses lado a lado
     * que um recesso de julho (comum, com férias escolares) deixa de parecer
     * uma queda preocupante e passa a parecer o que é: um padrão que se repete
     * todo ano.
     */
    const doze_meses_atras = new Date(ate);
    doze_meses_atras.setUTCMonth(doze_meses_atras.getUTCMonth() - 11);
    doze_meses_atras.setUTCDate(1);

    const serieMensalCampo = await prisma.$queryRaw<
      Array<{ mes: Date; chamadas: bigint; presentes: bigint }>
    >`
      WITH meses AS (
        SELECT generate_series(
          date_trunc('month', ${doze_meses_atras}::date),
          date_trunc('month', ${ate}::date),
          '1 month'
        ) AS mes
      )
      SELECT
        m.mes,
        COALESCE(f.chamadas, 0)  AS chamadas,
        COALESCE(f.presentes, 0) AS presentes
      FROM meses m
      LEFT JOIN (
        SELECT
          date_trunc('month', data) AS mes,
          count(*)                             AS chamadas,
          count(*) FILTER (WHERE presente)     AS presentes
        FROM "Frequencias"
        WHERE data >= ${doze_meses_atras} AND data <= ${ate} ${soCongFreq}
        GROUP BY 1
      ) f ON f.mes = m.mes
      ORDER BY m.mes
    `;
    const evolucaoMensal = serieMensalCampo.map((m) => {
      const chamadas = Number(m.chamadas);
      return {
        mes: m.mes.toISOString().slice(0, 7),
        taxa: chamadas > 0 ? Math.round((Number(m.presentes) / chamadas) * 1000) / 10 : null,
        chamadas,
      };
    });

    /* ------------------------------------------------------------ *
     * Classes sem chamada — só as de fato atrasadas entram na lista, mas o
     * cálculo do "há quantos dias" é feito para todas.
     * ------------------------------------------------------------ */
    const classesSemChamada: ClasseSemChamada[] = classes
      .map((c) => ({
        classeId: c.classeId,
        classe: c.classe,
        congregacao: c.congregacao?.trim() || (c.congId ? `Congregação ${c.congId}` : "Sem congregação"),
        diasSemChamada: c.ultimaChamada
          ? Math.floor((ate.getTime() - c.ultimaChamada.getTime()) / 86_400_000)
          : null,
      }))
      .filter((c) => c.diasSemChamada === null || c.diasSemChamada >= 21);

    const dadosBI = {
      periodo: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) },
      campo,
      congregacoes: congregacoesVisiveis,
      classesSemChamada,
    };

    return {
      ...dadosBI,
      congregacoes: congregacoesVisiveis.map((c) => ({ ...c, dadosSuficientes: temDadoSuficiente(c) })),
      totais: {
        pessoas: await prisma.pessoa.count({ where: { ativo: true } }),
        alunos: await prisma.aluno.count({ where: { ativo: true, congId: alvo ? { in: alvo } : undefined } }),
        classes: await prisma.classe.count({ where: { ativa: true, congId: alvo ? { in: alvo } : undefined } }),
        // Sempre o campo inteiro — mesmo motivo do `campo: CampoBI`: dá a
        // noção do tamanho do campo, sem expor o detalhe de cada uma.
        congregacoes: porCongregacao.length,
        professores: await contarPorCargo("Professor", alvo),
        dirigentes: await contarPorCargo(["Dirigente", "Coordenador de Congregação"], alvo),
      },
      alertas: gerarAlertas(dadosBI),
      analise: gerarAnalise(dadosBI),
      evolucaoMensal,
    };
  });
}

/** Pessoas distintas exercendo um ou mais dos cargos informados, no recorte. */
async function contarPorCargo(nomeOuNomes: string | string[], alvo: number[] | null): Promise<number> {
  const nomes = Array.isArray(nomeOuNomes) ? nomeOuNomes : [nomeOuNomes];
  const vinculos = await prisma.pessoaCargo.findMany({
    where: {
      ativo: true,
      cargo: { nome: { in: nomes } },
      ...(alvo ? { congId: { in: alvo } } : {}),
    },
    select: { pessoaId: true },
    distinct: ["pessoaId"],
  });
  return vinculos.length;
}
