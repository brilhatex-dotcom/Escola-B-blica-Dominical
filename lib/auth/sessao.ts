import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SESSAO_HORAS } from "@/lib/config";
import {
  escopoDe,
  papelHerdado,
  podeGravar as papelPodeGravar,
  podeVer as papelPodeVer,
  type Escopo,
  type Papel,
} from "./papeis";

/**
 * Sessão do usuário — um JWT assinado, guardado num cookie httpOnly.
 *
 * POR QUE COOKIE httpOnly, e não localStorage: JavaScript não consegue ler um
 * cookie httpOnly. Se um dia entrar um script de terceiro na página, ele não
 * tem como levar a sessão embora. Em `localStorage`, qualquer script da página
 * lê tudo.
 *
 * POR QUE JWT, e não sessão no banco: cada consulta de sessão seria uma ida ao
 * Postgres, em toda navegação, de todo aparelho da igreja num domingo de manhã.
 * O JWT é verificado por assinatura, sem consultar nada.
 *
 * O PREÇO do JWT é que ele não dá para revogar antes de expirar — daí a
 * validade curta (8 horas, o tempo de um domingo) em vez dos 30 dias comuns.
 */

const COOKIE = "ebd_sessao";
const HORAS = SESSAO_HORAS;

export interface Sessao {
  id: number;
  login: string;
  nome: string;
  /** O `perfil` COMO VEIO da planilha. Não é reescrito e não decide acesso sozinho. */
  perfil: string;
  congId: number | null;
  /** `true` enquanto a senha ainda estiver no formato herdado. */
  precisaTrocar: boolean;

  /*
   * O ACESSO viaja dentro da sessão.
   *
   * Ele é apurado uma vez, no login (ver lib/auth/acesso.ts), e não a cada
   * navegação: decidir permissão consultando o banco significaria uma ida ao
   * Postgres por clique, de todo aparelho da igreja, num domingo de manhã.
   *
   * Como o JWT é assinado, o navegador não consegue alterar estes campos — um
   * cookie adulterado para dizer "pastor-presidente" não passa na verificação
   * de assinatura e é tratado como sessão inexistente.
   */
  papeis: Papel[];
  /** Congregações que este acesso enxerga. Vazio quando o escopo é o campo. */
  congIds: number[];
  escopo: Escopo;
  /** `true` quando o papel foi deduzido do perfil herdado, e não de um cargo. */
  presumido: boolean;
}

/**
 * O segredo que assina as sessões.
 *
 * Sem ele NÃO existe autenticação: qualquer pessoa poderia forjar um cookie
 * dizendo-se administrador. Por isso não há valor padrão no código — um padrão
 * seria idêntico a não ter segredo nenhum, com a agravante de parecer seguro.
 */
export function temSegredo(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);
}

function segredo(): Uint8Array {
  const bruto = process.env.AUTH_SECRET;
  if (!bruto || bruto.length < 32) {
    throw new Error(
      "AUTH_SECRET ausente ou curta demais (mínimo 32 caracteres). " +
        "Sem ela não há como assinar a sessão.",
    );
  }
  return new TextEncoder().encode(bruto);
}

export async function criarSessao(dados: Sessao): Promise<void> {
  const token = await new SignJWT({ ...dados })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${HORAS}h`)
    .sign(segredo());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    // `secure` só em produção: em desenvolvimento o endereço é http, e um
    // cookie `secure` simplesmente não seria gravado — o login "funcionaria"
    // e a sessão sumiria, sem erro nenhum para explicar.
    secure: process.env.NODE_ENV === "production",
    // `lax` deixa o cookie viajar na navegação normal, mas não numa requisição
    // disparada por outro site — que é a defesa contra CSRF nas rotas de escrita.
    sameSite: "lax",
    path: "/",
    maxAge: HORAS * 3600,
  });
}

export async function lerSessao(): Promise<Sessao | null> {
  if (!temSegredo()) return null;

  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, segredo());
    const perfil = String(payload.perfil);

    /*
     * Sessões emitidas ANTES desta fase não trazem papéis.
     *
     * Elas continuam válidas por até 8 horas, e recusá-las deslogaria metade da
     * igreja no instante da publicação — possivelmente no meio de uma chamada.
     * Sem papéis no cookie, o acesso é deduzido do perfil herdado, exatamente
     * como acontece com uma conta sem cargo atribuído.
     */
    const papeis = Array.isArray(payload.papeis)
      ? (payload.papeis as Papel[])
      : [papelHerdado(perfil)];

    const congId = payload.congId === null || payload.congId === undefined
      ? null
      : Number(payload.congId);

    const escopo: Escopo = payload.escopo === "campo" || payload.escopo === "congregacao"
      ? payload.escopo
      : escopoDe(papeis);

    return {
      id: Number(payload.id),
      login: String(payload.login),
      nome: String(payload.nome),
      perfil,
      congId,
      precisaTrocar: Boolean(payload.precisaTrocar),
      papeis,
      congIds: Array.isArray(payload.congIds)
        ? (payload.congIds as number[])
        : escopo === "campo" || congId === null
          ? []
          : [congId],
      escopo,
      presumido: payload.presumido === undefined ? true : Boolean(payload.presumido),
    };
  } catch {
    // Assinatura inválida ou expirada: o mesmo resultado de não ter sessão.
    return null;
  }
}

export async function encerrarSessao(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/**
 * Enxerga o campo inteiro?
 *
 * A pergunta é feita ao ESCOPO, e não mais ao `perfil` da planilha. Aquele
 * campo tem dois valores para dezenove contas e não sabe distinguir um
 * Supervisor de um Professor — usá-lo para decidir alcance dava a todo mundo,
 * fora as duas contas `master`, exatamente a mesma visão.
 */
export function podeVerTudo(sessao: Sessao | null): boolean {
  return sessao?.escopo === "campo";
}

/**
 * Sem sessão, tudo é permitido — e isso é deliberado.
 *
 * Só existe "sem sessão" quando `AUTH_SECRET` não está definida no servidor, e
 * nesse estado o portal inteiro já está aberto (ver lib/auth/guarda.ts). Esconder
 * módulos aqui não protegeria nada: bastaria digitar o endereço. Produziria
 * apenas a ilusão de proteção, que é pior do que a tarja vermelha dizendo a
 * verdade no painel.
 */
export function sessaoPodeVer(sessao: Sessao | null, chave: string): boolean {
  if (!sessao) return true;
  return papelPodeVer(sessao.papeis, chave);
}

export function sessaoPodeGravar(sessao: Sessao | null, chave: string): boolean {
  if (!sessao) return true;
  return papelPodeGravar(sessao.papeis, chave);
}
