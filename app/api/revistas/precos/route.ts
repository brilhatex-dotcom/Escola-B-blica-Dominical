import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";
import { NOME_CATEGORIA, ORDEM_CATEGORIAS } from "@/lib/revistas/precos";

/**
 * A tabela de preços das revistas — quem pode ver o pedido pode ver os
 * preços (já aparecem no assistente); só a administração do campo pode
 * MUDAR um valor. Um preço mudado aqui vale para o próximo pedido digitado
 * — pedidos já salvos guardam o preço de quando foram gravados
 * (`PedidoRevistaItem.precoUnitario`), de propósito (ver o comentário no
 * schema). Corrigir um trimestre inteiro já confirmado é ação deliberada,
 * feita à parte por quem administra o banco — não um efeito colateral de
 * mexer aqui.
 */
export const dynamic = "force-dynamic";

const CATEGORIAS_OK = new Set(ORDEM_CATEGORIAS);
/** Letras minúsculas, números e hífen — o mesmo formato de toda `key` já cadastrada. */
const CHAVE_VALIDA = /^[a-z][a-z0-9-]{1,40}$/;

export async function GET() {
  const { recusa } = await exigirLeitura("revistas");
  if (recusa) return recusa;

  return responder(async () => {
    const precos = await prisma.precoRevista.findMany({ orderBy: [{ categoria: "asc" }, { key: "asc" }] });
    return {
      podeEditar: false, // a tela decide de verdade pela sessão; isto é só para telas que não checam
      categorias: ORDEM_CATEGORIAS.map((c) => ({ chave: c, rotulo: NOME_CATEGORIA[c] ?? c })),
      precos: precos.map((p) => ({ key: p.key, categoria: p.categoria, label: p.label, preco: Number(p.preco) })),
    };
  });
}

interface CorpoPreco {
  categoria?: string;
  key?: string;
  label?: string;
  preco?: number;
}

function validarCorpo(corpo: CorpoPreco): string | null {
  if (typeof corpo.categoria !== "string" || !CATEGORIAS_OK.has(corpo.categoria)) {
    return "Categoria inválida.";
  }
  if (typeof corpo.key !== "string" || !CHAVE_VALIDA.test(corpo.key)) {
    return "A chave da modalidade deve ter só letras minúsculas, números e hífen (ex.: aluno-comum).";
  }
  if (typeof corpo.label !== "string" || !corpo.label.trim()) {
    return "Informe o texto que aparece na tela.";
  }
  if (typeof corpo.preco !== "number" || !Number.isFinite(corpo.preco) || corpo.preco < 0) {
    return "Informe um preço válido (zero ou mais).";
  }
  return null;
}

/* PUT — cria ou atualiza uma modalidade (categoria + key são a chave). */
export async function PUT(req: Request) {
  const { sessao, recusa } = await exigirEscrita("revistas");
  if (recusa) return recusa;
  if (recorteDaSessao(sessao)) {
    return erro("Só a administração do campo edita os preços das revistas.", 403);
  }

  let corpo: CorpoPreco;
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const problema = validarCorpo(corpo);
  if (problema) return erro(problema, 400);

  return responder(async () => {
    const { categoria, key, label, preco } = corpo as Required<CorpoPreco>;
    const existia = await prisma.precoRevista.findUnique({ where: { key_categoria: { key, categoria } } });

    await prisma.precoRevista.upsert({
      where: { key_categoria: { key, categoria } },
      create: { key, categoria, label: label.trim(), preco },
      update: { label: label.trim(), preco },
    });

    registrar({
      sessao,
      acao: existia ? "UPDATE" : "CREATE",
      entidade: "Precos_Revistas",
      descricao: existia
        ? `Preço de "${label.trim()}" (${NOME_CATEGORIA[categoria] ?? categoria}) alterado de R$ ${Number(existia.preco).toFixed(2)} para R$ ${preco.toFixed(2)}.`
        : `Nova modalidade "${label.trim()}" (${NOME_CATEGORIA[categoria] ?? categoria}) cadastrada a R$ ${preco.toFixed(2)}.`,
    });

    return { ok: true };
  });
}

/* DELETE — remove uma modalidade. Recusa se algum pedido já a usou, para
 * não fazer uma linha sumir da tela de um pedido antigo — ver o comentário
 * grande no topo do arquivo. */
export async function DELETE(req: Request) {
  const { sessao, recusa } = await exigirEscrita("revistas");
  if (recusa) return recusa;
  if (recorteDaSessao(sessao)) {
    return erro("Só a administração do campo edita os preços das revistas.", 403);
  }

  const url = new URL(req.url);
  const categoria = url.searchParams.get("categoria") ?? "";
  const key = url.searchParams.get("key") ?? "";
  if (!CATEGORIAS_OK.has(categoria) || !key) return erro("Informe a modalidade a remover.", 400);

  /*
   * As duas checagens abaixo ficam FORA do `responder()` de propósito:
   * `responder` faz `NextResponse.json(await fn())`, então um `erro(...)`
   * (que É um `NextResponse`) devolvido de DENTRO do callback é serializado
   * como dado comum — vira `{}` com status 200 em vez do erro real. E
   * `throw` também não ajuda: o `catch` de `responder` sempre troca a
   * mensagem por uma genérica e o status por 500, apagando exatamente a
   * explicação que a secretária precisa ler. A única forma de mandar um
   * erro específico é devolvê-lo ANTES de entrar no `responder`.
   */
  const preco = await prisma.precoRevista.findUnique({ where: { key_categoria: { key, categoria } } });
  if (!preco) return erro("Modalidade não encontrada.", 404);

  const emUso = await prisma.pedidoRevistaItem.count({ where: { categoria, tipo: key } });
  if (emUso > 0) {
    return erro(
      `${emUso} pedido(s) já usaram "${preco.label}" — não dá para remover sem fazer essa linha sumir do histórico. ` +
        "Se o preço mudou, edite o valor; se não é mais vendida, deixe o preço zerado.",
      409,
    );
  }

  return responder(async () => {
    await prisma.precoRevista.delete({ where: { key_categoria: { key, categoria } } });
    registrar({
      sessao,
      acao: "DELETE",
      entidade: "Precos_Revistas",
      descricao: `Modalidade "${preco.label}" (${NOME_CATEGORIA[categoria] ?? categoria}) removida — nunca tinha sido pedida.`,
    });
    return { ok: true };
  });
}
