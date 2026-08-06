import { classificarIGS, type Classificacao } from "./indices";

/**
 * O Índice de Destaque Inteligente (IDI) — a nota de 0 a 100 por trás do
 * painel "Destaques" (Fase 21).
 *
 * ============================================================================
 * DEZ COMPONENTES REAIS, NÃO DEZESSETE — E OS QUE FICARAM DE FORA, DE PROPÓSITO
 *
 * O pedido original listava dezessete fatores. Alguns são a MESMA coisa
 * medida duas vezes ("regularidade das chamadas" e "participação das
 * classes" são, no fundo, a pergunta "essa turma registra chamada toda
 * semana?"); outros exigem um dado que o cadastro simplesmente não guarda:
 *
 *   - "Crescimento de matriculados" e "novos alunos": precisam de uma DATA DE
 *     MATRÍCULA por aluno. `Aluno` não tem esse campo — nunca teve, desde a
 *     Fase 03. O mesmo motivo pelo qual o IGS (`lib/relatorios/indices.ts`)
 *     já recusa "crescimento de matrícula" desde a Fase 14a.
 *   - "Visitantes convertidos em alunos matriculados": não existe vínculo no
 *     banco entre um `Visitante` e o `Aluno` em que ele eventualmente virou
 *     (mesma lacuna documentada na Fase 19, no prontuário de congregação).
 *   - "IDC — Índice de Desenvolvimento da Congregação": o pedido não define o
 *     que esse índice mediria de diferente do IGS que já existe. Tratar
 *     dois índices de 0 a 100 sobre os MESMOS dados como se fossem coisas
 *     diferentes só confundiria — o IGS já apurado entra como um dos dez
 *     componentes, e cobre o que "IDC" pediria.
 *
 * Inventar os quatro faria a nota PARECER mais completa sem SER mais
 * confiável — o mesmo raciocínio do IGS original. Os dez que sobraram são
 * tudo o que dá para calcular de verdade, a partir de `Frequencias`,
 * `Visitantes` e `PessoaCargos`.
 *
 * "Retenção de alunos" e "participação dos professores" também não têm um
 * dado direto (não existe data de saída de aluno, nem chamada de professor)
 * — os dois entram como APROXIMAÇÕES explícitas, documentadas componente a
 * componente abaixo, calculadas a partir de `Frequencias` mesmo.
 * ============================================================================
 */

export const PESOS_IDI = {
  /** Presentes ÷ chamados no período — o coração de qualquer índice de EBD. */
  frequencia: 18,
  /** Domingos com chamada registrada ÷ domingos do período — e cobre também
   *  "participação das classes": uma classe que não participa não chama. */
  regularidade: 12,
  /** Taxa de frequência do trimestre corrente vs o trimestre anterior — fixo
   *  no calendário, não no período que a tela está mostrando. */
  crescimentoTrimestral: 10,
  /** O mesmo, ano corrente vs ano anterior. */
  crescimentoAnual: 8,
  /** Domingos com visitante ÷ domingos com chamada — taxa, nunca total
   *  bruto, para não premiar sempre a congregação maior (mesma regra da
   *  Fase 18). */
  visitantes: 10,
  /** Dos visitantes com resposta sobre a fé (`crente` não nulo), quantos
   *  não eram crentes — o sinal de evangelismo, não de visita de cortesia. */
  visitantesNaoCrentes: 10,
  /** Dos nomes distintos de visitante, quantos voltaram em 2+ domingos. */
  visitantesRetornaram: 8,
  /** APROXIMAÇÃO: dos alunos chamados na primeira metade do período, quantos
   *  continuam sendo chamados na segunda — não é histórico de matrícula (que
   *  não existe), é continuidade de comparecimento. */
  retencaoAlunos: 8,
  /** APROXIMAÇÃO: das classes ativas com professor designado, quantas de
   *  fato registraram chamada no período — não é presença do professor (que
   *  não é registrada em lugar nenhum), é a classe funcionando. */
  participacaoProfessores: 8,
  /** O Índice de Saúde já existente (`lib/relatorios/indices.ts`), reaproveitado
   *  inteiro — cobre o que o pedido original chamava de "IDC". */
  igs: 8,
} as const;

export type ChaveIDI = keyof typeof PESOS_IDI;

/** Nota 0-100 de cada componente; `null` no que não deu para apurar. */
export type ComponentesIDI = Record<ChaveIDI, number | null>;

export interface ResultadoIDI {
  nota: number;
  componentesUsados: ChaveIDI[];
}

/**
 * Combina os dez componentes numa nota só, redistribuindo o peso do que
 * faltar — a MESMA matemática de `calcularIGS`, escrita de novo aqui de
 * propósito: IDI e IGS são índices INDEPENDENTES, cada um com seu próprio
 * conjunto de componentes, e fazer um importar a mecânica interna do outro
 * criaria um acoplamento que não existe de verdade — mudar um peso do IGS
 * não deveria arriscar mudar a conta do IDI.
 *
 * Devolve `null` só quando NENHUM componente pôde ser calculado.
 */
export function calcularIDI(componentes: ComponentesIDI): ResultadoIDI | null {
  const disponiveis = (Object.keys(PESOS_IDI) as ChaveIDI[]).filter((chave) => componentes[chave] !== null);
  if (disponiveis.length === 0) return null;

  const pesoTotal = disponiveis.reduce((soma, chave) => soma + PESOS_IDI[chave], 0);
  const soma = disponiveis.reduce((acc, chave) => acc + (componentes[chave] as number) * PESOS_IDI[chave], 0);

  return {
    nota: Math.round((soma / pesoTotal) * 10) / 10,
    componentesUsados: disponiveis,
  };
}

/** A mesma classificação de faixas do IGS — a escala de 0 a 100 significa a mesma coisa nos dois. */
export function classificarIDI(nota: number): Classificacao {
  return classificarIGS(nota);
}

/* ------------------------------------------------------------------ *
 * A justificativa em texto — o "por quê" automático
 * ------------------------------------------------------------------ */

export interface DadosJustificativa {
  nome: string;
  frequencia: number | null;
  crescimentoTrimestral: number | null;
  visitantes: number;
  visitantesNaoCrentes: number;
  regularidade: number | null;
  domingosNoPeriodo: number;
  domingosComChamada: number;
}

function arred(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Uma frase, no molde pedido — "A Congregação X foi eleita... por atingir Y%
 * de frequência, crescer Z%..." — montada a partir de números já apurados,
 * nunca por um modelo de linguagem consultando o banco. A mesma ressalva de
 * `gerarAnalise()`/`gerarAnaliseCongregacao()`.
 */
export function gerarJustificativaIDI(d: DadosJustificativa): string {
  const partes: string[] = [];

  if (d.frequencia !== null) partes.push(`atingir ${arred(d.frequencia)}% de frequência média`);
  if (d.crescimentoTrimestral !== null && Math.abs(d.crescimentoTrimestral) >= 3) {
    partes.push(
      d.crescimentoTrimestral > 0
        ? `crescer ${arred(d.crescimentoTrimestral)}% no trimestre`
        : `mesmo com uma queda de ${Math.abs(arred(d.crescimentoTrimestral))}% no trimestre`,
    );
  }
  if (d.visitantes > 0) {
    partes.push(
      d.visitantesNaoCrentes > 0
        ? `receber ${d.visitantes} visitantes, dos quais ${d.visitantesNaoCrentes} não eram crentes`
        : `receber ${d.visitantes} visitantes`,
    );
  }
  if (d.regularidade !== null && d.domingosNoPeriodo > 0) {
    partes.push(
      d.regularidade >= 99.5
        ? `registrar 100% das chamadas do período`
        : `registrar chamada em ${d.domingosComChamada} de ${d.domingosNoPeriodo} domingos`,
    );
  }

  if (partes.length === 0) return `A Congregação ${d.nome} foi eleita destaque, mas ainda com poucos dados no período.`;

  const ultima = partes.pop()!;
  const corpo = partes.length > 0 ? `${partes.join(", ")} e ${ultima}` : ultima;
  return `A Congregação ${d.nome} foi eleita destaque por ${corpo}.`;
}

/* ------------------------------------------------------------------ *
 * Escolha de vencedor(es) — o mesmo padrão de empate de `calcularDestaque`
 * (lib/dashboard/destaque.ts): quem empata no topo, entra junto.
 * ------------------------------------------------------------------ */

export interface Candidato {
  id: number;
  nome: string;
  valor: number | null;
}

export interface VencedorCriterio {
  ids: number[];
  nomes: string[];
  valor: number;
}

/**
 * O(s) primeiro(s) lugar(es) por um critério — maior valor, a menos que
 * `menorGanha` seja pedido (não usado hoje, mas mantém a função honesta
 * sobre a direção da comparação em vez de espalhar `-valor` pelos
 * chamadores). Ignora quem não tem valor: sem dado não é zero.
 */
export function maiorPorCriterio(candidatos: readonly Candidato[], excluirIds: readonly number[] = []): VencedorCriterio | null {
  const comValor = candidatos.filter((c) => c.valor !== null && !excluirIds.includes(c.id)) as Array<
    Candidato & { valor: number }
  >;
  if (comValor.length === 0) return null;

  const maior = Math.max(...comValor.map((c) => c.valor));
  const vencedores = comValor.filter((c) => c.valor === maior);
  return { ids: vencedores.map((v) => v.id), nomes: vencedores.map((v) => v.nome), valor: maior };
}

/* ------------------------------------------------------------------ *
 * Retenção de alunos — a aproximação
 * ------------------------------------------------------------------ */

/**
 * `presentesInicio`/`presentesFim`: conjuntos de `alunoId` chamados
 * (independente de presença) na primeira e na última fração do período.
 * Retenção = quantos da primeira fração ainda aparecem na última, sobre o
 * total da primeira — `null` quando a primeira fração está vazia (não tem
 * de quem medir continuidade).
 */
export function calcularRetencao(idsInicio: readonly number[], idsFim: readonly number[]): number | null {
  if (idsInicio.length === 0) return null;
  const fimSet = new Set(idsFim);
  const continuam = idsInicio.filter((id) => fimSet.has(id)).length;
  return Math.round((continuam / idsInicio.length) * 1000) / 10;
}
