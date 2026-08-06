"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Presentes, ausentes e visitantes, domingo a domingo — a linha do tempo
 * curta do prontuário de congregação (Fase 19).
 *
 * Domingo sem chamada nenhuma simplesmente NÃO aparece no eixo — a mesma
 * regra de "faltou ≠ não marcado" de todo relatório do portal: um buraco na
 * chamada não vira um ponto de "zero presentes" no gráfico, porque zero
 * presentes diria que a igreja não se reuniu, quando na verdade ninguém
 * registrou.
 */

export interface PontoSemanalGrafico {
  data: string;
  presentes: number;
  ausentes: number;
  visitantes: number;
}

const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export function GraficoFrequenciaSemanal({ dados }: { dados: PontoSemanalGrafico[] }) {
  return (
    <div className="h-56 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ left: -18, right: 12, top: 8 }}>
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
            contentStyle={{
              background: "#0B1F45",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelFormatter={(v) => fmtDia.format(new Date(`${v}T12:00:00`))}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#8aa5d0" }} />
          <Line type="monotone" dataKey="presentes" name="Presentes" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="ausentes" name="Ausentes" stroke="#D62828" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="visitantes" name="Visitantes" stroke="#D4AF37" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
