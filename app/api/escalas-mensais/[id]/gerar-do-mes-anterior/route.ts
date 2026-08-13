import { prisma } from "@/lib/prisma";
import { erro, lerCorpo, responder } from "@/lib/api";
import { exigirEscrita, recorteDaSessao } from "@/lib/auth/guarda";

/**
 * Gerar a escala do mês a partir de um mês anterior já lançado.
 *
 * ============================================================================
 * MESMO DIA DA SEMANA, MESMA POSIÇÃO NO MÊS — NÃO A MESMA DATA
 *
 * A escala oficial já nasce organizada assim no PDF: "1º Domingo", "2ª
 * Segunda-Feira"… — a posição do dia da semana dentro do mês, não o número
 * do dia. Repetir a escala de um mês no outro é essa mesma conta: o "1º
 * Domingo" de agosto vira o "1º Domingo" de setembro, esteja em que dia
 * estiver. Uma 5ª ocorrência que não existe no mês de destino (nem todo mês
 * tem cinco segundas-feiras) fica de fora — o pastor completa esse dia à
 * mão, se precisar.
 *
 * Os OBREIROS são copiados pelo `pessoaId` já resolvido no mês de origem —
 * não pelo nome — então não passa pela resolução de nome novo, e não corre
 * risco de duplicar pessoa.
 * ============================================================================
 *
 * POST { origemId } — a escala de destino é a do `[id]` da rota; precisa
 * estar vazia (sem cultos), para não misturar com o que já foi lançado nela.
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

function ocorrenciaNoMes(data: Date): number {
  return Math.ceil(data.getUTCDate() / 7);
}

/** A mesma posição (dia da semana + ocorrência) de `dataOrigem`, dentro de `mesDestino`. `null` se essa ocorrência não existir no mês de destino. */
function remapearData(dataOrigem: Date, mesDestino: Date): Date | null {
  const diaSemana = dataOrigem.getUTCDay();
  const ocorrencia = ocorrenciaNoMes(dataOrigem);
  const primeiroDoMes = new Date(Date.UTC(mesDestino.getUTCFullYear(), mesDestino.getUTCMonth(), 1));
  const diaSemanaPrimeiro = primeiroDoMes.getUTCDay();
  const diaAlvo = 1 + ((diaSemana - diaSemanaPrimeiro + 7) % 7) + (ocorrencia - 1) * 7;
  const resultado = new Date(Date.UTC(mesDestino.getUTCFullYear(), mesDestino.getUTCMonth(), diaAlvo));
  return resultado.getUTCMonth() === mesDestino.getUTCMonth() ? resultado : null;
}

export async function POST(req: Request, { params }: Contexto) {
  const { sessao, recusa } = await exigirEscrita("escalas");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Escala inválida.", 400);
  if (recorteDaSessao(sessao)) {
    return erro("Só quem enxerga o campo inteiro monta a escala mensal.", 403);
  }

  const corpo = await lerCorpo(req);
  const origemId = Number(corpo?.origemId);
  if (!Number.isInteger(origemId)) return erro("Informe o mês de referência.", 400);
  if (origemId === id) return erro("Escolha um mês diferente deste.", 400);

  const [destino, origem] = await Promise.all([
    prisma.escalaMensal.findUnique({ where: { id }, select: { id: true, mesAno: true, _count: { select: { itens: true } } } }),
    prisma.escalaMensal.findUnique({
      where: { id: origemId },
      include: {
        itens: { include: { obreiros: { orderBy: { ordem: "asc" }, select: { pessoaId: true } } } },
        avisos: true,
      },
    }),
  ]);
  if (!destino) return erro("Escala não encontrada.", 404);
  if (!origem) return erro("Mês de referência não encontrado.", 404);
  if (destino._count.itens > 0) {
    return erro("Esta escala já tem cultos lançados — gerar do mês anterior é só para um mês vazio.", 409);
  }

  return responder(async () => {
    let ignorados = 0;
    const dadosItens: {
      escalaId: number; data: Date; tipoCodigo: number; congId: number | null;
      local: string; destaque: string | null; ordem: number; pessoaIds: number[];
    }[] = [];
    for (const it of origem.itens) {
      const novaData = remapearData(it.data, destino.mesAno);
      if (!novaData) { ignorados++; continue; }
      dadosItens.push({
        escalaId: id, data: novaData, tipoCodigo: it.tipoCodigo, congId: it.congId,
        local: it.local, destaque: it.destaque, ordem: it.ordem,
        pessoaIds: it.obreiros.map((o) => o.pessoaId),
      });
    }

    const dadosAvisos = origem.avisos.map((a) => ({
      escalaId: id,
      data: a.data ? remapearData(a.data, destino.mesAno) : null,
      titulo: a.titulo, descricao: a.descricao, ordem: a.ordem,
    }));

    await prisma.$transaction(async (tx) => {
      for (const it of dadosItens) {
        const { pessoaIds, ...dadosItem } = it;
        const criado = await tx.escalaItem.create({ data: dadosItem });
        if (pessoaIds.length > 0) {
          await tx.escalaItemObreiro.createMany({
            data: pessoaIds.map((pessoaId, ordem) => ({ itemId: criado.id, pessoaId, ordem })),
          });
        }
      }
      if (dadosAvisos.length > 0) {
        await tx.escalaAviso.createMany({ data: dadosAvisos });
      }
    });

    return { ok: true, criados: dadosItens.length, ignorados, avisos: dadosAvisos.length };
  });
}
