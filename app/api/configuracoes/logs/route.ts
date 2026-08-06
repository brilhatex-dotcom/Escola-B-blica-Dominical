import { prisma } from "@/lib/prisma";
import { lerPaginacao, pagina, responder } from "@/lib/api";
import { exigirLeitura } from "@/lib/auth/guarda";
import { ULTIMO_ID_IMPORTADO } from "@/lib/auditoria";

/**
 * Logs — quem entrou e o que fez.
 *
 * ============================================================================
 * A MESMA TABELA, DUAS ORIGENS — E A TELA NÃO FINGE QUE SÃO UMA SÓ
 *
 * `Auditoria` guarda 1.671 linhas herdadas do sistema antigo e, a partir da
 * Fase 12, as do portal. São o mesmo histórico e devem ser lidas juntas; mas
 * uma linha de 2025 e uma de hoje não têm a mesma confiabilidade, e a tela
 * marca qual é qual (`origem`).
 *
 * O corte é o `id`: a sequência criada por `prisma/aplicar-fase-12.sql` começa
 * acima do maior id importado, então tudo acima dele foi gravado pelo portal.
 * Datar o corte pela hora seria frágil — o relógio de um servidor pode voltar
 * atrás, e a importação carimbou datas antigas em linhas novas.
 *
 * A leitura é restrita a quem enxerga o campo inteiro (`cfg-logs` não está na
 * lista do grupo B): as linhas antigas não têm congregação nenhuma, então
 * recortar por acesso esconderia o histórico inteiro de um Dirigente em vez de
 * mostrar a parte dele.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { recusa } = await exigirLeitura("cfg-logs");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const { pagina: p, porPagina, pular } = lerPaginacao(url);
    const busca = url.searchParams.get("busca")?.trim() ?? "";
    const acao = url.searchParams.get("acao")?.trim() ?? "";
    const origem = url.searchParams.get("origem")?.trim() ?? "";

    const where = {
      ...(acao ? { action: acao } : {}),
      ...(origem === "portal" ? { id: { gt: ULTIMO_ID_IMPORTADO } } : {}),
      ...(origem === "antigo" ? { id: { lte: ULTIMO_ID_IMPORTADO } } : {}),
      ...(busca
        ? {
            OR: [
              { who: { contains: busca, mode: "insensitive" as const } },
              { whoLogin: { contains: busca, mode: "insensitive" as const } },
              { desc: { contains: busca, mode: "insensitive" as const } },
              { entidade: { contains: busca, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, linhas, acoes, doPortal, ultimaDoPortal] = await Promise.all([
      prisma.auditoria.count({ where }),
      prisma.auditoria.findMany({
        where,
        orderBy: { when: "desc" },
        skip: pular,
        take: porPagina,
        select: {
          id: true, when: true, who: true, whoLogin: true,
          action: true, entidade: true, desc: true,
          congregacao: { select: { nome: true } },
        },
      }),
      prisma.auditoria.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
      prisma.auditoria.count({ where: { id: { gt: ULTIMO_ID_IMPORTADO } } }),
      prisma.auditoria.findFirst({
        where: { id: { gt: ULTIMO_ID_IMPORTADO } },
        orderBy: { when: "desc" },
        select: { when: true },
      }),
    ]);

    return {
      ...pagina(
        linhas.map((a) => ({
          id: a.id,
          quando: a.when.toISOString(),
          quem: a.who || a.whoLogin,
          login: a.whoLogin,
          acao: a.action,
          entidade: a.entidade,
          descricao: a.desc,
          congregacao: a.congregacao?.nome ?? null,
          origem: a.id > ULTIMO_ID_IMPORTADO ? ("portal" as const) : ("antigo" as const),
        })),
        total,
        p,
        porPagina,
      ),
      acoes: acoes.map((a) => ({ acao: a.action, linhas: a._count._all })),
      /**
       * O portal já está gravando neste banco?
       *
       * A resposta vem do BANCO, não de uma constante: o mesmo código roda onde
       * `aplicar-fase-12.sql` já foi colado e onde ainda não foi, e a tela
       * precisa dizer qual dos dois é o caso — senão a secretaria fica olhando
       * uma lista parada sem saber se falta alguma coisa a fazer.
       */
      gravandoAgora: doPortal > 0,
      linhasDoPortal: doPortal,
      ultimaDoPortal: ultimaDoPortal?.when.toISOString() ?? null,
    };
  });
}
