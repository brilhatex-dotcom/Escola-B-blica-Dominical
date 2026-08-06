/**
 * A marca "crente ou não evangélico" do visitante.
 *
 * ============================================================================
 * POR QUE NÃO É SÓ UM BOOLEANO NA TELA
 *
 * O banco guarda `true | false | null` (crente, não evangélico, não
 * perguntado). O formulário trabalha com texto — é como todo campo de
 * `FormularioModal` funciona — então o tri-estado vira `"sim" | "nao" | ""`
 * na ida e na volta. Sem esta conversão em um lugar só, as três telas que
 * cadastram visitante (Chamada, Visitantes, Congregações) acabariam cada
 * uma com sua própria regra, e bastaria uma delas inverter sim/não para o
 * cadastro de uma tela discordar do de outra.
 * ============================================================================
 */

/** Do banco (`Visitante.crente`) para o valor do `<select>`. */
export function crenteParaTexto(v: boolean | null | undefined): string {
  if (v === true) return "sim";
  if (v === false) return "nao";
  return "";
}

/** O que aparece na etiqueta da lista. `null` quando ninguém perguntou ainda. */
export function rotuloCrente(v: boolean | null | undefined): string | null {
  if (v === true) return "Crente";
  if (v === false) return "Não evangélico";
  return null;
}
