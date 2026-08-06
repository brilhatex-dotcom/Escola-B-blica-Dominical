import { prisma } from "@/lib/prisma";
import { dataCivil, erro, lerCorpo, responder, texto, textoOpcional } from "@/lib/api";
import { escopoDeEscrita, exigirCongregacaoPermitida } from "@/lib/auth/escopo";

/**
 * Um visitante: editar e excluir.
 *
 * Aqui a exclusão apaga de verdade, sem arquivar — e a diferença para o aluno
 * não é descuido. Nada aponta para um visitante: ele não tem frequência, não
 * tem histórico, não é referência de nenhum relatório. Arquivá-lo só produziria
 * uma lista de gente invisível que ninguém jamais vai consultar.
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("visitantes");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Visitante inválido.", 400);

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  return responder(async () => {
    const atual = await prisma.visitante.findUnique({
      where: { id },
      select: { id: true, congId: true },
    });
    if (!atual) throw new Error("Visitante não encontrado.");
    exigirCongregacaoPermitida(doAcesso, atual.congId);

    const nome = corpo.nome === undefined ? undefined : texto(corpo.nome, 120);
    if (corpo.nome !== undefined && !nome) throw new Error("Informe o nome do visitante.");

    return prisma.visitante.update({
      where: { id },
      data: {
        ...(nome ? { nome } : {}),
        ...(corpo.nasc !== undefined ? { nasc: dataCivil(corpo.nasc) } : {}),
        ...(corpo.local !== undefined ? { local: textoOpcional(corpo.local, 160) } : {}),
        ...(corpo.tel !== undefined ? { tel: textoOpcional(corpo.tel, 30) } : {}),
        ...(corpo.obs !== undefined ? { obs: textoOpcional(corpo.obs, 500) } : {}),
      },
      select: { id: true, nome: true },
    });
  });
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("visitantes");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Visitante inválido.", 400);

  return responder(async () => {
    const visitante = await prisma.visitante.findUnique({
      where: { id },
      select: { id: true, congId: true },
    });
    if (!visitante) throw new Error("Visitante não encontrado.");
    exigirCongregacaoPermitida(doAcesso, visitante.congId);

    await prisma.visitante.delete({ where: { id } });
    return { feito: "apagado", mensagem: "Visitante excluído." };
  });
}
