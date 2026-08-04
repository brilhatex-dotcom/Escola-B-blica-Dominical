"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Phone, UserRoundPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
  Filtro,
} from "@/components/dashboard/PaginaModulo";
import { diaEMes, iniciais } from "@/lib/dashboard/formato";

/**
 * Visitantes recebidos.
 *
 * Ordenados do mais recente para o mais antigo: quem abre esta tela quer saber
 * quem veio no ultimo domingo, para dar retorno na semana. A lista historica
 * completa e assunto do modulo de Relatorios.
 */

interface VisitanteLista {
  id: number;
  nome: string;
  idade: number | null;
  tel: string | null;
  obs: string | null;
  data: string;
  classe: { id: number; nome: string } | null;
  congregacao: { id: number; nome: string } | null;
}

export default function VisitantesPage() {
  const [classe, setClasse] = useState<number | null>(null);
  const [classes, setClasses] = useState<Array<{ id: number; nome: string }>>([]);
  const [itens, setItens] = useState<VisitanteLista[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/classes")
      .then((r) => r.json())
      .then((d) =>
        setClasses((d.itens ?? []).map((c: { id: number; nome: string }) => ({ id: c.id, nome: c.nome }))),
      )
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        const url = new URL("/api/visitantes", window.location.origin);
        if (classe) url.searchParams.set("classe", String(classe));
        url.searchParams.set("porPagina", "200");
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const dados = await res.json();
        setItens(dados.itens);
        setTotal(dados.total);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setErro("O servidor não respondeu. Verifique a conexão e tente de novo.");
        setItens([]);
      }
    })();
    return () => controle.abort();
  }, [classe]);

  return (
    <>
      <CabecalhoModulo
        icone={UserRoundPlus}
        titulo="Visitantes"
        descricao="Recebidos na Escola Bíblica, do mais recente ao mais antigo"
        total={total}
      >
        <Filtro rotulo="Classe" opcoes={classes} valor={classe} aoMudar={setClasse} />
      </CabecalhoModulo>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : itens === null ? (
        <EsqueletoLista />
      ) : itens.length === 0 ? (
        <EstadoVazio
          mensagem="Nenhum visitante registrado nesta seleção."
          dica="Os visitantes são cadastrados durante a chamada de domingo."
        />
      ) : (
        <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
          {itens.map((v, i) => (
            <motion.li
              key={v.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i, 20) * 0.02, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-300 hover:bg-white/[0.03]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400/15 ring-1 ring-gold-400/25">
                <span className="font-display text-[0.68rem] font-semibold tracking-wider text-gold-100">
                  {iniciais(v.nome)}
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.88rem] text-brand-50">{v.nome}</p>
                <p className="truncate text-[0.74rem] text-brand-200/55">
                  {v.classe?.nome ?? "Sem classe"}
                  {v.congregacao?.nome && (
                    <span className="text-brand-200/40"> · {v.congregacao.nome}</span>
                  )}
                </p>
                {v.obs && <p className="truncate text-[0.7rem] italic text-brand-200/40">{v.obs}</p>}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {v.tel && (
                  <span className="hidden items-center gap-1.5 text-[0.74rem] tabular-nums text-brand-200/55 sm:flex">
                    <Phone className="h-3 w-3" />
                    {v.tel}
                  </span>
                )}
                {v.idade !== null && <Badge variant="neutro">{v.idade} anos</Badge>}
                <span className="w-16 shrink-0 text-right text-[0.74rem] tabular-nums text-brand-200/55">
                  {diaEMes(new Date(v.data))}
                </span>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </>
  );
}
