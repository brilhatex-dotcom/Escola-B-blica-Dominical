import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { alvoDaConsulta, recorteSql } from "@/lib/relatorios/comum";
import { arred, diasPorCongregacao, regressao, resumir, taxaDoDia } from "@/lib/relatorios/estatisticas";
import { grupoDoTipo } from "@/lib/revistas/precos";
import { proximoTrimestre } from "@/lib/revistas/trimestre";

/**
 * Panoramas futuros — para onde a escola está indo, se nada mudar.
 *
 * ============================================================================
 * ESTIMATIVA, NÃO PROFECIA — E A TELA DIZ ISSO
 *
 * Tudo aqui é a reta dos últimos domingos esticada para a frente (mínimos
 * quadrados, lib/relatorios/estatisticas.ts). Serve para enxergar a direção
 * — "a presença vem caindo um ponto por mês" — e decidir antes de o número
 * chegar lá. Não sabe de feriado, campanha ou chuva. Por isso só projeta com
 * pelo menos 4 domingos de dado, nunca passa de 100% nem fica abaixo de 0, e
 * olha só 4 domingos e um trimestre adiante: quanto mais longe, mais a reta
 * inventa.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const SEMANAS = 26;
const LIMIAR_TENDENCIA = 3; // pontos percentuais entre as duas metades

const limitar = (n: number) => Math.max(0, Math.min(100, n));

export async function GET() {
  const { sessao, recusa } = await exigirLeitura("estatisticas");
  if (recusa) return recusa;

  return responder(async () => {
    const alvo = alvoDaConsulta(recorteDaSessao(sessao), null);
    const hoje = new Date();
    const ate = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    const de = new Date(ate);
    de.setUTCDate(de.getUTCDate() - SEMANAS * 7);

    const inicioMeses = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - 5, 1));
    const proximo = proximoTrimestre(hoje);

    const [dias, congregacoes, matriculadosAtivos, novasPorMes, ultimoPedido] = await Promise.all([
      diasPorCongregacao(de, ate, alvo),
      prisma.congregacao.findMany({
        where: alvo ? { id: { in: alvo } } : {},
        select: { id: true, nome: true },
      }),
      prisma.aluno.count({ where: { ativo: true, ...(alvo ? { congId: { in: alvo } } : {}) } }),
      prisma.$queryRaw<Array<{ mes: string; n: bigint }>>`
        SELECT to_char("matriculadoEm", 'YYYY-MM') AS mes, count(*) AS n
        FROM "Alunos"
        WHERE "matriculadoEm" >= ${inicioMeses} ${recorteSql(Prisma.sql`"congId"`, alvo)}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.pedidoRevista.findMany({
        where: { confirmado: true, ...(alvo ? { congId: { in: alvo } } : {}) },
        select: { trimestre: true, itens: { select: { tipo: true, quantidade: true, precoUnitario: true } } },
      }),
    ]);

    // ---------------- A série do campo, domingo a domingo ----------------
    const porData = new Map<string, { presentes: number; matriculados: number; justificadas: number }>();
    for (const d of dias) {
      const t = porData.get(d.data) ?? { presentes: 0, matriculados: 0, justificadas: 0 };
      t.presentes += d.presentes;
      t.matriculados += d.matriculados;
      t.justificadas += d.justificadas;
      porData.set(d.data, t);
    }
    const serie = [...porData]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, t]) => ({ data, presentes: t.presentes, base: t.matriculados - t.justificadas, taxa: taxaDoDia(t) }))
      .filter((p): p is typeof p & { taxa: number } => p.taxa !== null)
      .map((p) => ({ ...p, taxa: arred(p.taxa) }));

    const semana = (data: string) => Math.round((new Date(`${data}T00:00:00Z`).getTime() - de.getTime()) / (7 * 86_400_000));
    const recentes = serie.slice(-12);
    const retaTaxa = recentes.length >= 4 ? regressao(recentes.map((p) => ({ x: semana(p.data), y: p.taxa }))) : null;
    const retaPresentes = recentes.length >= 4 ? regressao(recentes.map((p) => ({ x: semana(p.data), y: p.presentes }))) : null;

    const projecao: Array<{ data: string; taxa: number; presentes: number }> = [];
    if (retaTaxa && retaPresentes && serie.length > 0) {
      const ultimo = new Date(`${serie[serie.length - 1].data}T00:00:00Z`);
      for (let i = 1; i <= 4; i++) {
        const d = new Date(ultimo);
        d.setUTCDate(d.getUTCDate() + 7 * i);
        const data = d.toISOString().slice(0, 10);
        const x = semana(data);
        projecao.push({
          data,
          taxa: arred(limitar(retaTaxa.a + retaTaxa.b * x)),
          presentes: Math.max(0, Math.round(retaPresentes.a + retaPresentes.b * x)),
        });
      }
    }

    // ---------------- Cada congregação: subindo, estável ou caindo ----------------
    const porCong = new Map<number, typeof dias>();
    for (const d of dias) {
      if (!porCong.has(d.congId)) porCong.set(d.congId, []);
      porCong.get(d.congId)!.push(d);
    }
    const tendencias = congregacoes
      .map((c) => {
        const lista = (porCong.get(c.id) ?? []).filter((d) => taxaDoDia(d) !== null);
        const ult = lista.slice(-6);
        const ant = lista.slice(-12, -6);
        const rUlt = resumir(ult);
        const rAnt = resumir(ant);
        const variacao = rUlt.taxa !== null && rAnt.taxa !== null && ant.length >= 3 ? arred(rUlt.taxa - rAnt.taxa) : null;
        const reta = lista.length >= 4 ? regressao(lista.slice(-12).map((d) => ({ x: semana(d.data), y: taxaDoDia(d)! }))) : null;
        // 4 semanas depois do ÚLTIMO domingo com dado da congregação — e não de
        // hoje: esticar a reta por meses sem chamada inventaria um número.
        const xFuturo = lista.length > 0 ? semana(lista[lista.length - 1].data) + 4 : 0;
        return {
          congId: c.id,
          nome: c.nome?.trim() || `Congregação ${c.id}`,
          atual: rUlt.taxa,
          anterior: rAnt.taxa,
          variacao,
          projecao: reta ? arred(limitar(reta.a + reta.b * xFuturo)) : null,
          direcao:
            variacao === null ? "sem-base" : variacao > LIMIAR_TENDENCIA ? "subindo" : variacao < -LIMIAR_TENDENCIA ? "caindo" : "estavel",
        };
      })
      .sort((a, b) => (b.variacao ?? -999) - (a.variacao ?? -999) || a.nome.localeCompare(b.nome, "pt-BR"));

    // ---------------- Matrículas ----------------
    const meses: Array<{ mes: string; novas: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - i, 1));
      const mes = d.toISOString().slice(0, 7);
      meses.push({ mes, novas: Number(novasPorMes.find((m) => m.mes === mes)?.n ?? 0) });
    }
    // O mês corrente ainda está pela metade: a média usa só os cinco fechados.
    const fechados = meses.slice(0, -1);
    const mediaMensal = arred(fechados.reduce((s, m) => s + m.novas, 0) / fechados.length);
    const inicioProximo = new Date(Date.UTC(proximo.ano, (proximo.q - 1) * 3, 1));
    const mesesAteProximo = Math.max(
      0,
      (inicioProximo.getUTCFullYear() - hoje.getFullYear()) * 12 + inicioProximo.getUTCMonth() - hoje.getMonth(),
    );
    const matriculadosProjetados = Math.round(matriculadosAtivos + mediaMensal * mesesAteProximo);

    // ---------------- Revistas do próximo trimestre ----------------
    const ordem = (c: string) => {
      const m = /^([1-4])T-(\d{4})$/.exec(c);
      return m ? Number(m[2]) * 10 + Number(m[1]) : 0;
    };
    const ultimaChave = [...new Set(ultimoPedido.map((p) => p.trimestre))]
      .filter((t) => ordem(t) < ordem(proximo.chave))
      .sort((a, b) => ordem(b) - ordem(a))[0];
    let ultimoAluno = 0;
    let ultimoValorAluno = 0;
    for (const p of ultimoPedido.filter((x) => x.trimestre === ultimaChave)) {
      for (const it of p.itens) {
        if (grupoDoTipo(it.tipo) === "aluno") {
          ultimoAluno += it.quantidade;
          ultimoValorAluno += it.quantidade * Number(it.precoUnitario);
        }
      }
    }
    const precoMedio = ultimoAluno > 0 ? ultimoValorAluno / ultimoAluno : null;

    return {
      janela: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10), semanas: SEMANAS },
      serie,
      projecao,
      tendenciaSemanal: retaTaxa ? arred(retaTaxa.b) : null,
      tendencias,
      matriculas: {
        atuais: matriculadosAtivos,
        meses,
        mediaMensal,
        projetadosNoProximoTrimestre: matriculadosProjetados,
      },
      revistas: {
        trimestre: { chave: proximo.chave, rotulo: proximo.rotulo },
        estimativaAluno: matriculadosProjetados,
        ultimoTrimestre: ultimaChave ?? null,
        ultimoPedidoAluno: ultimaChave ? ultimoAluno : null,
        valorEstimado: precoMedio !== null ? Math.round(matriculadosProjetados * precoMedio * 100) / 100 : null,
      },
    };
  });
}
