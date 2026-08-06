/**
 * O trimestre — a chave que escopa pedido, pagamento e prazo.
 *
 * Duas datas importam, e são propositalmente diferentes: o trimestre ATUAL é
 * o que está em andamento agora — o que a congregação está pagando. O
 * trimestre PRÓXIMO é o que ainda não começou — o que a congregação está
 * ENCOMENDANDO agora, porque a CPAD precisa de tempo para imprimir e enviar.
 * A tela de Fazer Pedido abre no próximo por padrão; o painel financeiro
 * (pagamento) olha o atual.
 */

export interface Trimestre {
  chave: string;
  rotulo: string;
  q: number;
  ano: number;
}

function trimestreDeMes(mes0: number, ano: number): Trimestre {
  const q = Math.floor(mes0 / 3) + 1;
  return { chave: `${q}T-${ano}`, rotulo: `${q}º trimestre de ${ano}`, q, ano };
}

export function trimestreDe(hoje: Date): Trimestre {
  return trimestreDeMes(hoje.getMonth(), hoje.getFullYear());
}

/** O trimestre seguinte ao de `hoje` — o que ainda não começou. */
export function proximoTrimestre(hoje: Date): Trimestre {
  const q = Math.floor(hoje.getMonth() / 3) + 1;
  const mes0 = q === 4 ? 0 : q * 3; // 0-based: início do próximo trimestre
  const ano = q === 4 ? hoje.getFullYear() + 1 : hoje.getFullYear();
  return trimestreDeMes(mes0, ano);
}

/** O início (dia 1) do trimestre seguinte ao de `hoje`, em UTC. */
function inicioDoProximoTrimestre(hoje: Date): Date {
  const q = Math.floor(hoje.getMonth() / 3) + 1;
  const mes = q === 4 ? 0 : q * 3;
  const ano = q === 4 ? hoje.getFullYear() + 1 : hoje.getFullYear();
  return new Date(Date.UTC(ano, mes, 1));
}

/** A data-limite padrão de PAGAMENTO: 2º domingo do 1º mês do PRÓXIMO trimestre (≈ lição 02). */
export function dataLimitePadrao(hoje: Date): Date {
  const primeiro = inicioDoProximoTrimestre(hoje);
  const primeiroDomingo = 1 + ((7 - primeiro.getUTCDay()) % 7);
  const dia = new Date(primeiro);
  dia.setUTCDate(primeiroDomingo + 7);
  return dia;
}

export function soDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Valida "NT-AAAA" (N de 1 a 4) — a mesma forma que `trimestreDe`/`proximoTrimestre` produzem. */
export function trimestreValido(chave: string): boolean {
  return /^[1-4]T-\d{4}$/.test(chave);
}

export function rotuloDoTrimestre(chave: string): string {
  const m = /^([1-4])T-(\d{4})$/.exec(chave);
  if (!m) return chave;
  return `${m[1]}º trimestre de ${m[2]}`;
}

/** "atual" | "proximo" (padrão) → o Trimestre correspondente a partir de hoje. */
export function resolverTrimestre(hoje: Date, param: string | null): Trimestre {
  return param === "atual" ? trimestreDe(hoje) : proximoTrimestre(hoje);
}
