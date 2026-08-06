import { exigirEscrita, exigirLeitura, recorteDaSessao } from "./guarda";
import type { Sessao } from "./sessao";

/**
 * O recorte de uma rota de listagem, em uma linha.
 *
 * ============================================================================
 * COMBINAR PERMISSÃO E RECORTE NUM PASSO SÓ NÃO É ATALHO — É O QUE IMPEDE
 * O ESQUECIMENTO
 *
 * Separados, uma rota nova sai com `exigirLeitura` (a permissão, que é a parte
 * que se lembra) e sem o recorte (a parte que se esquece). O resultado é a
 * falha mais silenciosa possível: a tela abre, ninguém vê erro nenhum, e um
 * Professor recebe a lista de alunos do campo inteiro.
 *
 * Juntos, a mesma chamada devolve as duas coisas, e o `congId` sai da função
 * pronto para entrar no `where`.
 * ============================================================================
 *
 * `congId: undefined` no Prisma significa "não filtre" — é o que sai para quem
 * enxerga o campo e para o portal sem autenticação configurada.
 */
export interface EscopoDaRota {
  /** Devolver imediatamente quando presente. */
  recusa: Response | null;
  sessao: Sessao | null;
  /** Pronto para `where: { congId }`. */
  congId: { in: number[] } | undefined;
  /** `true` quando a resposta está limitada a algumas congregações. */
  recortado: boolean;
}

export async function escopoDaRota(chave: string): Promise<EscopoDaRota> {
  const { sessao, recusa } = await exigirLeitura(chave);
  const congId = recusa ? undefined : recorteDaSessao(sessao);

  return { recusa, sessao, congId, recortado: congId !== undefined };
}

/**
 * Junta o recorte do acesso ao filtro que o usuário escolheu na tela.
 *
 * O pedido do usuário NUNCA amplia o recorte — se um Dirigente da congregação 4
 * digitar `?cong=9` no endereço, o resultado é vazio, e não a congregação 9.
 * Escrever `congId: pedido ?? recorte` faria exatamente o contrário, e é o erro
 * clássico deste tipo de filtro: o parâmetro da URL vence a permissão.
 */
export function combinarCongregacao(
  recorte: { in: number[] } | undefined,
  pedido: number | null,
): { in: number[] } | number | undefined {
  if (pedido === null) return recorte;
  if (!recorte) return pedido;
  return recorte.in.includes(pedido) ? pedido : { in: [] };
}

/** O mesmo, para as rotas que GRAVAM. */
export async function escopoDeEscrita(chave: string): Promise<EscopoDaRota> {
  const { sessao, recusa } = await exigirEscrita(chave);
  const congId = recusa ? undefined : recorteDaSessao(sessao);

  return { recusa, sessao, congId, recortado: congId !== undefined };
}

/**
 * Barra a gravação fora do alcance de quem está pedindo.
 *
 * ============================================================================
 * O RECORTE DA LEITURA NÃO PROTEGE A ESCRITA — SÃO DUAS CONFERÊNCIAS
 *
 * Filtrar a lista por congregação impede o Dirigente da Cong. Bandeiras de VER
 * um aluno da Cong. Pinheiro. Não impede nada quanto a ALTERÁ-LO: basta mandar
 * o id daquele aluno numa requisição, e o id é um número pequeno e fácil de
 * adivinhar.
 *
 * Por isso toda gravação confere a congregação do registro ALVO antes de tocar
 * nele — inclusive quando o alvo é escolhido indiretamente, como a classe que
 * define a congregação de um aluno novo.
 * ============================================================================
 *
 * Lança em vez de devolver: chamada de dentro de `responder()`, a exceção vira
 * a mesma recusa que qualquer outra falha, e é impossível esquecer de tratar o
 * retorno — que é justamente como este tipo de conferência costuma falhar.
 */
export function exigirCongregacaoPermitida(
  recorte: { in: number[] } | undefined,
  congId: number | null | undefined,
): void {
  if (!recorte) return; // enxerga o campo inteiro
  if (congId === null || congId === undefined || !recorte.in.includes(congId)) {
    throw new Error("Este registro não pertence à sua congregação.");
  }
}
