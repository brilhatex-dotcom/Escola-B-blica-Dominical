import { prisma } from "@/lib/prisma";
import { erro, lerCorpo, lerInt, proximoId, responder, texto, textoOpcional } from "@/lib/api";
import { escopoDeEscrita, exigirCongregacaoPermitida } from "@/lib/auth/escopo";
import { CATEGORIAS } from "@/lib/ebd/categorias";
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

/**
 * Criar uma classe.
 *
 * `tipoClasse` não é rótulo bonito: é a chave que já ligava três tabelas do
 * sistema antigo — `Classes.tipoClasse`, `Licoes.tipoClasse` e
 * `Precos_Revistas.categoria` usam exatamente os mesmos valores. Uma classe
 * com a categoria errada recebe a lição de outra faixa etária e pede a revista
 * errada, e o sintoma só aparece quando a revista não chega. Por isso ela é
 * escolhida numa lista, e nunca digitada.
 */
export async function POST(req: Request) {
  const { recusa, congId: doAcesso, sessao } = await escopoDeEscrita("classes");
  if (recusa) return recusa;

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  const nome = texto(corpo.nome, 120);
  if (!nome) return erro("Informe o nome da classe.", 400);

  const tipoClasse = texto(corpo.tipoClasse, 40);
  if (!tipoClasse || !CATEGORIAS.includes(tipoClasse)) {
    return erro("Escolha a categoria da classe.", 400);
  }

  /*
   * Quem enxerga uma congregação só não escolhe: a classe nasce na dele.
   * Aceitar a congregação do corpo da requisição nesse caso permitiria criar
   * classe na congregação vizinha só mandando outro número.
   */
  const pedida = Number.isInteger(corpo.congId) ? (corpo.congId as number) : null;
  const congId = doAcesso ? (sessao?.congIds[0] ?? null) : pedida;
  if (congId === null) return erro("Escolha a congregação da classe.", 400);
  exigirCongregacaoPermitida(doAcesso, congId);

  return responder(async () =>
    prisma.$transaction(async (tx) => {
      const id = await proximoId(() => tx.classe.aggregate({ _max: { id: true } }));
      return tx.classe.create({
        data: {
          id,
          nome,
          faixa: textoOpcional(corpo.faixa, 60) ?? "",
          tipoClasse,
          congId,
          ativa: true,
        },
        select: { id: true, nome: true },
      });
    }),
  );
}
