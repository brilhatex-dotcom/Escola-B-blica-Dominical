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
 * Fila de sincronizacao
 * ------------------------------------------------------------------ */

export type Operacao = "criar" | "atualizar" | "remover";

export type Tabela = "congregacoes" | "classes" | "alunos" | "frequencias" | "visitantes";

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
  ultimoErro?: string;
}

/** Metadados soltos: ultima sincronizacao, usuario logado, etc. */
export interface Config {
  chave: string;
  valor: unknown;
}
