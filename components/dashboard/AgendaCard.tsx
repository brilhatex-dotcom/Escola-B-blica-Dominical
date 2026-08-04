"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, CalendarDays, Church, PartyPopper, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { diaEMes, hora } from "@/lib/dashboard/formato";
import type { Compromisso, TipoCompromisso } from "@/lib/dashboard/tipos";

/**
 * Proximos compromissos: culto, EBD e eventos.
 *
 * "HOJE" E "AMANHA" SO APARECEM DEPOIS DA MONTAGEM. Comparar com `new Date()`
 * durante a renderizacao do servidor produz um resultado — e o cliente, num
 * fuso diferente ou alguns segundos depois, pode produzir outro. O React
 * descarta a arvore e o cartao pisca. Antes de montar, mostra-se a data
 * completa, que e verdadeira em qualquer fuso; o rotulo relativo entra em
 * seguida, sem mudar a altura da linha.
 */

export interface AgendaCardProps {
  agenda: Compromisso[];
  className?: string;
}

const APARENCIA: Record<TipoCompromisso, { icone: LucideIcon; cor: string; fundo: string }> = {
  culto: { icone: Church, cor: "text-brand-200", fundo: "bg-brand-500/12 ring-brand-400/25" },
  ebd: { icone: BookOpen, cor: "text-gold-300", fundo: "bg-gold-400/10 ring-gold-400/25" },
  evento: { icone: PartyPopper, cor: "text-brand-100", fundo: "bg-white/[0.06] ring-white/12" },
};

const NOME_TIPO: Record<TipoCompromisso, string> = {
  culto: "Culto",
  ebd: "EBD",
  evento: "Evento",
};

/** Diferenca em dias de calendario — 23h50 de ontem para 00h10 de hoje e 1 dia. */
function diasDeDiferenca(a: Date, b: Date): number {
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((dia(a) - dia(b)) / 86_400_000);
}

export function AgendaCard({ agenda, className }: AgendaCardProps) {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => setAgora(new Date()), []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn("glass-panel relative overflow-hidden rounded-2xl p-5", className)}
      aria-labelledby="titulo-agenda"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      <header className="mb-4 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 shrink-0 text-brand-200" />
        <h2
          id="titulo-agenda"
          className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white"
        >
          Agenda
        </h2>
      </header>

      {agenda.length === 0 ? (
        <p className="py-4 text-center text-[0.8rem] text-brand-200/50">
          Nenhum compromisso agendado.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {agenda.map((c, i) => {
            const quando = new Date(c.quando);
            const { icone: Icone, cor, fundo } = APARENCIA[c.tipo];

            const dias = agora ? diasDeDiferenca(quando, agora) : null;
            const rotuloDia =
              dias === null
                ? diaEMes(quando)
                : dias === 0
                  ? "Hoje"
                  : dias === 1
                    ? "Amanhã"
                    : diaEMes(quando);
            const proximo = dias === 0;

            return (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.38 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "flex gap-3 rounded-xl p-2.5 transition-colors duration-300",
                  proximo ? "bg-white/[0.06] ring-1 ring-white/10" : "hover:bg-white/[0.04]",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1",
                    fundo,
                  )}
                >
                  <Icone className={cn("h-4 w-4", cor)} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="min-w-0 flex-1 truncate text-[0.84rem] text-brand-50">
                      {c.titulo}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 text-[0.72rem] font-medium tabular-nums",
                        proximo ? "text-gold-200" : "text-brand-200/55",
                      )}
                    >
                      {rotuloDia}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[0.72rem] text-brand-200/50">
                    <span className="tabular-nums">{hora(quando)}</span> · {NOME_TIPO[c.tipo]} ·{" "}
                    {c.local}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </motion.section>
  );
}
