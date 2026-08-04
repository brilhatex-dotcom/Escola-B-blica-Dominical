import { NextResponse } from "next/server";

/**
 * Peças comuns das rotas de API.
 *
 * Existem para que cada rota trate erro, paginacao e busca do MESMO jeito. Sem
 * isso, uma rota devolve `{erro}`, outra devolve texto puro, e a tela precisa
 * saber qual e qual — que e como um sistema ganha cinco formatos de erro.
 */

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
  /** `true` quando ainda ha o que carregar. Poupa a tela de fazer a conta. */
  temMais: boolean;
}

export function pagina<T>(itens: T[], total: number, p: number, porPagina: number): Pagina<T> {
  return { itens, total, pagina: p, porPagina, temMais: p * porPagina < total };
}

/** Limites de paginacao. O teto existe para `?porPagina=100000` nao derrubar o banco. */
export function lerPaginacao(url: URL): { pagina: number; porPagina: number; pular: number } {
  const p = Math.max(1, Number(url.searchParams.get("pagina") ?? 1) || 1);
  const porPagina = Math.min(200, Math.max(1, Number(url.searchParams.get("porPagina") ?? 50) || 50));
  return { pagina: p, porPagina, pular: (p - 1) * porPagina };
}

/** Numero opcional da query. `null` quando ausente ou invalido — nunca `NaN`. */
export function lerInt(url: URL, chave: string): number | null {
  const bruto = url.searchParams.get(chave);
  if (bruto === null || bruto === "") return null;
  const n = Number(bruto);
  return Number.isInteger(n) ? n : null;
}

/**
 * Resposta de erro.
 *
 * A mensagem tecnica vai para o log do servidor, nao para a tela. Detalhe de
 * excecao do Prisma numa resposta HTTP entrega nome de tabela e de coluna para
 * quem estiver olhando — e nao ajuda em nada quem esta usando o sistema.
 */
export function erro(mensagem: string, status = 500, causa?: unknown) {
  if (causa) console.error(`[api] ${mensagem}:`, causa);
  return NextResponse.json({ erro: mensagem }, { status });
}

/**
 * Envolve o corpo da rota.
 *
 * Qualquer excecao vira 500 com mensagem generica, e o erro real fica no log.
 * Sem isso, uma consulta que falha derruba a rota inteira com o rastro de pilha
 * do Next no corpo da resposta.
 */
export async function responder<T>(fn: () => Promise<T>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    return erro("Não foi possível concluir a operação.", 500, e);
  }
}
