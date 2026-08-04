"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight, Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { numero } from "@/lib/dashboard/formato";
import type { Indicador } from "@/lib/dashboard/tipos";

/**
 * Cartao de numero — os quatro grandes do topo do painel.
 *
 * SOBRE O SENTIDO DA VARIACAO: subir nem sempre e bom. Mais alunos e mais
 * presentes sao boas noticias; agora, se o numero de visitantes cai, isso e uma
 * queda de verdade e precisa aparecer em vermelho. Por isso a cor vem do SINAL
 * combinado com o indicador, e nao de "positivo e verde" automatico.
 *
 * Variacao `null` nao vira "0%": significa que nao ha com o que comparar (mes
 * de estreia, classe recem-criada). Mostrar zero seria inventar uma apuracao
 * que ninguem fez.
 */

export interface DashboardCardProps {
  indicador: Indicador;
  icone: LucideIcon;
  /** Ordem de entrada na animacao escalonada. */
  indice?: number;
  className?: string;
}

/** Acento de cada cartao. Dourado so no primeiro — o resto seria excesso. */
const ACENTOS: Record<string, { icone: string; halo: string; anel: string }> = {
  alunos: { icone: "text-gold-300", halo: "rgba(212,175,55,0.16)", anel: "ring-gold-400/25" },
  classes: { icone: "text-brand-200", halo: "rgba(45,83,145,0.28)", anel: "ring-brand-400/25" },
  presentes: { icone: "text-emerald-300", halo: "rgba(16,185,129,0.16)", anel: "ring-emerald-400/20" },
  visitantes: { icone: "text-brand-100", halo: "rgba(138,165,208,0.18)", anel: "ring-brand-300/20" },
};

export function DashboardCard({ indicador, icone: Icone, indice = 0, className }: DashboardCardProps) {
  const { titulo, valor, descricao, variacao, destino, chave } = indicador;
  const acento = ACENTOS[chave] ?? ACENTOS.classes;

  /*
   * Inclinacao de 3D seguindo o ponteiro.
   *
   * `useSpring` amortece o movimento; sem ele o cartao acompanha o mouse pixel
   * a pixel e o efeito fica nervoso, mais videogame do que sistema. A amplitude
   * e de 5 graus — o suficiente para a superficie parecer solida, longe do
   * cartao girando que a spec pede para evitar.
   */
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const mola = { stiffness: 150, damping: 20, mass: 0.6 };
  const rotX = useSpring(useTransform(py, [0, 1], [5, -5]), mola);
  const rotY = useSpring(useTransform(px, [0, 1], [-5, 5]), mola);

  function aoMover(e: React.MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  }

  function aoSair() {
    px.set(0.5);
    py.set(0.5);
  }

  const sobe = (variacao?.percentual ?? 0) > 0;
  const parado = variacao?.percentual === 0;

  /*
   * Nestes quatro indicadores, crescer e sempre boa noticia — mais alunos,
   * mais classes, mais presentes, mais visitantes. Por isso verde para cima e
   * vermelho para baixo esta correto AQUI.
   *
   * Nao generalize a regra para o resto do sistema sem pensar: "faltas" e
   * "classes pendentes" tambem sao numeros que sobem, e ali o verde estaria
   * comemorando o problema.
   */
  const TendIcone = parado ? Minus : sobe ? TrendingUp : TrendingDown;
  const corTendencia = parado
    ? "text-brand-200/55"
    : sobe
      ? "text-emerald-300"
      : "text-flame-400";

  const conteudo = (
    <motion.article
      onMouseMove={aoMover}
      onMouseLeave={aoSair}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: indice * 0.07, ease: [0.16, 1, 0.3, 1] }}
      style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 900 }}
      className={cn(
        "group glass-panel relative h-full overflow-hidden rounded-2xl p-5",
        "transition-shadow duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:shadow-[0_28px_70px_-24px_rgba(2,7,19,0.95)]",
        className,
      )}
    >
      {/* Halo que acende no hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-100"
        style={{ background: `radial-gradient(closest-side, ${acento.halo}, transparent)` }}
      />
      {/* Fio de luz no topo, igual ao do card de login */}
      <span
        aria-hidden="true"
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />

      <div className="relative flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 transition-transform duration-500 group-hover:scale-105",
            acento.anel,
          )}
        >
          <Icone className={cn("h-[1.15rem] w-[1.15rem]", acento.icone)} />
        </span>

        <ArrowUpRight className="h-4 w-4 shrink-0 text-brand-300/40 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold-200" />
      </div>

      <p className="mt-4 text-[0.74rem] uppercase tracking-[0.14em] text-brand-200/60">{titulo}</p>

      <p className="mt-1.5 font-display text-[2.1rem] font-semibold leading-none text-white tabular-nums">
        {numero(valor)}
      </p>

      <p className="mt-2 text-[0.76rem] text-brand-200/55">{descricao}</p>

      <div className="mt-4 flex items-center gap-1.5 border-t border-white/8 pt-3">
        {variacao ? (
          <>
            <TendIcone className={cn("h-3.5 w-3.5 shrink-0", corTendencia)} />
            <span className={cn("text-[0.76rem] font-medium tabular-nums", corTendencia)}>
              {parado ? "—" : `${sobe ? "+" : ""}${variacao.percentual.toLocaleString("pt-BR")}%`}
            </span>
            <span className="truncate text-[0.72rem] text-brand-200/45">{variacao.referencia}</span>
          </>
        ) : (
          <span className="text-[0.72rem] text-brand-200/40">Sem base de comparação ainda</span>
        )}
      </div>
    </motion.article>
  );

  /*
   * O cartao inteiro e o alvo do clique, e nao um "ver mais" no rodape: o
   * numero grande e o que a pessoa quer tocar, e num celular acertar um link de
   * 11px e um teste de pontaria.
   */
  return (
    <Link
      href={destino}
      aria-label={`${titulo}: ${numero(valor)} — ${descricao}`}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-990"
    >
      {conteudo}
    </Link>
  );
}
