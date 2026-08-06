/**
 * A posição da pessoa no ministério.
 *
 * ============================================================================
 * ISTO NÃO É O MESMO QUE CARGO NA EBD — E CONFUNDIR OS DOIS SERIA CARO
 *
 * `Cargos`/`PessoaCargos` (Fase 05) guarda o que a pessoa FAZ na Escola
 * Bíblica: Professor, Dirigente, Secretário. É de lá que sai a permissão de
 * acesso ao portal.
 *
 * Isto aqui é outra coisa: a posição eclesiástica na igreja — Membro, Auxiliar,
 * Diácono, Presbítero, Evangelista, Pastor. Um Presbítero pode não dar aula
 * nenhuma, e um Professor pode ser Membro. Guardar os dois no mesmo campo faria
 * "Pastor" virar um cargo da EBD e abrir portas que não são dele.
 * ============================================================================
 *
 * O TRATAMENTO SAI DAQUI, e não é digitado à parte. O sistema antigo tinha
 * "Silvério" e "Aux. Silverio" como duas pessoas diferentes justamente porque o
 * tratamento era escrito junto do nome, à mão. Aqui ele é consequência da
 * posição: escolher "Presbítero" já produz o "Pb." na exibição.
 */

export interface PosicaoMinisterial {
  /** O valor gravado. Não mexer depois de existirem registros. */
  chave: string;
  rotulo: string;
  /** Abreviação usada ao exibir o nome. Vazia em Membro, que não leva nenhuma. */
  tratamento: string;
  /** Menor é mais alto — para ordenar listas de liderança. */
  ordem: number;
}

export const POSICOES: readonly PosicaoMinisterial[] = [
  { chave: "pastor", rotulo: "Pastor", tratamento: "Pr.", ordem: 10 },
  { chave: "evangelista", rotulo: "Evangelista", tratamento: "Ev.", ordem: 20 },
  { chave: "presbitero", rotulo: "Presbítero", tratamento: "Pb.", ordem: 30 },
  { chave: "diacono", rotulo: "Diácono", tratamento: "Dc.", ordem: 40 },
  { chave: "auxiliar", rotulo: "Auxiliar", tratamento: "Aux.", ordem: 50 },
  /*
   * Membro é a posição da maioria e NÃO leva tratamento.
   *
   * Ela existe na lista mesmo assim: "Membro" escolhido é diferente de campo
   * vazio. O primeiro diz que alguém conferiu; o segundo, que ninguém
   * preencheu — e são 323 alunos herdados que nascem sem nada aqui.
   */
  { chave: "membro", rotulo: "Membro", tratamento: "", ordem: 60 },
];

export const CHAVES_POSICAO: readonly string[] = POSICOES.map((p) => p.chave);

const POR_CHAVE = new Map(POSICOES.map((p) => [p.chave, p]));

/**
 * O rótulo para exibir.
 *
 * Valor desconhecido volta como veio, e não como "—": se um dia entrar no banco
 * uma posição que esta lista não prevê, escondê-la da tela tiraria da
 * secretaria justamente o registro que precisa ser corrigido.
 */
export function rotuloDaPosicao(chave: string | null | undefined): string | null {
  if (!chave) return null;
  return POR_CHAVE.get(chave)?.rotulo ?? chave;
}

/** "Pb." para presbítero, "" para membro, "" para quem não tem posição. */
export function tratamentoDaPosicao(chave: string | null | undefined): string {
  if (!chave) return "";
  return POR_CHAVE.get(chave)?.tratamento ?? "";
}

/** "Pb. José Raimundo" — o tratamento entra só quando existe. */
export function nomeComTratamento(nome: string, posicao: string | null | undefined): string {
  const t = tratamentoDaPosicao(posicao);
  return t ? `${t} ${nome}` : nome;
}
