import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { escopoDeEscrita, exigirCongregacaoPermitida } from "@/lib/auth/escopo";
import { registrar } from "@/lib/auditoria";
import { pessoaDeAluno, pessoaDeNome } from "@/lib/pessoas/resolver";

/**
 * Define quem dirige uma congregação — Dirigente, Vice ou Secretário Local.
 *
 * ============================================================================
 * O MESMO MODELO DA LIDERANÇA DO CAMPO, AGORA COM CONGREGAÇÃO — E QUEM DIRIGE
 * A PRÓPRIA CONGREGAÇÃO PODE DEFINIR ISSO (FASE 16)
 *
 * A rota de Liderança (app/api/lideranca) troca os cargos do CAMPO, que não têm
 * congregação. Esta faz o mesmo para os cargos de CONGREGAÇÃO: grava o vínculo
 * em `PessoaCargos` com o `congId` preenchido, que é a peça que faltava para o
 * organograma poder receber os dirigentes pela tela.
 *
 * Até a Fase 16, só quem enxergava o campo inteiro (`hierarquia`) conseguia
 * gravar aqui. A liderança pediu explicitamente que um Dirigente pudesse dizer
 * quem é o Vice e o Secretário Local DA PRÓPRIA CONGREGAÇÃO — por isso a
 * permissão virou `congregacoes` (que o Grupo B já tem, recortada) em vez de
 * `hierarquia` (que continua só do campo). `escopoDeEscrita` +
 * `exigirCongregacaoPermitida` garantem que o `congId` do pedido é
 * exatamente o da sessão — um Dirigente da Cong. Bandeiras não consegue
 * mandar `congId` de outra congregação, mesmo sabendo o número.
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
  const { sessao, recusa, congId: doAcesso } = await escopoDeEscrita("congregacoes");
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
    // Um Dirigente da Cong. Bandeiras não define liderança de outra
    // congregação, mesmo sabendo o id dela.
    exigirCongregacaoPermitida(doAcesso, congId!);

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
