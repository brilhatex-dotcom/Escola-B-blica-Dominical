import { NextResponse } from "next/server";
import { EXIGIR_SENHA_PROPRIA_PARA_GRAVAR } from "@/lib/config";
import { filtroDeCongregacao } from "./acesso";
import { podeGravar, podeVer } from "./papeis";
import { lerSessao, temSegredo, type Sessao } from "./sessao";

/**
 * Guarda das rotas.
 *
 * ============================================================================
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
   * A senha herdada e a gravação.
   *
   * As 19 contas do sistema antigo compartilham o mesmo hash — a mesma senha,
   * que meia igreja pode conhecer. O certo é cada pessoa ter a sua, e é o que a
   * reunião da liderança vai resolver; até lá, o interruptor em lib/config.ts
   * decide se isso trava a gravação ou apenas aparece como aviso no painel.
   *
   * Travar antes da reunião pararia a EBD inteira no dia em que a autenticação
   * for ligada. Ver o comentário completo em EXIGIR_SENHA_PROPRIA_PARA_GRAVAR.
   */
  if (sessao.precisaTrocar && EXIGIR_SENHA_PROPRIA_PARA_GRAVAR) {
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

/**
 * Exige que o acesso ENXERGUE um módulo.
 *
 * A chave é a mesma do menu (ver lib/dashboard/navegacao.ts). Uma lista
 * separada de "módulos protegidos" divergiria do menu no primeiro módulo novo,
 * e a divergência apareceria como uma rota aberta que ninguém sabia estar
 * aberta.
 */
export async function exigirLeitura(chave: string): Promise<Autorizacao> {
  const auth = await exigirSessao();
  if (auth.recusa || !auth.sessao) return auth;

  if (!podeVer(auth.sessao.papeis, chave)) {
    return { sessao: auth.sessao, recusa: recusaDeAcesso() };
  }
  return auth;
}

/**
 * Como `exigirLeitura`, mas passa se QUALQUER UMA das chaves for enxergada.
 *
 * Existe para rotas de apoio que servem mais de uma tela com públicos
 * diferentes — por exemplo, `/api/pessoas/candidatos` serve tanto a
 * Hierarquia do campo (chave "professores") quanto Congregações/Classes do
 * Grupo B (chave "congregacoes"/"classes"), e nenhum papel isolado tem as
 * duas. Continua sendo "ver exige ver": quem não enxerga NENHUMA das chaves
 * é recusado.
 */
export async function exigirLeituraDeAlguma(chaves: readonly string[]): Promise<Autorizacao> {
  const auth = await exigirSessao();
  if (auth.recusa || !auth.sessao) return auth;

  if (!chaves.some((chave) => podeVer(auth.sessao!.papeis, chave))) {
    return { sessao: auth.sessao, recusa: recusaDeAcesso() };
  }
  return auth;
}

/** Exige que o acesso possa GRAVAR num módulo. */
export async function exigirEscrita(chave: string): Promise<Autorizacao> {
  const auth = await exigirSessao();
  if (auth.recusa || !auth.sessao) return auth;

  if (!podeGravar(auth.sessao.papeis, chave)) {
    return { sessao: auth.sessao, recusa: recusaDeAcesso() };
  }
  return auth;
}

/**
 * A recusa por falta de permissão é sempre a MESMA mensagem.
 *
 * Dizer "você não pode alterar a liderança, mas pode ver" ensinaria a quem
 * estiver sondando exatamente onde o sistema é permissivo. E para quem está
 * usando de boa-fé, a diferença não muda nada: o caminho é o mesmo — falar com
 * quem administra o campo.
 */
function recusaDeAcesso(): NextResponse {
  return NextResponse.json(
    { erro: "O seu acesso não permite esta operação." },
    { status: 403 },
  );
}

/**
 * O recorte de congregações desta sessão, pronto para um `where` do Prisma.
 *
 * `undefined` significa "não filtre" — é o que sai para quem enxerga o campo, e
 * também para o portal sem autenticação configurada, onde não há sessão de onde
 * tirar recorte nenhum.
 */
export function recorteDaSessao(sessao: Sessao | null): { in: number[] } | undefined {
  return filtroDeCongregacao(sessao);
}

/**
 * Só quem administra o sistema mexe em contas e permissões.
 *
 * Substitui o antigo `exigirMaster`, que perguntava ao campo `perfil` da
 * planilha — um campo com dois valores para dezenove contas, incapaz de
 * distinguir um Supervisor de um Professor.
 */
export async function exigirAdministracao(): Promise<Autorizacao> {
  return exigirEscrita("usuarios");
}
