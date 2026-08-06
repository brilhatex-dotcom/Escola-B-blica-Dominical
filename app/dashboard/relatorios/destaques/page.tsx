"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Award,
  BookOpen,
  Flame,
  GraduationCap,
  Heart,
  Loader2,
  Sparkles,
  Sprout,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CabecalhoModulo, EstadoErro } from "@/components/dashboard/PaginaModulo";
import type { Categorias, RespostaDestaques } from "./tipos";

/**
 * "Destaques" — o Índice de Destaque Inteligente (IDI), em dez categorias,
 * mais o Hall da Fama (Fase 21).
 *
 * ============================================================================
 * ESTA TELA E A DE DETALHE (`[categoria]/page.tsx`) LEEM A MESMA ROTA
 *
 * `/api/relatorios/destaques` já devolve as dez categorias inteiras — nota,
 * motivo, indicadores. A tela de detalhe não tem uma segunda apuração: ela
 * pede o MESMO JSON de novo (o período muda pela URL) e mostra só a
 * categoria escolhida. Ver o comentário grande na rota para o porquê.
 * ============================================================================
 */

interface CategoriaMeta {
  chave: keyof Categorias;
  titulo: string;
  icone: LucideIcon;
  emoji: string;
}

const CATEGORIAS_META: CategoriaMeta[] = [
  { chave: "congregacaoDestaque", titulo: "Congregação Destaque", icone: Trophy, emoji: "🏆" },
  { chave: "maiorCrescimento", titulo: "Maior Crescimento", icone: Flame, emoji: "📈" },
  { chave: "melhorFrequencia", titulo: "Melhor Frequência", icone: Users, emoji: "👥" },
  { chave: "destaqueEvangelismo", titulo: "Destaque em Evangelismo", icone: Sprout, emoji: "🌱" },
  { chave: "melhorConsolidacao", titulo: "Melhor Consolidação", icone: Heart, emoji: "❤️" },
  { chave: "professorDestaque", titulo: "Professor Destaque", icone: GraduationCap, emoji: "👨‍🏫" },
  { chave: "classeDestaque", titulo: "Classe Destaque", icone: BookOpen, emoji: "📚" },
  { chave: "congregacaoRevelacao", titulo: "Congregação Revelação", icone: Star, emoji: "⭐" },
  { chave: "melhorEvolucaoTrimestral", titulo: "Melhor Evolução Trimestral", icone: Award, emoji: "🏅" },
  { chave: "melhorEvolucaoAnual", titulo: "Melhor Evolução Anual", icone: Award, emoji: "🏅" },
];

type Modo = "mensal" | "trimestral" | "anual" | "personalizado";

export default function DestaquesPage() {
  const [modo, setModo] = useState<Modo>("mensal");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [dados, setDados] = useState<RespostaDestaques | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (modo === "personalizado" && (!de || !ate)) return;

    const controle = new AbortController();
    const espera = setTimeout(() => {
      (async () => {
        try {
          setCarregando(true);
          setErro(null);
          const params = new URLSearchParams({ periodo: modo });
          if (modo === "personalizado") {
            params.set("de", de);
            params.set("ate", ate);
          }
          const res = await fetch(`/api/relatorios/destaques?${params}`, { signal: controle.signal, cache: "no-store" });
          const corpo = await res.json();
          if (!res.ok) throw new Error(corpo?.erro ?? `HTTP ${res.status}`);
          setDados(corpo);
          if (modo !== "personalizado") {
            setDe(corpo.periodo.de);
            setAte(corpo.periodo.ate);
          }
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          setErro((e as Error).message || "Não foi possível calcular os destaques.");
        } finally {
          setCarregando(false);
        }
      })();
    }, modo === "personalizado" ? 350 : 0);

    return () => {
      controle.abort();
      clearTimeout(espera);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, de, ate]);

  const query = useMemo(() => {
    const p = new URLSearchParams({ periodo: modo });
    if (modo === "personalizado" && de && ate) {
      p.set("de", de);
      p.set("ate", ate);
    }
    return p.toString();
  }, [modo, de, ate]);

  return (
    <>
      <CabecalhoModulo
        icone={Sparkles}
        titulo="Destaques"
        descricao="Índice de Destaque Inteligente (IDI) — dez categorias, calculadas a partir da chamada real"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            {(["mensal", "trimestral", "anual", "personalizado"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[0.72rem] uppercase tracking-wide transition-colors duration-300",
                  modo === m ? "bg-gold-400/15 text-gold-200" : "text-brand-200/55 hover:text-brand-100",
                )}
              >
                {m === "mensal" ? "Mês" : m === "trimestral" ? "Trimestre" : m === "anual" ? "Ano" : "Período"}
              </button>
            ))}
          </div>
          {modo === "personalizado" && (
            <>
              <input
                type="date"
                value={de}
                max={ate || undefined}
                onChange={(e) => setDe(e.target.value)}
                className="h-9 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 text-[0.78rem] text-brand-50 [color-scheme:dark] focus:border-gold-400/40 focus:outline-none"
              />
              <input
                type="date"
                value={ate}
                min={de || undefined}
                onChange={(e) => setAte(e.target.value)}
                className="h-9 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 text-[0.78rem] text-brand-50 [color-scheme:dark] focus:border-gold-400/40 focus:outline-none"
              />
            </>
          )}
          {carregando && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-200/50" />}
        </div>
      </CabecalhoModulo>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : !dados ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-busy="true">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="glass-panel h-32 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <p className="-mt-2 text-[0.74rem] text-brand-200/45">
            Período analisado: {diaMes(dados.periodo.de)} a {diaMes(dados.periodo.ate)}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {CATEGORIAS_META.map((meta) => (
              <CartaoCategoria key={meta.chave} meta={meta} dados={dados.categorias[meta.chave]} query={query} />
            ))}
          </div>

          {dados.hallDaFama && <HallDaFama hall={dados.hallDaFama} />}
          {!dados.vejoOCampoTodo && (
            <p className="text-center text-[0.72rem] text-brand-200/40">
              O Hall da Fama e a comparação entre congregações ficam disponíveis para quem enxerga o campo inteiro.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function diaMes(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

function CartaoCategoria({
  meta,
  dados,
  query,
}: {
  meta: CategoriaMeta;
  dados: Categorias[keyof Categorias];
  query: string;
}) {
  const Icone = meta.icone;
  const semDado = !dados || dados.ids.length === 0;

  return (
    <Link
      href={`/dashboard/relatorios/destaques/${meta.chave}?${query}`}
      className={cn(
        "glass-panel group block rounded-2xl p-4 transition-colors duration-300 hover:border-gold-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
        semDado && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/8">
          <Icone className="h-4 w-4 text-gold-300" />
        </span>
        <p className="min-w-0 truncate text-[0.72rem] font-medium uppercase tracking-[0.08em] text-brand-200/60">
          {meta.emoji} {meta.titulo}
        </p>
      </div>

      {semDado ? (
        <p className="mt-3 text-[0.78rem] italic text-brand-200/45">
          {dados?.motivos ?? "Sem dado suficiente neste período."}
        </p>
      ) : (
        <>
          <p className="mt-3 truncate font-display text-[1rem] font-semibold text-white group-hover:text-gold-200">
            {dados.nomes.join(" e ")}
          </p>
          {dados.nota !== null && (
            <p className="mt-0.5 text-[0.78rem] tabular-nums text-brand-200/55">
              {dados.nota}
              {meta.chave === "congregacaoDestaque" ? " / 100" : "%"}
            </p>
          )}
        </>
      )}
    </Link>
  );
}

function HallDaFama({ hall }: { hall: NonNullable<RespostaDestaques["hallDaFama"]> }) {
  return (
    <section className="glass-panel rounded-2xl p-5">
      <h2 className="mb-1 flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-gold-200/80">
        <Trophy className="h-4 w-4" />
        Hall da Fama
      </h2>
      <p className="mb-4 text-[0.72rem] text-brand-200/45">
        Calculado ao vivo a partir da chamada real de cada período já fechado — não é uma foto salva à parte, é a
        mesma conta do IDI aplicada ao mês, trimestre e ano anteriores.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <EntradaHall titulo="Congregação do Mês" entrada={hall.congregacaoDoMes} />
        <EntradaHall titulo="Congregação do Trimestre" entrada={hall.congregacaoDoTrimestre} />
        <EntradaHall titulo="Congregação do Ano" entrada={hall.congregacaoDoAno} />
      </div>
    </section>
  );
}

function EntradaHall({ titulo, entrada }: { titulo: string; entrada: { nomes: string[]; nota: number | null } | null }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
      <p className="text-[0.68rem] uppercase tracking-[0.1em] text-brand-200/50">{titulo}</p>
      {entrada ? (
        <>
          <p className="mt-1 truncate font-display text-[0.94rem] font-semibold text-gold-200">{entrada.nomes.join(" e ")}</p>
          {entrada.nota !== null && <p className="mt-0.5 text-[0.72rem] text-brand-200/55">IDI {entrada.nota} / 100</p>}
        </>
      ) : (
        <p className="mt-1 text-[0.76rem] italic text-brand-200/45">Sem dado suficiente nesse período.</p>
      )}
    </div>
  );
}
