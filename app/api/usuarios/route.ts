import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura } from "@/lib/auth/guarda";
import { montarAcesso } from "@/lib/auth/acesso";
import { papelPrincipal, rotuloDoPapel } from "@/lib/auth/papeis";
import { gerarHash } from "@/lib/auth/senha";
import { registrar } from "@/lib/auditoria";
import { normalizarLogin } from "@/lib/auth/login";

/**
 * As contas de acesso e o papel de cada uma.
 *
 * ============================================================================
 * A TELA MOSTRA O ACESSO CALCULADO, NÃO UM CAMPO GRAVADO
 *
 * Não existe coluna "papel" em `Usuarios` — e não existe de propósito. O papel
 * vem dos CARGOS que a pessoa ocupa (`PessoaCargos`), que é onde a igreja já
 * registra quem faz o quê. Uma coluna paralela significaria manter a mesma
 * informação em dois lugares: alguém deixa o cargo, ninguém lembra da outra
 * tela, e o acesso continua aberto.
 *
 * Por isso esta rota devolve o resultado do cálculo, com a marca `presumido`
 * dizendo quando ele foi DEDUZIDO do perfil herdado em vez de lido de um cargo.
 * ============================================================================
 *
 * A senha nunca sai daqui — nem o hash. Ele não serve para nada na tela e, uma
 * vez numa resposta HTTP, fica no cache do navegador e no log de qualquer
 * intermediário.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { recusa } = await exigirLeitura("usuarios");
  if (recusa) return recusa;

  return responder(async () => {
    const [usuarios, congregacoes] = await Promise.all([
      prisma.usuario.findMany({
        orderBy: [{ ativo: "desc" }, { nome: "asc" }],
        select: {
          id: true,
          nome: true,
          login: true,
          perfil: true,
          congId: true,
          ativo: true,
          pessoaId: true,
          pessoa: {
            select: {
              id: true,
              nome: true,
              tratamento: true,
              cargos: {
                where: { ativo: true, fim: null },
                select: { congId: true, cargo: { select: { nome: true } } },
              },
            },
          },
        },
      }),
      prisma.congregacao.findMany({ select: { id: true, nome: true } }),
    ]);

    const nomeDaCong = new Map(congregacoes.map((c) => [c.id, c.nome]));

    const itens = usuarios.map((u) => {
      const acesso = montarAcesso(
        { id: u.id, perfil: u.perfil, congId: u.congId, pessoaId: u.pessoaId },
        u.pessoa?.cargos ?? [],
      );
      const papel = papelPrincipal(acesso.papeis);

      return {
        id: u.id,
        nome: u.nome,
        login: u.login,
        ativo: u.ativo,
        /** O valor original da planilha, mostrado como veio. Nada é reescrito. */
        perfilHerdado: u.perfil,
        congregacao:
          u.congId === null
            ? null
            : { id: u.congId, nome: nomeDaCong.get(u.congId) || `Congregação ${u.congId}` },
        pessoa: u.pessoa
          ? { id: u.pessoa.id, nome: u.pessoa.nome, tratamento: u.pessoa.tratamento }
          : null,
        papel,
        papelRotulo: papel ? rotuloDoPapel(papel) : "Sem acesso",
        papeis: acesso.papeis,
        escopo: acesso.escopo,
        presumido: acesso.presumido,
        congregacoesDoAcesso: acesso.congIds.map((id) => ({
          id,
          nome: nomeDaCong.get(id) || `Congregação ${id}`,
        })),
      };
    });

    return {
      itens,
      // Para o formulário de nova conta escolher a congregação.
      congregacoes: congregacoes
        .map((c) => ({ id: c.id, nome: c.nome?.trim() || `Congregação ${c.id}` }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      total: itens.length,
      /*
       * Quantas contas ainda estão com acesso PRESUMIDO.
       *
       * É o número que interessa à administração: cada uma dessas é uma conta
       * cujo alcance o portal chutou a partir da planilha, e que só um humano
       * pode confirmar ligando-a a uma pessoa e a um cargo.
       */
      presumidos: itens.filter((i) => i.presumido).length,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Criar e ajustar contas — para cada secretária ter o seu login
 * ------------------------------------------------------------------ */

const PERFIS_PERMITIDOS = ["secretario", "coord"] as const;

/** Regras mínimas da senha inicial. Simples de propósito (ver lib/auth/senha). */
function criticarSenha(s: string): string | null {
  if (s.length < 6) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/^\d+$/.test(s)) return "Escolha uma senha que não seja só números.";
  return null;
}



/**
 * POST — cria uma conta de acesso para uma secretária de congregação.
 *
 * A conta nasce presa a UMA congregação e já com a senha em bcrypt (formato
 * novo, não o SHA-256 herdado). O perfil decide o alcance:
 *   "secretario" → Secretário Local (chamada, alunos, visitantes, lições, revistas)
 *   "coord"      → Dirigente (o mesmo mais classes e professores)
 * Os dois só enxergam e só gravam na congregação da conta — nunca no campo.
 *
 * `id` não é autoincrement (é a chave herdada da planilha), então o próximo é
 * MAX(id)+1 dentro da transação: duas criações ao mesmo tempo não pegam o mesmo
 * número.
 */
export async function POST(req: Request) {
  const { sessao, recusa } = await exigirEscrita("usuarios");
  if (recusa) return recusa;

  let corpo: { login?: string; nome?: string; senha?: string; congId?: number; perfil?: string };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const login = normalizarLogin(corpo.login ?? "");
  const nome = corpo.nome?.trim() ?? "";
  const senha = corpo.senha ?? "";
  const congId = corpo.congId;
  const perfil = corpo.perfil ?? "secretario";

  if (login.length < 3) return erro("O login precisa ter ao menos 3 letras, sem espaços.", 400);
  if (!nome) return erro("Informe o nome da pessoa.", 400);
  if (!Number.isInteger(congId)) return erro("Escolha a congregação da conta.", 400);
  if (!PERFIS_PERMITIDOS.includes(perfil as (typeof PERFIS_PERMITIDOS)[number])) {
    return erro("Tipo de acesso inválido.", 400);
  }
  const critica = criticarSenha(senha);
  if (critica) return erro(critica, 400);

  const jaExiste = await prisma.usuario.findUnique({ where: { login }, select: { id: true } });
  if (jaExiste) return erro(`Já existe uma conta com o login "${login}".`, 409);

  const cong = await prisma.congregacao.findUnique({ where: { id: congId! }, select: { id: true, nome: true } });
  if (!cong) return erro("Congregação não encontrada.", 404);

  const hash = await gerarHash(senha);

  return responder(async () => {
    const criado = await prisma.$transaction(async (tx) => {
      const maior = await tx.usuario.aggregate({ _max: { id: true } });
      const id = (maior._max.id ?? 0) + 1;
      return tx.usuario.create({
        data: { id, login, nome, senha: hash, perfil, congId: congId!, ativo: true },
        select: { id: true, login: true, nome: true },
      });
    });

    registrar({
      sessao,
      acao: "CREATE",
      entidade: "Usuarios",
      descricao: `Conta "${criado.login}" (${nome}) criada para ${cong.nome?.trim() || `Congregação ${cong.id}`}.`,
      congId: congId!,
    });

    return { ok: true, ...criado };
  });
}

/**
 * PUT — ajusta uma conta: nome, congregação, ativa/inativa e redefinir senha.
 *
 * A conta `master` (admin) tem trava dupla: não pode ser desativada nem trocar
 * de congregação por aqui, para não haver como se trancar do lado de fora — o
 * conserto dela é o SQL de redefinição (prisma/redefinir-senha-admin.sql).
 */
export async function PUT(req: Request) {
  const { sessao, recusa } = await exigirEscrita("usuarios");
  if (recusa) return recusa;

  let corpo: {
    id?: number;
    nome?: string;
    congId?: number | null;
    ativo?: boolean;
    novaSenha?: string;
  };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const { id } = corpo;
  if (!Number.isInteger(id)) return erro("Conta inválida.", 400);

  const conta = await prisma.usuario.findUnique({ where: { id: id! } });
  if (!conta) return erro("Conta não encontrada.", 404);
  const ehMaster = conta.perfil === "master";

  const dados: Record<string, unknown> = {};
  const mudancas: string[] = [];

  if (typeof corpo.nome === "string" && corpo.nome.trim() && corpo.nome.trim() !== conta.nome) {
    dados.nome = corpo.nome.trim();
    mudancas.push("nome");
  }
  if (corpo.congId !== undefined && !ehMaster && corpo.congId !== conta.congId) {
    if (corpo.congId !== null) {
      const c = await prisma.congregacao.findUnique({ where: { id: corpo.congId }, select: { id: true } });
      if (!c) return erro("Congregação não encontrada.", 404);
    }
    dados.congId = corpo.congId;
    mudancas.push("congregação");
  }
  if (typeof corpo.ativo === "boolean" && !ehMaster && corpo.ativo !== conta.ativo) {
    dados.ativo = corpo.ativo;
    mudancas.push(corpo.ativo ? "reativada" : "desativada");
  }
  if (typeof corpo.novaSenha === "string" && corpo.novaSenha) {
    const critica = criticarSenha(corpo.novaSenha);
    if (critica) return erro(critica, 400);
    dados.senha = await gerarHash(corpo.novaSenha);
    mudancas.push("senha redefinida");
  }

  if (Object.keys(dados).length === 0) {
    return responder(async () => ({ ok: true, mudou: false }));
  }

  return responder(async () => {
    await prisma.usuario.update({ where: { id: id! }, data: dados });
    registrar({
      sessao,
      acao: "UPDATE",
      entidade: "Usuarios",
      descricao: `Conta "${conta.login}": ${mudancas.join(", ")}.`,
      congId: conta.congId,
    });
    return { ok: true, mudou: true, mudancas };
  });
}
