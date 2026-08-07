/**
 * A situação religiosa do visitante: já é crente desta igreja, crente de
 * outra, ou não é evangélico.
 *
 * ============================================================================
 * TRÊS RESPOSTAS, NÃO DUAS — E POR QUE ISSO MUDA O RETORNO
 *
 * "Já é crente?" com só sim/não escondia uma diferença que decide o que a
 * igreja faz depois: quem já é membro DESTA igreja e só visitou outro culto
 * ou outra congregação do campo precisa é ser reconduzido para casa; quem é
 * crente de OUTRA denominação é uma visita de cortesia entre igrejas; quem
 * não é evangélico é quem a igreja quer apresentar o evangelho. As três
 * situações pedem um retorno diferente, e por isso são três respostas, não
 * um booleano com uma observação solta.
 *
 * O banco guarda texto (`Visitante.crente`); o formulário trabalha com o
 * mesmo texto — é como todo campo de `FormularioModal` funciona, então não
 * há conversão de tipo a fazer, só validação contra a lista conhecida.
 * ============================================================================
 */

export type SituacaoCrente = "mesma-igreja" | "outra-igreja" | "nao-evangelico";

export const OPCOES_CRENTE: readonly { chave: SituacaoCrente; rotulo: string }[] = [
  { chave: "mesma-igreja", rotulo: "Crente — desta própria igreja" },
  { chave: "outra-igreja", rotulo: "Crente — de outra igreja" },
  { chave: "nao-evangelico", rotulo: "Não é evangélico" },
];

const CHAVES_CRENTE: readonly string[] = OPCOES_CRENTE.map((o) => o.chave);

/** `true` só para um dos três valores reconhecidos — qualquer outra coisa (lixo, string vazia) é inválida. */
export function crenteValido(valor: unknown): valor is SituacaoCrente {
  return typeof valor === "string" && CHAVES_CRENTE.includes(valor);
}

/**
 * O que aparece na etiqueta da lista. `null` quando ninguém perguntou ainda
 * — ou quando o valor gravado não é nenhum dos três reconhecidos (não deve
 * acontecer pela escrita normal, mas nunca é motivo para a tela quebrar).
 */
export function rotuloCrente(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return OPCOES_CRENTE.find((o) => o.chave === valor)?.rotulo ?? null;
}

/**
 * A cor da etiqueta — a mesma nas três telas que cadastram visitante.
 *
 * "Mesma igreja" é quem precisa ser reconduzido (sucesso — resolve sozinho);
 * "outra igreja" é visita entre irmãos, sem urgência (info); "não
 * evangélico" é quem a igreja quer voltar a procurar (alerta — prioridade
 * de acompanhamento).
 */
export function varianteCrente(valor: string | null | undefined): "sucesso" | "info" | "alerta" | "neutro" {
  if (valor === "mesma-igreja") return "sucesso";
  if (valor === "outra-igreja") return "info";
  if (valor === "nao-evangelico") return "alerta";
  return "neutro";
}
