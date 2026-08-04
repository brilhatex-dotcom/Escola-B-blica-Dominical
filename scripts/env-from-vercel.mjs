#!/usr/bin/env node
/**
 * Monta o `.env` local a partir das variaveis que a Vercel injeta no projeto.
 *
 * POR QUE ISSO EXISTE
 *
 * A integracao Neon <-> Vercel cria o banco e injeta as variaveis sozinha, mas
 * com os nomes DELA — que nao sao os que `prisma/schema.prisma` le. E os nomes
 * ainda variam conforme a integracao usada:
 *
 *   Neon (nativa) ........ DATABASE_URL          + DATABASE_URL_UNPOOLED
 *   Vercel Postgres ...... POSTGRES_PRISMA_URL   + POSTGRES_URL_NON_POOLING
 *   Generico ............. POSTGRES_URL          + ...
 *
 * Copiar isso na mao e onde as pessoas erram: trocam as duas pontas e o
 * `migrate` quebra com um erro sobre prepared statements que nao explica nada.
 * A distincao e obrigatoria e nao e cosmetica:
 *
 *   - a POOLED (PgBouncer) e o que a aplicacao usa no dia a dia;
 *   - a DIRETA e o que `prisma migrate` precisa, porque migration nao passa
 *     por pooler em modo transaction.
 *
 * Este script resolve isso: le o que existe, escolhe a ponta certa para cada
 * papel, garante o `pgbouncer=true` na pooled e escreve o `.env`.
 *
 * Uso:
 *   npm run env:pull            # baixa da Vercel e monta o .env
 *   npm run env:pull -- --keep  # nao apaga o arquivo intermediario
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";

const INTERMEDIARIO = ".env.vercel.local";
const SAIDA = ".env";
const manter = process.argv.includes("--keep");

/** Candidatas a conexao POOLED, da mais especifica para a mais generica. */
const POOLED = ["POSTGRES_PRISMA_URL", "DATABASE_URL", "POSTGRES_URL"];

/** Candidatas a conexao DIRETA (sem pooler). */
const DIRETA = [
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DIRECT_URL",
  "PGHOST_UNPOOLED", // so para detectar a integracao; nao e uma URL
];

function parseEnv(texto) {
  const out = {};
  for (const linha of texto.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(linha);
    if (!m) continue;
    let valor = m[2].trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    out[m[1]] = valor;
  }
  return out;
}

function primeiraUrl(vars, nomes) {
  for (const n of nomes) {
    const v = vars[n];
    if (v && /^postgres(ql)?:\/\//.test(v)) return { nome: n, url: v };
  }
  return null;
}

/** Prisma exige `pgbouncer=true` na conexao pooled; sem isso da erro de prepared statement. */
function comPgbouncer(url) {
  if (/[?&]pgbouncer=true/.test(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + "pgbouncer=true";
}

/** A conexao direta NAO pode carregar pgbouncer=true. */
function semPgbouncer(url) {
  return url
    .replace(/([?&])pgbouncer=true&?/, "$1")
    .replace(/[?&]$/, "");
}

function baixarDaVercel() {
  console.log("Baixando as variaveis do projeto na Vercel…\n");
  try {
    execSync(`npx vercel env pull ${INTERMEDIARIO}`, { stdio: "inherit" });
  } catch {
    console.error(
      "\nNao consegui baixar da Vercel.\n\n" +
        "  1. npx vercel login\n" +
        "  2. npx vercel link      (associa esta pasta ao projeto)\n" +
        "  3. npm run env:pull\n\n" +
        `Alternativa: salve as variaveis num arquivo ${INTERMEDIARIO} e rode de novo.`,
    );
    process.exit(1);
  }
}

/* ---------------------------------------------------------------- */

if (!existsSync(INTERMEDIARIO)) baixarDaVercel();

const vars = parseEnv(readFileSync(INTERMEDIARIO, "utf8"));
const encontradas = Object.keys(vars).filter((k) =>
  /^(POSTGRES|DATABASE|PG|NEON)/.test(k),
);

console.log(`\nVariaveis de banco encontradas: ${encontradas.length ? encontradas.join(", ") : "nenhuma"}\n`);

const pooled = primeiraUrl(vars, POOLED);
const direta = primeiraUrl(vars, DIRETA);

if (!pooled) {
  console.error(
    "Nao achei nenhuma URL de conexao.\n\n" +
      "Na Vercel: aba Storage -> conecte um banco Neon ao projeto, e rode de novo.",
  );
  process.exit(1);
}

if (!direta) {
  console.error(
    `Achei a conexao pooled (${pooled.nome}), mas nenhuma conexao DIRETA.\n\n` +
      "As migrations precisam da conexao sem pooler — pelo PgBouncer elas falham.\n" +
      "Procure no painel do Neon a 'Direct connection' (porta 5432) e adicione\n" +
      "como DIRECT_URL nas variaveis de ambiente do projeto na Vercel.",
  );
  process.exit(1);
}

const conteudo =
  `# Gerado por 'npm run env:pull' a partir das variaveis da Vercel.\n` +
  `# Nao edite a mao: rode o comando de novo se as credenciais mudarem.\n` +
  `# NAO versione este arquivo (ja esta no .gitignore).\n\n` +
  `# aplicacao — via pooler (${pooled.nome})\n` +
  `DATABASE_URL="${comPgbouncer(pooled.url)}"\n\n` +
  `# migrations — conexao direta, sem pooler (${direta.nome})\n` +
  `DIRECT_URL="${semPgbouncer(direta.url)}"\n`;

writeFileSync(SAIDA, conteudo);

if (!manter) unlinkSync(INTERMEDIARIO);

const mascarar = (u) => u.replace(/\/\/([^:]+):([^@]+)@/, "//$1:••••••@");
console.log(`${SAIDA} escrito:\n`);
console.log(`  DATABASE_URL  <- ${pooled.nome}`);
console.log(`                   ${mascarar(comPgbouncer(pooled.url))}\n`);
console.log(`  DIRECT_URL    <- ${direta.nome}`);
console.log(`                   ${mascarar(semPgbouncer(direta.url))}\n`);
console.log("Agora:  npm run db:seed:dry  &&  npm run db:deploy  &&  npm run db:seed");
