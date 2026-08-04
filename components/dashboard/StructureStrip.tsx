"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, IdCard, School, TriangleAlert, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { numero } from "@/lib/dashboard/formato";
import type { Estrutura } from "@/lib/dashboard/tipos";

/**
 * Pessoas, cargos, classes e congregações.
 *
 * ============================================================================
 * POR QUE "PESSOAS" E "CARGOS" APARECEM SEPARADOS
 *
 * O sistema antigo nao conseguia contar gente. Ele guardava o professor como
 * texto livre dentro da classe, entao quem dava aula em duas classes virava
 * duas pessoas, e quem era dirigente e professor virava duas de novo. Nunca
 * houve um numero confiavel de quantas pessoas servem na EBD.
 *
 * Aqui as duas perguntas ficam lado a lado porque sao perguntas diferentes:
 *
 *     PESSOAS  = quantas gentes         (cadastro unico, sem duplicidade)
 *     CARGOS   = quantas funcoes        (uma linha por vinculo)
 *
 * E a DIFERENCA entre os dois e a informacao mais util do bloco: ela diz quanto
 * a equipe esta acumulando funcao. Por isso o cartao de cargos mostra, embaixo,
 * quantas pessoas acumulam — sem essa frase, alguem olha "59 pessoas / 68
 * cargos" e conclui que um dos dois numeros esta errado.
 * ============================================================================
 */

export interface StructureStripProps {
  estrutura: Estrutura;
  className?: string;
}

interface Bloco {
  chave: string;
  icone: LucideIcon;
  rotulo: string;
  valor: number;
  nota: string;
  destino?: string;
  acento: string;
}

export function StructureStrip({ estrutura, className }: StructureStripProps) {
  const { pessoas, cargosOcupados, acumulam, classes, congregacoes, revisar } = estrutura;

  const blocos: Bloco[] = [
    {
      chave: "pessoas",
      icone: Users,
      rotulo: "Pessoas únicas",
      valor: pessoas,
      nota: "sem duplicidade",
      destino: "/dashboard/professores",
      acento: "text-gold-300",
    },
    {
      chave: "cargos",
      icone: IdCard,
      rotulo: "Cargos ocupados",
      valor: cargosOcupados,
      // A frase que impede a leitura errada dos dois numeros.
      nota:
        acumulam > 0
          ? `${acumulam} ${acumulam === 1 ? "pessoa acumula" : "pessoas acumulam"} função`
          : "uma função por pessoa",
      destino: "/dashboard/professores",
      acento: "text-brand-200",
    },
    {
      chave: "classes",
      icone: School,
      rotulo: "Classes",
      valor: classes,
      nota: "em atividade",
      destino: "/dashboard/classes",
      acento: "text-emerald-300",
    },
    {
      chave: "congregacoes",
      icone: Building2,
      rotulo: "Congregações",
      valor: congregacoes,
      nota: "com classes ou alunos",
      acento: "text-brand-100",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
      className={cn("glass-panel relative overflow-hidden rounded-2xl p-4 sm:p-5", className)}
      aria-labelledby="titulo-estrutura"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="titulo-estrutura"
          className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white"
        >
          Equipe e estrutura
        </h2>
        <p className="text-[0.72rem] text-brand-200/45">
          Uma pessoa em vários cargos continua sendo uma pessoa.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {blocos.map((b, i) => {
          const Icone = b.icone;

          const corpo = (
            <div
              className={cn(
                "flex h-full items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3",
                "transition-colors duration-300",
                b.destino && "group-hover:border-white/16 group-hover:bg-white/[0.06]",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/8">
                <Icone className={cn("h-4 w-4", b.acento)} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-[1.35rem] font-semibold leading-none text-white tabular-nums">
                  {numero(b.valor)}
                </p>
                <p className="mt-1 truncate text-[0.74rem] text-brand-100/75">{b.rotulo}</p>
                <p className="truncate text-[0.68rem] text-brand-200/45">{b.nota}</p>
              </div>
            </div>
          );

          return (
            <motion.div
              key={b.chave}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              {b.destino ? (
                <Link
                  href={b.destino}
                  className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60"
                >
                  {corpo}
                </Link>
              ) : (
                corpo
              )}
            </motion.div>
          );
        })}
      </div>

      {/*
        Duplicatas suspeitas da importacao.
        Aparece so quando ha alguma — um aviso permanente com "0" vira paisagem
        e ninguem lê o dia em que ele deixar de ser zero.
      */}
      {revisar > 0 && (
        <Link
          href="/dashboard/professores?revisar=1"
          className="mt-3 flex items-center gap-2.5 rounded-xl border border-gold-400/20 bg-gold-400/[0.06] px-3 py-2.5 transition-colors duration-300 hover:bg-gold-400/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60"
        >
          <TriangleAlert className="h-4 w-4 shrink-0 text-gold-300" />
          <span className="min-w-0 flex-1 text-[0.76rem] leading-snug text-brand-100/85">
            <span className="font-semibold text-gold-200">{revisar}</span>{" "}
            {revisar === 1 ? "cadastro aguarda" : "cadastros aguardam"} conferência — podem
            ser a mesma pessoa digitada de formas diferentes.
          </span>
        </Link>
      )}
    </motion.section>
  );
}
