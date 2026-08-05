import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/**
 * Congregações do campo, cada uma com quem responde por ela.
 *
 * ============================================================================
 * DIRIGENTE E VICE VÊM DE `PessoaCargos`, NÃO DE COLUNAS EM `Congregacoes`
 *
 * Guardar `dirigenteId` e `viceId` direto na congregação parece mais simples e
 * cria duas fontes de verdade para o mesmo fato. No dia em que alguém trocasse
 * o Dirigente pela tela de Hierarquia, a coluna aqui continuaria apontando para
 * a pessoa anterior — e as duas telas mostrariam nomes diferentes, ambas
 * "corretas".
 *
 * Como o vínculo já mora em `PessoaCargos` (com a congregação dentro, desde a
 * Fase 05), a congregação apenas o consulta. Trocar o Dirigente continua sendo
 * alteração em um lugar só.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { sessao, recusa } = await exigirLeitura("congregacoes");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);

    const congregacoes = await prisma.congregacao.findMany({
      where: recorte ? { id: recorte } : undefined,
      orderBy: { id: "asc" },
      select: {
        id: true,
        nome: true,
        _count: { select: { classes: true, alunos: true } },
        pessoaCargos: {
          where: {
            ativo: true,
            fim: null,
            cargo: { nome: { in: ["Dirigente", "Vice-Dirigente", "Secretário Local"] } },
          },
          orderBy: { cargo: { ordem: "asc" } },
          select: {
            id: true,
            cargo: { select: { nome: true, ordem: true } },
            pessoa: { select: { id: true, nome: true, tratamento: true, tel: true } },
          },
        },
      },
    });

    /*
     * Congregação sem nome aparece como "Congregação 7", e não em branco.
     *
     * O model foi DERIVADO dos `congId` encontrados no export — não havia aba
     * de congregações no sistema antigo, então o nome nasceu vazio em algumas.
     * Uma linha em branco numa lista parece defeito; com o número, quem conhece
     * o campo reconhece qual é e pode corrigir o nome.
     */
    return {
      itens: congregacoes.map((c) => {
        const por = (nome: string) =>
          c.pessoaCargos.find((v) => v.cargo.nome === nome)?.pessoa ?? null;

        return {
          id: c.id,
          nome: c.nome?.trim() || `Congregação ${c.id}`,
          semNome: !c.nome?.trim(),
          classes: c._count.classes,
          alunos: c._count.alunos,
          dirigente: por("Dirigente"),
          vice: por("Vice-Dirigente"),
          secretario: por("Secretário Local"),
        };
      }),
      total: congregacoes.length,
    };
  });
}
