import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirEscrita } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";

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

  let corpo: { congId?: number; cargo?: string; pessoaId?: number | null };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const { congId, cargo, pessoaId } = corpo ?? {};
  if (!Number.isInteger(congId)) return erro("Informe a congregação.", 400);
  if (!cargo || !CARGOS_PERMITIDOS.includes(cargo)) {
    return erro("Cargo inválido para uma congregação.", 400);
  }
  if (pessoaId !== null && !Number.isInteger(pessoaId)) {
    return erro("Informe a pessoa, ou null para deixar vago.", 400);
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

      if (pessoaId === null) {
        return { pessoaId: null as number | null, nome: null as string | null };
      }

      const pessoa = await tx.pessoa.findUnique({ where: { id: pessoaId! } });
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
