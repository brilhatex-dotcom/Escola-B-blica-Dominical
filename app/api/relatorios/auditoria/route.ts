import { prisma } from "@/lib/prisma";
import { lerPaginacao, pagina, responder } from "@/lib/api";
import { exigirLeitura } from "@/lib/auth/guarda";

/**
 * Auditoria: o que foi criado, alterado e apagado.
 *
 * ============================================================================
 * ESTE RELATÓRIO OLHA PARA TRÁS — E O QUE ELE VÊ TERMINA NA MIGRAÇÃO
 *
 * A tabela `Auditoria` tem 1.671 linhas, todas do sistema antigo. O portal
 * atual ainda NÃO grava nela: a auditoria nova entra na Fase 12.
 *
 * A tela diz isso em vez de deixar a lista simplesmente parar numa data. Um
 * registro de auditoria que some sem aviso é pior que não ter registro nenhum
 * — ele sugere que nada aconteceu depois daquele dia.
 *
 * A tabela também NÃO tem coluna de congregação, então o recorte por acesso não
 * tem em que se apoiar. Por isso a leitura é restrita a quem enxerga o campo
 * inteiro; um Dirigente veria ações de outras congregações sem que houvesse
 * como filtrar.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { recusa } = await exigirLeitura("rel-auditoria");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const { pagina: p, porPagina, pular } = lerPaginacao(url);
    const busca = url.searchParams.get("busca")?.trim() ?? "";
    const entidade = url.searchParams.get("entidade")?.trim() ?? "";

    const where = {
      ...(entidade ? { entidade } : {}),
      ...(busca
        ? {
            OR: [
              { who: { contains: busca, mode: "insensitive" as const } },
              { desc: { contains: busca, mode: "insensitive" as const } },
              { action: { contains: busca, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, linhas, entidades, maisRecente] = await Promise.all([
      prisma.auditoria.count({ where }),
      prisma.auditoria.findMany({
        where,
        orderBy: { when: "desc" },
        skip: pular,
        take: porPagina,
      }),
      prisma.auditoria.findMany({ distinct: ["entidade"], select: { entidade: true }, orderBy: { entidade: "asc" } }),
      prisma.auditoria.findFirst({ orderBy: { when: "desc" }, select: { when: true } }),
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
        })),
        total,
        p,
        porPagina,
      ),
      entidades: entidades.map((e) => e.entidade).filter(Boolean),
      /** Até quando o registro herdado vai. A tela avisa que para aqui. */
      ultimoRegistro: maisRecente?.when.toISOString() ?? null,
      gravandoAgora: false,
    };
  });
}
