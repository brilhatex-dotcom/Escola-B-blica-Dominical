"use client";

import { motion } from "framer-motion";
import { Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Moldura comum dos modulos.
 *
 * Cabecalho, campo de busca, filtros, estados de carregando/vazio/erro. Fica
 * aqui porque sao exatamente as partes que, repetidas em sete telas, acabam
 * divergindo: uma diz "Nenhum resultado", outra "Nada encontrado", uma mostra
 * spinner e outra pisca em branco. Concentradas, todas se comportam igual e uma
 * melhoria vale para todas.
 */

export function CabecalhoModulo({
  icone: Icone,
  titulo,
  descricao,
  total,
  children,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  total?: number | null;
  children?: React.ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mb-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-gold-400/20">
            <Icone className="h-5 w-5 text-gold-300" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[1.25rem] font-semibold uppercase leading-tight tracking-[0.12em] text-white sm:text-[1.4rem]">
              {titulo}
            </h1>
            <p className="mt-1 text-[0.82rem] text-brand-200/60">
              {descricao}
              {typeof total === "number" && (
                <>
                  {" · "}
                  <span className="tabular-nums text-brand-100/80">{total}</span>{" "}
                  {total === 1 ? "registro" : "registros"}
                </>
              )}
            </p>
          </div>
        </div>
        {children}
      </div>
    </motion.header>
  );
}

export function CampoDeBusca({
  valor,
  aoMudar,
  placeholder,
  className,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-10 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3",
        "transition-colors duration-300 focus-within:border-gold-400/35",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-brand-300/70" />
      <input
        type="search"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[0.84rem] text-brand-50 placeholder:text-brand-200/40 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
    </div>
  );
}

/** Seletor simples. `null` no valor significa "todos". */
export function Filtro<T extends { id: number; nome: string }>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string;
  opcoes: T[];
  valor: number | null;
  aoMudar: (v: number | null) => void;
}) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
      <span className="shrink-0 text-brand-200/55">{rotulo}</span>
      <select
        value={valor ?? ""}
        onChange={(e) => aoMudar(e.target.value ? Number(e.target.value) : null)}
        /*
          `bg-brand-900` no <option>: o menu suspenso e desenhado pelo sistema
          operacional, nao pelo CSS da pagina. Sem cor explicita, o Chrome no
          Windows abre uma lista de fundo branco com texto branco — ilegivel.
        */
        className="min-w-0 flex-1 bg-transparent text-brand-50 focus:outline-none [&>option]:bg-brand-900"
      >
        <option value="">Todas</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome || `#${o.id}`}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EstadoVazio({ mensagem, dica }: { mensagem: string; dica?: string }) {
  return (
    <div className="glass-panel rounded-2xl px-6 py-12 text-center">
      <p className="text-[0.9rem] text-brand-100/80">{mensagem}</p>
      {dica && <p className="mx-auto mt-2 max-w-sm text-[0.78rem] text-brand-200/50">{dica}</p>}
    </div>
  );
}

export function EstadoErro({ mensagem }: { mensagem: string }) {
  return (
    <Alert tipo="erro" titulo="Não foi possível carregar">
      {mensagem}
    </Alert>
  );
}

/** Esqueleto de lista, com as medidas das linhas reais. */
export function EsqueletoLista({ linhas = 8 }: { linhas?: number }) {
  return (
    <div className="glass-panel rounded-2xl p-2" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="mt-2 h-3 w-1/4" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}
