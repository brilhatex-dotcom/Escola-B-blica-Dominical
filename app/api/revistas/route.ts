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
import {
  agruparPrecos,
  CATEGORIAS_OCULTAS,
  NOME_CATEGORIA,
  normalizarCategoria,
  ORDEM_CATEGORIAS,
  precoAlunoDeLista,
  precoProfessorDeLista,
} from "@/lib/revistas/precos";
import {
  dataLimitePadraoDoTrimestre,
  proximoTrimestre,
  soDia,
  trimestreDaChave,
  trimestreDe,
  trimestreValido,
} from "@/lib/revistas/trimestre";

/**
 * Pedido de Lição — o que cada congregação pediu de verdade, quanto custa, e
 * quanto já foi pago.
 *
 * ============================================================================
 * O PEDIDO É DIGITADO E CONFIRMADO (FASE 15b) — O QUE ESTA ROTA CALCULA É A
 * SUGESTÃO, NÃO MAIS O TOTAL A PAGAR
 *
 * Até a Fase 15a, o total de cada congregação era calculado sozinho (alunos
 * ativos × preço da categoria) — não existia o momento de "a congregação
 * decidiu e mandou o pedido de verdade". A Fase 15b criou esse momento em
 * `/api/revistas/pedido`: lá a secretaria digita a quantidade de cada
 * categoria e CONFIRMA, o que trava a quantidade e o preço daquele instante.
 *
 * Esta rota (`/api/revistas`) continua calculando a mesma conta de antes, mas
 * agora só como SUGESTÃO (`sugestao` em cada congregação) — o número que a
 * secretaria vê antes de digitar o pedido. O `totalDevido` usado para
 * situação, saldo e alertas vem do `PedidoRevista` CONFIRMADO do trimestre;
 * sem confirmação, é zero. Uma congregação sem pedido confirmado está em
 * "sem-pedido" de verdade, não "aguardando calcular".
 * ============================================================================
 */
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ *
 * GET — o pedido do trimestre, por congregação
 * ------------------------------------------------------------------ */

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("revistas");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);
    const hoje = new Date();
    const url = new URL(req.url);
    // A tela normalmente olha o trimestre em andamento (o que está sendo
    // pago), mas o seletor de trimestre deixa escolher qualquer um dos
    // quatro mostrados — "proximo" continua reconhecido por compatibilidade.
    const paramTri = url.searchParams.get("trimestre");
    const tri =
      paramTri === "proximo"
        ? proximoTrimestre(hoje)
        : paramTri && trimestreValido(paramTri)
          ? trimestreDaChave(paramTri)
          : trimestreDe(hoje);

    const [classes, precos, pagamentos, config, pedidos] = await Promise.all([
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
      prisma.pedidoRevista.findMany({
        where: { trimestre: tri.chave, ...(recorte ? { congId: recorte } : {}) },
        include: { itens: true, congregacao: { select: { id: true, nome: true } } },
      }),
    ]);

    // Preço de referência (Revista do Aluno, capa comum) por categoria — e o
    // mesmo para a Revista do Professor, que a tabela de preços já tinha e o
    // cálculo antigo não somava.
    const porCategoria = agruparPrecos(
      precos.map((p) => ({ key: p.key, categoria: p.categoria, label: p.label, preco: Number(p.preco) })),
    );
    const precoAlunoDe = new Map<string, number>();
    const precoProfessorDe = new Map<string, number>();
    for (const [cat, lista] of porCategoria) {
      const ref = precoAlunoDeLista(lista);
      if (ref !== null) precoAlunoDe.set(cat, ref);
      const refProf = precoProfessorDeLista(lista);
      if (refProf !== null) precoProfessorDe.set(cat, refProf);
    }

    // Mini-tabela de preços (sem obreiros/jovenadult), na ordem preferida.
    const tabelaPrecos = [...porCategoria.keys()]
      .filter((c) => !CATEGORIAS_OCULTAS.has(c))
      .sort((a, b) => {
        const ia = ORDEM_CATEGORIAS.indexOf(a), ib = ORDEM_CATEGORIAS.indexOf(b);
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

    // Pedidos (o registro de verdade) por congregação.
    const pedidoPorCong = new Map<number, (typeof pedidos)[number]>();
    for (const p of pedidos) pedidoPorCong.set(p.congId, p);

    // Agrupa as classes por congregação — a SUGESTÃO calculada, não o pedido.
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

      const cat = normalizarCategoria(c.tipoClasse ?? "");
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
    // Congregações que já têm pedido (rascunho ou confirmado) mas nenhuma
    // classe ativa entram também — senão o pedido some da lista.
    for (const p of pedidos) {
      if (!porCong.has(p.congId)) {
        const nome = p.congregacao.nome?.trim() || `Congregação ${p.congId}`;
        porCong.set(p.congId, { id: p.congId, nome, classes: [] });
      }
    }

    const dataLimitePagamento = config?.dataLimite ?? dataLimitePadraoDoTrimestre(tri);
    const dataLimitePedido = config?.dataLimitePedido ?? null;

    const congregacoes = [...porCong.values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((g) => {
        // A sugestão: o que o cálculo automático (alunos/professores ativos)
        // aponta — só para comparação, nunca o valor a pagar.
        const revistasSugeridas = g.classes.reduce((s, c) => s + c.alunos + c.professores, 0);
        const totalSugerido = Number(
          g.classes.reduce((s, c) => s + c.subtotal + c.subtotalProfessor, 0).toFixed(2),
        );

        const pedido = pedidoPorCong.get(g.id) ?? null;
        const totalPedido = pedido
          ? Number(pedido.itens.reduce((s, it) => s + it.quantidade * Number(it.precoUnitario), 0).toFixed(2))
          : 0;
        const revistasPedidas = pedido ? pedido.itens.reduce((s, it) => s + it.quantidade, 0) : 0;

        // O que conta para pagamento/situação é o PEDIDO CONFIRMADO — sem
        // confirmação, é zero: a congregação está em "sem-pedido" de verdade.
        const totalDevido = pedido?.confirmado ? totalPedido : 0;
        const pago = Number((pagoPorCong.get(g.id) ?? 0).toFixed(2));
        const saldo = Number((totalDevido - pago).toFixed(2));
        return {
          congId: g.id,
          nome: g.nome,
          revistas: pedido?.confirmado ? revistasPedidas : 0,
          totalDevido,
          pago,
          saldo,
          situacao: situacaoDaCongregacao({ hoje, totalDevido, pago, dataLimitePagamento }),
          pedido: pedido
            ? {
                confirmado: pedido.confirmado,
                confirmadoEm: pedido.confirmadoEm?.toISOString() ?? null,
                confirmadoPor: pedido.confirmadoPor,
                total: totalPedido,
                revistas: revistasPedidas,
              }
            : null,
          sugestao: { revistas: revistasSugeridas, total: totalSugerido },
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
    const padrao = dataLimitePadraoDoTrimestre(tri);

    // As três contagens do painel — "sem-pedido" (nenhum pedido CONFIRMADO
    // no trimestre) fica de fora das três, porque não há o que pagar ainda.
    const comPedido = congregacoes.filter((c) => c.totalDevido > 0);
    const congregacoesPagas = comPedido.filter((c) => c.situacao === "quitado").length;
    const congregacoesAtrasadas = comPedido.filter((c) => c.situacao === "atraso").length;
    const congregacoesPendentes = comPedido.length - congregacoesPagas - congregacoesAtrasadas;
    const congregacoesSemPedido = congregacoes.length - comPedido.length;

    const diasPrazoPagamento = diasRestantes(hoje, dataLimitePagamento);
    const diasPrazoPedido = dataLimitePedido ? diasRestantes(hoje, dataLimitePedido) : null;

    return {
      trimestre: { ...tri, tema: config?.tema ?? null },
      trimestreProximo: proximoTrimestre(hoje).chave,
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
      // Alertas só olham congregações com pedido CONFIRMADO E que o acesso
      // atual alcança — a mesma lista que o recorte já filtrou acima.
      alertas: gerarAlertasRevistas(
        congregacoes.map((c) => ({ congId: c.congId, nome: c.nome, totalDevido: c.totalDevido, pago: c.pago, saldo: c.saldo })),
        { hoje, dataLimitePagamento, dataLimitePedido },
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

  let corpo: { trimestre?: string; dataLimite?: string | null; dataLimitePedido?: string | null; tema?: string | null };
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
    // O tema e os prazos são do trimestre que a pessoa está OLHANDO na tela
    // (o seletor deixa escolher qualquer um dos quatro mostrados) — sem
    // `trimestre` no corpo, cai no atual, como sempre foi.
    const tri =
      corpo.trimestre && trimestreValido(corpo.trimestre) ? trimestreDaChave(corpo.trimestre) : trimestreDe(new Date());
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
