import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/**
 * Pedido de revistas: quantas cada classe precisa, e quanto custa.
 *
 * ============================================================================
 * O PEDIDO É CALCULADO, NÃO CADASTRADO
 *
 * A aba `Pedidos_Revistas` do sistema antigo veio VAZIA no export — nunca foi
 * usada. Não há como importar o que não existe, e inventar um cadastro em
 * branco daria uma tela que só funciona depois de alguém digitar tudo de novo.
 *
 * O que existe são os alunos matriculados por classe e a tabela de preços por
 * categoria (35 linhas, reais). Com as duas, o pedido de cada classe é a
 * contagem de alunos ativos — que é exatamente o número de revistas que a
 * classe precisa. A secretaria ajusta o que quiser antes de fechar o pedido; o
 * sistema entrega a conta pronta em vez da folha em branco.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

/**
 * De que categoria de revista uma classe precisa.
 *
 * O `tipoClasse` do cadastro antigo é texto livre ("adultos", "Jovens",
 * "juniores"…), e a tabela de preços usa as próprias chaves. O casamento é
 * feito por normalização, e o que não casar fica com `null` — visível na tela
 * como "categoria não definida", em vez de somar zero em silêncio e produzir um
 * total que ninguém consegue conferir.
 */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export async function GET() {
  const { sessao, recusa } = await exigirLeitura("revistas");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);

    const [classes, precos] = await Promise.all([
      prisma.classe.findMany({
        where: { ativa: true, congId: recorte },
        orderBy: [{ congId: "asc" }, { nome: "asc" }],
        select: {
          id: true,
          nome: true,
          tipoClasse: true,
          faixa: true,
          congregacao: { select: { id: true, nome: true } },
          _count: { select: { alunos: { where: { ativo: true } } } },
        },
      }),
      prisma.precoRevista.findMany({ orderBy: [{ categoria: "asc" }, { key: "asc" }] }),
    ]);

    // Index por categoria normalizada; dentro, o menor preço serve de referência
    // quando há mais de uma opção (aluno, professor…).
    const porCategoria = new Map<string, { label: string; preco: number; key: string }[]>();
    for (const p of precos) {
      const chave = normalizar(p.categoria);
      const lista = porCategoria.get(chave) ?? [];
      lista.push({ label: p.label, preco: Number(p.preco), key: p.key });
      porCategoria.set(chave, lista);
    }

    const itens = classes.map((c) => {
      const opcoes = porCategoria.get(normalizar(c.tipoClasse ?? "")) ?? null;
      const referencia = opcoes?.reduce((a, b) => (b.preco < a.preco ? b : a)) ?? null;
      const quantidade = c._count.alunos;

      return {
        classeId: c.id,
        classe: c.nome,
        faixa: c.faixa,
        tipoClasse: c.tipoClasse,
        congregacao: c.congregacao?.nome?.trim() || (c.congregacao ? `Congregação ${c.congregacao.id}` : "—"),
        quantidade,
        categoriaEncontrada: Boolean(referencia),
        precoUnitario: referencia?.preco ?? null,
        subtotal: referencia ? Number((referencia.preco * quantidade).toFixed(2)) : null,
      };
    });

    const semCategoria = itens.filter((i) => !i.categoriaEncontrada).length;

    return {
      itens,
      total: itens.length,
      revistas: itens.reduce((s, i) => s + i.quantidade, 0),
      // O total soma SÓ o que tem preço. Tratar categoria ausente como zero
      // produziria um valor menor que o real, com aparência de conferido.
      valor: Number(itens.reduce((s, i) => s + (i.subtotal ?? 0), 0).toFixed(2)),
      semCategoria,
      categorias: [...porCategoria.keys()].sort(),
    };
  });
}
