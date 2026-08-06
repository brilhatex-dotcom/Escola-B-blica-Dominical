import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { dataCivil, erro, lerCorpo, texto, textoOpcional } from "@/lib/api";
import { escopoDeEscrita, exigirCongregacaoPermitida } from "@/lib/auth/escopo";
import { criarComIdHerdado } from "@/lib/api/legado";

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

/**
 * Cadastrar um evento.
 *
 * ============================================================================
 * `dataFim` NUNCA FICA VAZIA
 *
 * O sistema antigo guarda início e fim. Um evento de um dia só tem os dois
 * iguais — e é isso que a rota grava quando o fim não é informado.
 *
 * Deixar `dataFim` nula pareceria inofensivo e quebraria a agenda inteira: a
 * lista de "próximos" filtra por `dataFim` (senão um congresso de três dias
 * sumiria no segundo dia, que é o pior momento para desaparecer), e um nulo ali
 * tiraria o evento de todas as consultas sem erro nenhum.
 * ============================================================================
 */
export async function POST(req: Request) {
  const { recusa, congId: doAcesso, sessao } = await escopoDeEscrita("agenda-eventos");
  if (recusa) return recusa;

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  const titulo = texto(corpo.titulo, 160);
  if (!titulo) return erro("Informe o título do evento.", 400);

  const data = dataCivil(corpo.data);
  if (!data) return erro("Informe a data do evento (YYYY-MM-DD).", 400);

  const dataFim = dataCivil(corpo.dataFim) ?? data;
  if (dataFim < data) return erro("A data de término é anterior à de início.", 400);

  /*
   * Evento sem congregação é do CAMPO — e o campo inteiro o enxerga.
   * Quem só alcança uma congregação não pode criar evento de campo: o evento
   * nasce na congregação dele.
   */
  const congId = doAcesso ? (sessao?.congIds[0] ?? null) : congPedida(corpo.congId);
  exigirCongregacaoPermitida(doAcesso, congId ?? undefined);

  return responder(async () =>
    criarComIdHerdado(
      (tx) => tx.evento,
      (tx, id) =>
        tx.evento.create({
          data: {
            id,
            titulo,
            descricao: textoOpcional(corpo.descricao, 1000) ?? "",
            tipo: texto(corpo.tipo, 40) ?? "evento",
            local: textoOpcional(corpo.local, 160) ?? "",
            data,
            dataFim,
            obs: textoOpcional(corpo.obs, 500),
            congId,
          },
          select: { id: true, titulo: true },
        }),
    ),
  );
}

/** A congregação pedida, ou `null` para evento do campo inteiro. */
function congPedida(valor: unknown): number | null {
  return Number.isInteger(valor) ? (valor as number) : null;
}
