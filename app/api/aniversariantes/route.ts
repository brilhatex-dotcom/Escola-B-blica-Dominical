import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura } from "@/lib/auth/guarda";

/**
 * Aniversariantes do mês.
 *
 * ============================================================================
 * ANIVERSÁRIO NÃO TEM ANO — E É ISSO QUE TORNA A CONSULTA DIFERENTE
 *
 * `nasc` é a data de nascimento, com o ano em que a pessoa nasceu. Filtrar por
 * intervalo de datas (`BETWEEN '2026-08-01' AND '2026-08-31'`) não acha
 * ninguém: quem nasceu em 12/08/1974 está fora de qualquer intervalo de 2026.
 *
 * A comparação certa é por MÊS e DIA, ignorando o ano — daí o `EXTRACT(MONTH)`.
 * Um índice sobre `nasc` não ajuda nessa forma, e tudo bem: são 323 alunos, e a
 * varredura é instantânea. Otimizar aqui seria inventar um índice de expressão
 * para resolver um problema que não existe.
 * ============================================================================
 *
 * ============================================================================
 * A ÚNICA TELA SEM RECORTE POR CONGREGAÇÃO — POR DECISÃO EXPLÍCITA (FASE 18)
 *
 * Toda outra rota do portal intersecta o pedido com o recorte do acesso: um
 * Dirigente nunca vê o que é de outra congregação. Aniversariantes é a
 * exceção, e é deliberada — a liderança pediu que todo mundo, inclusive quem
 * só vê a própria congregação, enxergue os aniversariantes do CAMPO INTEIRO.
 * Faz sentido pastoral: aniversário é celebração da igreja toda, não segredo
 * de uma congregação. `exigirLeitura` continua valendo (precisa estar
 * logado e o módulo precisa estar liberado para o papel), só não há
 * `recorteDaSessao` aplicado ao resultado.
 * ============================================================================
 *
 *   ?mes=8      1 a 12 (padrão: o mês corrente)
 *   ?cong=3     uma congregação — filtro livre, não precisa ser a própria
 */
export const dynamic = "force-dynamic";

interface Linha {
  id: number;
  nome: string;
  nasc: Date;
  tel: string | null;
  classe: string | null;
  congregacao: string | null;
  congId: number | null;
}

export async function GET(req: Request) {
  const { recusa } = await exigirLeitura("aniversariantes");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const hoje = new Date();
    const pedido = lerInt(url, "mes");
    const mes = pedido && pedido >= 1 && pedido <= 12 ? pedido : hoje.getMonth() + 1;
    const congPedida = lerInt(url, "cong");

    // Sem recorte de propósito (ver o bloco acima) — o filtro `?cong=` é só
    // conveniência de tela, livre para qualquer congregação do campo.
    const filtro = congPedida !== null ? Prisma.sql` AND a."congId" = ${congPedida}` : Prisma.empty;

    const linhas = await prisma.$queryRaw<Linha[]>`
      SELECT a.id, a.nome, a.nasc, a.tel,
             c.nome AS classe, g.nome AS congregacao, a."congId"
      FROM "Alunos" a
      LEFT JOIN "Classes"      c ON c.id = a."classeId"
      LEFT JOIN "Congregacoes" g ON g.id = a."congId"
      WHERE a.ativo AND a.nasc IS NOT NULL
        AND EXTRACT(MONTH FROM a.nasc) = ${mes}
        ${filtro}
      ORDER BY EXTRACT(DAY FROM a.nasc), a.nome
    `;

    const anoAtual = hoje.getFullYear();

    return {
      mes,
      itens: linhas.map((l) => {
        const nasc = new Date(l.nasc);
        const dia = nasc.getUTCDate();
        return {
          id: l.id,
          nome: l.nome,
          dia,
          diaMes: `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
          // A idade que a pessoa COMPLETA neste mês — não a de hoje. Numa lista
          // de aniversariantes, "faz 15 anos" é o que interessa.
          idade: anoAtual - nasc.getUTCFullYear(),
          tel: l.tel,
          classe: l.classe ?? "Sem classe",
          congregacao: l.congregacao?.trim() || (l.congId ? `Congregação ${l.congId}` : "—"),
        };
      }),
      total: linhas.length,
    };
  });
}
