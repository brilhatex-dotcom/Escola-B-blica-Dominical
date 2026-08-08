"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Building2, CalendarRange, Loader2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Destaque, Destaques } from "@/lib/dashboard/tipos";

/**
 * Congregação Destaque — quem mais veio e mais trouxe gente, no mês, no
 * trimestre, ou num período escolhido na tela (Fase 20).
 *
 * ============================================================================
 * SÓ CONGREGAÇÃO, DE PROPÓSITO — E SEMPRE O CAMPO INTEIRO
 *
 * Este cartão do Dashboard mostra só a Congregação Destaque, nunca a Classe
 * Destaque (essa fica na tela cheia de Relatórios → Destaques, que também
 * tem mais nove categorias e o Hall da Fama). Duas razões: um cartão do
 * Dashboard não é lugar para explicar por que "Classe Destaque" É recortada
 * pelo acesso de quem vê e "Congregação Destaque" NÃO é — e cortar a
 * segunda linha corta a pergunta antes dela nascer. A Congregação Destaque
 * em si é sempre o resultado real do campo inteiro (Fase 22, pedido
 * explícito da liderança): mesmo quem só enxerga a própria congregação vê
 * aqui quem venceu no campo todo, não um resultado limitado ao que o acesso
 * dela alcança.
 * ============================================================================
 *
 * ============================================================================
 * O QUE O DESTAQUE PREMIA: ASSIDUIDADE + TRAZER VISITANTE, NUNCA TAMANHO
 *
 * A nota é a MÉDIA de duas taxas — nunca um total bruto. "Presentes ÷
 * chamados" pergunta "essa gente vem sempre?"; "domingos com visitante ÷
 * domingos com chamada" pergunta "essa gente traz alguém?" — não "quantos
 * visitantes trouxe", porque isso premiaria sempre a congregação maior.
 *
 * Sem pelo menos 3 domingos com chamada no período, ninguém entra na disputa
 * — a mesma trava do Ranking e dos Certificados. Sem isso, uma congregação
 * que fez chamada uma vez, com 100% de presença, venceria uma que compareceu
 * 11 dos 12 domingos do trimestre.
 * ============================================================================
 *
 * ============================================================================
 * "PERÍODO" BUSCA À PARTE — MÊS E TRIMESTRE JÁ VÊM PRONTOS
 *
 * `destaques` chega no painel inteiro, calculado no servidor para o mês e o
 * trimestre corrente — trocar entre os dois é só troca de estado, sem rede.
 * Só quando a pessoa escolhe DATAS PRÓPRIAS é que o cartão busca
 * `/api/dashboard/destaque?de=&ate=`, pedindo exatamente aquele período — sem
 * recarregar o resto do Dashboard para isso.
 * ============================================================================
 */

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

type Modo = "mensal" | "trimestral" | "personalizado";

interface ResultadoCustom {
  congregacao: Destaque | null;
}

export function DestaqueCard({ destaques, className }: { destaques: Destaques; className?: string }) {
  const [modo, setModo] = useState<Modo>("mensal");
  const [de, setDe] = useState(destaques.periodo.mensal.de);
  const [ate, setAte] = useState(destaques.periodo.mensal.ate);
  const [custom, setCustom] = useState<ResultadoCustom | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (modo !== "personalizado") return;
    if (!de || !ate) return;

    const controle = new AbortController();
    // Espera a pessoa parar de mexer nas datas antes de buscar — sem isso,
    // trocar "01" por "02" no dia dispararia uma requisição por dígito.
    const espera = setTimeout(() => {
      (async () => {
        try {
          setCarregando(true);
          setErro(null);
          const res = await fetch(`/api/dashboard/destaque?de=${de}&ate=${ate}`, {
            signal: controle.signal,
            cache: "no-store",
          });
          const corpo = await res.json();
          if (!res.ok) throw new Error(corpo?.erro ?? `HTTP ${res.status}`);
          setCustom({ congregacao: corpo.congregacao });
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          setErro((e as Error).message || "Não foi possível calcular este período.");
        } finally {
          setCarregando(false);
        }
      })();
    }, 350);

    return () => {
      controle.abort();
      clearTimeout(espera);
    };
  }, [modo, de, ate]);

  const cong = modo === "personalizado" ? (custom?.congregacao ?? null) : destaques.congregacao[modo];
  const janela = modo === "personalizado" ? { de, ate } : destaques.periodo[modo];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={cn("glass-panel relative overflow-hidden rounded-2xl p-5", className)}
      aria-labelledby="titulo-destaque"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/35 to-transparent"
      />

      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 shrink-0 text-gold-300" />
          <h2
            id="titulo-destaque"
            className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white"
          >
            Destaque
          </h2>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {(["mensal", "trimestral", "personalizado"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[0.68rem] uppercase tracking-wide transition-colors duration-300",
                modo === m ? "bg-gold-400/15 text-gold-200" : "text-brand-200/55 hover:text-brand-100",
              )}
            >
              {m === "personalizado" && <CalendarRange className="h-3 w-3" />}
              {m === "mensal" ? "Mês" : m === "trimestral" ? "Trimestre" : "Período"}
            </button>
          ))}
        </div>
      </header>

      {modo === "personalizado" && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[0.7rem] text-brand-200/55">
            De
            <input
              type="date"
              value={de}
              max={ate}
              onChange={(e) => setDe(e.target.value)}
              className="h-8 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[0.76rem] text-brand-50 [color-scheme:dark] focus:border-gold-400/40 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[0.7rem] text-brand-200/55">
            Até
            <input
              type="date"
              value={ate}
              min={de}
              onChange={(e) => setAte(e.target.value)}
              className="h-8 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[0.76rem] text-brand-50 [color-scheme:dark] focus:border-gold-400/40 focus:outline-none"
            />
          </label>
          {carregando && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-200/50" />}
        </div>
      )}

      <p className="mb-3 text-[0.68rem] text-brand-200/45">
        {fmtData.format(new Date(`${janela.de}T12:00:00`))} a {fmtData.format(new Date(`${janela.ate}T12:00:00`))}
        {" — assiduidade + visitantes trazidos"}
      </p>

      {erro && modo === "personalizado" ? (
        <p className="rounded-xl border border-flame-500/25 bg-flame-500/[0.06] px-3.5 py-3 text-[0.78rem] text-flame-300">
          {erro}
        </p>
      ) : (
        <div className="space-y-3">
          <LinhaDestaque icone={Building2} rotulo="Congregação Destaque" destaque={cong} carregando={carregando} />
        </div>
      )}

      {/*
        Este cartão continua sendo o resumo rápido (assiduidade + visitante) —
        a versão completa, com dez categorias, o Índice de Destaque
        Inteligente e o Hall da Fama, é grande demais para um cartão do
        Dashboard e ganhou uma tela própria (Fase 21).
      */}
      <Link
        href="/dashboard/relatorios/destaques"
        className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] py-2 text-[0.72rem] text-brand-200/60 transition-colors duration-300 hover:border-gold-400/25 hover:text-gold-200"
      >
        Ver todos os destaques
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </motion.section>
  );
}

function LinhaDestaque({
  icone: Icone,
  rotulo,
  destaque,
  carregando = false,
}: {
  icone: typeof Building2;
  rotulo: string;
  destaque: Destaque | null;
  carregando?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
      <p className="mb-1 flex items-center gap-1.5 text-[0.66rem] uppercase tracking-[0.1em] text-brand-200/50">
        <Icone className="h-3 w-3 shrink-0" />
        {rotulo}
      </p>
      {carregando ? (
        <p className="text-[0.78rem] italic text-brand-200/45">Calculando…</p>
      ) : destaque ? (
        <>
          <p className="truncate font-display text-[0.94rem] font-semibold text-gold-200">
            {destaque.nomes.join(" e ")}
          </p>
          <p className="mt-0.5 text-[0.72rem] text-brand-200/55">
            {destaque.taxaFrequencia}% de presença · {destaque.taxaVisitantes}% dos domingos com visitante
          </p>
        </>
      ) : (
        <p className="text-[0.78rem] italic text-brand-200/45">
          Ainda sem dado suficiente neste período — precisa de ao menos 3 domingos com chamada.
        </p>
      )}
    </div>
  );
}
