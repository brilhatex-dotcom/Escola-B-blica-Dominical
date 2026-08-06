import { prisma } from "@/lib/prisma";
import { dataCivil, erro, lerCorpo, responder, texto, textoOpcional } from "@/lib/api";
import { escopoDeEscrita, exigirCongregacaoPermitida } from "@/lib/auth/escopo";

/**
 * Um evento: editar e excluir.
 *
 * A exclusão apaga de verdade. Nada aponta para um evento — ele não tem
 * presença, não entra em relatório e não é referência de nada. Arquivá-lo só
 * produziria uma agenda cheia de compromissos invisíveis.
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("agenda-eventos");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Evento inválido.", 400);

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  return responder(async () => {
    const atual = await prisma.evento.findUnique({
      where: { id },
      select: { id: true, congId: true, data: true, dataFim: true },
    });
    if (!atual) throw new Error("Evento não encontrado.");
    /*
     * Evento do CAMPO (`congId` nulo) só é alterado por quem enxerga o campo.
     * Sem esta conferência, o Dirigente de uma congregação poderia reescrever o
     * Congresso do Campo, que aparece para as quatorze.
     */
    if (doAcesso && atual.congId === null) {
      throw new Error("Este evento é do campo inteiro e não pode ser alterado daqui.");
    }
    exigirCongregacaoPermitida(doAcesso, atual.congId);

    const titulo = corpo.titulo === undefined ? undefined : texto(corpo.titulo, 160);
    if (corpo.titulo !== undefined && !titulo) throw new Error("Informe o título do evento.");

    const data = corpo.data === undefined ? atual.data : dataCivil(corpo.data);
    if (!data) throw new Error("Data do evento inválida.");

    const dataFim = corpo.dataFim === undefined ? atual.dataFim : (dataCivil(corpo.dataFim) ?? data);
    if (dataFim < data) throw new Error("A data de término é anterior à de início.");

    return prisma.evento.update({
      where: { id },
      data: {
        ...(titulo ? { titulo } : {}),
        ...(corpo.descricao !== undefined
          ? { descricao: textoOpcional(corpo.descricao, 1000) ?? "" }
          : {}),
        ...(corpo.tipo !== undefined ? { tipo: texto(corpo.tipo, 40) ?? "evento" } : {}),
        ...(corpo.local !== undefined ? { local: textoOpcional(corpo.local, 160) ?? "" } : {}),
        ...(corpo.obs !== undefined ? { obs: textoOpcional(corpo.obs, 500) } : {}),
        data,
        dataFim,
      },
      select: { id: true, titulo: true },
    });
  });
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("agenda-eventos");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Evento inválido.", 400);

  return responder(async () => {
    const evento = await prisma.evento.findUnique({
      where: { id },
      select: { id: true, congId: true },
    });
    if (!evento) throw new Error("Evento não encontrado.");
    if (doAcesso && evento.congId === null) {
      throw new Error("Este evento é do campo inteiro e não pode ser excluído daqui.");
    }
    exigirCongregacaoPermitida(doAcesso, evento.congId);

    await prisma.evento.delete({ where: { id } });
    return { feito: "apagado", mensagem: "Evento excluído." };
  });
}
