import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";

/**
 * Classes, com a contagem de alunos e os professores DE VERDADE.
 *
 * `professores` vem de PessoaCargo, e nao do campo `prof` (texto livre). E a
 * diferenca entre "Pb. Lourival e Aux. Danilo" — uma string — e duas pessoas
 * que existem no cadastro, tem telefone e podem ser abertas.
 *
 * O texto original continua sendo devolvido em `profOriginal`, para conferencia
 * enquanto a migracao dos nomes nao for revisada pela secretaria.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return responder(async () => {
    const url = new URL(req.url);
    const congId = lerInt(url, "cong");
    const busca = url.searchParams.get("busca")?.trim() ?? "";

    const classes = await prisma.classe.findMany({
      where: {
        ...(congId ? { congId } : {}),
        ...(busca ? { nome: { contains: busca, mode: "insensitive" as const } } : {}),
      },
      orderBy: [{ congId: "asc" }, { nome: "asc" }],
      select: {
        id: true,
        nome: true,
        faixa: true,
        tipoClasse: true,
        ativa: true,
        prof: true,
        congregacao: { select: { id: true, nome: true } },
        _count: { select: { alunos: true } },
        pessoaCargos: {
          where: { ativo: true, cargo: { nome: "Professor" } },
          select: { pessoa: { select: { id: true, nome: true, tratamento: true } } },
        },
      },
    });

    return {
      itens: classes.map((c) => ({
        id: c.id,
        nome: c.nome,
        faixa: c.faixa,
        tipoClasse: c.tipoClasse,
        ativa: c.ativa,
        profOriginal: c.prof,
        congregacao: c.congregacao,
        alunos: c._count.alunos,
        professores: c.pessoaCargos.map((v) => v.pessoa),
      })),
      total: classes.length,
    };
  });
}
