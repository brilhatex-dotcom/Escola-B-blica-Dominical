import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { alvoDaConsulta, recorteSql } from "@/lib/relatorios/comum";
import { domingoMaisRecente } from "@/lib/dashboard/formato";

/**
 * Ranking semanal — quem se destacou NUM domingo só, para divulgar no grupo.
 *
 * ============================================================================
 * UM RETRATO DO DOMINGO, NÃO UMA MÉDIA DO TRIMESTRE
 *
 * O Ranking normal (`/api/relatorios/ranking`) compara períodos longos e
 * exige um piso de domingos — é o "quem vem sendo melhor". Esta rota
 * responde outra pergunta, para divulgar toda semana: "quem se saiu melhor
 * NESTE domingo?". Por ser um retrato de um dia só, não há piso de chamadas
 * — a classificação já é, por definição, sobre um único domingo, para toda
 * congregação/classe que fez chamada nele.
 *
 * Congregações e visitantes NUNCA se recortam — o ranking de campo inteiro é
 * o que faz sentido divulgar no grupo do campo. Classes recortam para quem
 * só enxerga a própria congregação, como no Ranking normal.
 * ============================================================================
 *
 *   ?data=2026-08-16
 */
export const dynamic = "force-dynamic";

interface LinhaCong { id: number | null; nome: string | null; chamadas: bigint; presencas: bigint }
interface LinhaClasse { id: number | null; nome: string | null; congregacao: string | null; chamadas: bigint; presencas: bigint }
interface LinhaVisitantes { id: number | null; nome: string | null; visitantes: bigint }

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("rel-ranking");
  if (recusa) return recusa;

  const url = new URL(req.url);
  const dataStr = url.searchParams.get("data") || domingoMaisRecente();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return erro("Informe a data (o domingo do ranking).", 400);
  const dia = new Date(`${dataStr}T00:00:00Z`);

  const alvo = alvoDaConsulta(recorteDaSessao(sessao), null);
  const soAlvoClasse = recorteSql(Prisma.sql`f."congId"`, alvo);

  return responder(async () => {
    const [congregacoes, classes, visitantes] = await Promise.all([
      prisma.$queryRaw<LinhaCong[]>`
        SELECT g.id, g.nome,
               count(*)                           AS chamadas,
               count(*) FILTER (WHERE f.presente) AS presencas
        FROM "Frequencias" f
        JOIN "Congregacoes" g ON g.id = f."congId"
        WHERE f.data = ${dia}
        GROUP BY g.id, g.nome
      `,
      prisma.$queryRaw<LinhaClasse[]>`
        SELECT c.id, c.nome, g.nome AS congregacao,
               count(*)                           AS chamadas,
               count(*) FILTER (WHERE f.presente) AS presencas
        FROM "Frequencias" f
        JOIN "Classes" c ON c.id = f."classeId"
        LEFT JOIN "Congregacoes" g ON g.id = f."congId"
        WHERE f.data = ${dia} ${soAlvoClasse}
        GROUP BY c.id, c.nome, g.nome
      `,
      prisma.$queryRaw<LinhaVisitantes[]>`
        SELECT g.id, g.nome, count(*) AS visitantes
        FROM "Visitantes" v
        JOIN "Congregacoes" g ON g.id = v."congId"
        WHERE v.data = ${dia}
        GROUP BY g.id, g.nome
      `,
    ]);

    function comTaxa<T extends { id: number | null; nome: string | null; chamadas: bigint; presencas: bigint }>(
      linhas: T[],
      extra?: (l: T) => Record<string, unknown>,
    ) {
      return linhas
        .map((l) => {
          const chamadas = Number(l.chamadas);
          const presencas = Number(l.presencas);
          return {
            id: l.id,
            nome: l.nome?.trim() || (l.id ? `Congregação ${l.id}` : "—"),
            chamadas,
            presencas,
            taxa: chamadas > 0 ? Math.round((presencas / chamadas) * 1000) / 10 : 0,
            ...extra?.(l),
          };
        })
        .sort((a, b) => b.taxa - a.taxa || b.presencas - a.presencas);
    }

    return {
      data: dataStr,
      congregacoes: comTaxa(congregacoes),
      classes: comTaxa(classes, (l) => ({ congregacao: l.congregacao?.trim() ?? null })),
      visitantes: visitantes
        .map((v) => ({ id: v.id, nome: v.nome?.trim() || `Congregação ${v.id}`, visitantes: Number(v.visitantes) }))
        .sort((a, b) => b.visitantes - a.visitantes),
    };
  });
}
