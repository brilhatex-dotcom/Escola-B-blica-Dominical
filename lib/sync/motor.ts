import { db } from "@/lib/db/local";
import { confirmarEnvio } from "@/lib/db/repositorio";
import type { ItemFila } from "@/lib/db/schema";

/**
 * Motor de sincronizacao.
 *
 * Esvazia a fila do banco local contra o servidor. Nesta fase o TRANSPORTE
 * ainda nao existe — as rotas de API entram na Fase 05 —, entao ele e injetado
 * de fora, por `configurarTransporte`. O motor cuida do que e dificil e nao
 * muda: ordem, repeticao, recuo progressivo e o que fazer quando falha.
 *
 * Sem transporte configurado, o motor fica parado em vez de dar erro: a fila
 * continua enchendo normalmente e sobe inteira quando as rotas existirem.
 */

export type Transporte = (item: ItemFila) => Promise<{ idRemoto?: number }>;

let transporte: Transporte | null = null;
let rodando = false;

export function configurarTransporte(fn: Transporte | null): void {
  transporte = fn;
}

export type EstadoMotor = "ocioso" | "sincronizando" | "offline" | "erro";

type Ouvinte = (estado: EstadoMotor, pendentes: number) => void;
const ouvintes = new Set<Ouvinte>();

export function aoMudar(fn: Ouvinte): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function anunciar(estado: EstadoMotor, pendentes: number) {
  for (const fn of ouvintes) fn(estado, pendentes);
}

/**
 * Espera crescente entre tentativas: 2s, 4s, 8s… ate 5 minutos.
 *
 * Sem isso, um servidor fora do ar viraria um martelo — dezenas de requisicoes
 * por minuto, gastando a bateria e os dados de quem esta na igreja, sem chance
 * nenhuma de sucesso.
 */
function esperaDaTentativa(tentativas: number): number {
  return Math.min(2000 * 2 ** tentativas, 5 * 60 * 1000);
}

/**
 * Envia o que estiver na fila, em ordem de criacao.
 *
 * A ordem importa e nao e detalhe: "criar aluno" precisa chegar antes de
 * "marcar presenca desse aluno". Por isso o laco e sequencial, e nao em
 * paralelo — e por isso ele PARA no primeiro erro em vez de pular para o
 * proximo item. Continuar enviaria alteracoes que dependem da que acabou de
 * falhar.
 */
export async function sincronizar(): Promise<{
  enviados: number;
  restantes: number;
  estado: EstadoMotor;
}> {
  const banco = db();

  if (rodando) {
    return { enviados: 0, restantes: await banco.fila.count(), estado: "sincronizando" };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const restantes = await banco.fila.count();
    anunciar("offline", restantes);
    return { enviados: 0, restantes, estado: "offline" };
  }

  if (!transporte) {
    const restantes = await banco.fila.count();
    anunciar("ocioso", restantes);
    return { enviados: 0, restantes, estado: "ocioso" };
  }

  rodando = true;
  let enviados = 0;
  let estado: EstadoMotor = "ocioso";

  try {
    anunciar("sincronizando", await banco.fila.count());

    const itens = await banco.fila.orderBy("criadoEm").toArray();

    for (const item of itens) {
      const agora = Date.now();
      // Item que falhou ha pouco ainda esta de castigo.
      if (item.tentativas > 0 && agora - item.criadoEm < esperaDaTentativa(item.tentativas)) {
        continue;
      }

      try {
        const { idRemoto } = await transporte(item);
        await banco.fila.delete(item.id!);
        await confirmarEnvio(item.tabela, item.uid, idRemoto);
        enviados++;
      } catch (erro) {
        await banco.fila.update(item.id!, {
          tentativas: item.tentativas + 1,
          ultimoErro: erro instanceof Error ? erro.message : String(erro),
        });
        estado = "erro";
        break; // ver o comentario do bloco acima: parar e proposital
      }
    }
  } finally {
    rodando = false;
  }

  const restantes = await banco.fila.count();
  if (estado !== "erro") estado = restantes > 0 ? "erro" : "ocioso";
  anunciar(estado, restantes);

  return { enviados, restantes, estado };
}

/**
 * Liga a sincronizacao automatica.
 *
 * A especificacao pede que o usuario nunca precise clicar em nada, entao os
 * tres gatilhos cobrem as situacoes reais de uma manha de domingo:
 *
 *   • a internet volta            -> evento `online`
 *   • o app volta ao primeiro plano -> `visibilitychange` (o professor
 *     desbloqueia o celular depois da aula)
 *   • de tempos em tempos        -> intervalo, para o caso de a conexao voltar
 *     sem o navegador emitir o evento, o que acontece bastante em rede movel
 *     instavel.
 *
 * Devolve a funcao que desliga tudo.
 */
export function iniciarSincronizacaoAutomatica(intervaloMs = 30_000): () => void {
  if (typeof window === "undefined") return () => {};

  const tentar = () => void sincronizar();

  window.addEventListener("online", tentar);
  const aoVoltar = () => {
    if (document.visibilityState === "visible") tentar();
  };
  document.addEventListener("visibilitychange", aoVoltar);
  const timer = window.setInterval(tentar, intervaloMs);

  tentar();

  return () => {
    window.removeEventListener("online", tentar);
    document.removeEventListener("visibilitychange", aoVoltar);
    window.clearInterval(timer);
  };
}
