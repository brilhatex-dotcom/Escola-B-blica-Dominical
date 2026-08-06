import { prisma } from "@/lib/prisma";
import {
  dataCivil,
  erro,
  lerCorpo,
  lerInt,
  lerPaginacao,
  pagina,
  proximoId,
  responder,
  texto,
  textoOpcional,
} from "@/lib/api";
import {
  combinarCongregacao,
  escopoDaRota,
  escopoDeEscrita,
  exigirCongregacaoPermitida,
} from "@/lib/auth/escopo";
import { idadeParaExibir } from "@/lib/ebd/idade";

/** Acrescenta a idade calculada, sem esconder de onde ela veio. */
function comIdade<T extends { nasc: Date | null; idade: number | null }>(v: T) {
  const { anos, origem } = idadeParaExibir(v.nasc, v.idade);
  return { ...v, anos, idadeDe: origem };
}

/** Visitantes recebidos. `?de=` e `?ate=` recortam por data ("YYYY-MM-DD"). */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { recusa, congId: doAcesso } = await escopoDaRota("visitantes");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const { pagina: p, porPagina, pular } = lerPaginacao(url);
    const classeId = lerInt(url, "classe");
    const congId = lerInt(url, "cong");
    const de = url.searchParams.get("de");
    const ate = url.searchParams.get("ate");

    const where = {
      ...(classeId ? { classeId } : {}),
      congId: combinarCongregacao(doAcesso, congId),
      ...(de || ate
        ? {
            data: {
              ...(de ? { gte: new Date(`${de}T00:00:00Z`) } : {}),
              ...(ate ? { lte: new Date(`${ate}T00:00:00Z`) } : {}),
            },
          }
        : {}),
    };

    const [total, visitantes] = await Promise.all([
      prisma.visitante.count({ where }),
      prisma.visitante.findMany({
        where,
        orderBy: { data: "desc" },
        skip: pular,
        take: porPagina,
        select: {
          id: true,
          nome: true,
          idade: true,
          nasc: true,
          local: true,
          tel: true,
          obs: true,
          data: true,
          classe: { select: { id: true, nome: true } },
          congregacao: { select: { id: true, nome: true } },
        },
      }),
    ]);

    return pagina(visitantes.map(comIdade), total, p, porPagina);
  });
}

/**
 * Receber um visitante.
 *
 * ============================================================================
 * A IDADE HERDADA E A DATA DE NASCIMENTO CONVIVEM — NÃO SE SUBSTITUEM
 *
 * As 89 linhas do sistema antigo guardam a IDADE, um número solto, e mais nada.
 * Converter isso em data de nascimento exigiria inventar dia e mês, e a regra
 * da igreja é não decidir por conta própria sobre registro herdado.
 *
 * Então: visitante novo grava `nasc`, e a idade sai de uma conta. Visitante
 * antigo continua com o número que a planilha trouxe. `comIdade()` resolve os
 * dois casos, e a tela não precisa saber de qual época o registro é.
 * ============================================================================
 */
export async function POST(req: Request) {
  const { recusa, congId: doAcesso } = await escopoDeEscrita("visitantes");
  if (recusa) return recusa;

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  const nome = texto(corpo.nome, 120);
  if (!nome) return erro("Informe o nome do visitante.", 400);

  const data = dataCivil(corpo.data);
  if (!data) return erro("Informe a data da visita (YYYY-MM-DD).", 400);

  const classeId = Number.isInteger(corpo.classeId) ? (corpo.classeId as number) : null;

  return responder(async () => {
    /*
     * A congregação vem da CLASSE, e não do corpo da requisição — mesmo
     * cuidado dos alunos. Sem classe (visitante que ficou no culto e não entrou
     * em sala), usa-se a congregação de quem está registrando.
     */
    let congId: number | null = null;
    if (classeId !== null) {
      const classe = await prisma.classe.findUnique({
        where: { id: classeId },
        select: { congId: true },
      });
      if (!classe) throw new Error("Classe não encontrada.");
      congId = classe.congId;
    } else if (doAcesso) {
      congId = doAcesso.in[0] ?? null;
    }
    exigirCongregacaoPermitida(doAcesso, congId);

    return prisma.$transaction(async (tx) => {
      const id = await proximoId(() => tx.visitante.aggregate({ _max: { id: true } }));
      const criado = await tx.visitante.create({
        data: {
          id,
          nome,
          nasc: dataCivil(corpo.nasc),
          local: textoOpcional(corpo.local, 160),
          tel: textoOpcional(corpo.tel, 30),
          obs: textoOpcional(corpo.obs, 500),
          classeId,
          congId,
          data,
        },
        select: {
          id: true,
          nome: true,
          idade: true,
          nasc: true,
          local: true,
          tel: true,
          obs: true,
          data: true,
        },
      });
      return comIdade(criado);
    });
  });
}
