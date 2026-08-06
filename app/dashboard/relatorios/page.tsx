"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ChartColumn, Minus, Percent, TrendingDown, TrendingUp, UserRoundPlus, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { numero } from "@/lib/dashboard/formato";

/**
 * Relatório de frequência — índices por período e por recorte.
 *
 * ============================================================================
 * DUAS PERGUNTAS, RESPONDIDAS SEM TROCAR DE TELA
 *
 * "Como estamos ao longo do tempo?" (domingo a domingo, mês, trimestre) e
 * "quem está melhor?" (por congregação, por classe). Os dois botões no topo
 * mudam a mesma consulta — a linha do tempo troca de balde, a tabela troca de
 * agrupamento — sem recarregar a página inteira.
 *
 * A COLUNA QUE MANDA É A TAXA (%), não o total de presenças: uma classe que fez
 * chamada em 3 domingos e outra em 12 não se comparam pela soma. A taxa divide
 * pelas presenças+faltas REGISTRADAS — "faltou" nunca é "não foi marcado".
 * ============================================================================
 */

type TendenciaTipo = "subindo" | "descendo" | "estavel" | "sem-base";
interface Tendencia {
  mediaAnterior: number | null;
  mediaRecente: number | null;
  variacao: number | null;
  variacaoPct: number | null;
  tendencia: TendenciaTipo;
}

interface LinhaClasse extends Tendencia {
  classeId: number | null;
  classe: string;
  congregacao: string;
  domingos: number;
  presencas: number;
  faltas: number;
  media: number;
  taxa: number;
}
interface LinhaCong extends Tendencia {
  congId: number | null;
  congregacao: string;
  domingos: number;
  classes: number;
  presencas: number;
  faltas: number;
  media: number;
  taxa: number;
}
interface PontoSerie {
  rotulo: string;
  presentes: number;
  faltas: number;
  chamadas: number;
  classes: number;
  taxa: number;
}

interface Relatorio {
  periodo: { de: string; ate: string };
  por: "domingo" | "mes" | "trimestre";
  serie: PontoSerie[];
  porClasse: LinhaClasse[];
  porCongregacao: LinhaCong[];
  campo: Tendencia;
  visitantes: number;
  matriculados: number;
}

type Por = "domingo" | "mes" | "trimestre";
type Agrupar = "congregacao" | "classe";

function Resumo({
  icone: Icone,
  rotulo,
  valor,
  nota,
}: {
  icone: typeof Users;
  rotulo: string;
  valor: string;
  nota: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/8">
          <Icone className="h-4 w-4 text-gold-300" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[1.3rem] font-semibold leading-none text-white tabular-nums">{valor}</p>
          <p className="mt-1 truncate text-[0.74rem] text-brand-100/75">{rotulo}</p>
        </div>
      </div>
      <p className="mt-2 truncate text-[0.7rem] text-brand-200/45">{nota}</p>
    </div>
  );
}

/** Botões de alternância — o mesmo desenho para período e agrupamento. */
function Alternar<T extends string>({
  valor,
  opcoes,
  aoMudar,
}: {
  valor: T;
  opcoes: ReadonlyArray<readonly [T, string]>;
  aoMudar: (v: T) => void;
}) {
  return (
    <div className="flex h-10 items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
      {opcoes.map(([v, rotulo]) => (
        <button
          key={v}
          type="button"
          onClick={() => aoMudar(v)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[0.78rem] transition-colors",
            valor === v ? "bg-gold-400/20 text-gold-100" : "text-brand-200/60 hover:text-brand-100",
          )}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

function corDaTaxa(t: number): string {
  if (t >= 75) return "text-emerald-300";
  if (t >= 50) return "text-gold-200";
  return "text-flame-400/85";
}

/**
 * A seta de tendência — cresceu, caiu, ficou igual ou não dá para comparar.
 *
 * "sem-base" aparece quando falta chamada numa das metades do período: dizer
 * "cresceu" ali seria inventar. É informação honesta, não um buraco.
 */
function Seta({ t, texto = true }: { t: Tendencia; texto?: boolean }) {
  if (t.tendencia === "sem-base") {
    return <span className="text-[0.72rem] text-brand-300/40">sem base</span>;
  }
  const config = {
    subindo: { Icone: TrendingUp, cor: "text-emerald-300", sinal: "+" },
    descendo: { Icone: TrendingDown, cor: "text-flame-400/90", sinal: "" },
    estavel: { Icone: Minus, cor: "text-brand-200/60", sinal: "" },
  }[t.tendencia];
  const { Icone, cor, sinal } = config;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", cor)}>
      <Icone className="h-3.5 w-3.5 shrink-0" />
      {texto && t.variacao !== null && (
        <span className="text-[0.76rem] font-medium">
          {sinal}
          {t.variacao.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
          {t.variacaoPct !== null && ` (${sinal}${t.variacaoPct}%)`}
        </span>
      )}
    </span>
  );
}

/** Frase-manchete do campo. */
function manchete(t: Tendencia): { titulo: string; sub: string; cor: string } {
  if (t.tendencia === "sem-base") {
    return {
      titulo: "Ainda sem base para comparar",
      sub: "É preciso ter chamada nas duas metades do período para dizer se cresceu ou caiu.",
      cor: "text-brand-100",
    };
  }
  const de = t.mediaAnterior?.toLocaleString("pt-BR", { minimumFractionDigits: 1 }) ?? "—";
  const para = t.mediaRecente?.toLocaleString("pt-BR", { minimumFractionDigits: 1 }) ?? "—";
  if (t.tendencia === "subindo") {
    return {
      titulo: "A frequência está crescendo",
      sub: `Média por domingo passou de ${de} para ${para} presentes na segunda metade do período.`,
      cor: "text-emerald-300",
    };
  }
  if (t.tendencia === "descendo") {
    return {
      titulo: "A frequência está caindo",
      sub: `Média por domingo passou de ${de} para ${para} presentes na segunda metade do período.`,
      cor: "text-flame-400",
    };
  }
  return {
    titulo: "A frequência está estável",
    sub: `Média por domingo perto de ${para} presentes, sem mudança relevante no período.`,
    cor: "text-gold-200",
  };
}

export default function RelatoriosPage() {
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [por, setPor] = useState<Por>("domingo");
  const [agrupar, setAgrupar] = useState<Agrupar>("congregacao");

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        const url = new URL("/api/relatorios", window.location.origin);
        if (de) url.searchParams.set("de", de);
        if (ate) url.searchParams.set("ate", ate);
        url.searchParams.set("por", por);
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        const r: Relatorio = await res.json();
        setDados(r);
        if (!de) setDe(r.periodo.de);
        if (!ate) setAte(r.periodo.ate);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status
            ? "O servidor respondeu com erro. Abra /api/diagnostico para ver o motivo."
            : "Sem resposta do servidor. Verifique a conexão.",
        );
      }
    })();
    return () => controle.abort();
  }, [de, ate, por]);

  const totalPresencas = dados?.porClasse.reduce((s, l) => s + l.presencas, 0) ?? 0;
  const totalFaltas = dados?.porClasse.reduce((s, l) => s + l.faltas, 0) ?? 0;
  const taxaGeral =
    totalPresencas + totalFaltas > 0
      ? Math.round((1000 * totalPresencas) / (totalPresencas + totalFaltas)) / 10
      : 0;
  const maxSerie = Math.max(1, ...(dados?.serie.map((s) => s.presentes) ?? [1]));

  // Destaques: quem mais cresceu e quem mais caiu, entre as congregações com
  // base para comparar. É o que responde "quem está subindo e quem está caindo".
  const comVariacao = (dados?.porCongregacao ?? []).filter((c) => c.variacao !== null);
  const maiorAlta = comVariacao
    .filter((c) => c.tendencia === "subindo")
    .sort((a, b) => (b.variacao ?? 0) - (a.variacao ?? 0))[0];
  const maiorQueda = comVariacao
    .filter((c) => c.tendencia === "descendo")
    .sort((a, b) => (a.variacao ?? 0) - (b.variacao ?? 0))[0];

  return (
    <>
      <CabecalhoModulo icone={ChartColumn} titulo="Relatórios" descricao="Índices de frequência por período e recorte">
        <div className="flex flex-wrap gap-2">
          {([
            ["De", de, setDe],
            ["Até", ate, setAte],
          ] as const).map(([rotulo, valor, definir]) => (
            <label
              key={rotulo}
              className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]"
            >
              <span className="shrink-0 text-brand-200/55">{rotulo}</span>
              <input
                type="date"
                value={valor}
                onChange={(e) => definir(e.target.value)}
                className="bg-transparent text-brand-50 focus:outline-none [color-scheme:dark]"
              />
            </label>
          ))}
        </div>
      </CabecalhoModulo>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : !dados ? (
        <EsqueletoLista />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Resumo
              icone={Percent}
              rotulo="Taxa de presença"
              valor={`${taxaGeral.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%`}
              nota="presentes ÷ chamados no período"
            />
            <Resumo
              icone={Users}
              rotulo="Presenças no período"
              valor={numero(totalPresencas)}
              nota={`${dados.serie.length} ${dados.por === "domingo" ? "domingos" : dados.por === "mes" ? "meses" : "trimestres"} com chamada`}
            />
            <Resumo
              icone={TrendingUp}
              rotulo="Matriculados ativos"
              valor={numero(dados.matriculados)}
              nota="base atual"
            />
            <Resumo
              icone={UserRoundPlus}
              rotulo="Visitantes"
              valor={numero(dados.visitantes)}
              nota="recebidos no período"
            />
          </div>

          {/* ---------------- Manchete: crescendo ou caindo ---------------- */}
          {(() => {
            const m = manchete(dados.campo);
            return (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="glass-panel mt-4 flex items-start gap-3 rounded-2xl p-4"
              >
                <span className="mt-0.5 shrink-0">
                  <Seta t={dados.campo} texto={false} />
                </span>
                <div className="min-w-0">
                  <p className={cn("font-display text-[0.98rem] font-semibold", m.cor)}>{m.titulo}</p>
                  <p className="mt-0.5 text-[0.8rem] leading-relaxed text-brand-100/75">{m.sub}</p>
                </div>
              </motion.div>
            );
          })()}

          {/* ---------------- Destaques: maior alta e maior queda ---------------- */}
          {(maiorAlta || maiorQueda) && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {maiorAlta && (
                <div className="glass-panel rounded-2xl p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.14em] text-emerald-300/80">
                    Em maior crescimento
                  </p>
                  <p className="mt-1 truncate font-display text-[0.98rem] font-semibold text-white">
                    {maiorAlta.congregacao}
                  </p>
                  <p className="mt-0.5 text-[0.8rem] text-brand-100/70">
                    <Seta t={maiorAlta} /> presentes por domingo
                  </p>
                </div>
              )}
              {maiorQueda && (
                <div className="glass-panel rounded-2xl p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.14em] text-flame-400/80">
                    Precisa de atenção
                  </p>
                  <p className="mt-1 truncate font-display text-[0.98rem] font-semibold text-white">
                    {maiorQueda.congregacao}
                  </p>
                  <p className="mt-0.5 text-[0.8rem] text-brand-100/70">
                    <Seta t={maiorQueda} /> presentes por domingo
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ---------------- Linha do tempo ---------------- */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel mt-4 overflow-hidden rounded-2xl"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-3.5">
              <h2 className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white">
                Ao longo do tempo
              </h2>
              <Alternar<Por>
                valor={por}
                aoMudar={setPor}
                opcoes={[
                  ["domingo", "Domingo"],
                  ["mes", "Mês"],
                  ["trimestre", "Trimestre"],
                ]}
              />
            </header>

            {dados.serie.length === 0 ? (
              <EstadoVazio mensagem="Nenhuma chamada registrada neste período." />
            ) : (
              <ul className="divide-y divide-white/6">
                {dados.serie.map((s) => {
                  const total = s.presentes + s.faltas;
                  return (
                    <li key={s.rotulo} className="flex items-center gap-4 px-5 py-2.5">
                      <span className="w-20 shrink-0 text-[0.8rem] tabular-nums text-brand-100/80">{s.rotulo}</span>
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/8">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-brand-400 to-gold-400"
                          style={{ width: `${(s.presentes / maxSerie) * 100}%` }}
                        />
                      </div>
                      <span className={cn("w-14 shrink-0 text-right text-[0.8rem] font-semibold tabular-nums", corDaTaxa(s.taxa))}>
                        {s.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}%
                      </span>
                      <span className="hidden w-28 shrink-0 text-right text-[0.78rem] tabular-nums text-brand-200/60 sm:block">
                        <span className="text-emerald-300">{numero(s.presentes)}</span> de {numero(total)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.section>

          {/* ---------------- Ranking por congregação / classe ---------------- */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel mt-4 overflow-hidden rounded-2xl"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-3.5">
              <div>
                <h2 className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white">
                  Índice por {agrupar === "congregacao" ? "congregação" : "classe"}
                </h2>
                <p className="mt-0.5 text-[0.74rem] text-brand-200/55">
                  Ordenado pela taxa de presença — presentes ÷ chamados
                </p>
              </div>
              <Alternar<Agrupar>
                valor={agrupar}
                aoMudar={setAgrupar}
                opcoes={[
                  ["congregacao", "Congregação"],
                  ["classe", "Classe"],
                ]}
              />
            </header>

            {(agrupar === "congregacao" ? dados.porCongregacao : dados.porClasse).length === 0 ? (
              <EstadoVazio mensagem="Nenhuma chamada registrada neste período." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] text-left">
                  <thead>
                    <tr className="text-[0.68rem] uppercase tracking-[0.14em] text-brand-200/45">
                      <th className="px-5 py-2.5 font-medium">
                        {agrupar === "congregacao" ? "Congregação" : "Classe"}
                      </th>
                      <th className="px-3 py-2.5 font-medium">
                        {agrupar === "congregacao" ? "Classes" : "Congregação"}
                      </th>
                      <th className="px-3 py-2.5 text-right font-medium">Domingos</th>
                      <th className="px-3 py-2.5 text-right font-medium">Presenças</th>
                      <th className="px-3 py-2.5 text-right font-medium">Faltas</th>
                      <th className="px-3 py-2.5 text-right font-medium">Taxa</th>
                      <th className="px-5 py-2.5 text-right font-medium">Tendência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {agrupar === "congregacao"
                      ? dados.porCongregacao.map((l, i) => (
                          <tr key={l.congId ?? `sem-${i}`} className="transition-colors duration-300 hover:bg-white/[0.03]">
                            <td className="px-5 py-2.5 text-[0.84rem] text-brand-50">{l.congregacao}</td>
                            <td className="px-3 py-2.5 text-[0.8rem] tabular-nums text-brand-200/60">{l.classes}</td>
                            <td className="px-3 py-2.5 text-right text-[0.8rem] tabular-nums text-brand-200/70">{l.domingos}</td>
                            <td className="px-3 py-2.5 text-right text-[0.8rem] tabular-nums text-emerald-300/85">{numero(l.presencas)}</td>
                            <td className="px-3 py-2.5 text-right text-[0.8rem] tabular-nums text-flame-400/75">{numero(l.faltas)}</td>
                            <td className={cn("px-3 py-2.5 text-right text-[0.86rem] font-semibold tabular-nums", corDaTaxa(l.taxa))}>
                              {l.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
                            </td>
                            <td className="px-5 py-2.5 text-right"><Seta t={l} /></td>
                          </tr>
                        ))
                      : dados.porClasse.map((l, i) => (
                          <tr key={l.classeId ?? `sem-${i}`} className="transition-colors duration-300 hover:bg-white/[0.03]">
                            <td className="px-5 py-2.5 text-[0.84rem] text-brand-50">{l.classe}</td>
                            <td className="px-3 py-2.5 text-[0.78rem] text-brand-200/60">{l.congregacao}</td>
                            <td className="px-3 py-2.5 text-right text-[0.8rem] tabular-nums text-brand-200/70">{l.domingos}</td>
                            <td className="px-3 py-2.5 text-right text-[0.8rem] tabular-nums text-emerald-300/85">{numero(l.presencas)}</td>
                            <td className="px-3 py-2.5 text-right text-[0.8rem] tabular-nums text-flame-400/75">{numero(l.faltas)}</td>
                            <td className={cn("px-3 py-2.5 text-right text-[0.86rem] font-semibold tabular-nums", corDaTaxa(l.taxa))}>
                              {l.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
                            </td>
                            <td className="px-5 py-2.5 text-right"><Seta t={l} /></td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.section>
        </>
      )}
    </>
  );
}
