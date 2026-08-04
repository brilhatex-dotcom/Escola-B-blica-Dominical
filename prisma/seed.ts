/**
 * Importacao do export do sistema antigo (Google Apps Script) para o Postgres via Prisma.
 *
 *   npm run db:seed
 *   npm run db:seed -- --file data/OUTRO_EXPORT.json
 *   npm run db:seed:dry     # so valida e conta, NAO escreve no banco
 *
 * Caracteristicas:
 *   - Idempotente: usa upsert por PK, pode rodar quantas vezes quiser sem duplicar.
 *   - Normaliza "" -> null, strings numericas -> numero, "true"/"false" -> boolean.
 *   - Respeita a ordem de dependencia (Congregacoes -> Classes -> Alunos -> Frequencias ...).
 *   - Resolve as COLISOES DE ID do export (ver README-IMPORT.md) preservando todas as linhas.
 *   - No fim imprime a contagem por tabela e compara com os numeros esperados.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * --dry-run: roda todas as conversoes e validacoes sobre o JSON, resolve as
 * colisoes de id e conta as linhas, mas NAO escreve nada no banco. Serve para
 * conferir os numeros antes de rodar a migration.
 */
const DRY = process.argv.includes("--dry-run");

/** Linhas preparadas por tabela (usado no relatorio do --dry-run). */
const staged: Record<string, number> = {};

async function save(tabela: string, run: () => Promise<unknown>): Promise<void> {
  staged[tabela] = (staged[tabela] ?? 0) + 1;
  if (!DRY) await run();
}

/* ------------------------------------------------------------------ *
 * Numeros esperados (informados pelo usuario)                         *
 * ------------------------------------------------------------------ */
const EXPECTED: Record<string, number> = {
  Usuarios: 19,
  Classes: 53,
  Alunos: 323,
  Frequencias: 2599,
  Freq_Licao: 65,
};

/* ------------------------------------------------------------------ *
 * Normalizadores                                                      *
 * ------------------------------------------------------------------ */

/** "" (e espacos em branco) e undefined viram null. */
function nz(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

/** Numero, ou string numerica, ou null. Lanca se vier lixo nao numerico. */
function toInt(v: unknown, ctx: string): number | null {
  const x = nz(v);
  if (x === null) return null;
  if (typeof x === "number") {
    if (!Number.isFinite(x)) throw new Error(`${ctx}: numero invalido ${x}`);
    return Math.trunc(x);
  }
  if (typeof x === "string") {
    const n = Number(x.trim());
    if (Number.isNaN(n)) throw new Error(`${ctx}: nao numerico ${JSON.stringify(x)}`);
    return Math.trunc(n);
  }
  throw new Error(`${ctx}: tipo inesperado ${typeof x}`);
}

function toIntReq(v: unknown, ctx: string): number {
  const n = toInt(v, ctx);
  if (n === null) throw new Error(`${ctx}: obrigatorio, veio vazio`);
  return n;
}

/** Decimal monetario preservando 2 casas. */
function toDecimal(v: unknown, ctx: string): Prisma.Decimal {
  const x = nz(v);
  if (x === null) throw new Error(`${ctx}: valor obrigatorio, veio vazio`);
  const n = typeof x === "number" ? x : Number(String(x).replace(",", "."));
  if (Number.isNaN(n)) throw new Error(`${ctx}: valor nao numerico ${JSON.stringify(x)}`);
  return new Prisma.Decimal(n.toFixed(2));
}

/** true/false reais, ou "true"/"false"/"1"/"0"/"sim"/"nao" como texto. */
function toBool(v: unknown, ctx: string, dflt = false): boolean {
  const x = nz(v);
  if (x === null) return dflt;
  if (typeof x === "boolean") return x;
  if (typeof x === "number") return x !== 0;
  if (typeof x === "string") {
    const s = x.trim().toLowerCase();
    if (["true", "1", "sim", "s", "yes", "y"].includes(s)) return true;
    if (["false", "0", "nao", "não", "n", "no"].includes(s)) return false;
  }
  throw new Error(`${ctx}: booleano invalido ${JSON.stringify(v)}`);
}

/** Texto ou null. Numeros (ex.: telefone) viram texto sem notacao cientifica. */
function toStr(v: unknown): string | null {
  const x = nz(v);
  if (x === null) return null;
  if (typeof x === "number") return Number.isInteger(x) ? x.toFixed(0) : String(x);
  return String(x);
}

function toStrReq(v: unknown, ctx: string): string {
  const s = toStr(v);
  if (s === null) throw new Error(`${ctx}: obrigatorio, veio vazio`);
  return s;
}

/** "YYYY-MM-DD" -> Date em UTC meia-noite (campo @db.Date, sem fuso). */
function toDate(v: unknown, ctx: string): Date | null {
  const x = nz(v);
  if (x === null) return null;
  const s = String(x).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new Error(`${ctx}: data invalida ${JSON.stringify(s)}`);
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`${ctx}: data invalida ${JSON.stringify(s)}`);
  return d;
}

function toDateReq(v: unknown, ctx: string): Date {
  const d = toDate(v, ctx);
  if (d === null) throw new Error(`${ctx}: data obrigatoria, veio vazia`);
  return d;
}

/** Timestamp ISO completo. */
function toDateTimeReq(v: unknown, ctx: string): Date {
  const s = toStrReq(v, ctx);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`${ctx}: timestamp invalido ${JSON.stringify(s)}`);
  return d;
}

/** Campo que no export e uma string com JSON serializado. */
function toJson(v: unknown, ctx: string): Prisma.InputJsonValue {
  const x = nz(v);
  if (x === null) return [];
  if (typeof x !== "string") return x as Prisma.InputJsonValue;
  try {
    return JSON.parse(x) as Prisma.InputJsonValue;
  } catch {
    console.warn(`  ! ${ctx}: JSON invalido, guardado como texto cru`);
    return x;
  }
}

/* ------------------------------------------------------------------ *
 * Resolucao das colisoes de id                                        *
 * ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

interface Remap {
  rows: Row[];
  /** legacyId original das linhas que tiveram o id trocado, por indice. */
  legacy: Map<number, number>;
  collisions: number;
}

/**
 * O export tem linhas DISTINTAS compartilhando o mesmo id (a planilha reusou ids).
 * A primeira ocorrencia mantem o id original; as seguintes recebem um id novo
 * acima do maximo e guardam o id da planilha em legacyId.
 * Assim nenhuma linha e perdida e os ids nao-colididos continuam intactos.
 */
function dedupeIds(rows: Row[], table: string): Remap {
  const seen = new Set<number>();
  for (const r of rows) {
    const id = toInt(r.id, `${table}.id`);
    if (id !== null) seen.add(id);
  }
  let next = (seen.size ? Math.max(...seen) : 0) + 1;

  const used = new Set<number>();
  const legacy = new Map<number, number>();
  let collisions = 0;

  rows.forEach((r, i) => {
    const id = toIntReq(r.id, `${table}[${i}].id`);
    if (!used.has(id)) {
      used.add(id);
      return;
    }
    while (used.has(next) || seen.has(next)) next++;
    legacy.set(i, id);
    r.id = next;
    used.add(next);
    collisions++;
  });

  if (collisions) {
    console.warn(
      `  ! ${table}: ${collisions} linha(s) com id repetido no export; ` +
        `id remapeado, original preservado em legacyId`,
    );
  }
  return { rows, legacy, collisions };
}

/**
 * Frequencias apontam para alunoId; quando esse id colidiu, escolhemos o Aluno
 * certo pelo par (congId, classeId) da propria frequencia.
 */
function buildAlunoResolver(alunos: Row[], legacy: Map<number, number>) {
  // chave "legacyId|congId|classeId" -> id novo
  const byLegacy = new Map<string, number>();
  alunos.forEach((a, i) => {
    const orig = legacy.get(i);
    if (orig === undefined) return;
    byLegacy.set(`${orig}|${a.congId}|${a.classeId}`, a.id as number);
  });

  const collidedOriginals = new Set(legacy.values());

  return function resolve(alunoId: number, congId: unknown, classeId: unknown): number {
    if (!collidedOriginals.has(alunoId)) return alunoId;
    const hit = byLegacy.get(`${alunoId}|${congId}|${classeId}`);
    return hit ?? alunoId; // sem match: fica com a primeira ocorrencia
  };
}

/* ------------------------------------------------------------------ *
 * Importacao                                                          *
 * ------------------------------------------------------------------ */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = arg("--file") ?? "data/EBD_EXPORT_2026-08-03_1343.json";
  const path = resolve(process.cwd(), file);
  console.log(`Lendo ${path}\n`);

  if (DRY) console.log("MODO DRY-RUN: nada sera gravado no banco.\n");

  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const table = (name: string): Row[] =>
    Array.isArray(raw[name]) ? (raw[name] as Row[]) : [];

  const meta = raw._meta as Record<string, unknown> | undefined;
  if (meta) console.log(`Export de ${meta.exportadoEm} (${meta.totalAbas} abas)\n`);

  /* -------- 1. Congregacoes (derivada dos congId distintos) -------- */
  const congIds = new Set<number>();
  for (const t of [
    "Usuarios", "Classes", "Alunos", "Frequencias", "Freq_Licao",
    "Ofertas", "Visitantes", "Licoes", "Escala_Cultos", "Eventos", "Avisos",
  ]) {
    for (const r of table(t)) {
      const c = toInt(r.congId, `${t}.congId`);
      if (c !== null) congIds.add(c);
    }
  }
  /*
   * Os nomes das congregacoes nao estao numa aba propria, mas ESTAO no export:
   * cada congId tem um usuario coordenador cuja conta e a propria congregacao
   * (login "ebdbetania" -> nome "Cong. Betania"). O filtro por login iniciado
   * em "ebd" separa essas contas institucionais das contas de pessoas — a
   * coordenadora do congId 12, por exemplo, chama "IR. GRACA", que e nome de
   * gente e nao de congregacao.
   */
  const nomesCong = new Map<number, string>();
  for (const u of table("Usuarios")) {
    const c = toInt(u.congId, "Usuarios.congId");
    const login = (toStr(u.login) ?? "").toLowerCase();
    const nome = toStr(u.nome);
    if (c === null || !nome || !login.startsWith("ebd")) continue;
    // O primeiro que aparecer vence: o congId 1 tem "Templo Sede" e
    // "T. Matriz", que sao a mesma casa.
    if (!nomesCong.has(c)) nomesCong.set(c, nome);
  }

  for (const id of [...congIds].sort((a, b) => a - b)) {
    const nome = nomesCong.get(id) ?? "";
    await save("Congregacoes", () =>
      prisma.congregacao.upsert({
        where: { id },
        // `update: {}` de proposito: se voce corrigir um nome no banco, uma
        // nova execucao do seed nao desfaz a sua correcao.
        update: {},
        create: { id, nome },
      }),
    );
  }

  const semNome = [...congIds].filter((c) => !nomesCong.has(c));
  console.log(
    `Congregacoes derivadas: ${congIds.size}` +
      (semNome.length
        ? ` (sem nome identificado: ${semNome.join(", ")})`
        : " — todas com nome"),
  );
  for (const id of [...congIds].sort((a, b) => a - b)) {
    console.log(`    ${String(id).padStart(2)}  ${nomesCong.get(id) ?? "(sem nome)"}`);
  }

  /* -------- 2. Classes -------- */
  const classes = dedupeIds(table("Classes"), "Classes");
  const classeIds = new Set<number>();
  for (const [i, c] of classes.rows.entries()) {
    const id = toIntReq(c.id, `Classes[${i}].id`);
    const data = {
      legacyId: classes.legacy.get(i) ?? null,
      nome: toStrReq(c.nome, `Classes[${i}].nome`),
      faixa: toStrReq(c.faixa, `Classes[${i}].faixa`) ,
      prof: toStr(c.prof),
      tipoClasse: toStrReq(c.tipoClasse, `Classes[${i}].tipoClasse`),
      congId: toInt(c.congId, `Classes[${i}].congId`),
      ativa: toBool(c.ativa, `Classes[${i}].ativa`, true),
    };
    await save("Classes", () =>
      prisma.classe.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
    classeIds.add(id);
  }

  /* -------- 3. Usuarios -------- */
  const usuarios = dedupeIds(table("Usuarios"), "Usuarios");
  for (const [i, u] of usuarios.rows.entries()) {
    const id = toIntReq(u.id, `Usuarios[${i}].id`);
    const classeId = toInt(u.classeId, `Usuarios[${i}].classeId`);
    const data = {
      legacyId: usuarios.legacy.get(i) ?? null,
      nome: toStrReq(u.nome, `Usuarios[${i}].nome`),
      login: toStrReq(u.login, `Usuarios[${i}].login`),
      senha: toStrReq(u.senha, `Usuarios[${i}].senha`),   // hash SHA-256, sem re-hash
      perfil: toStrReq(u.perfil, `Usuarios[${i}].perfil`),
      congId: toInt(u.congId, `Usuarios[${i}].congId`),
      classeId: classeId !== null && classeIds.has(classeId) ? classeId : null,
      ativo: toBool(u.ativo, `Usuarios[${i}].ativo`, true),
    };
    await save("Usuarios", () =>
      prisma.usuario.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }

  /* -------- 4. Alunos -------- */
  const alunos = dedupeIds(table("Alunos"), "Alunos");
  let orfaos = 0;
  for (const [i, a] of alunos.rows.entries()) {
    const id = toIntReq(a.id, `Alunos[${i}].id`);
    const rawClasse = toInt(a.classeId, `Alunos[${i}].classeId`);
    const classeId = rawClasse !== null && classeIds.has(rawClasse) ? rawClasse : null;
    if (rawClasse !== null && classeId === null) {
      console.warn(`  ! Alunos[${i}] (id ${id}, ${a.nome}): classe ${rawClasse} nao existe -> classeId=null`);
      orfaos++;
    }
    const data = {
      legacyId: alunos.legacy.get(i) ?? null,
      nome: toStrReq(a.nome, `Alunos[${i}].nome`),
      nasc: toDate(a.nasc, `Alunos[${i}].nasc`),
      tel: toStr(a.tel),
      resp: toStr(a.resp),
      congId: toInt(a.congId, `Alunos[${i}].congId`),
      classeId,
      ativo: toBool(a.ativo, `Alunos[${i}].ativo`, true),
    };
    await save("Alunos", () =>
      prisma.aluno.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }
  if (orfaos) console.warn(`  ! ${orfaos} aluno(s) com classe inexistente`);

  const resolveAluno = buildAlunoResolver(alunos.rows, alunos.legacy);

  /* -------- 5. Licoes (antes de Freq_Licao) -------- */
  const licoes = dedupeIds(table("Licoes"), "Licoes");
  for (const [i, l] of licoes.rows.entries()) {
    const id = toIntReq(l.id, `Licoes[${i}].id`);
    const data = {
      legacyId: licoes.legacy.get(i) ?? null,
      ano: toIntReq(l.ano, `Licoes[${i}].ano`),
      data: toDateReq(l.data, `Licoes[${i}].data`),
      escopo: toStrReq(l.escopo, `Licoes[${i}].escopo`),
      tipoClasse: toStrReq(l.tipoClasse, `Licoes[${i}].tipoClasse`),
      titulo: toStrReq(l.titulo, `Licoes[${i}].titulo`),
      trim: toStrReq(l.trim, `Licoes[${i}].trim`),
      classeId: toInt(l.classeId, `Licoes[${i}].classeId`),
      congId: toInt(l.congId, `Licoes[${i}].congId`),
    };
    await save("Licoes", () =>
      prisma.licao.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }

  /* -------- 6. Frequencias -------- */
  const freqs = dedupeIds(table("Frequencias"), "Frequencias");
  for (const [i, f] of freqs.rows.entries()) {
    const id = toIntReq(f.id, `Frequencias[${i}].id`);
    const congId = toInt(f.congId, `Frequencias[${i}].congId`);
    const classeId = toInt(f.classeId, `Frequencias[${i}].classeId`);
    const data = {
      legacyId: freqs.legacy.get(i) ?? null,
      alunoId: resolveAluno(toIntReq(f.alunoId, `Frequencias[${i}].alunoId`), congId, classeId),
      classeId: classeId !== null && classeIds.has(classeId) ? classeId : null,
      congId,
      data: toDateReq(f.data, `Frequencias[${i}].data`),
      presente: toBool(f.presente, `Frequencias[${i}].presente`),
    };
    await save("Frequencias", () =>
      prisma.frequencia.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }

  /* -------- 7. Freq_Licao -------- */
  const fl = dedupeIds(table("Freq_Licao"), "Freq_Licao");
  for (const [i, r] of fl.rows.entries()) {
    const id = toIntReq(r.id, `Freq_Licao[${i}].id`);
    const classeId = toInt(r.classeId, `Freq_Licao[${i}].classeId`);
    const data = {
      legacyId: fl.legacy.get(i) ?? null,
      classeId: classeId !== null && classeIds.has(classeId) ? classeId : null,
      congId: toInt(r.congId, `Freq_Licao[${i}].congId`),
      data: toDateReq(r.data, `Freq_Licao[${i}].data`),
      licaoId: toIntReq(r.licaoId, `Freq_Licao[${i}].licaoId`),
      licaoTitulo: toStrReq(r.licaoTitulo, `Freq_Licao[${i}].licaoTitulo`),
    };
    await save("Freq_Licao", () =>
      prisma.freqLicao.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }

  /* -------- 8. Ofertas -------- */
  const ofertas = dedupeIds(table("Ofertas"), "Ofertas");
  for (const [i, o] of ofertas.rows.entries()) {
    const id = toIntReq(o.id, `Ofertas[${i}].id`);
    const classeId = toInt(o.classeId, `Ofertas[${i}].classeId`);
    const data = {
      legacyId: ofertas.legacy.get(i) ?? null,
      classeId: classeId !== null && classeIds.has(classeId) ? classeId : null,
      congId: toInt(o.congId, `Ofertas[${i}].congId`),
      data: toDateReq(o.data, `Ofertas[${i}].data`),
      obs: toStr(o.obs),
      valor: toDecimal(o.valor, `Ofertas[${i}].valor`),
    };
    await save("Ofertas", () =>
      prisma.oferta.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }

  /* -------- 9. Visitantes -------- */
  const visitantes = dedupeIds(table("Visitantes"), "Visitantes");
  for (const [i, v] of visitantes.rows.entries()) {
    const id = toIntReq(v.id, `Visitantes[${i}].id`);
    const classeId = toInt(v.classeId, `Visitantes[${i}].classeId`);
    const data = {
      legacyId: visitantes.legacy.get(i) ?? null,
      nome: toStrReq(v.nome, `Visitantes[${i}].nome`),
      idade: toInt(v.idade, `Visitantes[${i}].idade`),
      tel: toStr(v.tel),
      obs: toStr(v.obs),
      classeId: classeId !== null && classeIds.has(classeId) ? classeId : null,
      congId: toInt(v.congId, `Visitantes[${i}].congId`),
      data: toDateReq(v.data, `Visitantes[${i}].data`),
    };
    await save("Visitantes", () =>
      prisma.visitante.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }

  /* -------- 10. Tabelas sem id proprio -------- */
  for (const [i, p] of table("Precos_Revistas").entries()) {
    const key = toStrReq(p.key, `Precos_Revistas[${i}].key`);
    const categoria = toStrReq(p.categoria, `Precos_Revistas[${i}].categoria`);
    const data = {
      label: toStrReq(p.label, `Precos_Revistas[${i}].label`),
      preco: toDecimal(p.preco, `Precos_Revistas[${i}].preco`),
    };
    await save("Precos_Revistas", () =>
      prisma.precoRevista.upsert({
        where: { key_categoria: { key, categoria } },
        update: data,
        create: { key, categoria, ...data },
      }),
    );
  }

  for (const [i, p] of table("Parametros").entries()) {
    const parametro = toStrReq(p.parametro, `Parametros[${i}].parametro`);
    const data = { valor: toDecimal(p.valor, `Parametros[${i}].valor`) };
    await save("Parametros", () =>
      prisma.parametro.upsert({ where: { parametro }, update: data, create: { parametro, ...data } }),
    );
  }

  /* -------- 11. Reunioes -------- */
  const reunioes = dedupeIds(table("Reunioes"), "Reunioes");
  for (const [i, r] of reunioes.rows.entries()) {
    const id = toIntReq(r.id, `Reunioes[${i}].id`);
    const data = {
      legacyId: reunioes.legacy.get(i) ?? null,
      titulo: toStrReq(r.titulo, `Reunioes[${i}].titulo`),
      tipo: toStrReq(r.tipo, `Reunioes[${i}].tipo`),
      data: toDateReq(r.data, `Reunioes[${i}].data`),
      local: toStr(r.local),
      obs: toStr(r.obs),
      autor: toStrReq(r.autor, `Reunioes[${i}].autor`),
      participantes: toJson(r.participantes, `Reunioes[${i}].participantes`),
      presentes: toIntReq(r.presentes, `Reunioes[${i}].presentes`),
      total: toIntReq(r.total, `Reunioes[${i}].total`),
      registradoEm: toDateTimeReq(r.registradoEm, `Reunioes[${i}].registradoEm`),
    };
    await save("Reunioes", () =>
      prisma.reuniao.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }

  /* -------- 12. Escala_Cultos / Eventos / Avisos -------- */
  const escalas = dedupeIds(table("Escala_Cultos"), "Escala_Cultos");
  for (const [i, e] of escalas.rows.entries()) {
    const id = toIntReq(e.id, `Escala_Cultos[${i}].id`);
    const data = {
      legacyId: escalas.legacy.get(i) ?? null,
      titulo: toStrReq(e.titulo, `Escala_Cultos[${i}].titulo`),
      mesAno: toDateReq(e.mesAno, `Escala_Cultos[${i}].mesAno`),
      dataUpload: toDateReq(e.dataUpload, `Escala_Cultos[${i}].dataUpload`),
      nomeArquivo: toStrReq(e.nomeArquivo, `Escala_Cultos[${i}].nomeArquivo`),
      url: toStrReq(e.url, `Escala_Cultos[${i}].url`),
      urlPreview: toStrReq(e.urlPreview, `Escala_Cultos[${i}].urlPreview`),
      obs: toStr(e.obs),
      autor: toStrReq(e.autor, `Escala_Cultos[${i}].autor`),
      congId: toInt(e.congId, `Escala_Cultos[${i}].congId`),
    };
    await save("Escala_Cultos", () =>
      prisma.escalaCulto.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }

  const eventos = dedupeIds(table("Eventos"), "Eventos");
  for (const [i, e] of eventos.rows.entries()) {
    const id = toIntReq(e.id, `Eventos[${i}].id`);
    const data = {
      legacyId: eventos.legacy.get(i) ?? null,
      titulo: toStrReq(e.titulo, `Eventos[${i}].titulo`),
      descricao: toStrReq(e.descricao, `Eventos[${i}].descricao`),
      tipo: toStrReq(e.tipo, `Eventos[${i}].tipo`),
      local: toStrReq(e.local, `Eventos[${i}].local`),
      data: toDateReq(e.data, `Eventos[${i}].data`),
      dataFim: toDateReq(e.dataFim, `Eventos[${i}].dataFim`),
      obs: toStr(e.obs),
      congId: toInt(e.congId, `Eventos[${i}].congId`),
    };
    await save("Eventos", () =>
      prisma.evento.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }

  const avisos = dedupeIds(table("Avisos"), "Avisos");
  for (const [i, a] of avisos.rows.entries()) {
    const id = toIntReq(a.id, `Avisos[${i}].id`);
    const data = {
      legacyId: avisos.legacy.get(i) ?? null,
      titulo: toStrReq(a.titulo, `Avisos[${i}].titulo`),
      texto: toStrReq(a.texto, `Avisos[${i}].texto`),
      prioridade: toIntReq(a.prioridade, `Avisos[${i}].prioridade`),
      dataPublicacao: toDateReq(a.dataPublicacao, `Avisos[${i}].dataPublicacao`),
      dataExpiracao: toDateReq(a.dataExpiracao, `Avisos[${i}].dataExpiracao`),
      autor: toStrReq(a.autor, `Avisos[${i}].autor`),
      congId: toInt(a.congId, `Avisos[${i}].congId`),
    };
    await save("Avisos", () =>
      prisma.aviso.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }

  /* -------- 13. Auditoria e Versiculos -------- */
  const auditoria = dedupeIds(table("Auditoria"), "Auditoria");
  for (const [i, a] of auditoria.rows.entries()) {
    const id = toIntReq(a.id, `Auditoria[${i}].id`);
    const data = {
      legacyId: auditoria.legacy.get(i) ?? null,
      when: toDateTimeReq(a.when, `Auditoria[${i}].when`),
      who: toStrReq(a.who, `Auditoria[${i}].who`),
      whoLogin: toStrReq(a.whoLogin, `Auditoria[${i}].whoLogin`),
      action: toStrReq(a.action, `Auditoria[${i}].action`),
      entidade: toStrReq(a.entidade, `Auditoria[${i}].entidade`),
      desc: toStrReq(a.desc, `Auditoria[${i}].desc`),
    };
    await save("Auditoria", () =>
      prisma.auditoria.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }

  const versiculos = dedupeIds(table("Versiculos"), "Versiculos");
  for (const [i, v] of versiculos.rows.entries()) {
    const id = toIntReq(v.id, `Versiculos[${i}].id`);
    const data = {
      legacyId: versiculos.legacy.get(i) ?? null,
      ref: toStrReq(v.ref, `Versiculos[${i}].ref`),
      texto: toStrReq(v.texto, `Versiculos[${i}].texto`),
      ativo: toBool(v.ativo, `Versiculos[${i}].ativo`, true),
    };
    await save("Versiculos", () =>
      prisma.versiculo.upsert({ where: { id }, update: data, create: { id, ...data } }),
    );
  }

  /* ---------------------------------------------------------------- *
   * Relatorio final                                                   *
   * ---------------------------------------------------------------- */
  const counts: Record<string, number> = DRY ? staged : {
    Congregacoes: await prisma.congregacao.count(),
    Usuarios: await prisma.usuario.count(),
    Classes: await prisma.classe.count(),
    Alunos: await prisma.aluno.count(),
    Frequencias: await prisma.frequencia.count(),
    Freq_Licao: await prisma.freqLicao.count(),
    Licoes: await prisma.licao.count(),
    Ofertas: await prisma.oferta.count(),
    Visitantes: await prisma.visitante.count(),
    Precos_Revistas: await prisma.precoRevista.count(),
    Parametros: await prisma.parametro.count(),
    Reunioes: await prisma.reuniao.count(),
    Escala_Cultos: await prisma.escalaCulto.count(),
    Eventos: await prisma.evento.count(),
    Avisos: await prisma.aviso.count(),
    Auditoria: await prisma.auditoria.count(),
    Versiculos: await prisma.versiculo.count(),
  };

  console.log(
    DRY
      ? "\n=========== CONTAGEM (DRY-RUN, nada gravado) ==========="
      : "\n================ CONTAGEM IMPORTADA ================",
  );
  const width = Math.max(...Object.keys(counts).map((k) => k.length));
  let divergencias = 0;

  for (const [name, got] of Object.entries(counts)) {
    const exp = EXPECTED[name];
    const jsonLen = Array.isArray(raw[name]) ? (raw[name] as unknown[]).length : null;
    let status: string;
    if (exp === undefined) {
      status = jsonLen !== null && jsonLen !== got ? `(JSON tinha ${jsonLen})` : "";
    } else if (got === exp) {
      status = `OK (esperado ${exp})`;
    } else {
      status = `>>> DIVERGENTE: esperado ${exp}, obtido ${got} <<<`;
      divergencias++;
    }
    console.log(`  ${name.padEnd(width)}  ${String(got).padStart(6)}  ${status}`);
  }
  console.log("====================================================");

  if (divergencias > 0) {
    console.error(`\n!! ${divergencias} tabela(s) divergiram dos numeros esperados.`);
    process.exitCode = 1;
  } else {
    console.log("\nTodas as tabelas conferidas batem com os numeros esperados.");
  }
}

main()
  .catch((e) => {
    console.error("\nFalha na importacao:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
