import { NextResponse } from "next/server";
import { encerrarSessao } from "@/lib/auth/sessao";

/**
 * Saída.
 *
 * É POST, e não GET, de propósito: um GET pode ser disparado por um `<img>` de
 * qualquer site, e o usuário seria deslogado no meio da chamada de domingo sem
 * entender o que houve.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  await encerrarSessao();
  return NextResponse.json({ ok: true });
}
