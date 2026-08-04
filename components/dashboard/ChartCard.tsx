"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { numero } from "@/lib/dashboard/formato";
import type { PontoFrequencia } from "@/lib/dashboard/tipos";

/**
 * Frequencia mes a mes.
 *
 * TRES SERIES, TRES PAPEIS DIFERENTES — e por isso tres formas diferentes:
 *
 *   presentes ..... area preenchida. E a serie principal, a que responde "como
 *                   foi o mes"; o preenchimento faz dela a primeira coisa lida.
 *   matriculados .. linha tracejada. E o TETO, a referencia contra a qual os
 *                   presentes se comparam. Tracejada porque nao e uma medicao
 *                   do domingo, e um cadastro.
 *   visitantes .... linha fina. Numeros uma ordem de grandeza menores; como
 *                   area, sumiria rente ao eixo.
 *
 * Se as tres fossem areas empilhadas, a leitura "218 de 323" — que e a unica
 * conta que interessa a secretaria — teria de ser feita de cabeca, somando
 * faixas coloridas.
 */

export interface ChartCardProps {
  dados: PontoFrequencia[];
  className?: string;
}

const CORES = {
  presentes: "#5578b4", // brand-400
  matriculados: "#D4AF37", // gold-400 — a referencia, em dourado
  visitantes: "#8aa5d0", // brand-300
};

const ROTULOS: Record<string, string> = {
  presentes: "Presentes",
  matriculados: "Matriculados",
  visitantes: "Visitantes",
};

/** Caixa do ponteiro. O padrao do Recharts e branco e quebra a identidade. */
function Dica({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | string; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass-panel rounded-xl px-3 py-2.5">
      <p className="mb-1.5 text-[0.72rem] font-medium uppercase tracking-[0.12em] text-gold-200">
        {label}
      </p>
      <ul className="space-y-1">
        {payload.map((serie) => (
          <li key={String(serie.dataKey)} className="flex items-center gap-2 text-[0.78rem]">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: serie.color }}
            />
            <span className="text-brand-200/70">{ROTULOS[String(serie.dataKey)]}</span>
            <span className="ml-auto font-medium tabular-nums text-white">
              {numero(Number(serie.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartCard({ dados, className }: ChartCardProps) {
  const [periodo, setPeriodo] = useState<"6m" | "12m">("6m");

  /*
   * Hoje o recorte apenas fatia o que ja veio. Quando os dados forem reais, e
   * aqui que entra o parametro na busca — o botao ja existe, ja e acessivel e
   * ja tem estado, entao nada de layout muda.
   */
  const visivel = periodo === "6m" ? dados.slice(-6) : dados;

  const ultimo = visivel.at(-1);
  const taxa =
    ultimo && ultimo.matriculados > 0
      ? Math.round((ultimo.presentes / ultimo.matriculados) * 100)
      : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className={cn("glass-panel relative overflow-hidden rounded-2xl p-5 sm:p-6", className)}
      aria-labelledby="titulo-frequencia"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/40 to-transparent"
      />

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="titulo-frequencia"
            className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white"
          >
            Frequência mensal
          </h2>
          <p className="mt-1 text-[0.78rem] text-brand-200/55">
            {taxa !== null
              ? `${taxa}% dos matriculados presentes no último domingo`
              : "Presença acompanhada mês a mês"}
          </p>
        </div>

        <div
          role="group"
          aria-label="Período do gráfico"
          className="flex shrink-0 gap-0.5 rounded-lg bg-white/5 p-0.5"
        >
          {(["6m", "12m"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              aria-pressed={periodo === p}
              className={cn(
                "rounded-md px-2.5 py-1 text-[0.72rem] font-medium transition-all duration-300",
                periodo === p
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-brand-200/60 hover:text-brand-100",
              )}
            >
              {p === "6m" ? "6 meses" : "12 meses"}
            </button>
          ))}
        </div>
      </header>

      {/*
        Altura fixa e obrigatoria: o `ResponsiveContainer` mede o PAI. Dentro de
        um pai sem altura definida ele mede zero, nao desenha nada e o cartao
        aparece vazio — sem erro nenhum no console para denunciar o motivo.
      */}
      <div className="h-[17rem] w-full sm:h-[19rem]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visivel} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-presentes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CORES.presentes} stopOpacity={0.55} />
                <stop offset="100%" stopColor={CORES.presentes} stopOpacity={0.03} />
              </linearGradient>
            </defs>

            {/* So as horizontais: as verticais competem com as proprias series */}
            <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />

            <XAxis
              dataKey="mes"
              tick={{ fill: "rgba(184,201,228,0.55)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              dy={6}
            />
            <YAxis
              tick={{ fill: "rgba(184,201,228,0.45)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />

            <Tooltip
              content={<Dica />}
              cursor={{ stroke: "rgba(212,175,55,0.35)", strokeWidth: 1 }}
            />
            <Legend
              verticalAlign="bottom"
              height={30}
              formatter={(v) => (
                <span className="text-[0.74rem] text-brand-200/70">{ROTULOS[String(v)] ?? v}</span>
              )}
            />

            <Area
              type="monotone"
              dataKey="presentes"
              stroke={CORES.presentes}
              strokeWidth={2.5}
              fill="url(#grad-presentes)"
              // O ponto so aparece sob o ponteiro: sete bolinhas fixas poluem a
              // curva e nao acrescentam nada que a linha ja nao diga.
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#020713", fill: CORES.presentes }}
            />
            <Line
              type="monotone"
              dataKey="matriculados"
              stroke={CORES.matriculados}
              strokeWidth={1.75}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 2, stroke: "#020713", fill: CORES.matriculados }}
            />
            <Line
              type="monotone"
              dataKey="visitantes"
              stroke={CORES.visitantes}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 2, stroke: "#020713", fill: CORES.visitantes }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  );
}
