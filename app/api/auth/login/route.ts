import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarSenha } from "@/lib/auth/senha";
import { criarSessao, temSegredo } from "@/lib/auth/sessao";
import { formasDoLogin } from "@/lib/auth/login";
import { registrar } from "@/lib/auditoria";
import { acessoDaConta } from "@/lib/auth/acesso";
import { papelPrincipal } from "@/lib/auth/papeis";

/**
 * Entrada no sistema.
 *
 * ============================================================================
 * A RESPOSTA É A MESMA PARA "USUÁRIO NÃO EXISTE" E "SENHA ERRADA"
 *
 * Distinguir os dois entrega a lista de logins válidos a quem estiver testando:
 * "usuário não encontrado" confirma que aquele nome NÃO existe, e "senha
 * incorreta" confirma que existe. Com isso se descobre quem tem conta antes de
 * tentar qualquer senha.
 *
 * Pelo mesmo motivo, quando o usuário não existe o código ainda assim gasta o
 * tempo de uma verificação de senha. Sem isso, a resposta instantânea denuncia
 * "este login não existe" mesmo com a mensagem sendo idêntica.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

/** Hash descartável, só para consumir o mesmo tempo quando o login não existe. */
const HASH_FALSO = "$2b$12$0000000000000000000000u1KcFEGnJdMLo6RRuNhwOaCcAqDCLzS";

export async function POST(req: Request) {
  if (!temSegredo()) {
    return NextResponse.json(
      {
        erro:
          "A autenticação ainda não foi configurada neste servidor. " +
          "Falta a variável AUTH_SECRET.",
      },
      { status: 503 },
    );
  }

  let corpo: { login?: string; senha?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const login = corpo.login?.trim() ?? "";
  const senha = corpo.senha ?? "";
  if (!login || !senha) {
    return NextResponse.json({ erro: "Informe usuário e senha." }, { status: 400 });
  }

  try {
    /*
     * A conta é procurada nas formas em que ela pode ter sido gravada.
     *
     * Primeiro o texto EXATO — é assim que estão as 19 contas herdadas da
     * planilha, uma delas com maiúscula e cedilha (`Graça`). Depois a forma
     * normalizada, que é como a tela de Usuários grava as contas novas.
     *
     * Sem isto, uma secretária cadastrada como "Maria Bandeiras" (gravada
     * "mariabandeiras") digitava o próprio nome e ouvia "Usuário ou senha
     * inválidos" — com a mensagem, que é a mesma para login inexistente e senha
     * errada, mandando procurar o problema na senha.
     *
     * A ordem importa: exato primeiro, para que uma conta antiga nunca seja
     * ofuscada por outra de nome parecido em caixa baixa.
     */
    let usuario = null;
    for (const forma of formasDoLogin(login)) {
      usuario = await prisma.usuario.findUnique({ where: { login: forma } });
      if (usuario) break;
    }

    const { ok, precisaTrocar } = await verificarSenha(
      senha,
      usuario?.senha ?? HASH_FALSO,
    );

    if (!usuario || !usuario.ativo || !ok) {
      return NextResponse.json({ erro: "Usuário ou senha inválidos." }, { status: 401 });
    }

    /*
     * O acesso é apurado AQUI, uma vez, e viaja dentro do JWT.
     *
     * É o único ponto do sistema que consulta o banco para decidir permissão:
     * fazer isso a cada navegação seria uma ida ao Postgres por clique, de todo
     * aparelho da igreja, num domingo de manhã.
     */
    const acesso = await acessoDaConta({
      id: usuario.id,
      perfil: usuario.perfil,
      congId: usuario.congId,
      pessoaId: usuario.pessoaId,
    });

    await criarSessao({
      id: usuario.id,
      login: usuario.login,
      nome: usuario.nome,
      perfil: usuario.perfil,
      congId: usuario.congId,
      precisaTrocar,
      papeis: acesso.papeis,
      congIds: acesso.congIds,
      escopo: acesso.escopo,
      presumido: acesso.presumido,
    });

    /*
     * Entrada registrada — LOGIN era 589 das 1.671 linhas herdadas, a maior
     * categoria do sistema antigo. Tentativa RECUSADA nao e registrada: a
     * tabela viraria um alvo, e uma senha digitada no campo do usuario por
     * engano acabaria escrita em claro na descricao.
     */
    registrar({
      sessao: {
        id: usuario.id,
        login: usuario.login,
        nome: usuario.nome,
        perfil: usuario.perfil,
        congId: usuario.congId,
        precisaTrocar,
        papeis: acesso.papeis,
        congIds: acesso.congIds,
        escopo: acesso.escopo,
        presumido: acesso.presumido,
      },
      acao: "LOGIN",
      entidade: "Sistema",
      descricao: "Entrou no portal.",
      congId: usuario.congId,
    });

    return NextResponse.json({
      ok: true,
      nome: usuario.nome,
      perfil: usuario.perfil,
      papel: papelPrincipal(acesso.papeis),
      escopo: acesso.escopo,
      // A tela usa isto para levar direto à troca de senha em vez do painel.
      precisaTrocar,
    });
  } catch (erro) {
    console.error("[auth/login]", erro);
    return NextResponse.json(
      { erro: "Não foi possível entrar agora. Tente de novo em instantes." },
      { status: 500 },
    );
  }
}
