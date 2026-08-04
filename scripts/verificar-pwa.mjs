/**
 * Verificacao do PWA num navegador de verdade.
 *
 *   npm run build && npm start          (num terminal)
 *   npm run verificar:pwa               (noutro)
 *
 * O `playwright` NAO entra nas dependencias do projeto de proposito: sao mais
 * de 100 MB que a Vercel baixaria em todo build sem nenhuma utilidade em
 * producao. Instale so quando for rodar esta verificacao:
 *
 *   npm i --no-save playwright && npx playwright install chromium
 *
 * BASE  - endereco do servidor (padrao http://localhost:3000)
 * CHROME - caminho de um Chromium ja instalado, se houver
 */
const BASE = process.env.BASE ?? "http://localhost:3000";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "\nFalta o playwright. Instale so para esta verificacao:\n" +
      "  npm i --no-save playwright && npx playwright install chromium\n",
  );
  process.exit(1);
}

const b = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await b.newContext();
const p = await ctx.newPage();
let falhas = 0;
const ok = (c, m) => { console.log(`  ${c?"OK  ":"FALHA"}  ${m}`); if(!c) falhas++; };

// 1. manifest
const man = await p.request.get(`${BASE}/manifest.webmanifest`);
const j = await man.json();
console.log("\n1. manifest");
ok(man.ok(), "manifest.webmanifest e servido");
ok(j.display === "standalone", 'display = "standalone" (abre sem barra do navegador)');
ok(j.icons.some(i => i.purpose === "maskable"), "tem icone maskable");
ok(j.icons.some(i => i.sizes === "512x512"), "tem icone 512x512");
ok(j.theme_color === "#0B1F45", "theme_color = azul escuro oficial");
ok(j.start_url === "/", "start_url = /");

// 2. service worker
console.log("\n2. service worker");
await p.goto(BASE, { waitUntil: "load" });
const reg = await p.evaluate(async () => {
  const r = await navigator.serviceWorker.ready.catch(() => null);
  return r ? { escopo: r.scope, ativo: !!r.active } : null;
});
ok(reg?.ativo === true, "service worker ativo");
ok(reg?.escopo === `${BASE}/`, "escopo cobre o site inteiro");

// espera o SW ativar e aquecer o app shell
await p.waitForTimeout(4000);
// Segunda visita: e aqui que o video passa pelo SW. Na primeira o navegador
// ja o pediu antes de o SW assumir o controle da pagina.
await p.reload({ waitUntil: "load" });
await p.waitForTimeout(9000);
const caches = await p.evaluate(async () => {
  const nomes = await window.caches.keys();
  const out = {};
  for (const n of nomes) out[n] = (await (await window.caches.open(n)).keys()).map(r => new URL(r.url).pathname);
  return out;
});
console.log("\n3. o que ficou em cache");
for (const [n, urls] of Object.entries(caches)) console.log(`     ${n}: ${urls.length} itens`);
const todos = Object.values(caches).flat();
ok(todos.includes("/"), "a pagina inicial esta em cache");
ok(todos.some(u => u.startsWith("/brand/")), "a logomarca esta em cache");
const video = todos.find(u => u.startsWith("/media/igreja-drone"));
ok(!!video, `o VIDEO ficou em cache (${video ?? "nenhum"})`);
ok(!todos.some(u=>u.endsWith(".webm")) || !todos.some(u=>u.endsWith(".mp4")),
   "so UM formato de video foi baixado, nao os dois");

// 4. abrir offline
console.log("\n4. funcionamento offline");
await ctx.setOffline(true);
const p2 = await ctx.newPage();
const resp = await p2.goto(BASE, { waitUntil: "domcontentloaded" }).catch(() => null);
ok(!!resp, "a pagina ABRE sem internet");
// O titulo entra no segundo 5 da abertura; antes disso a tela e preta de proposito.
const apareceu = await p2.locator("text=Escola Bíblica").first()
  .waitFor({ state: "visible", timeout: 12000 }).then(() => true).catch(() => false);
ok(apareceu, "o conteudo aparece offline");
const videoOffline = await p2.evaluate(() => {
  const v = document.querySelector("video");
  return v ? { pronto: v.readyState, erro: !!v.error } : null;
});
ok(videoOffline?.pronto >= 2 && !videoOffline.erro,
   `o VIDEO toca offline (readyState=${videoOffline?.pronto})`);
await ctx.setOffline(false);

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`);
await b.close();
process.exit(falhas === 0 ? 0 : 1);
