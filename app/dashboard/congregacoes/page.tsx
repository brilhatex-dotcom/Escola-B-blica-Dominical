"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, GraduationCap, Phone, School, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { iniciais } from "@/lib/dashboard/formato";

/**
 * Congregações do campo, cada uma com quem responde por ela.
 *
 * CARGO VAGO APARECE COMO VAGO, com o lugar reservado. Omitir a linha do
 * Dirigente numa congregação que não tem faria a tela parecer completa — e é
 * justamente essa ausência que alguém precisa ver para providenciar.
 */

interface Pessoa {
  id: number;
  nome: string;
  tratamento: string | null;
  tel: string | null;
}

interface CongregacaoLista {
  id: number;
  nome: string;
  semNome: boolean;
  classes: number;
  alunos: number;
  dirigente: Pessoa | null;
  vice: Pessoa | null;
  secretario: Pessoa | null;
}

function Responsavel({ papel, pessoa }: { papel: string; pessoa: Pessoa | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1",
          pessoa
            ? "bg-gradient-to-br from-brand-500 to-brand-700 ring-white/12"
            : "border border-dashed border-white/15 bg-white/[0.03] ring-white/8",
        )}
      >
        {pessoa ? (
          <span className="font-display text-[0.62rem] font-semibold tracking-wider text-brand-50">
            {iniciais(pessoa.nome)}
          </span>
        ) : (
          <span className="text-[0.65rem] text-brand-200/35">—</span>
        )}
      </span>
      <div className="min-w-0">
        <p className="text-[0.64rem] uppercase tracking-[0.14em] text-gold-300/70">{papel}</p>
        <p
          className={cn(
            "truncate text-[0.8rem] leading-tight",
            pessoa ? "text-brand-50" : "italic text-brand-200/45",
          )}
        >
          {pessoa ? (
            <>
              {pessoa.tratamento && <span className="text-gold-200/80">{pessoa.tratamento} </span>}
              {pessoa.nome}
            </>
          ) : (
            "vago"
          )}
        </p>
        {pessoa?.tel && (
          <p className="flex items-center gap-1 text-[0.68rem] tabular-nums text-brand-200/45">
            <Phone className="h-2.5 w-2.5" />
            {pessoa.tel}
          </p>
        )}
      </div>
    </div>
  );
}

export default function CongregacoesPage() {
  const [itens, setItens] = useState<CongregacaoLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/congregacoes", { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setItens((await res.json()).itens);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status === 403
            ? "O seu acesso não permite ver esta tela."
            : status
              ? "O servidor respondeu com erro. Abra /api/diagnostico para ver o motivo."
              : "Sem resposta do servidor. Verifique a conexão.",
        );
        setItens([]);
      }
    })();
    return () => controle.abort();
  }, []);

  const semNome = (itens ?? []).filter((c) => c.semNome).length;

  return (
    <>
      <CabecalhoModulo
        icone={Building2}
        titulo="Congregações"
        descricao="Cada congregação com o seu dirigente e vice"
        total={itens?.length ?? null}
      />

      {/*
        O aviso só aparece quando há o que avisar. O model de congregações foi
        DERIVADO dos `congId` do export — não havia aba de congregações no
        sistema antigo —, então algumas nasceram sem nome.
      */}
      {semNome > 0 && (
        <p className="mb-3 text-[0.78rem] text-brand-200/55">
          <span className="font-semibold text-gold-200">{semNome}</span>{" "}
          {semNome === 1 ? "congregação está" : "congregações estão"} sem nome cadastrado —
          aparecem pelo número até alguém nomeá-{semNome === 1 ? "la" : "las"}.
        </p>
      )}

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : itens === null ? (
        <EsqueletoLista linhas={6} />
      ) : itens.length === 0 ? (
        <EstadoVazio mensagem="Nenhuma congregação no seu alcance." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {itens.map((c, i) => (
            <motion.article
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: Math.min(i, 14) * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel overflow-hidden rounded-2xl p-4"
            >
              <header className="flex items-start justify-between gap-3 border-b border-white/8 pb-3">
                <div className="min-w-0">
                  <h2
                    className={cn(
                      "truncate font-display text-[0.95rem] font-semibold",
                      c.semNome ? "italic text-brand-200/60" : "text-white",
                    )}
                  >
                    {c.nome}
                  </h2>
                  <p className="text-[0.7rem] text-brand-200/45">Congregação nº {c.id}</p>
                </div>
                <div className="flex shrink-0 gap-3 text-right">
                  <span className="flex items-center gap-1 text-[0.76rem] tabular-nums text-brand-100/80">
                    <School className="h-3 w-3 text-brand-300/70" />
                    {c.classes}
                  </span>
                  <span className="flex items-center gap-1 text-[0.76rem] tabular-nums text-brand-100/80">
                    <GraduationCap className="h-3 w-3 text-brand-300/70" />
                    {c.alunos}
                  </span>
                </div>
              </header>

              <div className="mt-3 space-y-3">
                <Responsavel papel="Dirigente" pessoa={c.dirigente} />
                <Responsavel papel="Vice-Dirigente" pessoa={c.vice} />
                {c.secretario && <Responsavel papel="Secretário Local" pessoa={c.secretario} />}
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {itens && itens.length > 0 && itens.every((c) => !c.dirigente) && (
        <div className="glass-panel mt-4 flex items-start gap-3 rounded-2xl px-5 py-4">
          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
          <p className="text-[0.8rem] leading-relaxed text-brand-100/75">
            Nenhuma congregação tem dirigente cadastrado ainda. O sistema antigo não
            guardava essa informação — ela é atribuída em{" "}
            <strong>Administração → Hierarquia</strong>, e é o mesmo vínculo que define
            quem enxerga cada congregação.
          </p>
        </div>
      )}
    </>
  );
}
