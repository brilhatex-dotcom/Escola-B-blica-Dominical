/**
 * Logomarca oficial da IEADPE.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ A ARTE NAO PODE SER ALTERADA.                                         │
 * │ Nada de recolorir, redesenhar, recortar, espelhar, girar ou esticar.  │
 * │ Ela e usada como bitmap, exatamente como veio do arquivo oficial.     │
 * │ O unico ajuste permitido e escala proporcional.                       │
 * │                                                                       │
 * │ Efeitos SAO aplicados ao redor dela (sombra projetada, halo, brilho   │
 * │ horizontal, particulas, parallax 3D) — nunca sobre os pixels da       │
 * │ marca de um jeito que mude cor ou forma.                              │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Origem: `IEADPE.png` (2000x1597, fundo transparente), reduzida
 * proporcionalmente para 1000px de largura para uso web.
 */

export const LOGO_SRC = "/brand/ieadpe-logo.png";

/** Dimensoes intrinsecas do arquivo web. Proporcao ~1.2531. */
export const LOGO_WIDTH = 1000;
export const LOGO_HEIGHT = 798;
export const LOGO_RATIO = LOGO_WIDTH / LOGO_HEIGHT;

/**
 * Mascara de alfa em baixa resolucao (260px, so canal alpha, ~18 KB).
 *
 * Serve a duas coisas que precisam conhecer o *contorno* da marca sem baixar
 * o master de 442 KB:
 *   1. o campo de particulas, que amostra os pixels opacos para descobrir
 *      para onde cada particula deve voar;
 *   2. o brilho horizontal, usado como `mask-image` para a luz varrer o
 *      desenho da marca e nao o retangulo em volta dela.
 */
export const LOGO_MASK_SRC = "/brand/ieadpe-mask.png";

/** Texto alternativo institucional. */
export const LOGO_ALT =
  "Igreja Evangélica Assembleia de Deus em Pernambuco — Campo de Betânia";
