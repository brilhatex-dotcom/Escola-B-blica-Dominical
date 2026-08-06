/**
 * As contas puras do pedido digitado — sem banco, para poderem ser
 * conferidas isoladamente. `app/api/revistas/pedido/route.ts` é quem lê e
 * grava; este arquivo só soma e valida.
 */

export interface ItemPedido {
  categoria: string;
  tipo: "aluno" | "professor";
  quantidade: number;
  precoUnitario: number;
}

export function calcularTotalPedido(itens: { quantidade: number; precoUnitario: number }[]): number {
  return Number(itens.reduce((s, it) => s + it.quantidade * it.precoUnitario, 0).toFixed(2));
}

export function calcularTotalRevistas(itens: { quantidade: number }[]): number {
  return itens.reduce((s, it) => s + it.quantidade, 0);
}

/** Quantidade válida: inteiro, 0 ou mais. `null`/vazio vira 0 (campo em branco = nada pedido nessa linha). */
export function validarQuantidade(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return 0;
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

export const TIPOS_ITEM = ["aluno", "professor"] as const;
export type TipoItem = (typeof TIPOS_ITEM)[number];

export function tipoValido(valor: unknown): valor is TipoItem {
  return valor === "aluno" || valor === "professor";
}
