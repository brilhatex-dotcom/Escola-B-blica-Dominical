import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { alvoDaConsulta, dataOu, MINIMO_DE_CHAMADAS, periodoPadrao, recorteSql } from "@/lib/relatorios/comum";

/**
 * Certificados de frequência.
 *
 * ============================================================================
 * O SISTEMA APURA, A IGREJA DECIDE
 *
 * Esta rota NÃO emite certificado nem grava nada: ela lista quem atinge o
 * critério de frequência no período. Emitir automaticamente transformaria um
 * reconhecimento da igreja num efeito colateral de uma consulta SQL — e o
 * primeiro erro de digitação numa chamada viraria um certificado indevido, com
 * o nome de alguém impresso nele.
 *
 * O piso de chamadas vale aqui com força ainda maior que no ranking: 100% de
 * presença em duas chamadas não é frequência exemplar, é amostra pequena.
 * ============================================================================
 *
 *   ?minimo=75   percentual exigido (padrão 75)
 */
export const dynamic = "force-dynamic";

interface Linha {
  id: number;
  nome: string;
  classe: string | null;
  congregacao: string | null;
  chamadas: bigint;
  presencas: bigint;
}

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("rel-certificados");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const padrao = periodoPadrao();
    const de = dataOu(url.searchParams.get("de"), padrao.de);
    const ate = dataOu(url.searchParams.get("ate"), padrao.ate);
    const minimo = Math.max(1, Math.min(100, lerInt(url, "minimo") ?? 75));

    const alvo = alvoDaConsulta(recorteDaSessao(sessao), lerInt(url, "cong"));
    const soAlvo = recorteSql(Prisma.sql`f."congId"`, alvo);

    const linhas = await prisma.$queryRaw<Linha[]>`
      SELECT a.id, a.nome, c.nome AS classe, g.nome AS congregacao,
             count(*)                           AS chamadas,
             count(*) FILTER (WHERE f.presente) AS presencas
      FROM "Frequencias" f
      JOIN "Alunos" a            ON a.id = f."alunoId" AND a.ativo
      LEFT JOIN "Classes" c      ON c.id = a."classeId"
      LEFT JOIN "Congregacoes" g ON g.id = a."congId"
      WHERE f.data BETWEEN ${de} AND ${ate} ${soAlvo}
      GROUP BY a.id, a.nome, c.nome, g.nome
      HAVING count(*) >= ${MINIMO_DE_CHAMADAS}
      ORDER BY (count(*) FILTER (WHERE f.presente))::numeric / count(*) DESC, a.nome
    `;

    const todos = linhas.map((l) => {
      const chamadas = Number(l.chamadas);
      const presencas = Number(l.presencas);
      return {
        id: l.id,
        nome: l.nome,
        classe: l.classe ?? "Sem classe",
        congregacao: l.congregacao?.trim() || "—",
        chamadas,
        presencas,
        taxa: Math.round((presencas / chamadas) * 1000) / 10,
      };
    });

    return {
      periodo: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) },
      minimo,
      minimoDeChamadas: MINIMO_DE_CHAMADAS,
      itens: todos.filter((a) => a.taxa >= minimo),
      // Quantos ficaram de fora, para a tela poder dizer "de 218 avaliados".
      avaliados: todos.length,
    };
  });
}
