"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Cake } from "lucide-react";
import { cn } from "@/lib/utils";
import { dataDoAniversario, diaEMes, iniciais } from "@/lib/dashboard/formato";
import type { Aniversariante } from "@/lib/dashboard/tipos";

/**
 * Aniversariantes.
 *
 * Componente reutilizavel de proposito: a mesma lista vai aparecer na tela de
 * Alunos e no relatorio mensal. Por isso ele recebe a lista pronta e nao busca
 * nada — quem sabe qual recorte mostrar e a tela que o usa.
 *
 * A FOTO E OPCIONAL E QUASE SEMPRE AUSENTE: o cadastro herdado da planilha nao
 * tem fotos. O padrao sao as iniciais, que identificam a pessoa; um boneco
 * cinza generico repetido quatro vezes so ocuparia espaco.
 */

export interface BirthdayCardProps {
  aniversariantes: Aniversariante[];
  /** Data de referencia para marcar "hoje". Injetavel para teste. */
  hoje?: Date;
  className?: string;
}

/** "MM-DD" de uma data — o formato em que o aniversario e guardado. */
function chaveDiaMes(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BirthdayCard({ aniversariantes, hoje, className }: BirthdayCardProps) {
  /*
   * `hoje` nao tem valor padrao no parametro, e sim aqui dentro, so quando
   * ausente. `new Date()` como padrao de parametro seria avaliado durante a
   * renderizacao do servidor e de novo no cliente — em fusos diferentes, o
   * "hoje" de um nao e o do outro, e a marcacao pisca na hidratacao.
   */
  const hojeChave = hoje ? chaveDiaMes(hoje) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn("glass-panel relative overflow-hidden rounded-2xl p-5", className)}
      aria-labelledby="titulo-aniversariantes"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/35 to-transparent"
      />

      <header className="mb-4 flex items-center gap-2">
        <Cake className="h-4 w-4 shrink-0 text-gold-300" />
        <h2
          id="titulo-aniversariantes"
          className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white"
        >
          Aniversariantes
        </h2>
      </header>

      {aniversariantes.length === 0 ? (
        <p className="py-4 text-center text-[0.8rem] text-brand-200/50">
          Nenhum aniversário nos próximos dias.
        </p>
      ) : (
        <ul className="space-y-1">
          {aniversariantes.map((p, i) => {
            const ehHoje = hojeChave === p.diaMes;
            const data = dataDoAniversario(p.diaMes);

            return (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.32 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-300",
                  ehHoje ? "bg-gold-400/[0.08] ring-1 ring-gold-400/20" : "hover:bg-white/[0.04]",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1",
                    ehHoje
                      ? "bg-gradient-to-br from-gold-500 to-gold-700 ring-gold-300/40"
                      : "bg-gradient-to-br from-brand-500 to-brand-700 ring-white/12",
                  )}
                >
                  {p.foto ? (
                    <Image src={p.foto} alt="" fill sizes="36px" className="object-cover" />
                  ) : (
                    <span className="font-display text-[0.68rem] font-semibold tracking-wider text-gold-100">
                      {iniciais(p.nome)}
                    </span>
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.82rem] text-brand-50">{p.nome}</p>
                  <p className="truncate text-[0.7rem] text-brand-200/50">
                    {p.classe}
                    {p.idade !== null && <> · {p.idade} anos</>}
                  </p>
                </div>

                <span
                  className={cn(
                    "shrink-0 text-[0.72rem] font-medium tabular-nums",
                    ehHoje ? "text-gold-200" : "text-brand-200/55",
                  )}
                >
                  {ehHoje ? "hoje" : diaEMes(data)}
                </span>
              </motion.li>
            );
          })}
        </ul>
      )}
    </motion.section>
  );
}
