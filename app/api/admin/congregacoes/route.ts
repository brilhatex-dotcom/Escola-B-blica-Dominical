import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";

/**
 * Cadastro das congregações — o lado administrativo.
 *
 * ============================================================================
 * ESTA TELA NÃO CRIA NEM APAGA CONGREGAÇÃO. SÓ CORRIGE O NOME.
 *
 * `Congregacoes.id` não é autoincrement: é a chave que veio da planilha, e ela
 * aparece em `Classes`, `Alunos`, `Frequencias`, `Ofertas`, `Visitantes`,
 * `Licoes`, `PessoaCargos`, `Eventos` e `Avisos`. Um id novo inventado aqui
 * teria de ser combinado com tudo isso.
 *
 * E apagar seria pior: a Cong. Carnaubinha tem alunos, chamadas de anos e
 * pessoas com cargo. Remover a linha não apagaria nada disso — deixaria órfão,
 * e o campo perderia o histórico de uma congregação inteira por causa de um
 * clique.
 *
 * Abrir uma congregação nova é decisão do campo, e envolve muito mais do que
 * uma linha de tabela. Quando for a hora, entra como cadastro completo — não
 * como botão "+" numa lista.
 * ============================================================================
 *
 * GET  — as congregações com o que depende de cada uma
 * PUT  { id, nome } — corrige o nome
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { sessao, recusa } = await exigirLeitura("admin-congregacoes");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);

    const congs = await prisma.congregacao.findMany({
      where: recorte ? { id: recorte } : {},
      orderBy: { id: "asc" },
      select: {
        id: true,
        nome: true,
        _count: {
          select: { classes: true, alunos: true, pessoaCargos: true, frequencias: true },
        },
      },
    });

    /*
     * Alunos ATIVOS numa consulta à parte: `_count` conta a relação inteira, e
     * mostrar 92 onde há 61 matriculados faria a secretaria conferir números
     * que não batem com nenhuma outra tela do portal.
     */
    const ativos = await prisma.aluno.groupBy({
      by: ["congId"],
      where: { ativo: true, ...(recorte ? { congId: recorte } : {}) },
      _count: { _all: true },
    });
    const ativosPor = new Map(ativos.map((a) => [a.congId, a._count._all]));

    return {
      itens: congs.map((c) => ({
        id: c.id,
        nome: c.nome,
        classes: c._count.classes,
        alunos: c._count.alunos,
        alunosAtivos: ativosPor.get(c.id) ?? 0,
        cargos: c._count.pessoaCargos,
        chamadas: c._count.frequencias,
      })),
    };
  });
}

export async function PUT(req: Request) {
  const { sessao, recusa } = await exigirEscrita("admin-congregacoes");
  if (recusa) return recusa;

  let corpo: { id?: number; nome?: string };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const id = corpo?.id;
  const nome = corpo?.nome?.trim();
  if (!Number.isInteger(id)) return erro("Informe a congregação.", 400);
  if (!nome) return erro("O nome não pode ficar vazio.", 400);
  if (nome.length > 80) return erro("O nome é longo demais.", 400);

  return responder(async () => {
    const antes = await prisma.congregacao.findUnique({ where: { id: id! } });
    if (!antes) throw new Error("Congregação não encontrada.");
    if (antes.nome === nome) return { ok: true, id: antes.id, nome, mudou: false };

    const depois = await prisma.congregacao.update({
      where: { id: id! },
      data: { nome },
    });

    registrar({
      sessao,
      acao: "UPDATE",
      entidade: "Congregacoes",
      descricao: `Nome alterado de "${antes.nome}" para "${nome}".`,
      congId: antes.id,
    });

    return { ok: true, id: depois.id, nome: depois.nome, mudou: true };
  });
}
