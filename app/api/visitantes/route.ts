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
import { escopoDeEscrita, exigirCongregacaoPermitida } from "@/lib/auth/escopo";
import { idadeParaExibir } from "@/lib/ebd/idade";

/**
 * Acrescenta a idade calculada, sem esconder de onde ela veio.
 *
 * Nos visitantes novos ela sai da data de nascimento; nos 89 herdados da
 * planilha, do número solto que era tudo o que existia. A tela mostra os dois
 * do mesmo jeito e não precisa saber de qual época o registro é.
 */
function comIdade<T extends { nasc: Date | null; idade: number | null }>(v: T) {
  const { anos, origem } = idadeParaExibir(v.nasc, v.idade);
  return { ...v, anos, idadeDe: origem };
}
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/** Visitantes recebidos. `?de=` e `?ate=` recortam por data ("YYYY-MM-DD"). */
/*
 * ============================================================================
 * A GUARDA CHEGOU DEPOIS — E ESSA É A LIÇÃO
 *
 * Esta rota nasceu na Fase 05, quando ainda não havia permissões. A Fase 08
 * trouxe o RBAC e protegeu o que ela mesma criou; as rotas anteriores ficaram
 * abertas, e ninguém percebeu porque a TELA já escondia o menu.
 *
 * Esconder o item do menu nunca protegeu nada: bastava digitar
 * `/api/alunos` no navegador para receber os 323 alunos do campo inteiro,
 * independentemente da congregação de quem pedia. O recorte que o painel
 * aplicava com cuidado não existia aqui.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("visitantes");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);
    const url = new URL(req.url);
    const { pagina: p, porPagina, pular } = lerPaginacao(url);
    const classeId = lerInt(url, "classe");
    const congId = lerInt(url, "cong");
    const de = url.searchParams.get("de");
    const ate = url.searchParams.get("ate");

    const alvo = recorte
      ? { in: congId !== null && recorte.in.includes(congId) ? [congId] : recorte.in }
      : congId !== null
        ? { in: [congId] }
        : undefined;

    const where = {
      ...(classeId ? { classeId } : {}),
      ...(alvo ? { congId: alvo } : {}),
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
          crente: true,
          data: true,
          classe: { select: { id: true, nome: true } },
          congregacao: { select: { id: true, nome: true } },
        },
      }),
    ]);

    return pagina(visitantes.map(comIdade), total, p, porPagina);
  });
}

/** `corpo.crente`: "sim" | "nao" | "" (não perguntado) — nunca lançado em nenhum dos três casos. */
function lerCrente(valor: unknown): boolean | null {
  if (valor === "sim") return true;
  if (valor === "nao") return false;
  return null;
}

/**
 * Receber um visitante.
 *
 * Cadastrado de dentro da Chamada, com nome, data de nascimento e onde mora.
 * A congregação vem da CLASSE, e não do corpo da requisição — mesmo cuidado dos
 * alunos. Sem classe (visitante que ficou no culto e não entrou em sala), usa-se
 * a congregação de quem está registrando.
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
          crente: lerCrente(corpo.crente),
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
          crente: true,
          data: true,
        },
      });
      return comIdade(criado);
    });
  });
}
