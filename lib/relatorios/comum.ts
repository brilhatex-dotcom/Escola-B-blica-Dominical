import { Prisma } from "@prisma/client";

/**
 * Peças comuns dos relatórios.
 *
 * ============================================================================
 * A DECISÃO QUE ATRAVESSA TODOS ELES: "FALTOU" NÃO É "NÃO FOI MARCADO"
 *
 * A tabela `Frequencias` só tem linha para aluno que foi CHAMADO. Um domingo em
 * que a classe não fez chamada não produz faltas — produz ausência de dados.
 *
 * Tratar os dois como a mesma coisa arruinaria todos os números daqui: o aluno
 * de uma classe que esqueceu a chamada apareceria com 100% de faltas, o ranking
 * puniria a classe organizada que registra tudo (inclusive as faltas) e
 * premiaria a que só registra presença.
 *
 * Por isso o denominador de toda taxa é `count(*)` das linhas existentes — os
 * domingos em que aquele aluno foi de fato chamado —, nunca o número de
 * domingos do calendário.
 * ============================================================================
 */

/** Traduz o recorte do acesso para um pedaço de SQL. */
export function recorteSql(coluna: Prisma.Sql, alvo: number[] | null): Prisma.Sql {
  if (!alvo) return Prisma.empty;
  if (alvo.length === 0) return Prisma.sql` AND false`;
  return Prisma.sql` AND ${coluna} IN (${Prisma.join(alvo)})`;
}

/**
 * O alcance efetivo de uma consulta: o que a tela pediu, limitado ao acesso.
 *
 * `null` significa "sem filtro" e só sai para quem enxerga o campo inteiro sem
 * ter pedido congregação nenhuma.
 */
export function alvoDaConsulta(
  recorte: { in: number[] } | undefined,
  pedida: number | null,
): number[] | null {
  if (recorte) {
    return pedida !== null && recorte.in.includes(pedida) ? [pedida] : recorte.in;
  }
  return pedida !== null ? [pedida] : null;
}

/**
 * Mínimo de chamadas para entrar num ranking ou ganhar certificado.
 *
 * Sem um piso, quem foi chamado UMA vez e estava presente aparece com 100% e
 * lidera a lista — à frente de quem compareceu a 11 dos 12 domingos. Não é um
 * detalhe estatístico: é a diferença entre um ranking que a igreja respeita e
 * um que ela aprende a ignorar.
 */
export const MINIMO_DE_CHAMADAS = 3;

/** Período padrão dos relatórios: os últimos 90 dias. */
export function periodoPadrao(hoje = new Date()): { de: Date; ate: Date } {
  const de = new Date(hoje);
  de.setDate(de.getDate() - 90);
  return { de, ate: hoje };
}

export function dataOu(valor: string | null, padrao: Date): Date {
  if (valor && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return new Date(`${valor}T00:00:00Z`);
  return padrao;
}
