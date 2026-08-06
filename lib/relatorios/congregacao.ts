import { MINIMO_DE_CHAMADAS } from "./comum";
import { normalizarChave } from "@/lib/pessoas/nome";

/**
 * O prontuário de uma congregação — a conta pura por trás de
 * `/api/relatorios/congregacao/[id]`.
 *
 * ============================================================================
 * TUDO SEPARADO DA CONSULTA AO BANCO, DE PROPÓSITO
 *
 * A mesma disciplina de `lib/relatorios/indices.ts` e `lib/dashboard/destaque.ts`:
 * a regra fica aqui, testável sem Postgres (`scripts/verificar-congregacao.mts`),
 * e a rota só busca os números e chama estas funções.
 * ============================================================================
 */

/* ------------------------------------------------------------------ *
 * Indicador de cor — a mesma leitura da tabela de classes e da tabela
 * de professores
 * ------------------------------------------------------------------ */

export type IndicadorCor = "verde" | "amarelo" | "vermelho" | "sem-dado";

/**
 * Três faixas, não as quatro do IGS — a tabela de classes precisa de uma
 * leitura rápida por cor, não de uma nota. `null` (sem chamada nenhuma no
 * período) vira "sem-dado", nunca "vermelho": não ter registro não é o mesmo
 * que ter ido mal.
 */
export function indicadorPorPercentual(percentual: number | null): IndicadorCor {
  if (percentual === null) return "sem-dado";
  if (percentual >= 80) return "verde";
  if (percentual >= 60) return "amarelo";
  return "vermelho";
}

/* ------------------------------------------------------------------ *
 * Tempo na função — "1 ano e 3 meses", a partir de PessoaCargo.inicio
 * ------------------------------------------------------------------ */

/**
 * `null` quando não há data de início registrada — comum em vínculos
 * herdados da importação, que nasceram sem essa informação. Nunca inventa
 * "desde sempre": melhor não mostrar do que mostrar um tempo que não existe.
 */
export function tempoNaFuncao(inicio: Date | null, hoje: Date): string | null {
  if (!inicio) return null;
  const meses = Math.max(
    0,
    (hoje.getUTCFullYear() - inicio.getUTCFullYear()) * 12 +
      (hoje.getUTCMonth() - inicio.getUTCMonth()) -
      (hoje.getUTCDate() < inicio.getUTCDate() ? 1 : 0),
  );
  if (meses < 1) return "menos de um mês";
  const anos = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  if (anos === 0) return mesesRestantes === 1 ? "1 mês" : `${mesesRestantes} meses`;
  const parteAnos = anos === 1 ? "1 ano" : `${anos} anos`;
  if (mesesRestantes === 0) return parteAnos;
  const parteMeses = mesesRestantes === 1 ? "1 mês" : `${mesesRestantes} meses`;
  return `${parteAnos} e ${parteMeses}`;
}

/* ------------------------------------------------------------------ *
 * Visitantes recorrentes — o mesmo nome voltando em mais de um domingo
 * ------------------------------------------------------------------ */

/**
 * Conta quantos NOMES DISTINTOS de visitante (normalizados — sem acento, sem
 * caixa, mesma chave de `Pessoa.chave`) aparecem em duas datas ou mais dentro
 * do período. Não identifica a pessoa (não há cadastro único de visitante,
 * como há de aluno) — é uma contagem por coincidência de nome, então dois
 * visitantes homônimos genuinamente diferentes contam como recorrência
 * mesmo sem ser a mesma pessoa. Dito isso no rótulo da tela, não escondido.
 */
export function contarVisitantesRecorrentes(
  visitas: readonly { nome: string; data: string }[],
): { recorrentes: number; unicos: number } {
  const porChave = new Map<string, Set<string>>();
  for (const v of visitas) {
    const chave = normalizarChave(v.nome);
    if (!chave) continue;
    if (!porChave.has(chave)) porChave.set(chave, new Set());
    porChave.get(chave)!.add(v.data);
  }
  let recorrentes = 0;
  for (const datas of porChave.values()) {
    if (datas.size >= 2) recorrentes++;
  }
  return { recorrentes, unicos: porChave.size };
}

/* ------------------------------------------------------------------ *
 * Ranking — a posição desta congregação entre todas, num critério
 * ------------------------------------------------------------------ */

export interface PosicaoRanking {
  posicao: number;
  total: number;
}

/**
 * `null` quando a própria congregação não tem valor no critério (sem
 * chamada suficiente, por exemplo) — não existe posição de quem não tem
 * nota. Empates dividem a mesma posição (dois primeiros lugares, o próximo
 * é 3º) — a mesma regra de qualquer ranking esportivo, para não sugerir uma
 * ordem que os números não têm.
 */
export function posicaoNoRanking(
  itens: readonly { id: number; valor: number | null }[],
  id: number,
): PosicaoRanking | null {
  const comValor = itens.filter((i) => i.valor !== null) as Array<{ id: number; valor: number }>;
  const alvo = comValor.find((i) => i.id === id);
  if (!alvo) return null;

  const ordenados = [...comValor].sort((a, b) => b.valor - a.valor);
  const posicao = ordenados.findIndex((i) => i.valor === alvo.valor) + 1;
  return { posicao, total: comValor.length };
}

/* ------------------------------------------------------------------ *
 * Indicadores automáticos — a partir da série domingo a domingo
 * ------------------------------------------------------------------ */

export interface PontoSemanal {
  data: string;
  presentes: number;
  ausentes: number;
  visitantes: number;
  /** `null` quando não houve chamada naquele domingo — nunca 0%. */
  taxa: number | null;
}

export interface IndicadoresAutomaticos {
  maiorFrequencia: { data: string; taxa: number } | null;
  menorFrequencia: { data: string; taxa: number } | null;
  melhorDomingo: { data: string; presentes: number } | null;
  piorDomingo: { data: string; presentes: number } | null;
  maiorVisitantes: { data: string; visitantes: number } | null;
}

/**
 * "Maior/menor frequência" olha a TAXA (presentes ÷ chamados) — a pergunta é
 * "em que domingo o comparecimento, proporcionalmente, foi melhor". "Melhor/
 * pior domingo" olha o NÚMERO de presentes — a pergunta é "em que domingo
 * mais gente esteve na igreja". São perguntas diferentes de propósito: uma
 * classe pequena pode ter 100% de taxa com 5 presentes, sem que isso seja o
 * "melhor domingo" da congregação em movimento de gente.
 */
export function calcularIndicadoresAutomaticos(semanas: readonly PontoSemanal[]): IndicadoresAutomaticos {
  const comChamada = semanas.filter((s) => s.taxa !== null);

  const porTaxa = [...comChamada].sort((a, b) => (b.taxa as number) - (a.taxa as number));
  const porPresentes = [...comChamada].sort((a, b) => b.presentes - a.presentes);
  const comVisitante = semanas.filter((s) => s.visitantes > 0).sort((a, b) => b.visitantes - a.visitantes);

  return {
    maiorFrequencia: porTaxa[0] ? { data: porTaxa[0].data, taxa: porTaxa[0].taxa as number } : null,
    menorFrequencia:
      porTaxa.length > 0
        ? { data: porTaxa[porTaxa.length - 1].data, taxa: porTaxa[porTaxa.length - 1].taxa as number }
        : null,
    melhorDomingo: porPresentes[0] ? { data: porPresentes[0].data, presentes: porPresentes[0].presentes } : null,
    piorDomingo:
      porPresentes.length > 0
        ? {
            data: porPresentes[porPresentes.length - 1].data,
            presentes: porPresentes[porPresentes.length - 1].presentes,
          }
        : null,
    maiorVisitantes: comVisitante[0]
      ? { data: comVisitante[0].data, visitantes: comVisitante[0].visitantes }
      : null,
  };
}

/* ------------------------------------------------------------------ *
 * Maior crescimento / maior redução — mês a mês, entre meses seguidos
 * com dado nos dois
 * ------------------------------------------------------------------ */

export interface PontoMensalCong {
  mes: string; // "YYYY-MM"
  taxa: number | null;
  chamadas: number;
}

export interface VariacaoMensal {
  mes: string;
  mesAnterior: string;
  deltaPct: number;
}

/**
 * Compara cada mês com o mês imediatamente anterior — nunca meses não
 * consecutivos, que misturaria "cresceu de março para abril" com "cresceu de
 * janeiro para abril" sob o mesmo rótulo. Mês sem chamada (taxa `null`) não
 * entra na comparação nem como início nem como fim.
 */
export function maiorVariacaoMensal(
  meses: readonly PontoMensalCong[],
): { maiorCrescimento: VariacaoMensal | null; maiorReducao: VariacaoMensal | null } {
  const variacoes: VariacaoMensal[] = [];
  for (let i = 1; i < meses.length; i++) {
    const anterior = meses[i - 1];
    const atual = meses[i];
    if (anterior.taxa === null || atual.taxa === null) continue;
    variacoes.push({
      mes: atual.mes,
      mesAnterior: anterior.mes,
      deltaPct: Math.round((atual.taxa - anterior.taxa) * 10) / 10,
    });
  }
  if (variacoes.length === 0) return { maiorCrescimento: null, maiorReducao: null };

  const ordenadas = [...variacoes].sort((a, b) => b.deltaPct - a.deltaPct);
  const maior = ordenadas[0];
  const menor = ordenadas[ordenadas.length - 1];
  return {
    maiorCrescimento: maior.deltaPct > 0 ? maior : null,
    maiorReducao: menor.deltaPct < 0 ? menor : null,
  };
}

/* ------------------------------------------------------------------ *
 * Análise automática (texto) — o mesmo molde de `lib/relatorios/analise.ts`,
 * agora sobre uma congregação só
 * ------------------------------------------------------------------ */

export interface DadosAnaliseCongregacao {
  nome: string;
  chamadas: number;
  taxaFrequencia: number | null;
  tendenciaPct: number | null;
  campoTaxaFrequencia: number | null;
  igsNota: number | null;
  classificacaoRotulo: string | null;
  melhorClasse: { nome: string; percentual: number } | null;
  piorClasse: { nome: string; percentual: number } | null;
  visitantesVariacaoPct: number | null;
  visitantesRec: number;
  classesAtrasadas: number;
}

function arred(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Frases geradas por REGRA a partir de números já apurados — a mesma
 * ressalva de `gerarAnalise()`: nenhum modelo de linguagem consultando o
 * banco, só um molde preenchido.
 */
export function gerarAnaliseCongregacao(d: DadosAnaliseCongregacao): string[] {
  const frases: string[] = [];

  if (d.chamadas < MINIMO_DE_CHAMADAS) {
    frases.push(
      `${d.nome} ainda não tem chamadas suficientes no período (mínimo de ${MINIMO_DE_CHAMADAS}) para uma análise confiável.`,
    );
    return frases;
  }

  if (d.igsNota !== null && d.classificacaoRotulo) {
    frases.push(`${d.nome} está com Índice de Saúde ${d.igsNota} (${d.classificacaoRotulo}).`);
  }

  if (d.tendenciaPct !== null && Math.abs(d.tendenciaPct) >= 3) {
    frases.push(
      d.tendenciaPct > 0
        ? `A frequência subiu ${arred(d.tendenciaPct)}% na segunda metade do período, em relação à primeira.`
        : `A frequência caiu ${Math.abs(arred(d.tendenciaPct))}% na segunda metade do período, em relação à primeira.`,
    );
  }

  if (d.taxaFrequencia !== null && d.campoTaxaFrequencia !== null) {
    const diferenca = arred(d.taxaFrequencia - d.campoTaxaFrequencia);
    if (Math.abs(diferenca) >= 3) {
      frases.push(
        diferenca > 0
          ? `A frequência está ${diferenca} pontos percentuais acima da média do campo.`
          : `A frequência está ${Math.abs(diferenca)} pontos percentuais abaixo da média do campo.`,
      );
    }
  }

  if (d.melhorClasse) {
    frases.push(
      `A Classe ${d.melhorClasse.nome} apresentou a maior evolução, com ${arred(d.melhorClasse.percentual)}% de presença.`,
    );
  }
  if (d.piorClasse && d.piorClasse.nome !== d.melhorClasse?.nome) {
    frases.push(
      `A Classe ${d.piorClasse.nome} precisa de atenção, com ${arred(d.piorClasse.percentual)}% de presença.`,
    );
  }

  if (d.visitantesRec > 0 || d.visitantesVariacaoPct !== null) {
    frases.push(
      d.visitantesVariacaoPct === null
        ? `${d.visitantesRec} visitantes recebidos na segunda metade do período, sem base de comparação na primeira.`
        : `${d.visitantesVariacaoPct >= 0 ? "Crescimento" : "Queda"} de ${Math.abs(arred(d.visitantesVariacaoPct))}% no número de visitantes, em relação à primeira metade do período.`,
    );
  }

  if (d.classesAtrasadas > 0) {
    frases.push(
      `${d.classesAtrasadas} ${d.classesAtrasadas === 1 ? "classe está" : "classes estão"} sem registrar chamada há mais de três semanas.`,
    );
  }

  return frases;
}
