import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { dataCivil, erro, lerCorpo, texto, textoOpcional } from "@/lib/api";
import { escopoDeEscrita, exigirCongregacaoPermitida } from "@/lib/auth/escopo";
import { autorDa, criarComIdHerdado } from "@/lib/api/legado";

/**
 * Avisos da igreja.
 *
 * ============================================================================
 * UM AVISO EXPIRADO NÃO É UM AVISO
 *
 * `dataExpiracao` existe no cadastro antigo e nunca foi usada para nada — a
 * planilha mostrava todos juntos. Mas um aviso que venceu não é apenas "antigo":
 * ele pode estar ERRADO. "Culto às 19h no dia 12" continua no mural em março do
 * ano seguinte e manda a igreja para o lugar errado.
 *
 * Por isso os vigentes vêm separados dos vencidos, e a lista abre nos vigentes.
 * Os vencidos continuam acessíveis — apagar histórico não é papel desta tela.
 * ============================================================================
 *
 * `prioridade` é um número no cadastro antigo. Quanto MENOR, mais urgente —
 * confirmado nos dados: 1 aparece nos avisos de convocação.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("agenda-avisos");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const recorte = recorteDaSessao(sessao);
    const pedida = lerInt(url, "cong");
    const congIds = recorte
      ? pedida !== null && recorte.in.includes(pedida) ? [pedida] : recorte.in
      : pedida !== null ? [pedida] : null;

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    const filtroCong = congIds ? { congId: { in: congIds } } : {};

    const [vigentes, vencidos] = await Promise.all([
      prisma.aviso.findMany({
        where: { ...filtroCong, dataExpiracao: { gte: hoje } },
        orderBy: [{ prioridade: "asc" }, { dataPublicacao: "desc" }],
        include: { congregacao: { select: { nome: true } } },
      }),
      prisma.aviso.findMany({
        where: { ...filtroCong, dataExpiracao: { lt: hoje } },
        orderBy: { dataExpiracao: "desc" },
        take: 40,
        include: { congregacao: { select: { nome: true } } },
      }),
    ]);

    const preparar = (a: (typeof vigentes)[number]) => ({
      id: a.id,
      titulo: a.titulo,
      texto: a.texto,
      prioridade: a.prioridade,
      publicado: a.dataPublicacao.toISOString().slice(0, 10),
      expira: a.dataExpiracao.toISOString().slice(0, 10),
      autor: a.autor,
      congregacao: a.congregacao?.nome?.trim() || null,
      // Quantos dias faltam para vencer. Negativo já venceu.
      diasRestantes: Math.round((+a.dataExpiracao - +hoje) / 86_400_000),
    });

    return {
      vigentes: vigentes.map(preparar),
      vencidos: vencidos.map(preparar),
    };
  });
}

/**
 * Publicar um aviso.
 *
 * ============================================================================
 * A DATA DE EXPIRAÇÃO É OBRIGATÓRIA — E ISSO É DE PROPÓSITO
 *
 * O cadastro antigo tinha o campo e nunca o usava: a planilha mostrava todos os
 * avisos juntos, para sempre. "Culto às 19h no dia 12" continuava no mural em
 * março do ano seguinte, mandando a igreja para o lugar errado.
 *
 * Um aviso vencido não é apenas antigo — ele pode estar ERRADO. Exigir a data
 * na publicação obriga quem escreve a responder "até quando isto vale?", que é
 * a pergunta que ninguém fazia. O aviso não é apagado ao vencer: sai dos
 * vigentes e continua consultável.
 * ============================================================================
 */
export async function POST(req: Request) {
  const { recusa, congId: doAcesso, sessao } = await escopoDeEscrita("agenda-avisos");
  if (recusa) return recusa;

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  const titulo = texto(corpo.titulo, 160);
  if (!titulo) return erro("Informe o título do aviso.", 400);

  const textoAviso = texto(corpo.texto, 2000);
  if (!textoAviso) return erro("Escreva o aviso.", 400);

  const publicacao = dataCivil(corpo.dataPublicacao) ?? new Date();
  const expiracao = dataCivil(corpo.dataExpiracao);
  if (!expiracao) return erro("Informe até quando o aviso vale.", 400);
  if (expiracao < publicacao) {
    return erro("A data de validade é anterior à de publicação.", 400);
  }

  /*
   * Prioridade 1 (alta), 2 (normal) ou 3 (baixa). Fora disso vira normal, em
   * vez de gravar um numero que nenhuma tela sabe ordenar.
   */
  const prioridade = [1, 2, 3].includes(Number(corpo.prioridade)) ? Number(corpo.prioridade) : 2;

  const congId = doAcesso ? (sessao?.congIds[0] ?? null) : (Number.isInteger(corpo.congId) ? (corpo.congId as number) : null);
  exigirCongregacaoPermitida(doAcesso, congId ?? undefined);

  return responder(async () =>
    criarComIdHerdado(
      (tx) => tx.aviso,
      (tx, id) =>
        tx.aviso.create({
          data: {
            id,
            titulo,
            texto: textoAviso,
            prioridade,
            dataPublicacao: publicacao,
            dataExpiracao: expiracao,
            autor: autorDa(sessao),
            congId,
          },
          select: { id: true, titulo: true },
        }),
    ),
  );
}
