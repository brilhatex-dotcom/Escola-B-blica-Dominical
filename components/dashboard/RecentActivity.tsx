"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  ChartColumn,
  Check,
  UserPlus,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tempoRelativo } from "@/lib/dashboard/formato";
import type { Atividade, TipoAtividade } from "@/lib/dashboard/tipos";

/**
 * Atividades recentes, em linha do tempo.
 *
 * O FIO VERTICAL E O QUE FAZ ISSO SER UMA LINHA DO TEMPO, e nao uma lista com
 * icones: ele diz que os itens sao um encadeamento no tempo, nao opcoes
 * paralelas. Ele para no penultimo item de proposito — descer alem do ultimo
 * ponto sugere que ha mais coisa abaixo, e nao ha.
 *
 * O tempo e relativo ("há 4 min") porque quem olha quer saber se acabou de
 * acontecer. "09:42" obriga a fazer a conta de cabeca.
 */

export interface RecentActivityProps {
  atividades: Atividade[];
  className?: string;
}

const APARENCIA: Record<TipoAtividade, { icone: LucideIcon; cor: string; anel: string }> = {
  presenca: { icone: Check, cor: "text-emerald-300", anel: "ring-emerald-400/25 bg-emerald-500/10" },
  visitante: { icone: UserRoundPlus, cor: "text-gold-300", anel: "ring-gold-400/25 bg-gold-400/10" },
  classe: { icone: BookOpen, cor: "text-brand-200", anel: "ring-brand-400/25 bg-brand-500/12" },
  relatorio: { icone: ChartColumn, cor: "text-brand-100", anel: "ring-brand-300/20 bg-white/[0.06]" },
  cadastro: { icone: UserPlus, cor: "text-brand-200", anel: "ring-brand-400/25 bg-brand-500/12" },
};

export function RecentActivity({ atividades, className }: RecentActivityProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn("glass-panel relative overflow-hidden rounded-2xl p-5", className)}
      aria-labelledby="titulo-atividades"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2
          id="titulo-atividades"
          className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white"
        >
          Atividades recentes
        </h2>
        <span className="shrink-0 text-[0.7rem] text-brand-200/45">hoje</span>
      </header>

      {atividades.length === 0 ? (
        <p className="py-6 text-center text-[0.8rem] text-brand-200/50">
          Nenhuma atividade registrada ainda hoje.
        </p>
      ) : (
        <ol className="relative">
          {atividades.map((a, i) => {
            const { icone: Icone, cor, anel } = APARENCIA[a.tipo];
            const ultimo = i === atividades.length - 1;

            return (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.55, delay: 0.28 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                {/* Fio da linha do tempo */}
                {!ultimo && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[0.875rem] top-8 h-[calc(100%-1.25rem)] w-px bg-gradient-to-b from-white/12 to-white/[0.04]"
                  />
                )}

                <span
                  className={cn(
                    "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1",
                    anel,
                  )}
                >
                  <Icone className={cn("h-3.5 w-3.5", cor)} />
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[0.82rem] leading-snug text-brand-50">
                    <span className="font-medium text-white">{a.autor}</span>{" "}
                    <span className="text-brand-100/75">{a.descricao}</span>
                  </p>
                  <p className="mt-0.5 text-[0.7rem] tabular-nums text-brand-200/45">
                    {tempoRelativo(a.quando)}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </motion.section>
  );
}
