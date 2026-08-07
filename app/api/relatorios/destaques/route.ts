import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { erro } from "@/lib/api";
import { escopoDaRota } from "@/lib/auth/escopo";
import { dataOu, MINIMO_DE_CHAMADAS, recorteSql } from "@/lib/relatorios/comum";
import { inicioDoMes, inicioDoTrimestre } from "@/lib/dashboard/destaque";
import { metricasCongregacoes, type MetricaCong, type NumeroDeCong } from "@/lib/relatorios/metricasCongregacoes";
import {
  gerarJustificativaIDI,
  maiorPorCriterio,
  type Candidato,
  type ComponentesIDI,
  type VencedorCriterio,
} from "@/lib/relatorios/idi";

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
      metricasCongregacoes(de, ate),
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
  const congregacoes = await metricasCongregacoes(de, ate);
  const vencedor = maiorPorCriterio(congregacoes.map((m) => ({ id: m.congId, nome: m.nome, valor: m.idiNota })));
  return vencedor ? { nomes: vencedor.nomes, nota: vencedor.valor } : null;
}
