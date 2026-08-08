import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { alvoDaConsulta, dataOu, MINIMO_DE_CHAMADAS, periodoPadrao, recorteSql } from "@/lib/relatorios/comum";

/**
 * Ranking por congregação e por classe.
 *
 * ============================================================================
 * ORDENA POR TAXA, NÃO POR TOTAL — E EXIGE UM MÍNIMO DE CHAMADAS
 *
 * Ordenar pelo total de presenças faria o Templo Sede (92 alunos) ganhar de
 * todas as congregações todos os meses, por ser maior. Isso não é um ranking,
 * é a lista de tamanhos — e a Cong. Bandeiras, com 7 alunos e frequência
 * perfeita, ficaria em último para sempre.
 *
 * A taxa corrige o tamanho, mas cria outro problema: quem foi chamado uma vez e
 * estava presente marca 100%. Daí o piso de chamadas — abaixo dele a linha
 * aparece, mas FORA da classificação, com o motivo escrito.
 * ============================================================================
 *
 * ============================================================================
 * O RANKING DE CONGREGAÇÕES NUNCA SE RECORTA — SENÃO NÃO É RANKING
 *
 * Um "ranking" com uma linha só (a própria congregação de quem está vendo)
 * não classifica nada: a pergunta que essa tela responde é "em que posição a
 * minha congregação está, comparada com as outras do campo?", e essa
 * pergunta exige ver as outras. Por isso a consulta de congregações roda
 * sempre sem filtro — inclusive ignorando `?cong=`, que só faz sentido para
 * o ranking de CLASSES (comparar as classes de uma congregação entre si é
 * uma pergunta razoável; comparar UMA congregação com ela mesma não é). O
 * ranking de classes continua recortado como sempre: comparar a classe de
 * uma congregação de 80 pessoas com a de uma de 15 mistura populações
 * diferentes, e quem só enxerga a própria congregação não tem o que fazer
 * com o resultado de outra.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

interface LinhaBruta {
  id: number | null;
  nome: string | null;
  congregacao?: string | null;
  chamadas: bigint;
  presencas: bigint;
  domingos: bigint;
  alunos: bigint;
}

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("rel-ranking");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const padrao = periodoPadrao();
    const de = dataOu(url.searchParams.get("de"), padrao.de);
    const ate = dataOu(url.searchParams.get("ate"), padrao.ate);

    const alvo = alvoDaConsulta(recorteDaSessao(sessao), lerInt(url, "cong"));
    const soAlvo = recorteSql(Prisma.sql`f."congId"`, alvo);

    const [congregacoes, classes] = await Promise.all([
      prisma.$queryRaw<LinhaBruta[]>`
        SELECT g.id, g.nome,
               count(*)                              AS chamadas,
               count(*) FILTER (WHERE f.presente)    AS presencas,
               count(DISTINCT f.data)                AS domingos,
               count(DISTINCT f."alunoId")           AS alunos
        FROM "Frequencias" f
        JOIN "Congregacoes" g ON g.id = f."congId"
        WHERE f.data BETWEEN ${de} AND ${ate}
        GROUP BY g.id, g.nome
      `,
      prisma.$queryRaw<LinhaBruta[]>`
        SELECT c.id, c.nome, g.nome AS congregacao,
               count(*)                              AS chamadas,
               count(*) FILTER (WHERE f.presente)    AS presencas,
               count(DISTINCT f.data)                AS domingos,
               count(DISTINCT f."alunoId")           AS alunos
        FROM "Frequencias" f
        JOIN "Classes" c        ON c.id = f."classeId"
        LEFT JOIN "Congregacoes" g ON g.id = f."congId"
        WHERE f.data BETWEEN ${de} AND ${ate} ${soAlvo}
        GROUP BY c.id, c.nome, g.nome
      `,
    ]);

    const preparar = (linhas: LinhaBruta[]) =>
      linhas
        .map((l) => {
          const chamadas = Number(l.chamadas);
          const presencas = Number(l.presencas);
          return {
            id: l.id,
            nome: l.nome?.trim() || (l.id ? `Congregação ${l.id}` : "—"),
            congregacao: l.congregacao?.trim() ?? null,
            chamadas,
            presencas,
            domingos: Number(l.domingos),
            alunos: Number(l.alunos),
            taxa: chamadas > 0 ? Math.round((presencas / chamadas) * 1000) / 10 : 0,
            // Fora da classificação, e a tela diz por quê — em vez de sumir e
            // deixar alguém procurando a própria classe na lista.
            classificado: Number(l.domingos) >= MINIMO_DE_CHAMADAS,
          };
        })
        .sort((a, b) =>
          a.classificado !== b.classificado
            ? Number(b.classificado) - Number(a.classificado)
            : b.taxa - a.taxa || b.presencas - a.presencas,
        );

    return {
      periodo: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) },
      minimoDeDomingos: MINIMO_DE_CHAMADAS,
      congregacoes: preparar(congregacoes),
      classes: preparar(classes),
    };
  });
}
