import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/**
 * O mês inteiro, dia a dia.
 *
 * ============================================================================
 * O DOMINGO DE EBD É DERIVADO, NÃO CADASTRADO
 *
 * Não existe tabela de "domingos de EBD" — a Escola Bíblica acontece todo
 * domingo, e isso é uma regra, não um dado. Cadastrar cada domingo do ano
 * criaria 52 linhas por ano para representar algo que o calendário já diz, e a
 * primeira vez que alguém esquecesse de cadastrar, o domingo sumiria do sistema.
 *
 * O que É dado, e por isso vem do banco, é se aquele domingo TEVE CHAMADA
 * registrada. Essas duas coisas juntas produzem a informação que interessa:
 * "domingo passado, e ninguém registrou" — que um calendário só com eventos
 * cadastrados nunca conseguiria mostrar.
 * ============================================================================
 *
 *   ?ano=2026&mes=8   padrão: mês corrente
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("agenda-calendario");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const agora = new Date();
    const ano = lerInt(url, "ano") ?? agora.getFullYear();
    const mesPedido = lerInt(url, "mes");
    const mes = mesPedido && mesPedido >= 1 && mesPedido <= 12 ? mesPedido : agora.getMonth() + 1;

    const recorte = recorteDaSessao(sessao);
    const pedida = lerInt(url, "cong");
    const congIds = recorte
      ? pedida !== null && recorte.in.includes(pedida) ? [pedida] : recorte.in
      : pedida !== null ? [pedida] : null;
    const filtroCong = congIds ? { congId: { in: congIds } } : {};

    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 0)); // dia 0 do mês seguinte = último deste
    const noMes = { gte: inicio, lte: fim };

    const [eventos, reunioes, avisos, chamadas, licoes] = await Promise.all([
      prisma.evento.findMany({
        // Um evento que ATRAVESSA o mês precisa aparecer: começou antes e
        // termina depois. Filtrar só por `data` esconderia o congresso que
        // começou dia 30 do mês passado.
        where: { ...filtroCong, data: { lte: fim }, dataFim: { gte: inicio } },
        select: { id: true, titulo: true, tipo: true, local: true, data: true, dataFim: true },
      }),
      prisma.reuniao.findMany({
        where: { data: noMes },
        select: { id: true, titulo: true, data: true, presentes: true, total: true },
      }),
      prisma.aviso.findMany({
        where: { ...filtroCong, dataPublicacao: noMes },
        select: { id: true, titulo: true, dataPublicacao: true, prioridade: true },
      }),
      // Domingos que TIVERAM chamada, e quantos presentes.
      prisma.frequencia.groupBy({
        by: ["data"],
        where: { data: noMes, ...filtroCong },
        _count: { _all: true },
      }),
      prisma.licao.findMany({
        where: { data: noMes },
        distinct: ["data"],
        select: { data: true, titulo: true, trim: true },
        orderBy: { data: "asc" },
      }),
    ]);

    const chave = (d: Date) => d.toISOString().slice(0, 10);
    const comChamada = new Set(chamadas.map((c) => chave(c.data)));
    const registrosPorDia = new Map(chamadas.map((c) => [chave(c.data), c._count._all]));
    const licaoPorDia = new Map(licoes.map((l) => [chave(l.data), l.titulo]));

    const hojeIso = new Date().toISOString().slice(0, 10);
    const dias: Array<{
      data: string;
      dia: number;
      diaSemana: number;
      ehDomingo: boolean;
      ehHoje: boolean;
      passou: boolean;
      chamadaRegistrada: boolean;
      registros: number;
      licao: string | null;
      eventos: Array<{ id: number; titulo: string; tipo: string; local: string }>;
      reunioes: Array<{ id: number; titulo: string; presentes: number; total: number }>;
      avisos: Array<{ id: number; titulo: string; prioridade: number }>;
    }> = [];

    for (let d = 1; d <= fim.getUTCDate(); d++) {
      const data = new Date(Date.UTC(ano, mes - 1, d));
      const iso = chave(data);
      const diaSemana = data.getUTCDay();

      dias.push({
        data: iso,
        dia: d,
        diaSemana,
        ehDomingo: diaSemana === 0,
        ehHoje: iso === hojeIso,
        passou: iso < hojeIso,
        chamadaRegistrada: comChamada.has(iso),
        registros: registrosPorDia.get(iso) ?? 0,
        licao: licaoPorDia.get(iso) ?? null,
        eventos: eventos
          .filter((e) => chave(e.data) <= iso && chave(e.dataFim) >= iso)
          .map((e) => ({ id: e.id, titulo: e.titulo, tipo: e.tipo || "evento", local: e.local || "" })),
        reunioes: reunioes
          .filter((r) => chave(r.data) === iso)
          .map((r) => ({ id: r.id, titulo: r.titulo, presentes: r.presentes, total: r.total })),
        avisos: avisos
          .filter((a) => chave(a.dataPublicacao) === iso)
          .map((a) => ({ id: a.id, titulo: a.titulo, prioridade: a.prioridade })),
      });
    }

    const domingos = dias.filter((d) => d.ehDomingo);

    return {
      ano,
      mes,
      // `startOfMonth` para a grade saber quantas células vazias põe antes do dia 1.
      primeiroDiaSemana: inicio.getUTCDay(),
      dias,
      resumo: {
        domingos: domingos.length,
        domingosComChamada: domingos.filter((d) => d.chamadaRegistrada).length,
        // Só conta como pendência o domingo que JÁ PASSOU sem registro. O
        // domingo que ainda vem não é pendência de ninguém.
        domingosSemChamada: domingos.filter((d) => d.passou && !d.chamadaRegistrada).length,
        eventos: eventos.length,
        reunioes: reunioes.length,
        avisos: avisos.length,
      },
    };
  });
}
