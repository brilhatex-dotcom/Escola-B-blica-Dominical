"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { MENU } from "@/lib/dashboard/navegacao";
import { useAcesso } from "@/components/acesso/AcessoProvider";

/**
 * Busca global.
 *
 * O que existe HOJE e a busca por modulos, que ja e util e ja e real — digitar
 * "vis" e cair em Visitantes funciona. O que ainda nao existe e a busca por
 * REGISTROS (alunos, professores, classes), porque depende das rotas de API da
 * Fase 05.
 *
 * A estrutura, porem, ja esta pronta para os dois: `buscar()` devolve uma lista
 * de `Resultado` agrupada por secao, e ligar os registros e acrescentar uma
 * fonte a essa funcao — nem o teclado, nem a navegacao, nem o desenho mudam.
 *
 * Sobre o estado vazio: em vez de "nenhum resultado", ele diz QUAIS categorias
 * ainda nao entraram. Um campo de busca que nao acha nada e sempre lido como
 * defeito; dizendo o motivo, vira informacao.
 */

interface Resultado {
  chave: string;
  titulo: string;
  subtitulo: string;
  href: string;
  secao: string;
  emBreve?: boolean;
}

/**
 * Ignora acento e caixa: "joao" tem de achar "João".
 *
 * O `NFD` separa a letra do acento e \p{Diacritic} remove os sinais que
 * sobraram. A alternativa comum — uma faixa de codigos escrita direto no
 * regex — sao caracteres invisiveis no editor, que somem numa copia
 * descuidada e levam a busca a parar de achar nomes com acento sem que
 * ninguem entenda por que.
 */
function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * A busca respeita a permissao — senao ela vira a porta dos fundos do menu.
 *
 * De nada adianta esconder "Permissões" da barra lateral se digitar "perm" no
 * campo de busca leva direto para la. A guarda do servidor recusaria a rota,
 * mas o usuario teria passeado por uma tela vazia sem entender o que aconteceu.
 */
function buscar(termo: string, podeVer: (chave: string) => boolean): Resultado[] {
  const t = normalizar(termo.trim());
  if (!t) return [];

  return MENU.filter(
    (i) =>
      podeVer(i.chave) &&
      (normalizar(i.rotulo).includes(t) || normalizar(i.descricao).includes(t)),
  ).map((i) => ({
    chave: i.chave,
    titulo: i.rotulo,
    subtitulo: i.descricao,
    href: i.href,
    secao: "Módulos",
    emBreve: i.emBreve,
  }));
}

export function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const id = useId();
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const { podeVer } = useAcesso();
  const resultados = useMemo(() => buscar(termo, podeVer), [termo, podeVer]);

  // Ctrl/Cmd + K — o atalho que todo mundo ja tenta antes de procurar o campo.
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

  function irPara(r: Resultado) {
    setAberto(false);
    setTermo("");
    campo.current?.blur();
    router.push(r.href);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setAberto(false);
      campo.current?.blur();
      return;
    }
    if (resultados.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => (i + 1) % resultados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => (i - 1 + resultados.length) % resultados.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      irPara(resultados[indice]);
    }
  }

  const mostrarPainel = aberto && termo.trim().length > 0;

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
            // Tira o "x" nativo do type=search, que tem desenho proprio em cada
            // navegador e sempre destoa.
            "[&::-webkit-search-cancel-button]:appearance-none",
          )}
        />
        <kbd className="hidden shrink-0 rounded border border-white/12 bg-white/5 px-1.5 py-0.5 font-sans text-[0.62rem] text-brand-200/50 lg:inline-block">
          Ctrl K
        </kbd>
      </div>

      <AnimatePresence>
        {mostrarPainel && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[22rem] overflow-y-auto overscroll-contain rounded-2xl p-2"
          >
            {resultados.length > 0 ? (
              <ul id={`${id}-lista`} role="listbox">
                <li
                  className="px-2 pb-1.5 pt-1 text-[0.62rem] uppercase tracking-[0.18em] text-brand-200/40"
                  aria-hidden="true"
                >
                  Módulos
                </li>
                {resultados.map((r, i) => (
                  <li key={r.chave} role="option" aria-selected={i === indice}>
                    <button
                      type="button"
                      onMouseEnter={() => setIndice(i)}
                      onClick={() => irPara(r)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200",
                        i === indice ? "bg-white/8" : "hover:bg-white/5",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.84rem] text-brand-50">{r.titulo}</p>
                        <p className="truncate text-[0.72rem] text-brand-200/55">{r.subtitulo}</p>
                      </div>
                      {r.emBreve && (
                        <span className="shrink-0 rounded-full bg-white/6 px-1.5 py-0.5 text-[0.58rem] uppercase tracking-wider text-brand-200/50">
                          em breve
                        </span>
                      )}
                      {i === indice && (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-brand-300/60" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-4 text-center">
                <p className="text-[0.82rem] text-brand-100/80">
                  Nada encontrado para “{termo.trim()}”.
                </p>
                <p className="mt-1.5 text-[0.72rem] leading-relaxed text-brand-200/50">
                  A busca por alunos, professores, classes e visitantes entra
                  quando esses módulos forem publicados.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
