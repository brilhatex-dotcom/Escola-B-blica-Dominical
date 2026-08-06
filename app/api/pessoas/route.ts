import { prisma } from "@/lib/prisma";
import { lerInt, lerPaginacao, pagina, responder } from "@/lib/api";
import { escopoDaRota } from "@/lib/auth/escopo";

/**
 * Pessoas e os cargos que exercem.
 *
 * ESTA ROTA E A PROVA DE QUE A MODELAGEM FUNCIONA. Ela devolve UMA linha por
 * pessoa, com a lista de cargos dentro — e nao uma linha por cargo. Quem e
 * dirigente e professor aparece uma vez, com dois cargos.
 *
 * Filtros:
 *   ?busca=      nome (sem acento, sem caixa)
 *   ?cargo=      id do cargo
 *   ?cong=       id da congregacao
 *   ?revisar=1   so os cadastros que a importacao marcou como duvida
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  /*
   * A aba Professores e do grupo do campo — decisao da lideranca.
   *
   * Esconder o item do menu nao protege nada: bastaria digitar o endereco. A
   * recusa acontece AQUI, onde os dados de fato saem. Quem dirige uma
   * congregacao continua vendo os professores DELA dentro de cada Classe, que
   * e onde a informacao serve.
   */
  const { recusa } = await escopoDaRota("professores");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const { pagina: p, porPagina, pular } = lerPaginacao(url);

    const busca = url.searchParams.get("busca")?.trim() ?? "";
    const cargoId = lerInt(url, "cargo");
    const congId = lerInt(url, "cong");
    const soRevisar = url.searchParams.get("revisar") === "1";

    /*
     * A busca vai contra `chave`, que ja esta normalizada (minusculo, sem
     * acento). Buscar em `nome` com `mode: "insensitive"` resolveria a caixa,
     * mas nao o acento: quem digita "jose" nao acharia "José" — e ninguem
     * digita acento no celular no meio da chamada.
     */
    const where = {
      ...(busca ? { chave: { contains: normalizar(busca) } } : {}),
      ...(soRevisar ? { revisar: true } : {}),
      ...(cargoId || congId
        ? {
            cargos: {
              some: {
                ativo: true,
                ...(cargoId ? { cargoId } : {}),
                ...(congId ? { congId } : {}),
              },
            },
          }
        : {}),
    };

    const [total, pessoas] = await Promise.all([
      prisma.pessoa.count({ where }),
      prisma.pessoa.findMany({
        where,
        orderBy: [{ revisar: "desc" }, { nome: "asc" }],
        skip: pular,
        take: porPagina,
        select: {
          id: true,
          nome: true,
          tratamento: true,
          tel: true,
          foto: true,
          ativo: true,
          revisar: true,
          observacao: true,
          cargos: {
            where: { ativo: true },
            orderBy: { cargo: { ordem: "asc" } },
            select: {
              id: true,
              origem: true,
              cargo: { select: { id: true, nome: true, ordem: true, escopo: true } },
              congregacao: { select: { id: true, nome: true } },
              classe: { select: { id: true, nome: true } },
            },
          },
        },
      }),
    ]);

    return pagina(
      pessoas.map((pessoa) => ({
        ...pessoa,
        // O numero de cargos vem pronto: e o dado que a tela mostra em destaque,
        // e conta-lo no navegador espalharia a mesma regra por varias telas.
        totalCargos: pessoa.cargos.length,
      })),
      total,
      p,
      porPagina,
    );
  });
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
