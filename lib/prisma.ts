import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma unico.
 *
 * O `globalThis` nao e gambiarra: em desenvolvimento o Next recarrega os
 * modulos a cada alteracao de arquivo, e um `new PrismaClient()` no topo criaria
 * uma conexao nova a cada salvamento. Em poucos minutos o Postgres recusa
 * conexao por esgotamento do pool — e o erro aparece longe daqui, parecendo
 * problema de banco.
 *
 * Em producao o modulo e avaliado uma vez e a variavel global nem chega a ser
 * usada.
 */

/**
 * Nomes possiveis da variavel de conexao.
 *
 * POR QUE NAO BASTA `DATABASE_URL`: a integracao do Neon com a Vercel nomeia a
 * variavel conforme o tipo de conexao — `POSTGRES_PRISMA_URL` na integracao
 * antiga, `DATABASE_URL` na nativa — e ainda permite um PREFIXO escolhido na
 * instalacao, de modo que ela pode chegar como `STORAGE_DATABASE_URL`.
 *
 * Exigir o nome exato transformaria um detalhe de instalacao num defeito
 * silencioso: o portal publicaria normalmente, sem erro nenhum, e mostraria
 * dados de demonstracao para sempre porque nao achou uma variavel que estava
 * ali o tempo todo com outro nome.
 *
 * Sao SUFIXOS, comparados pelo fim do nome — e nao se confundem entre si:
 * "DATABASE_URL" nao casa com "DATABASE_URL_UNPOOLED".
 */
const SUFIXOS = ["POSTGRES_PRISMA_URL", "DATABASE_URL", "POSTGRES_URL"];

/**
 * Escolha manual, acima de tudo.
 *
 * A integracao Neon+Vercel CRIA e mantem as variaveis dela, e pode criar um
 * projeto Neon novo e vazio no processo — foi o que aconteceu aqui: o app
 * apontava para um banco em sa-east-1 sem uma linha sequer, enquanto os dados
 * estavam noutro projeto, em us-east-1.
 *
 * Disputar o nome com a integracao e perder: ela reescreve. `EBD_DATABASE_URL`
 * e uma variavel que so nos usamos, entao ela sobrevive a qualquer atualizacao
 * da integracao — e diz, em uma linha, "e este banco, e nao o que voce achou".
 */
const OVERRIDE = "EBD_DATABASE_URL";

function acharUrl(): string | undefined {
  const manual = process.env[OVERRIDE];
  if (manual?.startsWith("postgres")) return manual;

  for (const sufixo of SUFIXOS) {
    if (process.env[sufixo]?.startsWith("postgres")) return process.env[sufixo];

    const comPrefixo = Object.keys(process.env).find(
      (k) => k.endsWith(`_${sufixo}`) && process.env[k]?.startsWith("postgres"),
    );
    if (comPrefixo) return process.env[comPrefixo];
  }
  return undefined;
}

/**
 * Marca a conexao como vinda de um pooler.
 *
 * O endereco do Neon terminado em `-pooler` e um PgBouncer em modo transacao,
 * que NAO mantem estado entre comandos. O Prisma, por padrao, cria prepared
 * statements — e o segundo uso de um deles cai em "prepared statement s0
 * already exists", um erro que aparece de forma intermitente, sob carga, e
 * some quando se vai investigar.
 *
 * `pgbouncer=true` desliga isso. So e acrescentado quando o host realmente e um
 * pooler e quando o parametro ainda nao esta la.
 */
function prepararUrl(bruta: string | undefined): string | undefined {
  if (!bruta) return undefined;
  try {
    const u = new URL(bruta);
    if (u.host.includes("-pooler") && !u.searchParams.has("pgbouncer")) {
      u.searchParams.set("pgbouncer", "true");
    }
    return u.toString();
  } catch {
    // String estranha: devolve como veio e deixa o Prisma reclamar com a
    // mensagem dele, que e mais util do que uma nossa.
    return bruta;
  }
}

const url = prepararUrl(acharUrl());

const global_ = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  global_.prisma ??
  new PrismaClient({
    // `datasources` sobrepoe o `env("DATABASE_URL")` do schema.prisma. E o que
    // permite o app subir com a variavel chamada de outro jeito — sem isso, o
    // Prisma so olharia para o nome literal escrito no schema.
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") global_.prisma = prisma;

/**
 * O banco esta configurado?
 *
 * Serve para as telas decidirem entre dados reais e o conjunto de demonstracao.
 * Sem string de conexao o Prisma nem se conecta, e vale dizer isso na tela em
 * vez de deixar cair numa pagina de erro.
 */
export function temBanco(): boolean {
  return Boolean(url);
}

/** Nome da variavel que foi usada. So para diagnostico — nunca expor a URL. */
export function nomeDaVariavel(): string | null {
  if (process.env[OVERRIDE]?.startsWith("postgres")) return OVERRIDE;
  for (const sufixo of SUFIXOS) {
    if (process.env[sufixo]?.startsWith("postgres")) return sufixo;
    const comPrefixo = Object.keys(process.env).find(
      (k) => k.endsWith(`_${sufixo}`) && process.env[k]?.startsWith("postgres"),
    );
    if (comPrefixo) return comPrefixo;
  }
  return null;
}
