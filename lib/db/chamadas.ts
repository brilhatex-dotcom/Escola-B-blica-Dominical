import { db } from "./local";
import { salvarPacote } from "./repositorio";
import type { ChamadaLocal, ItemFila, Marca } from "./schema";

/**
 * A chamada no aparelho.
 *
 * Fica entre a tela da Chamada e a camada offline generica: a tela nao precisa
 * saber o que e uid, fila ou transacao, e a camada offline nao precisa saber o
 * que e domingo, classe ou presenca.
 */

/**
 * O `uid` de uma chamada e CALCULADO, nao sorteado.
 *
 * Em todo o resto do banco local o uid e aleatorio, porque dois cadastros com o
 * mesmo nome sao duas pessoas diferentes. Aqui e o contrario: a chamada da
 * classe 12 no dia 09/08 e uma so. Com uid aleatorio, gravar duas vezes criaria
 * duas chamadas do mesmo domingo, e as duas subiriam — a segunda desfazendo a
 * primeira, ou o contrario, conforme a ordem em que a rede as entregasse.
 */
export function uidDaChamada(classeId: number, data: string): string {
  return `chamada:${classeId}:${data}`;
}

export interface ChamadaParaGuardar {
  classeId: number;
  data: string;
  marcas: Marca[];
  cache?: ChamadaLocal["cache"];
}

/** Grava a chamada inteira no aparelho e deixa UM pacote na fila. */
export async function guardarChamada(chamada: ChamadaParaGuardar): Promise<string> {
  const uid = uidDaChamada(chamada.classeId, chamada.data);
  await salvarPacote<ChamadaLocal>("chamadas", uid, {
    classeId: chamada.classeId,
    data: chamada.data,
    marcas: chamada.marcas,
    cache: chamada.cache,
  });
  return uid;
}

/** A chamada guardada no aparelho, se houver. */
export async function lerChamadaLocal(
  classeId: number,
  data: string,
): Promise<ChamadaLocal | undefined> {
  return db().chamadas.get(uidDaChamada(classeId, data));
}

export type SituacaoEnvio =
  | { situacao: "enviada" }
  | { situacao: "aguardando" }
  | { situacao: "bloqueada"; motivo: string }
  | { situacao: "nenhuma" };

/**
 * O que aconteceu com a chamada depois da tentativa de envio.
 *
 * A tela precisa saber a diferenca entre "subiu", "ficou guardada e sobe
 * sozinha" e "o servidor recusou e nao adianta esperar" — sao tres frases
 * diferentes para o professor, e a terceira exige acao dele.
 */
export async function situacaoDoEnvio(
  classeId: number,
  data: string,
): Promise<SituacaoEnvio> {
  const banco = db();
  const uid = uidDaChamada(classeId, data);

  const registro = await banco.chamadas.get(uid);
  if (!registro) return { situacao: "nenhuma" };

  const naFila: ItemFila[] = await banco.fila.where("uid").equals(uid).toArray();
  if (naFila.length === 0) return { situacao: "enviada" };

  const bloqueado = naFila.find((i) => i.bloqueado);
  if (bloqueado) {
    return { situacao: "bloqueada", motivo: bloqueado.ultimoErro ?? "O servidor recusou o envio." };
  }

  return { situacao: "aguardando" };
}
