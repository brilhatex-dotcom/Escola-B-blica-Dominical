"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { School, Users } from "lucide-react";
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
 * Classes da EBD.
 *
 * A COLUNA "PROFESSORES" MOSTRA PESSOAS, e nao o texto que estava na planilha.
 * Onde o cadastro antigo dizia "Pb. Lourival e Aux. Danilo" — uma string —, aqui
 * aparecem duas pessoas que existem no cadastro e podem ser abertas.
 *
 * Quando a lista de pessoas nao bate com o texto original, o texto e mostrado
 * embaixo, para conferencia. Ele nao e escondido: enquanto a secretaria nao
 * revisar os nomes separados pela importacao, o original e a unica fonte
 * incontestavel do que a igreja escreveu.
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

export default function ClassesPage() {
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<ClasseLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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
        /*
         * "O servidor não respondeu" era mentira quando ele respondia 500 — e
         * mandava procurar problema na internet, que estava perfeita. A
         * mensagem agora separa os dois casos: sem rede o `fetch` lança e não
         * há `status`; com resposta de erro, o problema está no banco.
         */
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

  return (
    <>
      <CabecalhoModulo
        icone={School}
        titulo="Classes"
        descricao="Por congregação, faixa etária e professor"
        total={itens?.length ?? null}
      >
        <CampoDeBusca
          valor={busca}
          aoMudar={setBusca}
          placeholder="Buscar classe…"
          className="w-full sm:w-72"
        />
      </CabecalhoModulo>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : itens === null ? (
        <EsqueletoLista />
      ) : itens.length === 0 ? (
        <EstadoVazio mensagem={busca ? `Nenhuma classe para “${busca}”.` : "Nenhuma classe cadastrada."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {itens.map((c, i) => (
            <motion.article
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: Math.min(i, 20) * 0.03, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "glass-panel relative overflow-hidden rounded-2xl p-4",
                !c.ativa && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-[0.92rem] font-semibold text-white">
                    {c.nome}
                  </h2>
                  <p className="mt-0.5 truncate text-[0.74rem] text-brand-200/55">
                    {c.congregacao?.nome || "Sem congregação"}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/6 px-2 py-1 text-[0.72rem] tabular-nums text-brand-100">
                  <Users className="h-3 w-3" />
                  {c.alunos}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
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

                {/*
                  O texto original so aparece quando NAO bate com os nomes
                  separados — em "Ana costa" para uma pessoa "Ana costa", repetir
                  seria ruido. Aparece em "Pb. Lourival e Aux. Danilo", onde a
                  separacao em duas pessoas e uma interpretacao que merece
                  conferencia.
                */}
                {c.profOriginal &&
                  c.profOriginal.trim() !==
                    c.professores.map((p) => p.nome).join(" e ") && (
                    <p className="mt-1.5 truncate text-[0.68rem] text-brand-200/35">
                      cadastro original: “{c.profOriginal}”
                    </p>
                  )}
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </>
  );
}
