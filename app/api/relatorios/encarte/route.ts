import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirLeitura } from "@/lib/auth/guarda";
import { domingoMaisRecente } from "@/lib/dashboard/formato";

interface LinhaBruta { congId: number | null; chamados: bigint; presentes: bigint }

/**
 * Dados para o Encarte de Destaques — o Top 3 de presença de um domingo,
 * pronto para virar imagem e ir pro grupo do WhatsApp.
 *
 * ============================================================================
 * AQUI A CONTA É "PRESENTES ÷ MATRICULADOS", DE PROPÓSITO — DIFERENTE DO
 * RESTO DOS RELATÓRIOS
 *
 * Frequência e Ranking dividem por CHAMADOS (quem foi de fato marcado
 * naquele domingo), nunca por matriculados — porque comparar períodos
 * longos com o quadro de matrícula de HOJE distorce o passado. O Encarte é
 * outra pergunta: "das pessoas que a congregação tem HOJE, quantas vieram
 * NESTE domingo?" — o mesmo indicador que o Relatório Semanal já mostra
 * (coluna "Matric."), só que campo inteiro e ordenado. Por ser sobre o
 * presente, não o passado, dividir pelo quadro atual aqui é a conta certa.
 *
 * Congregação sem chamada registrada nesse domingo fica DE FORA do ranking
 * (não é "0%" — é sem dado, igual às outras telas da casa). Congregação sem
 * nenhum aluno matriculado também fica de fora — não dá para tirar
 * percentual de uma divisão por zero.
 * ============================================================================
 *
 *   ?data=2026-08-16
 */
export const dynamic = "force-dynamic";

interface Linha {
  id: number;
  nome: string;
  matriculados: number;
  presentes: number;
  percentual: number;
}

export async function GET(req: Request) {
  const { recusa } = await exigirLeitura("rel-encarte");
  if (recusa) return recusa;

  const url = new URL(req.url);
  const dataStr = url.searchParams.get("data") || domingoMaisRecente();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return erro("Informe a data da EBD.", 400);
  const dia = new Date(`${dataStr}T00:00:00Z`);

  return responder(async () => {
    const [congregacoes, matriculados, porCongregacao] = await Promise.all([
      prisma.congregacao.findMany({ select: { id: true, nome: true } }),
      prisma.aluno.groupBy({ by: ["congId"], where: { ativo: true }, _count: { _all: true } }),
      /*
       * DISTINCT alunoId, não `count(*)` — um aluno pode ter mais de uma
       * linha de chamada no mesmo domingo (ex.: matriculado em duas
       * classes), e contar linha por linha infla "presentes" além do que
       * existe gente matriculada, gerando um percentual acima de 100%
       * numa imagem que vai pro grupo do WhatsApp.
       */
      prisma.$queryRaw<LinhaBruta[]>`
        SELECT "congId",
               count(DISTINCT "alunoId")                          AS chamados,
               count(DISTINCT "alunoId") FILTER (WHERE presente)  AS presentes
        FROM "Frequencias"
        WHERE data = ${dia}
        GROUP BY "congId"
      `,
    ]);

    const matriculadosPorCong = new Map(matriculados.map((m) => [m.congId, m._count._all]));
    const chamadasPorCong = new Map(porCongregacao.map((c) => [c.congId, Number(c.chamados)]));
    const presencasPorCong = new Map(porCongregacao.map((c) => [c.congId, Number(c.presentes)]));

    const linhas: Linha[] = congregacoes
      .map((c) => {
        const matric = matriculadosPorCong.get(c.id) ?? 0;
        const chamou = (chamadasPorCong.get(c.id) ?? 0) > 0;
        const presentes = presencasPorCong.get(c.id) ?? 0;
        return {
          id: c.id,
          nome: c.nome?.trim() || `Congregação ${c.id}`,
          matriculados: matric,
          presentes,
          percentual: matric > 0 ? Math.round((presentes / matric) * 1000) / 10 : 0,
          // Elegível: tem gente matriculada E fez chamada nesse domingo —
          // as duas condições que evitam dividir por zero e evitam
          // classificar quem não tem dado nenhum naquele dia.
          elegivel: matric > 0 && chamou,
        };
      })
      .filter((l) => l.elegivel)
      .sort((a, b) =>
        b.percentual - a.percentual
        || b.presentes - a.presentes
        || b.matriculados - a.matriculados
        || a.nome.localeCompare(b.nome, "pt-BR"),
      )
      .map(({ elegivel: _elegivel, ...resto }) => resto);

    return {
      data: dataStr,
      congregacoes: linhas,
      valido: linhas.length >= 3,
      motivo:
        linhas.length >= 3
          ? null
          : `Não foi possível gerar o Top 3 porque apenas ${linhas.length} congregaç${linhas.length === 1 ? "ão possui" : "ões possuem"} dados de presença nesta data.`,
    };
  });
}
