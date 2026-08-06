import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirEscrita } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";
import { normalizarChave, separarTratamento } from "@/lib/pessoas/nome";

/**
 * Garante uma Pessoa a partir de um aluno, e devolve o pessoaId.
 *
 * É o que permite promover a dirigente alguém que só existia como aluno
 * ("Aux. Bartolomeu"). Não altera o aluno — ADICIONA uma pessoa, o que a regra
 * da igreja permite (não alterar registro antigo ≠ não poder cadastrar gente).
 * Se já existir uma pessoa com a mesma chave, reaproveita em vez de duplicar.
 */
async function pessoaDeAluno(tx: Prisma.TransactionClient, alunoId: number): Promise<number> {
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
 * É o que permite pôr como dirigente alguém que NÃO está em lugar nenhum do
 * cadastro. Separa o tratamento do nome e usa a `chave` normalizada como
 * âncora: se já existe uma pessoa com o mesmo nome, reaproveita em vez de criar
 * uma segunda — a regra de não duplicar gente, mesmo quando o nome é digitado à
 * mão.
 */
async function pessoaDeNome(tx: Prisma.TransactionClient, nomeCompleto: string): Promise<number> {
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

/**
 * Define quem dirige uma congregação — Dirigente, Vice ou Secretário Local.
 *
 * ============================================================================
 * O MESMO MODELO DA LIDERANÇA DO CAMPO, AGORA COM CONGREGAÇÃO
 *
 * A rota de Liderança (app/api/lideranca) troca os cargos do CAMPO, que não têm
 * congregação. Esta faz o mesmo para os cargos de CONGREGAÇÃO: grava o vínculo
 * em `PessoaCargos` com o `congId` preenchido, que é a peça que faltava para o
 * organograma poder receber os dirigentes pela tela.
 *
 * O vínculo anterior é ENCERRADO (`fim`), nunca apagado — a ata do ano passado
 * precisa continuar dizendo quem dirigia a congregação. E como o papel de
 * acesso vem do cargo (Fase 08), definir o Dirigente aqui já dá a ele a visão da
 * própria congregação, sem tela de permissão à parte.
 * ============================================================================
 *
 * POST { congId, cargo: "Dirigente"|"Vice-Dirigente"|"Secretário Local", pessoaId|null }
 *   `pessoaId: null` deixa o cargo vago.
 */
export const dynamic = "force-dynamic";

const CARGOS_PERMITIDOS = ["Dirigente", "Vice-Dirigente", "Secretário Local"];

export async function POST(req: Request) {
  // Definir quem dirige uma congregação é decisão de quem edita o organograma
  // do campo — o mesmo alcance da Hierarquia.
  const { sessao, recusa } = await exigirEscrita("hierarquia");
  if (recusa) return recusa;

  let corpo: {
    congId?: number;
    cargo?: string;
    pessoaId?: number | null;
    alunoId?: number;
    novoNome?: string;
  };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const { congId, cargo, pessoaId, alunoId, novoNome } = corpo ?? {};
  if (!Number.isInteger(congId)) return erro("Informe a congregação.", 400);
  if (!cargo || !CARGOS_PERMITIDOS.includes(cargo)) {
    return erro("Cargo inválido para uma congregação.", 400);
  }
  const nomeNovo = typeof novoNome === "string" ? novoNome.trim() : "";
  // Quatro formas: pessoa existente, aluno a promover, nome novo, ou vago.
  const vago =
    (pessoaId === null || pessoaId === undefined) && alunoId === undefined && !nomeNovo;
  if (!vago && !Number.isInteger(pessoaId) && !Number.isInteger(alunoId) && !nomeNovo) {
    return erro("Informe a pessoa, o aluno ou um nome, ou null para deixar vago.", 400);
  }

  return responder(async () => {
    const [congregacao, cargoReg] = await Promise.all([
      prisma.congregacao.findUnique({ where: { id: congId! }, select: { id: true, nome: true } }),
      prisma.cargo.findUnique({ where: { nome: cargo } }),
    ]);
    if (!congregacao) throw new Error("Congregação não encontrada.");
    if (!cargoReg) throw new Error(`O cargo "${cargo}" não está cadastrado — aplique a Fase 08.`);

    const nomeCong = congregacao.nome?.trim() || `Congregação ${congregacao.id}`;

    const resultado = await prisma.$transaction(async (tx) => {
      // Encerra quem ocupava ESTE cargo NESTA congregação.
      await tx.pessoaCargo.updateMany({
        where: { cargoId: cargoReg.id, congId: congId!, ativo: true, fim: null },
        data: { ativo: false, fim: new Date() },
      });

      if (vago) {
        return { pessoaId: null as number | null, nome: null as string | null };
      }

      // Nome novo → cria a pessoa; aluno → promove; senão, pessoa existente.
      const alvoId = nomeNovo
        ? await pessoaDeNome(tx, nomeNovo)
        : Number.isInteger(alunoId)
          ? await pessoaDeAluno(tx, alunoId!)
          : pessoaId!;

      const pessoa = await tx.pessoa.findUnique({ where: { id: alvoId } });
      if (!pessoa) throw new Error("Pessoa não encontrada.");

      /*
       * Reaproveita o vínculo se a pessoa já ocupou este cargo nesta
       * congregação: o índice único (pessoa, cargo, cong, classe) recusaria a
       * duplicata, e alguém que volta a dirigir a mesma congregação é comum.
       */
      const anterior = await tx.pessoaCargo.findFirst({
        where: {
          pessoaId: pessoa.id,
          cargoId: cargoReg.id,
          congId: { equals: congId! },
          classeId: { equals: null },
        },
      });

      if (anterior) {
        await tx.pessoaCargo.update({
          where: { id: anterior.id },
          data: { ativo: true, fim: null, inicio: new Date() },
        });
      } else {
        await tx.pessoaCargo.create({
          data: { pessoaId: pessoa.id, cargoId: cargoReg.id, congId: congId!, inicio: new Date() },
        });
      }

      return { pessoaId: pessoa.id, nome: pessoa.nome };
    });

    registrar({
      sessao,
      acao: "UPDATE",
      entidade: "Lideranca",
      descricao:
        resultado.pessoaId === null
          ? `${cargo} de ${nomeCong} ficou vago.`
          : `${cargo} de ${nomeCong} passou a ser ${resultado.nome}.`,
      congId: congId!,
    });

    return { ok: true, cargo, congId, pessoaId: resultado.pessoaId, nome: resultado.nome };
  });
}
