"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, School, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Destaque, Destaques } from "@/lib/dashboard/tipos";

/**
 * Congregação Destaque e Classe Destaque — quem mais veio e mais trouxe gente,
 * no mês e no trimestre.
 *
 * ============================================================================
 * O QUE O DESTAQUE PREMIA: ASSIDUIDADE + TRAZER VISITANTE, NUNCA TAMANHO
 *
 * A nota é a MÉDIA de duas taxas — nunca um total bruto. "Presentes ÷
 * chamados" pergunta "essa gente vem sempre?"; "domingos com visitante ÷
 * domingos com chamada" pergunta "essa gente traz alguém?" — não "quantos
 * visitantes trouxe", porque isso premiaria sempre a congregação maior. As
 * duas perguntas cabem em qualquer congregação ou classe, do tamanho que for.
 *
 * Sem pelo menos 3 domingos com chamada no período, ninguém entra na disputa
 * — a mesma trava do Ranking e dos Certificados. Sem isso, uma classe que fez
 * chamada uma vez, com 100% de presença, venceria uma que compareceu 11 dos
 * 12 domingos do trimestre.
 * ============================================================================
 */

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export function DestaqueCard({ destaques, className }: { destaques: Destaques; className?: string }) {
  const [periodo, setPeriodo] = useState<"mensal" | "trimestral">("mensal");
  const cong = destaques.congregacao[periodo];
  const classe = destaques.classe[periodo];
  const janela = destaques.periodo[periodo];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={cn("glass-panel relative overflow-hidden rounded-2xl p-5", className)}
      aria-labelledby="titulo-destaque"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/35 to-transparent"
      />

      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 shrink-0 text-gold-300" />
          <h2
            id="titulo-destaque"
            className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white"
          >
            Destaque
          </h2>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {(["mensal", "trimestral"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={cn(
                "rounded-md px-2 py-1 text-[0.68rem] uppercase tracking-wide transition-colors duration-300",
                periodo === p ? "bg-gold-400/15 text-gold-200" : "text-brand-200/55 hover:text-brand-100",
              )}
            >
              {p === "mensal" ? "Mês" : "Trimestre"}
            </button>
          ))}
        </div>
      </header>

      <p className="mb-3 text-[0.68rem] text-brand-200/45">
        {fmtData.format(new Date(`${janela.de}T12:00:00`))} a {fmtData.format(new Date(`${janela.ate}T12:00:00`))}
        {" — assiduidade + visitantes trazidos"}
      </p>

      <div className="space-y-3">
        <LinhaDestaque icone={Building2} rotulo="Congregação Destaque" destaque={cong} />
        <LinhaDestaque icone={School} rotulo="Classe Destaque" destaque={classe} />
      </div>
    </motion.section>
  );
}

function LinhaDestaque({
  icone: Icone,
  rotulo,
  destaque,
}: {
  icone: typeof Building2;
  rotulo: string;
  destaque: Destaque | null;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
      <p className="mb-1 flex items-center gap-1.5 text-[0.66rem] uppercase tracking-[0.1em] text-brand-200/50">
        <Icone className="h-3 w-3 shrink-0" />
        {rotulo}
      </p>
      {destaque ? (
        <>
          <p className="truncate font-display text-[0.94rem] font-semibold text-gold-200">
            {destaque.nomes.join(" e ")}
          </p>
          <p className="mt-0.5 text-[0.72rem] text-brand-200/55">
            {destaque.taxaFrequencia}% de presença · {destaque.taxaVisitantes}% dos domingos com visitante
          </p>
        </>
      ) : (
        <p className="text-[0.78rem] italic text-brand-200/45">
          Ainda sem dado suficiente neste período — precisa de ao menos 3 domingos com chamada.
        </p>
      )}
    </div>
  );
}
