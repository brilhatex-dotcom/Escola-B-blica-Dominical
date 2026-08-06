/**
 * Nome, tratamento e a chave normalizada — num lugar só.
 *
 * ============================================================================
 * O TRATAMENTO VIAJA À PARTE DO NOME
 *
 * "Aux. Bartolomeu" é tratamento ("Aux.") + nome ("Bartolomeu"). O cadastro de
 * pessoas guarda os dois separados de propósito (ver o model Pessoa): assim a
 * mesma pessoa não vira duas quando alguém digita sem o prefixo, e a busca acha
 * "Bartolomeu" mesmo que o usuário tenha digitado "Aux. Bartolomeu".
 *
 * Essas funções existiam espalhadas (na importação, na busca). Concentradas,
 * a regra de separar o tratamento é a mesma em todo lugar — inclusive na hora
 * de promover um aluno a dirigente.
 * ============================================================================
 */

/** Tratamentos eclesiásticos reconhecidos, já normalizados (minúsculo, sem acento). */
const TRATAMENTOS = new Set([
  "pr.", "pra.", "pb.", "presb.", "dc.", "diac.", "ev.", "miss.",
  "aux.", "ir.", "ir.a",
]);

/** minúsculo, sem acento, espaços colapsados — a forma da coluna `chave`. */
export function normalizarChave(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Separa um tratamento inicial do resto do nome.
 *
 * "Aux. Bartolomeu" → { tratamento: "Aux.", nome: "Bartolomeu" }
 * "Maria José"      → { tratamento: null,  nome: "Maria José" }
 */
export function separarTratamento(nomeCompleto: string): { tratamento: string | null; nome: string } {
  const bruto = (nomeCompleto ?? "").trim();
  const primeira = bruto.split(/\s+/)[0] ?? "";
  const norm = primeira.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (TRATAMENTOS.has(norm)) {
    const resto = bruto.slice(primeira.length).trim();
    // Se sobrar vazio (só o tratamento foi digitado), devolve o original.
    return resto ? { tratamento: primeira, nome: resto } : { tratamento: null, nome: bruto };
  }
  return { tratamento: null, nome: bruto };
}

/**
 * O termo de busca já sem o tratamento — para casar com a `chave`, que não o tem.
 * "Aux. Bartolomeu" → "bartolomeu"
 */
export function termoDeBusca(termo: string): string {
  return normalizarChave(separarTratamento(termo).nome);
}
