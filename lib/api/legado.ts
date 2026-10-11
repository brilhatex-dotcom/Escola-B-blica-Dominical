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
 * A lista de presença de uma reunião — um array `[{nome, presente, congId?,
 * congNome?, papel?}]`, montado na tela (ver `ModalReuniao`), não mais
 * digitado em duas caixas de texto.
 *
 * Cada convocado chega com um `presente` EXPLÍCITO (`true`/`false`) — ninguém
 * é dado como falta por estar ausente da lista, porque ninguém fica fora da
 * lista: quem não é riscado já entra com `presente: false`, e quem a pessoa
 * vir marca como presente. A mesma garantia de "nada é inferido do que falta"
 * que a Chamada tem, só que aqui o padrão combinado com a liderança é começar
 * com todos em falta, em vez de tudo em branco.
 *
 * Descarta linhas sem nome e REPETIDOS (mesmo nome duas vezes na lista faria
 * a ata contar gente a mais) — a comparação ignora a caixa, mas o nome
 * guardado é o da PRIMEIRA ocorrência, como a tela mandou.
 */
export interface ParticipanteEntrada {
  nome: string;
  presente: boolean;
  congId: number | null;
  congNome: string | null;
  papel: string | null;
}

export function participantesDaLista(valor: unknown): ParticipanteEntrada[] {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set<string>();
  const lista: ParticipanteEntrada[] = [];
  for (const item of valor) {
    if (!item || typeof item !== "object") continue;
    const bruto = item as Record<string, unknown>;
    const nome = typeof bruto.nome === "string" ? bruto.nome.trim().slice(0, 160) : "";
    if (!nome) continue;
    const chave = nome.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push({
      nome,
      presente: bruto.presente === true,
      congId: Number.isInteger(bruto.congId) ? (bruto.congId as number) : null,
      congNome: typeof bruto.congNome === "string" ? bruto.congNome.trim() || null : null,
      papel: typeof bruto.papel === "string" ? bruto.papel.trim() || null : null,
    });
  }
  return lista;
}
