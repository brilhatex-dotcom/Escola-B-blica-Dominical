/**
 * Verificacao do Dashboard num navegador de verdade.
 *
 *   npm run build && npm start          (num terminal)
 *   npm run verificar:dashboard         (noutro)
 *
 * Confere, em quatro tamanhos de tela, que nao ha rolagem horizontal, que todos
 * os blocos aparecem, que o grafico realmente desenhou e que o console fica
 * limpo — mais o menu recolhivel, a busca global e a gaveta do celular.
 *
 * O `playwright` NAO entra nas dependencias do projeto: sao mais de 100 MB que
 * a Vercel baixaria em todo build sem serventia em producao. Instale so na hora:
 *
 *   npm i --no-save playwright && npx playwright install chromium
 *
 * BASE   - endereco do servidor (padrao http://localhost:3000)
 * CHROME - caminho de um Chromium ja instalado, se houver
 * OUT    - onde salvar as capturas de tela (padrao ./capturas)
 */
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "capturas";

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

mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--no-sandbox"],
});

let falhas = 0;
const ok = (c, m) => { console.log(`  ${c ? "OK  " : "FALHA"}  ${m}`); if (!c) falhas++; };

const telas = [
  { nome: "desktop", w: 1920, h: 1080 },
  { nome: "notebook", w: 1366, h: 768 },
  { nome: "ipad", w: 820, h: 1180 },
  { nome: "iphone", w: 390, h: 844 },
];

for (const t of telas) {
  const ctx = await b.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const erros = [];
  p.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  p.on("pageerror", (e) => erros.push(String(e)));

  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);

  console.log(`\n== ${t.nome} ${t.w}x${t.h} ==`);

  // overflow horizontal
  const over = await p.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }));
  ok(over.doc <= over.win + 1, `sem rolagem horizontal (${over.doc} <= ${over.win})`);

  // conteudo essencial
  for (const [sel, nome] of [
    ["#titulo-resumo", "Resumo do domingo"],
    ["#titulo-atividades", "Atividades recentes"],
    ["#titulo-aniversariantes", "Aniversariantes"],
    ["#titulo-agenda", "Agenda"],
    ["text=Frequência mensal", "gráfico de frequência"],
    ["text=Total de Alunos", "cartão Total de Alunos"],
  ]) {
    const v = await p.locator(sel).first().isVisible().catch(() => false);
    ok(v, nome);
  }

  // o grafico realmente desenhou (svg com paths)
  const paths = await p.locator("svg.recharts-surface path").count().catch(() => 0);
  ok(paths > 3, `o gráfico desenhou (${paths} traços)`);

  // saudacao pt-BR
  const saud = await p.locator("h1").first().textContent().catch(() => "");
  ok(/Bom dia|Boa tarde|Boa noite/.test(saud ?? ""), `saudação em pt-BR ("${(saud ?? "").trim().slice(0, 40)}")`);

  ok(erros.length === 0, `sem erros no console${erros.length ? `: ${erros[0].slice(0, 120)}` : ""}`);

  await p.screenshot({ path: `${OUT}/dash-${t.nome}.png`, fullPage: t.w < 900 });
  await ctx.close();
}

// sidebar recolhivel + rota "em breve" + gaveta no celular
console.log("\n== interações ==");
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);

  const larguraAntes = await p.locator("aside").first().evaluate((e) => e.getBoundingClientRect().width);
  await p.getByLabel("Recolher menu").click();
  await p.waitForTimeout(900);
  const larguraDepois = await p.locator("aside").first().evaluate((e) => e.getBoundingClientRect().width);
  ok(larguraDepois < larguraAntes - 100, `menu recolhe (${Math.round(larguraAntes)} -> ${Math.round(larguraDepois)}px)`);

  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  const larguraApos = await p.locator("aside").first().evaluate((e) => e.getBoundingClientRect().width);
  ok(Math.abs(larguraApos - larguraDepois) < 8, "a preferência sobrevive ao recarregar");

  await p.getByLabel("Expandir menu").click();
  await p.waitForTimeout(700);

  // busca global
  await p.keyboard.press("Control+k");
  await p.keyboard.type("visit");
  await p.waitForTimeout(500);
  const achou = await p.locator("[role=option]").first().isVisible().catch(() => false);
  ok(achou, "a busca global encontra o módulo Visitantes");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(1200);
  ok(p.url().endsWith("/dashboard/visitantes"), `Enter navega (${p.url()})`);
  const emBreve = await p.locator("text=Voltar ao Dashboard").isVisible().catch(() => false);
  ok(emBreve, "módulo não construído mostra 'em construção', não 404");

  await p.screenshot({ path: `${OUT}/dash-embreve.png` });
  await ctx.close();
}

// gaveta no celular
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await p.getByLabel("Abrir menu").click();
  await p.waitForTimeout(800);
  const gaveta = await p.locator("nav[aria-label='Menu principal']").last().isVisible();
  ok(gaveta, "a gaveta abre no celular");
  await p.screenshot({ path: `${OUT}/dash-gaveta.png` });
  await ctx.close();
}

console.log(falhas === 0 ? "\nTUDO PASSOU\n" : `\n${falhas} FALHA(S)\n`);
await b.close();
process.exit(falhas === 0 ? 0 : 1);
