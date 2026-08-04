import { prisma } from "@/lib/prisma";
import { lerInt, lerPaginacao, pagina, responder } from "@/lib/api";

/** Visitantes recebidos. `?de=` e `?ate=` recortam por data ("YYYY-MM-DD"). */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return responder(async () => {
    const url = new URL(req.url);
    const { pagina: p, porPagina, pular } = lerPaginacao(url);
    const classeId = lerInt(url, "classe");
    const congId = lerInt(url, "cong");
    const de = url.searchParams.get("de");
    const ate = url.searchParams.get("ate");

    const where = {
      ...(classeId ? { classeId } : {}),
      ...(congId ? { congId } : {}),
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
