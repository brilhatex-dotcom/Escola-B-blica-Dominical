"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PontoSemanalGrafico } from "./GraficoFrequenciaSemanal";

/**
 * Os mesmos três números do gráfico de linhas, em barras lado a lado — a
 * leitura que compara "quanto" de cada domingo de um jeito que a linha, mais
 * boa para tendência, não entrega tão bem (Fase 19).
 */
const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export function GraficoBarrasSemanal({ dados }: { dados: PontoSemanalGrafico[] }) {
  return (
    <div className="h-56 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ left: -18, right: 12, top: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="data"
            tickFormatter={(v: string) => fmtDia.format(new Date(`${v}T12:00:00`))}
            tick={{ fill: "#8aa5d0", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fill: "#8aa5d0", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#0B1F45",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelFormatter={(v) => fmtDia.format(new Date(`${v}T12:00:00`))}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#8aa5d0" }} />
          <Bar dataKey="presentes" name="Presentes" fill="#34d399" radius={[4, 4, 0, 0]} />
          <Bar dataKey="ausentes" name="Ausentes" fill="#D62828" radius={[4, 4, 0, 0]} />
          <Bar dataKey="visitantes" name="Visitantes" fill="#D4AF37" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
