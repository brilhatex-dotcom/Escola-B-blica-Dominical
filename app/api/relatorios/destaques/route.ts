import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { erro } from "@/lib/api";
import { escopoDaRota } from "@/lib/auth/escopo";
import { dataOu, MINIMO_DE_CHAMADAS, recorteSql } from "@/lib/relatorios/comum";
import { inicioDoMes, inicioDoTrimestre } from "@/lib/dashboard/destaque";
import { contarVisitantesRecorrentes } from "@/lib/relatorios/congregacao";
import {
  calcularIDI,
  calcularRetencao,
  gerarJustificativaIDI,
  maiorPorCriterio,
  type Candidato,
  type ComponentesIDI,
  type VencedorCriterio,
} from "@/lib/relatorios/idi";
import { calcularIGS, scoreDeVariacao, variacaoPct, type ComponentesIGS } from "@/lib/relatorios/indices";

/**
 * O painel "Destaques" — dez categorias, calculadas pelo Índice de Destaque
 * Inteligente (IDI, `lib/relatorios/idi.ts`), mais o Hall da Fama (Fase 21).
 *
 *   ?periodo=mensal|trimestral|anual|personalizado   (padrão: mensal)
 *   ?de=&ate=                                          (só para "personalizado")
 *
 * ============================================================================
 * TUDO NUMA CHAMADA SÓ — E A MESMA CHAMADA SERVE O PAINEL E O DETALHE
 *
 * As dez categorias e o Hall da Fama saem juntos, na mesma resposta. A tela
 * de detalhe (`/dashboard/relatorios/destaques/[categoria]`) não tem rota
 * própria — pede o MESMO JSON e mostra só a categoria escolhida. Duas rotas
 * fazendo a mesma apuração arriscariam um dia divergir; uma rota só, lida de
 * dois jeitos, não tem como.
 *
 * Congregação Destaque, Maior Crescimento, Melhor Frequência, Evangelismo,
 * Revelação e as duas Evoluções são SEMPRE do campo inteiro, para todo mundo
 * — a mesma exceção de recorte já usada em Liderança, Aniversariantes e no
 * Destaque original (Fase 18). Classe Destaque e Professor Destaque
 * CONTINUAM recortados pelo acesso de quem pede.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

interface Contexto {
  de: Date;
  ate: Date;
}

type Recorte = { in: number[] } | undefined;

export async function GET(req: Request) {
  const { recusa, congId: recorte } = await escopoDaRota("rel-painel");
  if (recusa) return recusa;

  const url = new URL(req.url);
  const modo = url.searchParams.get("periodo") ?? "mensal";
  const hoje = new Date();

  let de: Date;
  let ate: Date;
  if (modo === "trimestral") {
    de = inicioDoTrimestre(hoje);
    ate = hoje;
  } else if (modo === "anual") {
    de = new Date(Date.UTC(hoje.getUTCFullYear(), 0, 1));
    ate = hoje;
  } else if (modo === "personalizado") {
    const deP = dataOu(url.searchParams.get("de"), inicioDoMes(hoje));
    const ateP = dataOu(url.searchParams.get("ate"), hoje);
    if (deP > ateP) return erro("A data inicial não pode vir depois da data final.", 400);
    de = deP;
    ate = ateP;
  } else {
    de = inicioDoMes(hoje);
    ate = hoje;
  }

  try {
    const ctx: Contexto = { de, ate };
    const [congregacoes, classes, professores] = await Promise.all([
      metricasCongregacoes(ctx),
      metricasClasses(ctx, recorte),
      metricasProfessores(ctx, recorte),
    ]);
    const porId = new Map(congregacoes.map((m) => [m.congId, m]));

    const cand = (chave: NumeroDeCong): Candidato[] =>
      congregacoes.map((m) => ({ id: m.congId, nome: m.nome, valor: m[chave] }));

    const idiVencedor = maiorPorCriterio(cand("idiNota"));
    const frequenciaVencedor = maiorPorCriterio(cand("frequencia"));
    const evangelismoVencedor = maiorPorCriterio(cand("visitantesNaoCrentesRate"));
    const crescimentoAnualVencedor = maiorPorCriterio(cand("crescimentoAnualPct"));
    const crescimentoTrimestralVencedor = maiorPorCriterio(cand("crescimentoTrimestralPct"));
    // "Maior Crescimento" é VOLUME de gente a mais (presentes a mais no
    // trimestre atual vs o anterior) — distinto das duas evoluções, que
    // comparam TAXA. Ver o comentário grande em `lib/relatorios/idi.ts`
    // sobre "crescimento de matrícula" não existir como dado: isto é a
    // aproximação honesta que existe.
    const maiorCrescimentoVencedor = maiorPorCriterio(cand("crescimentoVolumePct"));
    // Revelação: maior crescimento trimestral entre quem NÃO é já a
    // Congregação Destaque — celebra quem está subindo, não quem já chegou.
    const revelacaoVencedor = maiorPorCriterio(cand("crescimentoTrimestralPct"), idiVencedor?.ids ?? []);

    const classeVencedor = maiorPorCriterio(classes.map((c) => ({ id: c.classeId, nome: c.nome, valor: c.score })));
    const professorVencedor = maiorPorCriterio(professores.map((p) => ({ id: p.pessoaId, nome: p.nome, valor: p.score })));

    const categorias = {
      congregacaoDestaque: idiVencedor
        ? detalheCong(idiVencedor, porId, gerarMotivoIDI(idiVencedor, porId))
        : null,
      maiorCrescimento: maiorCrescimentoVencedor
        ? detalheCong(
            maiorCrescimentoVencedor,
            porId,
            `${nomesDe(maiorCrescimentoVencedor)} teve o maior aumento de gente presente no trimestre, na comparação com o trimestre anterior: +${maiorCrescimentoVencedor.valor}%.`,
          )
        : null,
      melhorFrequencia: frequenciaVencedor
        ? detalheCong(frequenciaVencedor, porId, `${nomesDe(frequenciaVencedor)} teve a maior taxa de presença do campo: ${frequenciaVencedor.valor}%.`)
        : null,
      destaqueEvangelismo: evangelismoVencedor
        ? detalheCong(
            evangelismoVencedor,
            porId,
            `${nomesDe(evangelismoVencedor)} recebeu a maior proporção de visitantes não crentes: ${evangelismoVencedor.valor}% dos visitantes com resposta sobre a fé.`,
          )
        : null,
      melhorConsolidacao: {
        tipo: "congregacao" as const,
        ids: [],
        nomes: [],
        nota: null,
        motivos:
          "Ainda não é possível calcular esta categoria — o cadastro não guarda o vínculo entre um visitante e o aluno em que ele eventualmente virou. Fica marcada aqui de propósito, em vez de escondida, para lembrar que a categoria existe e falta um dado para preenchê-la.",
      },
      professorDestaque: professorVencedor
        ? {
            tipo: "professor" as const,
            ids: professorVencedor.ids,
            nomes: professorVencedor.nomes,
            nota: professorVencedor.valor,
            motivos: `${nomesDe(professorVencedor)} ${professorVencedor.nomes.length > 1 ? "lideram" : "lidera"} pela combinação de frequência, regularidade e visitantes da turma que ${professorVencedor.nomes.length > 1 ? "lecionam" : "leciona"}.`,
          }
        : null,
      classeDestaque: classeVencedor
        ? {
            tipo: "classe" as const,
            ids: classeVencedor.ids,
            nomes: classeVencedor.nomes,
            nota: classeVencedor.valor,
            motivos: `${nomesDe(classeVencedor)} ${classeVencedor.nomes.length > 1 ? "empatam" : "lidera"} em assiduidade e visitantes trazidos.`,
          }
        : null,
      congregacaoRevelacao: revelacaoVencedor
        ? detalheCong(
            revelacaoVencedor,
            porId,
            `${nomesDe(revelacaoVencedor)} é a congregação que mais cresceu no trimestre entre as que ainda não são a Congregação Destaque: +${revelacaoVencedor.valor}% de frequência.`,
          )
        : null,
      melhorEvolucaoTrimestral: crescimentoTrimestralVencedor
        ? detalheCong(
            crescimentoTrimestralVencedor,
            porId,
            `${nomesDe(crescimentoTrimestralVencedor)} teve a maior evolução de frequência no trimestre: ${crescimentoTrimestralVencedor.valor > 0 ? "+" : ""}${crescimentoTrimestralVencedor.valor}%.`,
          )
        : null,
      melhorEvolucaoAnual: crescimentoAnualVencedor
        ? detalheCong(
            crescimentoAnualVencedor,
            porId,
            `${nomesDe(crescimentoAnualVencedor)} teve a maior evolução de frequência no ano: ${crescimentoAnualVencedor.valor > 0 ? "+" : ""}${crescimentoAnualVencedor.valor}%.`,
          )
        : null,
    };

    const vejoOCampoTodo = recorte === undefined;
    const hallDaFama = vejoOCampoTodo ? await montarHallDaFama(hoje) : null;

    return NextResponse.json({
      periodo: { de: iso(de), ate: iso(ate), modo },
      categorias,
      hallDaFama,
      vejoOCampoTodo,
    });
  } catch (e) {
    /*
     * O erro de verdade vai no corpo da resposta, temporariamente — o mesmo
     * padrão já usado em `/api/painel` (campo `motivo`) para quem administra
     * conseguir descrever o problema sem precisar abrir o log da Vercel. Uma
     * rota nova e grande como esta tem mais chance de esbarrar num detalhe do
     * banco de produção que o ambiente de desenvolvimento não replica —
     * melhor mostrar o motivo técnico aqui do que só "não foi possível".
     */
    console.error("[destaques] falhou:", e);
    return NextResponse.json(
      { erro: "Não foi possível calcular os destaques.", motivo: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function nomesDe(v: VencedorCriterio): string {
  return v.nomes.join(" e ");
}

interface DetalheCongregacao {
  tipo: "congregacao";
  ids: number[];
  nomes: string[];
  nota: number | null;
  motivos: string;
  indicadores?: ComponentesIDI;
}

function detalheCong(v: VencedorCriterio, porId: Map<number, MetricaCong>, motivos: string): DetalheCongregacao {
  const primeiro = porId.get(v.ids[0]);
  return { tipo: "congregacao", ids: v.ids, nomes: v.nomes, nota: v.valor, motivos, indicadores: primeiro?.componentesIDI };
}

function gerarMotivoIDI(v: VencedorCriterio, porId: Map<number, MetricaCong>): string {
  const m = porId.get(v.ids[0]);
  if (!m) return `${nomesDe(v)} foi eleita Congregação Destaque.`;
  const base = gerarJustificativaIDI({
    nome: m.nome,
    frequencia: m.frequencia,
    crescimentoTrimestral: m.crescimentoTrimestralPct,
    visitantes: m.visitantesTotal,
    visitantesNaoCrentes: m.visitantesNaoCrentesTotal,
    regularidade: m.regularidade,
    domingosNoPeriodo: m.domingosNoPeriodo,
    domingosComChamada: m.domingosComChamada,
  });
  return v.ids.length > 1 ? `${nomesDe(v)} empataram em ${v.valor} pontos no Índice de Destaque Inteligente.` : base;
}

/* ------------------------------------------------------------------ *
 * Congregações — as métricas completas por trás do IDI
 * ------------------------------------------------------------------ */

interface MetricaCong {
  congId: number;
  nome: string;
  frequencia: number | null;
  regularidade: number | null;
  domingosNoPeriodo: number;
  domingosComChamada: number;
  visitantesTotal: number;
  visitantesNaoCrentesTotal: number;
  visitantesNaoCrentesRate: number | null;
  visitantesRate: number | null;
  visitantesRetornaramRate: number | null;
  retencaoAlunos: number | null;
  participacaoProfessores: number | null;
  crescimentoTrimestralPct: number | null;
  crescimentoAnualPct: number | null;
  crescimentoVolumePct: number | null;
  igsNota: number | null;
  idiNota: number | null;
  componentesIDI: ComponentesIDI;
}

type NumeroDeCong = { [K in keyof MetricaCong]: MetricaCong[K] extends number | null ? K : never }[keyof MetricaCong];

async function metricasCongregacoes(ctx: Contexto): Promise<MetricaCong[]> {
  const { de, ate } = ctx;
  const meio = new Date((de.getTime() + ate.getTime()) / 2);

  let domingosNoPeriodo = 0;
  for (let d = new Date(de); d <= ate; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 0) domingosNoPeriodo++;
  }

  /*
   * Janelas fixas no calendário, ANCORADAS em `ate` — o fim do período sendo
   * examinado —, não na data real de hoje.
   *
   * Sem isso, apurar "quem foi a Congregação Destaque em março" (Hall da
   * Fama) misturaria a tendência de HOJE (agosto) no componente de
   * crescimento trimestral de um mês fechado há cinco meses — dois relógios
   * diferentes na mesma nota. Ancorando em `ate`, toda a apuração de um
   * período fica internamente consistente, esteja ele fechado há anos ou
   * seja hoje mesmo (onde `ate` já é hoje, e nada muda).
   */
  const hoje = ate;
  const inicioTriAtual = inicioDoTrimestre(hoje);
  const fimTriAnterior = new Date(inicioTriAtual);
  fimTriAnterior.setUTCDate(fimTriAnterior.getUTCDate() - 1);
  const inicioTriAnterior = new Date(inicioTriAtual);
  inicioTriAnterior.setUTCMonth(inicioTriAnterior.getUTCMonth() - 3);

  const inicioAnoAtual = new Date(Date.UTC(hoje.getUTCFullYear(), 0, 1));
  const inicioAnoAnterior = new Date(Date.UTC(hoje.getUTCFullYear() - 1, 0, 1));
  const fimAnoAnteriorYTD = new Date(Date.UTC(hoje.getUTCFullYear() - 1, hoje.getUTCMonth(), hoje.getUTCDate()));

  const [base, faltosos, janelas, naoCrentes, retencao, professores, visitasParaRecorrencia] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        congId: number;
        nome: string;
        chamados: bigint;
        presentes: bigint;
        domingos: bigint;
        chamadosAnt: bigint;
        presentesAnt: bigint;
        chamadosRec: bigint;
        presentesRec: bigint;
        domingosComVisitante: bigint;
        visitantesTotal: bigint;
        visitantesAnt: bigint;
        visitantesRec: bigint;
      }>
    >`
      WITH freq AS (
        SELECT "congId",
               count(*)                                            AS chamados,
               count(*) FILTER (WHERE presente)                    AS presentes,
               count(DISTINCT data)                                AS domingos,
               count(*) FILTER (WHERE data < ${meio})               AS "chamadosAnt",
               count(*) FILTER (WHERE presente AND data < ${meio})  AS "presentesAnt",
               count(*) FILTER (WHERE data >= ${meio})              AS "chamadosRec",
               count(*) FILTER (WHERE presente AND data >= ${meio}) AS "presentesRec"
        FROM "Frequencias"
        WHERE data BETWEEN ${de} AND ${ate}
        GROUP BY "congId"
      ),
      vis AS (
        SELECT "congId", count(DISTINCT data) AS "domingosComVisitante", count(*) AS "visitantesTotal",
               count(*) FILTER (WHERE data < ${meio})  AS "visitantesAnt",
               count(*) FILTER (WHERE data >= ${meio}) AS "visitantesRec"
        FROM "Visitantes"
        WHERE data BETWEEN ${de} AND ${ate}
        GROUP BY "congId"
      )
      SELECT g.id AS "congId", g.nome AS nome,
             COALESCE(f.chamados, 0) AS chamados, COALESCE(f.presentes, 0) AS presentes,
             COALESCE(f.domingos, 0) AS domingos,
             COALESCE(f."chamadosAnt", 0) AS "chamadosAnt", COALESCE(f."presentesAnt", 0) AS "presentesAnt",
             COALESCE(f."chamadosRec", 0) AS "chamadosRec", COALESCE(f."presentesRec", 0) AS "presentesRec",
             COALESCE(v."domingosComVisitante", 0) AS "domingosComVisitante",
             COALESCE(v."visitantesTotal", 0) AS "visitantesTotal",
             COALESCE(v."visitantesAnt", 0) AS "visitantesAnt",
             COALESCE(v."visitantesRec", 0) AS "visitantesRec"
      FROM "Congregacoes" g
      LEFT JOIN freq f ON f."congId" = g.id
      LEFT JOIN vis v ON v."congId" = g.id
      WHERE g.nome IS NOT NULL
      ORDER BY g.id
    `,
    prisma.$queryRaw<Array<{ congId: number; elegiveis: bigint; faltosos: bigint }>>`
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
        SELECT o."alunoId", o."congId", COALESCE(p.pos_presenca - 1, MAX(o.pos)) AS seguidas
        FROM ordenadas o LEFT JOIN primeira_presenca p ON p."alunoId" = o."alunoId"
        GROUP BY o."alunoId", o."congId", p.pos_presenca
      )
      SELECT "congId", count(*) AS elegiveis, count(*) FILTER (WHERE seguidas >= 3) AS faltosos
      FROM resumo GROUP BY "congId"
    `,
    prisma.$queryRaw<
      Array<{
        congId: number;
        chamadosTriAtual: bigint;
        presentesTriAtual: bigint;
        chamadosTriAnt: bigint;
        presentesTriAnt: bigint;
        chamadosAnoAtual: bigint;
        presentesAnoAtual: bigint;
        chamadosAnoAnt: bigint;
        presentesAnoAnt: bigint;
      }>
    >`
      SELECT "congId",
        count(*) FILTER (WHERE data >= ${inicioTriAtual} AND data <= ${hoje})                              AS "chamadosTriAtual",
        count(*) FILTER (WHERE presente AND data >= ${inicioTriAtual} AND data <= ${hoje})                  AS "presentesTriAtual",
        count(*) FILTER (WHERE data >= ${inicioTriAnterior} AND data <= ${fimTriAnterior})                  AS "chamadosTriAnt",
        count(*) FILTER (WHERE presente AND data >= ${inicioTriAnterior} AND data <= ${fimTriAnterior})      AS "presentesTriAnt",
        count(*) FILTER (WHERE data >= ${inicioAnoAtual} AND data <= ${hoje})                                AS "chamadosAnoAtual",
        count(*) FILTER (WHERE presente AND data >= ${inicioAnoAtual} AND data <= ${hoje})                   AS "presentesAnoAtual",
        count(*) FILTER (WHERE data >= ${inicioAnoAnterior} AND data <= ${fimAnoAnteriorYTD})                AS "chamadosAnoAnt",
        count(*) FILTER (WHERE presente AND data >= ${inicioAnoAnterior} AND data <= ${fimAnoAnteriorYTD})   AS "presentesAnoAnt"
      FROM "Frequencias"
      GROUP BY "congId"
    `,
    prisma.$queryRaw<Array<{ congId: number; comResposta: bigint; naoCrentes: bigint }>>`
      SELECT "congId", count(*) FILTER (WHERE crente IS NOT NULL) AS "comResposta",
             count(*) FILTER (WHERE crente IS NOT NULL AND crente = false) AS "naoCrentes"
      FROM "Visitantes"
      WHERE data BETWEEN ${de} AND ${ate}
      GROUP BY "congId"
    `,
    prisma.$queryRaw<Array<{ congId: number | null; alunoId: number; metade: number }>>`
      SELECT DISTINCT a."congId" AS "congId", f."alunoId" AS "alunoId",
             (CASE WHEN f.data < ${meio} THEN 0 ELSE 1 END) AS metade
      FROM "Frequencias" f
      JOIN "Alunos" a ON a.id = f."alunoId"
      WHERE f.data BETWEEN ${de} AND ${ate}
    `,
    prisma.$queryRaw<Array<{ congId: number; comProfessor: bigint; comProfessorEChamada: bigint }>>`
      SELECT c."congId" AS "congId",
             count(DISTINCT c.id) FILTER (WHERE pc.id IS NOT NULL) AS "comProfessor",
             count(DISTINCT c.id) FILTER (
               WHERE pc.id IS NOT NULL AND EXISTS (
                 SELECT 1 FROM "Frequencias" f WHERE f."classeId" = c.id AND f.data BETWEEN ${de} AND ${ate}
               )
             ) AS "comProfessorEChamada"
      FROM "Classes" c
      LEFT JOIN "PessoaCargos" pc ON pc."classeId" = c.id AND pc.ativo AND pc.fim IS NULL
        AND pc."cargoId" = (SELECT id FROM "Cargos" WHERE nome = 'Professor')
      WHERE c.ativa AND c."congId" IS NOT NULL
      GROUP BY c."congId"
    `,
    prisma.visitante.findMany({
      where: { data: { gte: de, lte: ate }, congId: { not: null } },
      select: { congId: true, nome: true, data: true },
    }),
  ]);

  const faltososPorId = new Map(faltosos.map((f) => [f.congId, { elegiveis: Number(f.elegiveis), faltosos: Number(f.faltosos) }]));
  const janelasPorId = new Map(janelas.map((j) => [j.congId, j]));
  const naoCrentesPorId = new Map(naoCrentes.map((n) => [n.congId, n]));
  const professoresPorId = new Map(professores.map((p) => [p.congId, p]));

  const inicioPorCong = new Map<number, Set<number>>();
  const fimPorCong = new Map<number, Set<number>>();
  for (const r of retencao) {
    if (r.congId === null) continue;
    const mapa = r.metade === 0 ? inicioPorCong : fimPorCong;
    if (!mapa.has(r.congId)) mapa.set(r.congId, new Set());
    mapa.get(r.congId)!.add(r.alunoId);
  }

  const visitasPorCong = new Map<number, Array<{ nome: string; data: string }>>();
  for (const v of visitasParaRecorrencia) {
    if (v.congId === null) continue;
    if (!visitasPorCong.has(v.congId)) visitasPorCong.set(v.congId, []);
    visitasPorCong.get(v.congId)!.push({ nome: v.nome, data: v.data.toISOString().slice(0, 10) });
  }

  return base.map((c) => {
    const chamados = Number(c.chamados);
    const presentes = Number(c.presentes);
    const frequencia = chamados > 0 ? Math.round((presentes / chamados) * 1000) / 10 : null;

    const domingosComChamada = Number(c.domingos);
    const regularidade =
      domingosNoPeriodo > 0 ? Math.min(100, Math.round((domingosComChamada / domingosNoPeriodo) * 1000) / 10) : null;

    const taxaAnt = Number(c.chamadosAnt) > 0 ? (Number(c.presentesAnt) / Number(c.chamadosAnt)) * 100 : null;
    const taxaRec = Number(c.chamadosRec) > 0 ? (Number(c.presentesRec) / Number(c.chamadosRec)) * 100 : null;
    const tendenciaPct = taxaAnt !== null && taxaRec !== null ? variacaoPct(taxaAnt, taxaRec) : null;

    const visitantesTotal = Number(c.visitantesTotal);
    const visitantesRate =
      domingosComChamada > 0 ? Math.round((Number(c.domingosComVisitante) / domingosComChamada) * 1000) / 10 : null;
    const visitantesAnt = Number(c.visitantesAnt);
    const visitantesRec = Number(c.visitantesRec);
    const visitantesScoreIGS =
      visitantesAnt === 0 && visitantesRec === 0 ? null : scoreDeVariacao(variacaoPct(visitantesAnt, visitantesRec));

    const nc = naoCrentesPorId.get(c.congId);
    const comResposta = nc ? Number(nc.comResposta) : 0;
    const visitantesNaoCrentesTotal = nc ? Number(nc.naoCrentes) : 0;
    const visitantesNaoCrentesRate = comResposta > 0 ? Math.round((visitantesNaoCrentesTotal / comResposta) * 1000) / 10 : null;

    const recorrencia = contarVisitantesRecorrentes(visitasPorCong.get(c.congId) ?? []);
    const visitantesRetornaramRate = recorrencia.unicos > 0 ? Math.round((recorrencia.recorrentes / recorrencia.unicos) * 1000) / 10 : null;

    const falt = faltososPorId.get(c.congId);
    const faltososScore = falt && falt.elegiveis > 0 ? 100 - (falt.faltosos / falt.elegiveis) * 100 : null;

    const w = janelasPorId.get(c.congId);
    const taxaTriAtual = w && Number(w.chamadosTriAtual) > 0 ? (Number(w.presentesTriAtual) / Number(w.chamadosTriAtual)) * 100 : null;
    const taxaTriAnt = w && Number(w.chamadosTriAnt) > 0 ? (Number(w.presentesTriAnt) / Number(w.chamadosTriAnt)) * 100 : null;
    const crescimentoTrimestralPct = taxaTriAtual !== null && taxaTriAnt !== null ? variacaoPct(taxaTriAnt, taxaTriAtual) : null;

    const taxaAnoAtual = w && Number(w.chamadosAnoAtual) > 0 ? (Number(w.presentesAnoAtual) / Number(w.chamadosAnoAtual)) * 100 : null;
    const taxaAnoAnt = w && Number(w.chamadosAnoAnt) > 0 ? (Number(w.presentesAnoAnt) / Number(w.chamadosAnoAnt)) * 100 : null;
    const crescimentoAnualPct = taxaAnoAtual !== null && taxaAnoAnt !== null ? variacaoPct(taxaAnoAnt, taxaAnoAtual) : null;

    const crescimentoVolumePct =
      w && Number(w.presentesTriAnt) > 0
        ? Math.round(((Number(w.presentesTriAtual) - Number(w.presentesTriAnt)) / Number(w.presentesTriAnt)) * 1000) / 10
        : null;

    const inicioIds = [...(inicioPorCong.get(c.congId) ?? [])];
    const fimIds = [...(fimPorCong.get(c.congId) ?? [])];
    const retencaoAlunos = calcularRetencao(inicioIds, fimIds);

    const prof = professoresPorId.get(c.congId);
    const comProfessor = prof ? Number(prof.comProfessor) : 0;
    const participacaoProfessores = comProfessor > 0 ? Math.round((Number(prof!.comProfessorEChamada) / comProfessor) * 1000) / 10 : null;

    const componentesIGS: ComponentesIGS = {
      frequencia,
      regularidade,
      tendencia: scoreDeVariacao(tendenciaPct),
      visitantes: visitantesScoreIGS,
      faltosos: faltososScore,
    };
    const igsResultado = chamados >= MINIMO_DE_CHAMADAS ? calcularIGS(componentesIGS) : null;

    const componentesIDI: ComponentesIDI = {
      frequencia,
      regularidade,
      crescimentoTrimestral: scoreDeVariacao(crescimentoTrimestralPct),
      crescimentoAnual: scoreDeVariacao(crescimentoAnualPct),
      visitantes: visitantesRate,
      visitantesNaoCrentes: visitantesNaoCrentesRate,
      visitantesRetornaram: visitantesRetornaramRate,
      retencaoAlunos,
      participacaoProfessores,
      igs: igsResultado?.nota ?? null,
    };

    return {
      congId: c.congId,
      nome: c.nome?.trim() || `Congregação ${c.congId}`,
      frequencia,
      regularidade,
      domingosNoPeriodo,
      domingosComChamada,
      visitantesTotal,
      visitantesNaoCrentesTotal,
      visitantesNaoCrentesRate,
      visitantesRate,
      visitantesRetornaramRate,
      retencaoAlunos,
      participacaoProfessores,
      crescimentoTrimestralPct,
      crescimentoAnualPct,
      crescimentoVolumePct,
      igsNota: igsResultado?.nota ?? null,
      idiNota: calcularIDI(componentesIDI)?.nota ?? null,
      componentesIDI,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Classes — reaproveita a mesma leitura "assiduidade + visitantes" do
 * Destaque original (Fase 18), preservando os ids (que o original não
 * precisava carregar).
 * ------------------------------------------------------------------ */

interface MetricaClasse {
  classeId: number;
  nome: string;
  score: number | null;
}

async function metricasClasses(ctx: Contexto, recorte: Recorte): Promise<MetricaClasse[]> {
  const { de, ate } = ctx;
  const linhas = await prisma.$queryRaw<
    Array<{ classeId: number; nome: string | null; domingos: bigint; chamados: bigint; presentes: bigint; domingosComVisitante: bigint }>
  >`
    WITH chamadas AS (
      SELECT f."classeId" AS chave, f.data, COUNT(*) AS chamados, COUNT(*) FILTER (WHERE f.presente) AS presentes
      FROM "Frequencias" f
      WHERE f.data >= ${de} AND f.data <= ${ate} AND f."classeId" IS NOT NULL
        ${recorteSql(Prisma.sql`f."congId"`, recorte ? recorte.in : null)}
      GROUP BY f."classeId", f.data
    ),
    visitas AS (
      SELECT v."classeId" AS chave, v.data
      FROM "Visitantes" v
      WHERE v.data >= ${de} AND v.data <= ${ate} AND v."classeId" IS NOT NULL
      GROUP BY v."classeId", v.data
    )
    SELECT c.chave AS "classeId", n.nome,
           COUNT(DISTINCT c.data)::int AS domingos, SUM(c.chamados)::int AS chamados, SUM(c.presentes)::int AS presentes,
           COUNT(DISTINCT vv.data)::int AS "domingosComVisitante"
    FROM chamadas c
    LEFT JOIN visitas vv ON vv.chave = c.chave AND vv.data = c.data
    LEFT JOIN "Classes" n ON n.id = c.chave
    GROUP BY c.chave, n.nome
  `;

  return linhas
    .filter((l) => l.domingos >= MINIMO_DE_CHAMADAS && Number(l.chamados) > 0)
    .map((l) => {
      const chamados = Number(l.chamados);
      const presentes = Number(l.presentes);
      const domingos = Number(l.domingos);
      const taxaFrequencia = Math.round((presentes / chamados) * 1000) / 10;
      const taxaVisitantes = Math.round((Number(l.domingosComVisitante) / domingos) * 1000) / 10;
      return {
        classeId: l.classeId,
        nome: l.nome?.trim() || `#${l.classeId}`,
        score: Math.round(((taxaFrequencia + taxaVisitantes) / 2) * 10) / 10,
      };
    });
}

/* ------------------------------------------------------------------ *
 * Professores — a nota da(s) classe(s) que lecionam, sem presença de
 * professor (que não existe): é a mesma aproximação já usada no
 * prontuário de congregação (Fase 19).
 * ------------------------------------------------------------------ */

interface MetricaProfessor {
  pessoaId: number;
  nome: string;
  score: number | null;
}

async function metricasProfessores(ctx: Contexto, recorte: Recorte): Promise<MetricaProfessor[]> {
  const { de, ate } = ctx;

  const vinculos = await prisma.pessoaCargo.findMany({
    where: {
      ativo: true,
      fim: null,
      cargo: { nome: "Professor" },
      classeId: { not: null },
      ...(recorte ? { congId: { in: recorte.in } } : {}),
    },
    select: {
      pessoa: { select: { id: true, nome: true, tratamento: true } },
      classeId: true,
    },
  });
  if (vinculos.length === 0) return [];

  const classeIds = [...new Set(vinculos.map((v) => v.classeId!))];
  const freq = await prisma.$queryRaw<
    Array<{ classeId: number; domingos: bigint; chamados: bigint; presentes: bigint; domingosComVisitante: bigint }>
  >`
    WITH chamadas AS (
      SELECT f."classeId" AS chave, f.data, COUNT(*) AS chamados, COUNT(*) FILTER (WHERE f.presente) AS presentes
      FROM "Frequencias" f
      WHERE f.data >= ${de} AND f.data <= ${ate} AND f."classeId" IN (${Prisma.join(classeIds)})
      GROUP BY f."classeId", f.data
    ),
    visitas AS (
      SELECT v."classeId" AS chave, v.data FROM "Visitantes" v
      WHERE v.data >= ${de} AND v.data <= ${ate} AND v."classeId" IN (${Prisma.join(classeIds)})
      GROUP BY v."classeId", v.data
    )
    SELECT c.chave AS "classeId", COUNT(DISTINCT c.data)::int AS domingos, SUM(c.chamados)::int AS chamados,
           SUM(c.presentes)::int AS presentes, COUNT(DISTINCT vv.data)::int AS "domingosComVisitante"
    FROM chamadas c LEFT JOIN visitas vv ON vv.chave = c.chave AND vv.data = c.data
    GROUP BY c.chave
  `;
  const freqPorClasse = new Map(freq.map((f) => [f.classeId, f]));

  const scorePorClasse = new Map<number, number | null>();
  for (const classeId of classeIds) {
    const f = freqPorClasse.get(classeId);
    if (!f || Number(f.domingos) < MINIMO_DE_CHAMADAS || Number(f.chamados) === 0) {
      scorePorClasse.set(classeId, null);
      continue;
    }
    const chamados = Number(f.chamados);
    const presentes = Number(f.presentes);
    const domingos = Number(f.domingos);
    const taxaFrequencia = (presentes / chamados) * 100;
    const taxaVisitantes = (Number(f.domingosComVisitante) / domingos) * 100;
    scorePorClasse.set(classeId, Math.round(((taxaFrequencia + taxaVisitantes) / 2) * 10) / 10);
  }

  // Uma pessoa que dá aula em mais de uma classe entra com a MÉDIA das
  // classes que têm nota — a mesma disciplina de "uma pessoa, várias
  // funções" já usada no card de Equipe e Estrutura do Dashboard.
  const porPessoa = new Map<number, { nome: string; notas: number[] }>();
  for (const v of vinculos) {
    const nota = scorePorClasse.get(v.classeId!);
    if (nota === null || nota === undefined) continue;
    const nome = `${v.pessoa.tratamento ? v.pessoa.tratamento + " " : ""}${v.pessoa.nome}`;
    if (!porPessoa.has(v.pessoa.id)) porPessoa.set(v.pessoa.id, { nome, notas: [] });
    porPessoa.get(v.pessoa.id)!.notas.push(nota);
  }

  return [...porPessoa.entries()].map(([pessoaId, { nome, notas }]) => ({
    pessoaId,
    nome,
    score: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10,
  }));
}

/* ------------------------------------------------------------------ *
 * Hall da Fama — vencedores de períodos JÁ FECHADOS, calculados AO VIVO
 * com a mesma conta (nunca um "retrato" salvo à parte).
 * ------------------------------------------------------------------ */

interface EntradaHall {
  nomes: string[];
  nota: number | null;
}

async function montarHallDaFama(hoje: Date) {
  const inicioMesAtual = inicioDoMes(hoje);
  const fimMesPassado = new Date(inicioMesAtual);
  fimMesPassado.setUTCDate(fimMesPassado.getUTCDate() - 1);
  const inicioMesPassado = inicioDoMes(fimMesPassado);

  const inicioTriAtual = inicioDoTrimestre(hoje);
  const fimTriPassado = new Date(inicioTriAtual);
  fimTriPassado.setUTCDate(fimTriPassado.getUTCDate() - 1);
  const inicioTriPassado = inicioDoTrimestre(fimTriPassado);

  const anoPassado = hoje.getUTCFullYear() - 1;
  const inicioAnoPassado = new Date(Date.UTC(anoPassado, 0, 1));
  const fimAnoPassado = new Date(Date.UTC(anoPassado, 11, 31));

  const [mesPassado, trimestrePassado, anoPassadoDados] = await Promise.all([
    vencedorCongregacaoNoPeriodo(inicioMesPassado, fimMesPassado),
    vencedorCongregacaoNoPeriodo(inicioTriPassado, fimTriPassado),
    vencedorCongregacaoNoPeriodo(inicioAnoPassado, fimAnoPassado),
  ]);

  return {
    congregacaoDoMes: mesPassado,
    congregacaoDoTrimestre: trimestrePassado,
    congregacaoDoAno: anoPassadoDados,
    periodo: {
      mesPassado: { de: iso(inicioMesPassado), ate: iso(fimMesPassado) },
      trimestrePassado: { de: iso(inicioTriPassado), ate: iso(fimTriPassado) },
      anoPassado: { de: iso(inicioAnoPassado), ate: iso(fimAnoPassado) },
    },
  };
}

async function vencedorCongregacaoNoPeriodo(de: Date, ate: Date): Promise<EntradaHall | null> {
  const congregacoes = await metricasCongregacoes({ de, ate });
  const vencedor = maiorPorCriterio(congregacoes.map((m) => ({ id: m.congId, nome: m.nome, valor: m.idiNota })));
  return vencedor ? { nomes: vencedor.nomes, nota: vencedor.valor } : null;
}
