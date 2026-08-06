import { prisma } from "@/lib/prisma";
import { erro, lerCorpo, responder, texto, textoOpcional } from "@/lib/api";
import {
  escopoDaRota,
  escopoDeEscrita,
  exigirCongregacaoPermitida,
} from "@/lib/auth/escopo";
import { excluirOuArquivar } from "@/lib/api/exclusao";
import { CATEGORIAS } from "@/lib/ebd/categorias";

/**
 * A classe por dentro.
 *
 * ============================================================================
 * TUDO O QUE A TELA DA CLASSE PRECISA, NUMA CHAMADA
 *
 * Quem é o professor, quem são os alunos, qual a faixa etária e como andou a
 * frequência. Poderia ser resolvido com quatro requisições da tela — e seria
 * quatro vezes o tempo de abertura numa rede de igreja, com a tela montando aos
 * pedaços enquanto o dedo já está tentando tocar num aluno que ainda vai mudar
 * de lugar.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDaRota("classes");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Classe inválida.", 400);

  return responder(async () => {
    const classe = await prisma.classe.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        faixa: true,
        tipoClasse: true,
        ativa: true,
        prof: true,
        congId: true,
        congregacao: { select: { id: true, nome: true } },
        pessoaCargos: {
          where: { ativo: true, fim: null },
          select: {
            id: true,
            cargo: { select: { id: true, nome: true, ordem: true } },
            pessoa: {
              select: { id: true, nome: true, tratamento: true, tel: true, foto: true },
            },
          },
          orderBy: { cargo: { ordem: "asc" } },
        },
      },
    });

    if (!classe) throw new Error("Classe não encontrada.");
    exigirCongregacaoPermitida(doAcesso, classe.congId);

    const [alunos, ultimaChamada] = await Promise.all([
      prisma.aluno.findMany({
        where: { classeId: id },
        orderBy: [{ ativo: "desc" }, { nome: "asc" }],
        select: {
          id: true,
          nome: true,
          nasc: true,
          tel: true,
          resp: true,
          posicao: true,
          ativo: true,
          _count: { select: { frequencias: true } },
        },
      }),
      // A data da última chamada responde "esta classe está em dia?" sem
      // precisar abrir o módulo de Chamada e ir tentando domingo a domingo.
      prisma.frequencia.findFirst({
        where: { classeId: id },
        orderBy: { data: "desc" },
        select: { data: true },
      }),
    ]);

    return {
      id: classe.id,
      nome: classe.nome,
      faixa: classe.faixa,
      tipoClasse: classe.tipoClasse,
      ativa: classe.ativa,
      /*
       * O texto original de `Classes.prof` continua sendo devolvido.
       *
       * É onde o sistema antigo guardava o professor, à mão — "Pb. Lourival e
       * Aux. Danilo", "Jéssica e Elisângela". A Fase 05 transformou esses
       * textos em pessoas de verdade, mas NÃO apagou o original, e a tela o
       * mostra ao lado para a secretaria poder conferir se a leitura ficou
       * certa. Some sozinho da tela quando os vínculos estiverem revisados.
       */
      profOriginal: classe.prof,
      congregacao: classe.congregacao,
      professores: classe.pessoaCargos
        .filter((v) => v.cargo.nome === "Professor")
        .map((v) => ({ vinculoId: v.id, ...v.pessoa })),
      outrosCargos: classe.pessoaCargos
        .filter((v) => v.cargo.nome !== "Professor")
        .map((v) => ({ vinculoId: v.id, cargo: v.cargo.nome, ...v.pessoa })),
      alunos: alunos.map((a) => ({
        id: a.id,
        nome: a.nome,
        nasc: a.nasc,
        tel: a.tel,
        resp: a.resp,
        posicao: a.posicao,
        ativo: a.ativo,
        presencas: a._count.frequencias,
      })),
      ativos: alunos.filter((a) => a.ativo).length,
      ultimaChamada: ultimaChamada?.data ?? null,
    };
  });
}

export async function PATCH(req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("classes");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Classe inválida.", 400);

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  return responder(async () => {
    const atual = await prisma.classe.findUnique({
      where: { id },
      select: { id: true, congId: true },
    });
    if (!atual) throw new Error("Classe não encontrada.");
    exigirCongregacaoPermitida(doAcesso, atual.congId);

    const nome = corpo.nome === undefined ? undefined : texto(corpo.nome, 120);
    if (corpo.nome !== undefined && !nome) throw new Error("Informe o nome da classe.");

    const tipoClasse = corpo.tipoClasse === undefined ? undefined : texto(corpo.tipoClasse, 40);
    if (tipoClasse !== undefined && (!tipoClasse || !CATEGORIAS.includes(tipoClasse))) {
      throw new Error("Categoria inválida.");
    }

    return prisma.classe.update({
      where: { id },
      data: {
        ...(nome ? { nome } : {}),
        ...(corpo.faixa !== undefined ? { faixa: textoOpcional(corpo.faixa, 60) ?? "" } : {}),
        ...(tipoClasse ? { tipoClasse } : {}),
        ...(typeof corpo.ativa === "boolean" ? { ativa: corpo.ativa } : {}),
      },
      select: { id: true, nome: true, ativa: true },
    });
  });
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("classes");
  if (recusa) return recusa;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return erro("Classe inválida.", 400);

  return responder(async () => {
    const classe = await prisma.classe.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        congId: true,
        _count: { select: { alunos: true, frequencias: true, visitantes: true } },
      },
    });
    if (!classe) throw new Error("Classe não encontrada.");
    exigirCongregacaoPermitida(doAcesso, classe.congId);

    const { alunos, frequencias, visitantes } = classe._count;
    const partes = [
      alunos > 0 && `${alunos} ${alunos === 1 ? "aluno matriculado" : "alunos matriculados"}`,
      frequencias > 0 && `${frequencias} ${frequencias === 1 ? "presença" : "presenças"}`,
      visitantes > 0 && `${visitantes} ${visitantes === 1 ? "visitante" : "visitantes"}`,
    ].filter(Boolean) as string[];

    return excluirOuArquivar({
      dependencias: alunos + frequencias + visitantes,
      motivo:
        `A classe ${classe.nome} tem ${partes.join(", ")}, então foi desativada em vez de ` +
        "apagada. Ela sai do menu da chamada e das listas, e o histórico dela continua " +
        "valendo nos relatórios. Para apagar de vez, mova ou exclua antes o que está nela.",
      apagar: () => prisma.classe.delete({ where: { id } }),
      arquivar: () => prisma.classe.update({ where: { id }, data: { ativa: false } }),
    });
  });
}
