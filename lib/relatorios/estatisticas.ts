import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { justificadasDisponiveis } from "@/lib/ebd/justificadas";
import { recorteSql } from "./comum";

/**
 * A régua da área de Estatísticas: PRESENTES ÷ MATRICULADOS, domingo a domingo.
 *
 * ============================================================================
 * POR QUE NÃO É A MESMA CONTA DO RANKING DE FREQUÊNCIA
 *
 * O ranking de Relatórios divide presentes pelos CHAMADOS — mede quem a
 * chamada pegou presente. Aqui a pergunta é outra, a que a liderança faz de
 * cabeça: "de cada dez matriculados, quantos vieram?". Uma congregação que só
 * marca quem veio fica com 100% na outra conta; nesta, os que nem foram
 * chamados continuam no denominador, porque continuam matriculados.
 *
 * O denominador de cada domingo é o quadro daquele dia: alunos ativos já
 * matriculados naquela data (`matriculadoEm` ≤ domingo, ou herdados sem data),
 * MENOS quem teve falta justificada — a justificada não pesa contra.
 *
 * CADA CHAMADA CONTA NO DOMINGO DA SUA SEMANA. Muita chamada é lançada na
 * segunda ou na terça (a secretária passa o papel para o portal depois), e
 * o banco guarda a data em que foi lançada. Contando pela data crua, o mesmo
 * domingo virava dois — metade das classes num dia, metade no outro, cada
 * metade com uma taxa ruim. Por isso a data é trazida de volta ao domingo
 * anterior (`data - dia da semana`) antes de agrupar.
 *
 * A nota do período é a MÉDIA dos domingos em que a congregação fez chamada.
 * Domingo sem chamada não entra como 0%: é ausência de dado, como em todo o
 * portal (ver lib/relatorios/comum.ts). Para isso não premiar quem quase não
 * faz chamada, a regularidade (domingos com chamada ÷ domingos do período)
 * vai junto, e quem fez em menos da metade fica numa lista à parte.
 * ============================================================================
 */

/** A data trazida ao domingo da sua semana (domingo = ele mesmo). */
const domingoDe = (col: Prisma.Sql) => Prisma.sql`(${col} - EXTRACT(DOW FROM ${col})::int)`;

/*
 * O filtro do período é pelo DOMINGO da chamada, não pela data lançada: a
 * chamada do domingo 02/08 lançada na segunda 03/08 pertence ao período
 * "só o domingo 02/08". Os seis dias a mais no `BETWEEN` cru só existem para
 * o índice de `data` continuar servindo.
 */
const seisDiasDepois = (d: Date) => new Date(d.getTime() + 6 * 86_400_000);

export interface DiaCong {
  congId: number;
  data: string;
  presentes: number;
  matriculados: number;
  justificadas: number;
}

export function domingosEntre(de: Date, ate: Date): string[] {
  const dias: string[] = [];
  const d = new Date(de);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  for (; d <= ate; d.setUTCDate(d.getUTCDate() + 7)) dias.push(d.toISOString().slice(0, 10));
  return dias;
}

export const taxaDoDia = (d: { presentes: number; matriculados: number; justificadas: number }): number | null => {
  const base = d.matriculados - d.justificadas;
  if (base <= 0) return null;
  return Math.min(100, (d.presentes / base) * 100);
};

export const arred = (n: number) => Math.round(n * 10) / 10;

/** Presentes e quadro de cada congregação em cada domingo com chamada. */
export async function diasPorCongregacao(de: Date, ate: Date, alvo: number[] | null = null): Promise<DiaCong[]> {
  const comJustificada = await justificadasDisponiveis();
  const linhas = await prisma.$queryRaw<
    Array<{ congId: number; data: Date; presentes: bigint; matriculados: bigint; justificadas: bigint | number }>
  >`
    WITH dias AS (
      SELECT f."congId", ${domingoDe(Prisma.sql`f.data`)} AS data,
             count(DISTINCT f."alunoId") FILTER (WHERE f.presente) AS presentes
      FROM "Frequencias" f
      WHERE f.data BETWEEN ${de} AND ${seisDiasDepois(ate)} AND ${domingoDe(Prisma.sql`f.data`)} BETWEEN ${de} AND ${ate}
        AND f."congId" IS NOT NULL
        ${recorteSql(Prisma.sql`f."congId"`, alvo)}
      GROUP BY 1, 2
    )
    SELECT d."congId", d.data, d.presentes,
      (SELECT count(*) FROM "Alunos" a
        WHERE a."congId" = d."congId" AND a.ativo
          AND (a."matriculadoEm" IS NULL OR a."matriculadoEm" <= d.data)) AS matriculados,
      ${comJustificada
        ? Prisma.sql`(SELECT count(DISTINCT j."alunoId") FROM "Faltas_Justificadas" j
            WHERE j."congId" = d."congId" AND ${domingoDe(Prisma.sql`j.data`)} = d.data)`
        : Prisma.sql`0`} AS justificadas
    FROM dias d
    ORDER BY d.data
  `;
  return linhas.map((l) => ({
    congId: l.congId,
    data: l.data.toISOString().slice(0, 10),
    presentes: Number(l.presentes),
    matriculados: Number(l.matriculados),
    justificadas: Number(l.justificadas),
  }));
}

export interface DiaClasse {
  classeId: number;
  data: string;
  presentes: number;
  matriculados: number;
  justificadas: number;
}

export async function diasPorClasse(de: Date, ate: Date, alvo: number[] | null): Promise<DiaClasse[]> {
  const comJustificada = await justificadasDisponiveis();
  const justSql = comJustificada
    ? Prisma.sql`(SELECT count(DISTINCT j."alunoId") FROM "Faltas_Justificadas" j
        WHERE j."classeId" = d."classeId" AND ${domingoDe(Prisma.sql`j.data`)} = d.data)`
    : Prisma.sql`0`;
  const linhas = await prisma.$queryRaw<
    Array<{ classeId: number; data: Date; presentes: bigint; matriculados: bigint; justificadas: bigint | number }>
  >`
    WITH dias AS (
      SELECT f."classeId", ${domingoDe(Prisma.sql`f.data`)} AS data,
             count(DISTINCT f."alunoId") FILTER (WHERE f.presente) AS presentes
      FROM "Frequencias" f
      WHERE f.data BETWEEN ${de} AND ${seisDiasDepois(ate)} AND ${domingoDe(Prisma.sql`f.data`)} BETWEEN ${de} AND ${ate}
        AND f."classeId" IS NOT NULL
        ${recorteSql(Prisma.sql`f."congId"`, alvo)}
      GROUP BY 1, 2
    )
    SELECT d."classeId", d.data, d.presentes,
      (SELECT count(*) FROM "Alunos" a
        WHERE a."classeId" = d."classeId" AND a.ativo
          AND (a."matriculadoEm" IS NULL OR a."matriculadoEm" <= d.data)) AS matriculados,
      ${justSql} AS justificadas
    FROM dias d
  `;
  return linhas.map((l) => ({
    classeId: l.classeId,
    data: l.data.toISOString().slice(0, 10),
    presentes: Number(l.presentes),
    matriculados: Number(l.matriculados),
    justificadas: Number(l.justificadas),
  }));
}

export interface Resumo {
  domingosComChamada: number;
  taxa: number | null;
  mediaPresentes: number;
  mediaBase: number;
  presentesTotal: number;
  justificadasTotal: number;
}

/** A média dos domingos com chamada — a nota do período. */
export function resumir(dias: Array<{ presentes: number; matriculados: number; justificadas: number }>): Resumo {
  const validos = dias.filter((d) => taxaDoDia(d) !== null);
  const n = validos.length;
  const soma = (f: (d: (typeof validos)[number]) => number) => validos.reduce((s, d) => s + f(d), 0);
  return {
    domingosComChamada: n,
    taxa: n > 0 ? arred(soma((d) => taxaDoDia(d)!) / n) : null,
    mediaPresentes: n > 0 ? arred(soma((d) => d.presentes) / n) : 0,
    mediaBase: n > 0 ? arred(soma((d) => d.matriculados - d.justificadas) / n) : 0,
    presentesTotal: soma((d) => d.presentes),
    justificadasTotal: dias.reduce((s, d) => s + d.justificadas, 0),
  };
}

/** Reta de mínimos quadrados — a "tendência" dos panoramas. */
export function regressao(pontos: Array<{ x: number; y: number }>): { a: number; b: number } | null {
  const n = pontos.length;
  if (n < 3) return null;
  const mx = pontos.reduce((s, p) => s + p.x, 0) / n;
  const my = pontos.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pontos) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  if (den === 0) return null;
  const b = num / den;
  return { a: my - b * mx, b };
}
