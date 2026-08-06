"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowLeft, Minus, Radar as RadarIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CabecalhoModulo, EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import type { PontoLinha, SerieLinha } from "@/components/relatorios/GraficoLinhaComparativa";
import type { SerieRadar } from "@/components/relatorios/GraficoRadar";

/**
 * Comparativo — congregação × congregação.
 *
 * ============================================================================
 * A PERGUNTA QUE O RANKING NÃO RESPONDE
 *
 * O Ranking (Relatórios → Ranking) já ordena as 14 congregações por taxa de
 * frequência — mas ordenar não é comparar: uma lista diz QUEM está na frente,
 * não O QUÊ faz a diferença entre uma e outra. Esta tela pega de 2 a 4
 * congregações escolhidas e sobrepõe o PERFIL delas (radar, os 5 componentes
 * do Índice de Saúde) e a EVOLUÇÃO (linha, 6 meses) — é aqui que aparece que a
 * Cong. A e a Cong. B têm a mesma nota por caminhos opostos.
 * ============================================================================
 *
 * O teto de 4 congregações não é limitação técnica — é legibilidade. Um radar
 * com 14 polígonos sobrepostos é uma nuvem colorida ilegível, inclusive no
 * celular. Ver `lib/relatorios/indices.ts` → `COMPARATIVO_MAXIMO`.
 */

const GraficoRadar = dynamic(
  () => import("@/components/relatorios/GraficoRadar").then((m) => m.GraficoRadar),
  { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-white/[0.03] sm:h-80" /> },
);
const GraficoLinhaComparativa = dynamic(
  () =>
    import("@/components/relatorios/GraficoLinhaComparativa").then((m) => m.GraficoLinhaComparativa),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/[0.03] sm:h-72" /> },
);

/** Paleta fixa — a mesma congregação sempre com a mesma cor entre um recarregamento e outro. */
const CORES = ["#5578b4", "#D4AF37", "#34d399", "#e88a8a"];

interface CongOpcao {
  id: number;
  nome: string;
}

type Faixa = "excelente" | "muito-boa" | "atencao" | "critica";
interface Classificacao {
  faixa: Faixa;
  rotulo: string;
  emoji: string;
}
interface CongregacaoComparada {
  congId: number;
  nome: string;
  chamadas: number;
  dadosSuficientes: boolean;
  taxaFrequencia: number | null;
  tendenciaPct: number | null;
  visitantesAnt: number;
  visitantesRec: number;
  componentes: {
    frequencia: number | null;
    regularidade: number | null;
    tendencia: number | null;
    visitantes: number | null;
    faltosos: number | null;
  };
  igs: { nota: number; componentesUsados: string[] } | null;
  classificacao: Classificacao | null;
  serieMensal: Array<{ mes: string; taxa: number | null }>;
}
interface RespostaComparativo {
  periodo: { de: string; ate: string };
  congregacoes: CongregacaoComparada[];
  limites: { minimo: number; maximo: number };
}

const CORES_FAIXA: Record<Faixa, string> = {
  excelente: "#34d399",
  "muito-boa": "#5578b4",
  atencao: "#D4AF37",
  critica: "#D62828",
};

const EIXOS_RADAR: Record<string, string> = {
  frequencia: "Frequência",
  regularidade: "Regularidade",
  tendencia: "Tendência",
  visitantes: "Visitantes",
  faltosos: "Presença contínua",
};

export default function ComparativoPage() {
  const [opcoes, setOpcoes] = useState<CongOpcao[]>([]);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(true);
  const [erroOpcoes, setErroOpcoes] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [dados, setDados] = useState<RespostaComparativo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // A lista de congregações para escolher — o mesmo recorte de acesso já
  // filtra o que vem daqui; ninguém compara o que não pode ver.
  useEffect(() => {
    void fetch("/api/congregacoes", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.erro ?? `HTTP ${r.status}`);
        return d;
      })
      .then((d) => {
        const lista = (d.itens ?? []).map((c: { id: number; nome: string }) => ({
          id: c.id,
          nome: c.nome,
        }));
        setOpcoes(lista);
        // Começa com as duas primeiras — poupa quem só quer olhar uma vez.
        if (lista.length >= 2) setSelecionadas([lista[0].id, lista[1].id]);
        else if (lista.length === 1) setSelecionadas([lista[0].id]);
      })
      .catch((e) => {
        setOpcoes([]);
        setErroOpcoes(
          (e as Error).message || "Não foi possível carregar as congregações. Verifique a conexão e tente de novo.",
        );
      })
      .finally(() => setCarregandoOpcoes(false));
  }, []);

  useEffect(() => {
    if (selecionadas.length < 2) {
      setDados(null);
      return;
    }
    const controle = new AbortController();
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const url = new URL("/api/relatorios/comparativo", window.location.origin);
        url.searchParams.set("cong", selecionadas.join(","));
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        const corpo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(corpo.erro ?? `HTTP ${res.status}`);
        setDados(corpo);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setErro((e as Error).message || "Não foi possível comparar agora.");
        setDados(null);
      } finally {
        setCarregando(false);
      }
    })();
    return () => controle.abort();
  }, [selecionadas]);

  function alternar(id: number) {
    setSelecionadas((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      if (atual.length >= 4) return atual; // o teto é silencioso aqui — o botão já fica desabilitado
      return [...atual, id];
    });
  }

  const seriesRadar = useMemo<SerieRadar[]>(
    () =>
      (dados?.congregacoes ?? []).map((c, i) => ({
        nome: c.nome,
        cor: CORES[i % CORES.length],
        valores: Object.fromEntries(
          Object.entries(c.componentes).map(([chave, valor]) => [
            EIXOS_RADAR[chave] ?? chave,
            valor,
          ]),
        ),
      })),
    [dados],
  );

  const { pontosLinha, seriesLinha } = useMemo(() => {
    const congs = dados?.congregacoes ?? [];
    const meses = congs[0]?.serieMensal.map((p) => p.mes) ?? [];
    const pontos: PontoLinha[] = meses.map((mes, i) => {
      const linha: PontoLinha = { mes };
      congs.forEach((c) => {
        linha[c.nome] = c.serieMensal[i]?.taxa ?? null;
      });
      return linha;
    });
    const series: SerieLinha[] = congs.map((c, i) => ({ nome: c.nome, cor: CORES[i % CORES.length] }));
    return { pontosLinha: pontos, seriesLinha: series };
  }, [dados]);

  return (
    <>
      <Link
        href="/dashboard/relatorios"
        className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] text-brand-200/60 transition-colors duration-300 hover:text-gold-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Painel de Relatórios
      </Link>

      <CabecalhoModulo
        icone={RadarIcon}
        titulo="Comparativo"
        descricao="Congregação × congregação: o perfil e a evolução, lado a lado"
      />

      {/* ---------------- Seletor ---------------- */}
      <div className="glass-panel mb-4 rounded-2xl p-4">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.1em] text-brand-200/50">
          Escolha de 2 a 4 congregações
        </p>
        <div className="flex flex-wrap gap-2">
          {opcoes.map((c) => {
            const ativa = selecionadas.includes(c.id);
            const desabilitada = !ativa && selecionadas.length >= 4;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => alternar(c.id)}
                disabled={desabilitada}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[0.8rem] transition-colors duration-300",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
                  ativa
                    ? "border-gold-400/40 bg-gold-400/15 text-gold-100"
                    : "border-white/10 bg-white/[0.03] text-brand-200/65 hover:border-white/20",
                  desabilitada && "cursor-not-allowed opacity-35",
                )}
              >
                {c.nome}
              </button>
            );
          })}
          {carregandoOpcoes && (
            <p className="text-[0.8rem] text-brand-200/45">Carregando congregações…</p>
          )}
          {!carregandoOpcoes && opcoes.length === 0 && !erroOpcoes && (
            <p className="text-[0.8rem] text-brand-200/45">Nenhuma congregação encontrada.</p>
          )}
        </div>
        {erroOpcoes && <EstadoErro mensagem={erroOpcoes} />}
        {opcoes.length === 1 && (
          <p className="mt-3 text-[0.76rem] text-brand-200/50">
            O seu acesso alcança só esta congregação — não há com o que comparar.
          </p>
        )}
      </div>

      {erro && <EstadoErro mensagem={erro} />}

      {carregando && !dados ? (
        <EsqueletoLista linhas={4} />
      ) : dados ? (
        <div className="space-y-5">
          {/* ---------------- Radar ---------------- */}
          <section className="glass-panel rounded-2xl p-5">
            <h2 className="mb-1 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
              Perfil — os 5 componentes do Índice de Saúde
            </h2>
            <p className="mb-3 text-[0.72rem] text-brand-200/45">
              Duas congregações podem ter a mesma nota por caminhos opostos. O formato do polígono
              mostra qual.
            </p>
            <GraficoRadar series={seriesRadar} />
            <div className="mt-3 flex flex-wrap gap-3 border-t border-white/8 pt-3">
              {dados.congregacoes.map((c, i) => (
                <span key={c.congId} className="flex items-center gap-1.5 text-[0.76rem] text-brand-100/80">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: CORES[i % CORES.length] }}
                  />
                  {c.nome}
                  {!c.dadosSuficientes && (
                    <span className="text-brand-200/40">(dados insuficientes)</span>
                  )}
                </span>
              ))}
            </div>
          </section>

          {/* ---------------- Linha comparativa ---------------- */}
          <section className="glass-panel rounded-2xl p-5">
            <h2 className="mb-1 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
              Evolução — últimos 6 meses
            </h2>
            <p className="mb-3 text-[0.72rem] text-brand-200/45">
              Frequência média mensal de cada congregação. Um mês sem chamada aparece como um vão
              na linha, não como 0%.
            </p>
            <GraficoLinhaComparativa dados={pontosLinha} series={seriesLinha} />
          </section>

          {/* ---------------- Tabela compacta ---------------- */}
          <section className="glass-panel overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/8 text-[0.68rem] uppercase tracking-[0.1em] text-brand-200/50">
                    <th className="px-4 py-3 font-medium">Congregação</th>
                    <th className="px-3 py-3 font-medium">Índice</th>
                    <th className="px-3 py-3 font-medium">Frequência</th>
                    <th className="px-3 py-3 font-medium">Tendência</th>
                    <th className="px-3 py-3 font-medium">Visitantes</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.congregacoes.map((c, i) => {
                    const TendIcone =
                      c.tendenciaPct === null || Math.abs(c.tendenciaPct) < 3
                        ? Minus
                        : c.tendenciaPct > 0
                          ? TrendingUp
                          : TrendingDown;
                    return (
                      <tr key={c.congId} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2 text-[0.84rem] text-brand-50">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ background: CORES[i % CORES.length] }}
                            />
                            {c.nome}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {c.igs && c.classificacao ? (
                            <Badge
                              variant="neutro"
                              style={{
                                background: `${CORES_FAIXA[c.classificacao.faixa]}26`,
                                color: CORES_FAIXA[c.classificacao.faixa],
                              }}
                            >
                              {c.igs.nota} · {c.classificacao.emoji}
                            </Badge>
                          ) : (
                            <span className="text-[0.78rem] text-brand-200/40">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[0.84rem] tabular-nums text-brand-100/85">
                          {c.taxaFrequencia !== null ? `${Math.round(c.taxaFrequencia)}%` : "—"}
                        </td>
                        <td className="px-3 py-3">
                          {c.tendenciaPct !== null ? (
                            <span
                              className={cn(
                                "flex items-center gap-1 text-[0.82rem] tabular-nums",
                                Math.abs(c.tendenciaPct) < 3
                                  ? "text-brand-200/50"
                                  : c.tendenciaPct > 0
                                    ? "text-emerald-300"
                                    : "text-flame-400",
                              )}
                            >
                              <TendIcone className="h-3.5 w-3.5" />
                              {c.tendenciaPct > 0 ? "+" : ""}
                              {c.tendenciaPct}%
                            </span>
                          ) : (
                            <span className="text-[0.78rem] text-brand-200/40">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[0.84rem] tabular-nums text-brand-100/85">
                          {c.visitantesAnt + c.visitantesRec}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : selecionadas.length < 2 && opcoes.length > 1 ? (
        <Alert tipo="info" titulo="Escolha ao menos duas congregações">
          Toque em duas ou mais congregações acima para ver o perfil e a evolução comparados.
        </Alert>
      ) : null}
    </>
  );
}
