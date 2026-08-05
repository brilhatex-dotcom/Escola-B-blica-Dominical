import { prisma } from "@/lib/prisma";
import { lerInt, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/**
 * Ficha do aluno: o histórico completo de uma pessoa.
 *
 *   ?aluno=123   obrigatório
 *   ?busca=maria lista candidatos quando ainda não se sabe o id
 *
 * O RECORTE VALE PARA A FICHA TAMBÉM. Sem conferir a congregação do aluno, o
 * endereço `?aluno=1` percorreria o cadastro inteiro em ordem — a forma mais
 * simples de vazar 323 fichas com telefone e data de nascimento, inclusive de
 * menores.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("rel-ficha");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const recorte = recorteDaSessao(sessao);
    const alunoId = lerInt(url, "aluno");
    const busca = url.searchParams.get("busca")?.trim() ?? "";

    if (alunoId === null) {
      const candidatos = await prisma.aluno.findMany({
        where: {
          ativo: true,
          congId: recorte,
          ...(busca ? { nome: { contains: busca, mode: "insensitive" as const } } : {}),
        },
        orderBy: { nome: "asc" },
        take: busca ? 30 : 15,
        select: { id: true, nome: true, classe: { select: { nome: true } } },
      });
      return {
        candidatos: candidatos.map((c) => ({
          id: c.id,
          nome: c.nome,
          classe: c.classe?.nome ?? "Sem classe",
        })),
      };
    }

    const aluno = await prisma.aluno.findFirst({
      where: { id: alunoId, congId: recorte },
      select: {
        id: true, nome: true, nasc: true, tel: true, resp: true, ativo: true,
        classe: { select: { id: true, nome: true, faixa: true } },
        congregacao: { select: { id: true, nome: true } },
      },
    });

    // Fora do alcance responde igual a "não existe": dizer "existe mas você não
    // pode ver" confirmaria a existência do cadastro a quem estiver sondando.
    if (!aluno) throw new Error("Aluno não encontrado.");

    const [frequencias, visitas] = await Promise.all([
      prisma.frequencia.findMany({
        where: { alunoId },
        orderBy: { data: "desc" },
        take: 60,
        select: { data: true, presente: true, classe: { select: { nome: true } } },
      }),
      prisma.frequencia.aggregate({
        where: { alunoId },
        _count: { _all: true },
      }),
    ]);

    const presencas = await prisma.frequencia.count({
      where: { alunoId, presente: true },
    });
    const chamadas = visitas._count._all;

    return {
      aluno: {
        ...aluno,
        nasc: aluno.nasc ? aluno.nasc.toISOString().slice(0, 10) : null,
        congregacao: aluno.congregacao
          ? { ...aluno.congregacao, nome: aluno.congregacao.nome?.trim() || `Congregação ${aluno.congregacao.id}` }
          : null,
      },
      resumo: {
        chamadas,
        presencas,
        faltas: chamadas - presencas,
        // A taxa é sobre as chamadas em que ele foi chamado, nunca sobre os
        // domingos do calendário — ver lib/relatorios/comum.ts.
        taxa: chamadas > 0 ? Math.round((presencas / chamadas) * 1000) / 10 : null,
      },
      historico: frequencias.map((f) => ({
        data: f.data.toISOString().slice(0, 10),
        presente: f.presente,
        classe: f.classe?.nome ?? null,
      })),
    };
  });
}
