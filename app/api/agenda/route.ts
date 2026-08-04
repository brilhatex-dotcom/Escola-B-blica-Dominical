import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";

/**
 * Agenda: eventos, escalas de culto e reuniões.
 *
 * Junta EVENTOS e REUNIOES, que no sistema antigo eram abas separadas mas para
 * quem usa sempre foram a mesma pergunta: "o que vai acontecer". A tela nao
 * deveria herdar essa divisao — quem abre a agenda quer a proxima coisa, nao
 * escolher em qual aba procurar.
 *
 * ESCALA DE CULTOS FICA DE FORA, e por um motivo concreto: apesar do nome, ela
 * NAO e um compromisso. Olhando as colunas (`mesAno`, `nomeArquivo`, `url`,
 * `urlPreview`), o que a igreja guardava ali era o ARQUIVO da escala do mes —
 * uma folha digitalizada, nao um horario. Coloca-la na linha do tempo como
 * "culto do dia 1º" inventaria um evento que nunca existiu. Ela sai numa lista
 * propria, de documentos.
 *
 *   ?passados=1   inclui o que já aconteceu (padrão: só daqui para a frente)
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return responder(async () => {
    const url = new URL(req.url);
    const congId = lerInt(url, "cong");
    const incluirPassados = url.searchParams.get("passados") === "1";

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const corte = incluirPassados ? undefined : hoje;
    const filtroData = corte ? { gte: corte } : {};

    const [eventos, escalas, reunioes] = await Promise.all([
      prisma.evento.findMany({
        where: { data: filtroData, ...(congId ? { congId } : {}) },
        orderBy: { data: incluirPassados ? "desc" : "asc" },
        take: 40,
        include: { congregacao: { select: { nome: true } } },
      }),
      // Escalas: documentos do mes, ordenados do mais recente para tras.
      prisma.escalaCulto.findMany({
        where: congId ? { congId } : {},
        orderBy: { mesAno: "desc" },
        take: 12,
        include: { congregacao: { select: { nome: true } } },
      }),
      prisma.reuniao.findMany({
        where: { data: filtroData },
        orderBy: { data: incluirPassados ? "desc" : "asc" },
        take: 40,
      }),
    ]);

    const itens = [
      ...eventos.map((e) => ({
        id: `evento-${e.id}`,
        origem: "evento" as const,
        tipo: (e.tipo?.toLowerCase() ?? "evento") as string,
        titulo: e.titulo,
        local: e.local || e.congregacao?.nome || "Campo de Betânia",
        data: e.data.toISOString(),
        detalhe: e.obs || e.descricao || null,
      })),
      ...reunioes.map((r) => ({
        id: `reuniao-${r.id}`,
        origem: "reuniao" as const,
        tipo: "reuniao",
        titulo: r.titulo,
        local: r.local || "Campo de Betânia",
        data: r.data.toISOString(),
        detalhe: `${r.presentes} de ${r.total} presentes`,
      })),
    ];

    // A ordenacao final tem de ser feita AQUI: cada consulta ordenou a sua
    // propria lista, e tres listas ordenadas concatenadas nao formam uma lista
    // ordenada.
    itens.sort((a, b) =>
      incluirPassados ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data),
    );

    return {
      itens: itens.slice(0, 40),
      total: itens.length,
      escalas: escalas.map((e) => ({
        id: e.id,
        titulo: e.titulo,
        mesAno: e.mesAno.toISOString().slice(0, 10),
        arquivo: e.nomeArquivo,
        url: e.url,
        congregacao: e.congregacao?.nome ?? null,
      })),
    };
  });
}
