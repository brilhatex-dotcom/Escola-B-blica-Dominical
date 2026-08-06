import { prisma } from "@/lib/prisma";
import { dataCivil, erro, lerCorpo, responder, texto } from "@/lib/api";
import { escopoDeEscrita } from "@/lib/auth/escopo";
import { CATEGORIAS } from "@/lib/ebd/categorias";

/**
 * Uma lição: editar e excluir.
 *
 * ============================================================================
 * LIÇÃO JÁ MINISTRADA NÃO É EXCLUÍDA — E NEM ARQUIVADA
 *
 * `Freq_Licao` registra qual classe deu qual lição, em que domingo. Apagar uma
 * lição com registro apagaria a prova de que a classe estava em dia, e o
 * relatório de acompanhamento passaria a acusar atraso onde não houve.
 *
 * A tabela `Licoes` não tem coluna `ativo`, então não há como arquivar: a
 * exclusão é RECUSADA, com o número de registros que a impedem. É mais honesto
 * do que inventar uma coluna nova para esconder o problema.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Contexto) {
  const { recusa } = await escopoDeEscrita("licoes");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Lição inválida.", 400);

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  return responder(async () => {
    const atual = await prisma.licao.findUnique({ where: { id }, select: { id: true } });
    if (!atual) throw new Error("Lição não encontrada.");

    const titulo = corpo.titulo === undefined ? undefined : texto(corpo.titulo, 300);
    if (corpo.titulo !== undefined && !titulo) throw new Error("Informe o título da lição.");

    const tipoClasse = corpo.tipoClasse === undefined ? undefined : texto(corpo.tipoClasse, 40);
    if (tipoClasse !== undefined && (!tipoClasse || !CATEGORIAS.includes(tipoClasse))) {
      throw new Error("Categoria de classe inválida.");
    }

    const trim = corpo.trim === undefined ? undefined : texto(corpo.trim, 4);
    if (trim !== undefined && (!trim || !/^[1-4]T$/.test(trim))) {
      throw new Error("Trimestre inválido — use 1T, 2T, 3T ou 4T.");
    }

    return prisma.licao.update({
      where: { id },
      data: {
        ...(titulo ? { titulo } : {}),
        ...(tipoClasse ? { tipoClasse } : {}),
        ...(trim ? { trim } : {}),
        ...(corpo.data !== undefined && dataCivil(corpo.data)
          ? { data: dataCivil(corpo.data)! }
          : {}),
        ...(Number.isInteger(corpo.ano) ? { ano: corpo.ano as number } : {}),
      },
      select: { id: true, titulo: true },
    });
  });
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const { recusa } = await escopoDeEscrita("licoes");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Lição inválida.", 400);

  return responder(async () => {
    const licao = await prisma.licao.findUnique({
      where: { id },
      select: { id: true, titulo: true, _count: { select: { freqLicoes: true } } },
    });
    if (!licao) throw new Error("Lição não encontrada.");

    const registros = licao._count.freqLicoes;
    if (registros > 0) {
      throw new Error(
        `Esta lição já foi ministrada por ${registros} ${registros === 1 ? "classe" : "classes"}, ` +
          "e por isso não pode ser excluída — apagá-la apagaria a prova de que essas classes " +
          "estavam em dia. Corrija o título, se for o caso.",
      );
    }

    await prisma.licao.delete({ where: { id } });
    return { feito: "apagado", mensagem: "Lição excluída." };
  });
}
