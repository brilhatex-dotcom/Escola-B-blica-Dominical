import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

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
/*
 * ============================================================================
 * A GUARDA CHEGOU DEPOIS — E ESSA É A LIÇÃO
 *
 * Esta rota nasceu na Fase 05, quando ainda não havia permissões. A Fase 08
 * trouxe o RBAC e protegeu o que ela mesma criou; as rotas anteriores ficaram
 * abertas, e ninguém percebeu porque a TELA já escondia o menu.
 *
 * Esconder o item do menu nunca protegeu nada: bastava digitar
 * `/api/alunos` no navegador para receber os 323 alunos do campo inteiro,
 * independentemente da congregação de quem pedia. O recorte que o painel
 * aplicava com cuidado não existia aqui.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

/**
 * O alcance efetivo: o que a tela pediu, limitado ao que o acesso permite.
 *
 * Devolver `undefined` significa "não filtre", e só acontece para quem enxerga
 * o campo inteiro sem ter pedido congregação nenhuma.
 */
function alvoDaConsulta(
  recorte: { in: number[] } | undefined,
  pedida: number | null,
): { in: number[] } | undefined {
  if (recorte) {
    return { in: pedida !== null && recorte.in.includes(pedida) ? [pedida] : recorte.in };
  }
  return pedida !== null ? { in: [pedida] } : undefined;
}

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("classes");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);
    const url = new URL(req.url);
    const congId = lerInt(url, "cong");
    const busca = url.searchParams.get("busca")?.trim() ?? "";

    const classes = await prisma.classe.findMany({
      where: {
        ...(alvoDaConsulta(recorte, congId) ? { congId: alvoDaConsulta(recorte, congId) } : {}),
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
