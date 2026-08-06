"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * A frequência do campo, mês a mês, nos últimos 12 meses.
 *
 * ============================================================================
 * A ÚNICA PERGUNTA QUE O INSTANTÂNEO DE 90 DIAS NÃO RESPONDE
 *
 * O resto do Painel compara duas metades de um período de 90 dias — "subiu ou
 * caiu nas últimas semanas". Isso não distingue uma queda real de um recesso
 * de julho, que se repete todo ano e não é motivo de alarme. Só olhando os 12
 * meses lado a lado esse padrão sazonal aparece como o que é.
 * ============================================================================
 *
 * Mês sem NENHUMA chamada registrada aparece como um buraco na área — e não
 * como "0% de frequência", que diria que a igreja não apareceu, quando na
 * verdade ninguém fez a chamada.
 */

export interface PontoEvolucao {
  mes: string;
  taxa: number | null;
  chamadas: number;
}

const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });

export function GraficoEvolucao({ dados }: { dados: PontoEvolucao[] }) {
  return (
    <div className="h-56 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dados} margin={{ left: -18, right: 12, top: 8 }}>
          <defs>
            <linearGradient id="evolucaoCampo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            formatter={(v, _n, item) =>
              v === null
                ? ["sem chamada registrada", "Frequência"]
                : [`${v}% (${item.payload.chamadas} chamadas)`, "Frequência"]
            }
          />
          <Area
            type="monotone"
            dataKey="taxa"
            stroke="#D4AF37"
            strokeWidth={2}
            fill="url(#evolucaoCampo)"
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
