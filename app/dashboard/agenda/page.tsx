"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
} from "@/components/dashboard/PaginaModulo";

/**
 * Calendário do mês.
 *
 * ============================================================================
 * O DOMINGO DE EBD É DERIVADO, NÃO CADASTRADO
 *
 * A Escola Bíblica acontece todo domingo — isso é uma regra, não um dado.
 * Cadastrar 52 linhas por ano para representar o que o calendário já diz criaria
 * um cadastro que, na primeira vez que alguém esquecesse, faria o domingo sumir
 * do sistema.
 *
 * O que É dado é se aquele domingo teve CHAMADA registrada. As duas coisas
 * juntas produzem a informação que interessa: "domingo passado, e ninguém
 * registrou" — que um calendário só com eventos cadastrados nunca mostraria.
 * ============================================================================
 */

interface Dia {
  data: string;
  dia: number;
  diaSemana: number;
  ehDomingo: boolean;
  ehHoje: boolean;
  passou: boolean;
  chamadaRegistrada: boolean;
  registros: number;
  licao: string | null;
  eventos: Array<{ id: number; titulo: string; tipo: string; local: string }>;
  reunioes: Array<{ id: number; titulo: string; presentes: number; total: number }>;
  avisos: Array<{ id: number; titulo: string; prioridade: number }>;
}

interface Calendario {
  ano: number;
  mes: number;
  primeiroDiaSemana: number;
  dias: Dia[];
  resumo: {
    domingos: number;
    domingosComChamada: number;
    domingosSemChamada: number;
    eventos: number;
    reunioes: number;
    avisos: number;
  };
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function CalendarioPage() {
  const [ano, setAno] = useState<number | null>(null);
  const [mes, setMes] = useState<number | null>(null);
  const [dados, setDados] = useState<Calendario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Dia | null>(null);

  useEffect(() => {
    const agora = new Date();
    setAno(agora.getFullYear());
    setMes(agora.getMonth() + 1);
  }, []);

  useEffect(() => {
    if (ano === null || mes === null) return;
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        setDados(null);
        setAberto(null);
        const res = await fetch(`/api/agenda/calendario?ano=${ano}&mes=${mes}`, {
          signal: controle.signal,
          cache: "no-store",
        });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDados(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(status === 403 ? "O seu acesso não permite ver esta tela." : "Não foi possível carregar o calendário.");
      }
    })();
    return () => controle.abort();
  }, [ano, mes]);

  function andar(passo: number) {
    if (ano === null || mes === null) return;
    const d = new Date(ano, mes - 1 + passo, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth() + 1);
  }

  return (
    <>
      <CabecalhoModulo icone={CalendarDays} titulo="Calendário" descricao="EBD, eventos, reuniões e avisos do mês">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => andar(-1)}
            aria-label="Mês anterior"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-brand-200/70 transition-colors duration-300 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] text-center font-display text-[0.92rem] font-semibold text-white">
            {mes !== null ? MESES[mes - 1] : ""} {ano ?? ""}
          </span>
          <button
            type="button"
            onClick={() => andar(1)}
            aria-label="Próximo mês"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-brand-200/70 transition-colors duration-300 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </CabecalhoModulo>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : !dados ? (
        <EsqueletoLista linhas={6} />
      ) : (
        <>
          {/* A pendência que só existe porque o domingo é derivado */}
          {dados.resumo.domingosSemChamada > 0 && (
            <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-gold-400/20 bg-gold-400/[0.06] px-4 py-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
              <p className="text-[0.8rem] leading-relaxed text-brand-100/85">
                <span className="font-semibold text-gold-200">
                  {dados.resumo.domingosSemChamada}
                </span>{" "}
                {dados.resumo.domingosSemChamada === 1 ? "domingo já passou" : "domingos já passaram"}{" "}
                sem nenhuma chamada registrada.
              </p>
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel overflow-hidden rounded-2xl p-3 sm:p-4"
          >
            <div className="mb-2 grid grid-cols-7 gap-1 sm:gap-2">
              {SEMANA.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "py-1 text-center text-[0.68rem] uppercase tracking-wider",
                    i === 0 ? "text-gold-300/70" : "text-brand-200/40",
                  )}
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {/* Células vazias até o dia 1 cair na coluna certa */}
              {Array.from({ length: dados.primeiroDiaSemana }, (_, i) => (
                <div key={`vazio-${i}`} aria-hidden="true" />
              ))}

              {dados.dias.map((d) => {
                const temCoisa = d.eventos.length + d.reunioes.length + d.avisos.length > 0;
                const pendente = d.ehDomingo && d.passou && !d.chamadaRegistrada;

                return (
                  <button
                    key={d.data}
                    type="button"
                    onClick={() => setAberto(d)}
                    className={cn(
                      "flex min-h-[3.6rem] flex-col rounded-xl border p-1.5 text-left transition-all duration-300 sm:min-h-[4.6rem]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
                      d.ehHoje
                        ? "border-gold-400/45 bg-gold-400/[0.10]"
                        : pendente
                          ? "border-gold-400/25 bg-gold-400/[0.05]"
                          : d.ehDomingo
                            ? "border-white/12 bg-white/[0.05]"
                            : "border-white/8 bg-white/[0.02]",
                      "hover:border-white/25",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[0.78rem] font-semibold tabular-nums",
                        d.ehHoje ? "text-gold-200" : d.ehDomingo ? "text-white" : "text-brand-100/70",
                      )}
                    >
                      {d.dia}
                    </span>

                    {/* Marcadores: o domingo com chamada ganha um ponto verde */}
                    <span className="mt-auto flex flex-wrap gap-0.5">
                      {d.ehDomingo && (
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            d.chamadaRegistrada
                              ? "bg-emerald-400"
                              : d.passou
                                ? "bg-gold-400"
                                : "bg-brand-300/40",
                          )}
                          title={
                            d.chamadaRegistrada
                              ? `${d.registros} registros`
                              : d.passou
                                ? "domingo sem chamada"
                                : "EBD a realizar"
                          }
                        />
                      )}
                      {d.eventos.map((e) => (
                        <span key={e.id} className="h-1.5 w-1.5 rounded-full bg-brand-300" />
                      ))}
                      {d.reunioes.map((r) => (
                        <span key={r.id} className="h-1.5 w-1.5 rounded-full bg-brand-100/70" />
                      ))}
                      {d.avisos.map((a) => (
                        <span key={a.id} className="h-1.5 w-1.5 rounded-full bg-gold-300" />
                      ))}
                    </span>

                    {temCoisa && (
                      <span className="mt-0.5 hidden truncate text-[0.6rem] text-brand-200/50 sm:block">
                        {d.eventos[0]?.titulo ?? d.reunioes[0]?.titulo ?? d.avisos[0]?.titulo}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legenda: sem ela, os pontos coloridos são enfeite */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/8 pt-3 text-[0.7rem] text-brand-200/55">
              {[
                ["bg-emerald-400", "domingo com chamada"],
                ["bg-gold-400", "domingo sem chamada"],
                ["bg-brand-300/40", "EBD a realizar"],
                ["bg-brand-300", "evento"],
                ["bg-brand-100/70", "reunião"],
                ["bg-gold-300", "aviso"],
              ].map(([cor, rotulo]) => (
                <span key={rotulo} className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", cor)} />
                  {rotulo}
                </span>
              ))}
            </div>
          </motion.div>

          {/* ---------------- Detalhe do dia ---------------- */}
          {aberto && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel mt-4 rounded-2xl p-5"
            >
              <header className="mb-3 flex items-baseline justify-between gap-3 border-b border-white/8 pb-3">
                <h2 className="font-display text-[0.95rem] font-semibold text-white">
                  {String(aberto.dia).padStart(2, "0")} de {MESES[dados.mes - 1]}
                  {aberto.ehDomingo && <span className="text-gold-300/80"> · domingo</span>}
                </h2>
                <button
                  type="button"
                  onClick={() => setAberto(null)}
                  className="text-[0.76rem] text-brand-200/55 transition-colors hover:text-brand-100"
                >
                  fechar
                </button>
              </header>

              <ul className="space-y-2.5 text-[0.84rem]">
                {aberto.ehDomingo && (
                  <li className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        aberto.chamadaRegistrada ? "bg-emerald-400" : aberto.passou ? "bg-gold-400" : "bg-brand-300/40",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-brand-50">
                        Escola Bíblica Dominical
                        {aberto.chamadaRegistrada
                          ? ` — ${aberto.registros} registros de chamada`
                          : aberto.passou
                            ? " — sem chamada registrada"
                            : " — ainda por acontecer"}
                      </p>
                      {aberto.licao && (
                        <p className="text-[0.76rem] text-brand-200/55">{aberto.licao}</p>
                      )}
                    </div>
                  </li>
                )}

                {aberto.eventos.map((e) => (
                  <li key={`e${e.id}`} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" />
                    <div className="min-w-0">
                      <p className="text-brand-50">{e.titulo}</p>
                      <p className="text-[0.76rem] text-brand-200/55">
                        {e.tipo}
                        {e.local && ` · ${e.local}`}
                      </p>
                    </div>
                  </li>
                ))}

                {aberto.reunioes.map((r) => (
                  <li key={`r${r.id}`} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-100/70" />
                    <div className="min-w-0">
                      <p className="text-brand-50">{r.titulo}</p>
                      <p className="text-[0.76rem] text-brand-200/55">
                        Reunião · {r.presentes} de {r.total} presentes
                      </p>
                    </div>
                  </li>
                ))}

                {aberto.avisos.map((a) => (
                  <li key={`a${a.id}`} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-300" />
                    <p className="min-w-0 text-brand-50">{a.titulo}</p>
                  </li>
                ))}

                {!aberto.ehDomingo &&
                  aberto.eventos.length === 0 &&
                  aberto.reunioes.length === 0 &&
                  aberto.avisos.length === 0 && (
                    <li className="text-brand-200/50">Nada marcado neste dia.</li>
                  )}
              </ul>
            </motion.section>
          )}
        </>
      )}
    </>
  );
}
