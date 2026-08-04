import Dexie, { type EntityTable } from "dexie";
import type {
  Aluno,
  Classe,
  Config,
  Congregacao,
  Frequencia,
  ItemFila,
  Tabela,
  Visitante,
} from "./schema";

/**
 * Banco local do portal (IndexedDB via Dexie).
 *
 * E a fonte de verdade para quem esta usando o sistema: toda leitura de tela e
 * toda escrita passam por aqui primeiro, e so depois a fila leva as alteracoes
 * ao servidor. E o que a especificacao chama de Offline First — o professor
 * abre o app no domingo, sem sinal, e faz a chamada inteira.
 *
 * Os indices abaixo nao sao decorativos: sao exatamente as buscas da chamada
 * ("alunos desta classe", "frequencias deste dia"). Sem eles, o Dexie varre a
 * tabela inteira, e com 2.600 frequencias isso trava a interface num celular
 * modesto.
 */
export class BancoLocal extends Dexie {
  congregacoes!: EntityTable<Congregacao, "uid">;
  classes!: EntityTable<Classe, "uid">;
  alunos!: EntityTable<Aluno, "uid">;
  frequencias!: EntityTable<Frequencia, "uid">;
  visitantes!: EntityTable<Visitante, "uid">;
  fila!: EntityTable<ItemFila, "id">;
  config!: EntityTable<Config, "chave">;

  constructor() {
    super("ebd-betania");

    this.version(1).stores({
      congregacoes: "uid, idRemoto, estado",
      classes: "uid, idRemoto, congId, estado",
      alunos: "uid, idRemoto, classeId, congId, estado, nome",
      // O indice composto [classeId+data] atende a consulta da chamada num
      // salto so, em vez de filtrar por classe e depois varrer por data.
      frequencias: "uid, idRemoto, alunoUid, [classeId+data], data, estado",
      visitantes: "uid, idRemoto, classeId, data, estado",
      fila: "++id, tabela, uid, criadoEm",
      config: "chave",
    });
  }
}

/**
 * Instancia unica.
 *
 * Criada sob demanda e apenas no navegador. O Dexie precisa de `indexedDB`, que
 * nao existe no Node — e as paginas deste projeto sao renderizadas no servidor
 * antes de chegar ao cliente. Instanciar no topo do modulo quebraria o build.
 */
let instancia: BancoLocal | null = null;

export function db(): BancoLocal {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "O banco local só existe no navegador. " +
        "Chame isto de dentro de um componente cliente ou de um efeito.",
    );
  }
  instancia ??= new BancoLocal();
  return instancia;
}

/** `true` quando da para usar o banco local. */
export function temBancoLocal(): boolean {
  return typeof indexedDB !== "undefined";
}

/* ------------------------------------------------------------------ *
 * Utilitarios
 * ------------------------------------------------------------------ */

/**
 * Identificador local.
 *
 * `crypto.randomUUID` existe em todo navegador atual, mas exige contexto
 * seguro (https ou localhost). A reserva cobre o caso de alguem abrir o
 * sistema por IP na rede da igreja, onde nao ha https.
 */
export function novoUid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `uid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Data civil de hoje, "YYYY-MM-DD", no fuso do aparelho. */
export function hoje(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Apaga tudo. Usado no logout e em teste. */
export async function limparBancoLocal(): Promise<void> {
  const banco = db();
  await banco.transaction(
    "rw",
    [banco.congregacoes, banco.classes, banco.alunos, banco.frequencias, banco.visitantes, banco.fila, banco.config],
    async () => {
      await Promise.all([
        banco.congregacoes.clear(),
        banco.classes.clear(),
        banco.alunos.clear(),
        banco.frequencias.clear(),
        banco.visitantes.clear(),
        banco.fila.clear(),
        banco.config.clear(),
      ]);
    },
  );
}

/** Quantos registros ainda nao subiram, por tabela. */
export async function pendencias(): Promise<Record<Tabela | "total", number>> {
  const banco = db();
  const itens = await banco.fila.toArray();
  const contagem = {
    congregacoes: 0,
    classes: 0,
    alunos: 0,
    frequencias: 0,
    visitantes: 0,
    total: itens.length,
  } as Record<Tabela | "total", number>;
  for (const item of itens) contagem[item.tabela]++;
  return contagem;
}
