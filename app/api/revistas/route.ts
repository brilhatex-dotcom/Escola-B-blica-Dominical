import { prisma } from "@/lib/prisma";
import { erro, lerInt, responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";

/**
 * Pedido de Lição — o que cada congregação precisa, quanto custa, e quanto já
 * foi pago.
 *
 * ============================================================================
 * O PEDIDO É CALCULADO; OS PAGAMENTOS SÃO REGISTRADOS
 *
 * A aba `Pedidos_Revistas` do sistema antigo veio vazia. O pedido de cada
 * classe é a contagem de alunos ativos × o preço da categoria — a conta pronta,
 * não uma folha em branco.
 *
 * O que a igreja precisava e não tinha é a BAIXA PARCIAL: fecha-se um pedido
 * grande e os alunos vão pagando aos poucos, de várias classes. Por isso cada
 * pagamento é uma linha em `Pagamentos_Revistas`, e o saldo é o total devido
 * menos a soma das baixas. A data-limite (em geral a lição 02 do próximo
 * trimestre) fica em `Trimestres_Revistas`, editável.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

/* ---------- categorias e preços ---------- */

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

// "Obreiros" foi removida do pedido, e "Jovens e Adultos" (a categoria juntada)
// também: Jovens e Adultos são classes SEPARADAS, com preços próprios.
const CATEGORIAS_OCULTAS = new Set(["obreiros", "jovenadult"]);

// Nome de exibição e ordem preferida — a lista que a secretaria usa.
const NOME_CATEGORIA: Record<string, string> = {
  jardim: "Jardim de Infância",
  juniores: "Juniores",
  primarios: "Primários",
  preadolesc: "Pré-Adolescentes",
  adolesc: "Adolescentes",
  juvenis: "Juvenis",
  jovens: "Jovens",
  adultos: "Adultos",
  maternal: "Maternal",
  bercario: "Berçário",
};
const ORDEM = Object.keys(NOME_CATEGORIA);

/* ---------- trimestre e data-limite ---------- */

function trimestreDe(hoje: Date): { chave: string; rotulo: string; q: number; ano: number } {
  const q = Math.floor(hoje.getMonth() / 3) + 1;
  const ano = hoje.getFullYear();
  return { chave: `${q}T-${ano}`, rotulo: `${q}º trimestre de ${ano}`, q, ano };
}

/** A data-limite padrão: 2º domingo do 1º mês do PRÓXIMO trimestre (≈ lição 02). */
function dataLimitePadrao(hoje: Date): Date {
  const q = Math.floor(hoje.getMonth() / 3) + 1;
  const mes = q === 4 ? 0 : q * 3; // 0-based: início do próximo trimestre
  const ano = q === 4 ? hoje.getFullYear() + 1 : hoje.getFullYear();
  const primeiro = new Date(Date.UTC(ano, mes, 1));
  const primeiroDomingo = 1 + ((7 - primeiro.getUTCDay()) % 7);
  return new Date(Date.UTC(ano, mes, primeiroDomingo + 7)); // 2º domingo
}

function soDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ *
 * GET — o pedido do trimestre, por congregação
 * ------------------------------------------------------------------ */

export async function GET() {
  const { sessao, recusa } = await exigirLeitura("revistas");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);
    const hoje = new Date();
    const tri = trimestreDe(hoje);

    const [classes, precos, pagamentos, config] = await Promise.all([
      prisma.classe.findMany({
        where: { ativa: true, congId: recorte },
        orderBy: [{ congId: "asc" }, { nome: "asc" }],
        select: {
          id: true, nome: true, tipoClasse: true, faixa: true,
          congregacao: { select: { id: true, nome: true } },
          _count: { select: { alunos: { where: { ativo: true } } } },
        },
      }),
      prisma.precoRevista.findMany({ orderBy: [{ categoria: "asc" }, { key: "asc" }] }),
      prisma.pagamentoRevista.findMany({
        where: { trimestre: tri.chave, ...(recorte ? { congId: recorte } : {}) },
        orderBy: { criadoEm: "desc" },
      }),
      prisma.trimestreRevista.findUnique({ where: { trimestre: tri.chave } }),
    ]);

    // Preço de referência (Revista do Aluno, capa comum) por categoria.
    const precoAlunoDe = new Map<string, number>();
    const porCategoria = new Map<string, { key: string; label: string; preco: number }[]>();
    for (const p of precos) {
      const cat = normalizar(p.categoria);
      const lista = porCategoria.get(cat) ?? [];
      lista.push({ key: p.key, label: p.label, preco: Number(p.preco) });
      porCategoria.set(cat, lista);
    }
    for (const [cat, lista] of porCategoria) {
      const comum = lista.find((x) => x.key === "aluno-comum");
      const alunoMin = lista.filter((x) => x.key.startsWith("aluno")).sort((a, b) => a.preco - b.preco)[0];
      const ref = comum ?? alunoMin ?? lista.sort((a, b) => a.preco - b.preco)[0];
      if (ref) precoAlunoDe.set(cat, ref.preco);
    }

    // Mini-tabela de preços (sem obreiros/jovenadult), na ordem preferida.
    const tabelaPrecos = [...porCategoria.keys()]
      .filter((c) => !CATEGORIAS_OCULTAS.has(c))
      .sort((a, b) => {
        const ia = ORDEM.indexOf(a), ib = ORDEM.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map((c) => {
        const lista = porCategoria.get(c)!;
        const preco = (k: string) => lista.find((x) => x.key === k)?.preco ?? null;
        return {
          categoria: c,
          rotulo: NOME_CATEGORIA[c] ?? c,
          aluno: preco("aluno-comum"),
          ampliada: preco("aluno-ampliada"),
          capaDura: preco("aluno-capa-dura"),
        };
      });

    // Baixas por congregação.
    const pagoPorCong = new Map<number, number>();
    const baixasPorCong = new Map<number, typeof pagamentos>();
    for (const p of pagamentos) {
      pagoPorCong.set(p.congId, (pagoPorCong.get(p.congId) ?? 0) + Number(p.valor));
      const l = baixasPorCong.get(p.congId) ?? [];
      l.push(p);
      baixasPorCong.set(p.congId, l);
    }

    // Agrupa as classes por congregação.
    interface Item {
      classeId: number; classe: string; faixa: string; categoria: string;
      categoriaRotulo: string; categoriaEncontrada: boolean;
      alunos: number; precoUnitario: number | null; subtotal: number;
    }
    const porCong = new Map<number, { id: number; nome: string; classes: Item[] }>();
    for (const c of classes) {
      const cong = c.congregacao;
      const cid = cong?.id ?? 0;
      const nome = cong?.nome?.trim() || (cong ? `Congregação ${cong.id}` : "Sem congregação");
      let g = porCong.get(cid);
      if (!g) { g = { id: cid, nome, classes: [] }; porCong.set(cid, g); }

      const cat = normalizar(c.tipoClasse ?? "");
      const preco = precoAlunoDe.get(cat) ?? null;
      const alunos = c._count.alunos;
      g.classes.push({
        classeId: c.id,
        classe: c.nome,
        faixa: c.faixa,
        categoria: cat,
        categoriaRotulo: NOME_CATEGORIA[cat] ?? c.tipoClasse ?? "—",
        categoriaEncontrada: preco !== null,
        alunos,
        precoUnitario: preco,
        subtotal: preco !== null ? Number((preco * alunos).toFixed(2)) : 0,
      });
    }

    const congregacoes = [...porCong.values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((g) => {
        const revistas = g.classes.reduce((s, c) => s + c.alunos, 0);
        const totalDevido = Number(g.classes.reduce((s, c) => s + c.subtotal, 0).toFixed(2));
        const pago = Number((pagoPorCong.get(g.id) ?? 0).toFixed(2));
        return {
          congId: g.id,
          nome: g.nome,
          revistas,
          totalDevido,
          pago,
          saldo: Number((totalDevido - pago).toFixed(2)),
          semPreco: g.classes.filter((c) => !c.categoriaEncontrada).length,
          classes: g.classes,
          pagamentos: (baixasPorCong.get(g.id) ?? []).map((p) => ({
            id: p.id,
            valor: Number(p.valor),
            observacao: p.observacao,
            autor: p.autor,
            criadoEm: p.criadoEm.toISOString(),
          })),
        };
      });

    const totalDevido = Number(congregacoes.reduce((s, c) => s + c.totalDevido, 0).toFixed(2));
    const totalPago = Number(congregacoes.reduce((s, c) => s + c.pago, 0).toFixed(2));
    const padrao = dataLimitePadrao(hoje);

    return {
      trimestre: tri,
      dataLimite: config?.dataLimite ? soDia(config.dataLimite) : soDia(padrao),
      dataLimitePadrao: soDia(padrao),
      dataLimiteDefinida: Boolean(config?.dataLimite),
      podeDefinirLimite: !recorte, // só o campo define a data-limite geral
      precos: tabelaPrecos,
      congregacoes,
      resumo: {
        revistas: congregacoes.reduce((s, c) => s + c.revistas, 0),
        totalDevido,
        totalPago,
        saldo: Number((totalDevido - totalPago).toFixed(2)),
      },
    };
  });
}

/* ------------------------------------------------------------------ *
 * POST — dar baixa (pagamento parcial) numa congregação
 * ------------------------------------------------------------------ */

export async function POST(req: Request) {
  const { sessao, recusa } = await exigirEscrita("revistas");
  if (recusa) return recusa;

  let corpo: { congId?: number; valor?: number; observacao?: string };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const { congId, valor } = corpo;
  const observacao = corpo.observacao?.trim() || null;
  if (!Number.isInteger(congId)) return erro("Informe a congregação.", 400);
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    return erro("Informe um valor de pagamento maior que zero.", 400);
  }

  // A secretária só dá baixa na SUA congregação.
  const recorte = recorteDaSessao(sessao);
  if (recorte && !recorte.in.includes(congId!)) {
    return erro("Esta congregação está fora do seu alcance.", 403);
  }

  const cong = await prisma.congregacao.findUnique({ where: { id: congId! }, select: { id: true, nome: true } });
  if (!cong) return erro("Congregação não encontrada.", 404);

  return responder(async () => {
    const tri = trimestreDe(new Date());
    const criado = await prisma.pagamentoRevista.create({
      data: {
        congId: congId!,
        trimestre: tri.chave,
        valor,
        observacao,
        autor: sessao ? sessao.nome || sessao.login : null,
      },
      select: { id: true },
    });

    registrar({
      sessao,
      acao: "CREATE",
      entidade: "Pagamentos_Revistas",
      descricao:
        `Baixa de R$ ${valor.toFixed(2)} no pedido de ${cong.nome?.trim() || `Congregação ${cong.id}`}` +
        (observacao ? ` (${observacao})` : "") + ` — ${tri.rotulo}.`,
      congId: congId!,
    });

    return { ok: true, id: criado.id };
  });
}

/* ------------------------------------------------------------------ *
 * DELETE — desfazer uma baixa
 * ------------------------------------------------------------------ */

export async function DELETE(req: Request) {
  const { sessao, recusa } = await exigirEscrita("revistas");
  if (recusa) return recusa;

  const id = lerInt(new URL(req.url), "id");
  if (id === null) return erro("Informe a baixa a desfazer.", 400);

  const pag = await prisma.pagamentoRevista.findUnique({ where: { id } });
  if (!pag) return erro("Baixa não encontrada.", 404);

  const recorte = recorteDaSessao(sessao);
  if (recorte && !recorte.in.includes(pag.congId)) {
    return erro("Esta baixa está fora do seu alcance.", 403);
  }

  return responder(async () => {
    await prisma.pagamentoRevista.delete({ where: { id } });
    registrar({
      sessao,
      acao: "DELETE",
      entidade: "Pagamentos_Revistas",
      descricao: `Baixa de R$ ${Number(pag.valor).toFixed(2)} desfeita.`,
      congId: pag.congId,
    });
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ *
 * PUT — definir a data-limite do trimestre (decisão do campo)
 * ------------------------------------------------------------------ */

export async function PUT(req: Request) {
  const { sessao, recusa } = await exigirEscrita("revistas");
  if (recusa) return recusa;

  // A data-limite é geral do campo — uma secretária de congregação não a define.
  if (recorteDaSessao(sessao)) {
    return erro("Só a administração do campo define a data-limite.", 403);
  }

  let corpo: { dataLimite?: string | null };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const valor = corpo.dataLimite;
  if (valor !== null && (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor))) {
    return erro("Data inválida.", 400);
  }

  return responder(async () => {
    const tri = trimestreDe(new Date());
    const data = valor ? new Date(`${valor}T00:00:00Z`) : null;
    await prisma.trimestreRevista.upsert({
      where: { trimestre: tri.chave },
      create: { trimestre: tri.chave, dataLimite: data },
      update: { dataLimite: data },
    });
    registrar({
      sessao,
      acao: "UPDATE",
      entidade: "Trimestres_Revistas",
      descricao: valor
        ? `Data-limite do ${tri.rotulo} definida para ${valor}.`
        : `Data-limite do ${tri.rotulo} voltou ao padrão.`,
    });
    return { ok: true, dataLimite: valor };
  });
}
