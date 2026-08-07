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
import { escopoDeEscrita, exigirCongregacaoPermitida } from "@/lib/auth/escopo";
import { CHAVES_POSICAO } from "@/lib/ebd/posicoes";
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
          posicao: true,
          ativo: true,
          matriculadoEm: true,
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
 * A congregação NÃO vem do corpo da requisição: ela é deduzida da CLASSE
 * escolhida. Aceitá-la do cliente permitiria a alguém do grupo B cadastrar um
 * aluno noutra congregação simplesmente mandando outro `congId` — o recorte da
 * leitura ficaria de pé e o da escrita, aberto.
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

  if (corpo.posicao && !posicaoValida(corpo.posicao)) {
    return erro("Posição no ministério inválida.", 400);
  }

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
          // Posicao desconhecida vira null em vez de ser gravada: um valor fora
          // da lista nao teria tratamento nem ordem, e apareceria cru na tela.
          posicao: posicaoValida(corpo.posicao),
          classeId: classe.id,
          congId: classe.congId,
          ativo: true,
          /*
           * A matrícula nasce HOJE, sempre — nunca vem do corpo da
           * requisição. Se viesse do cliente, bastaria mandar uma data
           * antiga para reabrir chamadas passadas em nome de alguém que
           * acabou de se matricular. É esta data que a Chamada usa para
           * recusar marcar presença ou falta num domingo anterior a ela.
           */
          matriculadoEm: dataCivil(new Date().toISOString().slice(0, 10)),
        },
        select: { id: true, nome: true },
      });
    });
  });
}

/** A posição, se for uma das reconhecidas. Ver lib/ebd/posicoes.ts. */
function posicaoValida(valor: unknown): string | null {
  return typeof valor === "string" && CHAVES_POSICAO.includes(valor) ? valor : null;
}
