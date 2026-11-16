import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { alvoDaConsulta } from "@/lib/relatorios/comum";
import { grupoDoTipo, NOME_CATEGORIA, ORDEM_CATEGORIAS } from "@/lib/revistas/precos";
import { proximoTrimestre, rotuloDoTrimestre, trimestreValido } from "@/lib/revistas/trimestre";

/**
 * Pedidos de lição em números: quanto o campo pede, paga e deve, trimestre a
 * trimestre — e, no trimestre escolhido, congregação por congregação, com a
 * COBERTURA (revistas de aluno ÷ matriculados): abaixo de 100% há aluno sem
 * revista; bem acima, sobra encomendada.
 *
 *   ?trimestre=4T-2026   (padrão: o mais recente com pedido)
 *
 * Respeita o recorte: quem vê uma congregação vê os números dela.
 */
export const dynamic = "force-dynamic";

const ordemTri = (c: string) => {
  const m = /^([1-4])T-(\d{4})$/.exec(c);
  return m ? Number(m[2]) * 10 + Number(m[1]) : 0;
};

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("estatisticas");
  if (recusa) return recusa;

  return responder(async () => {
    const alvo = alvoDaConsulta(recorteDaSessao(sessao), null);
    const filtroCong = alvo ? { congId: { in: alvo } } : {};

    const [pedidos, pagamentos, congregacoes, matriculados] = await Promise.all([
      prisma.pedidoRevista.findMany({
        where: filtroCong,
        select: {
          congId: true,
          trimestre: true,
          confirmado: true,
          itens: { select: { categoria: true, tipo: true, quantidade: true, precoUnitario: true } },
        },
      }),
      prisma.pagamentoRevista.groupBy({ by: ["congId", "trimestre"], where: filtroCong, _sum: { valor: true } }),
      prisma.congregacao.findMany({
        where: alvo ? { id: { in: alvo } } : {},
        select: { id: true, nome: true },
      }),
      prisma.aluno.groupBy({ by: ["congId"], where: { ativo: true, ...filtroCong }, _count: { _all: true } }),
    ]);

    const pagoPor = new Map(pagamentos.map((p) => [`${p.congId}|${p.trimestre}`, Number(p._sum.valor ?? 0)]));
    const matPor = new Map(matriculados.map((m) => [m.congId, m._count._all]));

    const somar = (itens: (typeof pedidos)[number]["itens"]) => {
      let aluno = 0;
      let professor = 0;
      let outras = 0;
      let valor = 0;
      for (const it of itens) {
        const g = grupoDoTipo(it.tipo);
        if (g === "aluno") aluno += it.quantidade;
        else if (g === "professor") professor += it.quantidade;
        else outras += it.quantidade;
        valor += it.quantidade * Number(it.precoUnitario);
      }
      return { aluno, professor, outras, revistas: aluno + professor + outras, valor: Math.round(valor * 100) / 100 };
    };

    // ---------------- Trimestre a trimestre ----------------
    const chaves = new Set<string>([...pedidos.map((p) => p.trimestre), ...pagamentos.map((p) => p.trimestre)]);
    const trimestres = [...chaves]
      .filter(trimestreValido)
      .sort((a, b) => ordemTri(a) - ordemTri(b))
      .map((chave) => {
        const doTri = pedidos.filter((p) => p.trimestre === chave);
        const confirmados = doTri.filter((p) => p.confirmado);
        const s = somar(confirmados.flatMap((p) => p.itens));
        const pago = pagamentos.filter((p) => p.trimestre === chave).reduce((t, p) => t + Number(p._sum.valor ?? 0), 0);
        return {
          chave,
          rotulo: rotuloDoTrimestre(chave),
          congregacoesComPedido: doTri.filter((p) => p.itens.some((i) => i.quantidade > 0)).length,
          confirmados: confirmados.length,
          revistas: s.revistas,
          revistasAluno: s.aluno,
          revistasProfessor: s.professor,
          valor: s.valor,
          pago: Math.round(pago * 100) / 100,
          saldo: Math.round((s.valor - pago) * 100) / 100,
        };
      });

    // ---------------- O trimestre escolhido ----------------
    const pedido = new URL(req.url).searchParams.get("trimestre");
    const escolhido =
      pedido && trimestreValido(pedido)
        ? pedido
        : [...trimestres].reverse().find((t) => t.revistas > 0)?.chave ?? proximoTrimestre(new Date()).chave;

    const porCategoria = new Map<string, number>();
    const linhas = congregacoes
      .map((c) => {
        const p = pedidos.find((x) => x.congId === c.id && x.trimestre === escolhido);
        const s = somar(p?.itens ?? []);
        for (const it of p?.itens ?? []) {
          if (it.quantidade > 0) porCategoria.set(it.categoria, (porCategoria.get(it.categoria) ?? 0) + it.quantidade);
        }
        const mat = matPor.get(c.id) ?? 0;
        const pago = pagoPor.get(`${c.id}|${escolhido}`) ?? 0;
        return {
          congId: c.id,
          nome: c.nome?.trim() || `Congregação ${c.id}`,
          matriculados: mat,
          revistasAluno: s.aluno,
          revistasProfessor: s.professor,
          outras: s.outras,
          revistas: s.revistas,
          cobertura: mat > 0 && s.aluno > 0 ? Math.round((s.aluno / mat) * 1000) / 10 : null,
          valor: s.valor,
          pago: Math.round(pago * 100) / 100,
          saldo: p?.confirmado ? Math.round((s.valor - pago) * 100) / 100 : null,
          situacao: !p || s.revistas === 0 ? "sem-pedido" : p.confirmado ? "confirmado" : "rascunho",
        };
      })
      .sort((a, b) => b.revistas - a.revistas || a.nome.localeCompare(b.nome, "pt-BR"));

    const categorias = [...porCategoria]
      .map(([categoria, quantidade]) => ({ categoria, rotulo: NOME_CATEGORIA[categoria] ?? categoria, quantidade }))
      .sort((a, b) => ORDEM_CATEGORIAS.indexOf(a.categoria) - ORDEM_CATEGORIAS.indexOf(b.categoria));

    return {
      trimestre: { chave: escolhido, rotulo: rotuloDoTrimestre(escolhido) },
      disponiveis: [...new Set([...trimestres.map((t) => t.chave), escolhido])].sort((a, b) => ordemTri(b) - ordemTri(a)),
      trimestres,
      congregacoes: linhas,
      categorias,
    };
  });
}
