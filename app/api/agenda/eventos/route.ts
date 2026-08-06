import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/**
 * Eventos do campo.
 *
 * O sistema antigo guarda `data` e `dataFim` — um evento pode durar dias
 * (congresso, semana de oração). A tela precisa distinguir o que ACONTECE HOJE
 * do que apenas COMEÇA hoje: um congresso de três dias continua acontecendo no
 * segundo dia, e sumir da lista nesse dia seria o pior momento para desaparecer.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("agenda-eventos");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const recorte = recorteDaSessao(sessao);
    const pedida = lerInt(url, "cong");
    const congIds = recorte
      ? pedida !== null && recorte.in.includes(pedida) ? [pedida] : recorte.in
      : pedida !== null ? [pedida] : null;

    const passados = url.searchParams.get("passados") === "1";
    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);

    const eventos = await prisma.evento.findMany({
      where: {
        ...(congIds ? { congId: { in: congIds } } : {}),
        // Em curso conta como futuro: filtra por `dataFim`, não por `data`.
        ...(passados ? { dataFim: { lt: hoje } } : { dataFim: { gte: hoje } }),
      },
      orderBy: { data: passados ? "desc" : "asc" },
      take: 60,
      include: { congregacao: { select: { id: true, nome: true } } },
    });

    return {
      itens: eventos.map((e) => {
        const inicio = e.data.toISOString().slice(0, 10);
        const fim = e.dataFim.toISOString().slice(0, 10);
        const hojeIso = hoje.toISOString().slice(0, 10);
        return {
          id: e.id,
          titulo: e.titulo,
          descricao: e.descricao || null,
          tipo: e.tipo || "evento",
          local: e.local || e.congregacao?.nome?.trim() || "Campo de Betânia",
          congregacao: e.congregacao?.nome?.trim() || (e.congId ? `Congregação ${e.congId}` : null),
          inicio,
          fim,
          diasDeDuracao: Math.max(1, Math.round((+e.dataFim - +e.data) / 86_400_000) + 1),
          emCurso: inicio <= hojeIso && fim >= hojeIso,
          obs: e.obs || null,
        };
      }),
      total: eventos.length,
      passados,
    };
  });
}
