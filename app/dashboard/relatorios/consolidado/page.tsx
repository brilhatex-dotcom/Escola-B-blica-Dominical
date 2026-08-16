"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Percent, Printer, UserRoundPlus, Users, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { CabecalhoModulo, EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import { Button } from "@/components/ui/button";
import { domingoMaisRecente, numero } from "@/lib/dashboard/formato";

/**
 * Relatório Consolidado por Domingo — o campo inteiro somado, num dia só.
 *
 * O Relatório Semanal já existe, mas é por congregação (o Dirigente escolhe
 * a própria). Este soma todas: "no domingo tal, quantos matriculados,
 * presentes e faltas o CAMPO teve?" — e fecha com o ranking completo por
 * congregação, não só o Top 3 do Encarte.
 */

interface LinhaCong { id: number; nome: string; matriculados: number; presentes: number; faltas: number; taxa: number }
interface Totais {
  matriculados: number; presentes: number; faltas: number; visitantes: number;
  congregacoesParticipantes: number; congregacoesTotal: number; taxa: number;
}
interface Dados { data: string; totais: Totais; congregacoes: LinhaCong[] }

const fmtDataLonga = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

function corDaTaxa(t: number): string {
  if (t >= 75) return "text-emerald-300";
  if (t >= 50) return "text-gold-200";
  return "text-flame-400/85";
}

function Kpi({ icone: Icone, rotulo, valor, nota }: { icone: typeof Users; rotulo: string; valor: string; nota: string }) {
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

export default function ConsolidadoPage() {
  const [data, setData] = useState(domingoMaisRecente());
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        const url = new URL("/api/relatorios/consolidado", window.location.origin);
        url.searchParams.set("data", data);
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDados(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(status === 403 ? "O seu acesso não permite ver esta tela." : "Não foi possível carregar o relatório.");
      }
    })();
    return () => controle.abort();
  }, [data]);

  return (
    <>
      <div className="print:hidden">
        <Link href="/dashboard/relatorios" className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] text-brand-200/60 transition-colors duration-300 hover:text-gold-200">
          <ArrowLeft className="h-3.5 w-3.5" />
          Painel de Relatórios
        </Link>

        <CabecalhoModulo icone={CalendarDays} titulo="Relatório Consolidado" descricao="O campo inteiro somado, num domingo só">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
            <span className="shrink-0 text-brand-200/55">Domingo</span>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="bg-transparent text-brand-50 focus:outline-none [color-scheme:dark]"
            />
          </label>
          {dados && (
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          )}
        </CabecalhoModulo>
      </div>

      {erro ? (
        <div className="print:hidden"><EstadoErro mensagem={erro} /></div>
      ) : !dados ? (
        <div className="print:hidden"><EsqueletoLista linhas={6} /></div>
      ) : (
        <>
          {/* Cabeçalho impresso — só aparece no papel/PDF */}
          <div className="hidden text-center print:block">
            <p className="text-[0.7rem] uppercase tracking-[0.2em]">Assembleia de Deus — IEADPE Betânia (PE)</p>
            <h1 className="mt-1 text-[1.1rem] font-bold uppercase tracking-wide">
              Relatório Consolidado — {fmtDataLonga.format(new Date(`${dados.data}T12:00:00`))}
            </h1>
            <p className="mt-1 text-[0.8rem]">
              Campo: {numero(dados.totais.matriculados)} matriculados · {numero(dados.totais.presentes)} presentes ·{" "}
              {numero(dados.totais.faltas)} faltas · {dados.totais.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}% de presença
            </p>
          </div>

          <div className="print:hidden">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi icone={UsersRound} rotulo="Matriculados" valor={numero(dados.totais.matriculados)} nota="base ativa do campo, hoje" />
              <Kpi icone={Users} rotulo="Presentes" valor={numero(dados.totais.presentes)} nota="neste domingo, campo inteiro" />
              <Kpi icone={Users} rotulo="Faltas" valor={numero(dados.totais.faltas)} nota="registradas neste domingo" />
              <Kpi icone={Percent} rotulo="Taxa do campo" valor={`${dados.totais.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%`} nota="presentes ÷ matriculados" />
              <Kpi icone={UserRoundPlus} rotulo="Visitantes" valor={numero(dados.totais.visitantes)} nota="recebidos neste domingo" />
            </div>

            {dados.totais.congregacoesParticipantes < dados.totais.congregacoesTotal && (
              <p className="mt-3 text-[0.76rem] text-brand-200/50">
                {dados.totais.congregacoesParticipantes} de {dados.totais.congregacoesTotal} congregações fizeram chamada neste domingo —
                as demais não entram nos totais de presentes/faltas, só de matriculados.
              </p>
            )}
          </div>

          {/* Ranking completo — aparece na tela e na impressão */}
          <div className="glass-panel mt-4 overflow-hidden rounded-2xl">
            <header className="border-b border-white/8 px-5 py-3.5 print:border-black">
              <h2 className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white print:text-black">
                Ranking por congregação
              </h2>
              <p className="mt-0.5 text-[0.74rem] text-brand-200/55 print:text-black">
                Presentes ÷ matriculados, {fmtDataLonga.format(new Date(`${dados.data}T12:00:00`))}
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left">
                <thead>
                  <tr className="text-[0.68rem] uppercase tracking-[0.14em] text-brand-200/45 print:text-black">
                    <th className="px-5 py-2.5 font-medium">#</th>
                    <th className="px-3 py-2.5 font-medium">Congregação</th>
                    <th className="px-3 py-2.5 text-right font-medium">Matriculados</th>
                    <th className="px-3 py-2.5 text-right font-medium">Presentes</th>
                    <th className="px-3 py-2.5 text-right font-medium">Faltas</th>
                    <th className="px-5 py-2.5 text-right font-medium">Taxa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 print:divide-black/20">
                  {dados.congregacoes.map((c, i) => (
                    <tr key={c.id} className="transition-colors duration-300 hover:bg-white/[0.03]">
                      <td className="px-5 py-2.5 text-[0.8rem] tabular-nums text-brand-200/50 print:text-black">{i + 1}º</td>
                      <td className="px-3 py-2.5 text-[0.84rem] text-brand-50 print:text-black">{c.nome}</td>
                      <td className="px-3 py-2.5 text-right text-[0.8rem] tabular-nums text-brand-200/70 print:text-black">{numero(c.matriculados)}</td>
                      <td className="px-3 py-2.5 text-right text-[0.8rem] tabular-nums text-emerald-300/85 print:text-black">{numero(c.presentes)}</td>
                      <td className="px-3 py-2.5 text-right text-[0.8rem] tabular-nums text-flame-400/75 print:text-black">{numero(c.faltas)}</td>
                      <td className={cn("px-5 py-2.5 text-right text-[0.86rem] font-semibold tabular-nums print:text-black", corDaTaxa(c.taxa))}>
                        {c.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-white/15 print:border-black">
                    <td className="px-5 py-2.5" />
                    <td className="px-3 py-2.5 text-[0.8rem] font-semibold uppercase tracking-wide text-brand-100/85 print:text-black">Campo</td>
                    <td className="px-3 py-2.5 text-right text-[0.86rem] font-semibold tabular-nums text-white print:text-black">{numero(dados.totais.matriculados)}</td>
                    <td className="px-3 py-2.5 text-right text-[0.86rem] font-semibold tabular-nums text-white print:text-black">{numero(dados.totais.presentes)}</td>
                    <td className="px-3 py-2.5 text-right text-[0.86rem] font-semibold tabular-nums text-white print:text-black">{numero(dados.totais.faltas)}</td>
                    <td className="px-5 py-2.5 text-right text-[0.86rem] font-semibold tabular-nums text-gold-200 print:text-black">
                      {dados.totais.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
