import { NextResponse } from "next/server";
import { lerPainel } from "@/lib/dashboard/consultas";
import { painelDeExemplo } from "@/lib/dashboard/dados";

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
      motivo: erro instanceof Error ? erro.message : String(erro),
    });
  }
}
