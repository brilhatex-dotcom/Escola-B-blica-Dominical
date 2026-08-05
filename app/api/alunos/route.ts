import { prisma } from "@/lib/prisma";
import { lerInt, lerPaginacao, pagina, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/**
 * Alunos matriculados.
 *
 *   ?busca=   nome
 *   ?classe=  id da classe
 *   ?cong=    id da congregacao
 *   ?ativo=0  inclui os inativos (por padrao a lista mostra so quem esta ativo)
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

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("alunos");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);
    const url = new URL(req.url);
    const { pagina: p, porPagina, pular } = lerPaginacao(url);

    const busca = url.searchParams.get("busca")?.trim() ?? "";
    const classeId = lerInt(url, "classe");
    const congId = lerInt(url, "cong");
    const incluirInativos = url.searchParams.get("ativo") === "0";

    /*
     * `Alunos.nome` nao tem coluna normalizada como `Pessoas.chave`, entao aqui
     * a busca usa `mode: "insensitive"`, que resolve a caixa mas nao o acento.
     * E uma limitacao conhecida: quem digitar "jose" nao acha "José". Criar a
     * coluna normalizada tambem para alunos e a correcao certa, e ela pede
     * migration propria — nao entra de carona nesta.
     */
    /*
     * O `?cong=` da tela ESTREITA, nunca amplia.
     *
     * Quem enxerga o campo inteiro recebe `recorte === undefined` e o filtro da
     * tela vale como pedido. Quem enxerga uma congregação só recebe a lista
     * dela — e pedir outra pela barra de endereço não muda nada, porque o alvo
     * é a interseção dos dois.
     */
    const alvo = recorte
      ? { in: congId !== null && recorte.in.includes(congId) ? [congId] : recorte.in }
      : congId !== null
        ? { in: [congId] }
        : undefined;

    const where = {
      ...(incluirInativos ? {} : { ativo: true }),
      ...(busca ? { nome: { contains: busca, mode: "insensitive" as const } } : {}),
      ...(classeId ? { classeId } : {}),
      ...(alvo ? { congId: alvo } : {}),
    };

    const [total, alunos] = await Promise.all([
      prisma.aluno.count({ where }),
      prisma.aluno.findMany({
        where,
        orderBy: { nome: "asc" },
        skip: pular,
        take: porPagina,
        select: {
          id: true,
          nome: true,
          nasc: true,
          tel: true,
          resp: true,
          ativo: true,
          classe: { select: { id: true, nome: true, faixa: true } },
          congregacao: { select: { id: true, nome: true } },
        },
      }),
    ]);

    return pagina(alunos, total, p, porPagina);
  });
}
