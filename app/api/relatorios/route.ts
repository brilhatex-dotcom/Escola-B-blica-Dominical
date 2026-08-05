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

    const [serie, porClasse, porCongregacao, totais] = await Promise.all([
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
          taxa: number | null;
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
          round(100.0 * count(*) FILTER (WHERE f.presente) / NULLIF(count(*), 0), 1) AS taxa
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
          taxa: number | null;
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
          round(100.0 * count(*) FILTER (WHERE f.presente) / NULLIF(count(*), 0), 1) AS taxa
        FROM "Frequencias" f
        LEFT JOIN "Congregacoes" g ON g.id = f."congId"
        WHERE f.data BETWEEN ${de} AND ${ate}
          ${soCongregacao}
        GROUP BY f."congId", g.nome
        ORDER BY taxa DESC NULLS LAST, presencas DESC
      `,

      Promise.all([
        prisma.visitante.count({ where: { data: { gte: de, lte: ate }, ...filtroCong } }),
        prisma.aluno.count({ where: { ativo: true, ...filtroCong } }),
      ]),
    ]);

    const taxaDe = (v: number | null) => (v === null ? 0 : Number(v));

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
        domingos: Number(l.domingos),
        presencas: Number(l.presencas),
        faltas: Number(l.faltas),
        media: taxaDe(l.media),
        taxa: taxaDe(l.taxa),
      })),
      porCongregacao: porCongregacao.map((l) => ({
        congId: l.congId,
        congregacao: l.congregacao ?? "Sem congregação",
        domingos: Number(l.domingos),
        classes: Number(l.classes),
        presencas: Number(l.presencas),
        faltas: Number(l.faltas),
        media: taxaDe(l.media),
        taxa: taxaDe(l.taxa),
      })),
      visitantes: totais[0],
      matriculados: totais[1],
    };
  });
}
