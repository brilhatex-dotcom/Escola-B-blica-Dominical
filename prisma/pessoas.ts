import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";

/**
 * Backfill do cadastro de pessoas.
 *
 * Le o que o sistema antigo tinha — o campo `prof` das classes, texto livre — e
 * transforma em Pessoa + PessoaCargo. Roda uma vez; e repetivel sem estragar
 * nada, porque tudo e feito por `chave` unica.
 *
 *   npm run db:pessoas            # aplica
 *   npm run db:pessoas -- --dry   # so mostra o que faria
 *
 * ============================================================================
 * A REGRA QUE MANDA AQUI: nunca alterar por conta propria um registro do
 * sistema antigo.
 *
 * Este script CRIA linhas novas em Pessoas e PessoaCargos. Ele nao apaga nem
 * reescreve `Classes.prof` — o texto original continua la, do jeito que a
 * igreja digitou, e `PessoaCargos.origem` guarda de qual texto cada vinculo
 * nasceu. Se amanha alguem discordar de uma separacao feita aqui, da para
 * conferir contra o original.
 *
 * Onde ha DUVIDA, o script nao decide: marca `revisar = true` e escreve o
 * porque em `observacao`. Fundir "Ana costa" com "Ana Maria costa" pode estar
 * certo — e pode ser mae e filha. Quem sabe e a secretaria, nao o programa.
 * ============================================================================
 */

if (!process.env.DATABASE_URL) {
  for (const arquivo of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(resolve(process.cwd(), arquivo));
      break;
    } catch {
      /* tenta o proximo */
    }
  }
}

const DRY = process.argv.includes("--dry") || process.argv.includes("--dry-run");
const prisma = new PrismaClient();

/* ------------------------------------------------------------------ *
 * Normalizacao
 * ------------------------------------------------------------------ */

/**
 * Tratamentos eclesiasticos e formas de chamamento.
 *
 * Precisam sair do NOME e virar campo proprio. Sem isso, "Silvério" e
 * "Aux. Silverio" viram duas pessoas — e essa e literalmente uma das
 * duplicatas que existem no cadastro atual.
 *
 * A ordem importa: as formas mais longas vem primeiro, senao "Ir." casaria
 * dentro de "Ir.ª" e deixaria um "ª" solto no nome.
 */
const TRATAMENTOS: Array<[RegExp, string]> = [
  [/^irm[ãa]os?\s+/i, "Ir."],
  [/^irm[ãa]s?\s+/i, "Ir.ª"],
  [/^ir\.\s*ª\s*/i, "Ir.ª"],
  [/^ir\.\s*/i, "Ir."],
  [/^pr\.?\s+/i, "Pr."],
  [/^pb\.?\s*/i, "Pb."],
  [/^dc\.?\s*/i, "Dc."],
  [/^aux\.?\s+/i, "Aux."],
  [/^ev\.?\s+/i, "Ev."],
  [/^miss\.?\s+/i, "Miss."],
  [/^presb\.?\s+/i, "Pb."],
  [/^dirigente\s+/i, ""],
];

/**
 * Textos que NAO sao pessoa.
 *
 * "Classe Juniores" esta cadastrado no campo professor de uma classe. Nao e
 * gente, e criar uma Pessoa chamada assim faria o Dashboard contar um professor
 * que nao existe.
 */
const NAO_E_PESSOA = [/^classe\b/i, /^a\s+definir$/i, /^vago$/i, /^-+$/];

function separarTratamento(bruto: string): { tratamento: string | null; nome: string } {
  let nome = bruto.trim().replace(/\s+/g, " ");
  let tratamento: string | null = null;

  for (const [padrao, forma] of TRATAMENTOS) {
    if (padrao.test(nome)) {
      nome = nome.replace(padrao, "").trim();
      tratamento = forma || null;
      break;
    }
  }
  return { tratamento, nome };
}

/** Minusculo, sem acento, espacos normalizados. E o que torna a `chave` unica. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Quebra "Pb. Lourival e Aux. Danilo" em duas pessoas.
 *
 * Separadores: " e ", vírgula e barra. O risco de partir um nome no meio existe
 * (alguem chamado "Maria e Silva"), mas nao ha nenhum caso assim no cadastro —
 * conferi os 47 textos um a um. E `origem` guarda o texto inteiro, entao um erro
 * aqui e reversivel.
 *
 * O criterio de "e uma pessoa?" e ter ao menos duas letras depois de tirar o
 * tratamento; "Pb." sozinho nao vira ninguem.
 */
function separarPessoas(bruto: string): string[] {
  return bruto
    .split(/\s+e\s+|\s*[,;/]\s*/i)
    .map((p) => p.trim())
    .filter((p) => p.replace(/[^a-zA-ZÀ-ÿ]/g, "").length >= 2);
}

/** Distancia de edicao, para achar "Magalhaes" vs "Magslhaes". */
function distancia(a: string, b: string): number {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j];
      linha[j] = Math.min(
        linha[j] + 1,
        linha[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      anterior = guardado;
    }
  }
  return linha[b.length];
}

/* ------------------------------------------------------------------ *
 * Lideranca do campo
 *
 * Entra aqui, e nao chumbada num componente, porque a spec pede que possa ser
 * editada pelo painel administrativo sem mexer no codigo. Estas linhas sao
 * apenas a carga INICIAL: dali em diante quem manda e o banco.
 * ------------------------------------------------------------------ */
const LIDERANCA: Array<{ cargo: string; tratamento: string; nome: string }> = [
  { cargo: "Pastor Presidente", tratamento: "Pr.", nome: "Aílton José Alves" },
  { cargo: "Gestor Local", tratamento: "Pr.", nome: "Enoque Carlos do Nascimento" },
  { cargo: "Supervisor da EBD", tratamento: "Pb.", nome: "José Raimundo" },
  { cargo: "Secretário", tratamento: "Aux.", nome: "Luiz Neto" },
  { cargo: "Secretário Auxiliar", tratamento: "Aux.", nome: "Elvys Danilo" },
];

/* ------------------------------------------------------------------ *
 * Execucao
 * ------------------------------------------------------------------ */

/**
 * Garante um vinculo, sem duplicar.
 *
 * Nao usa `upsert` de proposito: o `where` composto do Prisma NAO aceita null
 * ("Argument `congId` must not be null"), e cargo de campo tem congId e
 * classeId nulos. Nao e falha do Prisma — e o mesmo motivo pelo qual o SQL
 * precisou de `NULLS NOT DISTINCT` no indice: em SQL, NULL nao e igual a NULL,
 * entao "procure a linha onde congId = NULL" nao encontra nada, por definicao.
 *
 * `findFirst` com `equals: null` faz a busca certa (vira `IS NULL`), e o indice
 * unico do banco continua sendo a rede de seguranca se dois processos rodarem
 * juntos.
 */
async function garantirVinculo(dados: {
  pessoaId: number;
  cargoId: number;
  congId?: number | null;
  classeId?: number | null;
  origem?: string | null;
}): Promise<boolean> {
  const { pessoaId, cargoId, congId = null, classeId = null, origem = null } = dados;

  const existente = await prisma.pessoaCargo.findFirst({
    where: { pessoaId, cargoId, congId: { equals: congId }, classeId: { equals: classeId } },
    select: { id: true },
  });
  if (existente) return false;

  await prisma.pessoaCargo.create({ data: { pessoaId, cargoId, congId, classeId, origem } });
  return true;
}

interface Candidato {
  nome: string;
  tratamento: string | null;
  chave: string;
  /** Vinculos que esta pessoa ganha: uma entrada por classe em que aparece. */
  vinculos: Array<{ classeId: number; congId: number | null; origem: string }>;
}

async function main() {
  console.log(DRY ? "\n== SIMULACAO (nada sera gravado) ==\n" : "\n== BACKFILL DE PESSOAS ==\n");

  const cargos = await prisma.cargo.findMany();
  const porNome = new Map(cargos.map((c) => [c.nome, c]));
  if (porNome.size === 0) {
    throw new Error(
      "Nenhum cargo cadastrado. Rode a migration 20260804170000_pessoas_e_cargos antes.",
    );
  }

  /* ---------- 1. Professores, a partir do texto livre das classes ---------- */
  const classes = await prisma.classe.findMany({
    select: { id: true, congId: true, prof: true, nome: true },
  });

  const candidatos = new Map<string, Candidato>();
  const descartados: string[] = [];

  for (const classe of classes) {
    const bruto = classe.prof?.trim();
    if (!bruto) continue;

    if (NAO_E_PESSOA.some((p) => p.test(bruto))) {
      descartados.push(`${bruto}  (classe ${classe.id} — ${classe.nome})`);
      continue;
    }

    for (const pedaco of separarPessoas(bruto)) {
      const { tratamento, nome } = separarTratamento(pedaco);
      const chave = normalizar(nome);
      if (!chave) continue;

      const existente = candidatos.get(chave);
      if (existente) {
        existente.vinculos.push({ classeId: classe.id, congId: classe.congId, origem: bruto });
        // Um registro com tratamento vale mais que um sem: "Aux. Silverio"
        // informa mais do que "Silvério".
        existente.tratamento ??= tratamento;
      } else {
        candidatos.set(chave, {
          nome,
          tratamento,
          chave,
          vinculos: [{ classeId: classe.id, congId: classe.congId, origem: bruto }],
        });
      }
    }
  }

  /* ---------- 2. Suspeitas de duplicidade — marcadas, nunca fundidas ------- */
  const chaves = [...candidatos.keys()];
  const suspeitas = new Map<string, string[]>();

  const anotar = (a: string, b: string, motivo: string) => {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      const lista = suspeitas.get(x) ?? [];
      lista.push(`${motivo}: "${candidatos.get(y)!.nome}"`);
      suspeitas.set(x, lista);
    }
  };

  for (let i = 0; i < chaves.length; i++) {
    for (let j = i + 1; j < chaves.length; j++) {
      const a = chaves[i];
      const b = chaves[j];

      // "ana costa" dentro de "ana maria da costa": mesmo primeiro e ultimo nome.
      const ta = a.split(" ");
      const tb = b.split(" ");
      if (ta[0] === tb[0] && ta.at(-1) === tb.at(-1) && a !== b) {
        anotar(a, b, "pode ser a mesma pessoa que");
        continue;
      }
      // Erro de digitacao: "magalhaes" / "magslhaes".
      if (Math.abs(a.length - b.length) <= 2 && a.length >= 8 && distancia(a, b) <= 2) {
        anotar(a, b, "grafia muito parecida com");
      }
    }
  }

  /* ---------- 3. Gravacao ---------- */
  const cargoProfessor = porNome.get("Professor")!;
  let pessoasCriadas = 0;
  let vinculosCriados = 0;

  for (const c of candidatos.values()) {
    const motivos = suspeitas.get(c.chave);
    const dados = {
      nome: c.nome,
      tratamento: c.tratamento,
      chave: c.chave,
      revisar: Boolean(motivos),
      observacao: motivos ? motivos.join(" · ") : null,
    };

    if (DRY) {
      pessoasCriadas++;
      vinculosCriados += c.vinculos.length;
      continue;
    }

    // `upsert` pela chave: rodar de novo nao duplica ninguem.
    const pessoa = await prisma.pessoa.upsert({
      where: { chave: c.chave },
      create: dados,
      update: { tratamento: dados.tratamento ?? undefined },
    });
    pessoasCriadas++;

    for (const v of c.vinculos) {
      await garantirVinculo({
        pessoaId: pessoa.id,
        cargoId: cargoProfessor.id,
        congId: v.congId,
        classeId: v.classeId,
        origem: v.origem,
      });
      vinculosCriados++;
    }
  }

  /* ---------- 4. Lideranca do campo ---------- */
  let lideresCriados = 0;
  for (const l of LIDERANCA) {
    const cargo = porNome.get(l.cargo);
    if (!cargo) {
      console.warn(`  ! cargo "${l.cargo}" nao existe — pulado`);
      continue;
    }
    const chave = normalizar(l.nome);
    if (DRY) {
      lideresCriados++;
      continue;
    }

    const pessoa = await prisma.pessoa.upsert({
      where: { chave },
      create: { nome: l.nome, tratamento: l.tratamento, chave },
      update: { tratamento: l.tratamento },
    });
    // Cargo de campo: congId e classeId nulos — ver `garantirVinculo`.
    await garantirVinculo({ pessoaId: pessoa.id, cargoId: cargo.id });
    lideresCriados++;
  }

  /* ---------- 5. Relatorio ---------- */
  console.log(`Classes com professor preenchido ..... ${classes.filter((c) => c.prof?.trim()).length}`);
  console.log(`Textos distintos em Classes.prof ..... ${new Set(classes.map((c) => c.prof?.trim()).filter(Boolean)).size}`);
  console.log(`PESSOAS unicas ....................... ${pessoasCriadas}`);
  console.log(`Cargos de professor ocupados ......... ${vinculosCriados}`);
  console.log(`Lideranca do campo ................... ${lideresCriados}`);

  if (descartados.length > 0) {
    console.log(`\nDescartados por nao serem pessoa (${descartados.length}):`);
    for (const d of descartados) console.log(`  · ${d}`);
  }

  const paraRevisar = [...candidatos.values()].filter((c) => suspeitas.has(c.chave));
  if (paraRevisar.length > 0) {
    console.log(`\nMARCADOS PARA REVISAO HUMANA (${paraRevisar.length}) — nao foram fundidos:`);
    for (const c of paraRevisar) {
      console.log(`  · ${c.nome}  →  ${suspeitas.get(c.chave)!.join(" · ")}`);
    }
    console.log(
      "\n  Estes ficam com `revisar = true` em Pessoas. A secretaria decide se sao\n" +
        "  a mesma pessoa; o sistema nao decide por ela.",
    );
  }

  if (DRY) console.log("\n(simulacao — nada foi gravado)\n");
  else console.log("\nPronto.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
