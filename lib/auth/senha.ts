import { compare, hash } from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Verificação de senha, com migração automática do formato antigo.
 *
 * ============================================================================
 * O QUE HERDAMOS
 *
 * O sistema antigo guardava a senha como SHA-256 puro, sem sal. Isso é fraco
 * por construção: SHA-256 foi feito para ser RÁPIDO, e é exatamente essa
 * velocidade que permite testar bilhões de palpites por segundo numa placa de
 * vídeo comum. Sem sal, duas pessoas com a mesma senha produzem o mesmo hash —
 * e nas 19 contas herdadas o hash é IDÊNTICO em todas, ou seja, o campo inteiro
 * usa uma única senha.
 *
 * A REGRA DA IGREJA É NÃO ALTERAR REGISTRO DO SISTEMA ANTIGO, e ela é
 * respeitada: nada é reescrito por conta própria. O que acontece é uma troca
 * feita PELA PESSOA — ao entrar com a senha antiga, o portal pede uma nova, e é
 * a nova que é gravada em bcrypt. A base migra sozinha, no ritmo de quem usa,
 * sem ninguém perder acesso e sem ninguém decidir por eles.
 *
 * bcrypt é lento de propósito (fator 12 ≈ 250 ms por tentativa), o que torna a
 * força bruta inviável, e cada hash carrega o próprio sal — senhas iguais
 * passam a gerar hashes diferentes.
 * ============================================================================
 */

const FATOR = 12;

/** Um SHA-256 em hexadecimal: 64 caracteres, só 0-9 e a-f. */
export function ehFormatoAntigo(hashGuardado: string): boolean {
  return /^[0-9a-f]{64}$/i.test(hashGuardado);
}

/**
 * Compara sem vazar tempo.
 *
 * `a === b` em JavaScript para no primeiro caractere diferente, e a diferença
 * de tempo entre "errou no primeiro" e "errou no último" é mensurável pela
 * rede. Com ela dá para descobrir o hash caractere a caractere, sem nunca
 * acertar a senha. `timingSafeEqual` compara sempre o buffer inteiro.
 */
function iguaisSeguro(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  // Comprimentos diferentes já respondem `false`; `timingSafeEqual` exige
  // buffers do mesmo tamanho e lançaria erro.
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export interface Verificacao {
  ok: boolean;
  /** `true` quando a senha conferiu, mas ainda está no formato antigo. */
  precisaTrocar: boolean;
}

export async function verificarSenha(
  senhaDigitada: string,
  hashGuardado: string,
): Promise<Verificacao> {
  if (!senhaDigitada || !hashGuardado) return { ok: false, precisaTrocar: false };

  if (ehFormatoAntigo(hashGuardado)) {
    const calculado = createHash("sha256").update(senhaDigitada).digest("hex");
    const ok = iguaisSeguro(calculado, hashGuardado.toLowerCase());
    return { ok, precisaTrocar: ok };
  }

  return { ok: await compare(senhaDigitada, hashGuardado), precisaTrocar: false };
}

export function gerarHash(senha: string): Promise<string> {
  return hash(senha, FATOR);
}

/**
 * Regras mínimas para a senha nova.
 *
 * Deliberadamente simples — sem exigir símbolo, maiúscula e número. Regras
 * complicadas numa igreja produzem "Senha@123" colado num papel ao lado do
 * computador, que é pior do que uma senha longa e sem símbolo. O que importa é
 * não repetir a que todo mundo já sabe.
 */
export function criticarSenhaNova(nova: string, hashAtual: string): string | null {
  if (nova.length < 6) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/^\d+$/.test(nova)) return "Escolha uma senha que não seja só números.";
  if (ehFormatoAntigo(hashAtual)) {
    const igual = createHash("sha256").update(nova).digest("hex");
    if (iguaisSeguro(igual, hashAtual.toLowerCase())) {
      return "Esta é a senha antiga, que todos usavam. Escolha outra.";
    }
  }
  return null;
}
