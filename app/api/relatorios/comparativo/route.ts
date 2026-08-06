import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { erro } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { dataOu, MINIMO_DE_CHAMADAS, periodoPadrao, recorteSql } from "@/lib/relatorios/comum";
import {
  calcularIGS,
  classificarIGS,
  scoreDeVariacao,
  variacaoPct,
  COMPARATIVO_MAXIMO,
  COMPARATIVO_MINIMO,
  validarSelecaoComparativo,
  type ComponentesIGS,
} from "@/lib/relatorios/indices";

/**
 * Congregação × congregação — o Radar e a Linha comparativa.
 *
 *   ?cong=1,2,3    2 a 4 congregações (obrigatório)
 *   ?de=&ate=      período do instantâneo (padrão: últimos 90 dias)
 *
 * ============================================================================
 * A MESMA CONTA DO PAINEL, SÓ QUE PARA POUCAS CONGREGAÇÕES DE CADA VEZ
 *
 * `/api/relatorios/painel` calcula o IGS das 14 de uma vez, porque a tela dele
 * precisa das 14. Esta rota recebe a lista que a pessoa ESCOLHEU comparar —
 * duas a quatro — e faz a mesma conta só para elas, mais a série mensal que o
 * Painel não calcula por congregação (custaria uma consulta a mais por
 * congregação, e as 14 juntas não caberiam num radar legível de qualquer jeito).
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("rel-comparativo");
  if (recusa) return recusa;

  const url = new URL(req.url);
  const pedidos = (url.searchParams.get("cong") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n));

  const recorte = recorteDaSessao(sessao);
  // O recorte ESTREITA a seleção, nunca amplia — mesma regra de todo o resto
  // do sistema: pedir uma congregação fora do alcance simplesmente a remove.
  const ids = recorte ? pedidos.filter((id) => recorte.in.includes(id)) : pedidos;

  const problema = validarSelecaoComparativo(ids);
  if (problema) return erro(problema, 400);

  try {
    const { de: deP, ate: ateP } = periodoPadrao();
    const de = dataOu(url.searchParams.get("de"), deP);
    const ate = dataOu(url.searchParams.get("ate"), ateP);
    const meio = new Date((de.getTime() + ate.getTime()) / 2);

    let domingosNoPeriodo = 0;
    for (let d = new Date(de); d <= ate; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() === 0) domingosNoPeriodo++;
    }

    const soIds = recorteSql(Prisma.sql`"congId"`, ids);

    const linhas = await prisma.$queryRaw<
      Array<{
        congId: number;
        congregacao: string;
        chamadas: bigint;
        presentes: bigint;
        domingosComChamada: bigint;
        chamadasAnt: bigint;
        presentesAnt: bigint;
        chamadasRec: bigint;
        presentesRec: bigint;
        visitantesAnt: bigint;
        visitantesRec: bigint;
      }>
    >`
      WITH chamadas AS (
        SELECT
          "congId",
          count(*)                                            AS total,
          count(*) FILTER (WHERE presente)                    AS presentes,
          count(DISTINCT data)                                AS domingos,
          count(*) FILTER (WHERE data < ${meio})               AS total_ant,
          count(*) FILTER (WHERE presente AND data < ${meio})  AS presentes_ant,
          count(*) FILTER (WHERE data >= ${meio})              AS total_rec,
          count(*) FILTER (WHERE presente AND data >= ${meio}) AS presentes_rec
        FROM "Frequencias"
        WHERE data BETWEEN ${de} AND ${ate} ${soIds}
        GROUP BY "congId"
      ),
      visitas AS (
        SELECT
          "congId",
          count(*) FILTER (WHERE data < ${meio})  AS ant,
          count(*) FILTER (WHERE data >= ${meio}) AS rec
        FROM "Visitantes"
        WHERE data BETWEEN ${de} AND ${ate} ${soIds}
        GROUP BY "congId"
      )
      SELECT
        g.id                            AS "congId",
        g.nome                          AS congregacao,
        COALESCE(c.total, 0)            AS chamadas,
        COALESCE(c.presentes, 0)        AS presentes,
        COALESCE(c.domingos, 0)         AS "domingosComChamada",
        COALESCE(c.total_ant, 0)        AS "chamadasAnt",
        COALESCE(c.presentes_ant, 0)    AS "presentesAnt",
        COALESCE(c.total_rec, 0)        AS "chamadasRec",
        COALESCE(c.presentes_rec, 0)    AS "presentesRec",
        COALESCE(v.ant, 0)              AS "visitantesAnt",
        COALESCE(v.rec, 0)              AS "visitantesRec"
      FROM "Congregacoes" g
      LEFT JOIN chamadas c ON c."congId" = g.id
      LEFT JOIN visitas v  ON v."congId" = g.id
      WHERE g.id IN (${Prisma.join(ids)})
      ORDER BY g.id
    `;

    if (linhas.length === 0) {
      throw new Error("Nenhuma das congregações escolhidas foi encontrada.");
    }

    // Faltosos recorrentes — mesma lógica do Painel, recortada às congregações pedidas.
    const faltosos = await prisma.$queryRaw<Array<{ congId: number; elegiveis: bigint; faltosos: bigint }>>`
      WITH ordenadas AS (
        SELECT f."alunoId", a."congId", f.presente,
               ROW_NUMBER() OVER (PARTITION BY f."alunoId" ORDER BY f.data DESC) AS pos
        FROM "Frequencias" f
        JOIN "Alunos" a ON a.id = f."alunoId" AND a.ativo
        WHERE f.data BETWEEN ${de} AND ${ate} AND a."congId" IN (${Prisma.join(ids)})
      ),
      primeira_presenca AS (
        SELECT "alunoId", MIN(pos) AS pos_presenca FROM ordenadas WHERE presente GROUP BY "alunoId"
      ),
      resumo AS (
        SELECT o."alunoId", o."congId",
               COALESCE(p.pos_presenca - 1, MAX(o.pos)) AS seguidas
        FROM ordenadas o
        LEFT JOIN primeira_presenca p ON p."alunoId" = o."alunoId"
        GROUP BY o."alunoId", o."congId", p.pos_presenca
      )
      SELECT "congId", count(*) AS elegiveis, count(*) FILTER (WHERE seguidas >= 3) AS faltosos
      FROM resumo GROUP BY "congId"
    `;
    const faltososPorId = new Map(
      faltosos.map((f) => [f.congId, { elegiveis: Number(f.elegiveis), faltosos: Number(f.faltosos) }]),
    );

    // Série mensal (6 meses) — a LINHA comparativa. Uma congregação por série.
    const seisMesesAtras = new Date(ate);
    seisMesesAtras.setUTCMonth(seisMesesAtras.getUTCMonth() - 5);
    seisMesesAtras.setUTCDate(1);

    const serie = await prisma.$queryRaw<
      Array<{ congId: number; mes: Date; chamadas: bigint; presentes: bigint }>
    >`
      SELECT "congId", date_trunc('month', data) AS mes,
             count(*) AS chamadas, count(*) FILTER (WHERE presente) AS presentes
      FROM "Frequencias"
      WHERE data >= ${seisMesesAtras} AND data <= ${ate} AND "congId" IN (${Prisma.join(ids)})
      GROUP BY "congId", mes
      ORDER BY mes
    `;
    const meses: string[] = [];
    for (let d = new Date(seisMesesAtras); d <= ate; d.setUTCMonth(d.getUTCMonth() + 1)) {
      meses.push(d.toISOString().slice(0, 7));
    }
    const serieChavePorCong = new Map<number, Map<string, { chamadas: number; presentes: number }>>();
    for (const s of serie) {
      const mesChave = s.mes.toISOString().slice(0, 7);
      if (!serieChavePorCong.has(s.congId)) serieChavePorCong.set(s.congId, new Map());
      serieChavePorCong.get(s.congId)!.set(mesChave, {
        chamadas: Number(s.chamadas),
        presentes: Number(s.presentes),
      });
    }

    const congregacoes = linhas.map((c) => {
      const chamadas = Number(c.chamadas);
      const presentes = Number(c.presentes);
      const taxaFrequencia = chamadas > 0 ? (presentes / chamadas) * 100 : null;

      const taxaAnt = Number(c.chamadasAnt) > 0 ? (Number(c.presentesAnt) / Number(c.chamadasAnt)) * 100 : null;
      const taxaRec = Number(c.chamadasRec) > 0 ? (Number(c.presentesRec) / Number(c.chamadasRec)) * 100 : null;
      const tendenciaPct = taxaAnt !== null && taxaRec !== null ? variacaoPct(taxaAnt, taxaRec) : null;

      const domingosComChamada = Number(c.domingosComChamada);
      const regularidade =
        domingosNoPeriodo > 0 ? Math.min(100, (domingosComChamada / domingosNoPeriodo) * 100) : null;

      const visitantesAnt = Number(c.visitantesAnt);
      const visitantesRec = Number(c.visitantesRec);
      const visitantesScore =
        visitantesAnt === 0 && visitantesRec === 0 ? null : scoreDeVariacao(variacaoPct(visitantesAnt, visitantesRec));

      const falt = faltososPorId.get(c.congId);
      const faltososScore = falt && falt.elegiveis > 0 ? 100 - (falt.faltosos / falt.elegiveis) * 100 : null;

      const componentes: ComponentesIGS = {
        frequencia: taxaFrequencia,
        regularidade,
        tendencia: scoreDeVariacao(tendenciaPct),
        visitantes: visitantesScore,
        faltosos: faltososScore,
      };

      const suficiente = chamadas >= MINIMO_DE_CHAMADAS;
      const igs = suficiente ? calcularIGS(componentes) : null;

      const mensal = serieChavePorCong.get(c.congId);
      const serieMensal = meses.map((mes) => {
        const ponto = mensal?.get(mes);
        return {
          mes,
          taxa: ponto && ponto.chamadas > 0 ? Math.round((ponto.presentes / ponto.chamadas) * 1000) / 10 : null,
        };
      });

      return {
        congId: c.congId,
        nome: c.congregacao?.trim() || `Congregação ${c.congId}`,
        chamadas,
        dadosSuficientes: suficiente,
        taxaFrequencia,
        tendenciaPct,
        visitantesAnt,
        visitantesRec,
        componentes,
        igs,
        classificacao: igs ? classificarIGS(igs.nota) : null,
        serieMensal,
      };
    });

    return NextResponse.json({
      periodo: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) },
      congregacoes,
      limites: { minimo: COMPARATIVO_MINIMO, maximo: COMPARATIVO_MAXIMO },
    });
  } catch (e) {
    /*
     * O erro de verdade vai no corpo da resposta, temporariamente — o mesmo
     * padrão já usado em `/api/relatorios/destaques` e `/api/painel` (campo
     * `motivo`), para quem administra conseguir descrever o problema sem
     * precisar abrir o log da Vercel.
     */
    console.error("[comparativo] falhou:", e);
    return NextResponse.json(
      { erro: "Não foi possível calcular o comparativo.", motivo: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
