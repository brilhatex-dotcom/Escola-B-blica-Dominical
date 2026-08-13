import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/**
 * Relatório de frequência — índices por período e por recorte.
 *
 *   ?de=2026-01-01&ate=2026-12-31   janela (padrão: os últimos 90 dias)
 *   ?cong=3                         só uma congregação
 *   ?por=domingo|mes|trimestre      granularidade da linha do tempo
 *
 * ============================================================================
 * A MESMA REGRA DE SEMPRE: "FALTOU" NÃO É "NÃO FOI MARCADO"
 *
 * Toda taxa aqui tem como denominador as linhas de chamada QUE EXISTEM, nunca o
 * número de domingos do calendário. Uma classe que não fez chamada num domingo
 * não produz faltas — produz ausência de dado, e o índice a ignora.
 *
 * E o relatório NÃO divide presenças pelo número de alunos de HOJE para achar a
 * média de um domingo de março: o cadastro não guarda histórico de matrícula.
 * A medida é "presentes por chamada", sobre o que de fato aconteceu.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

function dataOu(valor: string | null, padrao: Date): Date {
  if (valor && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return new Date(`${valor}T00:00:00Z`);
  return padrao;
}

type Granularidade = "domingo" | "mes" | "trimestre";
const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Rótulo legível de cada balde da linha do tempo. */
function rotularBalde(por: Granularidade, d: Date): string {
  const ano = d.getUTCFullYear();
  const mes = d.getUTCMonth();
  if (por === "trimestre") return `${Math.floor(mes / 3) + 1}º tri ${ano}`;
  if (por === "mes") return `${MESES[mes]}/${String(ano).slice(2)}`;
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("rel-frequencia");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const pedida = lerInt(url, "cong");

    const porBruto = url.searchParams.get("por");
    const por: Granularidade =
      porBruto === "mes" || porBruto === "trimestre" ? porBruto : "domingo";

    /*
     * Um relatório SEM recorte é o vazamento mais silencioso que existe: não
     * expõe uma tela, expõe a planilha inteira. O alcance é sempre a interseção
     * entre o que a tela pediu e o que o acesso permite.
     */
    const recorte = recorteDaSessao(sessao);
    const alvo = recorte
      ? recorte.in.length && pedida !== null && recorte.in.includes(pedida)
        ? [pedida]
        : recorte.in
      : pedida !== null
        ? [pedida]
        : null;

    const hoje = new Date();
    const noventaDias = new Date(hoje);
    noventaDias.setDate(noventaDias.getDate() - 90);

    const de = dataOu(url.searchParams.get("de"), noventaDias);
    const ate = dataOu(url.searchParams.get("ate"), hoje);
    const filtroCong = alvo ? { congId: { in: alvo } } : {};

    /*
     * O MEIO DO PERÍODO — é o que separa "crescendo" de "diminuindo".
     *
     * Para dizer quem subiu e quem caiu, comparamos a MÉDIA de presentes por
     * chamada na 1ª metade do período com a da 2ª metade. Não é o total (que
     * confunde quem fez mais chamadas com quem cresceu): é a média por domingo,
     * a mesma que ignora domingo sem chamada. A tela mostra a seta e o quanto.
     */
    const meio = new Date((de.getTime() + ate.getTime()) / 2);

    // Fragmento SQL — nunca `$queryRaw` aninhado, que dispara e vira Promise.
    const soCongregacao = alvo
      ? Prisma.sql`AND f."congId" IN (${Prisma.join(alvo.length ? alvo : [-1])})`
      : Prisma.empty;

    // O balde da linha do tempo. `date_trunc(text, ts)` recebe a unidade como
    // parâmetro — nada é concatenado no SQL.
    const balde =
      por === "domingo"
        ? Prisma.sql`f.data`
        : Prisma.sql`date_trunc(${por === "mes" ? "month" : "quarter"}, f.data)`;

    const [serie, porClasse, porCongregacao, campoHalves, totais, matriculadosPorCong, matriculadosPorClasse] = await Promise.all([
      /* Linha do tempo, no balde escolhido. */
      prisma.$queryRaw<
        Array<{ balde: Date; presentes: bigint; faltas: bigint; chamadas: bigint; classes: bigint }>
      >`
        SELECT
          ${balde}                                       AS balde,
          count(*) FILTER (WHERE f.presente)             AS presentes,
          count(*) FILTER (WHERE NOT f.presente)         AS faltas,
          count(DISTINCT f.data)                         AS chamadas,
          count(DISTINCT f."classeId")                   AS classes
        FROM "Frequencias" f
        WHERE f.data BETWEEN ${de} AND ${ate}
          ${soCongregacao}
        GROUP BY 1
        ORDER BY 1 ASC
      `,

      /* Índice por classe. */
      prisma.$queryRaw<
        Array<{
          classeId: number | null;
          classe: string | null;
          congregacao: string | null;
          domingos: bigint;
          presencas: bigint;
          faltas: bigint;
          media: number | null;
          media_faltas: number | null;
          taxa: number | null;
          media_ant: number | null;
          media_rec: number | null;
        }>
      >`
        SELECT
          f."classeId",
          c.nome  AS classe,
          g.nome  AS congregacao,
          count(DISTINCT f.data)                         AS domingos,
          count(*) FILTER (WHERE f.presente)             AS presencas,
          count(*) FILTER (WHERE NOT f.presente)         AS faltas,
          round(count(*) FILTER (WHERE f.presente)::numeric / NULLIF(count(DISTINCT f.data), 0), 1) AS media,
          round(count(*) FILTER (WHERE NOT f.presente)::numeric / NULLIF(count(DISTINCT f.data), 0), 1) AS media_faltas,
          round(100.0 * count(*) FILTER (WHERE f.presente) / NULLIF(count(*), 0), 1) AS taxa,
          round(count(*) FILTER (WHERE f.presente AND f.data <  ${meio})::numeric / NULLIF(count(DISTINCT f.data) FILTER (WHERE f.data <  ${meio}), 0), 1) AS media_ant,
          round(count(*) FILTER (WHERE f.presente AND f.data >= ${meio})::numeric / NULLIF(count(DISTINCT f.data) FILTER (WHERE f.data >= ${meio}), 0), 1) AS media_rec
        FROM "Frequencias" f
        LEFT JOIN "Classes"      c ON c.id = f."classeId"
        LEFT JOIN "Congregacoes" g ON g.id = f."congId"
        WHERE f.data BETWEEN ${de} AND ${ate}
          ${soCongregacao}
        GROUP BY f."classeId", c.nome, g.nome
        ORDER BY taxa DESC NULLS LAST, presencas DESC
      `,

      /* Índice por congregação. */
      prisma.$queryRaw<
        Array<{
          congId: number | null;
          congregacao: string | null;
          domingos: bigint;
          classes: bigint;
          presencas: bigint;
          faltas: bigint;
          media: number | null;
          media_faltas: number | null;
          taxa: number | null;
          media_ant: number | null;
          media_rec: number | null;
        }>
      >`
        SELECT
          f."congId",
          g.nome  AS congregacao,
          count(DISTINCT f.data)                         AS domingos,
          count(DISTINCT f."classeId")                   AS classes,
          count(*) FILTER (WHERE f.presente)             AS presencas,
          count(*) FILTER (WHERE NOT f.presente)         AS faltas,
          round(count(*) FILTER (WHERE f.presente)::numeric / NULLIF(count(DISTINCT f.data), 0), 1) AS media,
          round(count(*) FILTER (WHERE NOT f.presente)::numeric / NULLIF(count(DISTINCT f.data), 0), 1) AS media_faltas,
          round(100.0 * count(*) FILTER (WHERE f.presente) / NULLIF(count(*), 0), 1) AS taxa,
          round(count(*) FILTER (WHERE f.presente AND f.data <  ${meio})::numeric / NULLIF(count(DISTINCT f.data) FILTER (WHERE f.data <  ${meio}), 0), 1) AS media_ant,
          round(count(*) FILTER (WHERE f.presente AND f.data >= ${meio})::numeric / NULLIF(count(DISTINCT f.data) FILTER (WHERE f.data >= ${meio}), 0), 1) AS media_rec
        FROM "Frequencias" f
        LEFT JOIN "Congregacoes" g ON g.id = f."congId"
        WHERE f.data BETWEEN ${de} AND ${ate}
          ${soCongregacao}
        GROUP BY f."congId", g.nome
        ORDER BY taxa DESC NULLS LAST, presencas DESC
      `,

      /* O campo inteiro, para a manchete "crescendo / estável / em queda". */
      prisma.$queryRaw<Array<{ media_ant: number | null; media_rec: number | null }>>`
        SELECT
          round(count(*) FILTER (WHERE f.presente AND f.data <  ${meio})::numeric / NULLIF(count(DISTINCT f.data) FILTER (WHERE f.data <  ${meio}), 0), 1) AS media_ant,
          round(count(*) FILTER (WHERE f.presente AND f.data >= ${meio})::numeric / NULLIF(count(DISTINCT f.data) FILTER (WHERE f.data >= ${meio}), 0), 1) AS media_rec
        FROM "Frequencias" f
        WHERE f.data BETWEEN ${de} AND ${ate}
          ${soCongregacao}
      `,

      Promise.all([
        prisma.visitante.count({ where: { data: { gte: de, lte: ate }, ...filtroCong } }),
        prisma.aluno.count({ where: { ativo: true, ...filtroCong } }),
      ]),

      /*
       * Matriculados por congregação/classe — a base ATUAL de alunos ativos,
       * não histórica (o cadastro não guarda quem estava matriculado em cada
       * domingo do período). Por isso não entra na conta da taxa — é só
       * contexto: "quantos existem hoje" ao lado de "quantos vieram no
       * período".
       */
      prisma.aluno.groupBy({ by: ["congId"], where: { ativo: true, ...filtroCong }, _count: { _all: true } }),
      prisma.aluno.groupBy({ by: ["classeId"], where: { ativo: true, ...filtroCong }, _count: { _all: true } }),
    ]);

    const taxaDe = (v: number | null) => (v === null ? 0 : Number(v));
    const num = (v: number | null) => (v === null ? null : Number(v));

    const matriculadosCong = new Map(matriculadosPorCong.map((m) => [m.congId, m._count._all]));
    const matriculadosClasse = new Map(matriculadosPorClasse.map((m) => [m.classeId, m._count._all]));

    /*
     * A tendência de uma linha: comparamos a média recente com a anterior.
     *
     * Sem base em uma das metades (a classe só fez chamada num período),
     * "sem-base" — não dá para dizer que cresceu ou caiu, e uma seta ali seria
     * invenção. Variação menor que 1 presença por domingo é "estável": não vale
     * alarmar por um aluno a mais ou a menos.
     */
    type Tendencia = "subindo" | "descendo" | "estavel" | "sem-base";
    function tendenciaDe(ant: number | null, rec: number | null): {
      mediaAnterior: number | null;
      mediaRecente: number | null;
      variacao: number | null;
      variacaoPct: number | null;
      tendencia: Tendencia;
    } {
      const a = num(ant);
      const r = num(rec);
      if (a === null || r === null) {
        return { mediaAnterior: a, mediaRecente: r, variacao: null, variacaoPct: null, tendencia: "sem-base" };
      }
      const variacao = Math.round((r - a) * 10) / 10;
      const variacaoPct = a > 0 ? Math.round((variacao / a) * 100) : null;
      const tendencia: Tendencia =
        Math.abs(variacao) < 1 ? "estavel" : variacao > 0 ? "subindo" : "descendo";
      return { mediaAnterior: a, mediaRecente: r, variacao, variacaoPct, tendencia };
    }

    return {
      periodo: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) },
      por,
      serie: serie.map((s) => ({
        rotulo: rotularBalde(por, s.balde),
        presentes: Number(s.presentes),
        faltas: Number(s.faltas),
        chamadas: Number(s.chamadas),
        classes: Number(s.classes),
        taxa:
          Number(s.presentes) + Number(s.faltas) > 0
            ? Math.round((1000 * Number(s.presentes)) / (Number(s.presentes) + Number(s.faltas))) / 10
            : 0,
      })),
      porClasse: porClasse.map((l) => ({
        classeId: l.classeId,
        classe: l.classe ?? "Sem classe",
        congregacao: l.congregacao ?? "—",
        matriculados: matriculadosClasse.get(l.classeId) ?? 0,
        domingos: Number(l.domingos),
        presencas: Number(l.presencas),
        faltas: Number(l.faltas),
        media: taxaDe(l.media),
        mediaFaltas: taxaDe(l.media_faltas),
        taxa: taxaDe(l.taxa),
        ...tendenciaDe(l.media_ant, l.media_rec),
      })),
      porCongregacao: porCongregacao.map((l) => ({
        congId: l.congId,
        congregacao: l.congregacao ?? "Sem congregação",
        matriculados: matriculadosCong.get(l.congId) ?? 0,
        domingos: Number(l.domingos),
        classes: Number(l.classes),
        presencas: Number(l.presencas),
        faltas: Number(l.faltas),
        media: taxaDe(l.media),
        mediaFaltas: taxaDe(l.media_faltas),
        taxa: taxaDe(l.taxa),
        ...tendenciaDe(l.media_ant, l.media_rec),
      })),
      // A manchete: o campo (ou a congregação filtrada) está crescendo?
      campo: tendenciaDe(campoHalves[0]?.media_ant ?? null, campoHalves[0]?.media_rec ?? null),
      visitantes: totais[0],
      matriculados: totais[1],
    };
  });
}
