"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Cake, ClipboardList, IdCard, Phone, Printer, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo,
  CampoDeBusca,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { iniciais } from "@/lib/dashboard/formato";

/**
 * Ficha do aluno — o histórico completo de uma pessoa.
 *
 * O ALUNO ESCOLHIDO VAI PARA A URL (`?aluno=123`), e não só para o estado da
 * tela. Assim a ficha pode ser enviada por mensagem para o professor, e o botão
 * "voltar" do navegador desfaz a escolha em vez de sair da tela inteira.
 */

interface Candidato {
  id: number;
  nome: string;
  classe: string;
}

interface Ficha {
  aluno: {
    id: number; nome: string; nasc: string | null; tel: string | null;
    resp: string | null; ativo: boolean;
    classe: { nome: string; faixa: string } | null;
    congregacao: { nome: string } | null;
  };
  resumo: { chamadas: number; presencas: number; faltas: number; taxa: number | null };
  historico: Array<{ data: string; presente: boolean; classe: string | null }>;
}

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function Conteudo() {
  const router = useRouter();
  const params = useSearchParams();
  const alunoId = params.get("aluno");

  const [busca, setBusca] = useState("");
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setErro(null);
        const url = new URL("/api/relatorios/ficha", window.location.origin);
        if (alunoId) url.searchParams.set("aluno", alunoId);
        else if (busca.trim()) url.searchParams.set("busca", busca.trim());

        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        const r = await res.json();
        if (alunoId) {
          setFicha(r);
          setCandidatos(null);
        } else {
          setCandidatos(r.candidatos);
          setFicha(null);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status === 403
            ? "O seu acesso não permite ver esta tela."
            : "Aluno não encontrado ou fora do seu alcance.",
        );
      }
    }, 300);
    return () => {
      controle.abort();
      window.clearTimeout(t);
    };
  }, [alunoId, busca]);

  /* ---------------- Escolha do aluno ---------------- */
  if (!alunoId) {
    return (
      <>
        <CabecalhoModulo icone={IdCard} titulo="Ficha do Aluno" descricao="Histórico completo de uma pessoa">
          <CampoDeBusca valor={busca} aoMudar={setBusca} placeholder="Buscar aluno…" className="w-full sm:w-72" />
        </CabecalhoModulo>

        {erro ? (
          <EstadoErro mensagem={erro} />
        ) : candidatos === null ? (
          <EsqueletoLista linhas={6} />
        ) : candidatos.length === 0 ? (
          <EstadoVazio mensagem={busca ? `Ninguém encontrado para “${busca}”.` : "Nenhum aluno no seu alcance."} />
        ) : (
          <>
            {!busca && (
              <p className="mb-3 flex items-center gap-2 text-[0.76rem] text-brand-200/55">
                <Search className="h-3.5 w-3.5" />
                Busque pelo nome — a lista abaixo mostra apenas os primeiros.
              </p>
            )}
            <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
              {candidatos.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/relatorios/ficha?aluno=${c.id}`)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-300 hover:bg-white/[0.04]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-white/12">
                      <span className="font-display text-[0.66rem] font-semibold tracking-wider text-brand-50">
                        {iniciais(c.nome)}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.88rem] text-brand-50">{c.nome}</p>
                      <p className="truncate text-[0.74rem] text-brand-200/55">{c.classe}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    );
  }

  /* ---------------- A ficha ---------------- */
  if (erro) return <EstadoErro mensagem={erro} />;
  if (!ficha) return <EsqueletoLista linhas={8} />;

  const { aluno, resumo, historico } = ficha;

  return (
    <>
      <CabecalhoModulo icone={IdCard} titulo="Ficha do Aluno" descricao={aluno.nome}>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/relatorios/ficha")}>
            Trocar aluno
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </CabecalhoModulo>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
      >
        {/* ---------------- Identificação ---------------- */}
        <section className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-gold-400/25">
              <span className="font-display text-[0.8rem] font-semibold tracking-wider text-gold-100">
                {iniciais(aluno.nome)}
              </span>
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-[1.05rem] font-semibold text-white">{aluno.nome}</h2>
              <p className="truncate text-[0.78rem] text-brand-200/60">
                {aluno.classe?.nome ?? "Sem classe"}
                {aluno.congregacao && <span className="text-brand-200/40"> · {aluno.congregacao.nome}</span>}
              </p>
            </div>
          </div>

          <dl className="mt-4 space-y-2 border-t border-white/8 pt-4 text-[0.82rem]">
            {aluno.nasc && (
              <div className="flex items-center gap-2">
                <Cake className="h-3.5 w-3.5 shrink-0 text-brand-300/70" />
                <dt className="sr-only">Nascimento</dt>
                <dd className="tabular-nums text-brand-100/80">
                  {fmt.format(new Date(`${aluno.nasc}T12:00:00`))}
                </dd>
              </div>
            )}
            {aluno.tel && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0 text-brand-300/70" />
                <dt className="sr-only">Telefone</dt>
                <dd className="tabular-nums text-brand-100/80">{aluno.tel}</dd>
              </div>
            )}
            {aluno.resp && (
              <div className="flex items-start gap-2">
                <dt className="text-brand-200/55">Responsável:</dt>
                <dd className="min-w-0 flex-1 text-brand-100/80">{aluno.resp}</dd>
              </div>
            )}
            {!aluno.ativo && <Badge variant="erro">matrícula inativa</Badge>}
          </dl>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-4 text-center">
            {[
              ["Chamadas", resumo.chamadas],
              ["Presenças", resumo.presencas],
              ["Faltas", resumo.faltas],
            ].map(([rotulo, valor]) => (
              <div key={rotulo as string}>
                <p className="font-display text-[1.2rem] font-semibold leading-none text-white tabular-nums">
                  {valor}
                </p>
                <p className="mt-1 text-[0.7rem] text-brand-200/50">{rotulo}</p>
              </div>
            ))}
          </div>

          {resumo.taxa !== null && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[0.78rem] text-brand-200/60">Frequência</span>
                <span className="text-[0.95rem] font-semibold tabular-nums text-gold-200">
                  {resumo.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-brand-400 to-gold-400"
                  style={{ width: `${Math.min(100, resumo.taxa)}%` }}
                />
              </div>
              {/*
                A taxa é sobre as chamadas em que ELE foi chamado. Dizer isso
                evita a leitura de que ele faltou aos domingos em que a classe
                simplesmente não registrou.
              */}
              <p className="mt-1.5 text-[0.7rem] text-brand-200/45">
                sobre as {resumo.chamadas} chamadas em que foi chamado
              </p>
            </div>
          )}
        </section>

        {/* ---------------- Histórico ---------------- */}
        <section className="glass-panel overflow-hidden rounded-2xl">
          <header className="flex items-center gap-2 border-b border-white/8 px-5 py-3.5">
            <ClipboardList className="h-4 w-4 shrink-0 text-brand-300/70" />
            <h2 className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white">
              Histórico
            </h2>
            <span className="ml-auto text-[0.72rem] text-brand-200/45">
              últimas {historico.length}
            </span>
          </header>

          {historico.length === 0 ? (
            <EstadoVazio mensagem="Nenhuma chamada registrada para este aluno." />
          ) : (
            <ul className="max-h-[32rem] divide-y divide-white/6 overflow-y-auto">
              {historico.map((h) => (
                <li
                  key={`${h.data}-${h.classe}`}
                  className={cn(
                    "flex items-center gap-3 px-5 py-2",
                    h.presente ? "bg-emerald-500/[0.04]" : "bg-flame-500/[0.03]",
                  )}
                >
                  <span className="w-24 shrink-0 text-[0.78rem] tabular-nums text-brand-100/80">
                    {fmt.format(new Date(`${h.data}T12:00:00`))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.76rem] text-brand-200/50">
                    {h.classe ?? "—"}
                  </span>
                  <Badge variant={h.presente ? "sucesso" : "erro"}>
                    {h.presente ? "presente" : "falta"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </motion.div>
    </>
  );
}

export default function FichaPage() {
  return (
    <Suspense fallback={<EsqueletoLista linhas={6} />}>
      <Conteudo />
    </Suspense>
  );
}
