/**
 * As categorias de classe da EBD.
 *
 * ============================================================================
 * ESTA LISTA NÃO FOI INVENTADA — ELA É A CHAVE QUE JÁ LIGAVA TRÊS TABELAS
 *
 * `Classes.tipoClasse`, `Licoes.tipoClasse` e `Precos_Revistas.categoria` usam
 * exatamente os mesmos valores no sistema antigo: "adultos", "juniores",
 * "adolesc"… É por essa chave que a classe recebe a lição do trimestre e pede a
 * revista certa.
 *
 * Por isso a categoria é escolhida numa LISTA, e nunca digitada. Uma classe com
 * "adulto" (sem o s) não casa com preço nenhum nem com lição nenhuma, e o
 * sintoma aparece só no fim do trimestre, quando a revista não chega.
 *
 * O rótulo é separado da chave pelo mesmo motivo de sempre: a chave é do banco
 * e não muda; o rótulo é da tela e pode ser reescrito à vontade.
 * ============================================================================
 */

export interface Categoria {
  /** O valor gravado — igual ao do sistema antigo. Não mexer. */
  chave: string;
  rotulo: string;
  /** Faixa etária sugerida ao criar a classe. É sugestão, não regra. */
  faixa: string;
}

export const CATEGORIAS_DE_CLASSE: readonly Categoria[] = [
  { chave: "bercario", rotulo: "Berçário", faixa: "0 a 3 anos" },
  { chave: "maternal", rotulo: "Maternal", faixa: "4 a 5 anos" },
  { chave: "jardim", rotulo: "Jardim de Infância", faixa: "6 a 7 anos" },
  { chave: "primarios", rotulo: "Primários", faixa: "8 a 9 anos" },
  { chave: "juniores", rotulo: "Juniores", faixa: "10 a 11 anos" },
  { chave: "preadolesc", rotulo: "Pré-Adolescentes", faixa: "12 a 13 anos" },
  { chave: "adolesc", rotulo: "Adolescentes", faixa: "14 a 16 anos" },
  { chave: "juvenis", rotulo: "Juvenis", faixa: "17 a 19 anos" },
  { chave: "jovens", rotulo: "Jovens", faixa: "20 a 29 anos" },
  { chave: "jovenadult", rotulo: "Jovens e Adultos", faixa: "a partir de 20 anos" },
  { chave: "adultos", rotulo: "Adultos", faixa: "a partir de 30 anos" },
  { chave: "obreiros", rotulo: "Obreiros", faixa: "obreiros e liderança" },
];

export const CATEGORIAS: readonly string[] = CATEGORIAS_DE_CLASSE.map((c) => c.chave);

const POR_CHAVE = new Map(CATEGORIAS_DE_CLASSE.map((c) => [c.chave, c]));

/**
 * O nome da categoria para exibir.
 *
 * Categoria desconhecida volta como veio, e não como "—". O cadastro herdado
 * pode ter um valor que esta lista não prevê, e apagá-lo da tela esconderia da
 * secretaria exatamente o registro que ela precisa corrigir.
 */
export function rotuloDaCategoria(chave: string | null | undefined): string {
  if (!chave) return "Sem categoria";
  return POR_CHAVE.get(chave)?.rotulo ?? chave;
}

export function faixaSugerida(chave: string): string {
  return POR_CHAVE.get(chave)?.faixa ?? "";
}
