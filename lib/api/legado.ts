import { prisma } from "@/lib/prisma";

/**
 * Escrita nas tabelas herdadas — as peças que todas repetem.
 *
 * ============================================================================
 * TODA TABELA DO SISTEMA ANTIGO TEM O MESMO PROBLEMA DE `id`
 *
 * `Eventos`, `Avisos`, `Reunioes`, `Licoes`, `Escala_Cultos` — nenhuma tem id
 * autoincrement. A chave é a da planilha original, preservada para não quebrar
 * os relacionamentos herdados. Então cada cadastro novo precisa calcular o
 * próximo número, e o cálculo tem de acontecer DENTRO da transação da
 * inserção: fora dela, duas pessoas cadastrando ao mesmo tempo leem o mesmo
 * "maior id" e a segunda perde o registro com erro de chave duplicada.
 *
 * Escrever isso cinco vezes garantiria que uma das cinco esquecesse a
 * transação — e o defeito só aparece quando duas pessoas usam o sistema ao
 * mesmo tempo, que é justamente quando ninguém está olhando o log.
 * ============================================================================
 */

type Agregador = { aggregate: (args: { _max: { id: true } }) => Promise<{ _max: { id: number | null } }> };

/**
 * Cria um registro numa tabela de id herdado, calculando o próximo número
 * dentro da transação.
 *
 * `montar` recebe o id já reservado e devolve a promessa da criação.
 */
export async function criarComIdHerdado<T>(
  tabela: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Agregador,
  montar: (
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    id: number,
  ) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const { _max } = await tabela(tx).aggregate({ _max: { id: true } });
    return montar(tx, (_max.id ?? 0) + 1);
  });
}

/**
 * O nome de quem está gravando, para os campos `autor` do sistema antigo.
 *
 * Sem sessão (portal sem `AUTH_SECRET`) o autor fica "Portal" em vez de vazio:
 * um campo em branco na lista parece defeito, e "Portal" diz a verdade — foi
 * gravado pelo sistema, sem autenticação configurada.
 */
export function autorDa(sessao: { nome?: string } | null): string {
  return sessao?.nome?.trim() || "Portal";
}

/**
 * Uma lista de nomes digitada — um por linha.
 *
 * Descarta linhas vazias e REPETIDOS. O repetido importa: colar uma lista do
 * WhatsApp costuma trazer o mesmo nome duas vezes, e a ata sairia com
 * "18 participantes" numa reunião de 16.
 *
 * A comparação ignora a caixa, porque "Maria" e "maria" na mesma lista são a
 * mesma pessoa digitada duas vezes — mas o nome guardado é o PRIMEIRO como foi
 * escrito, sem forçar caixa nenhuma sobre o que a secretaria digitou.
 */
export function nomesDaLista(valor: unknown): string[] {
  if (typeof valor !== "string") return [];
  const vistos = new Set<string>();
  const nomes: string[] = [];
  for (const linha of valor.split(/\r?\n/)) {
    const nome = linha.trim();
    if (!nome) continue;
    const chave = nome.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    nomes.push(nome);
  }
  return nomes;
}
