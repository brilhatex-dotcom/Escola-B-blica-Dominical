/**
 * Ajustes de comportamento da abertura do portal.
 * Tudo o que um dia voce vai querer mexer sem cacar no meio do codigo mora aqui.
 */

/** Duracao total da splash, em segundos (spec: 15s). */
export const SPLASH_DURATION = 15;

/** Fade da splash para o login (spec: ~800ms). */
export const SPLASH_TO_LOGIN_MS = 800;

/**
 * `true`  -> a splash roda em toda visita.
 * `false` -> roda uma vez por aba/sessao; ao recarregar vai direto ao login.
 *
 * A spec pede a abertura cinematografica completa, entao o padrao e `true`.
 * Vire para `false` se achar os 15s cansativos para quem usa o portal todo dia.
 */
export const REPLAY_SPLASH_EVERY_VISIT = true;

/** Chave de sessao usada quando REPLAY_SPLASH_EVERY_VISIT = false. */
export const SPLASH_SESSION_KEY = "ebd:splash-seen";

/**
 * Botao discreto de "pular abertura".
 * Nao estava na spec — e uma cortesia de UX para quem ja viu a animacao.
 * Basta virar para `false` para cumprir a spec ao pe da letra.
 */
export const ALLOW_SKIP_SPLASH = true;

/**
 * Vire para `true` DEPOIS de colocar os arquivos em `public/media/`
 * (ver public/media/README.md).
 *
 * Enquanto for `false`, o `<video>` sequer e montado — sem isso o navegador
 * pediria arquivos inexistentes e encheria o console de 404 em toda visita.
 * O fundo "catedral" em CSS cobre a tela do mesmo jeito, entao nada quebra.
 */
export const HAS_AMBIENT_VIDEO = false;

export const APP_VERSION = "1.0.0";
export const ORG_NAME = "IEADPE Campo de Betânia";
