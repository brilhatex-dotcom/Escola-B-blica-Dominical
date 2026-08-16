import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { CATALOGO_CPAD, FATOR_LIQUIDO_CPAD } from "@/lib/revistas/cpad";
import { proximoTrimestre, trimestreDaChave, trimestreDe, trimestreValido } from "@/lib/revistas/trimestre";

/**
 * Pedido Consolidado para a CPAD — a soma de TODOS os pedidos CONFIRMADOS do
 * campo num trimestre, já no formato do formulário oficial (código, classe,
 * idade, valor unitário, bruto e líquido) — o que a secretaria do campo
 * manda pronto para a CPAD Megastore Recife, em vez de somar pedido por
 * pedido à mão.
 *
 * Só o campo (sem recorte de congregação) vê este relatório — é o mesmo
 * corte de quem define tema/prazos em `/api/revistas` (PUT), porque é um
 * documento único do campo inteiro, não de uma congregação.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("revistas");
  if (recusa) return recusa;
  if (recorteDaSessao(sessao)) {
    return erro("Só a administração do campo vê o pedido consolidado para a CPAD.", 403);
  }

  return responder(async () => {
    const hoje = new Date();
    const url = new URL(req.url);
    const paramTri = url.searchParams.get("trimestre");
    const tri =
      paramTri === "proximo"
        ? proximoTrimestre(hoje)
        : paramTri && trimestreValido(paramTri)
          ? trimestreDaChave(paramTri)
          : trimestreDe(hoje);

    const [pedidos, precos] = await Promise.all([
      prisma.pedidoRevista.findMany({
        where: { trimestre: tri.chave },
        include: { itens: true, congregacao: { select: { id: true, nome: true } } },
      }),
      prisma.precoRevista.findMany(),
    ]);

    const precoDe = new Map(precos.map((p) => [`${p.categoria}|${p.key}`, Number(p.preco)]));

    // Só pedidos CONFIRMADOS entram na soma — rascunho não é compromisso de
    // compra, e um pedido consolidado com quantidade "pendurada" de rascunho
    // faria o campo pedir revista a mais da CPAD por engano.
    const confirmados = pedidos.filter((p) => p.confirmado);
    const pendentes = pedidos
      .filter((p) => !p.confirmado)
      .map((p) => ({ congId: p.congId, nome: p.congregacao.nome?.trim() || `Congregação ${p.congId}` }));

    const semPedido = await prisma.congregacao.findMany({
      where: { id: { notIn: pedidos.map((p) => p.congId) } },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });

    const qtPorItem = new Map<string, number>();
    for (const pedido of confirmados) {
      for (const item of pedido.itens) {
        const chave = `${item.categoria}|${item.tipo}`;
        qtPorItem.set(chave, (qtPorItem.get(chave) ?? 0) + item.quantidade);
      }
    }

    const linhas = CATALOGO_CPAD.map((item) => {
      const chave = `${item.categoria}|${item.tipo}`;
      const quantidade = qtPorItem.get(chave) ?? 0;
      const unitario = precoDe.get(chave) ?? 0;
      const bruto = Number((quantidade * unitario).toFixed(2));
      const liquido = Number((bruto * FATOR_LIQUIDO_CPAD).toFixed(2));
      return { ...item, quantidade, unitario, bruto, liquido };
    });

    const totais = {
      quantidade: linhas.reduce((s, l) => s + l.quantidade, 0),
      bruto: Number(linhas.reduce((s, l) => s + l.bruto, 0).toFixed(2)),
      liquido: Number(linhas.reduce((s, l) => s + l.liquido, 0).toFixed(2)),
    };

    return {
      trimestre: { chave: tri.chave, rotulo: tri.rotulo },
      congregacoesTotal: pedidos.length + semPedido.length,
      congregacoesConfirmadas: confirmados.length,
      congregacoesPendentes: [
        ...pendentes,
        ...semPedido.map((c) => ({ congId: c.id, nome: c.nome?.trim() || `Congregação ${c.id}` })),
      ].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      linhas,
      totais,
    };
  });
}
