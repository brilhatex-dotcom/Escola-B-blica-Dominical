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
export interface CoresGrafico {
  linha: string;
  eixo: string;
  grade: string;
  fundo: string;
  texto: string;
  tamanhoEixo?: number;
}

const CORES_PADRAO: CoresGrafico = {
  linha: OURO,
  eixo: EIXO.fill,
  grade: "rgba(255,255,255,0.06)",
  fundo: "#0B1F45",
  texto: "#e8eefb",
};

export function GraficoTaxaComProjecao({
  dados,
  cores = CORES_PADRAO,
  className = "h-60 sm:h-72",
}: {
  dados: PontoTaxa[];
  /** O Modo Data Show troca as cores (alto contraste) e o tamanho do eixo. */
  cores?: CoresGrafico;
  className?: string;
}) {
  const eixo = { fill: cores.eixo, fontSize: cores.tamanhoEixo ?? 11 };
  const grossura = cores.tamanhoEixo ? 4 : 2;
  const raio = cores.tamanhoEixo ? 7 : 4;
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid stroke={cores.grade} vertical={false} />
          <XAxis
            dataKey="data"
            tickFormatter={dia}
            tick={eixo}
            axisLine={false}
            tickLine={false}
            minTickGap={18}
            tickMargin={cores.tamanhoEixo ? cores.tamanhoEixo / 2 : 4}
            // Com letra grande, a faixa padrão de 30px corta as datas pela metade.
            height={cores.tamanhoEixo ? Math.round(cores.tamanhoEixo * 2.2) : 30}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={eixo}
            axisLine={false}
            tickLine={false}
            width={cores.tamanhoEixo ? cores.tamanhoEixo * 4 : 42}
          />
          <Tooltip
            contentStyle={{ ...caixaTooltip, background: cores.fundo, color: cores.texto }}
            cursor={{ stroke: "rgba(255,255,255,0.25)" }}
            labelFormatter={(v) => `Domingo ${dia(String(v))}`}
            formatter={(v, nome) => [pct(Number(v)), nome === "projetada" ? "Projeção" : "Presença"]}
          />
          <Line
            type="monotone"
            dataKey="taxa"
            name="taxa"
            stroke={cores.linha}
            strokeWidth={grossura}
            dot={{ r: raio, strokeWidth: 0, fill: cores.linha }}
            activeDot={{ r: raio + 2 }}
            connectNulls={false}
            isAnimationActive={!cores.tamanhoEixo}
          />
          <Line
            type="monotone"
            dataKey="projetada"
            name="projetada"
            stroke={cores.linha}
            strokeWidth={grossura}
            strokeDasharray={cores.tamanhoEixo ? "10 8" : "5 5"}
            dot={{ r: raio, strokeWidth: grossura, fill: cores.fundo, stroke: cores.linha }}
            activeDot={{ r: raio + 2 }}
            connectNulls
            isAnimationActive={!cores.tamanhoEixo}
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
