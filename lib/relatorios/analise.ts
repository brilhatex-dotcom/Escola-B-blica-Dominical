import { MINIMO_DE_CHAMADAS } from "./comum";
import { variacaoPct, type Classificacao, type ResultadoIGS } from "./indices";

/**
 * Os alertas e a análise em texto — geradas a partir de NÚMEROS JÁ CALCULADOS,
 * nunca de uma fonte própria.
 *
 * ============================================================================
 * "IA" AQUI É REGRA, NÃO MODELO — E ISSO ESTÁ DITO NA TELA
 *
 * O pedido original chamava esta área de "Análise com Inteligência Artificial".
 * O que está implementado é geração de texto por REGRA: cada frase é um molde
 * preenchido com um número que a rota já calculou, nunca um resumo criado por
 * um modelo de linguagem consultando o banco.
 *
 * A diferença importa porque um LLM pode "arredondar para o lado errado" e
 * inventar uma congregação que cresceu quando na verdade caiu — e ninguém
 * perceberia até alguém conferir a tabela. Regra fixa não erra desse jeito: ou
 * a condição bate com o número, ou a frase não aparece.
 *
 * A arquitetura está pronta para trocar o gerador de frases por uma chamada de
 * IA de verdade no dia em que isso fizer sentido — a função recebe os MESMOS
 * dados já apurados e prontos, sem nenhum acesso a banco. É só trocar o corpo
 * de `gerarAnalise`, mantendo a assinatura.
 * ============================================================================
 */

export interface CongregacaoBI {
  congId: number;
  nome: string;
  /** Chamadas (linhas de `Frequencias`) no período — o piso de confiança. */
  chamadas: number;
  taxaFrequencia: number | null;
  tendenciaPct: number | null;
  visitantesAnt: number;
  visitantesRec: number;
  igs: ResultadoIGS | null;
  classificacao: Classificacao | null;
}

/** `true` quando a congregação tem chamadas suficientes para a nota valer algo. */
export function temDadoSuficiente(c: Pick<CongregacaoBI, "chamadas">): boolean {
  return c.chamadas >= MINIMO_DE_CHAMADAS;
}

export interface ClasseSemChamada {
  classeId: number;
  classe: string;
  congregacao: string;
  /** `null` = nunca teve UMA chamada sequer registrada. */
  diasSemChamada: number | null;
}

export interface CampoBI {
  taxaFrequencia: number | null;
  tendenciaPct: number | null;
  visitantesAnt: number;
  visitantesRec: number;
  igs: ResultadoIGS | null;
  classificacao: Classificacao | null;
}

export interface DadosBI {
  periodo: { de: string; ate: string };
  campo: CampoBI;
  congregacoes: CongregacaoBI[];
  classesSemChamada: ClasseSemChamada[];
}

/* ------------------------------------------------------------------ *
 * Alertas
 * ------------------------------------------------------------------ */

export type NivelAlerta = "critico" | "atencao";
export type TipoAlerta =
  | "congregacao-critica"
  | "queda-frequencia"
  | "classe-sem-chamada"
  | "visitantes-caindo"
  | "abaixo-da-media";

export interface Alerta {
  nivel: NivelAlerta;
  tipo: TipoAlerta;
  titulo: string;
  descricao: string;
  /** Link opcional — para onde o clique no alerta deveria levar. */
  destino?: string;
}

const CLASSE_SEM_CHAMADA_LIMITE_DIAS = 21; // três domingos

/**
 * ============================================================================
 * O QUE ESTE GERADOR DELIBERADAMENTE NÃO ALERTA
 *
 * "Professor ausente" e "classe sem crescimento há seis meses" estavam no
 * pedido original e saem daqui pelo mesmo motivo do Índice: não existe
 * registro de presença de professor, e "crescimento de alunos" exigiria um
 * histórico de matrícula que o cadastro não guarda. Um alerta fabricado com
 * esses dois pareceria tão confiável quanto os outros cinco — e seria o único
 * mentindo.
 * ============================================================================
 */
export function gerarAlertas(dados: DadosBI): Alerta[] {
  const alertas: Alerta[] = [];

  for (const c of dados.congregacoes) {
    if (!temDadoSuficiente(c)) continue;

    if (c.classificacao?.faixa === "critica" && c.igs) {
      alertas.push({
        nivel: "critico",
        tipo: "congregacao-critica",
        titulo: `${c.nome} está em situação crítica`,
        descricao: `Índice de saúde em ${c.igs.nota} — abaixo do piso de 60 pontos.`,
        destino: `/dashboard/congregacoes`,
      });
    }

    if (c.tendenciaPct !== null && c.tendenciaPct <= -15) {
      alertas.push({
        nivel: c.tendenciaPct <= -30 ? "critico" : "atencao",
        tipo: "queda-frequencia",
        titulo: `${c.nome} perdeu frequência`,
        descricao: `A média de presença caiu ${Math.abs(c.tendenciaPct)}% na segunda metade do período, na comparação com a primeira.`,
        destino: `/dashboard/relatorios/frequencia`,
      });
    }

    if (
      dados.campo.taxaFrequencia !== null &&
      c.taxaFrequencia !== null &&
      dados.campo.taxaFrequencia - c.taxaFrequencia >= 20
    ) {
      alertas.push({
        nivel: "atencao",
        tipo: "abaixo-da-media",
        titulo: `${c.nome} está bem abaixo da média do campo`,
        descricao: `${arredondar(c.taxaFrequencia)}% de frequência, ${arredondar(dados.campo.taxaFrequencia - c.taxaFrequencia)} pontos percentuais abaixo da média do campo (${arredondar(dados.campo.taxaFrequencia)}%).`,
      });
    }
  }

  for (const classe of dados.classesSemChamada) {
    if (classe.diasSemChamada !== null && classe.diasSemChamada < CLASSE_SEM_CHAMADA_LIMITE_DIAS) {
      continue;
    }
    alertas.push({
      nivel: classe.diasSemChamada === null || classe.diasSemChamada > 60 ? "critico" : "atencao",
      tipo: "classe-sem-chamada",
      titulo: `${classe.classe} sem chamada`,
      descricao:
        classe.diasSemChamada === null
          ? `${classe.congregacao} — nunca registrou chamada.`
          : `${classe.congregacao} — ${classe.diasSemChamada} dias sem registrar chamada.`,
      destino: `/dashboard/classes/${classe.classeId}`,
    });
  }

  const variacaoVisitantesCampo = variacaoPct(dados.campo.visitantesAnt, dados.campo.visitantesRec);
  if (variacaoVisitantesCampo !== null && variacaoVisitantesCampo <= -30) {
    alertas.push({
      nivel: "atencao",
      tipo: "visitantes-caindo",
      titulo: "Visitantes em queda no campo",
      descricao: `${dados.campo.visitantesRec} visitantes na segunda metade do período, ${Math.abs(variacaoVisitantesCampo)}% a menos que os ${dados.campo.visitantesAnt} da primeira.`,
      destino: "/dashboard/visitantes",
    });
  }

  // Crítico primeiro — é o que a liderança precisa ver sem rolar a tela.
  return alertas.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "critico" ? -1 : 1));
}

/* ------------------------------------------------------------------ *
 * Análise automática (texto)
 * ------------------------------------------------------------------ */

function arredondar(n: number): number {
  return Math.round(n * 10) / 10;
}

export function gerarAnalise(dados: DadosBI): string[] {
  const frases: string[] = [];
  const comDado = dados.congregacoes.filter(temDadoSuficiente);

  if (dados.campo.igs && dados.campo.classificacao) {
    frases.push(
      `O Campo está com Índice Geral de ${dados.campo.igs.nota} (${dados.campo.classificacao.rotulo}).`,
    );
  } else {
    frases.push(
      "Ainda não há chamadas suficientes no período para calcular o Índice Geral do Campo.",
    );
  }

  if (comDado.length > 0) {
    const boas = comDado.filter(
      (c) => c.classificacao?.faixa === "excelente" || c.classificacao?.faixa === "muito-boa",
    ).length;
    const atencao = comDado.filter((c) => c.classificacao?.faixa === "atencao").length;
    const criticas = comDado.filter((c) => c.classificacao?.faixa === "critica").length;

    frases.push(
      `Das ${comDado.length} congregações com dado suficiente, ${boas} ${boas === 1 ? "está" : "estão"} em boa situação, ${atencao} ${atencao === 1 ? "precisa" : "precisam"} de atenção e ${criticas} ${criticas === 1 ? "está" : "estão"} em situação crítica.`,
    );
  }

  const comTendencia = comDado.filter((c) => c.tendenciaPct !== null);

  const maiorCrescimento = [...comTendencia].sort(
    (a, b) => (b.tendenciaPct ?? 0) - (a.tendenciaPct ?? 0),
  )[0];
  if (maiorCrescimento && (maiorCrescimento.tendenciaPct ?? 0) >= 3) {
    frases.push(
      `${maiorCrescimento.nome} apresentou o maior crescimento de frequência do período, com +${arredondar(maiorCrescimento.tendenciaPct!)}%.`,
    );
  }

  const maiorQueda = [...comTendencia].sort(
    (a, b) => (a.tendenciaPct ?? 0) - (b.tendenciaPct ?? 0),
  )[0];
  if (maiorQueda && (maiorQueda.tendenciaPct ?? 0) <= -3 && maiorQueda !== maiorCrescimento) {
    frases.push(
      `${maiorQueda.nome} teve a maior queda de frequência do período, de ${arredondar(maiorQueda.tendenciaPct!)}%.`,
    );
  }

  const variacaoVisitantes = variacaoPct(dados.campo.visitantesAnt, dados.campo.visitantesRec);
  if (dados.campo.visitantesAnt > 0 || dados.campo.visitantesRec > 0) {
    frases.push(
      variacaoVisitantes === null
        ? `O campo recebeu ${dados.campo.visitantesRec} visitantes na segunda metade do período, sem base de comparação na primeira.`
        : `O campo recebeu ${dados.campo.visitantesRec} visitantes na segunda metade do período — ${variacaoVisitantes >= 0 ? "crescimento" : "queda"} de ${Math.abs(variacaoVisitantes)}% em relação à primeira.`,
    );
  }

  if (dados.classesSemChamada.length > 0) {
    const n = dados.classesSemChamada.length;
    frases.push(
      `${n} ${n === 1 ? "classe está" : "classes estão"} sem registrar chamada há mais de três semanas.`,
    );
  }

  return frases;
}
