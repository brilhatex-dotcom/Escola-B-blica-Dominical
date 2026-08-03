/**
 * Emblema institucional usado na splash e no login.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ ATENCAO — ESTE E UM EMBLEMA PROVISORIO.                               │
 * │ Nao tive acesso ao arquivo oficial da logomarca da IEADPE, entao      │
 * │ desenhei um brasao autoral no espirito da identidade (anel, raios,    │
 * │ cruz sobre a Biblia aberta, pomba). Substitua o `MARK_PATHS` abaixo   │
 * │ pelos paths da arte oficial — o resto do sistema continua funcionando │
 * │ sem nenhuma outra alteracao.                                          │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * O mesmo desenho serve a dois consumidores:
 *   1. `<BrandMark />`, que renderiza o SVG em React;
 *   2. o campo de particulas da splash, que rasteriza este SVG num canvas
 *      fora de tela e amostra os pixels opacos para descobrir para onde cada
 *      particula deve voar.
 *
 * Por isso o desenho e mantido como dado (lista de paths), e nao como JSX:
 * uma fonte unica para as duas finalidades.
 */

export const MARK_VIEWBOX = 220;

export interface MarkPath {
  d: string;
  /** Amostrado pelas particulas? Detalhes finos poluem a formacao. */
  sample?: boolean;
  opacity?: number;
}

export const MARK_PATHS: readonly MarkPath[] = [
  // Anel externo (evenodd: circulo cheio menos o miolo)
  {
    d:
      "M110 4 A106 106 0 1 1 109.9 4 Z " +
      "M110 17 A93 93 0 1 0 110.1 17 Z",
    sample: true,
  },
  // Anel interno fino
  {
    d:
      "M110 26 A84 84 0 1 1 109.9 26 Z " +
      "M110 30 A80 80 0 1 0 110.1 30 Z",
    sample: false,
    opacity: 0.55,
  },

  // Raios de luz saindo de tras da cruz
  { d: "M110 44 L116 74 L104 74 Z", sample: true },
  { d: "M64 60 L92 78 L84 88 Z", sample: true },
  { d: "M156 60 L128 78 L136 88 Z", sample: true },
  { d: "M50 104 L84 100 L84 112 Z", sample: true, opacity: 0.8 },
  { d: "M170 104 L136 100 L136 112 Z", sample: true, opacity: 0.8 },

  // Cruz central
  { d: "M103 52 H117 V150 H103 Z", sample: true },
  { d: "M74 84 H146 V98 H74 Z", sample: true },

  // Biblia aberta na base — pagina esquerda / direita / lombada
  { d: "M42 150 C64 141 86 141 106 150 L106 176 C86 167 64 167 42 176 Z", sample: true },
  { d: "M178 150 C156 141 134 141 114 150 L114 176 C134 167 156 167 178 176 Z", sample: true },
  { d: "M106 149 H114 V177 H106 Z", sample: true },

  // Linhas de texto sugeridas nas paginas (nao amostradas — ruido demais)
  { d: "M56 156 C70 152 84 152 98 156 L98 160 C84 156 70 156 56 160 Z", sample: false, opacity: 0.5 },
  { d: "M122 156 C136 152 150 152 164 156 L164 160 C150 156 136 156 122 160 Z", sample: false, opacity: 0.5 },

  // Pomba estilizada sobre a cruz
  {
    d:
      "M110 30 C118 32 124 38 124 45 C124 50 120 54 114 55 " +
      "L120 62 L110 58 L100 62 L106 55 C100 54 96 50 96 45 C96 38 102 32 110 30 Z",
    sample: true,
  },
];

/** SVG completo, monocromatico, usado para rasterizar os alvos das particulas. */
export function buildMarkSvgString(fill = "#ffffff"): string {
  const body = MARK_PATHS.filter((p) => p.sample !== false)
    .map((p) => `<path d="${p.d}" fill="${fill}" fill-rule="evenodd"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}" width="${MARK_VIEWBOX}" height="${MARK_VIEWBOX}">${body}</svg>`;
}

/** Data URI pronto para `new Image()`. */
export function markSvgDataUri(fill = "#ffffff"): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildMarkSvgString(fill))}`;
}
