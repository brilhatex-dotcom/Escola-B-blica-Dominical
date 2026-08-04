"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { iniciais } from "@/lib/dashboard/formato";
import type { Lider } from "@/lib/dashboard/tipos";

/**
 * Liderança do Campo.
 *
 * NENHUM NOME APARECE NESTE ARQUIVO. A lista vem inteira do banco: quais cargos
 * entram e a ordem em que aparecem sao os campos `destaque` e `ordem` da tabela
 * Cargos; quem ocupa cada um vem de PessoaCargos. Trocar o Supervisor da EBD e
 * uma alteracao de dado, feita pelo painel administrativo — e o que a
 * especificacao pede, e a diferenca entre um card institucional e uma placa
 * pintada na parede.
 *
 * CARGO VAGO APARECE ASSIM MESMO, com o lugar reservado e a palavra "vago".
 * Some-lo esconderia da igreja que a funcao existe e esta sem ninguem, que e
 * justamente a informacao que alguem precisaria ver.
 *
 * O tratamento ("Pr.", "Pb.", "Aux.") vem separado do nome no banco. Junto,
 * "Pb. José Raimundo" e "José Raimundo" viravam duas pessoas no cadastro —
 * exatamente como "Silvério" e "Aux. Silverio" viraram, no sistema antigo.
 * Aqui os dois se reencontram na hora de exibir.
 */

export interface LeadershipCardProps {
  lideranca: Lider[];
  className?: string;
}

/** O primeiro da lista ganha destaque; a hierarquia precisa ser visivel. */
function Retrato({ lider, principal }: { lider: Lider; principal: boolean }) {
  const vago = !lider.nome;

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1",
        principal ? "h-12 w-12" : "h-10 w-10",
        vago
          ? "border border-dashed border-white/15 bg-white/[0.03] ring-white/8"
          : principal
            ? "bg-gradient-to-br from-gold-500 to-gold-700 ring-gold-300/40"
            : "bg-gradient-to-br from-brand-500 to-brand-700 ring-white/12",
      )}
    >
      {lider.foto ? (
        <Image src={lider.foto} alt="" fill sizes="48px" className="object-cover" />
      ) : vago ? (
        <span className="text-[0.7rem] text-brand-200/35">—</span>
      ) : (
        <span
          className={cn(
            "font-display font-semibold tracking-wider",
            principal ? "text-[0.8rem] text-gold-100" : "text-[0.7rem] text-brand-100",
          )}
        >
          {iniciais(lider.nome!)}
        </span>
      )}
    </span>
  );
}

export function LeadershipCard({ lideranca, className }: LeadershipCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn("glass-panel relative overflow-hidden rounded-2xl p-5", className)}
      aria-labelledby="titulo-lideranca"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/50 to-transparent"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-gold-400/[0.07] blur-3xl"
      />

      <header className="mb-4 flex items-center gap-2">
        <Crown className="h-4 w-4 shrink-0 text-gold-300" />
        <h2
          id="titulo-lideranca"
          className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white"
        >
          Liderança do Campo
        </h2>
      </header>

      {lideranca.length === 0 ? (
        <p className="py-4 text-center text-[0.8rem] text-brand-200/50">
          Nenhum cargo de liderança cadastrado.
        </p>
      ) : (
        /*
          Lista ORDENADA (`<ol>`), e nao `<ul>`: a ordem aqui carrega
          significado — e a hierarquia oficial. Para quem usa leitor de tela,
          a diferenca entre "item 1 de 5" e uma lista solta e justamente essa.
        */
        <ol className="space-y-1">
          {lideranca.map((lider, i) => {
            const principal = i === 0;
            const vago = !lider.nome;

            return (
              <motion.li
                key={lider.cargoId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-300",
                  principal
                    ? "bg-gold-400/[0.07] ring-1 ring-gold-400/15"
                    : "hover:bg-white/[0.04]",
                )}
              >
                {/* Numero da hierarquia — discreto, mas presente */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-4 shrink-0 text-right font-display text-[0.7rem] tabular-nums",
                    principal ? "text-gold-300/80" : "text-brand-200/35",
                  )}
                >
                  {i + 1}
                </span>

                <Retrato lider={lider} principal={principal} />

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate leading-tight",
                      vago
                        ? "text-[0.84rem] italic text-brand-200/45"
                        : principal
                          ? "text-[0.92rem] font-medium text-white"
                          : "text-[0.86rem] text-brand-50",
                    )}
                  >
                    {vago ? (
                      "Cargo vago"
                    ) : (
                      <>
                        {lider.tratamento && (
                          <span className="text-gold-200/85">{lider.tratamento} </span>
                        )}
                        {lider.nome}
                      </>
                    )}
                  </p>
                  <p
                    className={cn(
                      "truncate text-[0.72rem] leading-tight",
                      principal ? "text-gold-200/70" : "text-brand-200/55",
                    )}
                  >
                    {lider.cargo}
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
