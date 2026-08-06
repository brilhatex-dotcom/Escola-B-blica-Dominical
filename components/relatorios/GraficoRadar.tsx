"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

/**
 * O perfil de uma ou mais congregações, nos cinco eixos do Índice de Saúde.
 *
 * ============================================================================
 * O RADAR MOSTRA O FORMATO, NÃO SÓ O TAMANHO
 *
 * A nota final (o IGS) já existe no Painel, como um número. O que o radar
 * acrescenta é a FORMA: duas congregações podem ter a mesma nota 75 chegando
 * lá por caminhos opostos — uma com frequência ótima e visitantes fracos, outra
 * o contrário — e o número sozinho esconde essa diferença. O polígono não.
 * ============================================================================
 *
 * Eixo sem dado (`valor: null`) entra como 0 no desenho — Recharts não pula
 * pontos nulos num radar sem deformar o polígono dos outros eixos — mas o
 * rótulo continua mostrando o nome do eixo, e a legenda abaixo do gráfico (na
 * página) avisa quando uma congregação tem eixo faltando.
 */

export interface SerieRadar {
  nome: string;
  cor: string;
  valores: Record<string, number | null>;
}

const EIXOS = ["Frequência", "Regularidade", "Tendência", "Visitantes", "Presença contínua"];

export function GraficoRadar({ series }: { series: SerieRadar[] }) {
  const dados = EIXOS.map((eixo) => {
    const linha: Record<string, string | number> = { eixo };
    for (const s of series) linha[s.nome] = s.valores[eixo] ?? 0;
    return linha;
  });

  return (
    <div className="h-72 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={dados} outerRadius="72%">
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis dataKey="eixo" tick={{ fill: "#c3d0e6", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: "#0B1F45",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          {series.map((s) => (
            <Radar
              key={s.nome}
              name={s.nome}
              dataKey={s.nome}
              stroke={s.cor}
              fill={s.cor}
              fillOpacity={0.18}
              strokeWidth={2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
