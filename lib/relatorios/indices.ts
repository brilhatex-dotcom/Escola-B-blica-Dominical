/**
 * O Índice de Saúde — a nota de 0 a 100 que resume uma congregação (IGS) ou o
 * campo inteiro (IGE).
 *
 * ============================================================================
 * SÓ ENTRA NA NOTA O QUE É MEDIDO DE VERDADE
 *
 * O pedido original incluía "crescimento de alunos", "participação dos
 * professores" e "cumprimento das atividades da EBD". Nenhum dos três tem dado
 * por trás: o cadastro NÃO guarda histórico de matrícula (README já documenta
 * isso desde a Fase 04 — "presenças ÷ alunos de hoje" já foi rejeitado ali pelo
 * mesmo motivo), não existe registro de presença de PROFESSOR (só de aluno), e
 * "atividades da EBD" não é uma tabela em lugar nenhum.
 *
 * Inventar um número para eles seria pior do que não ter o índice: pareceria
 * medição e seria palpite. Por isso a nota usa CINCO componentes, todos
 * calculáveis a partir de `Frequencias` e `Visitantes` — as duas tabelas que
 * realmente têm data e realmente são preenchidas toda semana.
 * ============================================================================
 */

export type Faixa = "excelente" | "muito-boa" | "atencao" | "critica";

export interface Classificacao {
  faixa: Faixa;
  rotulo: string;
  emoji: string;
}

/**
 * Os pesos somam 100 — a nota final já nasce numa escala de 0 a 100, sem
 * conversão. Documentados aqui, e só aqui: mudar a filosofia do índice é
 * mudar este objeto, não caçar números espalhados pelas telas.
 */
export const PESOS_IGS = {
  /** A métrica mais direta de "a igreja está vindo": presentes ÷ chamadas do período. */
  frequencia: 35,
  /** A congregação está de fato REGISTRANDO chamada, domingo a domingo? */
  regularidade: 20,
  /** A frequência da 2ª metade do período está melhor ou pior que a 1ª? */
  tendencia: 20,
  /** Visitantes recebidos na 2ª metade vs a 1ª — a EBD está atraindo gente nova? */
  visitantes: 15,
  /** Penalidade: quantos dos alunos chamados no período estão sumindo. */
  faltosos: 10,
} as const;

/**
 * Faltas seguidas a partir das quais um aluno conta como "faltoso recorrente".
 *
 * O mesmo número do padrão de `?minimo=` em Alerta de Faltas — de propósito.
 * Se o índice usasse um piso diferente do relatório que lista os nomes, a
 * secretaria veria "12% de faltosos" aqui e uma lista com outra contagem lá,
 * e aprenderia a desconfiar dos dois.
 */
export const SEQUENCIA_FALTAS_PREOCUPANTE = 3;

/** Nota 0-100 dos componentes calculáveis; `null` no que não deu para apurar. */
export interface ComponentesIGS {
  frequencia: number | null;
  regularidade: number | null;
  tendencia: number | null;
  visitantes: number | null;
  faltosos: number | null;
}

export interface ResultadoIGS {
  nota: number;
  /** Componentes que de fato entraram na conta — os `null` foram excluídos, não zerados. */
  componentesUsados: Array<keyof ComponentesIGS>;
}

/**
 * Combina os componentes numa nota só, redistribuindo o peso do que faltar.
 *
 * ============================================================================
 * POR QUE REDISTRIBUIR, E NÃO TRATAR "SEM DADO" COMO ZERO
 *
 * Uma congregação sem visitante nenhum no período (comum em classes só de
 * adultos, num mês tranquilo) não está "falhando" em receber visitas — não
 * houve visita para medir. Zerar esse componente puniria a ausência de dado
 * como se fosse um mau resultado, o mesmo erro que a regra "faltou ≠ não
 * marcado" já corrige em todo o resto do sistema.
 *
 * Com dois de cinco componentes ausentes, os três que sobraram passam a valer
 * 100% do peso entre si, na MESMA proporção relativa que tinham antes.
 * ============================================================================
 *
 * Devolve `null` quando nenhum componente pôde ser calculado — não existe nota
 * de coisa nenhuma.
 */
export function calcularIGS(componentes: ComponentesIGS): ResultadoIGS | null {
  const disponiveis = (Object.keys(PESOS_IGS) as Array<keyof ComponentesIGS>).filter(
    (chave) => componentes[chave] !== null,
  );
  if (disponiveis.length === 0) return null;

  const pesoTotal = disponiveis.reduce((soma, chave) => soma + PESOS_IGS[chave], 0);
  const soma = disponiveis.reduce(
    (acc, chave) => acc + (componentes[chave] as number) * PESOS_IGS[chave],
    0,
  );

  return {
    nota: Math.round((soma / pesoTotal) * 10) / 10,
    componentesUsados: disponiveis,
  };
}

const FAIXAS: Array<{ minimo: number; faixa: Faixa; rotulo: string; emoji: string }> = [
  { minimo: 90, faixa: "excelente", rotulo: "Excelente", emoji: "🟢" },
  { minimo: 80, faixa: "muito-boa", rotulo: "Muito Boa", emoji: "🟢" },
  { minimo: 60, faixa: "atencao", rotulo: "Atenção", emoji: "🟡" },
  { minimo: -Infinity, faixa: "critica", rotulo: "Crítica", emoji: "🔴" },
];

export function classificarIGS(nota: number): Classificacao {
  const achado = FAIXAS.find((f) => nota >= f.minimo)!;
  return { faixa: achado.faixa, rotulo: achado.rotulo, emoji: achado.emoji };
}

/**
 * Uma variação percentual (-100% a +∞) numa nota de 0 a 100.
 *
 * ============================================================================
 * 50 É O PONTO NEUTRO, DE PROPÓSITO
 *
 * "Sem crescer e sem cair" não pode valer nem 0 nem 100 — os dois extremos
 * ficam reservados para variações de verdade. A reta `50 + variação` faz 0%
 * de variação cair exatamente no meio da escala, e ±30 pontos percentuais
 * (para mais ou para menos) já encostam nos extremos — o suficiente para
 * distinguir estabilidade de mudança real sem exigir um crescimento
 * inatingível para tirar nota alta.
 * ============================================================================
 */
export function scoreDeVariacao(percentual: number | null): number | null {
  if (percentual === null) return null;
  return Math.max(0, Math.min(100, 50 + percentual));
}

export type TendenciaTipo = "subindo" | "descendo" | "estavel" | "sem-base";

/**
 * A seta e o rótulo a partir de duas médias — a mesma leitura em toda tela do
 * portal que compara "antes" com "depois" (painel principal, Frequência,
 * agora aqui).
 *
 * "Estável" é uma faixa, não um empate exato: variações abaixo de 3 pontos
 * percentuais são ruído de amostra pequena, e chamar de "subindo" uma
 * diferença de meio ponto ensinaria a desconfiar da seta.
 */
export function tendenciaDe(percentual: number | null): TendenciaTipo {
  if (percentual === null) return "sem-base";
  if (Math.abs(percentual) < 3) return "estavel";
  return percentual > 0 ? "subindo" : "descendo";
}

/**
 * Variação percentual entre um valor anterior e um recente.
 *
 * `null` quando o anterior é zero: "de 0 para 4" não tem percentual — é
 * infinito, e fingir um número ali (mesmo "+100%") seria inventar uma conta
 * que não existe. É a mesma regra de `variacao: null` do painel principal
 * (`lib/dashboard/consultas.ts`), repetida aqui porque o Índice de Saúde
 * precisa exatamente da mesma honestidade.
 */
export function variacaoPct(anterior: number, recente: number): number | null {
  if (anterior === 0) return null;
  return Math.round(((recente - anterior) / anterior) * 1000) / 10;
}
