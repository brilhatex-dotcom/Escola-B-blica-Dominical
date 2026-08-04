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
const global_ = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  global_.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") global_.prisma = prisma;

/**
 * O banco esta configurado?
 *
 * Serve para as telas decidirem entre dados reais e o conjunto de demonstracao.
 * Sem `DATABASE_URL` o Prisma nem se conecta, e vale dizer isso na tela em vez
 * de deixar cair numa pagina de erro.
 */
export function temBanco(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
