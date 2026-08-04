import { NextResponse } from "next/server";
import { lerPainel } from "@/lib/dashboard/consultas";
import { painelDeExemplo } from "@/lib/dashboard/dados";
import { nomeDaVariavel, temBanco } from "@/lib/prisma";
import type { CausaDaDemonstracao } from "@/lib/dashboard/tipos";

/**
 * Classifica POR QUE caiu na demonstracao.
 *
 * Sem isso, a tela so podia dizer "o banco não respondeu" — verdadeiro e
 * inútil. As duas causas possiveis pedem acoes completamente diferentes: uma
 * se resolve no painel da Vercel, a outra no SQL Editor do Neon. Um aviso que
 * nao distingue as duas obriga a tentar as duas as cegas.
 *
 * A classificacao e feita AQUI, no servidor, e nao na tela lendo o texto do
 * erro: mensagem de excecao muda entre versoes do Prisma, e uma tela que
 * depende de casar texto quebra em silencio na primeira atualizacao.
 */
function classificar(erro: unknown): CausaDaDemonstracao {
  if (!temBanco()) return "sem-variavel";

  const texto = erro instanceof Error ? erro.message : String(erro);
  // P2021 = tabela nao existe; P2022 = coluna nao existe. Os dois significam a
  // mesma coisa aqui: o SQL da Fase 05 ainda nao foi aplicado.
  if (/P2021|P2022|does not exist|não existe/i.test(texto)) return "sem-tabelas";
  return "outro";
}

/**
 * Os dados do Dashboard.
 *
 * `force-dynamic` porque o painel mostra o domingo de HOJE. Numa rota estatica,
 * o Next serviria para sempre o quadro do momento do build — a igreja abriria o
 * sistema em setembro e veria a chamada de agosto.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await lerPainel());
  } catch (erro) {
    /*
     * SEM BANCO, O PAINEL AINDA ABRE — MAS DIZ QUE E DEMONSTRACAO.
     *
     * Este caminho existe por uma razao concreta: a migration de pessoas e
     * cargos ainda pode nao ter sido aplicada no Neon. Sem a reserva, o portal
     * publicado quebraria inteiro no instante em que esta versao subisse.
     *
     * O que ele NAO faz e mentir. A resposta vem marcada com `origem:
     * "exemplo"` e a tela mostra o aviso. Um painel que exibe numeros
     * inventados sem avisar e pior do que um painel fora do ar: a secretaria
     * fecha o relatorio do domingo com dados que nao existem.
     */
    console.error("[painel] caindo para os dados de exemplo:", erro);
    return NextResponse.json({
      ...(await painelDeExemplo()),
      causa: classificar(erro),
      // Nome da variavel encontrada — nunca a URL, que carrega a senha do banco.
      variavel: nomeDaVariavel(),
      motivo: erro instanceof Error ? erro.message : String(erro),
    });
  }
}
