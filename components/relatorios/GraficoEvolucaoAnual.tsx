"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Frequência média por ANO — quantos anos o histórico tiver (Fase 19).
 *
 * Ano com zero chamada (congregação nova, ou ano sem dado importado) some da
 * lista antes de chegar aqui — a rota só manda anos que de fato têm alguma
 * chamada registrada.
 */
export interface PontoAnual {
  ano: number;
  taxa: number | null;
  chamadas: number;
}

export function GraficoEvolucaoAnual({ dados }: { dados: PontoAnual[] }) {
  const validos = dados.filter((d) => d.taxa !== null);
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={validos} margin={{ left: -18, right: 12, top: 8 }}>
          <XAxis dataKey="ano" tick={{ fill: "#8aa5d0", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "#8aa5d0", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#0B1F45",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(v, _n, item) => [`${v}% (${item.payload.chamadas} chamadas)`, "Frequência"]}
          />
          <Bar dataKey="taxa" radius={[6, 6, 0, 0]} barSize={48}>
            {validos.map((d, i) => (
              <Cell key={i} fill="#5578b4" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
