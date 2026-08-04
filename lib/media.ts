/**
 * Video oficial da igreja, gravado por drone.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ ESTE VIDEO NAO PODE SER SUBSTITUIDO. E a filmagem oficial da igreja.  │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * COMO O TRECHO FOI ESCOLHIDO
 *
 * O arquivo original tem 35,4s a 1024x576 e contem DOIS planos, com um corte
 * seco entre 19,8s e 20,0s:
 *
 *   plano 1 — 0s a 19,9s   : comeca colado na fachada e afasta ate ver a cidade
 *   plano 2 — 19,9s a 35,4s: volta para perto e desce em direcao a fachada
 *
 * A abertura precisa de 12s continuos terminando numa aproximacao, entao so o
 * plano 2 serve — atravessar o corte deixaria um salto no meio da splash.
 *
 * O melhor enquadramento da fachada esta em 32,0s: portas azuis iluminadas,
 * torre com o medalhao e as pessoas na entrada, com a igreja ocupando a metade
 * superior do quadro. E ali que o clipe termina, e por isso "pausar no fim" e
 * "congelar no quadro certo" sao a mesma coisa.
 *
 * DURACAO DO CLIPE: 11,1s, nao 12s
 *
 * O video roda de 3s a 15s da abertura — 12s de relogio. Mas os ultimos 1,8s
 * sao de desaceleracao, quando o video consome menos conteudo que tempo real.
 * Com a rampa `power2.out` de 1,0 ate 0,1, esses 1,8s consomem ~0,6s de video.
 * Logo: 10,2s a velocidade normal + 0,6s na rampa = 10,8s, e 11,1s de clipe da
 * a folga necessaria para o congelamento cair exatamente no fim.
 *
 * Recorte gerado com:
 *   ffmpeg -ss 21.0 -i <original> -t 11.1 -an ...
 */

export const DRONE_SOURCES = [
  "/media/igreja-drone.webm",
  "/media/igreja-drone.mp4",
] as const;

/** Ultimo quadro do clipe — o mesmo em que o video congela. */
export const DRONE_POSTER = "/media/igreja-fachada.jpg";

/** Segundo da abertura em que o video entra. */
export const DRONE_START_AT = 3;

/** Segundo em que comeca a desaceleracao. */
export const DRONE_DECEL_AT = 13.2;

/** Duracao da rampa de desaceleracao, em segundos. */
export const DRONE_DECEL_SECONDS = 1.8;

/** Velocidade no fim da rampa. Nao e zero: zero pararia de forma perceptivel. */
export const DRONE_FINAL_RATE = 0.1;
