import { prisma } from "@/lib/prisma";
import {
  dataCivil,
  erro,
  lerCorpo,
  lerInt,
  lerPaginacao,
  pagina,
  proximoId,
  responder,
  texto,
  textoOpcional,
} from "@/lib/api";
import {
  combinarCongregacao,
  escopoDaRota,
  escopoDeEscrita,
  exigirCongregacaoPermitida,
} from "@/lib/auth/escopo";

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
  // Permissao e recorte no mesmo passo: quem enxerga so a propria congregacao
  // recebe so os alunos dela, e o filtro sai pronto para o `where`.
  const { recusa, congId: doAcesso } = await escopoDaRota("alunos");
  if (recusa) return recusa;

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
      congId: combinarCongregacao(doAcesso, congId),
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

/**
 * Matricular um aluno.
 *
 * A congregação NÃO vem do corpo da requisição: ela é deduzida da classe
 * escolhida. Aceitá-la do cliente permitiria a alguém do grupo B cadastrar um
 * aluno noutra congregação simplesmente mandando outro `congId` — o recorte da
 * leitura estaria de pé e o da escrita, aberto.
 */
export async function POST(req: Request) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("alunos");
  if (recusa) return recusa;

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  const nome = texto(corpo.nome, 120);
  if (!nome) return erro("Informe o nome do aluno.", 400);

  const classeId = Number.isInteger(corpo.classeId) ? (corpo.classeId as number) : null;
  if (!classeId) return erro("Escolha a classe do aluno.", 400);

  return responder(async () => {
    const classe = await prisma.classe.findUnique({
      where: { id: classeId },
      select: { id: true, congId: true },
    });
    if (!classe) throw new Error("Classe não encontrada.");
    exigirCongregacaoPermitida(doAcesso, classe.congId);

    return prisma.$transaction(async (tx) => {
      const id = await proximoId(() => tx.aluno.aggregate({ _max: { id: true } }));
      return tx.aluno.create({
        data: {
          id,
          nome,
          nasc: dataCivil(corpo.nasc),
          tel: textoOpcional(corpo.tel, 30),
          resp: textoOpcional(corpo.resp, 120),
          classeId: classe.id,
          congId: classe.congId,
          ativo: true,
        },
        select: { id: true, nome: true },
      });
    });
  });
}
