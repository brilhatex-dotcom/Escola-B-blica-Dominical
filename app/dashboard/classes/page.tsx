"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Building2, ChevronRight, School, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo,
  CampoDeBusca,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";

/**
 * Classes da EBD, agrupadas por congregação.
 *
 * ============================================================================
 * SÃO 53 CLASSES — LISTÁ-LAS SOLTAS É UMA PAREDE
 *
 * Uma grade com 53 cartões obriga a rolar procurando a congregação certa. Aqui
 * cada congregação é uma seção que abre e fecha: a tela começa recolhida,
 * mostrando quantas classes e alunos cada uma tem, e a pessoa abre só a que
 * quer ver.
 *
 * A busca continua funcionando por cima disso: digitar um nome ABRE
 * automaticamente as seções que têm classe correspondente, para o resultado não
 * ficar escondido atrás de uma seção fechada.
 * ============================================================================
 *
 * A COLUNA "PROFESSORES" MOSTRA PESSOAS, e não o texto que estava na planilha.
 * Onde o cadastro antigo dizia "Pb. Lourival e Aux. Danilo" — uma string —, aqui
 * aparecem as pessoas que existem no cadastro.
 */

interface ClasseLista {
  id: number;
  nome: string;
  faixa: string;
  tipoClasse: string;
  ativa: boolean;
  profOriginal: string | null;
  congregacao: { id: number; nome: string } | null;
  alunos: number;
  professores: Array<{ id: number; nome: string; tratamento: string | null }>;
}

interface Grupo {
  id: number;
  nome: string;
  classes: ClasseLista[];
  alunos: number;
}

function Cartao({ c }: { c: ClasseLista }) {
  return (
    <article className={cn("glass-panel relative overflow-hidden rounded-2xl p-4", !c.ativa && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-display text-[0.9rem] font-semibold text-white">{c.nome}</h3>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/6 px-2 py-1 text-[0.72rem] tabular-nums text-brand-100">
          <Users className="h-3 w-3" />
          {c.alunos}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {c.faixa && <Badge variant="info">{c.faixa}</Badge>}
        {c.tipoClasse && <Badge variant="neutro">{c.tipoClasse}</Badge>}
        {!c.ativa && <Badge variant="erro">inativa</Badge>}
      </div>

      <div className="mt-3 border-t border-white/8 pt-3">
        <p className="text-[0.64rem] uppercase tracking-[0.16em] text-brand-200/40">
          {c.professores.length === 1 ? "Professor" : "Professores"}
        </p>
        {c.professores.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {c.professores.map((p) => (
              <li key={p.id} className="truncate text-[0.8rem] text-brand-50">
                {p.tratamento && <span className="text-gold-200/80">{p.tratamento} </span>}
                {p.nome}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[0.8rem] italic text-brand-200/45">Sem professor definido</p>
        )}

        {c.profOriginal &&
          c.profOriginal.trim() !== c.professores.map((p) => p.nome).join(" e ") && (
            <p className="mt-1.5 truncate text-[0.68rem] text-brand-200/35">
              cadastro original: “{c.profOriginal}”
            </p>
          )}
      </div>
    </article>
  );
}

export default function ClassesPage() {
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<ClasseLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abertas, setAbertas] = useState<Set<number>>(new Set());

  // Semeado pela busca global (?busca=): clicar numa classe cai aqui filtrado.
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("busca");
    if (b) setBusca(b);
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setErro(null);
        const url = new URL("/api/classes", window.location.origin);
        if (busca.trim()) url.searchParams.set("busca", busca.trim());
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        setItens((await res.json()).itens);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status
            ? "O servidor respondeu com erro. Isso costuma ser banco de dados não configurado — abra /api/diagnostico para ver o motivo."
            : "Sem resposta do servidor. Verifique a conexão e tente de novo.",
        );
        setItens([]);
      }
    }, 300);
    return () => {
      controle.abort();
      window.clearTimeout(t);
    };
  }, [busca]);

  const grupos = useMemo<Grupo[]>(() => {
    if (!itens) return [];
    const mapa = new Map<number, Grupo>();
    for (const c of itens) {
      const id = c.congregacao?.id ?? 0;
      const nome = c.congregacao?.nome ?? "Sem congregação";
      let g = mapa.get(id);
      if (!g) {
        g = { id, nome, classes: [], alunos: 0 };
        mapa.set(id, g);
      }
      g.classes.push(c);
      g.alunos += c.alunos;
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [itens]);

  // Com busca, todas as seções com resultado abrem sozinhas — senão o achado
  // ficaria escondido atrás de uma seção fechada.
  const buscando = busca.trim().length > 0;

  function alternar(id: number) {
    setAbertas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  }

  return (
    <>
      <CabecalhoModulo
        icone={School}
        titulo="Classes"
        descricao="Por congregação — clique para abrir"
        total={itens?.length ?? null}
      >
        <CampoDeBusca valor={busca} aoMudar={setBusca} placeholder="Buscar classe…" className="w-full sm:w-72" />
      </CabecalhoModulo>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : itens === null ? (
        <EsqueletoLista />
      ) : itens.length === 0 ? (
        <EstadoVazio mensagem={busca ? `Nenhuma classe para “${busca}”.` : "Nenhuma classe cadastrada."} />
      ) : (
        <div className="space-y-2.5">
          {grupos.map((g) => {
            const aberto = buscando || abertas.has(g.id);
            return (
              <div key={g.id} className="glass-panel overflow-hidden rounded-2xl">
                <button
                  type="button"
                  onClick={() => alternar(g.id)}
                  aria-expanded={aberto}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-brand-300/50 transition-transform duration-300",
                      aberto && "rotate-90",
                    )}
                  />
                  <Building2 className="h-4 w-4 shrink-0 text-gold-300/70" />
                  <span className="min-w-0 flex-1 truncate font-display text-[0.92rem] font-semibold text-white">
                    {g.nome}
                  </span>
                  <span className="shrink-0 text-[0.72rem] tabular-nums text-brand-300/50">
                    {g.classes.length} classe{g.classes.length === 1 ? "" : "s"} · {g.alunos} aluno
                    {g.alunos === 1 ? "" : "s"}
                  </span>
                </button>

                {aberto && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid gap-3 border-t border-white/6 p-3 sm:grid-cols-2 2xl:grid-cols-3"
                  >
                    {g.classes.map((c) => (
                      <Cartao key={c.id} c={c} />
                    ))}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
