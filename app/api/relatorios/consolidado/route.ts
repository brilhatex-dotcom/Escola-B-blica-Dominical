import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirLeitura } from "@/lib/auth/guarda";
import { domingoMaisRecente } from "@/lib/dashboard/formato";

/**
 * Relatório Consolidado por Domingo — o campo inteiro, somado, num só dia.
 *
 * ============================================================================
 * "CONSOLIDADO" QUER DIZER SOMAR AS CONGREGAÇÕES, NÃO SOMAR DOMINGOS
 *
 * O Relatório Semanal já existe, mas é por CONGREGAÇÃO — o Dirigente
 * escolhe a própria. Este relatório responde a pergunta de quem enxerga o
 * campo inteiro: "no domingo tal, quantos matriculados, presentes e faltas
 * o CAMPO teve, somando todas as congregações?" — e fecha com o ranking
 * completo (não só o Top 3 do Encarte) para ver cada congregação em
 * detalhe.
 *
 * Mesma régua do Encarte: percentual é presentes ÷ matriculados ATIVOS
 * (não ÷ chamados) — é sobre o retrato de hoje, não sobre tendência de
 * período. "Falta" é só quem foi de fato marcado ausente (nunca "não
 * registrado"), e conta por aluno distinto (um aluno com duas linhas de
 * chamada no mesmo domingo não vira dois presentes nem duas faltas).
 * ============================================================================
 *
 *   ?data=2026-08-16
 */
export const dynamic = "force-dynamic";

interface LinhaBruta { congId: number | null; presentes: bigint; faltas: bigint }

export async function GET(req: Request) {
  const { recusa } = await exigirLeitura("rel-consolidado");
  if (recusa) return recusa;

  const url = new URL(req.url);
  const dataStr = url.searchParams.get("data") || domingoMaisRecente();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return erro("Informe a data.", 400);
  const dia = new Date(`${dataStr}T00:00:00Z`);

  return responder(async () => {
    const [congregacoes, matriculados, porCongregacao, visitantes] = await Promise.all([
      prisma.congregacao.findMany({ select: { id: true, nome: true } }),
      prisma.aluno.groupBy({ by: ["congId"], where: { ativo: true }, _count: { _all: true } }),
      prisma.$queryRaw<LinhaBruta[]>`
        SELECT "congId",
               count(DISTINCT "alunoId") FILTER (WHERE presente)     AS presentes,
               count(DISTINCT "alunoId") FILTER (WHERE NOT presente) AS faltas
        FROM "Frequencias"
        WHERE data = ${dia}
        GROUP BY "congId"
      `,
      prisma.visitante.count({ where: { data: dia } }),
    ]);

    const matriculadosPorCong = new Map(matriculados.map((m) => [m.congId, m._count._all]));
    const presentesPorCong = new Map(porCongregacao.map((c) => [c.congId, Number(c.presentes)]));
    const faltasPorCong = new Map(porCongregacao.map((c) => [c.congId, Number(c.faltas)]));

    const linhas = congregacoes
      .map((c) => {
        const matriculadosCong = matriculadosPorCong.get(c.id) ?? 0;
        const presentes = presentesPorCong.get(c.id) ?? 0;
        const faltas = faltasPorCong.get(c.id) ?? 0;
        return {
          id: c.id,
          nome: c.nome?.trim() || `Congregação ${c.id}`,
          matriculados: matriculadosCong,
          presentes,
          faltas,
          // Fez chamada nesse domingo se marcou alguém, presente ou faltoso.
          participou: presentes + faltas > 0,
          taxa: matriculadosCong > 0 ? Math.round((presentes / matriculadosCong) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) =>
        b.taxa - a.taxa
        || b.presentes - a.presentes
        || b.matriculados - a.matriculados
        || a.nome.localeCompare(b.nome, "pt-BR"),
      );

    const participantes = linhas.filter((l) => l.participou);
    const totais = {
      matriculados: linhas.reduce((s, l) => s + l.matriculados, 0),
      presentes: linhas.reduce((s, l) => s + l.presentes, 0),
      faltas: linhas.reduce((s, l) => s + l.faltas, 0),
      visitantes,
      congregacoesParticipantes: participantes.length,
      congregacoesTotal: linhas.length,
    };
    const taxaCampo = totais.matriculados > 0 ? Math.round((totais.presentes / totais.matriculados) * 1000) / 10 : 0;

    return {
      data: dataStr,
      totais: { ...totais, taxa: taxaCampo },
      congregacoes: linhas.map(({ participou: _participou, ...resto }) => resto),
    };
  });
}
