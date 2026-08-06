import { prisma } from "@/lib/prisma";
import { erro, lerInt, responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";
import {
  diasRestantes,
  gerarAlertasRevistas,
  nivelDoPrazo,
  situacaoDaCongregacao,
  situacaoDoTrimestre,
} from "@/lib/revistas/situacao";

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
          pessoaCargos: {
            where: { ativo: true, cargo: { nome: "Professor" } },
            select: { id: true },
          },
        },
      }),
      prisma.precoRevista.findMany({ orderBy: [{ categoria: "asc" }, { key: "asc" }] }),
      prisma.pagamentoRevista.findMany({
        where: { trimestre: tri.chave, ...(recorte ? { congId: recorte } : {}) },
        orderBy: { criadoEm: "desc" },
      }),
      prisma.trimestreRevista.findUnique({ where: { trimestre: tri.chave } }),
    ]);

    // Preço de referência (Revista do Aluno, capa comum) por categoria — e o
    // mesmo para a Revista do Professor ("mestre-*"), que a tabela de preços
    // já tinha e o pedido nunca somava.
    const precoAlunoDe = new Map<string, number>();
    const precoProfessorDe = new Map<string, number>();
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

      const mestreComum = lista.find((x) => x.key === "mestre-comum");
      const mestreMin = lista.filter((x) => x.key.startsWith("mestre")).sort((a, b) => a.preco - b.preco)[0];
      const refProf = mestreComum ?? mestreMin;
      if (refProf) precoProfessorDe.set(cat, refProf.preco);
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
      professores: number; precoProfessor: number | null; subtotalProfessor: number;
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
      const precoProf = precoProfessorDe.get(cat) ?? null;
      const professores = c.pessoaCargos.length;
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
        professores,
        precoProfessor: precoProf,
        subtotalProfessor: precoProf !== null ? Number((precoProf * professores).toFixed(2)) : 0,
      });
    }

    const dataLimitePagamento = config?.dataLimite ?? dataLimitePadrao(hoje);
    const dataLimitePedido = config?.dataLimitePedido ?? null;

    const congregacoes = [...porCong.values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((g) => {
        // "Revistas" conta aluno + professor: as duas são revistas pedidas de
        // verdade, não só a do aluno.
        const revistas = g.classes.reduce((s, c) => s + c.alunos + c.professores, 0);
        const totalDevido = Number(
          g.classes.reduce((s, c) => s + c.subtotal + c.subtotalProfessor, 0).toFixed(2),
        );
        const pago = Number((pagoPorCong.get(g.id) ?? 0).toFixed(2));
        const saldo = Number((totalDevido - pago).toFixed(2));
        return {
          congId: g.id,
          nome: g.nome,
          revistas,
          totalDevido,
          pago,
          saldo,
          situacao: situacaoDaCongregacao({ hoje, totalDevido, pago, dataLimitePagamento }),
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
    const saldoTotal = Number((totalDevido - totalPago).toFixed(2));
    const padrao = dataLimitePadrao(hoje);

    // As três contagens do painel — "sem-pedido" (nenhuma classe/aluno ativo
    // no trimestre) fica de fora das três, porque não há o que pagar.
    const comPedido = congregacoes.filter((c) => c.totalDevido > 0);
    const congregacoesPagas = comPedido.filter((c) => c.situacao === "quitado").length;
    const congregacoesAtrasadas = comPedido.filter((c) => c.situacao === "atraso").length;
    const congregacoesPendentes = comPedido.length - congregacoesPagas - congregacoesAtrasadas;
    const congregacoesSemPedido = congregacoes.length - comPedido.length;

    const diasPrazoPagamento = diasRestantes(hoje, dataLimitePagamento);
    const diasPrazoPedido = dataLimitePedido ? diasRestantes(hoje, dataLimitePedido) : null;

    return {
      trimestre: { ...tri, tema: config?.tema ?? null },
      dataLimite: soDia(dataLimitePagamento),
      dataLimitePadrao: soDia(padrao),
      dataLimiteDefinida: Boolean(config?.dataLimite),
      dataLimitePagamento: soDia(dataLimitePagamento),
      dataLimitePedido: dataLimitePedido ? soDia(dataLimitePedido) : null,
      podeDefinirLimite: !recorte, // só o campo define os prazos e o tema
      prazos: {
        pagamento: { dias: diasPrazoPagamento, nivel: nivelDoPrazo(diasPrazoPagamento) },
        pedido: diasPrazoPedido !== null ? { dias: diasPrazoPedido, nivel: nivelDoPrazo(diasPrazoPedido) } : null,
      },
      situacao: situacaoDoTrimestre({
        hoje, totalDevido, saldo: saldoTotal, dataLimitePedido, dataLimitePagamento,
      }),
      precos: tabelaPrecos,
      congregacoes,
      resumo: {
        revistas: congregacoes.reduce((s, c) => s + c.revistas, 0),
        congregacoes: congregacoes.length,
        totalDevido,
        totalPago,
        saldo: saldoTotal,
        percentualPago: totalDevido > 0 ? Math.round((totalPago / totalDevido) * 1000) / 10 : null,
        congregacoesPagas,
        congregacoesPendentes,
        congregacoesAtrasadas,
        congregacoesSemPedido,
      },
      // Alertas só olham congregações com pedido de verdade E que o acesso
      // atual alcança — a mesma lista que o recorte já filtrou acima.
      alertas: gerarAlertasRevistas(
        congregacoes.map((c) => ({ congId: c.congId, nome: c.nome, totalDevido: c.totalDevido, pago: c.pago, saldo: c.saldo })),
        { hoje, dataLimitePagamento },
      ),
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
 * PUT — definir tema, prazo de pedido e prazo de pagamento do trimestre
 * (decisão do campo — cada campo é opcional e só muda o que veio no corpo)
 * ------------------------------------------------------------------ */

function validarData(valor: unknown, rotulo: string): string | null | undefined {
  if (valor === undefined) return undefined; // não veio — não mexe
  if (valor === null) return null; // veio explicitamente para apagar
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new Error(`${rotulo} inválida.`);
  }
  return valor;
}

export async function PUT(req: Request) {
  const { sessao, recusa } = await exigirEscrita("revistas");
  if (recusa) return recusa;

  // Tema e prazos são gerais do campo — uma secretária de congregação não os define.
  if (recorteDaSessao(sessao)) {
    return erro("Só a administração do campo define o tema e os prazos.", 403);
  }

  let corpo: { dataLimite?: string | null; dataLimitePedido?: string | null; tema?: string | null };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  let dataLimite: string | null | undefined;
  let dataLimitePedido: string | null | undefined;
  try {
    dataLimite = validarData(corpo.dataLimite, "Data-limite de pagamento");
    dataLimitePedido = validarData(corpo.dataLimitePedido, "Data-limite de pedido");
  } catch (e) {
    return erro((e as Error).message, 400);
  }
  const tema = corpo.tema === undefined ? undefined : (corpo.tema?.trim() || null);

  if (dataLimite === undefined && dataLimitePedido === undefined && tema === undefined) {
    return erro("Nada para atualizar.", 400);
  }

  return responder(async () => {
    const tri = trimestreDe(new Date());
    const dados: { dataLimite?: Date | null; dataLimitePedido?: Date | null; tema?: string | null } = {};
    if (dataLimite !== undefined) dados.dataLimite = dataLimite ? new Date(`${dataLimite}T00:00:00Z`) : null;
    if (dataLimitePedido !== undefined) {
      dados.dataLimitePedido = dataLimitePedido ? new Date(`${dataLimitePedido}T00:00:00Z`) : null;
    }
    if (tema !== undefined) dados.tema = tema;

    await prisma.trimestreRevista.upsert({
      where: { trimestre: tri.chave },
      create: { trimestre: tri.chave, ...dados },
      update: dados,
    });

    const partes: string[] = [];
    if (dataLimite !== undefined) partes.push(dataLimite ? `prazo de pagamento em ${dataLimite}` : "prazo de pagamento voltou ao padrão");
    if (dataLimitePedido !== undefined) partes.push(dataLimitePedido ? `prazo de pedido em ${dataLimitePedido}` : "prazo de pedido removido");
    if (tema !== undefined) partes.push(tema ? `tema "${tema}"` : "tema removido");

    registrar({
      sessao,
      acao: "UPDATE",
      entidade: "Trimestres_Revistas",
      descricao: `${tri.rotulo}: ${partes.join(", ")}.`,
    });
    return { ok: true, dataLimite, dataLimitePedido, tema };
  });
}
