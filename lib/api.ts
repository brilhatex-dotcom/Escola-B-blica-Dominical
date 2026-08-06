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

/* ------------------------------------------------------------------ *
 * Escrita nas tabelas herdadas
 * ------------------------------------------------------------------ */

/**
 * O próximo `id` de uma tabela do sistema antigo.
 *
 * ============================================================================
 * POR QUE ISTO PRECISA EXISTIR, E POR QUE PRECISA RODAR DENTRO DA TRANSAÇÃO
 *
 * `Alunos`, `Classes`, `Visitantes` e `Frequencias` NÃO têm id autoincrement —
 * a chave é a da planilha original, preservada para não quebrar os
 * relacionamentos herdados (ver prisma/schema.prisma). Então cadastrar um
 * aluno novo exige calcular o próximo número.
 *
 * E o cálculo tem de acontecer DENTRO da mesma transação da inserção. Fora
 * dela, dois professores cadastrando ao mesmo tempo — dois celulares, um
 * domingo de manhã — leem o mesmo "maior id", pedem o mesmo número, e o
 * segundo perde o cadastro com erro de chave duplicada. Já foi o caso na
 * gravação da chamada; a razão aqui é idêntica.
 * ============================================================================
 */
export async function proximoId(
  agregar: () => Promise<{ _max: { id: number | null } }>,
): Promise<number> {
  const { _max } = await agregar();
  return (_max.id ?? 0) + 1;
}

/**
 * Lê o corpo JSON sem derrubar a rota.
 *
 * `req.json()` lança quando o corpo vem vazio ou malformado — e uma exceção
 * ali vira 500, que é a resposta errada: o erro é de quem enviou, não do
 * servidor, e 500 manda a tela dizer "tente de novo" para algo que nunca vai
 * dar certo do jeito que está.
 */
export async function lerCorpo(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const corpo = await req.json();
    return corpo && typeof corpo === "object" ? (corpo as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Texto obrigatório, sem espaços nas pontas. `null` quando não serve. */
export function texto(valor: unknown, max = 200): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  if (!limpo || limpo.length > max) return null;
  return limpo;
}

/** Texto opcional: `""` vira `null`, e não string vazia gravada no banco. */
export function textoOpcional(valor: unknown, max = 500): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo && limpo.length <= max ? limpo : null;
}

/**
 * Data civil "YYYY-MM-DD" → `Date` em UTC.
 *
 * `new Date("2010-05-03")` já é UTC, mas `new Date("2010-05-03T00:00:00")` é
 * hora local — e em Pernambuco (UTC−3) isso grava 2010-05-02T21:00Z, que numa
 * coluna `@db.Date` vira **o dia anterior**. Uma data de nascimento que anda um
 * dia para trás a cada gravação é o tipo de defeito que ninguém liga ao fuso.
 */
export function dataCivil(valor: unknown): Date | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
