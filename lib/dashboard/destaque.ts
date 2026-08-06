import type { Destaque } from "./tipos";

/**
 * A conta pura do Destaque — separada da consulta ao banco para poder ser
 * conferida sem Postgres (ver `scripts/verificar-destaque.mts`).
 *
 * ============================================================================
 * DUAS TAXAS, NUNCA UM TOTAL BRUTO — A MESMA REGRA DO RESTO DO PORTAL
 *
 * "Mais assíduo" é `presentes ÷ chamados` (não presentes brutos, que sempre
 * favoreceria quem tem mais gente). "Trouxe visitante" é `domingos com
 * visitante ÷ domingos com chamada` — NÃO o número de visitantes: uma
 * congregação de 80 pessoas traz mais visitantes brutos que uma de 15 quase
 * por acaso, e contar bruto premiaria o tamanho, não o esforço.
 *
 * O destaque é a MÉDIA das duas taxas — metade do peso pra vir sempre,
 * metade pra trazer gente.
 * ============================================================================
 */

/** O mesmo piso do Ranking e dos Certificados (`MINIMO_DE_CHAMADAS`, em `lib/relatorios/comum.ts`). */
export const DESTAQUE_MINIMO_DOMINGOS = 3;

export interface LinhaDestaque {
  nome: string;
  domingos: number;
  chamados: number;
  presentes: number;
  domingosComVisitante: number;
}

/**
 * Escolhe o(s) destaque(s) entre as linhas apuradas.
 *
 * Devolve `null` quando ninguém alcança o piso mínimo de domingos — nunca um
 * "vencedor" calculado sobre um domingo de sorte. Em empate exato de nota,
 * todos os empatados entram em `nomes`: escolher um sozinho mentiria sobre
 * o empate.
 */
export function calcularDestaque(linhas: readonly LinhaDestaque[]): Destaque | null {
  const candidatas = linhas
    .filter((l) => l.domingos >= DESTAQUE_MINIMO_DOMINGOS && l.chamados > 0)
    .map((l) => ({
      nome: l.nome,
      domingos: l.domingos,
      taxaFrequencia: Math.round((l.presentes / l.chamados) * 1000) / 10,
      taxaVisitantes: Math.round((l.domingosComVisitante / l.domingos) * 1000) / 10,
    }))
    .map((l) => ({ ...l, score: Math.round(((l.taxaFrequencia + l.taxaVisitantes) / 2) * 10) / 10 }));

  if (candidatas.length === 0) return null;

  const maior = Math.max(...candidatas.map((c) => c.score));
  const vencedoras = candidatas.filter((c) => c.score === maior);

  return {
    nomes: vencedoras.map((v) => v.nome),
    score: maior,
    taxaFrequencia: vencedoras[0].taxaFrequencia,
    taxaVisitantes: vencedoras[0].taxaVisitantes,
    domingos: vencedoras[0].domingos,
  };
}

/** O primeiro dia do mês de `hoje`, em UTC. */
export function inicioDoMes(hoje: Date): Date {
  return new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
}

/** O primeiro dia do trimestre civil (Jan-Mar/Abr-Jun/Jul-Set/Out-Dez) de `hoje`, em UTC. */
export function inicioDoTrimestre(hoje: Date): Date {
  const q = Math.floor(hoje.getUTCMonth() / 3);
  return new Date(Date.UTC(hoje.getUTCFullYear(), q * 3, 1));
}
