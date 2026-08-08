import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";
import {
  agruparPrecos,
  CATEGORIAS_OCULTAS,
  NOME_CATEGORIA,
  normalizarCategoria,
  ORDEM_CATEGORIAS,
  precoAlunoDeLista,
  precoProfessorDeLista,
} from "@/lib/revistas/precos";
import { calcularTotalPedido, calcularTotalRevistas, tipoValido, validarQuantidade } from "@/lib/revistas/pedidoCalculo";
import { resolverTrimestre } from "@/lib/revistas/trimestre";

/**
 * Fazer Pedido — a congregação digita a quantidade de cada categoria e
 * CONFIRMA, travando quantidade e preço daquele momento.
 *
 * ============================================================================
 * ABRE NO PRÓXIMO TRIMESTRE, NÃO NO ATUAL
 *
 * A CPAD precisa de tempo para imprimir e enviar — na prática, a congregação
 * pede o material do trimestre seguinte enquanto ainda está no atual. Por
 * isso `?trimestre=` aqui aceita "atual" ou "proximo" e o padrão é
 * "proximo" — o contrário do painel financeiro (`/api/revistas`), que olha o
 * trimestre em andamento por padrão. As duas rotas usam a MESMA chave de
 * trimestre ("3T-2026"), só trocam qual delas é o padrão.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

async function carregarPrecos() {
  const precos = await prisma.precoRevista.findMany();
  return agruparPrecos(precos.map((p) => ({ key: p.key, categoria: p.categoria, label: p.label, preco: Number(p.preco) })));
}

function categoriasValidas() {
  return ORDEM_CATEGORIAS.filter((c) => !CATEGORIAS_OCULTAS.has(c));
}

/* ------------------------------------------------------------------ *
 * GET — o pedido (rascunho ou confirmado) + a sugestão calculada
 * ------------------------------------------------------------------ */

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("revistas");
  if (recusa) return recusa;

  const url = new URL(req.url);
  const congId = Number(url.searchParams.get("congId"));
  if (!Number.isInteger(congId) || congId <= 0) return erro("Informe a congregação.", 400);

  const recorte = recorteDaSessao(sessao);
  if (recorte && !recorte.in.includes(congId)) {
    return erro("Esta congregação está fora do seu alcance.", 403);
  }

  return responder(async () => {
    const hoje = new Date();
    const tri = resolverTrimestre(hoje, url.searchParams.get("trimestre"));

    const [cong, porCategoria, pedido, classes] = await Promise.all([
      prisma.congregacao.findUnique({ where: { id: congId }, select: { id: true, nome: true } }),
      carregarPrecos(),
      prisma.pedidoRevista.findUnique({
        where: { congId_trimestre: { congId, trimestre: tri.chave } },
        include: { itens: true },
      }),
      prisma.classe.findMany({
        where: { ativa: true, congId },
        select: {
          tipoClasse: true,
          _count: { select: { alunos: { where: { ativo: true } } } },
          pessoaCargos: { where: { ativo: true, cargo: { nome: "Professor" } }, select: { id: true } },
        },
      }),
    ]);
    if (!cong) return erro("Congregação não encontrada.", 404);

    // Sugestão: alunos/professores ativos por categoria — só para comparação.
    const sugestaoAlunos = new Map<string, number>();
    const sugestaoProfessores = new Map<string, number>();
    for (const c of classes) {
      const cat = normalizarCategoria(c.tipoClasse ?? "");
      sugestaoAlunos.set(cat, (sugestaoAlunos.get(cat) ?? 0) + c._count.alunos);
      sugestaoProfessores.set(cat, (sugestaoProfessores.get(cat) ?? 0) + c.pessoaCargos.length);
    }

    const itemSalvo = new Map<string, { quantidade: number; precoUnitario: number }>();
    for (const it of pedido?.itens ?? []) {
      itemSalvo.set(`${it.categoria}|${it.tipo}`, { quantidade: it.quantidade, precoUnitario: Number(it.precoUnitario) });
    }

    const linhas = categoriasValidas().flatMap((cat) => {
      const lista = porCategoria.get(cat) ?? [];
      const precoAluno = precoAlunoDeLista(lista);
      const precoProfessor = precoProfessorDeLista(lista);
      return [
        {
          categoria: cat,
          categoriaRotulo: NOME_CATEGORIA[cat] ?? cat,
          tipo: "aluno" as const,
          precoUnitario: itemSalvo.get(`${cat}|aluno`)?.precoUnitario ?? precoAluno,
          quantidade: itemSalvo.get(`${cat}|aluno`)?.quantidade ?? 0,
          sugestao: sugestaoAlunos.get(cat) ?? 0,
        },
        {
          categoria: cat,
          categoriaRotulo: NOME_CATEGORIA[cat] ?? cat,
          tipo: "professor" as const,
          precoUnitario: itemSalvo.get(`${cat}|professor`)?.precoUnitario ?? precoProfessor,
          quantidade: itemSalvo.get(`${cat}|professor`)?.quantidade ?? 0,
          sugestao: sugestaoProfessores.get(cat) ?? 0,
        },
      ];
    });

    return {
      id: pedido?.id ?? null,
      congId: cong.id,
      congNome: cong.nome?.trim() || `Congregação ${cong.id}`,
      trimestre: tri,
      confirmado: pedido?.confirmado ?? false,
      confirmadoEm: pedido?.confirmadoEm?.toISOString() ?? null,
      confirmadoPor: pedido?.confirmadoPor ?? null,
      // Só a administração do campo pode reabrir um pedido já confirmado —
      // mesma regra do POST abaixo.
      podeReabrir: !recorte,
      linhas,
      total: calcularTotalPedido(pedido?.itens.map((it) => ({ quantidade: it.quantidade, precoUnitario: Number(it.precoUnitario) })) ?? []),
      revistas: calcularTotalRevistas(pedido?.itens ?? []),
    };
  });
}

/* ------------------------------------------------------------------ *
 * PUT — salvar o rascunho (só antes de confirmar)
 * ------------------------------------------------------------------ */

interface ItemEntrada { categoria?: string; tipo?: string; quantidade?: unknown }

export async function PUT(req: Request) {
  const { sessao, recusa } = await exigirEscrita("revistas");
  if (recusa) return recusa;

  let corpo: { congId?: number; trimestre?: string; itens?: ItemEntrada[] };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const { congId } = corpo;
  if (!Number.isInteger(congId) || congId! <= 0) return erro("Informe a congregação.", 400);
  if (!Array.isArray(corpo.itens)) return erro("Informe os itens do pedido.", 400);

  const recorte = recorteDaSessao(sessao);
  if (recorte && !recorte.in.includes(congId!)) {
    return erro("Esta congregação está fora do seu alcance.", 403);
  }

  const cong = await prisma.congregacao.findUnique({ where: { id: congId! }, select: { id: true, nome: true } });
  if (!cong) return erro("Congregação não encontrada.", 404);

  const categoriasOk = new Set(categoriasValidas());
  const itensValidados: { categoria: string; tipo: "aluno" | "professor"; quantidade: number }[] = [];
  for (const it of corpo.itens) {
    if (typeof it.categoria !== "string" || !categoriasOk.has(it.categoria)) {
      return erro(`Categoria inválida: "${it.categoria}".`, 400);
    }
    if (!tipoValido(it.tipo)) return erro(`Tipo inválido: "${it.tipo}".`, 400);
    const quantidade = validarQuantidade(it.quantidade);
    if (quantidade === null) return erro(`Quantidade inválida em ${NOME_CATEGORIA[it.categoria]} (${it.tipo}).`, 400);
    itensValidados.push({ categoria: it.categoria, tipo: it.tipo, quantidade });
  }

  return responder(async () => {
    const hoje = new Date();
    const tri = resolverTrimestre(hoje, corpo.trimestre ?? null);

    const existente = await prisma.pedidoRevista.findUnique({
      where: { congId_trimestre: { congId: congId!, trimestre: tri.chave } },
    });
    if (existente?.confirmado) {
      return erro("Este pedido já foi confirmado. Reabra para editar.", 409);
    }

    const porCategoria = await carregarPrecos();
    const linhasComPreco = itensValidados
      .filter((it) => it.quantidade > 0)
      .map((it) => {
        const lista = porCategoria.get(it.categoria) ?? [];
        const preco = it.tipo === "aluno" ? precoAlunoDeLista(lista) : precoProfessorDeLista(lista);
        return { ...it, precoUnitario: preco ?? 0 };
      });

    const pedido = await prisma.$transaction(async (tx) => {
      const p = await tx.pedidoRevista.upsert({
        where: { congId_trimestre: { congId: congId!, trimestre: tri.chave } },
        create: { congId: congId!, trimestre: tri.chave },
        update: {},
      });
      await tx.pedidoRevistaItem.deleteMany({ where: { pedidoId: p.id } });
      if (linhasComPreco.length > 0) {
        await tx.pedidoRevistaItem.createMany({
          data: linhasComPreco.map((it) => ({
            pedidoId: p.id,
            categoria: it.categoria,
            tipo: it.tipo,
            quantidade: it.quantidade,
            precoUnitario: it.precoUnitario,
          })),
        });
      }
      return p;
    });

    return {
      ok: true,
      total: calcularTotalPedido(linhasComPreco),
      revistas: calcularTotalRevistas(linhasComPreco),
      pedidoId: pedido.id,
    };
  });
}

/* ------------------------------------------------------------------ *
 * POST — confirmar (trava) ou reabrir (só o campo) o pedido
 * ------------------------------------------------------------------ */

export async function POST(req: Request) {
  const { sessao, recusa } = await exigirEscrita("revistas");
  if (recusa) return recusa;

  let corpo: { congId?: number; trimestre?: string; acao?: string };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const { congId, acao } = corpo;
  if (!Number.isInteger(congId) || congId! <= 0) return erro("Informe a congregação.", 400);
  if (acao !== "confirmar" && acao !== "reabrir") return erro("Ação inválida.", 400);

  const recorte = recorteDaSessao(sessao);
  if (recorte && !recorte.in.includes(congId!)) {
    return erro("Esta congregação está fora do seu alcance.", 403);
  }
  // Reabrir um pedido já confirmado é decisão do campo — evita que uma
  // secretária local desfaça sozinha um pedido que já foi enviado à CPAD.
  if (acao === "reabrir" && recorte) {
    return erro("Só a administração do campo pode reabrir um pedido confirmado.", 403);
  }

  const cong = await prisma.congregacao.findUnique({ where: { id: congId! }, select: { id: true, nome: true } });
  if (!cong) return erro("Congregação não encontrada.", 404);
  const nomeCong = cong.nome?.trim() || `Congregação ${cong.id}`;

  return responder(async () => {
    const hoje = new Date();
    const tri = resolverTrimestre(hoje, corpo.trimestre ?? null);

    const pedido = await prisma.pedidoRevista.findUnique({
      where: { congId_trimestre: { congId: congId!, trimestre: tri.chave } },
      include: { itens: true },
    });

    if (acao === "confirmar") {
      if (!pedido || pedido.itens.length === 0) {
        return erro("Nada para confirmar — preencha ao menos uma quantidade antes.", 400);
      }
      if (pedido.confirmado) return erro("Este pedido já está confirmado.", 400);

      const autor = sessao ? sessao.nome || sessao.login : null;
      await prisma.pedidoRevista.update({
        where: { id: pedido.id },
        data: { confirmado: true, confirmadoEm: hoje, confirmadoPor: autor },
      });

      const total = calcularTotalPedido(pedido.itens.map((it) => ({ quantidade: it.quantidade, precoUnitario: Number(it.precoUnitario) })));
      registrar({
        sessao,
        acao: "UPDATE",
        entidade: "Pedidos_Revistas",
        descricao: `Pedido de revistas de ${nomeCong} confirmado — ${tri.rotulo}, ${calcularTotalRevistas(pedido.itens)} revista(s), R$ ${total.toFixed(2)}.`,
        congId: congId!,
      });
      return { ok: true, confirmado: true, id: pedido.id };
    }

    // reabrir
    if (!pedido || !pedido.confirmado) return erro("Este pedido não está confirmado.", 400);
    await prisma.pedidoRevista.update({
      where: { id: pedido.id },
      data: { confirmado: false, confirmadoEm: null, confirmadoPor: null },
    });
    registrar({
      sessao,
      acao: "UPDATE",
      entidade: "Pedidos_Revistas",
      descricao: `Pedido de revistas de ${nomeCong} reaberto para edição — ${tri.rotulo}.`,
      congId: congId!,
    });
    return { ok: true, confirmado: false };
  });
}
