/**
 * Erros da sincronizacao.
 *
 * Ficam num arquivo proprio porque tanto o motor quanto o transporte precisam
 * deles — o transporte para lancar, o motor para reconhecer. Se morassem em um
 * dos dois, o outro teria de importa-lo e os dois passariam a depender um do
 * outro em circulo.
 */

/**
 * O servidor recusou, e reenviar nao muda nada.
 *
 * ============================================================================
 * POR QUE ESTA DISTINCAO EXISTE
 *
 * O motor foi feito para insistir: rede que cai, servidor que reinicia, celular
 * que perde o sinal no meio do culto — tudo isso passa, e a chamada sobe na
 * tentativa seguinte. Insistir e o comportamento certo.
 *
 * Mas ha recusas que nao passam sozinhas. A principal e o `403` de quem ainda
 * usa a senha herdada da planilha: o servidor vai recusar hoje, daqui a uma
 * hora e amanha, ate a pessoa trocar a senha. Insistir nesse caso e uma
 * requisicao a cada 30 segundos, a manha inteira, gastando bateria e dados de
 * quem esta na igreja — e sem uma unica chance de sucesso.
 *
 * O que NAO se faz e descartar o item. A chamada de domingo nao pode ser
 * apagada por causa de uma senha: ela fica parada, contada no indicador do
 * painel, e sobe assim que a causa for resolvida.
 * ============================================================================
 */
export class ErroPermanente extends Error {
  /**
   * A marca que identifica este erro.
   *
   * O reconhecimento e feito por ela, e nao por `instanceof`, e isso NAO e
   * preciosismo: `instanceof` compara com UM objeto de classe, e o mesmo
   * arquivo pode ser carregado mais de uma vez num processo — foi o que
   * aconteceu ao exercitar o motor no Node, onde o script de verificacao e um
   * modulo ESM e os arquivos do portal sao CommonJS. Resultado: duas classes de
   * mesmo nome, `instanceof` falso, e o motor tratando "troque a senha" como
   * falha de rede, insistindo para sempre. Uma marca no proprio objeto atravessa
   * qualquer fronteira de modulo.
   */
  readonly permanente = true as const;

  /** O que o usuario precisa fazer, em portugues, sem jargao. */
  readonly acao: string;

  constructor(mensagem: string, acao: string) {
    super(mensagem);
    this.name = "ErroPermanente";
    this.acao = acao;
  }
}

/** `true` quando o erro e daqueles em que reenviar nao muda nada. */
export function ehErroPermanente(erro: unknown): erro is ErroPermanente {
  return (
    erro instanceof ErroPermanente ||
    (typeof erro === "object" && erro !== null && (erro as { permanente?: unknown }).permanente === true)
  );
}
