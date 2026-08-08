import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { escopoDaRota } from "@/lib/auth/escopo";
import { exigirCongregacaoPermitida } from "@/lib/auth/escopo";
import { dataOu, MINIMO_DE_CHAMADAS, periodoPadrao } from "@/lib/relatorios/comum";
import {
  calcularIGS,
  classificarIGS,
  scoreDeVariacao,
  variacaoPct,
  type ComponentesIGS,
} from "@/lib/relatorios/indices";
import { gerarAlertas, type DadosBI } from "@/lib/relatorios/analise";
import {
  calcularIndicadoresAutomaticos,
  contarVisitantesRecorrentes,
  gerarAnaliseCongregacao,
  indicadorPorPercentual,
  maiorVariacaoMensal,
  posicaoNoRanking,
  tempoNaFuncao,
  type PontoMensalCong,
  type PontoSemanal,
} from "@/lib/relatorios/congregacao";

/**
 * O prontuário de UMA congregação — cabeçalho, resumo, frequência
 * domingo a domingo, classes, professores, visitantes, indicadores,
 * análise automática, comparativos, ranking, alertas e histórico.
 *
 *   ?de=&ate=   período principal (padrão: últimos 90 dias — mesmo padrão do Painel)
 *
 * ============================================================================
 * A MESMA CONTA DE TODAS AS CONGREGAÇÕES, SEMPRE — E SÓ NO FIM SE DECIDE O
 * QUE ENTRA NA RESPOSTA
 *
 * Ranking e "melhor/pior congregação" só existem comparando o campo inteiro.
 * Em vez de escrever essa conta duas vezes (uma "de verdade" para quem
 * enxerga tudo, outra escondendo nomes para o Grupo B), ela roda uma vez só,
 * para TODAS as congregações, e o recorte decide, no fim, o que sai no JSON —
 * nunca o que entra no cálculo. Isso impede a divergência clássica desse tipo
 * de atalho: a nota que a própria congregação vê em "IGS" tem de ser
 * EXATAMENTE a nota que ela ocupa no ranking, porque é a mesma variável.
 *
 * Um Dirigente da própria congregação continua vendo só a própria congregação
 * — o array cheio nunca sai no corpo da resposta para quem tem recorte;
 * `ranking`, `melhorCongregacao` e `piorCongregacao` saem `null`, com uma nota
 * dizendo o motivo.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const CARGOS_CONGREGACAO = ["Dirigente", "Vice-Dirigente", "Secretário Local"];

type Contexto = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Contexto) {
  const { sessao, recusa, congId: recorte } = await escopoDaRota("rel-painel");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Congregação inválida.", 400);

  return responder(async () => {
    exigirCongregacaoPermitida(recorte, id);

    const url = new URL(req.url);
    const { de: deP, ate: ateP } = periodoPadrao();
    const de = dataOu(url.searchParams.get("de"), deP);
    const ate = dataOu(url.searchParams.get("ate"), ateP);
    const meio = new Date((de.getTime() + ate.getTime()) / 2);
    const hoje = new Date();

    let domingosNoPeriodo = 0;
    for (let d = new Date(de); d <= ate; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() === 0) domingosNoPeriodo++;
    }

    /* ---------------------------------------------------------------- *
     * A congregação existe?
     * ---------------------------------------------------------------- */
    const congregacao = await prisma.congregacao.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        pessoaCargos: {
          where: { ativo: true, fim: null, cargo: { nome: { in: CARGOS_CONGREGACAO } } },
          orderBy: { cargo: { ordem: "asc" } },
          select: {
            cargo: { select: { nome: true } },
            pessoa: { select: { id: true, nome: true, tratamento: true, tel: true } },
          },
        },
      },
    });
    if (!congregacao) return erro("Congregação não encontrada.", 404);

    const por = (nome: string) => congregacao.pessoaCargos.find((v) => v.cargo.nome === nome)?.pessoa ?? null;
    const dirigente = por("Dirigente");
    const vice = por("Vice-Dirigente");
    const secretario = por("Secretário Local");

    /* ---------------------------------------------------------------- *
     * Frequência de TODAS as congregações, no período — base do IGS, do
     * ranking e da comparação com o campo (ver o comentário grande acima).
     * ---------------------------------------------------------------- */
    const porCongregacao = await prisma.$queryRaw<
      Array<{
        congId: number;
        nome: string;
        chamadas: bigint;
        presentes: bigint;
        domingosComChamada: bigint;
        chamadasAnt: bigint;
        presentesAnt: bigint;
        chamadasRec: bigint;
        presentesRec: bigint;
        visitantesAnt: bigint;
        visitantesRec: bigint;
        alunos: bigint;
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
        WHERE data BETWEEN ${de} AND ${ate}
        GROUP BY "congId"
      ),
      visitas AS (
        SELECT "congId",
               count(*) FILTER (WHERE data < ${meio})  AS ant,
               count(*) FILTER (WHERE data >= ${meio}) AS rec
        FROM "Visitantes"
        WHERE data BETWEEN ${de} AND ${ate}
        GROUP BY "congId"
      ),
      alunos AS (
        SELECT "congId", count(*) AS total FROM "Alunos" WHERE ativo GROUP BY "congId"
      )
      SELECT
        g.id                         AS "congId",
        g.nome                       AS nome,
        COALESCE(c.total, 0)         AS chamadas,
        COALESCE(c.presentes, 0)     AS presentes,
        COALESCE(c.domingos, 0)      AS "domingosComChamada",
        COALESCE(c.total_ant, 0)     AS "chamadasAnt",
        COALESCE(c.presentes_ant, 0) AS "presentesAnt",
        COALESCE(c.total_rec, 0)     AS "chamadasRec",
        COALESCE(c.presentes_rec, 0) AS "presentesRec",
        COALESCE(v.ant, 0)           AS "visitantesAnt",
        COALESCE(v.rec, 0)           AS "visitantesRec",
        COALESCE(a.total, 0)         AS alunos
      FROM "Congregacoes" g
      LEFT JOIN chamadas c ON c."congId" = g.id
      LEFT JOIN visitas v  ON v."congId" = g.id
      LEFT JOIN alunos a   ON a."congId" = g.id
      WHERE g.nome IS NOT NULL
      ORDER BY g.id
    `;

    const faltososPorCong = await prisma.$queryRaw<
      Array<{ congId: number; elegiveis: bigint; faltosos: bigint }>
    >`
      WITH ordenadas AS (
        SELECT f."alunoId", a."congId", f.data, f.presente,
               ROW_NUMBER() OVER (PARTITION BY f."alunoId" ORDER BY f.data DESC) AS pos
        FROM "Frequencias" f
        JOIN "Alunos" a ON a.id = f."alunoId" AND a.ativo
        WHERE f.data BETWEEN ${de} AND ${ate}
      ),
      primeira_presenca AS (
        SELECT "alunoId", MIN(pos) AS pos_presenca FROM ordenadas WHERE presente GROUP BY "alunoId"
      ),
      resumo AS (
        SELECT o."alunoId", o."congId",
               COALESCE(p.pos_presenca - 1, MAX(o.pos)) AS seguidas
        FROM ordenadas o
        LEFT JOIN primeira_presenca p ON p."alunoId" = o."alunoId"
        GROUP BY o."alunoId", o."congId", p.pos_presenca
      )
      SELECT "congId", count(*) AS elegiveis, count(*) FILTER (WHERE seguidas >= 3) AS faltosos
      FROM resumo GROUP BY "congId"
    `;
    const faltososPorId = new Map(
      faltososPorCong.map((f) => [f.congId, { elegiveis: Number(f.elegiveis), faltosos: Number(f.faltosos) }]),
    );

    interface EntradaBI {
      congId: number;
      nome: string;
      chamadas: number;
      alunos: number;
      taxaFrequencia: number | null;
      tendenciaPct: number | null;
      visitantesAnt: number;
      visitantesRec: number;
      igsNota: number | null;
      classificacaoRotulo: string | null;
      classificacaoFaixa: string | null;
    }

    const todasBI: EntradaBI[] = porCongregacao.map((c) => {
      const chamadas = Number(c.chamadas);
      const presentes = Number(c.presentes);
      const taxaFrequencia = chamadas > 0 ? (presentes / chamadas) * 100 : null;

      const taxaAnt = Number(c.chamadasAnt) > 0 ? (Number(c.presentesAnt) / Number(c.chamadasAnt)) * 100 : null;
      const taxaRec = Number(c.chamadasRec) > 0 ? (Number(c.presentesRec) / Number(c.chamadasRec)) * 100 : null;
      const tendenciaPct = taxaAnt !== null && taxaRec !== null ? variacaoPct(taxaAnt, taxaRec) : null;

      const domingosComChamada = Number(c.domingosComChamada);
      const regularidade = domingosNoPeriodo > 0 ? Math.min(100, (domingosComChamada / domingosNoPeriodo) * 100) : null;

      const visitantesAnt = Number(c.visitantesAnt);
      const visitantesRec = Number(c.visitantesRec);
      const visitantesScore =
        visitantesAnt === 0 && visitantesRec === 0 ? null : scoreDeVariacao(variacaoPct(visitantesAnt, visitantesRec));

      const falt = faltososPorId.get(c.congId);
      const faltososScore = falt && falt.elegiveis > 0 ? 100 - (falt.faltosos / falt.elegiveis) * 100 : null;

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
        nome: c.nome?.trim() || `Congregação ${c.congId}`,
        chamadas,
        alunos: Number(c.alunos),
        taxaFrequencia,
        tendenciaPct,
        visitantesAnt,
        visitantesRec,
        igsNota: igs?.nota ?? null,
        classificacaoRotulo: classificacao?.rotulo ?? null,
        classificacaoFaixa: classificacao?.faixa ?? null,
      };
    });

    const esta = todasBI.find((c) => c.congId === id)!;

    // Campo — soma bruta, o mesmo desenho do Painel (evita o paradoxo de
    // Simpson de misturar congregações de tamanhos diferentes).
    const somaCampo = porCongregacao.reduce(
      (acc, c) => ({
        chamadas: acc.chamadas + Number(c.chamadas),
        presentes: acc.presentes + Number(c.presentes),
      }),
      { chamadas: 0, presentes: 0 },
    );
    const taxaCampo = somaCampo.chamadas > 0 ? (somaCampo.presentes / somaCampo.chamadas) * 100 : null;

    /* ---------------------------------------------------------------- *
     * Classes da congregação, com matriculados/presentes/ausentes/
     * visitantes/professores no período.
     *
     * ATIVAS, SEMPRE — E AS ARQUIVADAS QUE TIVERAM CHAMADA NO PERÍODO.
     *
     * Excluir uma classe com histórico não apaga: arquiva (`ativa = false`),
     * e o aviso da tela promete "o histórico continua valendo nos
     * relatórios". Filtrar aqui só por `ativa: true` quebrava essa promessa
     * — a classe sumia por inteiro desta tabela e da de professores, mesmo
     * tendo chamada registrada dentro do período sendo olhado agora. Uma
     * secretária que arquiva uma classe por engano (o sistema é novo para
     * elas) via o histórico dela desaparecer do relatório, não só da lista
     * do dia a dia.
     *
     * A classe arquivada só entra se teve chamada NO PERÍODO — arquivadas
     * de anos atrás, sem nada a dizer sobre este período, continuam de
     * fora, senão a lista encheria de linhas zeradas.
     * ---------------------------------------------------------------- */
    const classesBase = await prisma.classe.findMany({
      where: {
        congId: id,
        OR: [{ ativa: true }, { frequencias: { some: { data: { gte: de, lte: ate } } } }],
      },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        ativa: true,
        _count: { select: { alunos: { where: { ativo: true } } } },
        pessoaCargos: {
          where: { ativo: true, fim: null, cargo: { nome: "Professor" } },
          select: { pessoa: { select: { id: true, nome: true, tratamento: true } }, inicio: true },
        },
      },
    });
    const classesAtivas = classesBase.filter((c) => c.ativa);

    const freqPorClasse = await prisma.$queryRaw<
      Array<{
        classeId: number;
        chamados: bigint;
        presentes: bigint;
        chamadosAnt: bigint;
        presentesAnt: bigint;
        chamadosRec: bigint;
        presentesRec: bigint;
        ultimaChamada: Date | null;
      }>
    >`
      SELECT
        "classeId",
        count(*)                                            AS chamados,
        count(*) FILTER (WHERE presente)                    AS presentes,
        count(*) FILTER (WHERE data < ${meio})               AS "chamadosAnt",
        count(*) FILTER (WHERE presente AND data < ${meio})  AS "presentesAnt",
        count(*) FILTER (WHERE data >= ${meio})              AS "chamadosRec",
        count(*) FILTER (WHERE presente AND data >= ${meio}) AS "presentesRec",
        max(data)                                           AS "ultimaChamada"
      FROM "Frequencias"
      WHERE "congId" = ${id} AND data BETWEEN ${de} AND ${ate}
      GROUP BY "classeId"
    `;
    const freqPorClasseMap = new Map(freqPorClasse.map((f) => [f.classeId, f]));

    const visitantesPorClasse = await prisma.$queryRaw<Array<{ classeId: number; total: bigint }>>`
      SELECT "classeId", count(*) AS total
      FROM "Visitantes"
      WHERE "congId" = ${id} AND data BETWEEN ${de} AND ${ate} AND "classeId" IS NOT NULL
      GROUP BY "classeId"
    `;
    const visitantesPorClasseMap = new Map(visitantesPorClasse.map((v) => [v.classeId, Number(v.total)]));

    interface ClasseAnalise {
      classeId: number;
      nome: string;
      ativa: boolean;
      professores: string[];
      matriculados: number;
      presentes: number;
      ausentes: number;
      visitantes: number;
      percentual: number | null;
      indicador: ReturnType<typeof indicadorPorPercentual>;
      tendenciaPct: number | null;
      diasSemChamada: number | null;
    }

    const classesAnalise: ClasseAnalise[] = classesBase.map((c) => {
      const f = freqPorClasseMap.get(c.id);
      const chamados = f ? Number(f.chamados) : 0;
      const presentes = f ? Number(f.presentes) : 0;
      const percentual = chamados > 0 ? Math.round((presentes / chamados) * 1000) / 10 : null;

      const taxaAnt = f && Number(f.chamadosAnt) > 0 ? (Number(f.presentesAnt) / Number(f.chamadosAnt)) * 100 : null;
      const taxaRec = f && Number(f.chamadosRec) > 0 ? (Number(f.presentesRec) / Number(f.chamadosRec)) * 100 : null;
      const tendenciaPct = taxaAnt !== null && taxaRec !== null ? variacaoPct(taxaAnt, taxaRec) : null;

      const diasSemChamada = f?.ultimaChamada
        ? Math.floor((ate.getTime() - f.ultimaChamada.getTime()) / 86_400_000)
        : null;

      return {
        classeId: c.id,
        nome: c.nome,
        ativa: c.ativa,
        professores: c.pessoaCargos.map(
          (v) => `${v.pessoa.tratamento ? v.pessoa.tratamento + " " : ""}${v.pessoa.nome}`,
        ),
        matriculados: c._count.alunos,
        presentes,
        ausentes: chamados - presentes,
        visitantes: visitantesPorClasseMap.get(c.id) ?? 0,
        percentual,
        indicador: indicadorPorPercentual(percentual),
        tendenciaPct,
        diasSemChamada,
      };
    });

    // "Atrasada" é um pedido de ação — faça a chamada dessa classe. Uma
    // classe arquivada não vai receber chamada nenhuma de novo, então não
    // entra nem na contagem nem no alerta, mesmo que apareça na tabela
    // acima com o histórico do período.
    const classesAtrasadas = classesAnalise.filter(
      (c) => c.ativa && (c.diasSemChamada === null || c.diasSemChamada >= 21),
    ).length;

    /* ---------------------------------------------------------------- *
     * Professores — um vínculo por classe (a mesma pessoa em duas
     * classes aparece duas vezes, uma linha por turma).
     * ---------------------------------------------------------------- */
    const professoresAnalise = classesBase.flatMap((c) => {
      const analise = classesAnalise.find((a) => a.classeId === c.id)!;
      return c.pessoaCargos.map((v) => ({
        pessoaId: v.pessoa.id,
        nome: `${v.pessoa.tratamento ? v.pessoa.tratamento + " " : ""}${v.pessoa.nome}`,
        classe: c.nome,
        classeId: c.id,
        // Separa "professores hoje" (contagem do cabeçalho) de "quem deu
        // aula no período" (a tabela inteira, que inclui classe arquivada).
        classeAtiva: c.ativa,
        frequenciaMediaClasse: analise.percentual,
        chamadasRealizadas: freqPorClasseMap.get(c.id) ? Number(freqPorClasseMap.get(c.id)!.chamados) : 0,
        visitantesRecebidos: analise.visitantes,
        tempoNaFuncao: tempoNaFuncao(v.inicio, hoje),
        crescimentoClasse: analise.tendenciaPct,
      }));
    });

    /* ---------------------------------------------------------------- *
     * Domingo a domingo — a série que alimenta os dois gráficos e os
     * indicadores automáticos.
     * ---------------------------------------------------------------- */
    const porDomingo = await prisma.$queryRaw<
      Array<{ data: Date; chamados: bigint; presentes: bigint; visitantes: bigint }>
    >`
      WITH freq AS (
        SELECT data, count(*) AS chamados, count(*) FILTER (WHERE presente) AS presentes
        FROM "Frequencias"
        WHERE "congId" = ${id} AND data BETWEEN ${de} AND ${ate}
        GROUP BY data
      ),
      vis AS (
        SELECT data, count(*) AS total
        FROM "Visitantes"
        WHERE "congId" = ${id} AND data BETWEEN ${de} AND ${ate}
        GROUP BY data
      )
      SELECT f.data, f.chamados, f.presentes, COALESCE(v.total, 0) AS visitantes
      FROM freq f
      LEFT JOIN vis v ON v.data = f.data
      ORDER BY f.data ASC
    `;
    const semanas: PontoSemanal[] = porDomingo.map((s) => {
      const chamados = Number(s.chamados);
      const presentes = Number(s.presentes);
      return {
        data: s.data.toISOString().slice(0, 10),
        presentes,
        ausentes: chamados - presentes,
        visitantes: Number(s.visitantes),
        taxa: chamados > 0 ? Math.round((presentes / chamados) * 1000) / 10 : null,
      };
    });
    const indicadoresAutomaticos = calcularIndicadoresAutomaticos(semanas);

    /* ---------------------------------------------------------------- *
     * Evolução mensal (12 meses fixos) e anual (todo o histórico)
     * ---------------------------------------------------------------- */
    const dozeMesesAtras = new Date(ate);
    dozeMesesAtras.setUTCMonth(dozeMesesAtras.getUTCMonth() - 11);
    dozeMesesAtras.setUTCDate(1);

    const [serieMensal, serieAnual] = await Promise.all([
      prisma.$queryRaw<Array<{ mes: Date; chamadas: bigint; presentes: bigint }>>`
        WITH meses AS (
          SELECT generate_series(
            date_trunc('month', ${dozeMesesAtras}::date),
            date_trunc('month', ${ate}::date),
            '1 month'
          ) AS mes
        )
        SELECT m.mes, COALESCE(f.chamadas, 0) AS chamadas, COALESCE(f.presentes, 0) AS presentes
        FROM meses m
        LEFT JOIN (
          SELECT date_trunc('month', data) AS mes, count(*) AS chamadas, count(*) FILTER (WHERE presente) AS presentes
          FROM "Frequencias"
          WHERE "congId" = ${id}
          GROUP BY 1
        ) f ON f.mes = m.mes
        ORDER BY m.mes
      `,
      prisma.$queryRaw<Array<{ ano: number; chamadas: bigint; presentes: bigint }>>`
        SELECT
          date_part('year', data)::int AS ano,
          count(*)                          AS chamadas,
          count(*) FILTER (WHERE presente)  AS presentes
        FROM "Frequencias"
        WHERE "congId" = ${id}
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    const evolucaoMensal: PontoMensalCong[] = serieMensal.map((m) => {
      const chamadas = Number(m.chamadas);
      return {
        mes: m.mes.toISOString().slice(0, 7),
        taxa: chamadas > 0 ? Math.round((Number(m.presentes) / chamadas) * 1000) / 10 : null,
        chamadas,
      };
    });
    const { maiorCrescimento, maiorReducao } = maiorVariacaoMensal(evolucaoMensal);

    const evolucaoAnual = serieAnual.map((a) => {
      const chamadas = Number(a.chamadas);
      return {
        ano: a.ano,
        taxa: chamadas > 0 ? Math.round((Number(a.presentes) / chamadas) * 1000) / 10 : null,
        chamadas,
      };
    });

    /* ---------------------------------------------------------------- *
     * Visitantes — recorrência, por mês (reaproveita a série mensal de
     * chamada, mas contando Visitantes).
     * ---------------------------------------------------------------- */
    const visitantesNoPeriodo = await prisma.visitante.findMany({
      where: { congId: id, data: { gte: de, lte: ate } },
      select: { nome: true, data: true },
    });
    const recorrencia = contarVisitantesRecorrentes(
      visitantesNoPeriodo.map((v) => ({ nome: v.nome, data: v.data.toISOString().slice(0, 10) })),
    );

    const visitantesPorMes = await prisma.$queryRaw<Array<{ mes: Date; total: bigint }>>`
      SELECT date_trunc('month', data) AS mes, count(*) AS total
      FROM "Visitantes"
      WHERE "congId" = ${id} AND data >= ${dozeMesesAtras} AND data <= ${ate}
      GROUP BY 1 ORDER BY 1
    `;

    /* ---------------------------------------------------------------- *
     * Histórico — Auditoria desta congregação (só a partir da Fase 12,
     * quando o sistema passou a gravar `congId` na auditoria).
     * ---------------------------------------------------------------- */
    const historico = await prisma.auditoria.findMany({
      where: { congId: id },
      orderBy: { when: "desc" },
      take: 50,
      select: { when: true, who: true, action: true, entidade: true, desc: true },
    });

    /* ---------------------------------------------------------------- *
     * Análise automática e alertas — só desta congregação.
     * ---------------------------------------------------------------- */
    const melhorClasseCandidatas = classesAnalise.filter((c) => c.percentual !== null);
    const melhorClasse = melhorClasseCandidatas.length
      ? [...melhorClasseCandidatas].sort((a, b) => (b.percentual as number) - (a.percentual as number))[0]
      : null;
    const piorClasse = melhorClasseCandidatas.length
      ? [...melhorClasseCandidatas].sort((a, b) => (a.percentual as number) - (b.percentual as number))[0]
      : null;

    const analise = gerarAnaliseCongregacao({
      nome: esta.nome,
      chamadas: esta.chamadas,
      taxaFrequencia: esta.taxaFrequencia,
      tendenciaPct: esta.tendenciaPct,
      campoTaxaFrequencia: taxaCampo,
      igsNota: esta.igsNota,
      classificacaoRotulo: esta.classificacaoRotulo,
      melhorClasse: melhorClasse ? { nome: melhorClasse.nome, percentual: melhorClasse.percentual as number } : null,
      piorClasse:
        piorClasse && piorClasse.classeId !== melhorClasse?.classeId
          ? { nome: piorClasse.nome, percentual: piorClasse.percentual as number }
          : null,
      visitantesVariacaoPct:
        esta.visitantesAnt === 0 && esta.visitantesRec === 0 ? null : variacaoPct(esta.visitantesAnt, esta.visitantesRec),
      visitantesRec: esta.visitantesRec,
      classesAtrasadas,
    });

    const dadosBIParaAlertas: DadosBI = {
      periodo: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) },
      campo: {
        taxaFrequencia: taxaCampo,
        tendenciaPct: null,
        visitantesAnt: 0,
        visitantesRec: 0,
        igs: null,
        classificacao: null,
        componentes: { frequencia: null, regularidade: null, tendencia: null, visitantes: null, faltosos: null },
      },
      congregacoes: [
        {
          congId: esta.congId,
          nome: esta.nome,
          chamadas: esta.chamadas,
          taxaFrequencia: esta.taxaFrequencia,
          tendenciaPct: esta.tendenciaPct,
          visitantesAnt: esta.visitantesAnt,
          visitantesRec: esta.visitantesRec,
          igs: esta.igsNota !== null ? { nota: esta.igsNota, componentesUsados: [] } : null,
          classificacao:
            esta.classificacaoFaixa && esta.classificacaoRotulo
              ? { faixa: esta.classificacaoFaixa as never, rotulo: esta.classificacaoRotulo, emoji: "" }
              : null,
          componentes: { frequencia: null, regularidade: null, tendencia: null, visitantes: null, faltosos: null },
        },
      ],
      classesSemChamada: classesAnalise
        .filter((c) => c.ativa && (c.diasSemChamada === null || c.diasSemChamada >= 21))
        .map((c) => ({ classeId: c.classeId, classe: c.nome, congregacao: esta.nome, diasSemChamada: c.diasSemChamada })),
    };
    const alertas = gerarAlertas(dadosBIParaAlertas);

    /* ---------------------------------------------------------------- *
     * Ranking e comparativo com nomes de outras congregações — SÓ para
     * quem enxerga o campo inteiro (ver o comentário grande no topo).
     * ---------------------------------------------------------------- */
    const vejoOCampoTodo = recorte === undefined;

    let ranking = null;
    let melhorCongregacao: { nome: string; nota: number } | null = null;
    let piorCongregacao: { nome: string; nota: number } | null = null;

    if (vejoOCampoTodo) {
      ranking = {
        frequencia: posicaoNoRanking(todasBI.map((c) => ({ id: c.congId, valor: c.taxaFrequencia })), id),
        visitantes: posicaoNoRanking(
          todasBI.map((c) => ({ id: c.congId, valor: c.visitantesAnt + c.visitantesRec })),
          id,
        ),
        crescimento: posicaoNoRanking(todasBI.map((c) => ({ id: c.congId, valor: c.tendenciaPct })), id),
        chamadas: posicaoNoRanking(todasBI.map((c) => ({ id: c.congId, valor: c.chamadas })), id),
        alunos: posicaoNoRanking(todasBI.map((c) => ({ id: c.congId, valor: c.alunos })), id),
        igs: posicaoNoRanking(todasBI.map((c) => ({ id: c.congId, valor: c.igsNota })), id),
      };

      const comIGS = todasBI.filter((c) => c.igsNota !== null);
      if (comIGS.length > 0) {
        const ordenado = [...comIGS].sort((a, b) => (b.igsNota as number) - (a.igsNota as number));
        melhorCongregacao = { nome: ordenado[0].nome, nota: ordenado[0].igsNota as number };
        const pior = ordenado[ordenado.length - 1];
        if (pior.congId !== ordenado[0].congId) piorCongregacao = { nome: pior.nome, nota: pior.igsNota as number };
      }
    }

    return {
      periodo: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) },
      cabecalho: {
        congId: esta.congId,
        nome: esta.nome,
        dirigente: dirigente ? { nome: dirigente.nome, tratamento: dirigente.tratamento, telefone: dirigente.tel } : null,
        vice: vice ? { nome: vice.nome, tratamento: vice.tratamento } : null,
        secretario: secretario ? { nome: secretario.nome, tratamento: secretario.tratamento } : null,
        classes: classesAtivas.length,
        professores: new Set(
          professoresAnalise.filter((p) => p.classeAtiva).map((p) => p.pessoaId),
        ).size,
        alunos: esta.alunos,
        igsNota: esta.igsNota,
        classificacaoRotulo: esta.classificacaoRotulo,
        classificacaoFaixa: esta.classificacaoFaixa,
      },
      resumo: {
        matriculados: esta.alunos,
        professores: new Set(
          professoresAnalise.filter((p) => p.classeAtiva).map((p) => p.pessoaId),
        ).size,
        classes: classesAtivas.length,
        visitantes: esta.visitantesAnt + esta.visitantesRec,
        taxaFrequencia: esta.taxaFrequencia,
        igsNota: esta.igsNota,
        tendenciaPct: esta.tendenciaPct,
      },
      semanas,
      indicadoresAutomaticos,
      evolucaoMensal,
      maiorCrescimentoMes: maiorCrescimento,
      maiorReducaoMes: maiorReducao,
      evolucaoAnual,
      classes: classesAnalise,
      professores: professoresAnalise,
      visitantes: {
        total: esta.visitantesAnt + esta.visitantesRec,
        variacaoPct: esta.visitantesAnt === 0 && esta.visitantesRec === 0 ? null : variacaoPct(esta.visitantesAnt, esta.visitantesRec),
        recorrentes: recorrencia.recorrentes,
        unicos: recorrencia.unicos,
        porMes: visitantesPorMes.map((v) => ({ mes: v.mes.toISOString().slice(0, 7), total: Number(v.total) })),
      },
      analise,
      alertas,
      historico: historico.map((h) => ({
        quando: h.when.toISOString(),
        quem: h.who,
        acao: h.action,
        entidade: h.entidade,
        descricao: h.desc,
      })),
      comparativoCampo: { taxaFrequencia: { congregacao: esta.taxaFrequencia, campo: taxaCampo } },
      ranking,
      melhorCongregacao,
      piorCongregacao,
      vejoOCampoTodo,
    };
  });
}
