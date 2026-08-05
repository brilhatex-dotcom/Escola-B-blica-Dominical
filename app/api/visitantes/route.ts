import { prisma } from "@/lib/prisma";
import { lerInt, lerPaginacao, pagina, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/** Visitantes recebidos. `?de=` e `?ate=` recortam por data ("YYYY-MM-DD"). */
/*
 * ============================================================================
 * A GUARDA CHEGOU DEPOIS — E ESSA É A LIÇÃO
 *
 * Esta rota nasceu na Fase 05, quando ainda não havia permissões. A Fase 08
 * trouxe o RBAC e protegeu o que ela mesma criou; as rotas anteriores ficaram
 * abertas, e ninguém percebeu porque a TELA já escondia o menu.
 *
 * Esconder o item do menu nunca protegeu nada: bastava digitar
 * `/api/alunos` no navegador para receber os 323 alunos do campo inteiro,
 * independentemente da congregação de quem pedia. O recorte que o painel
 * aplicava com cuidado não existia aqui.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("visitantes");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);
    const url = new URL(req.url);
    const { pagina: p, porPagina, pular } = lerPaginacao(url);
    const classeId = lerInt(url, "classe");
    const congId = lerInt(url, "cong");
    const de = url.searchParams.get("de");
    const ate = url.searchParams.get("ate");

    const alvo = recorte
      ? { in: congId !== null && recorte.in.includes(congId) ? [congId] : recorte.in }
      : congId !== null
        ? { in: [congId] }
        : undefined;

    const where = {
      ...(classeId ? { classeId } : {}),
      ...(alvo ? { congId: alvo } : {}),
      ...(de || ate
        ? {
            data: {
              ...(de ? { gte: new Date(`${de}T00:00:00Z`) } : {}),
              ...(ate ? { lte: new Date(`${ate}T00:00:00Z`) } : {}),
            },
          }
        : {}),
    };

    const [total, visitantes] = await Promise.all([
      prisma.visitante.count({ where }),
      prisma.visitante.findMany({
        where,
        orderBy: { data: "desc" },
        skip: pular,
        take: porPagina,
        select: {
          id: true,
          nome: true,
          idade: true,
          tel: true,
          obs: true,
          data: true,
          classe: { select: { id: true, nome: true } },
          congregacao: { select: { id: true, nome: true } },
        },
      }),
    ]);

    return pagina(visitantes, total, p, porPagina);
  });
}
