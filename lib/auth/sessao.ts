import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

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
const HORAS = 8;

export interface Sessao {
  id: number;
  login: string;
  nome: string;
  perfil: string;
  congId: number | null;
  /** `true` enquanto a senha ainda estiver no formato herdado. */
  precisaTrocar: boolean;
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
    return {
      id: Number(payload.id),
      login: String(payload.login),
      nome: String(payload.nome),
      perfil: String(payload.perfil),
      congId: payload.congId === null ? null : Number(payload.congId),
      precisaTrocar: Boolean(payload.precisaTrocar),
    };
  } catch {
    // Assinatura inválida ou expirada: o mesmo resultado de não ter sessão.
    return null;
  }
}

export async function encerrarSessao(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** `master` enxerga o campo inteiro; os demais, só a própria congregação. */
export function podeVerTudo(sessao: Sessao | null): boolean {
  return sessao?.perfil === "master";
}
