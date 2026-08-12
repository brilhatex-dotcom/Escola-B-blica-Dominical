import { prisma } from "@/lib/prisma";
import { dataCivil, erro, lerCorpo, responder, texto, textoOpcional } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { pessoaDeAluno, pessoaDeNome } from "@/lib/pessoas/resolver";
import { tipoCultoValido } from "@/lib/escalas/tiposCulto";

/**
 * Uma escala mensal: ver o mês inteiro, gravar o mês inteiro, apagar o mês.
 *
 * GRAVAR aqui sempre manda a GRADE INTEIRA de itens (e a lista inteira de
 * avisos) de uma vez, não um culto por vez — um mês tem mais de cem
 * lançamentos, e esperar cada um confirmar sozinho no servidor seria o
 * oposto do "mais rápido" que foi pedido. O cliente monta a lista toda na
 * tela e só então grava; o servidor apaga o que existia e cria de novo
 * dentro de UMA transação, para a tela nunca mostrar um mês pela metade se
 * a gravação falhar no meio.
 *
 * QUEM PREGA é sempre uma PESSOA de verdade — nunca um texto solto. Um nome
 * digitado que ainda não existe no cadastro é criado na hora (mesma regra de
 * `pessoaDeNome`, já usada para Dirigente/Professor): é o que permite contar
 * quantas vezes cada obreiro serve no mês e avisar de um conflito de agenda,
 * coisas impossíveis de fazer com um campo de texto livre.
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

interface ObreiroBruto { pessoaId?: unknown; alunoId?: unknown; nomeNovo?: unknown }
interface ItemBruto {
  data?: unknown; tipoCodigo?: unknown; congId?: unknown; local?: unknown;
  destaque?: unknown; ordem?: unknown; obreiros?: unknown;
}
interface AvisoBruto { data?: unknown; titulo?: unknown; descricao?: unknown; ordem?: unknown }

interface ItemValido {
  data: Date; tipoCodigo: number; congId: number | null; local: string;
  destaque: string | null; ordem: number; obreiros: ObreiroBruto[];
}
interface AvisoValido { data: Date | null; titulo: string; descricao: string; ordem: number }

function validarItem(bruto: ItemBruto, indice: number, congsValidas: Set<number>): ItemValido | string {
  const data = dataCivil(bruto.data);
  if (!data) return `Culto ${indice + 1}: data inválida.`;

  if (!tipoCultoValido(bruto.tipoCodigo)) return `Culto ${indice + 1}: tipo de culto inválido.`;

  let congId: number | null = null;
  if (bruto.congId !== null && bruto.congId !== undefined) {
    if (typeof bruto.congId !== "number" || !congsValidas.has(bruto.congId)) {
      return `Culto ${indice + 1}: congregação inválida.`;
    }
    congId = bruto.congId;
  }

  const local = texto(bruto.local, 120);
  if (!local) return `Culto ${indice + 1}: informe o local do culto.`;

  /*
   * Zero obreiro é um estado válido — é exatamente uma PENDÊNCIA (ver o
   * indicador na tela), o culto criado mas ainda sem ninguém escalado.
   * Recusar isso aqui obrigaria a lançar o obreiro no mesmo instante em que
   * o culto nasce, o que a lateral de arrastar-depois foi desenhada
   * para NÃO exigir.
   */
  if (!Array.isArray(bruto.obreiros)) return `Culto ${indice + 1}: lista de obreiros inválida.`;
  for (const o of bruto.obreiros as ObreiroBruto[]) {
    const temPessoa = Number.isInteger(o.pessoaId);
    const temAluno = Number.isInteger(o.alunoId);
    const temNome = typeof o.nomeNovo === "string" && o.nomeNovo.trim().length >= 2;
    if (!temPessoa && !temAluno && !temNome) return `Culto ${indice + 1}: obreiro inválido.`;
  }

  const ordem = typeof bruto.ordem === "number" && Number.isInteger(bruto.ordem) ? bruto.ordem : indice;

  return {
    data, tipoCodigo: bruto.tipoCodigo as number, congId, local, ordem,
    destaque: textoOpcional(bruto.destaque, 200),
    obreiros: bruto.obreiros as ObreiroBruto[],
  };
}

function validarAviso(bruto: AvisoBruto, indice: number): AvisoValido | string {
  const titulo = texto(bruto.titulo, 160);
  if (!titulo) return `Aviso ${indice + 1}: informe o título.`;
  const descricao = texto(bruto.descricao, 500);
  if (!descricao) return `Aviso ${indice + 1}: informe a descrição.`;
  const data = bruto.data ? dataCivil(bruto.data) : null;
  const ordem = typeof bruto.ordem === "number" && Number.isInteger(bruto.ordem) ? bruto.ordem : indice;
  return { data, titulo, descricao, ordem };
}

export async function GET(_req: Request, { params }: Contexto) {
  const { sessao, recusa } = await exigirLeitura("escalas");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Escala inválida.", 400);

  const escala = await prisma.escalaMensal.findUnique({
    where: { id },
    include: {
      itens: {
        orderBy: [{ data: "asc" }, { ordem: "asc" }],
        include: {
          congregacao: { select: { id: true, nome: true } },
          obreiros: {
            orderBy: { ordem: "asc" },
            include: { pessoa: { select: { id: true, nome: true, tratamento: true } } },
          },
        },
      },
      avisos: { orderBy: { ordem: "asc" } },
    },
  });
  if (!escala) return erro("Escala não encontrada.", 404);

  // Rascunho é obra em andamento — só quem pode editar acompanha o meio do caminho.
  if (escala.status !== "publicado" && recorteDaSessao(sessao) !== undefined) {
    return erro("Esta escala ainda não foi publicada.", 403);
  }

  return responder(async () => ({
    id: escala.id,
    titulo: escala.titulo,
    mesAno: escala.mesAno.toISOString().slice(0, 10),
    status: escala.status,
    publicadoEm: escala.publicadoEm?.toISOString() ?? null,
    publicadoPor: escala.publicadoPor,
    autor: escala.autor,
    atualizado: escala.atualizado.toISOString(),
    avisos: escala.avisos.map((a) => ({
      id: a.id, data: a.data?.toISOString().slice(0, 10) ?? null, titulo: a.titulo, descricao: a.descricao, ordem: a.ordem,
    })),
    itens: escala.itens.map((i) => ({
      id: i.id,
      data: i.data.toISOString().slice(0, 10),
      tipoCodigo: i.tipoCodigo,
      congId: i.congId,
      congregacao: i.congregacao?.nome ?? null,
      local: i.local,
      destaque: i.destaque,
      ordem: i.ordem,
      obreiros: i.obreiros.map((o) => ({
        pessoaId: o.pessoa.id, nome: o.pessoa.nome, tratamento: o.pessoa.tratamento,
      })),
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

  let avisosValidos: AvisoValido[] | undefined;
  if (corpo.avisos !== undefined) {
    if (!Array.isArray(corpo.avisos)) return erro("Lista de avisos inválida.", 400);
    avisosValidos = [];
    for (let i = 0; i < corpo.avisos.length; i++) {
      const resultado = validarAviso(corpo.avisos[i] as AvisoBruto, i);
      if (typeof resultado === "string") return erro(resultado, 400);
      avisosValidos.push(resultado);
    }
  }

  return responder(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.escalaMensal.update({
        where: { id },
        data: { ...(titulo ? { titulo } : {}) },
      });

      if (avisosValidos) {
        await tx.escalaAviso.deleteMany({ where: { escalaId: id } });
        if (avisosValidos.length > 0) {
          await tx.escalaAviso.createMany({
            data: avisosValidos.map((a) => ({ ...a, escalaId: id })),
          });
        }
      }

      if (itensValidos) {
        await tx.escalaItem.deleteMany({ where: { escalaId: id } });
        for (const it of itensValidos) {
          const { obreiros, ...dadosItem } = it;
          const criado = await tx.escalaItem.create({ data: { ...dadosItem, escalaId: id } });

          const pessoaIds: number[] = [];
          for (const o of obreiros) {
            const pessoaId = Number.isInteger(o.pessoaId)
              ? (o.pessoaId as number)
              : Number.isInteger(o.alunoId)
                ? await pessoaDeAluno(tx, o.alunoId as number)
                : await pessoaDeNome(tx, o.nomeNovo as string);
            if (!pessoaIds.includes(pessoaId)) pessoaIds.push(pessoaId);
          }
          if (pessoaIds.length > 0) {
            await tx.escalaItemObreiro.createMany({
              data: pessoaIds.map((pessoaId, ordem) => ({ itemId: criado.id, pessoaId, ordem })),
            });
          }
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
