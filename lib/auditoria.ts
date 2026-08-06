import { prisma } from "@/lib/prisma";
import type { Sessao } from "@/lib/auth/sessao";

/**
 * O registro do que o portal faz.
 *
 * ============================================================================
 * A AUDITORIA NUNCA DERRUBA A OPERAÇÃO QUE ELA ESTÁ REGISTRANDO
 *
 * `registrar` não lança e não é esperado com `await` dentro da transação. É
 * deliberado, e é a decisão mais importante deste arquivo.
 *
 * Se a gravação do log participasse da transação da chamada, um problema no
 * log — coluna faltando, sequência não criada, banco momentaneamente lento —
 * desfaria a chamada de uma classe inteira num domingo de manhã. O professor
 * veria "não foi possível gravar" sem nenhuma pista, e o motivo real seria o
 * REGISTRO da gravação, não a gravação.
 *
 * A troca é consciente: numa falha rara, perde-se uma linha de auditoria em vez
 * de perder a chamada. Auditoria com um buraco continua útil; chamada perdida
 * não volta.
 *
 * Por isso também o `catch` engole o erro e apenas avisa no log do servidor —
 * inclusive enquanto `prisma/aplicar-fase-12.sql` não tiver sido aplicado no
 * banco de produção, quando a coluna `congId` e a sequência do `id` ainda não
 * existem. O portal funciona normalmente; a auditoria só começa a encher
 * depois que o SQL for colado.
 * ============================================================================
 */

/** O verbo. Os mesmos quatro do sistema antigo, para o histórico ficar contínuo. */
export type Acao = "CREATE" | "UPDATE" | "DELETE" | "LOGIN";

export interface Registro {
  sessao: Sessao | null;
  acao: Acao;
  /** O que foi mexido: "Frequencia", "Alunos", "Liderança"… */
  entidade: string;
  /** Uma frase legível por quem não é programador. */
  descricao: string;
  /** Congregação a que a ação se refere, quando há uma. */
  congId?: number | null;
}

/**
 * Quem fez, quando não há sessão.
 *
 * Enquanto `AUTH_SECRET` não estiver definida na Vercel não existe sessão para
 * consultar — e o registro sai como "sem identificação". Escrever "Sistema" ali
 * seria mentira confortável: sugeriria uma rotina automática onde na verdade
 * houve uma pessoa que o portal não teve como identificar. A tela de Logs
 * mostra esse valor sem disfarce, e é ele que justifica a tarja vermelha.
 */
const SEM_SESSAO = { nome: "— sem identificação —", login: "?" };

export function registrar(r: Registro): void {
  const quem = r.sessao
    ? { nome: r.sessao.nome || r.sessao.login, login: r.sessao.login }
    : SEM_SESSAO;

  void prisma.auditoria
    .create({
      data: {
        when: new Date(),
        who: quem.nome,
        whoLogin: quem.login,
        action: r.acao,
        entidade: r.entidade,
        desc: r.descricao,
        congId: r.congId ?? null,
      },
    })
    .catch((e: unknown) => {
      console.warn("[auditoria] não foi possível registrar:", e);
    });
}

/**
 * A auditoria nova já está funcionando neste banco?
 *
 * A tela precisa saber para não repetir "o registro termina na migração" depois
 * que ele deixou de terminar. A pergunta é feita ao banco — existe alguma linha
 * com id acima do último importado? — e não a uma constante do código: o mesmo
 * código roda contra um banco onde o SQL da Fase 12 foi aplicado e contra outro
 * onde não foi.
 */
export const ULTIMO_ID_IMPORTADO = 1671;

export async function jaGravaAuditoria(): Promise<boolean> {
  try {
    const n = await prisma.auditoria.count({ where: { id: { gt: ULTIMO_ID_IMPORTADO } } });
    return n > 0;
  } catch {
    return false;
  }
}
