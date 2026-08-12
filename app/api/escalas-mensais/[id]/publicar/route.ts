import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirEscrita, recorteDaSessao } from "@/lib/auth/guarda";
import { autorDa } from "@/lib/api/legado";

/**
 * Publicar a escala do mês — ou voltar a rascunho, para corrigir algo antes
 * de publicar de novo.
 *
 * Enquanto rascunho, só quem edita vê o mês (ver o GET em `../route.ts`).
 * Publicar é o momento em que a escala passa a valer para todo mundo — por
 * isso pede confirmação na tela, com o resumo de quantos cultos e
 * congregações estão indo junto.
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Contexto) {
  const { sessao, recusa } = await exigirEscrita("escalas");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Escala inválida.", 400);

  if (recorteDaSessao(sessao)) {
    return erro("Só quem enxerga o campo inteiro publica a escala mensal.", 403);
  }

  const escala = await prisma.escalaMensal.findUnique({
    where: { id },
    select: { id: true, status: true, _count: { select: { itens: true } } },
  });
  if (!escala) return erro("Escala não encontrada.", 404);
  if (escala._count.itens === 0) return erro("Lance ao menos um culto antes de publicar.", 400);

  return responder(async () => {
    await prisma.escalaMensal.update({
      where: { id },
      data: { status: "publicado", publicadoEm: new Date(), publicadoPor: autorDa(sessao) },
    });
    return { ok: true };
  });
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const { sessao, recusa } = await exigirEscrita("escalas");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Escala inválida.", 400);

  if (recorteDaSessao(sessao)) {
    return erro("Só quem enxerga o campo inteiro reabre a escala mensal.", 403);
  }

  const escala = await prisma.escalaMensal.findUnique({ where: { id }, select: { id: true } });
  if (!escala) return erro("Escala não encontrada.", 404);

  return responder(async () => {
    await prisma.escalaMensal.update({
      where: { id },
      data: { status: "rascunho", publicadoEm: null, publicadoPor: null },
    });
    return { ok: true };
  });
}
