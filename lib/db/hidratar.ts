import { receberDoServidor } from "./repositorio";
import { temBancoLocal } from "./local";
import type { Aluno, Classe, Congregacao, Visitante } from "./schema";

/**
 * A descida: puxa o espelho do servidor para o IndexedDB.
 *
 * É o par da fila de sincronização. A fila SOBE o que foi gravado offline; esta
 * função BAIXA os cadastros que a busca e a chamada precisam quando a rede cai.
 *
 * Roda no navegador, quando há conexão. `receberDoServidor` preserva qualquer
 * registro local ainda não sincronizado, então baixar por cima nunca apaga a
 * chamada de hoje que ainda está na fila.
 *
 * Falha em silêncio de propósito: sem internet, ou com o `/api/sincronizar`
 * fora do ar, o espelho antigo continua valendo. Um erro aqui não pode quebrar
 * o painel — a descida é uma comodidade, não um pré-requisito para abrir a tela.
 */

interface Descida {
  congregacoes: Array<Omit<Congregacao, "estado" | "alteradoEm">>;
  classes: Array<Omit<Classe, "estado" | "alteradoEm">>;
  alunos: Array<Omit<Aluno, "estado" | "alteradoEm">>;
  visitantes: Array<Omit<Visitante, "estado" | "alteradoEm">>;
}

let baixandoAgora: Promise<boolean> | null = null;

export function hidratarCacheLocal(): Promise<boolean> {
  // Uma descida por vez: o painel dispara em vários lugares (foco, online,
  // intervalo), e três chamadas simultâneas gravariam o mesmo dado três vezes.
  if (baixandoAgora) return baixandoAgora;
  baixandoAgora = executar().finally(() => {
    baixandoAgora = null;
  });
  return baixandoAgora;
}

async function executar(): Promise<boolean> {
  if (typeof window === "undefined" || !temBancoLocal()) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;

  try {
    const res = await fetch("/api/sincronizar", { cache: "no-store" });
    if (!res.ok) return false;
    const dados = (await res.json()) as Descida;

    await Promise.all([
      receberDoServidor<Congregacao>("congregacoes", dados.congregacoes ?? []),
      receberDoServidor<Classe>("classes", dados.classes ?? []),
      receberDoServidor<Aluno>("alunos", dados.alunos ?? []),
      receberDoServidor<Visitante>("visitantes", dados.visitantes ?? []),
    ]);
    return true;
  } catch {
    return false;
  }
}
