import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { criticarSenhaNova, gerarHash, verificarSenha } from "@/lib/auth/senha";
import { criarSessao, lerSessao } from "@/lib/auth/sessao";

/**
 * Troca de senha — e é aqui que a base migra do SHA-256 para bcrypt.
 *
 * A senha ATUAL é exigida mesmo já havendo sessão. Parece redundante e não é:
 * sem ela, um celular deixado desbloqueado em cima do banco permite trocar a
 * senha de quem estava logado e tomar a conta.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sessao = await lerSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
  }

  let corpo: { atual?: string; nova?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  const atual = corpo.atual ?? "";
  const nova = corpo.nova ?? "";

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: sessao.id } });
    if (!usuario) {
      return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
    }

    const conferiu = await verificarSenha(atual, usuario.senha);
    if (!conferiu.ok) {
      return NextResponse.json({ erro: "A senha atual não confere." }, { status: 401 });
    }

    const critica = criticarSenhaNova(nova, usuario.senha);
    if (critica) return NextResponse.json({ erro: critica }, { status: 400 });

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { senha: await gerarHash(nova) },
    });

    // A sessão carrega `precisaTrocar`; sem reemitir, o portal continuaria
    // pedindo a troca que acabou de ser feita até o cookie expirar.
    await criarSessao({ ...sessao, precisaTrocar: false });

    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error("[auth/trocar-senha]", erro);
    return NextResponse.json({ erro: "Não foi possível gravar a nova senha." }, { status: 500 });
  }
}
