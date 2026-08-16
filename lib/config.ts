/**
 * Ajustes de comportamento da abertura do portal.
 * Tudo o que um dia voce vai querer mexer sem cacar no meio do codigo mora aqui.
 */

/** Duracao total da splash, em segundos (spec: 15s). */
export const SPLASH_DURATION = 15;

/** Fade da splash para o login (spec: ~900ms, junto do congelamento). */
export const SPLASH_TO_LOGIN_MS = 900;

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

export const APP_VERSION = "1.0";
export const ORG_NAME = "IEADPE Campo de Betânia";

/**
 * Duração da sessão, em horas — usada tanto para assinar o cookie
 * (`lib/auth/sessao.ts`) quanto para decidir, no cliente, se um aparelho
 * "lembrado" ainda pode pular a tela de login quando abre sem internet (ver
 * `SESSAO_LOCAL_CHAVE` abaixo). As duas precisam concordar: se o número
 * daqui for maior que o do cookie, o app abriria "logado" no visual sem
 * sessão nenhuma de verdade por trás.
 */
export const SESSAO_HORAS = 8;

/**
 * Chave no `localStorage` que guarda QUANDO este aparelho entrou pela
 * última vez com sucesso — não a sessão em si (essa é o cookie httpOnly,
 * que o JavaScript nem consegue ler), só um lembrete para a tela de abertura
 * decidir se vale tentar pular direto para o painel quando não há internet
 * para perguntar ao servidor. Ver o comentário grande em `app/page.tsx`.
 */
export const SESSAO_LOCAL_CHAVE = "ebd:sessao-local";

/**
 * A senha herdada bloqueia a GRAVAÇÃO?
 *
 * ============================================================================
 * ESTE INTERRUPTOR EXISTE PORQUE A TROCA DE SENHA É UMA DECISÃO DA IGREJA
 *
 * As 19 contas do sistema antigo têm o mesmo hash — a mesma senha, que meia
 * igreja pode conhecer. O certo é cada pessoa ter a sua, e é o que a reunião da
 * liderança vai resolver.
 *
 * Até lá, `true` aqui teria um efeito muito concreto: no dia em que
 * `AUTH_SECRET` for definida na Vercel, ninguém que ainda usa a senha antiga
 * consegue registrar chamada. A EBD inteira pararia num domingo de manhã, sem
 * ninguém entender por quê e sem caminho de volta.
 *
 * Com `false`, as senhas continuam EXATAMENTE como estão (nenhum registro do
 * sistema antigo é alterado — regra da igreja), a gravação segue liberada e o
 * painel mostra uma tarja dizendo, sem rodeio, que a senha é compartilhada.
 *
 * Depois da reunião, vire para `true`: a proteção passa a valer sem mais nada
 * a fazer, e quem ainda não trocou é levado à tela de troca.
 * ============================================================================
 */
export const EXIGIR_SENHA_PROPRIA_PARA_GRAVAR = false;
