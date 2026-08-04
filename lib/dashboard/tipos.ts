/**
 * O que o Dashboard mostra — descrito uma vez, em tipos.
 *
 * Os numeros de hoje sao ficticios (`dados-exemplo.ts`), mas o FORMATO nao e:
 * ele foi desenhado a partir do que o banco realmente tem (`prisma/schema.prisma`)
 * e do que a camada offline guarda (`lib/db/schema.ts`).
 *
 * E por isso que os componentes recebem estes tipos e nao objetos soltos: no
 * dia em que os dados vierem do Postgres, muda a funcao que os busca — nenhum
 * componente precisa ser tocado.
 */

/** Datas civis andam como texto "YYYY-MM-DD": sem hora, sem fuso, sem surpresa. */
export type DataISO = string;

/* ------------------------------------------------------------------ *
 * Cartoes de numero
 * ------------------------------------------------------------------ */

/**
 * Variacao em relacao ao periodo anterior.
 *
 * `null` nao e zero — e "ainda nao da para comparar", que e o caso do primeiro
 * domingo do ano ou de uma classe recem-criada. Mostrar "0%" nessas horas seria
 * inventar uma informacao que ninguem apurou.
 */
export interface Variacao {
  /** Diferenca percentual. Negativo cai, positivo sobe. */
  percentual: number;
  /** Com o que se esta comparando: "vs. domingo passado". */
  referencia: string;
}

export type ChaveIndicador = "alunos" | "classes" | "presentes" | "visitantes";

export interface Indicador {
  chave: ChaveIndicador;
  titulo: string;
  valor: number;
  descricao: string;
  variacao: Variacao | null;
  /** Para onde o cartao leva ao ser clicado. */
  destino: string;
}

/* ------------------------------------------------------------------ *
 * Grafico de frequencia
 * ------------------------------------------------------------------ */

export interface PontoFrequencia {
  /** Rotulo curto do eixo: "Mar", "Abr"… */
  mes: string;
  presentes: number;
  matriculados: number;
  visitantes: number;
}

/* ------------------------------------------------------------------ *
 * Resumo do domingo
 * ------------------------------------------------------------------ */

export interface ResumoDomingo {
  licao: { numero: number; titulo: string; revista: string };
  classesIniciadas: number;
  classesTotal: number;
  presentes: number;
  visitantes: number;
  professores: number;
  /** Epoch ms da ultima sincronizacao bem-sucedida, ou `null` se nunca houve. */
  ultimaSincronizacao: number | null;
}

/* ------------------------------------------------------------------ *
 * Atividades recentes
 * ------------------------------------------------------------------ */

export type TipoAtividade =
  | "presenca"
  | "visitante"
  | "classe"
  | "relatorio"
  | "cadastro";

export interface Atividade {
  id: string;
  tipo: TipoAtividade;
  /** Quem fez. */
  autor: string;
  /** O que aconteceu, ja em linguagem de gente. */
  descricao: string;
  /** Epoch ms. */
  quando: number;
}

/* ------------------------------------------------------------------ *
 * Aniversariantes
 * ------------------------------------------------------------------ */

export interface Aniversariante {
  id: string;
  nome: string;
  classe: string;
  /** "MM-DD": aniversario nao tem ano. */
  diaMes: string;
  idade: number | null;
  /** Sem foto, o cartao usa as iniciais — e a maioria dos alunos nao tem foto. */
  foto: string | null;
}

/* ------------------------------------------------------------------ *
 * Agenda
 * ------------------------------------------------------------------ */

export type TipoCompromisso = "culto" | "ebd" | "evento";

export interface Compromisso {
  id: string;
  tipo: TipoCompromisso;
  titulo: string;
  local: string;
  /** ISO completo: aqui a HORA importa. */
  quando: string;
}


/* ------------------------------------------------------------------ *
 * Estrutura: gente e funcoes
 * ------------------------------------------------------------------ */

/**
 * Os quatro numeros que o sistema antigo nao sabia responder.
 *
 * `pessoas` e `cargosOcupados` sao DIFERENTES de proposito, e a diferenca e a
 * informacao: quem e dirigente e professor conta uma vez em pessoas e duas em
 * cargos. Mostrar so um dos dois esconde metade do quadro — ou a igreja parece
 * ter mais gente do que tem, ou parece nao estar acumulando funcao.
 */
export interface Estrutura {
  /** Gente, sem duplicidade. Uma linha por pessoa. */
  pessoas: number;
  /** Funcoes exercidas. Sempre >= pessoas. */
  cargosOcupados: number;
  /** Quantas pessoas exercem mais de uma funcao. Explica a diferenca acima. */
  acumulam: number;
  classes: number;
  congregacoes: number;
  /** Cadastros que a importacao marcou como possivel duplicata. */
  revisar: number;
}

/**
 * Uma linha da hierarquia oficial.
 *
 * `nome` nulo significa CARGO VAGO, e o card mostra assim mesmo. Esconder a
 * linha faria a igreja deixar de saber que a funcao existe e esta sem ninguem.
 */
export interface Lider {
  cargoId: number;
  cargo: string;
  ordem: number;
  pessoaId: number | null;
  nome: string | null;
  tratamento: string | null;
  foto: string | null;
}

/* ------------------------------------------------------------------ *
 * O painel inteiro
 * ------------------------------------------------------------------ */

export interface Usuario {
  nome: string;
  cargo: string;
  congregacao: string;
  foto: string | null;
}

/**
 * Por que o painel caiu na demonstracao.
 *
 *   sem-variavel · a string de conexao nao foi encontrada nas variaveis de
 *                  ambiente — resolve-se no painel da Vercel.
 *   sem-tabelas  · o banco respondeu, mas as tabelas da Fase 05 ainda nao
 *                  existem — resolve-se aplicando o SQL no Neon.
 *   outro        · qualquer outra coisa; a mensagem tecnica fica no log.
 *
 * As duas primeiras pedem acoes em lugares diferentes. Um aviso que nao as
 * distingue obriga a tentar as duas as cegas.
 */
export type CausaDaDemonstracao = "sem-variavel" | "sem-tabelas" | "outro";

export interface DadosPainel {
  /**
   * De onde vieram estes numeros.
   *
   * Existe para a tela poder DIZER quando esta mostrando demonstracao. Um
   * painel que exibe numeros de exemplo sem avisar e pior do que um painel
   * vazio: a secretaria fecha o relatorio do domingo com dados inventados.
   */
  origem: "banco" | "exemplo";
  /** Presente apenas quando `origem` e "exemplo". */
  causa?: CausaDaDemonstracao;
  /** Nome da variavel de conexao encontrada, ou `null`. Nunca a URL. */
  variavel?: string | null;
  usuario: Usuario;
  versiculo: { texto: string; referencia: string };
  indicadores: Indicador[];
  estrutura: Estrutura;
  lideranca: Lider[];
  frequencia: PontoFrequencia[];
  resumo: ResumoDomingo;
  atividades: Atividade[];
  aniversariantes: Aniversariante[];
  agenda: Compromisso[];
}
