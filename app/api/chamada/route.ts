import { prisma } from "@/lib/prisma";
import { erro, lerInt, responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";

/**
 * A chamada de uma classe num domingo.
 *
 * GET  ?classe=12&data=2026-08-09  -> alunos da classe e quem ja esta marcado
 * POST { classeId, data, presencas: [{alunoId, presente}] }
 *
 * ============================================================================
 * POR QUE O POST GRAVA A CHAMADA INTEIRA, E NAO UMA PRESENCA POR VEZ
 *
 * Uma requisicao por aluno significa trinta requisicoes numa classe de trinta —
 * e, na rede da igreja, significa que algumas chegam e outras nao. A chamada
 * fica pela metade e ninguem sabe quais faltaram.
 *
 * Mandando tudo junto, dentro de UMA transacao, o resultado so tem dois
 * estados possiveis: gravou tudo ou nao gravou nada. Se falhar, a fila offline
 * (lib/db) reenvia o mesmo pacote depois, e como a gravacao e por
 * (aluno, data), reenviar duas vezes da o mesmo resultado.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  /*
   * A CHAMADA É DA CONGREGAÇÃO DE QUEM ABRE.
   *
   * A secretária local marca a chamada das classes da SUA congregação, e o
   * recorte garante isso: uma classe de outra congregação responde "não
   * encontrada", do mesmo jeito que uma que não existe — sem dizer qual dos dois
   * casos é, para não confirmar a existência de classes fora do alcance.
   *
   * Esta rota nasceu SEM guarda na Fase 05 (mesmo defeito de /api/alunos etc.).
   * Aqui ela ganha a guarda e o recorte de uma vez.
   */
  const { sessao, recusa } = await exigirLeitura("chamada");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const classeId = lerInt(url, "classe");
    const data = url.searchParams.get("data");
    if (!classeId || !data) throw new Error("Informe a classe e a data.");

    const dia = new Date(`${data}T00:00:00Z`);
    const recorte = recorteDaSessao(sessao);

    const [classe, alunos, marcadas] = await Promise.all([
      prisma.classe.findFirst({
        where: { id: classeId, ...(recorte ? { congId: { in: recorte.in } } : {}) },
        select: {
          id: true,
          nome: true,
          faixa: true,
          congId: true,
          congregacao: { select: { id: true, nome: true } },
          pessoaCargos: {
            where: { ativo: true, cargo: { nome: "Professor" } },
            select: { pessoa: { select: { id: true, nome: true, tratamento: true } } },
          },
        },
      }),
      prisma.aluno.findMany({
        where: { classeId, ativo: true },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, nasc: true },
      }),
      prisma.frequencia.findMany({
        where: { classeId, data: dia },
        select: { alunoId: true, presente: true },
      }),
    ]);

    if (!classe) throw new Error("Classe não encontrada ou fora do seu alcance.");

    const presencaPor = new Map(marcadas.map((f) => [f.alunoId, f.presente]));

    return {
      classe: {
        id: classe.id,
        nome: classe.nome,
        faixa: classe.faixa,
        congregacao: classe.congregacao,
        professores: classe.pessoaCargos.map((v) => v.pessoa),
      },
      data,
      // `iniciada` distingue "ninguem veio" de "ninguem marcou ainda" — duas
      // situacoes que somam zero presentes e pedem acoes opostas.
      iniciada: marcadas.length > 0,
      alunos: alunos.map((a) => ({
        ...a,
        presente: presencaPor.get(a.id) ?? null,
      })),
    };
  });
}

interface CorpoChamada {
  classeId: number;
  data: string;
  presencas: Array<{ alunoId: number; presente: boolean }>;
}

export async function POST(req: Request) {
  // Gravar chamada exige sessao com permissao no modulo. Ver lib/auth/guarda.ts.
  const { sessao, recusa } = await exigirEscrita("chamada");
  if (recusa) return recusa;

  let corpo: CorpoChamada;
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const { classeId, data, presencas } = corpo ?? {};
  if (!Number.isInteger(classeId) || !/^\d{4}-\d{2}-\d{2}$/.test(data ?? "") || !Array.isArray(presencas)) {
    return erro("Informe classeId, data (YYYY-MM-DD) e a lista de presenças.", 400);
  }

  /*
   * O RECORTE VALE PARA GRAVAR TAMBÉM — e é aqui que ele mais importa.
   *
   * Ter permissão de "chamada" não é ter permissão para marcar QUALQUER classe:
   * a secretária local grava a chamada da SUA congregação. Sem esta conferência,
   * bastaria mandar o classeId de outra congregação no corpo do POST para
   * escrever presença onde não se deveria — a guarda de módulo, sozinha, não
   * pega isso.
   */
  const recorte = recorteDaSessao(sessao);
  const classe = await prisma.classe.findFirst({
    where: { id: classeId, ...(recorte ? { congId: { in: recorte.in } } : {}) },
    select: { congId: true },
  });
  if (!classe) {
    return erro("Classe não encontrada ou fora do seu alcance.", 404);
  }

  return responder(async () => {
    const dia = new Date(`${data}T00:00:00Z`);

    /*
     * Os ids de Frequencia NAO sao autoincrement — sao a chave original da
     * planilha (ver prisma/schema.prisma). Entao o proximo id precisa ser
     * calculado, e isso tem de acontecer DENTRO da transacao: dois professores
     * marcando presenca ao mesmo tempo, em classes diferentes, pegariam o mesmo
     * numero e um dos dois perderia a chamada.
     */
    const resultado = await prisma.$transaction(async (tx) => {
      const maior = await tx.frequencia.aggregate({ _max: { id: true } });
      let proximoId = (maior._max.id ?? 0) + 1;

      const existentes = await tx.frequencia.findMany({
        where: { classeId, data: dia },
        select: { id: true, alunoId: true },
      });
      const idPor = new Map(existentes.map((f) => [f.alunoId, f.id]));

      let criadas = 0;
      let atualizadas = 0;

      for (const p of presencas) {
        if (!Number.isInteger(p.alunoId) || typeof p.presente !== "boolean") continue;

        const jaExiste = idPor.get(p.alunoId);
        if (jaExiste !== undefined) {
          await tx.frequencia.update({ where: { id: jaExiste }, data: { presente: p.presente } });
          atualizadas++;
        } else {
          await tx.frequencia.create({
            data: {
              id: proximoId++,
              alunoId: p.alunoId,
              classeId,
              congId: classe.congId,
              data: dia,
              presente: p.presente,
            },
          });
          criadas++;
        }
      }

      return { ok: true, criadas, atualizadas, total: criadas + atualizadas };
    });

    /*
     * Fora da transacao, e de proposito: ver o cabecalho de lib/auditoria.ts.
     * A chamada ja esta gravada quando esta linha roda — uma falha aqui custa
     * uma linha de log, nunca o domingo da classe.
     */
    registrar({
      sessao,
      acao: resultado.criadas > 0 ? "CREATE" : "UPDATE",
      entidade: "Frequencia",
      descricao:
        `Chamada da classe ${classeId} em ${data}: ` +
        `${resultado.criadas} marcada(s) e ${resultado.atualizadas} corrigida(s).`,
      congId: classe.congId,
    });

    return resultado;
  });
}
