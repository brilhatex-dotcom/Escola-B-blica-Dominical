import { prisma } from "@/lib/prisma";
import {
  dataCivil,
  erro,
  lerCorpo,
  responder,
  texto,
  textoOpcional,
} from "@/lib/api";
import { escopoDeEscrita, exigirCongregacaoPermitida } from "@/lib/auth/escopo";
import { excluirOuArquivar } from "@/lib/api/exclusao";

/**
 * Um aluno: editar e excluir.
 *
 * As duas operações conferem a congregação do aluno ALVO antes de tocar nele.
 * O recorte da listagem impede de VER um aluno de outra congregação; não
 * impede nada quanto a alterá-lo, porque o id é um número pequeno que qualquer
 * pessoa pode digitar. São duas conferências diferentes, e as duas precisam
 * existir.
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("alunos");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Aluno inválido.", 400);

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  return responder(async () => {
    const atual = await prisma.aluno.findUnique({
      where: { id },
      select: { id: true, congId: true },
    });
    if (!atual) throw new Error("Aluno não encontrado.");
    exigirCongregacaoPermitida(doAcesso, atual.congId);

    /*
     * Trocar de classe é o caso que exige cuidado.
     *
     * A congregação do aluno acompanha a classe — são a mesma coisa na prática.
     * Sem esta conferência, alguém do grupo B poderia mover um aluno para uma
     * classe de outra congregação e, com isso, empurrar o registro para fora do
     * próprio alcance: some da tela, e nem quem moveu consegue desfazer.
     */
    let classeId: number | undefined;
    let congId: number | null | undefined;

    if (corpo.classeId !== undefined) {
      const novaClasse = Number.isInteger(corpo.classeId) ? (corpo.classeId as number) : null;
      if (novaClasse === null) throw new Error("Classe inválida.");

      const classe = await prisma.classe.findUnique({
        where: { id: novaClasse },
        select: { id: true, congId: true },
      });
      if (!classe) throw new Error("Classe não encontrada.");
      exigirCongregacaoPermitida(doAcesso, classe.congId);

      classeId = classe.id;
      congId = classe.congId;
    }

    const nome = corpo.nome === undefined ? undefined : texto(corpo.nome, 120);
    if (corpo.nome !== undefined && !nome) throw new Error("Informe o nome do aluno.");

    return prisma.aluno.update({
      where: { id },
      data: {
        ...(nome ? { nome } : {}),
        ...(corpo.nasc !== undefined ? { nasc: dataCivil(corpo.nasc) } : {}),
        ...(corpo.tel !== undefined ? { tel: textoOpcional(corpo.tel, 30) } : {}),
        ...(corpo.resp !== undefined ? { resp: textoOpcional(corpo.resp, 120) } : {}),
        ...(classeId !== undefined ? { classeId } : {}),
        ...(congId !== undefined ? { congId } : {}),
        ...(typeof corpo.ativo === "boolean" ? { ativo: corpo.ativo } : {}),
      },
      select: { id: true, nome: true, ativo: true },
    });
  });
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("alunos");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Aluno inválido.", 400);

  return responder(async () => {
    const aluno = await prisma.aluno.findUnique({
      where: { id },
      select: { id: true, nome: true, congId: true, _count: { select: { frequencias: true } } },
    });
    if (!aluno) throw new Error("Aluno não encontrado.");
    exigirCongregacaoPermitida(doAcesso, aluno.congId);

    return excluirOuArquivar({
      dependencias: aluno._count.frequencias,
      motivo:
        `${aluno.nome} tem ${aluno._count.frequencias} ` +
        `${aluno._count.frequencias === 1 ? "presença registrada" : "presenças registradas"}, ` +
        "então foi arquivado em vez de apagado — os relatórios de frequência dos meses " +
        "anteriores continuam corretos. Ele sai das listas e da chamada.",
      apagar: () => prisma.aluno.delete({ where: { id } }),
      arquivar: () => prisma.aluno.update({ where: { id }, data: { ativo: false } }),
    });
  });
}
