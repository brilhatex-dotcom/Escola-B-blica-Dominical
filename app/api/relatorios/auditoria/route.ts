import { prisma } from "@/lib/prisma";
import { lerPaginacao, pagina, responder } from "@/lib/api";
import { exigirLeitura } from "@/lib/auth/guarda";
import { ULTIMO_ID_IMPORTADO } from "@/lib/auditoria";

/**
 * Auditoria: o que foi criado, alterado e apagado.
 *
 * ============================================================================
 * ESTE RELATÓRIO OLHA PARA TRÁS — E O QUE ELE VÊ TERMINA NA MIGRAÇÃO
 *
 * A tabela `Auditoria` veio com 1.671 linhas do sistema antigo. Desde a Fase
 * 12 o portal TAMBÉM grava nela — mas só depois que
 * `prisma/aplicar-fase-12.sql` for aplicado no banco, porque até lá não existe
 * sequência para o `id`.
 *
 * Por isso `gravandoAgora` é perguntado ao BANCO (há linha com id acima do
 * último importado?) e não fixado no código: o mesmo código roda contra os dois
 * estados, e a tela precisa dizer qual é o caso. Uma lista que simplesmente
 * para numa data sugere que nada aconteceu depois dela, o que é pior do que não
 * ter registro nenhum.
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

    const [total, linhas, entidades, maisRecente, doPortal] = await Promise.all([
      prisma.auditoria.count({ where }),
      prisma.auditoria.findMany({
        where,
        orderBy: { when: "desc" },
        skip: pular,
        take: porPagina,
      }),
      prisma.auditoria.findMany({ distinct: ["entidade"], select: { entidade: true }, orderBy: { entidade: "asc" } }),
      prisma.auditoria.findFirst({ orderBy: { when: "desc" }, select: { when: true } }),
      prisma.auditoria.count({ where: { id: { gt: ULTIMO_ID_IMPORTADO } } }),
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
      /** Até quando o registro vai. A tela avisa se ele para na migração. */
      ultimoRegistro: maisRecente?.when.toISOString() ?? null,
      gravandoAgora: doPortal > 0,
      linhasDoPortal: doPortal,
    };
  });
}
