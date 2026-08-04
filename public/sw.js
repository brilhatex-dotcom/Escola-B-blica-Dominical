/* eslint-disable no-restricted-globals */
/**
 * Service Worker do Portal da Escola Biblica Dominical.
 *
 * Escrito a mao, sem biblioteca, por um motivo concreto: o video da abertura
 * exige um tratamento que as receitas prontas nao fazem (ver "MIDIA" abaixo).
 * Com uma biblioteca generica, o video simplesmente nunca ficaria em cache e a
 * igreja baixaria 1 MB a cada visita.
 *
 * ESTRATEGIAS
 *
 *   navegacao ....... rede primeiro, cache como rede de seguranca.
 *                     Garante que o app ABRE sem internet.
 *   /_next/static ... cache primeiro. Os nomes tem hash, entao um arquivo
 *                     nunca muda de conteudo: se esta em cache, esta correto.
 *   imagens ......... cache primeiro.
 *   /media (video) .. cache primeiro, com tratamento de Range (ver abaixo).
 *   resto ........... rede primeiro.
 *
 * TROCA DE VERSAO
 *
 * Mude `VERSAO` ao alterar qualquer regra daqui. O navegador compara os bytes
 * deste arquivo; mudando a constante, ele instala a versao nova e descarta os
 * caches antigos no `activate`.
 */

const VERSAO = "v1";
const CACHE_SHELL = `ebd-shell-${VERSAO}`;
const CACHE_ESTATICO = `ebd-estatico-${VERSAO}`;
const CACHE_IMAGENS = `ebd-imagens-${VERSAO}`;
const CACHE_MIDIA = `ebd-midia-${VERSAO}`;
const NOSSOS_CACHES = [CACHE_SHELL, CACHE_ESTATICO, CACHE_IMAGENS, CACHE_MIDIA];

/**
 * Precache minimo: so o que e necessario para a tela abrir offline.
 *
 * O video NAO entra aqui de proposito. Sao dois arquivos (webm e mp4) somando
 * ~2 MB, e o navegador so vai usar UM deles. Baixar os dois na instalacao
 * gastaria o dobro do necessario, em dados moveis, antes mesmo de o usuario
 * decidir se vai usar o sistema. Ele e guardado no primeiro uso.
 */
const PRECACHE = [
  "/",
  "/brand/ieadpe-logo.png",
  "/brand/ieadpe-mask.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/media/igreja-fachada.jpg",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_SHELL).then((cache) =>
      // `reload` evita guardar uma resposta que ja veio do cache HTTP do
      // navegador, que poderia estar velha.
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))),
    ),
  );
});

/**
 * Guarda o JavaScript e o CSS da aplicacao.
 *
 * POR QUE ISSO E NECESSARIO
 *
 * Um Service Worker so intercepta requisicoes DEPOIS de assumir o controle da
 * pagina. Na primeira visita ele ainda esta instalando enquanto o navegador ja
 * baixou todo o JS — ou seja, nada disso passa por ele. O sintoma e cruel: o
 * usuario instala o app, fica sem sinal, abre, e ve uma tela em branco. O HTML
 * estava em cache, o JavaScript que o preenche nao.
 *
 * O caminho normal seria gerar a lista de arquivos na hora do build, que e o
 * que as bibliotecas de PWA fazem. Aqui basta ler o proprio HTML e extrair os
 * `/_next/static/...` que ele referencia: os nomes tem hash, entao a lista e
 * exata e nunca fica velha.
 */
async function aquecerAppShell() {
  try {
    const resposta = await fetch("/", { cache: "reload" });
    if (!resposta.ok) return;

    const html = await resposta.clone().text();
    await (await caches.open(CACHE_SHELL)).put("/", resposta);

    const referencias = [...html.matchAll(/["'](\/_next\/static\/[^"']+)["']/g)]
      .map((m) => m[1])
      .filter((u) => !u.endsWith(".map"));

    const cache = await caches.open(CACHE_ESTATICO);
    // `allSettled`: um arquivo que falhe nao pode derrubar o aquecimento todo.
    await Promise.allSettled([...new Set(referencias)].map((u) => cache.add(u)));
  } catch {
    /* sem rede agora: o cache se completa na proxima visita */
  }
}

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((n) => n.startsWith("ebd-") && !NOSSOS_CACHES.includes(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
      await aquecerAppShell();
    })(),
  );
});

self.addEventListener("message", (evento) => {
  // A pagina pede a troca imediata quando o usuario aceita atualizar.
  if (evento.data?.tipo === "APLICAR_ATUALIZACAO") {
    self.skipWaiting();
    return;
  }

  /*
   * A pagina avisa QUAL arquivo de video o navegador escolheu.
   *
   * Sem isso o video nunca chega ao cache offline, e o motivo e sutil: na
   * primeira visita o Service Worker ainda nao controla a pagina, entao o
   * pedido do video passa direto; da segunda em diante o navegador serve do
   * cache HTTP dele proprio e NAO chega a pedir nada — o Service Worker nunca
   * ve o arquivo. Medido: na visita 2 nao ha requisicao alguma de
   * /media/igreja-drone.webm.
   *
   * Guardar os dois formatos no install resolveria, ao custo de ~1,9 MB, sendo
   * que o navegador usa so um. A pagina, porem, sabe exatamente qual escolheu
   * — `video.currentSrc` — e e ela quem manda essa mensagem.
   */
  if (evento.data?.tipo === "GUARDAR_MIDIA" && evento.data.url) {
    evento.waitUntil(guardarMidia(evento.data.url));
  }
});

async function guardarMidia(url) {
  try {
    const caminho = new URL(url, self.location.origin).pathname;
    const cache = await caches.open(CACHE_MIDIA);
    if (await cache.match(caminho)) return; // ja guardado

    // Sem cabecalho Range: precisamos do arquivo inteiro para poder guardar.
    const resposta = await fetch(caminho, { cache: "no-store" });
    if (resposta.ok && resposta.status === 200) {
      await cache.put(caminho, resposta);
    }
  } catch {
    /* sem rede: tenta de novo na proxima abertura */
  }
}

/* ------------------------------------------------------------------ *
 * MIDIA — o motivo de este arquivo ser escrito a mao
 *
 * Ao tocar um video, o navegador quase sempre pede PEDACOS do arquivo, com o
 * cabecalho `Range`, e recebe status 206 (Partial Content). E a Cache API
 * RECUSA guardar respostas 206 — `cache.put` lanca erro. Resultado das
 * receitas ingenuas: o video nunca entra em cache e e rebaixado da internet a
 * cada abertura, mesmo com Service Worker instalado.
 *
 * A saida e ignorar o Range na ida e tratar na volta: busca-se o arquivo
 * INTEIRO (200), guarda-se ele, e o pedaco pedido e recortado do que esta em
 * cache, devolvido como um 206 montado aqui.
 * ------------------------------------------------------------------ */
async function responderMidia(request) {
  const cache = await caches.open(CACHE_MIDIA);
  const url = new URL(request.url);
  const chave = url.pathname;

  let completo = await cache.match(chave);

  if (!completo) {
    // Sem o header Range: queremos o arquivo inteiro, para poder guardar.
    const resposta = await fetch(chave);
    if (resposta.ok && resposta.status === 200) {
      await cache.put(chave, resposta.clone());
      completo = resposta;
    } else {
      // Nao deu para guardar; devolve o que veio, sem quebrar a reproducao.
      return resposta;
    }
  }

  const range = request.headers.get("range");
  if (!range) return completo;

  const bytes = new Uint8Array(await completo.clone().arrayBuffer());
  const partes = /bytes=(\d*)-(\d*)/.exec(range);
  if (!partes) return completo;

  const inicio = partes[1] ? Number(partes[1]) : 0;
  const fim = partes[2] ? Math.min(Number(partes[2]), bytes.length - 1) : bytes.length - 1;

  if (inicio > fim || inicio >= bytes.length) {
    return new Response(null, {
      status: 416, // Range Not Satisfiable
      headers: { "Content-Range": `bytes */${bytes.length}` },
    });
  }

  return new Response(bytes.slice(inicio, fim + 1), {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": completo.headers.get("Content-Type") ?? "video/mp4",
      "Content-Length": String(fim - inicio + 1),
      "Content-Range": `bytes ${inicio}-${fim}/${bytes.length}`,
      "Accept-Ranges": "bytes",
    },
  });
}

/* ------------------------------------------------------------------ *
 * Estrategias auxiliares
 * ------------------------------------------------------------------ */

async function cachePrimeiro(request, nomeCache) {
  const cache = await caches.open(nomeCache);
  const guardado = await cache.match(request);
  if (guardado) return guardado;

  const resposta = await fetch(request);
  if (resposta.ok) await cache.put(request, resposta.clone());
  return resposta;
}

async function redePrimeiro(request, nomeCache) {
  const cache = await caches.open(nomeCache);
  try {
    const resposta = await fetch(request);
    if (resposta.ok) await cache.put(request, resposta.clone());
    return resposta;
  } catch (erro) {
    const guardado = await cache.match(request);
    if (guardado) return guardado;
    throw erro;
  }
}

/** Sem internet e sem nada em cache: pelo menos nao mostra o erro do navegador. */
async function responderNavegacao(request) {
  try {
    return await redePrimeiro(request, CACHE_SHELL);
  } catch {
    const cache = await caches.open(CACHE_SHELL);
    return (
      (await cache.match("/")) ??
      new Response(
        "<!doctype html><meta charset=utf-8><title>Sem conexão</title>" +
          "<body style=\"background:#0B1F45;color:#F5F7FA;font-family:system-ui;" +
          'display:grid;place-items:center;height:100vh;margin:0;text-align:center">' +
          "<div><h1>Sem conexão</h1><p>Reabra quando a internet voltar.</p></div>",
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
      )
    );
  }
}

self.addEventListener("fetch", (evento) => {
  const { request } = evento;

  // POST/PUT/DELETE nunca sao cacheados: sao escrita, e escrita offline e
  // problema da fila de sincronizacao (lib/db), nao do Service Worker.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Outro dominio (fontes, APIs externas): deixa passar direto.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    evento.respondWith(responderNavegacao(request));
    return;
  }

  if (url.pathname.startsWith("/media/") && !url.pathname.endsWith(".jpg")) {
    evento.respondWith(responderMidia(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(cachePrimeiro(request, CACHE_ESTATICO));
    return;
  }

  if (
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(png|jpg|jpeg|svg|webp|avif|ico)$/.test(url.pathname)
  ) {
    evento.respondWith(cachePrimeiro(request, CACHE_IMAGENS));
    return;
  }

  evento.respondWith(redePrimeiro(request, CACHE_SHELL));
});
