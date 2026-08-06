import { prisma } from "@/lib/prisma";
import { erro, lerInt, responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";

/**
 * Classes, com a contagem de alunos e os professores DE VERDADE.
 *
 * `professores` vem de PessoaCargo, e nao do campo `prof` (texto livre). E a
 * diferenca entre "Pb. Lourival e Aux. Danilo" — uma string — e duas pessoas
 * que existem no cadastro, tem telefone e podem ser abertas.
 *
 * O texto original continua sendo devolvido em `profOriginal`, para conferencia
 * enquanto a migracao dos nomes nao for revisada pela secretaria.
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

/**
 * O alcance efetivo: o que a tela pediu, limitado ao que o acesso permite.
 *
 * Devolver `undefined` significa "não filtre", e só acontece para quem enxerga
 * o campo inteiro sem ter pedido congregação nenhuma.
 */
function alvoDaConsulta(
  recorte: { in: number[] } | undefined,
  pedida: number | null,
): { in: number[] } | undefined {
  if (recorte) {
    return { in: pedida !== null && recorte.in.includes(pedida) ? [pedida] : recorte.in };
  }
  return pedida !== null ? { in: [pedida] } : undefined;
}

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("classes");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);
    const url = new URL(req.url);
    const congId = lerInt(url, "cong");
    const busca = url.searchParams.get("busca")?.trim() ?? "";

    const classes = await prisma.classe.findMany({
      where: {
        ...(alvoDaConsulta(recorte, congId) ? { congId: alvoDaConsulta(recorte, congId) } : {}),
        ...(busca ? { nome: { contains: busca, mode: "insensitive" as const } } : {}),
      },
      orderBy: [{ congId: "asc" }, { nome: "asc" }],
      select: {
        id: true,
        nome: true,
        faixa: true,
        tipoClasse: true,
        ativa: true,
        prof: true,
        congregacao: { select: { id: true, nome: true } },
        _count: { select: { alunos: true } },
        pessoaCargos: {
          where: { ativo: true, cargo: { nome: "Professor" } },
          select: { pessoa: { select: { id: true, nome: true, tratamento: true } } },
        },
      },
    });

    return {
      itens: classes.map((c) => ({
        id: c.id,
        nome: c.nome,
        faixa: c.faixa,
        tipoClasse: c.tipoClasse,
        ativa: c.ativa,
        profOriginal: c.prof,
        congregacao: c.congregacao,
        alunos: c._count.alunos,
        professores: c.pessoaCargos.map((v) => v.pessoa),
      })),
      total: classes.length,
    };
  });
}

/**
 * A classe pertence a esta sessão? `undefined` (campo inteiro) sempre pode;
 * quem tem recorte só mexe na própria congregação — a mesma regra de leitura,
 * agora aplicada à escrita.
 */
function dentroDoRecorte(recorte: { in: number[] } | undefined, congId: number | null): boolean {
  if (!recorte) return true;
  return congId !== null && recorte.in.includes(congId);
}

/*
 * ============================================================================
 * CRUD — a mesma classe, agora editável
 *
 * Nasceu só de leitura (Fase 05). O pedido era claro: "quero que seja
 * clicável… editar adicionar remover apagar", com o campo de professor e a
 * lista de alunos dentro do detalhe. O `id` de Classes é herdado (não é
 * autoincrement), então toda criação usa MAX(id)+1 dentro de uma transação —
 * o mesmo padrão de Usuarios e Pessoas.
 * ============================================================================
 */

export async function POST(req: Request) {
  const { sessao, recusa } = await exigirEscrita("classes");
  if (recusa) return recusa;

  let corpo: { nome?: string; faixa?: string; tipoClasse?: string; congId?: number };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const nome = corpo.nome?.trim() ?? "";
  const faixa = corpo.faixa?.trim() ?? "";
  const tipoClasse = corpo.tipoClasse?.trim() ?? "";
  const congId = corpo.congId;

  if (!nome) return erro("Informe o nome da classe.", 400);
  if (!faixa) return erro("Informe a faixa etária da classe.", 400);
  if (!tipoClasse) return erro("Informe o tipo (categoria) da classe.", 400);
  if (!Number.isInteger(congId)) return erro("Escolha a congregação da classe.", 400);

  const recorte = recorteDaSessao(sessao);
  if (!dentroDoRecorte(recorte, congId!)) {
    return erro("O seu acesso não permite criar classes nesta congregação.", 403);
  }

  const congregacao = await prisma.congregacao.findUnique({
    where: { id: congId! },
    select: { id: true, nome: true },
  });
  if (!congregacao) return erro("Congregação não encontrada.", 404);

  return responder(async () => {
    const criada = await prisma.$transaction(async (tx) => {
      const maior = await tx.classe.aggregate({ _max: { id: true } });
      const id = (maior._max.id ?? 0) + 1;
      return tx.classe.create({
        data: { id, nome, faixa, tipoClasse, congId: congId!, ativa: true },
        select: { id: true, nome: true },
      });
    });

    registrar({
      sessao,
      acao: "CREATE",
      entidade: "Classes",
      descricao: `Classe "${criada.nome}" criada em ${congregacao.nome?.trim() || `Congregação ${congregacao.id}`}.`,
      congId: congId!,
    });

    return { ok: true, ...criada };
  });
}

/**
 * PUT — edita a classe e, quando `professoresIds` vier, troca quem dá aula
 * nela.
 *
 * O professor é um CARGO (PessoaCargo com `classeId`), não um texto. Trocar a
 * lista aqui encerra (`ativo:false, fim`) quem saiu e ativa/cria quem entrou —
 * o mesmo modelo de app/api/congregacoes/dirigente/route.ts, só que por
 * classe em vez de por congregação. O vínculo antigo nunca é apagado: a escala
 * do ano passado precisa continuar dizendo quem dava aula.
 */
export async function PUT(req: Request) {
  const { sessao, recusa } = await exigirEscrita("classes");
  if (recusa) return recusa;

  let corpo: {
    id?: number;
    nome?: string;
    faixa?: string;
    tipoClasse?: string;
    ativa?: boolean;
    professoresIds?: number[];
  };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const { id } = corpo;
  if (!Number.isInteger(id)) return erro("Classe inválida.", 400);

  const classe = await prisma.classe.findUnique({ where: { id: id! } });
  if (!classe) return erro("Classe não encontrada.", 404);

  const recorte = recorteDaSessao(sessao);
  if (!dentroDoRecorte(recorte, classe.congId)) {
    return erro("O seu acesso não permite alterar esta classe.", 403);
  }

  const dados: Record<string, unknown> = {};
  const mudancas: string[] = [];

  if (typeof corpo.nome === "string" && corpo.nome.trim() && corpo.nome.trim() !== classe.nome) {
    dados.nome = corpo.nome.trim();
    mudancas.push("nome");
  }
  if (typeof corpo.faixa === "string" && corpo.faixa.trim() && corpo.faixa.trim() !== classe.faixa) {
    dados.faixa = corpo.faixa.trim();
    mudancas.push("faixa etária");
  }
  if (
    typeof corpo.tipoClasse === "string" &&
    corpo.tipoClasse.trim() &&
    corpo.tipoClasse.trim() !== classe.tipoClasse
  ) {
    dados.tipoClasse = corpo.tipoClasse.trim();
    mudancas.push("categoria");
  }
  if (typeof corpo.ativa === "boolean" && corpo.ativa !== classe.ativa) {
    dados.ativa = corpo.ativa;
    mudancas.push(corpo.ativa ? "reativada" : "desativada");
  }

  const trocarProfessores = Array.isArray(corpo.professoresIds);
  const novosIds = trocarProfessores
    ? [...new Set(corpo.professoresIds!.filter((n) => Number.isInteger(n)))]
    : [];

  if (Object.keys(dados).length === 0 && !trocarProfessores) {
    return responder(async () => ({ ok: true, mudou: false }));
  }

  return responder(async () => {
    const resultado = await prisma.$transaction(async (tx) => {
      if (Object.keys(dados).length > 0) {
        await tx.classe.update({ where: { id: id! }, data: dados });
      }

      let professores: Array<{ id: number; nome: string }> = [];
      if (trocarProfessores) {
        const cargoProfessor = await tx.cargo.findUnique({ where: { nome: "Professor" } });
        if (!cargoProfessor) {
          throw new Error('O cargo "Professor" não está cadastrado — aplique a Fase 08.');
        }

        const atuais = await tx.pessoaCargo.findMany({
          where: { classeId: id!, cargoId: cargoProfessor.id, ativo: true },
          select: { id: true, pessoaId: true },
        });

        const saem = atuais.filter((v) => !novosIds.includes(v.pessoaId));
        if (saem.length > 0) {
          await tx.pessoaCargo.updateMany({
            where: { id: { in: saem.map((v) => v.id) } },
            data: { ativo: false, fim: new Date() },
          });
        }

        const jaAtivos = new Set(atuais.map((v) => v.pessoaId));
        for (const pessoaId of novosIds) {
          if (jaAtivos.has(pessoaId)) continue;

          const anterior = await tx.pessoaCargo.findFirst({
            where: {
              pessoaId,
              cargoId: cargoProfessor.id,
              classeId: { equals: id! },
              congId: { equals: classe.congId },
            },
          });
          if (anterior) {
            await tx.pessoaCargo.update({
              where: { id: anterior.id },
              data: { ativo: true, fim: null, inicio: new Date() },
            });
          } else {
            await tx.pessoaCargo.create({
              data: {
                pessoaId,
                cargoId: cargoProfessor.id,
                classeId: id!,
                congId: classe.congId,
                inicio: new Date(),
              },
            });
          }
        }

        if (novosIds.length > 0) {
          const pessoas = await tx.pessoa.findMany({
            where: { id: { in: novosIds } },
            select: { id: true, nome: true },
          });
          professores = pessoas;
        }
        mudancas.push("professor(es)");
      }

      return { professores };
    });

    registrar({
      sessao,
      acao: "UPDATE",
      entidade: "Classes",
      descricao: `Classe "${classe.nome}": ${mudancas.join(", ") || "sem alterações"}.`,
      congId: classe.congId,
    });

    return { ok: true, mudou: true, mudancas, professores: resultado.professores };
  });
}

/**
 * DELETE ?id= — só apaga classe VAZIA.
 *
 * Uma classe com aluno, frequência, visitante ou professor vinculado não pode
 * sumir: apagar quebraria o histórico dessas linhas (a FK recusaria, e o erro
 * chegaria como "não foi possível concluir a operação" sem dizer por quê).
 * Para essas, o caminho é desativar (`PUT {ativa:false}`) — a classe some das
 * listas ativas sem apagar nada que aconteceu nela.
 */
export async function DELETE(req: Request) {
  const { sessao, recusa } = await exigirEscrita("classes");
  if (recusa) return recusa;

  const url = new URL(req.url);
  const id = lerInt(url, "id");
  if (id === null) return erro("Informe a classe.", 400);

  const classe = await prisma.classe.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      congId: true,
      _count: {
        select: { alunos: true, frequencias: true, freqLicoes: true, visitantes: true, pessoaCargos: true, usuarios: true },
      },
    },
  });
  if (!classe) return erro("Classe não encontrada.", 404);

  const recorte = recorteDaSessao(sessao);
  if (!dentroDoRecorte(recorte, classe.congId)) {
    return erro("O seu acesso não permite apagar esta classe.", 403);
  }

  const vinculos =
    classe._count.alunos +
    classe._count.frequencias +
    classe._count.freqLicoes +
    classe._count.visitantes +
    classe._count.pessoaCargos +
    classe._count.usuarios;
  if (vinculos > 0) {
    return erro(
      `Esta classe tem ${classe._count.alunos} aluno(s) e outros registros vinculados. ` +
        `Desative-a em vez de apagar — assim ela some das listas ativas sem perder o histórico.`,
      409,
    );
  }

  return responder(async () => {
    await prisma.classe.delete({ where: { id } });
    registrar({
      sessao,
      acao: "DELETE",
      entidade: "Classes",
      descricao: `Classe "${classe.nome}" apagada.`,
      congId: classe.congId,
    });
    return { ok: true };
  });
}
