/**
 * Tipos do banco LOCAL (IndexedDB).
 *
 * Espelham os models do Prisma, mas nao sao os mesmos tipos — e essa diferenca
 * e o ponto principal deste arquivo.
 *
 * No servidor, o `id` e a verdade e o banco garante que ele existe. No celular
 * do professor, em pleno domingo sem sinal, um aluno pode ser cadastrado e
 * ainda nao ter id nenhum do servidor. Por isso cada registro local carrega
 * DOIS identificadores:
 *
 *   uid       — gerado aqui, no aparelho, e imutavel. E por ele que as telas,
 *               a chamada e a fila de sincronizacao se referem ao registro.
 *   idRemoto  — o id do Postgres. Chega vazio no que foi criado offline e e
 *               preenchido quando a sincronizacao confirma.
 *
 * Se as telas usassem o id do servidor, um registro criado offline mudaria de
 * identidade no meio do caminho — e toda referencia feita antes disso
 * apontaria para o vazio.
 */

/** Situacao de um registro perante o servidor. */
export type EstadoSync =
  | "sincronizado" // igual ao servidor
  | "pendente" // alterado aqui, ainda nao enviado
  | "enviando" // em transito
  | "erro"; // o envio falhou; ver `ultimoErro` na fila

/** Campos que todo registro local carrega. */
export interface Base {
  uid: string;
  idRemoto?: number;
  estado: EstadoSync;
  /** Ultima alteracao local, em epoch ms. Serve para ordenar e resolver conflito. */
  alteradoEm: number;
}

export interface Congregacao extends Base {
  nome: string;
}

export interface Classe extends Base {
  nome: string;
  faixa: string;
  prof?: string | null;
  tipoClasse: string;
  congId?: number | null;
  ativa: boolean;
}

export interface Aluno extends Base {
  nome: string;
  /** "YYYY-MM-DD". Texto, e nao Date: e uma data civil, sem hora nem fuso. */
  nasc?: string | null;
  tel?: string | null;
  resp?: string | null;
  congId?: number | null;
  classeId?: number | null;
  ativo: boolean;
}

export interface Frequencia extends Base {
  /** `uid` do aluno — nao o id remoto, que pode ainda nao existir. */
  alunoUid: string;
  alunoId?: number | null;
  classeId?: number | null;
  congId?: number | null;
  /** "YYYY-MM-DD" */
  data: string;
  presente: boolean;
}

export interface Visitante extends Base {
  nome: string;
  idade?: number | null;
  tel?: string | null;
  obs?: string | null;
  classeId?: number | null;
  congId?: number | null;
  data: string;
}

/* ------------------------------------------------------------------ *
 * A chamada de uma classe num domingo — guardada como PACOTE
 * ------------------------------------------------------------------ */

/**
 * Um aluno marcado.
 *
 * Quem nao aparece nesta lista esta "nao marcado". Sao TRES estados por aluno
 * (presente · ausente · nao marcado) e a ausencia da linha e o terceiro deles:
 * transformar "ninguem marcou" em "faltou" inventa faltas que entram no
 * relatorio do mes como se fossem reais.
 */
export interface Marca {
  /** Id do Postgres. Aqui ele existe: a lista da chamada veio do servidor. */
  alunoId: number;
  presente: boolean;
}

/**
 * A chamada de uma classe num dia, inteira.
 *
 * ============================================================================
 * POR QUE ISTO NAO SAO LINHAS EM `frequencias`
 *
 * `frequencias` guarda uma presenca por vez, e a fila levaria uma alteracao por
 * aluno — trinta itens numa classe de trinta, trinta requisicoes na rede da
 * igreja, algumas chegando e outras nao. `POST /api/chamada` grava a classe
 * inteira numa transacao: ou grava tudo ou nao grava nada.
 *
 * Entao o que a fila precisa carregar e o PACOTE, e nao as partes. Este
 * registro e o pacote — e tambem o instantaneo do que a tela precisa para abrir
 * sem internet.
 * ============================================================================
 *
 * Diferente do resto do banco local, este registro nao e "uma linha do
 * servidor": e uma INTENCAO de gravacao. Por isso `idRemoto` nunca e preenchido
 * — a rota devolve quantas linhas criou e atualizou, e nao um id.
 */
export interface ChamadaLocal extends Base {
  /** Id remoto da classe. */
  classeId: number;
  /** "YYYY-MM-DD" */
  data: string;
  marcas: Marca[];
  /**
   * O que a tela precisa para se desenhar sem servidor. Nao vai no envio.
   * Sem isto, quem abre a Chamada sem sinal ve um erro e nao tem o que marcar,
   * mesmo com a lista tendo sido carregada cinco minutos antes.
   */
  cache?: {
    classeNome: string;
    faixa: string;
    professores: string[];
    alunos: Array<{ id: number; nome: string; nasc: string | null }>;
  };
}

/* ------------------------------------------------------------------ *
 * Fila de sincronizacao
 * ------------------------------------------------------------------ */

export type Operacao = "criar" | "atualizar" | "remover";

export type Tabela =
  | "congregacoes"
  | "classes"
  | "alunos"
  | "frequencias"
  | "visitantes"
  | "chamadas";

/**
 * Uma alteracao esperando para subir.
 *
 * A fila guarda a INTENCAO ("marcar presenca do aluno X no dia Y"), e nao o
 * registro inteiro. Assim, duas alteracoes no mesmo aluno sobem na ordem em
 * que aconteceram, e uma falha de rede no meio nao mistura os dados.
 */
export interface ItemFila {
  id?: number; // autoincrement do proprio Dexie
  tabela: Tabela;
  operacao: Operacao;
  /** `uid` do registro afetado. */
  uid: string;
  /** Corpo enviado ao servidor. */
  dados: unknown;
  criadoEm: number;
  tentativas: number;
  /** Epoch ms da ultima tentativa. E daqui que o recuo progressivo conta. */
  ultimaTentativa?: number;
  ultimoErro?: string;
  /**
   * O servidor recusou de um jeito que reenviar nao resolve — tipicamente o
   * `403` de quem ainda usa a senha herdada.
   *
   * O item NAO e descartado: descartar apagaria a chamada do domingo por causa
   * de uma senha. Ele fica parado, visivel no indicador do painel, e volta a
   * subir quando a causa for resolvida (`liberarBloqueios` em lib/sync/motor).
   */
  bloqueado?: boolean;
}

/** Metadados soltos: ultima sincronizacao, usuario logado, etc. */
export interface Config {
  chave: string;
  valor: unknown;
}
