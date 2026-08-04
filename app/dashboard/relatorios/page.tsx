"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChartColumn, Coins, TrendingUp, UserRoundPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { numero } from "@/lib/dashboard/formato";

/**
 * Relatórios de frequência e ofertas.
 *
 * A COLUNA QUE IMPORTA E "MEDIA POR DOMINGO", e nao o total de presencas. Uma
 * classe que fez chamada em 3 domingos e outra que fez em 12 nao sao
 * comparaveis pela soma: a segunda pareceria quatro vezes melhor so por ter
 * registrado mais vezes. A media divide pelos domingos que TIVERAM chamada.
 *
 * A coluna "domingos" fica visivel de proposito. Ela e o denominador — e uma
 * media de 40 apurada em 1 domingo nao vale o mesmo que uma media de 38 apurada
 * em 12.
 */

interface LinhaClasse {
  classeId: number | null;
  classe: string;
  congregacao: string;
  domingos: number;
  presencas: number;
  faltas: number;
  media: number;
}

interface Relatorio {
  periodo: { de: string; ate: string };
  porClasse: LinhaClasse[];
  porDomingo: Array<{ data: string; presentes: number; faltas: number; classes: number }>;
  ofertas: { total: number; lancamentos: number };
  visitantes: number;
  matriculados: number;
}

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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
          <p className="font-display text-[1.3rem] font-semibold leading-none text-white tabular-nums">
            {valor}
          </p>
          <p className="mt-1 truncate text-[0.74rem] text-brand-100/75">{rotulo}</p>
        </div>
      </div>
      <p className="mt-2 truncate text-[0.7rem] text-brand-200/45">{nota}</p>
    </div>
  );
}

export default function RelatoriosPage() {
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        const url = new URL("/api/relatorios", window.location.origin);
        if (de) url.searchParams.set("de", de);
        if (ate) url.searchParams.set("ate", ate);
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        const r: Relatorio = await res.json();
        setDados(r);
        // Preenche os campos com o período que o servidor realmente usou —
        // senão eles ficam vazios e ninguém sabe de quando é o relatório.
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
  }, [de, ate]);

  const totalPresencas = dados?.porClasse.reduce((s, l) => s + l.presencas, 0) ?? 0;

  return (
    <>
      <CabecalhoModulo
        icone={ChartColumn}
        titulo="Relatórios"
        descricao="Frequência por classe e ofertas do período"
      >
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
              icone={Users}
              rotulo="Presenças no período"
              valor={numero(totalPresencas)}
              nota={`${dados.porDomingo.length} domingos com chamada`}
            />
            <Resumo
              icone={TrendingUp}
              rotulo="Matriculados ativos"
              valor={numero(dados.matriculados)}
              nota="base de comparação atual"
            />
            <Resumo
              icone={UserRoundPlus}
              rotulo="Visitantes"
              valor={numero(dados.visitantes)}
              nota="recebidos no período"
            />
            <Resumo
              icone={Coins}
              rotulo="Ofertas"
              valor={dinheiro.format(dados.ofertas.total)}
              nota={`${dados.ofertas.lancamentos} lançamentos`}
            />
          </div>

          {/* ---------------- Por classe ---------------- */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel mt-4 overflow-hidden rounded-2xl"
          >
            <header className="border-b border-white/8 px-5 py-3.5">
              <h2 className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white">
                Frequência por classe
              </h2>
              <p className="mt-0.5 text-[0.74rem] text-brand-200/55">
                Média por domingo — divide pelos domingos que tiveram chamada, não pelo
                total de semanas
              </p>
            </header>

            {dados.porClasse.length === 0 ? (
              <EstadoVazio mensagem="Nenhuma chamada registrada neste período." />
            ) : (
              /* Rolagem horizontal PROPRIA: no celular a tabela nao cabe, e sem
                 este container quem rolaria seria a pagina inteira. */
              <div className="overflow-x-auto">
                <table className="w-full min-w-[38rem] text-left">
                  <thead>
                    <tr className="text-[0.68rem] uppercase tracking-[0.14em] text-brand-200/45">
                      <th className="px-5 py-2.5 font-medium">Classe</th>
                      <th className="px-3 py-2.5 font-medium">Congregação</th>
                      <th className="px-3 py-2.5 text-right font-medium">Domingos</th>
                      <th className="px-3 py-2.5 text-right font-medium">Presenças</th>
                      <th className="px-3 py-2.5 text-right font-medium">Faltas</th>
                      <th className="px-5 py-2.5 text-right font-medium">Média</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {dados.porClasse.map((l, i) => (
                      <tr
                        key={l.classeId ?? `sem-${i}`}
                        className="transition-colors duration-300 hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-2.5 text-[0.84rem] text-brand-50">{l.classe}</td>
                        <td className="px-3 py-2.5 text-[0.78rem] text-brand-200/60">
                          {l.congregacao}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[0.8rem] tabular-nums text-brand-200/70">
                          {l.domingos}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[0.8rem] tabular-nums text-emerald-300/85">
                          {numero(l.presencas)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[0.8rem] tabular-nums text-flame-400/75">
                          {numero(l.faltas)}
                        </td>
                        <td className="px-5 py-2.5 text-right text-[0.86rem] font-semibold tabular-nums text-gold-200">
                          {l.media.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.section>

          {/* ---------------- Por domingo ---------------- */}
          {dados.porDomingo.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel mt-4 overflow-hidden rounded-2xl"
            >
              <header className="border-b border-white/8 px-5 py-3.5">
                <h2 className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white">
                  Domingo a domingo
                </h2>
              </header>
              <ul className="divide-y divide-white/6">
                {dados.porDomingo.map((d) => {
                  const total = d.presentes + d.faltas;
                  const taxa = total > 0 ? d.presentes / total : 0;
                  return (
                    <li key={d.data} className="flex items-center gap-4 px-5 py-2.5">
                      <span className="w-24 shrink-0 text-[0.8rem] tabular-nums text-brand-100/80">
                        {new Date(`${d.data}T12:00:00`).toLocaleDateString("pt-BR")}
                      </span>
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/8">
                        <span
                          className={cn(
                            "block h-full rounded-full bg-gradient-to-r from-brand-400 to-gold-400",
                          )}
                          style={{ width: `${taxa * 100}%` }}
                        />
                      </div>
                      <span className="w-32 shrink-0 text-right text-[0.78rem] tabular-nums text-brand-200/70">
                        <span className="text-emerald-300">{d.presentes}</span> de {total}
                      </span>
                      <span className="hidden w-24 shrink-0 text-right text-[0.74rem] text-brand-200/45 sm:block">
                        {d.classes} {d.classes === 1 ? "classe" : "classes"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          )}
        </>
      )}
    </>
  );
}
