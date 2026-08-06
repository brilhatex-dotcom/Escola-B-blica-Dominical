/**
 * Excluir um registro que tem histórico.
 *
 * ============================================================================
 * APAGAR DE VEZ E ARQUIVAR SÃO A MESMA AÇÃO PARA QUEM CLICA — E NÃO PODEM SER
 * A MESMA COISA PARA O BANCO
 *
 * Um aluno matriculado em março tem presenças gravadas em todos os domingos
 * desde então. Apagá-lo de verdade faria uma de duas coisas, as duas ruins:
 * o banco recusaria (as frequências apontam para ele) ou, com CASCADE, levaria
 * junto meses de chamada — e o relatório de frequência do trimestre passaria a
 * dar outro número, sem que ninguém entendesse por quê.
 *
 * Por isso a exclusão olha antes: sem histórico, apaga mesmo, porque foi um
 * cadastro errado feito há cinco minutos e ninguém quer ver lixo na lista. Com
 * histórico, ARQUIVA — o registro sai das telas do dia a dia e os números
 * antigos continuam batendo.
 *
 * A tela diz qual das duas aconteceu. Um sistema que responde "excluído" e
 * deixa a pessoa na lista de inativos, sem avisar, ensina a não confiar no
 * botão.
 * ============================================================================
 */

export type ResultadoExclusao =
  | { feito: "apagado"; mensagem: string }
  | { feito: "arquivado"; mensagem: string; dependencias: number };

export interface PlanoDeExclusao {
  /** Quantos registros dependem deste. Zero libera o apagamento de verdade. */
  dependencias: number;
  /** O que dizer quando foi arquivado — em português, sem jargão de banco. */
  motivo: string;
  apagar: () => Promise<unknown>;
  arquivar: () => Promise<unknown>;
}

export async function excluirOuArquivar(plano: PlanoDeExclusao): Promise<ResultadoExclusao> {
  if (plano.dependencias === 0) {
    await plano.apagar();
    return { feito: "apagado", mensagem: "Excluído definitivamente." };
  }

  await plano.arquivar();
  return {
    feito: "arquivado",
    dependencias: plano.dependencias,
    mensagem: plano.motivo,
  };
}
