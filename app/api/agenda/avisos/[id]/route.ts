import { prisma } from "@/lib/prisma";
import { dataCivil, erro, lerCorpo, responder, texto } from "@/lib/api";
import { escopoDeEscrita, exigirCongregacaoPermitida } from "@/lib/auth/escopo";

/**
 * Um aviso: editar e excluir.
 *
 * Aviso do CAMPO (`congId` nulo) só é alterado por quem enxerga o campo — senão
 * o Dirigente de uma congregação reescreveria o aviso que aparece nas quatorze.
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("agenda-avisos");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Aviso inválido.", 400);

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  return responder(async () => {
    const atual = await prisma.aviso.findUnique({
      where: { id },
      select: { id: true, congId: true, dataPublicacao: true },
    });
    if (!atual) throw new Error("Aviso não encontrado.");
    if (doAcesso && atual.congId === null) {
      throw new Error("Este aviso é do campo inteiro e não pode ser alterado daqui.");
    }
    exigirCongregacaoPermitida(doAcesso, atual.congId);

    const titulo = corpo.titulo === undefined ? undefined : texto(corpo.titulo, 160);
    if (corpo.titulo !== undefined && !titulo) throw new Error("Informe o título do aviso.");

    const textoAviso = corpo.texto === undefined ? undefined : texto(corpo.texto, 2000);
    if (corpo.texto !== undefined && !textoAviso) throw new Error("Escreva o aviso.");

    const expiracao = corpo.dataExpiracao === undefined ? undefined : dataCivil(corpo.dataExpiracao);
    if (corpo.dataExpiracao !== undefined && !expiracao) {
      throw new Error("Data de validade inválida.");
    }
    if (expiracao && expiracao < atual.dataPublicacao) {
      throw new Error("A data de validade é anterior à de publicação.");
    }

    return prisma.aviso.update({
      where: { id },
      data: {
        ...(titulo ? { titulo } : {}),
        ...(textoAviso ? { texto: textoAviso } : {}),
        ...(expiracao ? { dataExpiracao: expiracao } : {}),
        ...([1, 2, 3].includes(Number(corpo.prioridade))
          ? { prioridade: Number(corpo.prioridade) }
          : {}),
      },
      select: { id: true, titulo: true },
    });
  });
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("agenda-avisos");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Aviso inválido.", 400);

  return responder(async () => {
    const aviso = await prisma.aviso.findUnique({
      where: { id },
      select: { id: true, congId: true },
    });
    if (!aviso) throw new Error("Aviso não encontrado.");
    if (doAcesso && aviso.congId === null) {
      throw new Error("Este aviso é do campo inteiro e não pode ser excluído daqui.");
    }
    exigirCongregacaoPermitida(doAcesso, aviso.congId);

    await prisma.aviso.delete({ where: { id } });
    return { feito: "apagado", mensagem: "Aviso excluído." };
  });
}
