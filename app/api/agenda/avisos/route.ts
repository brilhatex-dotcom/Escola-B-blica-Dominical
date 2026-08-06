import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/**
 * Avisos da igreja.
 *
 * ============================================================================
 * UM AVISO EXPIRADO NÃO É UM AVISO
 *
 * `dataExpiracao` existe no cadastro antigo e nunca foi usada para nada — a
 * planilha mostrava todos juntos. Mas um aviso que venceu não é apenas "antigo":
 * ele pode estar ERRADO. "Culto às 19h no dia 12" continua no mural em março do
 * ano seguinte e manda a igreja para o lugar errado.
 *
 * Por isso os vigentes vêm separados dos vencidos, e a lista abre nos vigentes.
 * Os vencidos continuam acessíveis — apagar histórico não é papel desta tela.
 * ============================================================================
 *
 * `prioridade` é um número no cadastro antigo. Quanto MENOR, mais urgente —
 * confirmado nos dados: 1 aparece nos avisos de convocação.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("agenda-avisos");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const recorte = recorteDaSessao(sessao);
    const pedida = lerInt(url, "cong");
    const congIds = recorte
      ? pedida !== null && recorte.in.includes(pedida) ? [pedida] : recorte.in
      : pedida !== null ? [pedida] : null;

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    const filtroCong = congIds ? { congId: { in: congIds } } : {};

    const [vigentes, vencidos] = await Promise.all([
      prisma.aviso.findMany({
        where: { ...filtroCong, dataExpiracao: { gte: hoje } },
        orderBy: [{ prioridade: "asc" }, { dataPublicacao: "desc" }],
        include: { congregacao: { select: { nome: true } } },
      }),
      prisma.aviso.findMany({
        where: { ...filtroCong, dataExpiracao: { lt: hoje } },
        orderBy: { dataExpiracao: "desc" },
        take: 40,
        include: { congregacao: { select: { nome: true } } },
      }),
    ]);

    const preparar = (a: (typeof vigentes)[number]) => ({
      id: a.id,
      titulo: a.titulo,
      texto: a.texto,
      prioridade: a.prioridade,
      publicado: a.dataPublicacao.toISOString().slice(0, 10),
      expira: a.dataExpiracao.toISOString().slice(0, 10),
      autor: a.autor,
      congregacao: a.congregacao?.nome?.trim() || null,
      // Quantos dias faltam para vencer. Negativo já venceu.
      diasRestantes: Math.round((+a.dataExpiracao - +hoje) / 86_400_000),
    });

    return {
      vigentes: vigentes.map(preparar),
      vencidos: vencidos.map(preparar),
    };
  });
}
