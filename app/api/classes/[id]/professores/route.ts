import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { escopoDeEscrita, exigirCongregacaoPermitida } from "@/lib/auth/escopo";
import { registrar } from "@/lib/auditoria";
import { pessoaDeAluno, pessoaDeNome } from "@/lib/pessoas/resolver";

/**
 * Quem dá aula numa classe — adicionar e remover.
 *
 * ============================================================================
 * A PEÇA QUE FALTAVA: NÃO EXISTIA CAMINHO NENHUM PARA MUDAR ISSO PELA TELA
 *
 * A Fase 05 já lia `PessoaCargos` (cargo "Professor", `classeId` preenchido)
 * em `/api/classes/[id]` — a tela sempre MOSTROU o professor certo. O que não
 * existia era como TROCAR: a tela da classe só apontava para "Administração
 * → Liderança", que edita os cargos do CAMPO (Pastor Presidente, Supervisor…)
 * e nunca soube de classe nenhuma.
 *
 * Esta rota fecha esse buraco, com a mesma permissão de quem já pode editar a
 * classe (`classes`, recortada por congregação) — não uma nova trava de
 * acesso, porque "quem dá aula nesta classe" é parte de cuidar da classe, do
 * mesmo jeito que o nome ou a categoria dela.
 * ============================================================================
 *
 * POST { pessoaId } | { alunoId } | { novoNome }  — adiciona um professor.
 * DELETE ?vinculoId=  — encerra o vínculo (não apaga: `fim` é preenchido).
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

async function classeDoAcesso(id: number, doAcesso: { in: number[] } | undefined) {
  const classe = await prisma.classe.findUnique({
    where: { id },
    select: { id: true, nome: true, congId: true },
  });
  if (!classe) throw new Error("Classe não encontrada.");
  exigirCongregacaoPermitida(doAcesso, classe.congId);
  return classe;
}

export async function POST(req: Request, { params }: Contexto) {
  const { sessao, recusa, congId: doAcesso } = await escopoDeEscrita("classes");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Classe inválida.", 400);

  let corpo: { pessoaId?: number; alunoId?: number; novoNome?: string };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const { pessoaId, alunoId } = corpo;
  const nomeNovo = typeof corpo.novoNome === "string" ? corpo.novoNome.trim() : "";
  if (!Number.isInteger(pessoaId) && !Number.isInteger(alunoId) && !nomeNovo) {
    return erro("Informe a pessoa, o aluno ou um nome.", 400);
  }

  return responder(async () => {
    const classe = await classeDoAcesso(id, doAcesso);

    const cargoProfessor = await prisma.cargo.findUnique({ where: { nome: "Professor" } });
    if (!cargoProfessor) throw new Error('O cargo "Professor" não está cadastrado — aplique a Fase 08.');

    const resultado = await prisma.$transaction(async (tx) => {
      const alvoId = nomeNovo
        ? await pessoaDeNome(tx, nomeNovo)
        : Number.isInteger(alunoId)
          ? await pessoaDeAluno(tx, alunoId!)
          : pessoaId!;

      const pessoa = await tx.pessoa.findUnique({ where: { id: alvoId } });
      if (!pessoa) throw new Error("Pessoa não encontrada.");

      const jaDaAula = await tx.pessoaCargo.findFirst({
        where: { pessoaId: pessoa.id, cargoId: cargoProfessor.id, classeId: classe.id, ativo: true, fim: null },
      });
      if (jaDaAula) throw new Error(`${pessoa.nome} já está registrado(a) como professor(a) desta classe.`);

      // Reaproveita o vínculo se essa pessoa já deu aula nesta classe antes.
      const anterior = await tx.pessoaCargo.findFirst({
        where: { pessoaId: pessoa.id, cargoId: cargoProfessor.id, classeId: classe.id, congId: classe.congId },
      });
      const vinculo = anterior
        ? await tx.pessoaCargo.update({
            where: { id: anterior.id },
            data: { ativo: true, fim: null, inicio: new Date() },
          })
        : await tx.pessoaCargo.create({
            data: {
              pessoaId: pessoa.id,
              cargoId: cargoProfessor.id,
              classeId: classe.id,
              congId: classe.congId,
              inicio: new Date(),
            },
          });

      return { vinculoId: vinculo.id, pessoaId: pessoa.id, nome: pessoa.nome, tratamento: pessoa.tratamento };
    });

    registrar({
      sessao,
      acao: "UPDATE",
      entidade: "PessoaCargos",
      descricao: `${resultado.nome} passou a dar aula na classe ${classe.nome}.`,
      congId: classe.congId ?? undefined,
    });

    return { ok: true, ...resultado };
  });
}

export async function DELETE(req: Request, { params }: Contexto) {
  const { sessao, recusa, congId: doAcesso } = await escopoDeEscrita("classes");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Classe inválida.", 400);

  const vinculoId = Number(new URL(req.url).searchParams.get("vinculoId"));
  if (!Number.isInteger(vinculoId)) return erro("Informe o vínculo a remover.", 400);

  return responder(async () => {
    const classe = await classeDoAcesso(id, doAcesso);

    const vinculo = await prisma.pessoaCargo.findUnique({
      where: { id: vinculoId },
      select: { id: true, classeId: true, ativo: true, pessoa: { select: { nome: true } } },
    });
    if (!vinculo || vinculo.classeId !== classe.id) throw new Error("Vínculo não encontrado nesta classe.");

    if (vinculo.ativo) {
      await prisma.pessoaCargo.update({ where: { id: vinculoId }, data: { ativo: false, fim: new Date() } });
    }

    registrar({
      sessao,
      acao: "UPDATE",
      entidade: "PessoaCargos",
      descricao: `${vinculo.pessoa.nome} deixou de dar aula na classe ${classe.nome}.`,
      congId: classe.congId ?? undefined,
    });

    return { ok: true };
  });
}
