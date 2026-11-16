import { prisma } from "@/lib/prisma";

/**
 * Falta justificada — o liga/desliga e as peças de SQL que os relatórios usam.
 *
 * ============================================================================
 * A TABELA PODE AINDA NÃO EXISTIR, E ISSO É NORMAL
 *
 * O Vercel publica o código sem rodar migração; "Faltas_Justificadas" só passa
 * a existir quando alguém roda prisma/aplicar-falta-justificada.sql no Neon.
 * Entre uma coisa e outra, qualquer consulta que citasse a tabela quebraria —
 * e a Chamada é a última tela que pode quebrar num domingo.
 *
 * Por isso nada consulta a tabela sem perguntar antes aqui. Sem ela, a
 * Chamada esconde o botão "Justificada" e os relatórios contam como sempre
 * contaram. Com ela, tudo liga sozinho — a resposta "não existe" vale só um
 * minuto, para o recurso aparecer logo depois do SQL, sem republicar nada.
 * ============================================================================
 */

let conhecido: { existe: boolean; em: number } | null = null;
const REPERGUNTAR_MS = 60_000;

export async function justificadasDisponiveis(): Promise<boolean> {
  if (conhecido?.existe) return true;
  if (conhecido && Date.now() - conhecido.em < REPERGUNTAR_MS) return false;

  let existe = false;
  try {
    const r = await prisma.$queryRaw<Array<{ t: string | null }>>`
      SELECT to_regclass('public."Faltas_Justificadas"')::text AS t
    `;
    existe = Boolean(r[0]?.t);
  } catch {
    existe = false;
  }
  conhecido = { existe, em: Date.now() };
  return existe;
}

/**
 * Quantas justificadas por congregação num dia — para os relatórios que
 * dividem pelos MATRICULADOS (Consolidado, Encarte, Semanal): quem justificou
 * sai da conta naquele domingo, igual a quem nem estava matriculado ainda.
 */
export async function justificadasPorCongNoDia(dia: Date): Promise<Map<number, number>> {
  if (!(await justificadasDisponiveis())) return new Map();
  const linhas = await prisma.$queryRaw<Array<{ congId: number | null; n: bigint }>>`
    SELECT "congId", count(DISTINCT "alunoId") AS n
    FROM "Faltas_Justificadas"
    WHERE data = ${dia}
    GROUP BY "congId"
  `;
  return new Map(linhas.filter((l) => l.congId !== null).map((l) => [l.congId as number, Number(l.n)]));
}
