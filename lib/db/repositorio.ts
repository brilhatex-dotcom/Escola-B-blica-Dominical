import type { Table } from "dexie";
import { db, novoUid } from "./local";
import type { Base, Operacao, Tabela } from "./schema";

/**
 * Escrita no banco local.
 *
 * Toda alteracao faz DUAS coisas: grava na tabela e enfileira o envio. As duas
 * acontecem na MESMA transacao do Dexie, e isso e o ponto central deste
 * arquivo.
 *
 * Se fossem separadas, bastaria o aplicativo ser fechado entre uma e outra para
 * o aparelho ficar num estado impossivel de consertar sozinho: ou a presenca
 * aparece marcada na tela e nunca sobe (o professor jura que fez a chamada, o
 * servidor discorda), ou sobe uma alteracao que a tela nao mostra. Numa
 * transacao unica, ou as duas acontecem ou nenhuma acontece.
 */

type NomeTabela = Exclude<Tabela, never>;

/** Campos que o chamador nao informa: sao responsabilidade desta camada. */
type Novo<T extends Base> = Omit<T, "uid" | "estado" | "alteradoEm"> &
  Partial<Pick<T, "uid">>;

function tabelaDe(nome: NomeTabela): Table<Base, string> {
  const banco = db();
  const mapa = {
    congregacoes: banco.congregacoes,
    classes: banco.classes,
    alunos: banco.alunos,
    frequencias: banco.frequencias,
    visitantes: banco.visitantes,
    chamadas: banco.chamadas,
  } as const;
  return mapa[nome] as unknown as Table<Base, string>;
}

/**
 * Cria ou atualiza um registro e enfileira o envio.
 * Devolve o `uid`, que e como as telas passam a se referir ao registro.
 */
export async function salvar<T extends Base>(
  nome: NomeTabela,
  dados: Novo<T>,
): Promise<string> {
  const banco = db();
  const tabela = tabelaDe(nome);
  const uid = dados.uid ?? novoUid();

  return banco.transaction("rw", [tabela, banco.fila], async () => {
    const existente = await tabela.get(uid);
    const operacao: Operacao = existente ? "atualizar" : "criar";

    const registro = {
      ...existente,
      ...dados,
      uid,
      estado: "pendente" as const,
      alteradoEm: Date.now(),
    } as Base;

    await tabela.put(registro);
    await banco.fila.add({
      tabela: nome,
      operacao,
      uid,
      dados: registro,
      criadoEm: Date.now(),
      tentativas: 0,
    });

    return uid;
  });
}

/**
 * Grava um INSTANTANEO completo e deixa UM item na fila para ele.
 *
 * ============================================================================
 * A DIFERENCA PARA `salvar`, QUE E O PONTO DESTA FUNCAO
 *
 * `salvar` enfileira INTENCOES: "mudei o nome", depois "mudei o telefone". As
 * duas precisam subir, na ordem, porque cada uma diz o que mudou.
 *
 * A chamada nao e assim. Cada gravacao e a lista inteira da classe naquele
 * domingo — o estado completo, e nao um pedaco. Uma gravacao nova torna a
 * anterior irrelevante: se o professor marca dez alunos, grava sem sinal,
 * marca mais cinco e grava de novo, subir os dois pacotes faria o servidor
 * receber a versao velha e logo em seguida a nova, por nada.
 *
 * Entao o pacote novo SUBSTITUI o antigo na fila. Na mesma transacao, como
 * sempre: com duas operacoes separadas, um app fechado no meio deixaria a
 * chamada gravada e sem nada na fila — ela apareceria certa na tela e nunca
 * chegaria a secretaria.
 * ============================================================================
 */
export async function salvarPacote<T extends Base>(
  nome: NomeTabela,
  uid: string,
  dados: Omit<T, "uid" | "estado" | "alteradoEm">,
): Promise<string> {
  const banco = db();
  const tabela = tabelaDe(nome);

  return banco.transaction("rw", [tabela, banco.fila], async () => {
    const existente = await tabela.get(uid);
    const operacao: Operacao = existente?.idRemoto ? "atualizar" : "criar";

    const registro = {
      // O instantaneo SUBSTITUI o conteudo anterior — nao ha `...existente`
      // aqui de proposito, senao um aluno desmarcado continuaria marcado pelo
      // resto que sobrou do pacote velho. So o `idRemoto` atravessa, porque
      // e do servidor e nao do instantaneo.
      ...(existente?.idRemoto !== undefined ? { idRemoto: existente.idRemoto } : {}),
      ...dados,
      uid,
      estado: "pendente" as const,
      alteradoEm: Date.now(),
    } as Base;

    await tabela.put(registro);

    // Fora o pacote velho — inclusive o que ja falhou e estava bloqueado, cuja
    // causa (senha herdada, por exemplo) pode ter sido resolvida desde entao.
    const anteriores = await banco.fila.where("uid").equals(uid).toArray();
    await banco.fila.bulkDelete(anteriores.map((i) => i.id!).filter(Boolean));

    await banco.fila.add({
      tabela: nome,
      operacao,
      uid,
      dados: registro,
      criadoEm: Date.now(),
      tentativas: 0,
    });

    return uid;
  });
}

/**
 * Remove um registro e enfileira a remocao.
 *
 * O que nunca chegou ao servidor some de vez, junto com o que estava na fila
 * para ele — nao faz sentido enviar "crie e depois apague" para algo que o
 * servidor nunca viu.
 */
export async function remover(nome: NomeTabela, uid: string): Promise<void> {
  const banco = db();
  const tabela = tabelaDe(nome);

  await banco.transaction("rw", [tabela, banco.fila], async () => {
    const registro = await tabela.get(uid);
    if (!registro) return;

    await tabela.delete(uid);

    const pendentes = await banco.fila.where("uid").equals(uid).toArray();
    await banco.fila.bulkDelete(pendentes.map((p) => p.id!).filter(Boolean));

    if (registro.idRemoto) {
      await banco.fila.add({
        tabela: nome,
        operacao: "remover",
        uid,
        dados: { idRemoto: registro.idRemoto },
        criadoEm: Date.now(),
        tentativas: 0,
      });
    }
  });
}

/**
 * Grava o que veio do servidor SEM enfileirar nada.
 *
 * E o caminho de descida — carga inicial e atualizacoes vindas de fora. Usar
 * `salvar()` aqui seria um laco infinito: o app devolveria ao servidor tudo
 * que acabou de receber dele.
 *
 * Registros com alteracao local pendente sao preservados. O servidor nao sabe
 * da chamada que o professor acabou de fazer offline, e sobrescrever isso
 * apagaria o trabalho dele.
 */
export async function receberDoServidor<T extends Base>(
  nome: NomeTabela,
  registros: Array<Omit<T, "estado" | "alteradoEm">>,
): Promise<{ gravados: number; preservados: number }> {
  const banco = db();
  const tabela = tabelaDe(nome);

  return banco.transaction("rw", [tabela], async () => {
    let gravados = 0;
    let preservados = 0;

    for (const registro of registros) {
      const local = await tabela.get(registro.uid);
      if (local && local.estado !== "sincronizado") {
        preservados++;
        continue;
      }
      await tabela.put({
        ...registro,
        estado: "sincronizado",
        alteradoEm: Date.now(),
      } as Base);
      gravados++;
    }

    return { gravados, preservados };
  });
}

/** Marca como sincronizado e guarda o id que o servidor atribuiu. */
export async function confirmarEnvio(
  nome: NomeTabela,
  uid: string,
  idRemoto?: number,
): Promise<void> {
  const tabela = tabelaDe(nome);
  const registro = await tabela.get(uid);
  if (!registro) return;
  await tabela.put({
    ...registro,
    idRemoto: idRemoto ?? registro.idRemoto,
    estado: "sincronizado",
  });
}
