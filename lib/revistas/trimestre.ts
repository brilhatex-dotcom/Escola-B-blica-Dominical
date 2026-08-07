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

/** O início (dia 1) de `t`, em UTC. */
function inicioDoTrimestre(t: Trimestre): Date {
  return new Date(Date.UTC(t.ano, (t.q - 1) * 3, 1));
}

/**
 * A data-limite padrão de PAGAMENTO de `t`: 2º domingo do 1º mês do
 * trimestre SEGUINTE a `t` (≈ lição 02) — não do que vem depois de hoje. Sem
 * isso, o prazo padrão de um trimestre futuro escolhido no seletor viraria o
 * de hoje, errado para qualquer trimestre que não seja o atual.
 */
export function dataLimitePadraoDoTrimestre(t: Trimestre): Date {
  const primeiro = inicioDoTrimestre(trimestreSeguinte(t));
  const primeiroDomingo = 1 + ((7 - primeiro.getUTCDay()) % 7);
  const dia = new Date(primeiro);
  dia.setUTCDate(primeiroDomingo + 7);
  return dia;
}

/** A data-limite padrão de PAGAMENTO do trimestre atual de `hoje`. */
export function dataLimitePadrao(hoje: Date): Date {
  return dataLimitePadraoDoTrimestre(trimestreDe(hoje));
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

/** Monta o `Trimestre` a partir de uma chave "NT-AAAA" já validada por `trimestreValido`. */
export function trimestreDaChave(chave: string): Trimestre {
  const m = /^([1-4])T-(\d{4})$/.exec(chave)!;
  return trimestreDeMes((Number(m[1]) - 1) * 3, Number(m[2]));
}

/**
 * "atual" | "proximo" (padrão) → o Trimestre a partir de hoje — mantido para
 * quem ainda chama assim. Uma chave "NT-AAAA" explícita (vinda do seletor de
 * trimestre da tela) tem prioridade e é resolvida direto, sem passar pelo
 * padrão atual/próximo.
 */
export function resolverTrimestre(hoje: Date, param: string | null): Trimestre {
  if (param && trimestreValido(param)) return trimestreDaChave(param);
  return param === "atual" ? trimestreDe(hoje) : proximoTrimestre(hoje);
}

/** O trimestre seguinte a `t` — usado só para montar `quatroTrimestres` em sequência. */
function trimestreSeguinte(t: Trimestre): Trimestre {
  const mes0 = t.q === 4 ? 0 : t.q * 3;
  const ano = t.q === 4 ? t.ano + 1 : t.ano;
  return trimestreDeMes(mes0, ano);
}

/**
 * Os quatro trimestres do seletor da tela de Pedido de Lição: o ATUAL (o que
 * está sendo pago agora) e os três seguintes (para encomendar com
 * antecedência) — uma janela que sempre faz sentido a partir de hoje, sem
 * precisar de um seletor de ano à parte.
 */
export function quatroTrimestres(hoje: Date): Trimestre[] {
  const lista: Trimestre[] = [trimestreDe(hoje)];
  for (let i = 0; i < 3; i++) lista.push(trimestreSeguinte(lista[lista.length - 1]));
  return lista;
}
