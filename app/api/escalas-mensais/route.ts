import { prisma } from "@/lib/prisma";
import { dataCivil, erro, lerCorpo, responder, texto } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { autorDa } from "@/lib/api/legado";

/**
 * Escalas mensais montadas pelo portal — a lista de meses.
 *
 * Ao contrário de "Escala_Cultos" (o link do Drive, que cada congregação
 * podia ter o seu), a escala mensal é UM documento só, do campo inteiro —
 * é o que o PDF sempre foi. Por isso a leitura não recorta por congregação:
 * todo mundo lê o mesmo mês, como sempre recebeu o mesmo PDF no WhatsApp.
 * Só GRAVAR é reservado a quem enxerga o campo inteiro — ver o comentário em
 * `app/api/escalas-mensais/[id]/route.ts`.
 *
 * RASCUNHO x PUBLICADO: uma escala "rascunho" só aparece pra quem PODE
 * editá-la — um mês pela metade não é a escala oficial ainda, e mostrá-lo
 * a todo mundo criaria confusão sobre qual congregação de fato vale.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { sessao, recusa } = await exigirLeitura("escalas");
  if (recusa) return recusa;

  const podeVerRascunho = recorteDaSessao(sessao) === undefined;

  return responder(async () => {
    const escalas = await prisma.escalaMensal.findMany({
      where: podeVerRascunho ? {} : { status: "publicado" },
      orderBy: { mesAno: "desc" },
      select: {
        id: true,
        titulo: true,
        mesAno: true,
        status: true,
        autor: true,
        atualizado: true,
        _count: { select: { itens: true } },
      },
    });

    return {
      itens: escalas.map((e) => ({
        id: e.id,
        titulo: e.titulo,
        mesAno: e.mesAno.toISOString().slice(0, 10),
        status: e.status,
        autor: e.autor,
        atualizado: e.atualizado.toISOString(),
        quantidadeItens: e._count.itens,
      })),
    };
  });
}

export async function POST(req: Request) {
  const { sessao, recusa } = await exigirEscrita("escalas");
  if (recusa) return recusa;

  /*
   * Fora do `responder()` de propósito — ver o comentário grande em
   * `app/api/revistas/precos/route.ts`: um `erro(...)` devolvido de dentro
   * do callback vira `{}` com status 200, e o `throw` some na mensagem
   * genérica. A única forma de mandar um erro específico é devolvê-lo antes.
   */
  if (recorteDaSessao(sessao)) {
    return erro("Só quem enxerga o campo inteiro monta a escala mensal.", 403);
  }

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  const titulo = texto(corpo.titulo, 160);
  if (!titulo) return erro("Informe o título da escala.", 400);

  const mes = typeof corpo.mesAno === "string" ? `${corpo.mesAno}-01` : null;
  const mesAno = dataCivil(mes);
  if (!mesAno) return erro("Informe o mês da escala.", 400);

  const existente = await prisma.escalaMensal.findUnique({ where: { mesAno }, select: { id: true } });
  if (existente) return erro("Este mês já tem uma escala montada — abra-a para editar.", 409);

  return responder(async () => {
    const criada = await prisma.escalaMensal.create({
      data: { titulo, mesAno, autor: autorDa(sessao) },
      select: { id: true },
    });
    return { id: criada.id };
  });
}
