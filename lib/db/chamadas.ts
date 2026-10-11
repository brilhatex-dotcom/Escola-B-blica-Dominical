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

/*
 * O caminho sem internet numa DATA NOVA: o servidor não responde e não há
 * chamada guardada desta classe neste dia. O espelho dos cadastros (baixado
 * por lib/db/hidratar.ts sempre que há conexão, já recortado pelo acesso de
 * quem entrou) tem as listas e os alunos — o bastante para montar a chamada
 * em branco e o professor marcar. Sem isto, abrir o domingo de hoje sem
 * sinal dava "não foi possível carregar", mesmo com tudo no aparelho.
 */

const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");

export async function congregacoesDoEspelho(): Promise<Array<{ id: number; nome: string }>> {
  const lista = await db().congregacoes.toArray();
  return lista
    .filter((c) => c.idRemoto != null)
    .map((c) => ({ id: c.idRemoto!, nome: c.nome || `Congregação ${c.idRemoto}` }))
    .sort(porNome);
}

export async function classesDoEspelho(congId: number | null): Promise<Array<{ id: number; nome: string }>> {
  const lista = congId === null
    ? await db().classes.toArray()
    : await db().classes.where("congId").equals(congId).toArray();
  return lista
    .filter((c) => c.ativa && c.idRemoto != null)
    .map((c) => ({ id: c.idRemoto!, nome: c.nome }))
    .sort(porNome);
}

export async function turmaDoEspelho(classeId: number): Promise<{
  nome: string;
  faixa: string;
  prof: string | null;
  congregacao: { id: number; nome: string } | null;
  alunos: Array<{ id: number; nome: string; nasc: string | null }>;
} | null> {
  const banco = db();
  const classe = await banco.classes.where("idRemoto").equals(classeId).first();
  if (!classe) return null;

  const [alunos, cong] = await Promise.all([
    banco.alunos.where("classeId").equals(classeId).toArray(),
    classe.congId != null ? banco.congregacoes.where("idRemoto").equals(classe.congId).first() : undefined,
  ]);

  return {
    nome: classe.nome,
    faixa: classe.faixa,
    prof: classe.prof ?? null,
    congregacao: cong ? { id: cong.idRemoto!, nome: cong.nome } : null,
    alunos: alunos
      .filter((a) => a.ativo && a.idRemoto != null)
      .map((a) => ({ id: a.idRemoto!, nome: a.nome, nasc: a.nasc ?? null }))
      .sort(porNome),
  };
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
