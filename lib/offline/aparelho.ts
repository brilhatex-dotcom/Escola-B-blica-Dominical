import { LEMBRAR_APARELHO_DIAS, SESSAO_LOCAL_CHAVE } from "@/lib/config";

/**
 * "Este aparelho já entrou e pediu para ser lembrado" — o que decide se o app
 * pode abrir direto no painel quando não há internet para conferir a senha.
 *
 * Não é autenticação: o cookie httpOnly continua sendo a única coisa que o
 * servidor aceita. Isto só evita trancar do lado de fora quem já usa o
 * portal neste aparelho, bem na hora em que o offline precisa funcionar.
 */

/** O localStorage pode lançar (Safari privado, armazenamento bloqueado). */
function ler(): number {
  try {
    return Number(window.localStorage.getItem(SESSAO_LOCAL_CHAVE) ?? 0);
  } catch {
    return 0;
  }
}

export function aparelhoLembrado(): boolean {
  const quando = ler();
  return quando > 0 && Date.now() - quando < LEMBRAR_APARELHO_DIAS * 86_400_000;
}

export function lembrarAparelho(): void {
  try {
    window.localStorage.setItem(SESSAO_LOCAL_CHAVE, String(Date.now()));
  } catch {
    /* sem armazenamento: o app só não abre offline */
  }
}

export function esquecerAparelho(): void {
  try {
    window.localStorage.removeItem(SESSAO_LOCAL_CHAVE);
  } catch {
    /* nada a apagar */
  }
}

/**
 * O servidor responde de verdade?
 *
 * `navigator.onLine` não basta: no celular ele diz "online" sempre que há
 * Wi-Fi ou dado móvel ligado, mesmo com o sinal fraco demais para qualquer
 * requisição passar — que é exatamente a rede da igreja num domingo.
 *
 * É um `HEAD`, e não um `GET`, por causa do Service Worker: ele só intercepta
 * `GET` e, sem rede, devolve a última resposta guardada. Um `GET` aqui
 * "funcionaria" offline com uma resposta velha do cache e o app concluiria
 * que há internet. Qualquer resposta HTTP, até um erro, prova que há conexão.
 */
export async function servidorResponde(limiteMs = 4000): Promise<boolean> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), limiteMs);
  try {
    await fetch("/api/auth/eu", { method: "HEAD", cache: "no-store", signal: controle.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
