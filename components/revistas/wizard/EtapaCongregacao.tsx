"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronRight, GraduationCap, School, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { CampoDeBusca, EstadoVazio } from "@/components/dashboard/PaginaModulo";
import { SituacaoBadge } from "@/components/revistas/SituacaoBadge";
import type { CongDoPainel } from "./tipos";

/**
 * Etapa 1 — "Para qual congregação você está fazendo este pedido?"
 *
 * Cada linha já responde a pergunta seguinte antes de ser feita: quantas
 * classes, quantos alunos, quantos professores essa congregação tem
 * cadastrados, e como está o pedido dela neste trimestre. A pessoa nunca
 * escolhe às cegas.
 */
export function EtapaCongregacao({
  congregacoes,
  aoSelecionar,
}: {
  congregacoes: CongDoPainel[];
  aoSelecionar: (congId: number) => void;
}) {
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return congregacoes;
    return congregacoes.filter((c) => c.nome.toLowerCase().includes(termo));
  }, [congregacoes, busca]);

  return (
    <div>
      <h2 className="mb-1 font-display text-[1.05rem] font-semibold text-white">
        Para qual congregação você está fazendo este pedido?
      </h2>
      <p className="mb-4 text-[0.82rem] text-brand-200/55">
        Escolha a congregação — os números abaixo já mostram quem ela tem cadastrado.
      </p>

      {congregacoes.length > 6 && (
        <CampoDeBusca valor={busca} aoMudar={setBusca} placeholder="Buscar congregação…" className="mb-3" />
      )}

      {filtradas.length === 0 ? (
        <EstadoVazio mensagem="Nenhuma congregação encontrada." />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {filtradas.map((c) => {
            const alunos = c.classes.reduce((s, cl) => s + cl.alunos, 0);
            const professores = c.classes.reduce((s, cl) => s + cl.professores, 0);
            return (
              <button
                key={c.congId}
                type="button"
                onClick={() => aoSelecionar(c.congId)}
                className={cn(
                  "glass-panel flex items-center gap-3 rounded-2xl p-4 text-left transition-all duration-300",
                  "hover:border-gold-400/30 hover:bg-white/[0.04]",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/8">
                  <Building2 className="h-4.5 w-4.5 text-gold-300" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[0.9rem] font-semibold text-white">{c.nome}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.72rem] text-brand-200/55">
                    <span className="flex items-center gap-1">
                      <School className="h-3 w-3" />
                      {c.classes.length} {c.classes.length === 1 ? "classe" : "classes"}
                    </span>
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      {alunos} {alunos === 1 ? "aluno" : "alunos"}
                    </span>
                    <span className="flex items-center gap-1">
                      <UserRound className="h-3 w-3" />
                      {professores} {professores === 1 ? "professor" : "professores"}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <SituacaoBadge situacao={c.situacao} pedido={c.pedido} />
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-brand-300/40" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
