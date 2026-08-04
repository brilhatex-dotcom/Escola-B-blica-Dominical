"use client";

import { motion } from "framer-motion";
import { BookMarked, CircleCheck, CircleDashed, RefreshCw, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { numero, tempoRelativo } from "@/lib/dashboard/formato";
import type { ResumoDomingo } from "@/lib/dashboard/tipos";

/**
 * Resumo do domingo — a resposta a "como esta indo a manha de hoje".
 *
 * O bloco das classes tem uma barra de progresso porque "41 iniciadas" e um
 * numero sem significado sozinho: 41 de 53 e um domingo bem encaminhado, 41 de
 * 120 seria um problema. A barra da essa proporcao antes de qualquer leitura.
 *
 * A pendencia aparece como NUMERO PROPRIO, e nao so como resto da barra. As 12
 * classes que ainda nao comecaram sao exatamente a lista de telefonemas que a
 * secretaria precisa dar — e o que ela veio procurar aqui.
 */

export interface SummaryCardProps {
  resumo: ResumoDomingo;
  /** Ultima sincronizacao real, vinda do motor. `null` = ainda nao houve. */
  ultimaSincronizacao?: number | null;
  className?: string;
}

function Linha({
  icone: Icone,
  rotulo,
  valor,
  destaque = false,
}: {
  icone: typeof Users;
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/8">
        <Icone className={cn("h-3.5 w-3.5", destaque ? "text-gold-300" : "text-brand-300/75")} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.8rem] text-brand-200/70">{rotulo}</span>
      <span
        className={cn(
          "shrink-0 text-[0.86rem] font-semibold tabular-nums",
          destaque ? "text-gold-200" : "text-white",
        )}
      >
        {valor}
      </span>
    </div>
  );
}

export function SummaryCard({ resumo, ultimaSincronizacao, className }: SummaryCardProps) {
  const { licao, classesIniciadas, classesTotal, presentes, visitantes, professores } = resumo;
  const pendentes = Math.max(0, classesTotal - classesIniciadas);
  const proporcao = classesTotal > 0 ? classesIniciadas / classesTotal : 0;
  const sync = ultimaSincronizacao ?? resumo.ultimaSincronizacao;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className={cn("glass-panel relative overflow-hidden rounded-2xl p-5", className)}
      aria-labelledby="titulo-resumo"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/40 to-transparent"
      />

      <h2
        id="titulo-resumo"
        className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white"
      >
        Resumo do domingo
      </h2>

      {/* ---------------- Licao ---------------- */}
      <div className="mt-4 rounded-xl border border-gold-400/15 bg-gold-400/[0.06] p-3.5">
        <div className="flex items-center gap-2">
          <BookMarked className="h-3.5 w-3.5 shrink-0 text-gold-300" />
          <p className="text-[0.66rem] uppercase tracking-[0.16em] text-gold-200/80">
            Lição {licao.numero}
          </p>
        </div>
        <p className="mt-1.5 font-serif text-[0.94rem] leading-snug text-white">{licao.titulo}</p>
        <p className="mt-1 text-[0.72rem] text-brand-200/55">{licao.revista}</p>
      </div>

      {/* ---------------- Classes ---------------- */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[0.8rem] text-brand-200/70">Classes iniciadas</span>
          <span className="text-[0.86rem] font-semibold tabular-nums text-white">
            {classesIniciadas}
            <span className="text-brand-200/45"> / {classesTotal}</span>
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={classesIniciadas}
          aria-valuemin={0}
          aria-valuemax={classesTotal}
          aria-label="Classes que já iniciaram a chamada"
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8"
        >
          <motion.span
            initial={{ width: 0 }}
            animate={{ width: `${proporcao * 100}%` }}
            transition={{ duration: 1.1, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="block h-full rounded-full bg-gradient-to-r from-brand-400 to-gold-400"
          />
        </div>

        <div className="mt-2.5 flex items-center gap-4 text-[0.74rem]">
          <span className="flex items-center gap-1.5 text-emerald-300/85">
            <CircleCheck className="h-3.5 w-3.5" />
            {classesIniciadas} iniciadas
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5",
              pendentes > 0 ? "text-gold-200/85" : "text-brand-200/45",
            )}
          >
            <CircleDashed className="h-3.5 w-3.5" />
            {pendentes} {pendentes === 1 ? "pendente" : "pendentes"}
          </span>
        </div>
      </div>

      {/* ---------------- Numeros ---------------- */}
      <div className="mt-4 divide-y divide-white/6 border-t border-white/8 pt-1">
        <Linha icone={Users} rotulo="Presentes" valor={numero(presentes)} destaque />
        <Linha icone={UserRound} rotulo="Visitantes" valor={numero(visitantes)} />
        <Linha icone={UserRound} rotulo="Professores" valor={numero(professores)} />
      </div>

      {/* ---------------- Sincronizacao ---------------- */}
      <div className="mt-3 flex items-center gap-2 border-t border-white/8 pt-3 text-[0.72rem] text-brand-200/50">
        <RefreshCw className="h-3 w-3 shrink-0" />
        {sync ? (
          <>Última sincronização {tempoRelativo(sync)}</>
        ) : (
          /*
           * "Nunca" seria alarmante e, pior, seria falso: os dados estao a
           * salvo no aparelho — o que ainda nao existe e o servidor para onde
           * envia-los, que chega na Fase 05.
           */
          <>Aguardando a primeira sincronização</>
        )}
      </div>
    </motion.section>
  );
}
