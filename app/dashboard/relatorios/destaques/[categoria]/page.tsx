"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Sparkles } from "lucide-react";
import { EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import type { Categorias, ComponentesIDI, RespostaDestaques } from "../tipos";

/**
 * O detalhe de UMA categoria de Destaque — nota geral, motivos, os dez
 * indicadores do IDI, e (para vencedores que são congregação) os gráficos de
 * evolução e a comparação com o campo, reaproveitados do prontuário de
 * congregação (Fase 19) — `/api/relatorios/congregacao/[id]` já calcula tudo
 * isso, então esta tela só pede de novo em vez de reinventar.
 */

const GraficoEvolucao = dynamic(
  () => import("@/components/relatorios/GraficoEvolucao").then((m) => m.GraficoEvolucao),
  { ssr: false, loading: () => <div className="h-56 animate-pulse rounded-xl bg-white/[0.03]" /> },
);
const GraficoEvolucaoAnual = dynamic(
  () => import("@/components/relatorios/GraficoEvolucaoAnual").then((m) => m.GraficoEvolucaoAnual),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-xl bg-white/[0.03]" /> },
);

const TITULOS: Record<keyof Categorias, string> = {
  congregacaoDestaque: "🏆 Congregação Destaque",
  maiorCrescimento: "📈 Maior Crescimento",
  melhorFrequencia: "👥 Melhor Frequência",
  destaqueEvangelismo: "🌱 Destaque em Evangelismo",
  melhorConsolidacao: "❤️ Melhor Consolidação",
  professorDestaque: "👨‍🏫 Professor Destaque",
  classeDestaque: "📚 Classe Destaque",
  congregacaoRevelacao: "⭐ Congregação Revelação",
  melhorEvolucaoTrimestral: "🏅 Melhor Evolução Trimestral",
  melhorEvolucaoAnual: "🏅 Melhor Evolução Anual",
};

const ROTULOS_INDICADOR: Record<keyof ComponentesIDI, string> = {
  frequencia: "Frequência",
  regularidade: "Regularidade das chamadas",
  crescimentoTrimestral: "Crescimento trimestral",
  crescimentoAnual: "Crescimento anual",
  visitantes: "Visitantes recebidos",
  visitantesNaoCrentes: "Visitantes não crentes",
  visitantesRetornaram: "Visitantes que retornaram",
  retencaoAlunos: "Retenção de alunos",
  participacaoProfessores: "Participação dos professores",
  igs: "Índice de Saúde (IGS)",
};

interface EvolucaoCongregacao {
  evolucaoMensal: Array<{ mes: string; taxa: number | null; chamadas: number }>;
  evolucaoAnual: Array<{ ano: number; taxa: number | null; chamadas: number }>;
  comparativoCampo: { taxaFrequencia: { congregacao: number | null; campo: number | null } };
}

export default function DetalheDestaquePage({ params }: { params: Promise<{ categoria: string }> }) {
  const { categoria } = use(params);
  const chave = categoria as keyof Categorias;

  const [dados, setDados] = useState<RespostaDestaques | null>(null);
  const [evolucao, setEvolucao] = useState<EvolucaoCongregacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const busca = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(busca);
    if (!params.get("periodo")) params.set("periodo", "mensal");

    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        const res = await fetch(`/api/relatorios/destaques?${params}`, { signal: controle.signal, cache: "no-store" });
        const corpo = await res.json();
        if (!res.ok) throw new Error(corpo?.erro ?? `HTTP ${res.status}`);
        setDados(corpo);

        const detalhe = (corpo.categorias as Categorias)[chave];
        if (detalhe?.tipo === "congregacao" && detalhe.ids.length > 0) {
          const resCong = await fetch(`/api/relatorios/congregacao/${detalhe.ids[0]}`, {
            signal: controle.signal,
            cache: "no-store",
          });
          if (resCong.ok) setEvolucao(await resCong.json());
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setErro((e as Error).message || "Não foi possível carregar este destaque.");
      }
    })();
    return () => controle.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  if (!TITULOS[chave]) {
    return <EstadoErro mensagem="Categoria de destaque desconhecida." />;
  }

  const detalhe = dados?.categorias[chave];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/dashboard/relatorios/destaques"
          className="flex items-center gap-1.5 text-[0.8rem] text-brand-200/60 transition-colors hover:text-gold-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos Destaques
        </Link>
      </div>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : !dados || !detalhe ? (
        <EsqueletoLista linhas={6} />
      ) : (
        <div className="space-y-5">
          <header className="glass-panel rounded-2xl p-5 sm:p-6">
            <p className="text-[0.7rem] uppercase tracking-[0.16em] text-brand-200/50">{TITULOS[chave]}</p>

            {detalhe.ids.length === 0 ? (
              <p className="mt-3 text-[0.9rem] italic text-brand-200/55">{detalhe.motivos}</p>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap items-baseline gap-3">
                  <h1 className="font-display text-[1.4rem] font-semibold text-white">{detalhe.nomes.join(" e ")}</h1>
                  {detalhe.nota !== null && (
                    <span className="font-display text-[1.6rem] font-semibold text-gold-200 tabular-nums">
                      {detalhe.nota}
                      {chave === "congregacaoDestaque" ? <span className="text-[0.9rem] text-brand-200/50"> / 100</span> : "%"}
                    </span>
                  )}
                </div>
                <p className="mt-3 max-w-2xl text-[0.86rem] leading-relaxed text-brand-100/80">{detalhe.motivos}</p>
                <p className="mt-2 text-[0.7rem] text-brand-200/40">
                  Período: {diaMes(dados.periodo.de)} a {diaMes(dados.periodo.ate)}
                </p>
              </>
            )}
          </header>

          {detalhe.indicadores && (
            <section className="glass-panel rounded-2xl p-5">
              <h2 className="mb-1 flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
                <Sparkles className="h-4 w-4" />
                Indicadores usados no IDI
              </h2>
              <p className="mb-3 text-[0.7rem] text-brand-200/40">
                Escala de 0 a 100. Nos dois de crescimento, 50 é estável — acima é crescendo, abaixo é caindo.
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                {(Object.keys(ROTULOS_INDICADOR) as Array<keyof ComponentesIDI>).map((k) => (
                  <div key={k} className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[0.66rem] uppercase tracking-[0.08em] text-brand-200/50">{ROTULOS_INDICADOR[k]}</p>
                    <p className="mt-1 font-display text-[1.05rem] font-semibold text-white tabular-nums">
                      {detalhe.indicadores![k] !== null ? detalhe.indicadores![k] : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {detalhe.tipo === "congregacao" && evolucao ? (
            <>
              <section className="glass-panel rounded-2xl p-5">
                <h2 className="mb-3 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
                  Comparação com o campo
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
                    <p className="text-[0.7rem] text-brand-200/55">Esta congregação</p>
                    <p className="mt-1 font-display text-[1.15rem] font-semibold text-white tabular-nums">
                      {evolucao.comparativoCampo.taxaFrequencia.congregacao ?? "—"}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
                    <p className="text-[0.7rem] text-brand-200/55">Média do campo</p>
                    <p className="mt-1 font-display text-[1.15rem] font-semibold text-white tabular-nums">
                      {evolucao.comparativoCampo.taxaFrequencia.campo ?? "—"}%
                    </p>
                  </div>
                </div>
              </section>

              {evolucao.evolucaoMensal.some((p) => p.taxa !== null) && (
                <section className="glass-panel rounded-2xl p-5">
                  <h2 className="mb-1 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
                    Histórico — últimos 12 meses
                  </h2>
                  <p className="mb-3 text-[0.7rem] text-brand-200/45">Frequência média, mês a mês.</p>
                  <GraficoEvolucao dados={evolucao.evolucaoMensal} />
                </section>
              )}

              {evolucao.evolucaoAnual.some((p) => p.taxa !== null) && (
                <section className="glass-panel rounded-2xl p-5">
                  <h2 className="mb-1 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
                    Evolução anual
                  </h2>
                  <p className="mb-3 text-[0.7rem] text-brand-200/45">Ano a ano, desde o primeiro registro.</p>
                  <GraficoEvolucaoAnual dados={evolucao.evolucaoAnual} />
                </section>
              )}

              <Link
                href={`/dashboard/congregacoes/${detalhe.ids[0]}`}
                className="inline-block text-[0.78rem] text-brand-200/60 underline-offset-4 hover:text-gold-200 hover:underline"
              >
                Ver o prontuário completo desta congregação →
              </Link>
            </>
          ) : detalhe.tipo === "classe" && detalhe.ids.length > 0 ? (
            <Link
              href={`/dashboard/classes/${detalhe.ids[0]}`}
              className="glass-panel block rounded-2xl p-5 text-[0.82rem] text-brand-200/60 transition-colors hover:text-gold-200"
            >
              Gráfico de evolução por classe ainda não existe como tela própria — veja os dados completos da turma
              em /dashboard/classes →
            </Link>
          ) : null}
        </div>
      )}
    </>
  );
}

function diaMes(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}
