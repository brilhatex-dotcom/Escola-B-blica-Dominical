import { prisma } from "@/lib/prisma";
import { erro, lerInt, lerPaginacao, pagina, responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";

/**
 * Alunos matriculados.
 *
 *   ?busca=   nome
 *   ?classe=  id da classe
 *   ?cong=    id da congregacao
 *   ?ativo=0  inclui os inativos (por padrao a lista mostra so quem esta ativo)
 */
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
  const { sessao, recusa } = await exigirLeitura("alunos");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);
    const url = new URL(req.url);
    const { pagina: p, porPagina, pular } = lerPaginacao(url);

    const busca = url.searchParams.get("busca")?.trim() ?? "";
    const classeId = lerInt(url, "classe");
    const congId = lerInt(url, "cong");
    const incluirInativos = url.searchParams.get("ativo") === "0";

    /*
     * `Alunos.nome` nao tem coluna normalizada como `Pessoas.chave`, entao aqui
     * a busca usa `mode: "insensitive"`, que resolve a caixa mas nao o acento.
     * E uma limitacao conhecida: quem digitar "jose" nao acha "José". Criar a
     * coluna normalizada tambem para alunos e a correcao certa, e ela pede
     * migration propria — nao entra de carona nesta.
     */
    /*
     * O `?cong=` da tela ESTREITA, nunca amplia.
     *
     * Quem enxerga o campo inteiro recebe `recorte === undefined` e o filtro da
     * tela vale como pedido. Quem enxerga uma congregação só recebe a lista
     * dela — e pedir outra pela barra de endereço não muda nada, porque o alvo
     * é a interseção dos dois.
     */
    const alvo = recorte
      ? { in: congId !== null && recorte.in.includes(congId) ? [congId] : recorte.in }
      : congId !== null
        ? { in: [congId] }
        : undefined;

    const where = {
      ...(incluirInativos ? {} : { ativo: true }),
      ...(busca ? { nome: { contains: busca, mode: "insensitive" as const } } : {}),
      ...(classeId ? { classeId } : {}),
      ...(alvo ? { congId: alvo } : {}),
    };

    const [total, alunos] = await Promise.all([
      prisma.aluno.count({ where }),
      prisma.aluno.findMany({
        where,
        orderBy: { nome: "asc" },
        skip: pular,
        take: porPagina,
        select: {
          id: true,
          nome: true,
          nasc: true,
          tel: true,
          resp: true,
          ativo: true,
          classe: { select: { id: true, nome: true, faixa: true } },
          congregacao: { select: { id: true, nome: true } },
        },
      }),
    ]);

    return pagina(alunos, total, p, porPagina);
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
 * CRUD — matricular, editar, transferir de classe e apagar
 *
 * O `id` de Alunos é herdado (não é autoincrement): a criação usa MAX(id)+1
 * dentro de uma transação, o mesmo padrão de Usuarios, Pessoas e Classes.
 * ============================================================================
 */

export async function POST(req: Request) {
  const { sessao, recusa } = await exigirEscrita("alunos");
  if (recusa) return recusa;

  let corpo: { nome?: string; nasc?: string; tel?: string; resp?: string; congId?: number; classeId?: number | null };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const nome = corpo.nome?.trim() ?? "";
  const congId = corpo.congId;
  if (!nome) return erro("Informe o nome do aluno.", 400);
  if (!Number.isInteger(congId)) return erro("Escolha a congregação do aluno.", 400);

  const recorte = recorteDaSessao(sessao);
  if (!dentroDoRecorte(recorte, congId!)) {
    return erro("O seu acesso não permite matricular alunos nesta congregação.", 403);
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

  const nasc = lerData(corpo.nasc);
  if (nasc === undefined && corpo.nasc) return erro("Data de nascimento inválida.", 400);

  return responder(async () => {
    const criado = await prisma.$transaction(async (tx) => {
      const maior = await tx.aluno.aggregate({ _max: { id: true } });
      const id = (maior._max.id ?? 0) + 1;
      return tx.aluno.create({
        data: {
          id,
          nome,
          nasc: nasc ?? null,
          tel: corpo.tel?.trim() || null,
          resp: corpo.resp?.trim() || null,
          congId: congId!,
          classeId: classe?.id ?? null,
          ativo: true,
        },
        select: { id: true, nome: true },
      });
    });

    registrar({
      sessao,
      acao: "CREATE",
      entidade: "Alunos",
      descricao: `Aluno "${criado.nome}" matriculado${classe ? ` em ${classe.nome}` : ""}.`,
      congId: congId!,
    });

    return { ok: true, ...criado };
  });
}

/**
 * PUT — edita o aluno; `classeId` também serve para TRANSFERIR de classe
 * (ou tirar da classe, com `classeId: null`) sem apagar o cadastro.
 */
export async function PUT(req: Request) {
  const { sessao, recusa } = await exigirEscrita("alunos");
  if (recusa) return recusa;

  let corpo: {
    id?: number;
    nome?: string;
    nasc?: string | null;
    tel?: string;
    resp?: string;
    classeId?: number | null;
    ativo?: boolean;
  };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const { id } = corpo;
  if (!Number.isInteger(id)) return erro("Aluno inválido.", 400);

  const aluno = await prisma.aluno.findUnique({ where: { id: id! } });
  if (!aluno) return erro("Aluno não encontrado.", 404);

  const recorte = recorteDaSessao(sessao);
  if (!dentroDoRecorte(recorte, aluno.congId)) {
    return erro("O seu acesso não permite alterar este aluno.", 403);
  }

  const dados: Record<string, unknown> = {};
  const mudancas: string[] = [];

  if (typeof corpo.nome === "string" && corpo.nome.trim() && corpo.nome.trim() !== aluno.nome) {
    dados.nome = corpo.nome.trim();
    mudancas.push("nome");
  }
  if (corpo.nasc !== undefined) {
    const nasc = lerData(corpo.nasc);
    if (nasc === undefined) return erro("Data de nascimento inválida.", 400);
    dados.nasc = nasc;
    mudancas.push("nascimento");
  }
  if (typeof corpo.tel === "string" && corpo.tel.trim() !== (aluno.tel ?? "")) {
    dados.tel = corpo.tel.trim() || null;
    mudancas.push("telefone");
  }
  if (typeof corpo.resp === "string" && corpo.resp.trim() !== (aluno.resp ?? "")) {
    dados.resp = corpo.resp.trim() || null;
    mudancas.push("responsável");
  }
  if (typeof corpo.ativo === "boolean" && corpo.ativo !== aluno.ativo) {
    dados.ativo = corpo.ativo;
    mudancas.push(corpo.ativo ? "reativado" : "desativado");
  }
  if (corpo.classeId !== undefined && corpo.classeId !== aluno.classeId) {
    if (corpo.classeId !== null) {
      const classe = await prisma.classe.findUnique({
        where: { id: corpo.classeId },
        select: { id: true, nome: true, congId: true },
      });
      if (!classe) return erro("Classe não encontrada.", 404);
      if (classe.congId !== aluno.congId) return erro("A classe escolhida não é desta congregação.", 400);
      mudancas.push(`transferido para ${classe.nome}`);
    } else {
      mudancas.push("removido da classe");
    }
    dados.classeId = corpo.classeId;
  }

  if (Object.keys(dados).length === 0) {
    return responder(async () => ({ ok: true, mudou: false }));
  }

  return responder(async () => {
    await prisma.aluno.update({ where: { id: id! }, data: dados });
    registrar({
      sessao,
      acao: "UPDATE",
      entidade: "Alunos",
      descricao: `Aluno "${aluno.nome}": ${mudancas.join(", ")}.`,
      congId: aluno.congId,
    });
    return { ok: true, mudou: true, mudancas };
  });
}

/**
 * DELETE ?id= — só apaga aluno SEM frequência lançada.
 *
 * Um aluno com chamada registrada não pode sumir: apagaria a frequência da
 * classe inteira nos domingos em que ele foi contado. O caminho para quem já
 * tem histórico é `PUT {ativo:false}` — some da chamada de hoje sem apagar o
 * que já aconteceu.
 */
export async function DELETE(req: Request) {
  const { sessao, recusa } = await exigirEscrita("alunos");
  if (recusa) return recusa;

  const url = new URL(req.url);
  const id = lerInt(url, "id");
  if (id === null) return erro("Informe o aluno.", 400);

  const aluno = await prisma.aluno.findUnique({
    where: { id },
    select: { id: true, nome: true, congId: true, _count: { select: { frequencias: true } } },
  });
  if (!aluno) return erro("Aluno não encontrado.", 404);

  const recorte = recorteDaSessao(sessao);
  if (!dentroDoRecorte(recorte, aluno.congId)) {
    return erro("O seu acesso não permite apagar este aluno.", 403);
  }

  if (aluno._count.frequencias > 0) {
    return erro(
      `Este aluno tem ${aluno._count.frequencias} chamada(s) registrada(s). ` +
        `Desative-o em vez de apagar — assim ele some da chamada de hoje sem perder o histórico.`,
      409,
    );
  }

  return responder(async () => {
    await prisma.aluno.delete({ where: { id } });
    registrar({
      sessao,
      acao: "DELETE",
      entidade: "Alunos",
      descricao: `Aluno "${aluno.nome}" apagado.`,
      congId: aluno.congId,
    });
    return { ok: true };
  });
}
