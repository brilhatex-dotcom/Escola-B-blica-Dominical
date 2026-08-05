import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { alvoDaConsulta, recorteSql } from "@/lib/relatorios/comum";

/**
 * Alerta de faltas: quem está sumindo.
 *
 * ============================================================================
 * FALTAS SEGUIDAS, CONTADAS SOBRE AS CHAMADAS DAQUELE ALUNO
 *
 * "Faltou os últimos 3 domingos" parece simples e esconde uma armadilha: se a
 * classe não fez chamada em dois desses domingos, o aluno não faltou — ninguém
 * chamou. Contar domingos do calendário produziria uma lista de alunos sumidos
 * que na verdade denuncia classes que não registraram.
 *
 * Aqui a sequência é contada sobre as linhas que EXISTEM para aquele aluno, em
 * ordem de data. A resposta traz também a data da última presença, que é a
 * informação que o professor usa para telefonar.
 * ============================================================================
 *
 *   ?minimo=3   faltas seguidas para entrar na lista (padrão 3)
 */
export const dynamic = "force-dynamic";

interface Linha {
  id: number;
  nome: string;
  tel: string | null;
  resp: string | null;
  classe: string | null;
  congregacao: string | null;
  seguidas: bigint;
  ultimaPresenca: Date | null;
  ultimaChamada: Date;
}

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("rel-faltas");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const minimo = Math.max(1, Math.min(12, lerInt(url, "minimo") ?? 3));
    const alvo = alvoDaConsulta(recorteDaSessao(sessao), lerInt(url, "cong"));
    const soAlvo = recorteSql(Prisma.sql`f."congId"`, alvo);

    /*
     * A sequência é resolvida no banco, não em JavaScript.
     *
     * `ROW_NUMBER()` numera as chamadas de cada aluno da mais recente para a
     * mais antiga; a sequência de faltas é quantas linhas de topo têm
     * `presente = false` antes da primeira presença. Trazendo as 2.599
     * frequências para a aplicação e agrupando lá, o custo cresceria com a
     * tabela — e ela cresce ~2.600 linhas por ano.
     */
    const linhas = await prisma.$queryRaw<Linha[]>`
      WITH ordenadas AS (
        SELECT f."alunoId", f.data, f.presente,
               ROW_NUMBER() OVER (PARTITION BY f."alunoId" ORDER BY f.data DESC) AS pos
        FROM "Frequencias" f
        JOIN "Alunos" al ON al.id = f."alunoId" AND al.ativo
        WHERE true ${soAlvo}
      ),
      primeira_presenca AS (
        SELECT "alunoId", MIN(pos) AS pos_presenca, MAX(data) FILTER (WHERE presente) AS ultima_presenca
        FROM ordenadas WHERE presente GROUP BY "alunoId"
      ),
      resumo AS (
        SELECT o."alunoId",
               COALESCE(p.pos_presenca - 1, MAX(o.pos)) AS seguidas,
               p.ultima_presenca,
               MAX(o.data) AS ultima_chamada
        FROM ordenadas o
        LEFT JOIN primeira_presenca p ON p."alunoId" = o."alunoId"
        GROUP BY o."alunoId", p.pos_presenca, p.ultima_presenca
      )
      SELECT a.id, a.nome, a.tel, a.resp,
             c.nome AS classe, g.nome AS congregacao,
             r.seguidas, r.ultima_presenca AS "ultimaPresenca", r.ultima_chamada AS "ultimaChamada"
      FROM resumo r
      JOIN "Alunos" a          ON a.id = r."alunoId"
      LEFT JOIN "Classes" c    ON c.id = a."classeId"
      LEFT JOIN "Congregacoes" g ON g.id = a."congId"
      WHERE r.seguidas >= ${minimo}
      ORDER BY r.seguidas DESC, a.nome
      LIMIT 200
    `;

    return {
      minimo,
      itens: linhas.map((l) => ({
        id: l.id,
        nome: l.nome,
        tel: l.tel,
        responsavel: l.resp,
        classe: l.classe ?? "Sem classe",
        congregacao: l.congregacao?.trim() || "—",
        seguidas: Number(l.seguidas),
        // `null` = nunca esteve presente nos registros. É diferente de "faltou
        // desde tal dia", e o professor precisa saber qual dos dois é.
        ultimaPresenca: l.ultimaPresenca ? l.ultimaPresenca.toISOString().slice(0, 10) : null,
        ultimaChamada: l.ultimaChamada.toISOString().slice(0, 10),
      })),
      total: linhas.length,
    };
  });
}
