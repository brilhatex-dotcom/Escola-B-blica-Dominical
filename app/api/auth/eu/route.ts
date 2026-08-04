import { NextResponse } from "next/server";
import { lerSessao, temSegredo } from "@/lib/auth/sessao";

/** Quem está logado. `null` quando não há sessão — não é erro. */
export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await lerSessao();
  return NextResponse.json({
    sessao,
    // A tela precisa saber a diferença entre "ninguém logado" e "autenticação
    // desligada neste servidor" — no segundo caso, exigir login trancaria todo
    // mundo do lado de fora.
    autenticacaoAtiva: temSegredo(),
  });
}
