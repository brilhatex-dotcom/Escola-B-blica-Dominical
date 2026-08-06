import { prisma } from "@/lib/prisma";
import { erro, lerInt, lerPaginacao, pagina, responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";

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
          tel: true,
          obs: true,
          nascimento: true,
          endereco: true,
          data: true,
          classe: { select: { id: true, nome: true } },
          congregacao: { select: { id: true, nome: true } },
        },
      }),
    ]);

    return pagina(visitantes, total, p, porPagina);
  });
}

function dentroDoRecorte(recorte: { in: number[] } | undefined, congId: number | null): boolean {
  if (!recorte) return true;
  return congId !== null && recorte.in.includes(congId);
}

function lerData(bruto: unknown): Date | null | undefined {
  if (bruto === null) return null;
  if (typeof bruto !== "string" || !bruto.trim()) return undefined;
  const d = new Date(`${bruto}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/*
 * ============================================================================
 * "INCLUIR VISITANTE" — nome, data de nascimento e local que mora
 *
 * O pedido trocou o par idade/telefone (do sistema antigo) por nome,
 * nascimento e endereço, que é o que a Chamada pede na prática: alguém chega
 * domingo, o professor anota ali mesmo quem é, quando nasceu e onde mora.
 * As colunas antigas (`idade`, `tel`) continuam existindo — ver
 * prisma/aplicar-visitantes-campos.sql — só não são mais preenchidas por
 * aqui.
 *
 * O `id` de Visitantes é herdado (não é autoincrement): a criação usa
 * MAX(id)+1 dentro de uma transação, o mesmo padrão de Usuarios e Classes.
 * ============================================================================
 */

export async function POST(req: Request) {
  const { sessao, recusa } = await exigirEscrita("visitantes");
  if (recusa) return recusa;

  let corpo: {
    nome?: string;
    nascimento?: string;
    endereco?: string;
    congId?: number;
    classeId?: number | null;
    data?: string;
  };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const nome = corpo.nome?.trim() ?? "";
  const congId = corpo.congId;
  if (!nome) return erro("Informe o nome do visitante.", 400);
  if (!Number.isInteger(congId)) return erro("Escolha a congregação do visitante.", 400);

  const recorte = recorteDaSessao(sessao);
  if (!dentroDoRecorte(recorte, congId!)) {
    return erro("O seu acesso não permite registrar visitantes nesta congregação.", 403);
  }

  let classe: { id: number; nome: string; congId: number | null } | null = null;
  if (corpo.classeId !== undefined && corpo.classeId !== null) {
    classe = await prisma.classe.findUnique({
      where: { id: corpo.classeId },
      select: { id: true, nome: true, congId: true },
    });
    if (!classe) return erro("Classe não encontrada.", 404);
    if (classe.congId !== congId) return erro("A classe escolhida não é desta congregação.", 400);
  }

  const nascimento = lerData(corpo.nascimento);
  if (nascimento === undefined && corpo.nascimento) return erro("Data de nascimento inválida.", 400);

  const data = lerData(corpo.data) || new Date();

  return responder(async () => {
    const criado = await prisma.$transaction(async (tx) => {
      const maior = await tx.visitante.aggregate({ _max: { id: true } });
      const id = (maior._max.id ?? 0) + 1;
      return tx.visitante.create({
        data: {
          id,
          nome,
          nascimento: nascimento ?? null,
          endereco: corpo.endereco?.trim() || null,
          congId: congId!,
          classeId: classe?.id ?? null,
          data,
        },
        select: { id: true, nome: true },
      });
    });

    registrar({
      sessao,
      acao: "CREATE",
      entidade: "Visitantes",
      descricao: `Visitante "${criado.nome}" recebido${classe ? ` em ${classe.nome}` : ""}.`,
      congId: congId!,
    });

    return { ok: true, ...criado };
  });
}

export async function PUT(req: Request) {
  const { sessao, recusa } = await exigirEscrita("visitantes");
  if (recusa) return recusa;

  let corpo: {
    id?: number;
    nome?: string;
    nascimento?: string | null;
    endereco?: string;
  };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const { id } = corpo;
  if (!Number.isInteger(id)) return erro("Visitante inválido.", 400);

  const visitante = await prisma.visitante.findUnique({ where: { id: id! } });
  if (!visitante) return erro("Visitante não encontrado.", 404);

  const recorte = recorteDaSessao(sessao);
  if (!dentroDoRecorte(recorte, visitante.congId)) {
    return erro("O seu acesso não permite alterar este visitante.", 403);
  }

  const dados: Record<string, unknown> = {};
  const mudancas: string[] = [];

  if (typeof corpo.nome === "string" && corpo.nome.trim() && corpo.nome.trim() !== visitante.nome) {
    dados.nome = corpo.nome.trim();
    mudancas.push("nome");
  }
  if (corpo.nascimento !== undefined) {
    const nascimento = lerData(corpo.nascimento);
    if (nascimento === undefined) return erro("Data de nascimento inválida.", 400);
    dados.nascimento = nascimento;
    mudancas.push("nascimento");
  }
  if (typeof corpo.endereco === "string" && corpo.endereco.trim() !== (visitante.endereco ?? "")) {
    dados.endereco = corpo.endereco.trim() || null;
    mudancas.push("endereço");
  }

  if (Object.keys(dados).length === 0) {
    return responder(async () => ({ ok: true, mudou: false }));
  }

  return responder(async () => {
    await prisma.visitante.update({ where: { id: id! }, data: dados });
    registrar({
      sessao,
      acao: "UPDATE",
      entidade: "Visitantes",
      descricao: `Visitante "${visitante.nome}": ${mudancas.join(", ")}.`,
      congId: visitante.congId,
    });
    return { ok: true, mudou: true, mudancas };
  });
}

export async function DELETE(req: Request) {
  const { sessao, recusa } = await exigirEscrita("visitantes");
  if (recusa) return recusa;

  const url = new URL(req.url);
  const id = lerInt(url, "id");
  if (id === null) return erro("Informe o visitante.", 400);

  const visitante = await prisma.visitante.findUnique({
    where: { id },
    select: { id: true, nome: true, congId: true },
  });
  if (!visitante) return erro("Visitante não encontrado.", 404);

  const recorte = recorteDaSessao(sessao);
  if (!dentroDoRecorte(recorte, visitante.congId)) {
    return erro("O seu acesso não permite apagar este visitante.", 403);
  }

  return responder(async () => {
    await prisma.visitante.delete({ where: { id } });
    registrar({
      sessao,
      acao: "DELETE",
      entidade: "Visitantes",
      descricao: `Visitante "${visitante.nome}" apagado.`,
      congId: visitante.congId,
    });
    return { ok: true };
  });
}
