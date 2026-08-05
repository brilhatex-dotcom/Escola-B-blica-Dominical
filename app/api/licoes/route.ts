import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/**
 * Lições do trimestre, e o que cada classe já ministrou.
 *
 * Duas tabelas do sistema antigo respondem juntas: `Licoes` é o PLANO (o que
 * deveria ser dado, por trimestre e tipo de classe) e `Freq_Licao` é o
 * REGISTRO (qual classe deu qual lição, em que domingo). Separadas, nenhuma das
 * duas responde a pergunta que a secretaria faz — "as classes estão em dia?".
 *
 *   ?ano=2026   padrão: o ano corrente
 *   ?trim=3T    padrão: todos
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("licoes");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const ano = lerInt(url, "ano") ?? new Date().getFullYear();
    const trim = url.searchParams.get("trim")?.trim() || null;
    const recorte = recorteDaSessao(sessao);

    const [licoes, ministradas, trimestres] = await Promise.all([
      prisma.licao.findMany({
        where: { ano, ...(trim ? { trim } : {}) },
        orderBy: [{ trim: "asc" }, { data: "asc" }],
        select: {
          id: true,
          data: true,
          titulo: true,
          trim: true,
          tipoClasse: true,
          escopo: true,
        },
      }),

      /*
       * Quantas CLASSES DISTINTAS registraram cada lição.
       *
       * `groupBy` em vez de trazer as linhas e contar no JavaScript: são 65
       * registros hoje, mas cresce um por classe por domingo — em três anos são
       * milhares, e a contagem no servidor de aplicação passaria a trafegar
       * tudo para descartar quase tudo.
       */
      prisma.freqLicao.groupBy({
        by: ["licaoId"],
        where: { congId: recorte },
        _count: { _all: true },
      }),

      // Os trimestres que EXISTEM neste ano — a tela não deve oferecer "4T" num
      // ano que só tem três cadastrados.
      prisma.licao.findMany({
        where: { ano },
        distinct: ["trim"],
        orderBy: { trim: "asc" },
        select: { trim: true },
      }),
    ]);

    const registros = new Map(ministradas.map((m) => [m.licaoId, m._count._all]));

    const totalClasses = await prisma.classe.count({
      where: { ativa: true, congId: recorte },
    });

    return {
      ano,
      trim,
      trimestres: trimestres.map((t) => t.trim),
      totalClasses,
      itens: licoes.map((l) => ({
        id: l.id,
        data: l.data.toISOString().slice(0, 10),
        titulo: l.titulo,
        trim: l.trim,
        tipoClasse: l.tipoClasse,
        escopo: l.escopo,
        /*
         * `null` quando NENHUMA classe registrou, e 0 nunca aparece.
         *
         * Uma lição do próximo mês com "0 classes" parece atraso; sem registro
         * nenhum ela apenas ainda não chegou. A tela distingue os dois.
         */
        classesQueDeram: registros.get(l.id) ?? null,
      })),
      total: licoes.length,
    };
  });
}
