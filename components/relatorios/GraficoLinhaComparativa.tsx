"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * A frequência mensal de várias congregações, lado a lado — a mesma pergunta
 * do radar ("quem está melhor"), mas ao longo do TEMPO em vez de num instante
 * só. É aqui que "a Congregação X vem subindo há três meses" vira uma linha
 * visível, e não uma frase que a pessoa precisa confiar de olhos fechados.
 */

export interface SerieLinha {
  nome: string;
  cor: string;
}

export interface PontoLinha {
  mes: string;
  [congregacao: string]: string | number | null;
}

const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "short" });

export function GraficoLinhaComparativa({
  dados,
  series,
}: {
  dados: PontoLinha[];
  series: SerieLinha[];
}) {
  return (
    <div className="h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ left: -18, right: 12, top: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="mes"
            tickFormatter={(v: string) => fmtMes.format(new Date(`${v}-15T12:00:00`))}
            tick={{ fill: "#8aa5d0", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "#8aa5d0", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "#0B1F45",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelFormatter={(v) => fmtMes.format(new Date(`${v}-15T12:00:00`))}
            formatter={(v) => (v === null ? ["sem chamada", ""] : [`${v}%`, ""])}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {series.map((s) => (
            <Line
              key={s.nome}
              type="monotone"
              dataKey={s.nome}
              stroke={s.cor}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
