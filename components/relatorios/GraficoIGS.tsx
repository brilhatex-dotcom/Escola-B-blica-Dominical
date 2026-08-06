"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Barra horizontal do Índice de Saúde por congregação.
 *
 * Vive num arquivo à parte para poder ser importado com `next/dynamic` e
 * `ssr: false` — o Recharts pesa mais do que o resto da tela de Painel
 * somada, e nada nele é necessário para a primeira leitura (o número do IGE
 * e os alertas já dizem o essencial antes do gráfico terminar de baixar).
 */

export interface PontoIGS {
  nome: string;
  nota: number;
  faixa: "excelente" | "muito-boa" | "atencao" | "critica";
}

const CORES_FAIXA: Record<PontoIGS["faixa"], string> = {
  excelente: "#34d399",
  "muito-boa": "#5578b4",
  atencao: "#D4AF37",
  critica: "#D62828",
};

export function GraficoIGS({ dados }: { dados: PontoIGS[] }) {
  return (
    <div style={{ height: Math.max(180, dados.length * 34) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="nome"
            width={140}
            tick={{ fill: "#c3d0e6", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#0B1F45",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(v) => [`${v} pontos`, "Índice"]}
          />
          <Bar dataKey="nota" radius={[0, 6, 6, 0]} barSize={16}>
            {dados.map((c, i) => (
              <Cell key={i} fill={CORES_FAIXA[c.faixa]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
