import { prisma } from "@/lib/prisma";
import { dataCivil, erro, lerCorpo, responder, texto, textoOpcional } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { tipoCultoValido } from "@/lib/escalas/tiposCulto";

/**
 * Uma escala mensal: ver o mês inteiro, gravar o mês inteiro, apagar o mês.
 *
 * GRAVAR aqui sempre manda a GRADE INTEIRA de itens de uma vez, não um culto
 * por vez — um mês tem mais de cem lançamentos, e esperar cada um confirmar
 * sozinho no servidor seria o oposto do "mais rápido" que foi pedido. O
 * cliente monta a lista toda na tela e só então grava; o servidor apaga os
 * itens antigos e cria os novos dentro de UMA transação, para a tela nunca
 * mostrar um mês pela metade se a gravação falhar no meio.
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

interface ItemBruto {
  data?: unknown;
  tipoCodigo?: unknown;
  congId?: unknown;
  local?: unknown;
  pregadores?: unknown;
  destaque?: unknown;
  ordem?: unknown;
}

interface ItemValido {
  data: Date;
  tipoCodigo: number;
  congId: number | null;
  local: string;
  pregadores: string;
  destaque: string | null;
  ordem: number;
}

/** Valida um item bruto do corpo da requisição. Devolve o motivo da recusa, ou `null` quando está tudo certo. */
function validarItem(bruto: ItemBruto, indice: number, congsValidas: Set<number>): ItemValido | string {
  const data = dataCivil(bruto.data);
  if (!data) return `Item ${indice + 1}: data inválida.`;

  if (!tipoCultoValido(bruto.tipoCodigo)) return `Item ${indice + 1}: tipo de culto inválido.`;

  let congId: number | null = null;
  if (bruto.congId !== null && bruto.congId !== undefined) {
    if (typeof bruto.congId !== "number" || !congsValidas.has(bruto.congId)) {
      return `Item ${indice + 1}: congregação inválida.`;
    }
    congId = bruto.congId;
  }

  const local = texto(bruto.local, 120);
  if (!local) return `Item ${indice + 1}: informe o local do culto.`;

  const pregadores = texto(bruto.pregadores, 300);
  if (!pregadores) return `Item ${indice + 1}: informe quem prega.`;

  const ordem = typeof bruto.ordem === "number" && Number.isInteger(bruto.ordem) ? bruto.ordem : indice;

  return { data, tipoCodigo: bruto.tipoCodigo, congId, local, pregadores, destaque: textoOpcional(bruto.destaque, 200), ordem };
}

export async function GET(_req: Request, { params }: Contexto) {
  const { recusa } = await exigirLeitura("escalas");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Escala inválida.", 400);

  const escala = await prisma.escalaMensal.findUnique({
    where: { id },
    include: {
      itens: {
        orderBy: [{ data: "asc" }, { ordem: "asc" }],
        include: { congregacao: { select: { id: true, nome: true } } },
      },
    },
  });
  if (!escala) return erro("Escala não encontrada.", 404);

  return responder(async () => ({
    id: escala.id,
    titulo: escala.titulo,
    mesAno: escala.mesAno.toISOString().slice(0, 10),
    avisos: escala.avisos ?? "",
    autor: escala.autor,
    atualizado: escala.atualizado.toISOString(),
    itens: escala.itens.map((i) => ({
      id: i.id,
      data: i.data.toISOString().slice(0, 10),
      tipoCodigo: i.tipoCodigo,
      congId: i.congId,
      congregacao: i.congregacao?.nome ?? null,
      local: i.local,
      pregadores: i.pregadores,
      destaque: i.destaque,
      ordem: i.ordem,
    })),
  }));
}

export async function PATCH(req: Request, { params }: Contexto) {
  const { sessao, recusa } = await exigirEscrita("escalas");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Escala inválida.", 400);

  if (recorteDaSessao(sessao)) {
    return erro("Só quem enxerga o campo inteiro edita a escala mensal.", 403);
  }

  const escala = await prisma.escalaMensal.findUnique({ where: { id }, select: { id: true } });
  if (!escala) return erro("Escala não encontrada.", 404);

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  const titulo = corpo.titulo === undefined ? undefined : texto(corpo.titulo, 160);
  if (corpo.titulo !== undefined && !titulo) return erro("Informe o título da escala.", 400);

  let itensValidos: ItemValido[] | undefined;
  if (corpo.itens !== undefined) {
    if (!Array.isArray(corpo.itens)) return erro("Lista de cultos inválida.", 400);

    const congs = await prisma.congregacao.findMany({ select: { id: true } });
    const congsValidas = new Set(congs.map((c) => c.id));

    itensValidos = [];
    for (let i = 0; i < corpo.itens.length; i++) {
      const resultado = validarItem(corpo.itens[i] as ItemBruto, i, congsValidas);
      if (typeof resultado === "string") return erro(resultado, 400);
      itensValidos.push(resultado);
    }
  }

  return responder(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.escalaMensal.update({
        where: { id },
        data: {
          ...(titulo ? { titulo } : {}),
          ...(corpo.avisos !== undefined ? { avisos: textoOpcional(corpo.avisos, 2000) } : {}),
        },
      });

      if (itensValidos) {
        await tx.escalaItem.deleteMany({ where: { escalaId: id } });
        if (itensValidos.length > 0) {
          await tx.escalaItem.createMany({
            data: itensValidos.map((it) => ({ ...it, escalaId: id })),
          });
        }
      }
    });

    return { ok: true };
  });
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const { sessao, recusa } = await exigirEscrita("escalas");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Escala inválida.", 400);

  if (recorteDaSessao(sessao)) {
    return erro("Só quem enxerga o campo inteiro apaga a escala mensal.", 403);
  }

  const escala = await prisma.escalaMensal.findUnique({ where: { id }, select: { id: true } });
  if (!escala) return erro("Escala não encontrada.", 404);

  return responder(async () => {
    await prisma.escalaMensal.delete({ where: { id } });
    return { ok: true };
  });
}
