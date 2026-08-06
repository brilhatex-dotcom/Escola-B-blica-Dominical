"use client";

import { useCallback, useState } from "react";

/**
 * O gravar-e-recarregar que toda tela de cadastro repete.
 *
 * ============================================================================
 * O QUE ESTE GANCHO EXISTE PARA PADRONIZAR
 *
 * São nove telas de cadastro no portal. Escrita à mão, cada uma acaba com o seu
 * jeito de tratar erro do servidor — uma mostra a mensagem que veio, outra
 * mostra "erro ao salvar", uma terceira não mostra nada e deixa o modal aberto
 * como se estivesse pensando.
 *
 * E há um detalhe que quase sempre se perde: a resposta da EXCLUSÃO diz se o
 * registro foi apagado de vez ou apenas arquivado. Uma tela que responde
 * "excluído" e deixa o aluno na lista de inativos, sem avisar, ensina a não
 * confiar no botão. Aqui a mensagem do servidor é sempre repassada.
 * ============================================================================
 */

export interface Crud {
  /** Mensagem do servidor sobre a última gravação — some ao fechar. */
  aviso: string | null;
  limparAviso: () => void;
  /** Muda a cada gravação; ponha nas dependências do `useEffect` que carrega. */
  recarga: number;
  /**
   * Devolve a mensagem de erro quando falha, e `undefined` quando grava —
   * exatamente o que o `FormularioModal` espera para decidir se fecha.
   */
  gravar: (url: string, metodo: string, corpo?: unknown) => Promise<string | void>;
}

export function useCrud(): Crud {
  const [aviso, setAviso] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  const gravar = useCallback(
    async (url: string, metodo: string, corpo: unknown = {}): Promise<string | void> => {
      try {
        const res = await fetch(url, {
          method: metodo,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        });
        const dados = await res.json().catch(() => ({}));

        /*
         * A mensagem do SERVIDOR vence a genérica.
         *
         * "Esta lição já foi ministrada por 3 classes" diz o que fazer;
         * "não foi possível salvar" manda tentar de novo para sempre.
         */
        if (!res.ok) return dados.erro ?? "Não foi possível salvar.";

        if (dados.mensagem) setAviso(dados.mensagem);
        setRecarga((n) => n + 1);
      } catch {
        return "Sem resposta do servidor. Verifique a conexão.";
      }
    },
    [],
  );

  return { aviso, limparAviso: () => setAviso(null), recarga, gravar };
}
