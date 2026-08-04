import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";

/**
 * Relatório de frequência e ofertas.
 *
 *   ?de=2026-01-01&ate=2026-12-31   recorte (padrão: os últimos 90 dias)
 *   ?cong=3                         só uma congregação
 *
 * ============================================================================
 * O QUE ESTE RELATORIO NAO FAZ: dividir presencas pelo numero de alunos da
 * classe HOJE para achar a media de um domingo de marco. O cadastro nao guarda
 * historico de matricula — nao da para saber quantos alunos a classe tinha
 * naquela data. Uma classe que dobrou de tamanho desde entao apareceria com
 * metade da frequencia real, e o numero pareceria confiavel.
 *
 * Por isso a coluna e "presentes por domingo", contada sobre os domingos que
 * TIVERAM chamada — que e uma medida do que aconteceu, nao uma estimativa.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

function dataOu(valor: string | null, padrao: Date): Date {
  if (valor && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return new Date(`${valor}T00:00:00Z`);
  return padrao;
}

export async function GET(req: Request) {
  return responder(async () => {
    const url = new URL(req.url);
    const congId = lerInt(url, "cong");

    const hoje = new Date();
    const noventaDias = new Date(hoje);
    noventaDias.setDate(noventaDias.getDate() - 90);

    const de = dataOu(url.searchParams.get("de"), noventaDias);
    const ate = dataOu(url.searchParams.get("ate"), hoje);
    const filtroCong = congId ? { congId } : {};

    /*
     * Fragmento SQL, e nao uma chamada aninhada.
     *
     * `prisma.$queryRaw` dentro de outro `$queryRaw` NAO interpola SQL: ele
     * DISPARA uma consulta e devolve uma Promise, que acaba virando
     * "[object Promise]" no meio do comando. `Prisma.sql` e `Prisma.empty`
     * existem justamente para compor pedaco de consulta com seguranca — o
     * valor continua indo como parametro, sem concatenacao de texto.
     */
    const soCongregacao = congId ? Prisma.sql`AND f."congId" = ${congId}` : Prisma.empty;

    const [porClasse, porDomingo, ofertas, totais] = await Promise.all([
      /*
       * Uma consulta agregada por classe.
       *
       * `count(DISTINCT data)` e o divisor certo: uma classe que fez chamada em
       * 3 domingos e outra que fez em 12 nao podem ser comparadas pela SOMA de
       * presencas — a segunda pareceria quatro vezes melhor so por ter
       * registrado mais vezes.
       */
      prisma.$queryRaw<
        Array<{
          classeId: number | null;
          classe: string | null;
          congregacao: string | null;
          domingos: bigint;
          presencas: bigint;
          faltas: bigint;
          media: number | null;
        }>
      >`
        SELECT
          f."classeId",
          c.nome  AS classe,
          g.nome  AS congregacao,
          count(DISTINCT f.data)                         AS domingos,
          count(*) FILTER (WHERE f.presente)             AS presencas,
          count(*) FILTER (WHERE NOT f.presente)         AS faltas,
          round(
            count(*) FILTER (WHERE f.presente)::numeric
            / NULLIF(count(DISTINCT f.data), 0)
          , 1)                                           AS media
        FROM "Frequencias" f
        LEFT JOIN "Classes"      c ON c.id = f."classeId"
        LEFT JOIN "Congregacoes" g ON g.id = f."congId"
        WHERE f.data BETWEEN ${de} AND ${ate}
          ${soCongregacao}
        GROUP BY f."classeId", c.nome, g.nome
        ORDER BY presencas DESC
      `,

      prisma.$queryRaw<Array<{ data: Date; presentes: bigint; faltas: bigint; classes: bigint }>>`
        SELECT
          f.data,
          count(*) FILTER (WHERE f.presente)     AS presentes,
          count(*) FILTER (WHERE NOT f.presente) AS faltas,
          count(DISTINCT f."classeId")           AS classes
        FROM "Frequencias" f
        WHERE f.data BETWEEN ${de} AND ${ate}
          ${soCongregacao}
        GROUP BY f.data
        ORDER BY f.data DESC
        LIMIT 20
      `,

      prisma.oferta.aggregate({
        where: { data: { gte: de, lte: ate }, ...filtroCong },
        _sum: { valor: true },
        _count: { _all: true },
      }),

      Promise.all([
        prisma.visitante.count({ where: { data: { gte: de, lte: ate }, ...filtroCong } }),
        prisma.aluno.count({ where: { ativo: true, ...filtroCong } }),
      ]),
    ]);

    return {
      periodo: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) },
      porClasse: porClasse.map((l) => ({
        classeId: l.classeId,
        classe: l.classe ?? "Sem classe",
        congregacao: l.congregacao ?? "—",
        domingos: Number(l.domingos),
        presencas: Number(l.presencas),
        faltas: Number(l.faltas),
        media: l.media === null ? 0 : Number(l.media),
      })),
      porDomingo: porDomingo.map((d) => ({
        data: d.data.toISOString().slice(0, 10),
        presentes: Number(d.presentes),
        faltas: Number(d.faltas),
        classes: Number(d.classes),
      })),
      ofertas: {
        total: Number(ofertas._sum.valor ?? 0),
        lancamentos: ofertas._count._all,
      },
      visitantes: totais[0],
      matriculados: totais[1],
    };
  });
}
