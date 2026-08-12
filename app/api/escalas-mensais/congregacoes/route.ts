import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirLeitura } from "@/lib/auth/guarda";

/**
 * A lista de congregações para o seletor de local do builder da escala
 * mensal — só id e nome, sem o resto que `/api/congregacoes` carrega (essa
 * exige a permissão "congregacoes", que quem monta a escala pode não ter).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { recusa } = await exigirLeitura("escalas");
  if (recusa) return recusa;

  return responder(async () => {
    const congregacoes = await prisma.congregacao.findMany({
      orderBy: { id: "asc" },
      select: { id: true, nome: true },
    });
    return {
      itens: congregacoes.map((c) => ({ id: c.id, nome: c.nome?.trim() || `Congregação ${c.id}` })),
    };
  });
}
