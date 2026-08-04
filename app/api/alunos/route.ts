import { prisma } from "@/lib/prisma";
import { lerInt, lerPaginacao, pagina, responder } from "@/lib/api";

/**
 * Alunos matriculados.
 *
 *   ?busca=   nome
 *   ?classe=  id da classe
 *   ?cong=    id da congregacao
 *   ?ativo=0  inclui os inativos (por padrao a lista mostra so quem esta ativo)
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return responder(async () => {
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
    const where = {
      ...(incluirInativos ? {} : { ativo: true }),
      ...(busca ? { nome: { contains: busca, mode: "insensitive" as const } } : {}),
      ...(classeId ? { classeId } : {}),
      ...(congId ? { congId } : {}),
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
