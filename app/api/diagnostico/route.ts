import { NextResponse } from "next/server";
import { prisma, nomeDaVariavel, temBanco } from "@/lib/prisma";

/**
 * Diagnóstico da conexão com o banco.
 *
 * POR QUE EXISTE: quando o painel cai na demonstração, as duas perguntas que
 * ninguém consegue responder de fora são "o app achou a variável de conexão?" e
 * "ela aponta para o MESMO banco onde o SQL foi aplicado?". Sem uma resposta,
 * resta comparar telas e adivinhar — foi exatamente o que aconteceu aqui: o
 * Neon mostrava 59 pessoas e o app dizia que a tabela não existia.
 *
 * O QUE ELE NÃO MOSTRA: usuário, senha e a URL completa. O host sozinho não
 * abre nada — o Neon exige usuário, senha e TLS — e é justamente o que precisa
 * ser comparado com o endereço que aparece no painel do Neon.
 *
 * Abra em: /api/diagnostico
 */
export const dynamic = "force-dynamic";

/** Extrai só o endereço, jogando fora as credenciais. */
function hostDaUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function urlEmUso(): string | undefined {
  const nome = nomeDaVariavel();
  return nome ? process.env[nome] : undefined;
}

export async function GET() {
  const variavel = nomeDaVariavel();
  const host = hostDaUrl(urlEmUso());

  if (!temBanco()) {
    return NextResponse.json({
      conectado: false,
      variavel: null,
      host: null,
      diagnostico:
        "Nenhuma variável de conexão encontrada. Verifique, nas variáveis de " +
        "ambiente da Vercel, se existe alguma terminando em DATABASE_URL ou " +
        "POSTGRES_PRISMA_URL.",
      // Ajuda a achar a variável quando ela existe com outro nome: lista só os
      // NOMES, nunca os valores.
      variaveisParecidas: Object.keys(process.env)
        .filter((k) => /POSTGRES|DATABASE|NEON|PG/.test(k))
        .sort(),
    });
  }

  try {
    /*
     * `current_database()` e `current_schema()` respondem a pergunta que
     * importa: NAO e "existe um banco?", e sim "e ESTE o banco?". Um projeto no
     * Neon pode ter varias branches, cada uma com o seu proprio `neondb`, e a
     * aplicacao pode estar apontando para uma branch diferente daquela onde o
     * SQL foi colado. Nesse caso tudo parece certo dos dois lados.
     */
    const [info] = await prisma.$queryRaw<
      Array<{ banco: string; esquema: string; versao: string }>
    >`SELECT current_database() AS banco, current_schema() AS esquema, version() AS versao`;

    /*
     * Existencia primeiro, contagem depois.
     *
     * `to_regclass` devolve NULL quando a tabela nao existe, em vez de lancar
     * erro — que e o que um `count(*)` faria, derrubando o diagnostico
     * justamente no caso que ele foi feito para diagnosticar.
     */
    const existentes = await prisma.$queryRaw<Array<{ nome: string; existe: boolean }>>`
      SELECT t.nome, to_regclass(quote_ident(t.nome)) IS NOT NULL AS existe
      FROM (VALUES ('Alunos'), ('Classes'), ('Pessoas'), ('Cargos'), ('PessoaCargos')) AS t(nome)
    `;

    const encontradas: Record<string, number | string> = {};
    for (const t of existentes) {
      if (!t.existe) {
        encontradas[t.nome] = "não existe";
        continue;
      }
      const [linha] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        // O nome vem da lista fixa acima, nunca da requisicao — nao ha entrada
        // do usuario neste caminho.
        `SELECT count(*)::bigint AS n FROM "${t.nome}"`,
      );
      encontradas[t.nome] = Number(linha.n);
    }

    const temPessoas = typeof encontradas["Pessoas"] === "number";

    return NextResponse.json({
      conectado: true,
      variavel,
      host,
      banco: info.banco,
      esquema: info.esquema,
      postgres: info.versao.split(" ").slice(0, 2).join(" "),
      tabelas: encontradas,
      diagnostico: temPessoas
        ? "Tudo certo: o app está no mesmo banco onde a Fase 05 foi aplicada."
        : "CONECTADO NO BANCO ERRADO (ou o SQL da Fase 05 não foi aplicado NESTE banco). " +
          "Compare o `host` acima com o endereço que aparece em Neon → Connect. " +
          "Se forem diferentes, o SQL foi colado numa branch e o app está lendo outra.",
    });
  } catch (erro) {
    return NextResponse.json({
      conectado: false,
      variavel,
      host,
      diagnostico: "A variável existe, mas a conexão falhou. Veja `motivo`.",
      motivo: erro instanceof Error ? erro.message : String(erro),
    });
  }
}
