"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Etapa } from "./tipos";

const PASSOS: { chave: Etapa; rotulo: string }[] = [
  { chave: "congregacao", rotulo: "Congregação" },
  { chave: "trimestre", rotulo: "Trimestre" },
  { chave: "quantidades", rotulo: "Quantidades" },
  { chave: "revisao", rotulo: "Revisão" },
];

/** Onde a pessoa está no assistente — os passos já percorridos ficam marcados, nunca escondidos. */
export function IndicadorEtapas({ atual }: { atual: Etapa }) {
  const indiceAtual = PASSOS.findIndex((p) => p.chave === atual);
  if (indiceAtual === -1) return null;

  return (
    <ol className="mb-6 flex items-center gap-1.5 sm:gap-2">
      {PASSOS.map((p, i) => {
        const concluido = i < indiceAtual;
        const ativo = i === indiceAtual;
        return (
          <li key={p.chave} className="flex flex-1 items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold transition-colors duration-300",
                  concluido && "bg-gold-400/90 text-brand-950",
                  ativo && "bg-gold-400/15 text-gold-200 ring-2 ring-gold-400/50",
                  !concluido && !ativo && "bg-white/8 text-brand-300/50",
                )}
              >
                {concluido ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-[0.76rem] sm:inline",
                  ativo ? "text-brand-50" : concluido ? "text-brand-200/70" : "text-brand-300/45",
                )}
              >
                {p.rotulo}
              </span>
            </div>
            {i < PASSOS.length - 1 && (
              <span className={cn("h-px flex-1", concluido ? "bg-gold-400/50" : "bg-white/8")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
