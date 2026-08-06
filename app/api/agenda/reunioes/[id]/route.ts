import { prisma } from "@/lib/prisma";
import { dataCivil, erro, lerCorpo, responder, texto, textoOpcional } from "@/lib/api";
import { escopoDeEscrita } from "@/lib/auth/escopo";
import { nomesDaLista } from "@/lib/api/legado";

/**
 * Uma reunião: editar e excluir.
 *
 * `Reunioes` NÃO tem congregação — é do campo. Por isso não há recorte a
 * aplicar aqui: ou a pessoa pode gravar reuniões, ou não pode.
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Contexto) {
  const { recusa } = await escopoDeEscrita("agenda-reunioes");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Reunião inválida.", 400);

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  return responder(async () => {
    const atual = await prisma.reuniao.findUnique({ where: { id }, select: { id: true } });
    if (!atual) throw new Error("Reunião não encontrada.");

    const titulo = corpo.titulo === undefined ? undefined : texto(corpo.titulo, 160);
    if (corpo.titulo !== undefined && !titulo) throw new Error("Informe o título da reunião.");

    /*
     * A lista de presença é substituída INTEIRA quando vem, e não mesclada.
     *
     * É um instantâneo do que a secretaria tem na tela — mesma razão do pacote
     * da Chamada. Mesclando, alguém removido de uma das caixas continuaria na
     * ata, e a contagem passaria a discordar da lista logo abaixo dela.
     */
    const mexeuNaLista = corpo.presentes !== undefined || corpo.ausentes !== undefined;
    let lista: { participantes: unknown; presentes: number; total: number } | null = null;

    if (mexeuNaLista) {
      const presentes = nomesDaLista(corpo.presentes).map((nome) => ({ nome, presente: true }));
      const ausentes = nomesDaLista(corpo.ausentes).map((nome) => ({ nome, presente: false }));
      const participantes = [...presentes, ...ausentes];
      lista = {
        participantes,
        presentes: presentes.length,
        total: participantes.length,
      };
    }

    return prisma.reuniao.update({
      where: { id },
      data: {
        ...(titulo ? { titulo } : {}),
        ...(corpo.tipo !== undefined ? { tipo: texto(corpo.tipo, 60) ?? "Reunião" } : {}),
        ...(corpo.data !== undefined && dataCivil(corpo.data)
          ? { data: dataCivil(corpo.data)! }
          : {}),
        ...(corpo.local !== undefined ? { local: textoOpcional(corpo.local, 160) } : {}),
        ...(corpo.obs !== undefined ? { obs: textoOpcional(corpo.obs, 1000) } : {}),
        ...(lista
          ? {
              participantes: lista.participantes as never,
              presentes: lista.presentes,
              total: lista.total,
            }
          : {}),
      },
      select: { id: true, titulo: true },
    });
  });
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const { recusa } = await escopoDeEscrita("agenda-reunioes");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Reunião inválida.", 400);

  return responder(async () => {
    const reuniao = await prisma.reuniao.findUnique({ where: { id }, select: { id: true } });
    if (!reuniao) throw new Error("Reunião não encontrada.");

    await prisma.reuniao.delete({ where: { id } });
    return { feito: "apagado", mensagem: "Reunião excluída, com a lista de presença dela." };
  });
}
