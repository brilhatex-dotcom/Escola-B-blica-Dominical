import type { Prisma } from "@prisma/client";
import { normalizarChave, separarTratamento } from "./nome";

/**
 * Resolve o `pessoaId` de trás de um cargo — quando quem preenche a tela digita
 * um nome novo, ou promove alguém que só existia como aluno.
 *
 * Extraído de `app/api/congregacoes/dirigente/route.ts` (Fase 09) para
 * `app/api/classes/[id]/professores/route.ts` (Fase 16) poder usar a mesma
 * regra: "não duplicar gente" vale tanto pra dirigente quanto pra professor.
 */

/**
 * Garante uma Pessoa a partir de um aluno, e devolve o pessoaId.
 *
 * Permite promover a professor/dirigente alguém que só existia como aluno
 * ("Aux. Bartolomeu"). Não altera o aluno — ADICIONA uma pessoa, o que a regra
 * da igreja permite (não alterar registro antigo ≠ não poder cadastrar gente).
 * Se já existir uma pessoa com a mesma chave, reaproveita em vez de duplicar.
 */
export async function pessoaDeAluno(tx: Prisma.TransactionClient, alunoId: number): Promise<number> {
  const aluno = await tx.aluno.findUnique({
    where: { id: alunoId },
    select: { nome: true, tel: true, nasc: true },
  });
  if (!aluno) throw new Error("Aluno não encontrado.");

  const { tratamento, nome } = separarTratamento(aluno.nome);
  const chave = normalizarChave(nome);

  const existente = await tx.pessoa.findUnique({ where: { chave }, select: { id: true } });
  if (existente) return existente.id;

  const criada = await tx.pessoa.create({
    data: {
      nome,
      tratamento,
      chave,
      tel: aluno.tel,
      nasc: aluno.nasc,
      observacao: `Criada ao receber um cargo (era aluno #${alunoId}).`,
    },
    select: { id: true },
  });
  return criada.id;
}

/**
 * Cria (ou reaproveita) uma Pessoa a partir de um nome digitado.
 *
 * Permite pôr como professor/dirigente alguém que NÃO está em lugar nenhum do
 * cadastro. Separa o tratamento do nome e usa a `chave` normalizada como
 * âncora: se já existe uma pessoa com o mesmo nome, reaproveita em vez de criar
 * uma segunda.
 */
export async function pessoaDeNome(tx: Prisma.TransactionClient, nomeCompleto: string): Promise<number> {
  const { tratamento, nome } = separarTratamento(nomeCompleto.trim());
  const chave = normalizarChave(nome);
  if (!chave || nome.length < 2) throw new Error("Informe um nome válido.");

  const existente = await tx.pessoa.findUnique({ where: { chave }, select: { id: true } });
  if (existente) return existente.id;

  const criada = await tx.pessoa.create({
    data: { nome, tratamento, chave, observacao: "Cadastrada ao definir um cargo." },
    select: { id: true },
  });
  return criada.id;
}
