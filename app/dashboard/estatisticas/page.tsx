"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookMarked,
  CalendarRange,
  Medal,
  Minus,
  MonitorPlay,
  Printer,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CabecalhoModulo, EsqueletoLista, EstadoErro, EstadoVazio } from "@/components/dashboard/PaginaModulo";
import { FiltroPeriodo } from "@/components/dashboard/FiltroPeriodo";
import { GraficoBarras, GraficoTaxaComProjecao, type PontoTaxa } from "@/components/estatisticas/Graficos";
import { domingoMaisRecente, numero } from "@/lib/dashboard/formato";
import { ModoDataShow } from "@/components/estatisticas/ModoDataShow";
import type { LinhaRanking, RespPanorama, RespPedidos, RespRanking } from "@/components/estatisticas/tipos";

/**
 * Estatísticas — a área só de medição.
 *
 * Três perguntas, uma aba para cada:
 *
 *   Ranking            · quem tem mais presentes diante dos seus matriculados,
 *                        no período escolhido (atalhos ou datas livres)
 *   Pedidos de lição   · quanto o campo pede, paga e deve; quem tem aluno sem
 *                        revista (cobertura)
 *   Panoramas          · para onde a presença e as matrículas estão indo
 *
 * As contas ficam no servidor (app/api/estatisticas/*) e a régua está
 * explicada em lib/relatorios/estatisticas.ts.
 */

type Aba = "ranking" | "pedidos" | "panorama";

const fmtPct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const fmtReal = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDec = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const dataBr = (s: string) => fmtData.format(new Date(`${s}T12:00:00`));
const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "short" });

async function buscar<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(dados.erro ?? `HTTP ${res.status}`);
  return dados as T;
}

/* ------------------------------------------------------------------ *
 * Período
 * ------------------------------------------------------------------ */

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Atalho = "domingo" | "mes" | "mes-passado" | "trimestre" | "ano";
const ATALHOS: Array<{ chave: Atalho; rotulo: string }> = [
  { chave: "domingo", rotulo: "Último domingo" },
  { chave: "mes", rotulo: "Este mês" },
  { chave: "mes-passado", rotulo: "Mês passado" },
  { chave: "trimestre", rotulo: "Este trimestre" },
  { chave: "ano", rotulo: "Este ano" },
];

function periodoDoAtalho(a: Atalho): { de: string; ate: string } {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  switch (a) {
    case "domingo": {
      const d = domingoMaisRecente();
      return { de: d, ate: d };
    }
    case "mes":
      return { de: iso(new Date(y, m, 1)), ate: iso(hoje) };
    case "mes-passado":
      return { de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m, 0)) };
    case "trimestre":
      return { de: iso(new Date(y, Math.floor(m / 3) * 3, 1)), ate: iso(hoje) };
    case "ano":
      return { de: iso(new Date(y, 0, 1)), ate: iso(hoje) };
  }
}

/* ------------------------------------------------------------------ *
 * Tipos das respostas
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Peças
 * ------------------------------------------------------------------ */

function Kpi({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4 break-inside-avoid">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-brand-200/55">{rotulo}</p>
      <p className="mt-1 font-display text-[1.45rem] font-semibold tabular-nums text-white">{valor}</p>
      {nota && <p className="mt-0.5 text-[0.72rem] text-brand-200/50">{nota}</p>}
    </div>
  );
}

function Secao({ titulo, descricao, children, className }: { titulo: string; descricao?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass-panel mb-4 rounded-2xl p-4 sm:p-5 break-inside-avoid", className)}>
      <h2 className="text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-gold-300/85">{titulo}</h2>
      {descricao && <p className="mt-1 text-[0.76rem] text-brand-200/55">{descricao}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A barra de uma linha do ranking: a largura é a taxa, o número fica ao lado em texto. */
function BarraTaxa({ taxa }: { taxa: number | null }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, taxa ?? 0))}%` }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-full bg-gold-400"
      />
    </div>
  );
}

const CORES_PODIO = [
  "from-gold-300/30 to-gold-500/10 ring-gold-300/40",
  "from-slate-200/20 to-slate-400/5 ring-slate-200/30",
  "from-amber-700/30 to-amber-900/10 ring-amber-600/35",
];

/* ------------------------------------------------------------------ *
 * Aba: Ranking
 * ------------------------------------------------------------------ */

interface Periodo { de: string; ate: string }

function AbaRanking({
  atalho,
  setAtalho,
  periodo,
  setPeriodo,
}: {
  atalho: Atalho | null;
  setAtalho: (a: Atalho | null) => void;
  periodo: Periodo;
  setPeriodo: React.Dispatch<React.SetStateAction<Periodo>>;
}) {
  const [dados, setDados] = useState<RespRanking | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [todasClasses, setTodasClasses] = useState(false);

  useEffect(() => {
    if (!periodo.de || !periodo.ate) return;
    const controle = new AbortController();
    setCarregando(true);
    setErro(null);
    buscar<RespRanking>(`/api/estatisticas/ranking?de=${periodo.de}&ate=${periodo.ate}`, controle.signal)
      .then(setDados)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setErro(e.message || "Não foi possível carregar o ranking.");
      })
      .finally(() => !controle.signal.aborted && setCarregando(false));
    return () => controle.abort();
  }, [periodo.de, periodo.ate]);

  const podio = dados?.congregacoes.slice(0, 3) ?? [];
  const classes = todasClasses ? dados?.classes ?? [] : (dados?.classes ?? []).slice(0, 10);

  return (
    <>
      <div className="glass-panel mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-3 print:hidden">
        <CalendarRange className="ml-1 h-4 w-4 text-brand-200/50" />
        {ATALHOS.map((a) => (
          <button
            key={a.chave}
            type="button"
            onClick={() => {
              setAtalho(a.chave);
              setPeriodo(periodoDoAtalho(a.chave));
            }}
            aria-pressed={atalho === a.chave}
            className={cn(
              "h-9 rounded-xl border px-3 text-[0.78rem] transition-colors",
              atalho === a.chave
                ? "border-gold-300/45 bg-gold-400/15 text-gold-100"
                : "border-white/10 bg-white/[0.03] text-brand-100/75 hover:border-white/20",
            )}
          >
            {a.rotulo}
          </button>
        ))}
        <div className="ml-auto">
          <FiltroPeriodo
            de={periodo.de}
            ate={periodo.ate}
            aoMudar={(campo, valor) => {
              setAtalho(null);
              setPeriodo((p) => ({ ...p, [campo]: valor }));
            }}
          />
        </div>
      </div>

      {carregando && !dados ? (
        <EsqueletoLista />
      ) : erro ? (
        <EstadoErro mensagem={erro} />
      ) : !dados ? null : (
        <div className={cn("transition-opacity", carregando && "opacity-60")}>
          <p className="mb-3 px-1 text-[0.78rem] text-brand-200/60">
            {dados.periodo.de === dados.periodo.ate
              ? `Domingo ${dataBr(dados.periodo.de)}`
              : `De ${dataBr(dados.periodo.de)} a ${dataBr(dados.periodo.ate)}`}
            {" · "}
            {dados.periodo.domingos} {dados.periodo.domingos === 1 ? "domingo" : "domingos"} no período
          </p>

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi rotulo="Presença do campo" valor={fmtPct(dados.campo.taxa)} nota="média dos domingos com chamada" />
            <Kpi rotulo="Presentes por domingo" valor={fmtDec(dados.campo.mediaPresentes)} nota={`de ${fmtDec(dados.campo.mediaBase)} esperados`} />
            <Kpi rotulo="Matriculados" valor={numero(dados.campo.matriculados)} nota="alunos ativos hoje" />
            <Kpi
              rotulo="Faltas justificadas"
              valor={dados.justificadaDisponivel ? numero(dados.campo.justificadasTotal) : "—"}
              nota={dados.justificadaDisponivel ? "não pesam contra ninguém" : "aguardando ativação no banco"}
            />
          </div>

          {dados.congregacoes.length === 0 && dados.poucasChamadas.length === 0 ? (
            <EstadoVazio mensagem="Nenhuma chamada registrada neste período." dica="Escolha outro período ou confira se as chamadas foram enviadas." />
          ) : (
            <>
              {podio.length > 0 && (
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  {podio.map((c, i) => (
                    <motion.div
                      key={c.congId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: i * 0.08 }}
                      className={cn("rounded-2xl bg-gradient-to-br p-4 ring-1 break-inside-avoid", CORES_PODIO[i])}
                    >
                      <div className="flex items-center gap-2">
                        {i === 0 ? <Trophy className="h-5 w-5 text-gold-200" /> : <Medal className="h-5 w-5 text-brand-100/80" />}
                        <span className="font-display text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-white/85">{i + 1}º lugar</span>
                      </div>
                      <p className="mt-2 truncate text-[1rem] font-medium text-white">{c.nome}</p>
                      <p className="font-display text-[1.7rem] font-semibold tabular-nums text-white">{fmtPct(c.taxa)}</p>
                      <p className="text-[0.74rem] text-brand-100/70">
                        {fmtDec(c.mediaPresentes)} presentes de {fmtDec(c.mediaBase)} por domingo
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}

              <Secao
                titulo="Ranking das congregações"
                descricao="Presentes ÷ matriculados, na média dos domingos com chamada. Falta justificada sai da conta."
              >
                <ol className="divide-y divide-white/6">
                  {dados.congregacoes.map((c) => (
                    <LinhaDoRanking key={c.congId} c={c} totalDomingos={dados.periodo.domingos} />
                  ))}
                </ol>
              </Secao>

              {dados.poucasChamadas.length > 0 && (
                <Secao
                  titulo="Fora da classificação — poucas chamadas"
                  descricao="Fizeram chamada em menos da metade dos domingos do período. A taxa aparece, mas não disputa posição."
                >
                  <ol className="divide-y divide-white/6">
                    {dados.poucasChamadas.map((c) => (
                      <LinhaDoRanking key={c.congId} c={c} totalDomingos={dados.periodo.domingos} />
                    ))}
                  </ol>
                </Secao>
              )}

              {dados.semChamada.length > 0 && (
                <Secao titulo="Sem chamada no período">
                  <div className="flex flex-wrap gap-2">
                    {dados.semChamada.map((c) => (
                      <Badge key={c.congId} variant="neutro">
                        {c.nome} · {c.matriculados} matric.
                      </Badge>
                    ))}
                  </div>
                </Secao>
              )}

              {dados.classes.length > 0 && (
                <Secao titulo="Classes com mais presença" descricao="A mesma régua, classe por classe.">
                  <ol className="divide-y divide-white/6">
                    {classes.map((c) => (
                      <li key={c.classeId} className="flex items-center gap-3 py-2">
                        <span className="w-7 shrink-0 text-right font-display text-[0.8rem] tabular-nums text-brand-200/60">{c.posicao}º</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.84rem] text-brand-50">
                            {c.nome}
                            {c.congregacao && <span className="text-brand-200/50"> · {c.congregacao}</span>}
                          </p>
                          <BarraTaxa taxa={c.taxa} />
                        </div>
                        <div className="w-24 shrink-0 text-right">
                          <p className="text-[0.86rem] font-semibold tabular-nums text-white">{fmtPct(c.taxa)}</p>
                          <p className="text-[0.68rem] tabular-nums text-brand-200/50">
                            {fmtDec(c.mediaPresentes)}/{fmtDec(c.mediaBase)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {dados.classes.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setTodasClasses((v) => !v)}
                      className="mt-2 text-[0.78rem] text-gold-200 hover:underline print:hidden"
                    >
                      {todasClasses ? "Mostrar só as 10 primeiras" : `Ver todas as ${dados.classes.length} classes`}
                    </button>
                  )}
                </Secao>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

function LinhaDoRanking({ c, totalDomingos }: { c: LinhaRanking; totalDomingos: number }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[0.78rem] font-semibold tabular-nums ring-1",
          c.posicao === 1
            ? "bg-gold-400/20 text-gold-100 ring-gold-300/40"
            : "bg-white/[0.05] text-brand-100/80 ring-white/10",
        )}
      >
        {c.posicao ?? "–"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.88rem] text-brand-50">{c.nome}</p>
        <BarraTaxa taxa={c.taxa} />
        <p className="mt-1 text-[0.7rem] text-brand-200/50">
          {c.matriculados} matriculados · chamada em {c.domingosComChamada} de {totalDomingos}{" "}
          {totalDomingos === 1 ? "domingo" : "domingos"}
          {c.justificadasTotal > 0 && ` · ${c.justificadasTotal} justificada(s)`}
        </p>
      </div>
      <div className="w-24 shrink-0 text-right">
        <p className="text-[0.95rem] font-semibold tabular-nums text-white">{fmtPct(c.taxa)}</p>
        <p className="text-[0.68rem] tabular-nums text-brand-200/50">
          {fmtDec(c.mediaPresentes)} de {fmtDec(c.mediaBase)}
        </p>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Aba: Pedidos de lição
 * ------------------------------------------------------------------ */

const SITUACAO: Record<RespPedidos["congregacoes"][number]["situacao"], { rotulo: string; variante: "sucesso" | "alerta" | "neutro" }> = {
  confirmado: { rotulo: "Confirmado", variante: "sucesso" },
  rascunho: { rotulo: "Não confirmado", variante: "alerta" },
  "sem-pedido": { rotulo: "Sem pedido", variante: "neutro" },
};

function AbaPedidos() {
  const [trimestre, setTrimestre] = useState<string>("");
  const [dados, setDados] = useState<RespPedidos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const controle = new AbortController();
    setCarregando(true);
    setErro(null);
    buscar<RespPedidos>(`/api/estatisticas/pedidos${trimestre ? `?trimestre=${trimestre}` : ""}`, controle.signal)
      .then(setDados)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setErro(e.message || "Não foi possível carregar os pedidos.");
      })
      .finally(() => !controle.signal.aborted && setCarregando(false));
    return () => controle.abort();
  }, [trimestre]);

  if (carregando && !dados) return <EsqueletoLista />;
  if (erro) return <EstadoErro mensagem={erro} />;
  if (!dados) return null;

  const tri = dados.trimestres.find((t) => t.chave === dados.trimestre.chave);
  const comPedido = dados.congregacoes.filter((c) => c.situacao !== "sem-pedido");
  const semRevista = dados.congregacoes.filter((c) => c.cobertura !== null && c.cobertura < 100);

  return (
    <div className={cn("transition-opacity", carregando && "opacity-60")}>
      <div className="glass-panel mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-3 print:hidden">
        <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
          <span className="shrink-0 text-brand-200/55">Trimestre</span>
          <select
            value={dados.trimestre.chave}
            onChange={(e) => setTrimestre(e.target.value)}
            className="bg-transparent text-brand-50 focus:outline-none [&>option]:bg-brand-900"
          >
            {dados.disponiveis.map((t) => (
              <option key={t} value={t}>
                {t.replace(/^(\d)T-(\d{4})$/, "$1º trimestre de $2")}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[0.76rem] text-brand-200/55">Valores dos pedidos confirmados; pago é a soma das baixas.</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Revistas pedidas" valor={numero(tri?.revistas ?? 0)} nota={`${tri?.revistasAluno ?? 0} de aluno · ${tri?.revistasProfessor ?? 0} de professor`} />
        <Kpi rotulo="Valor dos pedidos" valor={fmtReal(tri?.valor ?? 0)} nota={`${tri?.confirmados ?? 0} congregação(ões) confirmada(s)`} />
        <Kpi rotulo="Já pago" valor={fmtReal(tri?.pago ?? 0)} nota={tri && tri.valor > 0 ? `${fmtPct((tri.pago / tri.valor) * 100)} do total` : undefined} />
        <Kpi rotulo="Falta pagar" valor={fmtReal(Math.max(0, tri?.saldo ?? 0))} />
      </div>

      {dados.trimestres.length > 1 && (
        <Secao titulo="Revistas por trimestre" descricao="Pedidos confirmados, trimestre a trimestre.">
          <GraficoBarras
            rotuloValor="Revistas"
            dados={dados.trimestres.map((t) => ({ rotulo: t.chave.replace("-", "/"), valor: t.revistas }))}
          />
        </Secao>
      )}

      {dados.categorias.length > 0 && (
        <Secao titulo="Por faixa etária" descricao={`O que foi pedido no ${dados.trimestre.rotulo}.`}>
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {dados.categorias.map((c) => (
              <li key={c.categoria} className="flex items-center justify-between gap-3 border-b border-white/5 py-1.5 text-[0.82rem]">
                <span className="text-brand-100/80">{c.rotulo}</span>
                <span className="tabular-nums text-white">{numero(c.quantidade)}</span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao
        titulo="Pedido de cada congregação"
        descricao="Cobertura = revistas de aluno ÷ matriculados. Abaixo de 100% há aluno sem revista."
      >
        {comPedido.length === 0 && (
          <p className="mb-2 text-[0.8rem] text-brand-200/60">Nenhuma congregação fez pedido neste trimestre ainda.</p>
        )}
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="text-[0.66rem] uppercase tracking-[0.12em] text-brand-200/50">
                <th className="px-2 py-2 font-semibold">Congregação</th>
                <th className="px-2 py-2 text-right font-semibold">Matric.</th>
                <th className="px-2 py-2 text-right font-semibold">Aluno</th>
                <th className="px-2 py-2 text-right font-semibold">Prof.</th>
                <th className="px-2 py-2 text-right font-semibold">Cobertura</th>
                <th className="px-2 py-2 text-right font-semibold">Valor</th>
                <th className="px-2 py-2 text-right font-semibold">Saldo</th>
                <th className="px-2 py-2 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-[0.8rem]">
              {dados.congregacoes.map((c) => (
                <tr key={c.congId}>
                  <td className="px-2 py-2 text-brand-50">{c.nome}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-brand-100/75">{c.matriculados}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-brand-100/75">{c.revistasAluno || "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-brand-100/75">{c.revistasProfessor || "—"}</td>
                  <td
                    className={cn(
                      "px-2 py-2 text-right tabular-nums",
                      c.cobertura !== null && c.cobertura < 100 ? "text-flame-400" : "text-brand-100/75",
                    )}
                  >
                    {fmtPct(c.cobertura)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-brand-100/75">{c.valor ? fmtReal(c.valor) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-brand-100/75">
                    {c.saldo !== null && c.saldo < 0 ? `${fmtReal(-c.saldo)} a mais` : c.saldo === 0 ? "Quitado" : fmtReal(c.saldo)}
                  </td>
                  <td className="px-2 py-2">
                    <Badge variant={SITUACAO[c.situacao].variante}>{SITUACAO[c.situacao].rotulo}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {semRevista.length > 0 && (
          <p className="mt-3 text-[0.76rem] text-brand-200/60">
            {semRevista.length} congregação(ões) pediram menos revistas de aluno do que têm matriculados.
          </p>
        )}
      </Secao>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Aba: Panoramas
 * ------------------------------------------------------------------ */

const DIRECAO = {
  subindo: { rotulo: "Subindo", icone: ArrowUpRight, cor: "text-emerald-300" },
  caindo: { rotulo: "Caindo", icone: ArrowDownRight, cor: "text-flame-400" },
  estavel: { rotulo: "Estável", icone: ArrowRight, cor: "text-brand-100/70" },
  "sem-base": { rotulo: "Pouco dado", icone: Minus, cor: "text-brand-200/45" },
} as const;

function AbaPanorama() {
  const [dados, setDados] = useState<RespPanorama | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    buscar<RespPanorama>("/api/estatisticas/panorama", controle.signal)
      .then(setDados)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setErro(e.message || "Não foi possível carregar os panoramas.");
      });
    return () => controle.abort();
  }, []);

  const pontos: PontoTaxa[] = useMemo(() => {
    if (!dados) return [];
    const reais: PontoTaxa[] = dados.serie.map((p) => ({ data: p.data, taxa: p.taxa, projetada: null }));
    if (dados.projecao.length > 0 && reais.length > 0) {
      // A linha tracejada sai do último domingo real, para as duas se emendarem.
      reais[reais.length - 1] = { ...reais[reais.length - 1], projetada: reais[reais.length - 1].taxa };
    }
    return [...reais, ...dados.projecao.map((p) => ({ data: p.data, taxa: null, projetada: p.taxa }))];
  }, [dados]);

  if (erro) return <EstadoErro mensagem={erro} />;
  if (!dados) return <EsqueletoLista />;

  const ultima = dados.serie[dados.serie.length - 1];
  const fim = dados.projecao[dados.projecao.length - 1];
  const t = dados.tendenciaSemanal;

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          rotulo="Presença no último domingo"
          valor={fmtPct(ultima?.taxa)}
          nota={ultima ? `${ultima.presentes} de ${ultima.base} · ${dataBr(ultima.data)}` : "sem chamada recente"}
        />
        <Kpi
          rotulo="Ritmo"
          valor={t === null ? "—" : `${t > 0 ? "+" : ""}${fmtDec(t)} pt`}
          nota="por semana, nos últimos 12 domingos"
        />
        <Kpi rotulo="Projeção em 4 semanas" valor={fmtPct(fim?.taxa)} nota={fim ? `≈ ${fim.presentes} presentes por domingo` : "precisa de 4 domingos de dado"} />
        <Kpi
          rotulo="Matriculados no próximo trimestre"
          valor={numero(dados.matriculas.projetadosNoProximoTrimestre)}
          nota={`hoje ${numero(dados.matriculas.atuais)} · ${fmtDec(dados.matriculas.mediaMensal)} novas/mês`}
        />
      </div>

      <Secao
        titulo="Presença do campo e projeção"
        descricao={`Presentes ÷ matriculados, últimas ${dados.janela.semanas} semanas. O tracejado é a reta dos últimos domingos esticada 4 semanas adiante — estimativa, não promessa.`}
      >
        {dados.serie.length === 0 ? (
          <p className="text-[0.8rem] text-brand-200/60">Sem chamadas nas últimas {dados.janela.semanas} semanas.</p>
        ) : (
          <GraficoTaxaComProjecao dados={pontos} />
        )}
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Novas matrículas por mês" descricao="Alunos matriculados pelo portal (os herdados da planilha não têm data)." className="mb-0 lg:mb-4">
          <GraficoBarras
            rotuloValor="Novas matrículas"
            altura="h-44"
            dados={dados.matriculas.meses.map((m) => ({
              rotulo: fmtMes.format(new Date(`${m.mes}-15T12:00:00`)).replace(".", ""),
              valor: m.novas,
            }))}
          />
        </Secao>

        <Secao titulo={`Revistas — ${dados.revistas.trimestre.rotulo}`} descricao="Estimativa de revistas de aluno, pela projeção de matriculados.">
          <div className="flex items-end gap-6">
            <div>
              <p className="font-display text-[2rem] font-semibold tabular-nums text-white">≈ {numero(dados.revistas.estimativaAluno)}</p>
              <p className="text-[0.74rem] text-brand-200/55">revistas de aluno</p>
            </div>
            {dados.revistas.valorEstimado !== null && (
              <div>
                <p className="font-display text-[1.3rem] font-semibold tabular-nums text-gold-200">≈ {fmtReal(dados.revistas.valorEstimado)}</p>
                <p className="text-[0.74rem] text-brand-200/55">pelo preço médio do último pedido</p>
              </div>
            )}
          </div>
          <p className="mt-3 text-[0.76rem] text-brand-200/60">
            {dados.revistas.ultimoPedidoAluno !== null
              ? `No ${dados.revistas.ultimoTrimestre?.replace(/^(\d)T-(\d{4})$/, "$1º trimestre de $2")} foram pedidas ${numero(dados.revistas.ultimoPedidoAluno)} revistas de aluno.`
              : "Ainda não há pedido confirmado anterior para comparar."}
          </p>
        </Secao>
      </div>

      <Secao
        titulo="Cada congregação: para onde está indo"
        descricao="Últimos 6 domingos com chamada contra os 6 anteriores. Projeção: a reta da congregação, 4 semanas adiante."
      >
        <ul className="divide-y divide-white/6">
          {dados.tendencias.map((c) => {
            const d = DIRECAO[c.direcao];
            const Icone = d.icone;
            return (
              <li key={c.congId} className="flex items-center gap-3 py-2">
                <span className={cn("flex w-24 shrink-0 items-center gap-1 text-[0.76rem]", d.cor)}>
                  <Icone className="h-4 w-4" />
                  {d.rotulo}
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.84rem] text-brand-50">{c.nome}</span>
                <span className="w-20 shrink-0 text-right text-[0.8rem] tabular-nums text-brand-100/80">{fmtPct(c.atual)}</span>
                <span className="hidden w-20 shrink-0 text-right text-[0.76rem] tabular-nums text-brand-200/60 sm:block">
                  {c.variacao === null ? "—" : `${c.variacao > 0 ? "+" : ""}${fmtDec(c.variacao)} pt`}
                </span>
                <span className="w-24 shrink-0 text-right text-[0.76rem] tabular-nums text-brand-200/60">
                  {c.projecao === null ? "—" : `→ ${fmtPct(c.projecao)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </Secao>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * A página
 * ------------------------------------------------------------------ */

const ABAS: Array<{ chave: Aba; rotulo: string; icone: typeof Trophy }> = [
  { chave: "ranking", rotulo: "Ranking", icone: Trophy },
  { chave: "pedidos", rotulo: "Pedidos de lição", icone: BookMarked },
  { chave: "panorama", rotulo: "Panoramas", icone: TrendingUp },
];

export default function EstatisticasPage() {
  const [aba, setAba] = useState<Aba>("ranking");
  // O período mora aqui, e não na aba: o Modo Data Show apresenta o MESMO
  // período que está escolhido na tela.
  const [atalho, setAtalho] = useState<Atalho | null>("trimestre");
  const [periodo, setPeriodo] = useState<Periodo>({ de: "", ate: "" });
  const [projetando, setProjetando] = useState(false);

  // As datas só no cliente: no servidor, em UTC, "hoje" pode ser outro dia.
  useEffect(() => setPeriodo(periodoDoAtalho("trimestre")), []);

  return (
    <>
      <CabecalhoModulo
        icone={BarChart3}
        titulo="Estatísticas"
        descricao="Medição da Escola Bíblica: presença diante dos matriculados, pedidos e panoramas"
      >
        <div className="flex gap-2 print:hidden">
          {/*
            Data show: tela cheia, letra grande e alto contraste, para mostrar
            o ranking no telão — inclusive em salão claro ou com luz irregular,
            onde o azul-escuro do portal vira um cinza lavado.
          */}
          <Button size="sm" onClick={() => setProjetando(true)} disabled={!periodo.de}>
            <MonitorPlay className="h-4 w-4" />
            Data show
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </CabecalhoModulo>

      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.03] p-1 print:hidden">
        {ABAS.map((a) => {
          const Icone = a.icone;
          return (
            <button
              key={a.chave}
              type="button"
              role="tab"
              aria-selected={aba === a.chave}
              onClick={() => setAba(a.chave)}
              className={cn(
                "flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-[0.82rem] transition-colors",
                aba === a.chave ? "bg-white/[0.09] text-white ring-1 ring-gold-300/30" : "text-brand-200/65 hover:text-white",
              )}
            >
              <Icone className="h-4 w-4" />
              {a.rotulo}
            </button>
          );
        })}
      </div>

      {aba === "ranking" && (
        <AbaRanking atalho={atalho} setAtalho={setAtalho} periodo={periodo} setPeriodo={setPeriodo} />
      )}
      {aba === "pedidos" && <AbaPedidos />}
      {aba === "panorama" && <AbaPanorama />}

      {projetando && periodo.de && <ModoDataShow de={periodo.de} ate={periodo.ate} aoFechar={() => setProjetando(false)} />}
    </>
  );
}
