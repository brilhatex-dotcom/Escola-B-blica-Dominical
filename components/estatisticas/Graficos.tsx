"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Os gráficos da área de Estatísticas.
 *
 * Uma série por gráfico, sempre — nada de dois eixos. A cor é a do portal
 * (dourado sobre o azul), a grade fica apagada e o número aparece no toque
 * (tooltip), não escrito em cada ponto.
 */

const OURO = "#D4AF37";
const EIXO = { fill: "#8aa5d0", fontSize: 11 };
const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const dia = (v: string) => fmtDia.format(new Date(`${v}T12:00:00`));
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const caixaTooltip = {
  background: "#0B1F45",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  fontSize: 12,
  color: "#e8eefb",
};

export interface PontoTaxa {
  data: string;
  /** O que aconteceu. Nulo nos domingos projetados. */
  taxa: number | null;
  /** A reta esticada para a frente. Só no último real e nos projetados. */
  projetada: number | null;
}

/**
 * Presença do campo (%) domingo a domingo, com a projeção tracejada na MESMA
 * cor — é a mesma grandeza, só que estimada. O tracejado é que diz "ainda
 * não aconteceu"; uma cor nova faria parecer outra série.
 */
export function GraficoTaxaComProjecao({ dados }: { dados: PontoTaxa[] }) {
  return (
    <div className="h-60 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="data" tickFormatter={dia} tick={EIXO} axisLine={false} tickLine={false} minTickGap={18} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={EIXO}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            contentStyle={caixaTooltip}
            cursor={{ stroke: "rgba(255,255,255,0.25)" }}
            labelFormatter={(v) => `Domingo ${dia(String(v))}`}
            formatter={(v, nome) => [pct(Number(v)), nome === "projetada" ? "Projeção" : "Presença"]}
          />
          <Line type="monotone" dataKey="taxa" name="taxa" stroke={OURO} strokeWidth={2} dot={{ r: 4, strokeWidth: 0, fill: OURO }} activeDot={{ r: 6 }} connectNulls={false} />
          <Line
            type="monotone"
            dataKey="projetada"
            name="projetada"
            stroke={OURO}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 4, strokeWidth: 2, fill: "#0B1F45", stroke: OURO }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras de uma série só — revistas por trimestre, matrículas por mês. */
export function GraficoBarras({
  dados,
  rotuloValor,
  altura = "h-52",
}: {
  dados: Array<{ rotulo: string; valor: number }>;
  rotuloValor: string;
  altura?: string;
}) {
  return (
    <div className={altura}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip
            contentStyle={caixaTooltip}
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            formatter={(v) => [Number(v).toLocaleString("pt-BR"), rotuloValor]}
          />
          <Bar dataKey="valor" fill={OURO} radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
