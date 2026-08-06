"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, CornerDownLeft, Loader2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { MENU } from "@/lib/dashboard/navegacao";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { buscarLocal, type GrupoLocal } from "@/lib/busca/local";

/**
 * Busca global.
 *
 * ============================================================================
 * DUAS FONTES, UM DESENHO — E A BUSCA NUNCA FICA SEM RESPOSTA
 *
 * São TRÊS coisas procuradas ao mesmo tempo:
 *   1. Módulos  — instantâneo, da lista do menu (`MENU`), sem rede.
 *   2. Registros online — `/api/busca`, recortado pelo servidor.
 *   3. Registros offline — o espelho no aparelho, quando a rede cai.
 *
 * Os módulos aparecem no ato, enquanto os registros ainda estão vindo: digitar
 * "vis" mostra "Visitantes" antes de a rede responder. Se a rede falha, a busca
 * NÃO fica vazia — ela cai no espelho local e avisa que os resultados são do
 * aparelho. Um campo de busca que trava sem internet é inútil justamente no
 * domingo de manhã, que é quando mais se procura alguém.
 *
 * As três fontes devolvem o MESMO formato (`Grupo`), então o teclado, a
 * navegação e o desenho não sabem de onde veio cada resultado.
 * ============================================================================
 */

interface Achado {
  id: string;
  titulo: string;
  subtitulo: string;
  href: string;
}
interface Grupo {
  chave: string;
  secao: string;
  itens: Achado[];
}

/** Ignora acento e caixa: "joao" acha "João". */
function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Busca nos módulos do menu — instantânea e sempre disponível. */
function buscarModulos(termo: string, podeVer: (chave: string) => boolean): Grupo | null {
  const t = normalizar(termo.trim());
  if (!t) return null;
  const itens = MENU.filter(
    (i) =>
      podeVer(i.chave) &&
      (normalizar(i.rotulo).includes(t) || normalizar(i.descricao).includes(t)),
  ).map((i) => ({
    id: `modulo-${i.chave}`,
    titulo: i.rotulo,
    subtitulo: i.descricao,
    href: i.href,
  }));
  return itens.length > 0 ? { chave: "modulos", secao: "Módulos", itens } : null;
}

function paraGrupos(brutos: GrupoLocal[]): Grupo[] {
  return brutos.map((g) => ({
    chave: g.chave,
    secao: g.secao,
    itens: g.itens.map((i) => ({
      id: `${g.chave}-${i.id}`,
      titulo: i.titulo,
      subtitulo: i.subtitulo,
      href: i.href,
    })),
  }));
}

export function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const id = useId();
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [registros, setRegistros] = useState<Grupo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [origem, setOrigem] = useState<"online" | "offline" | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const { podeVer } = useAcesso();

  // Módulos: instantâneos, recalculados a cada tecla.
  const grupoModulos = useMemo(() => buscarModulos(termo, podeVer), [termo, podeVer]);

  // Registros: com atraso (debounce), do servidor ou do espelho local.
  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) {
      setRegistros([]);
      setOrigem(null);
      setCarregando(false);
      return;
    }

    let cancelado = false;
    const controle = new AbortController();
    setCarregando(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/busca?q=${encodeURIComponent(t)}`, {
          signal: controle.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const dados = await res.json();
        if (cancelado) return;
        setRegistros(paraGrupos(dados.grupos ?? []));
        setOrigem("online");
      } catch (e) {
        if ((e as Error).name === "AbortError" || cancelado) return;
        /*
         * A rede falhou — cai no espelho do aparelho. É por isso que a busca
         * continua útil sem sinal: o que desceu no cache responde, e a tela
         * avisa que os resultados são locais.
         */
        const local = await buscarLocal(t, podeVer);
        if (cancelado) return;
        setRegistros(paraGrupos(local));
        setOrigem("offline");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }, 220);

    return () => {
      cancelado = true;
      controle.abort();
      clearTimeout(timer);
    };
  }, [termo, podeVer]);

  const grupos = useMemo<Grupo[]>(
    () => [...(grupoModulos ? [grupoModulos] : []), ...registros],
    [grupoModulos, registros],
  );

  // Lista achatada, para a navegação por teclado atravessar as seções.
  const planos = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);

  // Ctrl/Cmd + K — o atalho que todo mundo já tenta antes de procurar o campo.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        campo.current?.focus();
        campo.current?.select();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  // Clique fora fecha a lista.
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

  useEffect(() => setIndice(0), [termo]);

  function irPara(a: Achado) {
    setAberto(false);
    setTermo("");
    campo.current?.blur();
    router.push(a.href);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setAberto(false);
      campo.current?.blur();
      return;
    }
    if (planos.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => (i + 1) % planos.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => (i - 1 + planos.length) % planos.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      irPara(planos[indice]);
    }
  }

  const mostrarPainel = aberto && termo.trim().length > 0;
  const vazio = mostrarPainel && !carregando && planos.length === 0 && termo.trim().length >= 2;

  return (
    <div ref={caixa} className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex h-10 items-center gap-2.5 rounded-xl border px-3 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          aberto
            ? "border-gold-400/35 bg-brand-900/70 shadow-[0_0_0_3px_rgba(212,175,55,0.10)]"
            : "border-white/10 bg-white/[0.04] hover:border-white/20",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-brand-300/70" />
        <input
          ref={campo}
          id={id}
          type="search"
          role="combobox"
          aria-expanded={mostrarPainel}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={aoTeclar}
          placeholder="Pesquisar alunos, professores, classes…"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-[0.84rem] text-brand-50 placeholder:text-brand-200/40",
            "focus:outline-none",
            "[&::-webkit-search-cancel-button]:appearance-none",
          )}
        />
        {carregando ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-300/60" />
        ) : (
          <kbd className="hidden shrink-0 rounded border border-white/12 bg-white/5 px-1.5 py-0.5 font-sans text-[0.62rem] text-brand-200/50 lg:inline-block">
            Ctrl K
          </kbd>
        )}
      </div>

      <AnimatePresence>
        {mostrarPainel && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[24rem] overflow-y-auto overscroll-contain rounded-2xl p-2"
          >
            {origem === "offline" && planos.length > 0 && (
              <div className="mb-1 flex items-center gap-1.5 rounded-lg bg-gold-400/[0.08] px-2.5 py-1.5 text-[0.7rem] text-gold-200/90">
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                Sem internet — resultados guardados neste aparelho.
              </div>
            )}

            {planos.length > 0 ? (
              <ul id={`${id}-lista`} role="listbox">
                {grupos.map((g) => (
                  <li key={g.chave} role="group">
                    <p
                      className="px-2 pb-1.5 pt-2 text-[0.62rem] uppercase tracking-[0.18em] text-brand-200/40"
                      aria-hidden="true"
                    >
                      {g.secao}
                    </p>
                    <ul role="none">
                      {g.itens.map((a) => {
                        const i = planos.findIndex((p) => p.id === a.id);
                        return (
                          <li key={a.id} role="option" aria-selected={i === indice}>
                            <button
                              type="button"
                              onMouseEnter={() => setIndice(i)}
                              onClick={() => irPara(a)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200",
                                i === indice ? "bg-white/8" : "hover:bg-white/5",
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[0.84rem] text-brand-50">{a.titulo}</p>
                                <p className="truncate text-[0.72rem] text-brand-200/55">{a.subtitulo}</p>
                              </div>
                              {i === indice && (
                                <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-brand-300/60" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : carregando ? (
              <div className="px-3 py-6 text-center text-[0.8rem] text-brand-200/50">
                Procurando…
              </div>
            ) : vazio ? (
              <div className="px-3 py-4 text-center">
                <p className="text-[0.82rem] text-brand-100/80">
                  Nada encontrado para “{termo.trim()}”.
                </p>
                <p className="mt-1.5 text-[0.72rem] leading-relaxed text-brand-200/50">
                  A busca cobre módulos, alunos, professores, classes, congregações
                  e visitantes que o seu acesso enxerga.
                </p>
              </div>
            ) : (
              <div className="px-3 py-4 text-center text-[0.78rem] text-brand-200/50">
                Digite ao menos duas letras.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
