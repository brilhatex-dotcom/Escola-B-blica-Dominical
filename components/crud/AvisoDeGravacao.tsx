"use client";

import { Check, X } from "lucide-react";

/**
 * O que o servidor respondeu sobre a última gravação.
 *
 * Ele PODE ser fechado, ao contrário da tarja de segurança do painel — e a
 * diferença é proposital: aquela descreve o estado do sistema e some sozinha
 * quando a causa acaba; esta é o recado de uma ação que a pessoa acabou de
 * fazer, e depois de lida não tem mais serventia.
 */
export function AvisoDeGravacao({
  mensagem,
  aoFechar,
}: {
  mensagem: string | null;
  aoFechar: () => void;
}) {
  if (!mensagem) return null;

  return (
    <div
      role="status"
      className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-[0.82rem] text-emerald-200"
    >
      <Check className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{mensagem}</span>
      <button
        type="button"
        onClick={aoFechar}
        aria-label="Fechar aviso"
        className="shrink-0 rounded-md p-0.5 text-emerald-200/60 transition-colors duration-300 hover:text-emerald-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
