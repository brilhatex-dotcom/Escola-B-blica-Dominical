import { prisma } from "@/lib/prisma";
import { MINIMO_DE_CHAMADAS } from "./comum";
import { inicioDoTrimestre } from "@/lib/dashboard/destaque";
import type { Destaque } from "@/lib/dashboard/tipos";
import { contarVisitantesRecorrentes } from "./congregacao";
import {
  calcularIDI,
  calcularRetencao,
  maiorPorCriterio,
  type ComponentesIDI,
} from "./idi";
import { calcularIGS, scoreDeVariacao, variacaoPct, type ComponentesIGS } from "./indices";

/**
 * As métricas completas por trás do IDI — UMA função só, usada por toda
 * tela que precisa dizer "qual é a Congregação Destaque".
 *
 * ============================================================================
 * POR QUE ISTO SAIU DE DENTRO DE `/api/relatorios/destaques`
 *
 * Nasceu ali (Fase 21), e por um tempo o Dashboard usou uma conta PRÓPRIA,
 * mais simples (`lerDestaquesDoAgrupamento`, Fase 18) — assiduidade e
 * visitante, sem os outros oito componentes do IDI. As duas contas podem
 * discordar sobre quem é a Congregação Destaque, e ninguém que olha as duas
 * telas devia precisar saber que são índices diferentes por trás.
 *
 * Movida para cá, a MESMA apuração serve `/api/relatorios/destaques` (as dez
 * categorias e o Hall da Fama) e o cartão "Destaque" do Dashboard — as duas
 * nunca mais podem apontar congregações diferentes, porque é a mesma conta.
 * O nível de CLASSE não precisou dessa mudança: já usava a mesma fórmula
 * simples nos dois lugares.
 * ============================================================================
 */

export interface MetricaCong {
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

export type NumeroDeCong = { [K in keyof MetricaCong]: MetricaCong[K] extends number | null ? K : never }[keyof MetricaCong];

export async function metricasCongregacoes(de: Date, ate: Date): Promise<MetricaCong[]> {
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
             count(*) FILTER (WHERE crente = 'nao-evangelico') AS "naoCrentes"
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

/**
 * O vencedor por IDI, no formato do cartão "Destaque" — a MESMA conta usada
 * em `/dashboard/relatorios/destaques`, para as duas telas nunca discordarem
 * sobre quem é a Congregação Destaque. `null` quando ninguém tem dado
 * suficiente no período (mesmo critério do IDI: precisa de ao menos
 * `MINIMO_DE_CHAMADAS` chamadas para o IGS entrar na conta).
 */
export async function congregacaoDestaquePorIDI(de: Date, ate: Date): Promise<Destaque | null> {
  const congregacoes = await metricasCongregacoes(de, ate);
  const porId = new Map(congregacoes.map((m) => [m.congId, m]));
  const vencedor = maiorPorCriterio(congregacoes.map((m) => ({ id: m.congId, nome: m.nome, valor: m.idiNota })));
  if (!vencedor) return null;

  const m = porId.get(vencedor.ids[0]);
  return {
    nomes: vencedor.nomes,
    score: vencedor.valor,
    taxaFrequencia: m?.frequencia ?? 0,
    taxaVisitantes: m?.visitantesRate ?? 0,
    domingos: m?.domingosComChamada ?? 0,
  };
}
