import { prisma } from "@/lib/prisma";
import { dataCivil, erro, lerCorpo, responder, texto, textoOpcional } from "@/lib/api";
import { escopoDeEscrita, exigirCongregacaoPermitida } from "@/lib/auth/escopo";

/**
 * Uma escala: editar e excluir.
 *
 * Excluir aqui remove o REGISTRO de que aquele arquivo vale para aquele mês. O
 * PDF continua no Drive — o portal nunca foi dono dele. É importante que a tela
 * diga isso: "excluí a escala" e o arquivo continuar circulando no WhatsApp
 * seria uma surpresa desagradável.
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("escalas");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Escala inválida.", 400);

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  return responder(async () => {
    const atual = await prisma.escalaCulto.findUnique({
      where: { id },
      select: { id: true, congId: true },
    });
    if (!atual) throw new Error("Escala não encontrada.");
    exigirCongregacaoPermitida(doAcesso, atual.congId);

    const titulo = corpo.titulo === undefined ? undefined : texto(corpo.titulo, 160);
    if (corpo.titulo !== undefined && !titulo) throw new Error("Informe o título da escala.");

    const url = corpo.url === undefined ? undefined : textoOpcional(corpo.url, 500);
    if (corpo.url !== undefined && (!url || !/^https?:\/\//i.test(url))) {
      throw new Error("Informe o endereço do arquivo (começando com https://).");
    }

    const mes = typeof corpo.mesAno === "string" ? `${corpo.mesAno}-01` : null;
    const mesAno = mes ? dataCivil(mes) : undefined;

    return prisma.escalaCulto.update({
      where: { id },
      data: {
        ...(titulo ? { titulo } : {}),
        ...(url ? { url, urlPreview: url } : {}),
        ...(mesAno ? { mesAno } : {}),
        ...(corpo.nomeArquivo !== undefined
          ? { nomeArquivo: textoOpcional(corpo.nomeArquivo, 200) ?? "" }
          : {}),
        ...(corpo.obs !== undefined ? { obs: textoOpcional(corpo.obs, 500) } : {}),
      },
      select: { id: true, titulo: true },
    });
  });
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("escalas");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Escala inválida.", 400);

  return responder(async () => {
    const escala = await prisma.escalaCulto.findUnique({
      where: { id },
      select: { id: true, congId: true },
    });
    if (!escala) throw new Error("Escala não encontrada.");
    exigirCongregacaoPermitida(doAcesso, escala.congId);

    await prisma.escalaCulto.delete({ where: { id } });
    return {
      feito: "apagado",
      mensagem:
        "Escala removida do portal. O arquivo em si continua no Drive — o portal apenas " +
        "registrava qual arquivo valia para aquele mês.",
    };
  });
}
