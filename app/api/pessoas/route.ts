import { prisma } from "@/lib/prisma";
import { erro, lerInt, lerPaginacao, pagina, responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";

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
  // Fechada como as demais: ver o cadastro de pessoas exige poder ver o módulo.
  const { recusa } = await exigirLeitura("professores");
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
          // O login (se houver) ligado a esta pessoa — é o que a tela usa para
          // oferecer "remover dos usuários" sem precisar de outra consulta.
          usuario: {
            select: { id: true, login: true, ativo: true, congId: true },
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

/**
 * DELETE ?pessoaId= — "remover dos usuários": desativa o login ligado a esta
 * pessoa, sem apagar o cadastro dela nem os cargos que exerce.
 *
 * ============================================================================
 * DESATIVAR, NÃO APAGAR
 *
 * A conta pode ter chamadas e auditoria já registradas em nome dela — apagar
 * a linha quebraria esse histórico. `ativo:false` é o mesmo botão que a tela
 * de Usuários já usa (AlternarAtivo): a pessoa continua no organograma, só
 * deixa de conseguir entrar no portal.
 *
 * A permissão é a do módulo Professores (`exigirEscrita("professores")`), não
 * a de Usuários — é daqui, olhando o cadastro de pessoas, que o pedido nasceu,
 * e o Dirigente que gerencia professores não necessariamente administra
 * contas em geral.
 * ============================================================================
 */
export async function DELETE(req: Request) {
  const { sessao, recusa } = await exigirEscrita("professores");
  if (recusa) return recusa;

  const url = new URL(req.url);
  const pessoaId = lerInt(url, "pessoaId");
  if (pessoaId === null) return erro("Informe a pessoa.", 400);

  const usuario = await prisma.usuario.findUnique({
    where: { pessoaId },
    select: { id: true, login: true, ativo: true, congId: true, perfil: true },
  });
  if (!usuario) return erro("Esta pessoa não tem login de acesso.", 404);
  if (usuario.perfil === "master") return erro("A conta master não pode ser removida por aqui.", 403);

  const recorte = recorteDaSessao(sessao);
  if (recorte && !(usuario.congId !== null && recorte.in.includes(usuario.congId))) {
    return erro("O seu acesso não permite remover este login.", 403);
  }

  if (!usuario.ativo) {
    return responder(async () => ({ ok: true, mudou: false }));
  }

  return responder(async () => {
    await prisma.usuario.update({ where: { id: usuario.id }, data: { ativo: false } });
    registrar({
      sessao,
      acao: "UPDATE",
      entidade: "Usuarios",
      descricao: `Login "${usuario.login}" removido a partir do cadastro de professores.`,
      congId: usuario.congId,
    });
    return { ok: true, mudou: true };
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
