import { db } from "@/lib/db/local";
import { confirmarEnvio } from "@/lib/db/repositorio";
import type { ItemFila } from "@/lib/db/schema";
import { ehErroPermanente } from "./erros";

/**
 * Motor de sincronizacao.
 *
 * Esvazia a fila do banco local contra o servidor. O TRANSPORTE — quem de fato
 * fala com a rede — e injetado de fora, por `configurarTransporte`
 * (lib/sync/transporte.ts monta o de verdade; um teste monta um de mentira). O
 * motor cuida do que e dificil e nao muda: ordem, repeticao, recuo progressivo
 * e o que fazer quando falha.
 *
 * Sem transporte configurado, o motor fica parado em vez de dar erro: a fila
 * continua enchendo normalmente e sobe inteira quando alguem o configurar.
 */

export type Transporte = (item: ItemFila) => Promise<{ idRemoto?: number }>;

let transporte: Transporte | null = null;
let rodando = false;

export function configurarTransporte(fn: Transporte | null): void {
  transporte = fn;
}

export type EstadoMotor =
  | "ocioso"
  | "sincronizando"
  | "offline"
  | "erro"
  /** Ha item que o servidor recusa e reenviar nao resolve. Ver lib/sync/erros. */
  | "bloqueado";

type Ouvinte = (estado: EstadoMotor, pendentes: number, motivo?: string) => void;
const ouvintes = new Set<Ouvinte>();

export function aoMudar(fn: Ouvinte): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function anunciar(estado: EstadoMotor, pendentes: number, motivo?: string) {
  for (const fn of ouvintes) fn(estado, pendentes, motivo);
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
  motivo?: string;
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
  let motivo: string | undefined;

  try {
    anunciar("sincronizando", await banco.fila.count());

    const itens = await banco.fila.orderBy("criadoEm").toArray();

    for (const item of itens) {
      /*
       * Item bloqueado nem chega a ser enviado.
       *
       * O servidor ja disse que recusa (senha herdada, por exemplo) e vai
       * recusar de novo. Sair daqui SEM tentar e o ponto: e a diferenca entre
       * uma requisicao inutil a cada 30 segundos a manha inteira e nenhuma.
       *
       * E `break`, e nao `continue`, pela mesma razao de sempre: pular o item
       * enviaria alteracoes que dependem dele.
       */
      if (item.bloqueado) {
        estado = "bloqueado";
        motivo = item.ultimoErro;
        break;
      }

      const agora = Date.now();
      /*
       * Item que falhou ha pouco ainda esta de castigo — e o castigo conta da
       * ULTIMA TENTATIVA, nao da criacao. Medindo da criacao, uma chamada presa
       * ha uma hora ja passou de qualquer espera calculavel e voltaria a ser
       * tentada em toda passada do motor, que e exatamente o martelo que o
       * recuo progressivo existe para evitar.
       */
      const desde = item.ultimaTentativa ?? item.criadoEm;
      if (item.tentativas > 0 && agora - desde < esperaDaTentativa(item.tentativas)) {
        continue;
      }

      try {
        const { idRemoto } = await transporte(item);
        await banco.fila.delete(item.id!);
        await confirmarEnvio(item.tabela, item.uid, idRemoto);
        enviados++;
      } catch (erro) {
        const permanente = ehErroPermanente(erro);
        const mensagem = erro instanceof Error ? erro.message : String(erro);

        await banco.fila.update(item.id!, {
          tentativas: item.tentativas + 1,
          ultimaTentativa: Date.now(),
          ultimoErro: mensagem,
          bloqueado: permanente,
        });

        if (permanente) {
          estado = "bloqueado";
          motivo = mensagem;
        } else {
          estado = "erro";
        }
        break; // ver o comentario do bloco acima: parar e proposital
      }
    }
  } finally {
    rodando = false;
  }

  const restantes = await banco.fila.count();
  if (estado === "ocioso" && restantes > 0) estado = "erro";
  anunciar(estado, restantes, motivo);

  return { enviados, restantes, estado, motivo };
}

/**
 * Destrava a fila e manda tentar de novo.
 *
 * Chamada quando a causa do bloqueio deixa de existir — hoje, quando alguem
 * troca a senha herdada. Sem isto, a chamada ficaria parada para sempre mesmo
 * depois de resolvido o que a impedia de subir, e a unica saida seria fechar e
 * reabrir o aplicativo sem saber por que.
 *
 * As tentativas voltam a zero junto: manter o recuo de um bloqueio antigo
 * faria a primeira tentativa da fila liberada esperar cinco minutos a toa.
 */
export async function liberarBloqueios(): Promise<number> {
  const banco = db();
  const presos = await banco.fila.filter((i) => i.bloqueado === true).toArray();
  for (const item of presos) {
    await banco.fila.update(item.id!, {
      bloqueado: false,
      tentativas: 0,
      ultimaTentativa: undefined,
    });
  }
  return presos.length;
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
