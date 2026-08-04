import type { MetadataRoute } from "next";

/**
 * Manifesto do aplicativo.
 *
 * E servido em `/manifest.webmanifest` pelo proprio Next, a partir deste
 * arquivo — sem JSON solto em `public/`, entao as cores e o nome nunca saem do
 * lugar em relacao ao resto do codigo.
 *
 * `display: "standalone"` e o que faz o portal abrir SEM barra de navegador
 * depois de instalado, no Android, iPhone, iPad, Windows e Mac.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portal da Escola Bíblica Dominical — IEADPE Campo de Betânia",
    short_name: "EBD Betânia",
    description:
      "Sistema oficial da Escola Bíblica Dominical da IEADPE — Campo de Betânia, Pernambuco. Ensinando a Palavra. Formando discípulos. Transformando vidas.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["education", "productivity"],

    // Azul escuro oficial: e a cor da barra de status quando instalado, e a
    // primeira coisa que aparece antes do app pintar.
    background_color: "#0B1F45",
    theme_color: "#0B1F45",

    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      /*
       * Os "maskable" existem porque o sistema recorta o icone na forma dele —
       * circulo no Android, squircle no iOS. Sem uma versao com zona segura, o
       * letreiro "ASSEMBLEIA DE DEUS" seria a primeira coisa a ser cortada.
       * Por isso a marca entra menor nesses dois arquivos.
       */
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
