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

/**
 * minúsculo e sem acento — a base de toda normalização deste arquivo.
 *
 * `\p{Diacritic}` sozinho NÃO cobre "ª"/"º" (indicadores ordinais femini-
 * no/masculino, U+00AA/U+00BA): eles são letras próprias, não marcas combi-
 * nantes, então `"ª".normalize("NFD")` não muda nada. Sem esta troca extra,
 * "Ir.ª" normalizava para "ir.ª" — que não batia com "ir.a" no conjunto de
 * tratamentos — e a saudação do Dashboard ficava sem o nome ("Bom dia, Ir.ª.").
 */
function semAcento(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ª/g, "a")
    .replace(/º/g, "o");
}

/** minúsculo, sem acento, espaços colapsados — a forma da coluna `chave`. */
export function normalizarChave(s: string): string {
  return semAcento(s).replace(/\s+/g, " ").trim();
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
  const norm = semAcento(primeira);
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

/**
 * O tratamento por extenso, para falar — não para etiquetar.
 *
 * "Ir.ª" nas listas e crachás fica abreviado de propósito (compacto, igual em
 * toda linha). Numa saudação ("Bom dia, ___") a abreviação soa como um rótulo
 * de cadastro, não como algo que alguém diria — por isso a Fase 16 pediu a
 * forma completa: "Bom dia, Irmã Ilma", não "Bom dia, Ir.ª Ilma".
 *
 * Tratamento não reconhecido devolve como veio, em vez de sumir — abreviações
 * novas que a igreja passe a usar continuam aparecendo, só que abreviadas.
 */
const POR_EXTENSO: Readonly<Record<string, string>> = {
  "pr.": "Pastor",
  "pra.": "Pastora",
  "pb.": "Presbítero",
  "presb.": "Presbítero",
  "dc.": "Diácono",
  "diac.": "Diácono",
  "ev.": "Evangelista",
  "miss.": "Missionário(a)",
  "aux.": "Auxiliar",
  "ir.": "Irmão",
  "ir.a": "Irmã",
};

export function tratamentoPorExtenso(tratamento: string | null): string | null {
  if (!tratamento) return null;
  return POR_EXTENSO[semAcento(tratamento)] ?? tratamento;
}
