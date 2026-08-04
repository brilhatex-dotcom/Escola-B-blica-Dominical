import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirEscrita } from "@/lib/auth/guarda";

/**
 * A hierarquia oficial do campo — leitura e edição.
 *
 * É esta rota que cumpre o "preparado para edição futura através do painel
 * administrativo, sem necessidade de alterar o código". Trocar o Supervisor da
 * EBD passa a ser um POST, não um commit.
 *
 * GET  devolve todo cargo em destaque, ocupado ou VAGO.
 * POST { cargoId, pessoaId }  — `pessoaId: null` desocupa o cargo.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return responder(async () => {
    const cargos = await prisma.cargo.findMany({
      where: { destaque: true, ativo: true },
      orderBy: { ordem: "asc" },
      select: {
        id: true,
        nome: true,
        ordem: true,
        vinculos: {
          where: { ativo: true, fim: null },
          take: 1,
          orderBy: { criadoEm: "asc" },
          select: { pessoa: { select: { id: true, nome: true, tratamento: true, foto: true } } },
        },
      },
    });

    return {
      itens: cargos.map((c) => {
        const p = c.vinculos[0]?.pessoa ?? null;
        return {
          cargoId: c.id,
          cargo: c.nome,
          ordem: c.ordem,
          pessoaId: p?.id ?? null,
          nome: p?.nome ?? null,
          tratamento: p?.tratamento ?? null,
          foto: p?.foto ?? null,
        };
      }),
    };
  });
}

export async function POST(req: Request) {
  // Trocar quem ocupa um cargo do campo e decisao da administracao, nao de
  // qualquer pessoa com sessao aberta.
  const { recusa } = await exigirEscrita("lideranca");
  if (recusa) return recusa;

  let corpo: { cargoId?: number; pessoaId?: number | null };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const { cargoId, pessoaId } = corpo ?? {};
  if (!Number.isInteger(cargoId)) return erro("Informe o cargo.", 400);
  if (pessoaId !== null && !Number.isInteger(pessoaId)) {
    return erro("Informe a pessoa, ou null para deixar o cargo vago.", 400);
  }

  return responder(async () => {
    const cargo = await prisma.cargo.findUnique({ where: { id: cargoId! } });
    if (!cargo) throw new Error("Cargo não encontrado.");

    return prisma.$transaction(async (tx) => {
      /*
       * O vinculo anterior e ENCERRADO, nao apagado.
       *
       * `fim` marca a data em que a pessoa deixou a funcao, e a linha continua
       * no banco. Apagar destruiria o historico — daqui a dois anos, ninguem
       * conseguiria responder quem era o Supervisor da EBD em 2026, e essa e
       * exatamente a pergunta que uma ata faz.
       */
      await tx.pessoaCargo.updateMany({
        where: { cargoId: cargo.id, ativo: true, fim: null },
        data: { ativo: false, fim: new Date() },
      });

      if (pessoaId === null) return { ok: true, cargo: cargo.nome, pessoaId: null };

      const pessoa = await tx.pessoa.findUnique({ where: { id: pessoaId! } });
      if (!pessoa) throw new Error("Pessoa não encontrada.");

      /*
       * Reaproveita o vinculo se a pessoa ja ocupou este cargo antes, em vez de
       * criar outro: o indice unico (pessoa, cargo, cong, classe) recusaria a
       * duplicata, e quem voltou a um cargo e comum na igreja.
       */
      const anterior = await tx.pessoaCargo.findFirst({
        where: {
          pessoaId: pessoa.id,
          cargoId: cargo.id,
          congId: { equals: null },
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
          data: { pessoaId: pessoa.id, cargoId: cargo.id, inicio: new Date() },
        });
      }

      return { ok: true, cargo: cargo.nome, pessoaId: pessoa.id, nome: pessoa.nome };
    });
  });
}
