import { NextResponse } from "next/server";
import { lerSessao, temSegredo, type Sessao } from "./sessao";

/**
 * Guarda das rotas de escrita.
 *
 * ============================================================================
 * O ESTADO EM QUE ISTO ENTRA: antes desta fase, `/api/chamada` e
 * `/api/lideranca` aceitavam POST de qualquer pessoa que soubesse o endereço.
 * Não havia exploração conhecida porque ninguém sabia os endereços — mas isso
 * não é segurança, é sorte.
 *
 * O CUIDADO PARA NÃO TRANCAR NINGUÉM DO LADO DE FORA: enquanto `AUTH_SECRET`
 * não existir no servidor, não há como verificar sessão nenhuma — e recusar
 * tudo deixaria a igreja sem sistema, sem que ninguém entendesse por quê. Nesse
 * estado a guarda DEIXA PASSAR e registra um aviso no log, e o painel mostra a
 * tarja de "portal desprotegido". É o mesmo grau de abertura de ontem, com a
 * diferença de estar visível.
 *
 * Assim que a variável for definida, a proteção passa a valer sem mais nada a
 * fazer.
 * ============================================================================
 */

export interface Autorizacao {
  sessao: Sessao | null;
  /** Preenchido quando o pedido deve ser recusado. */
  recusa: NextResponse | null;
}

export async function exigirSessao(): Promise<Autorizacao> {
  if (!temSegredo()) {
    console.warn(
      "[guarda] AUTH_SECRET ausente: rota de escrita liberada sem autenticação.",
    );
    return { sessao: null, recusa: null };
  }

  const sessao = await lerSessao();
  if (!sessao) {
    return {
      sessao: null,
      recusa: NextResponse.json(
        { erro: "É preciso entrar no sistema para fazer isto." },
        { status: 401 },
      ),
    };
  }

  /*
   * Quem ainda não trocou a senha herdada NÃO escreve.
   *
   * As 19 contas do sistema antigo compartilham o mesmo hash — ou seja, a mesma
   * senha, que meia igreja pode saber. Permitir gravar chamada com ela é o
   * mesmo que não ter autenticação. Ler é liberado; escrever exige uma senha
   * que seja de fato de uma pessoa.
   */
  if (sessao.precisaTrocar) {
    return {
      sessao,
      recusa: NextResponse.json(
        {
          erro: "Troque a senha antes de gravar alterações.",
          precisaTrocar: true,
        },
        { status: 403 },
      ),
    };
  }

  return { sessao, recusa: null };
}

/** Só o perfil `master` altera a estrutura do campo. */
export async function exigirMaster(): Promise<Autorizacao> {
  const auth = await exigirSessao();
  if (auth.recusa) return auth;

  // Sem autenticação configurada não há perfil para conferir; a mesma decisão
  // de `exigirSessao` vale aqui.
  if (!auth.sessao) return auth;

  if (auth.sessao.perfil !== "master") {
    return {
      sessao: auth.sessao,
      recusa: NextResponse.json(
        { erro: "Somente a administração do campo pode alterar isto." },
        { status: 403 },
      ),
    };
  }
  return auth;
}
