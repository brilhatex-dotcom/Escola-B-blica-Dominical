"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Medal, Trophy, UserRoundPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { Button } from "@/components/ui/button";
import { FiltroPeriodo } from "@/components/dashboard/FiltroPeriodo";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { domingoMaisRecente } from "@/lib/dashboard/formato";

/**
 * Ranking por congregação e por classe.
 *
 * ORDENA POR TAXA, NÃO POR TOTAL. Ordenar pelo total faria o Templo Sede (92
 * alunos) ganhar todos os meses por ser o maior — isso não é ranking, é a lista
 * de tamanhos. Quem tem 7 alunos e frequência perfeita ficaria em último para
 * sempre, e a igreja aprenderia a ignorar o quadro.
 *
 * ============================================================================
 * "GERAL" (o período) E "SEMANAL" (um domingo só) SÃO PERGUNTAS DIFERENTES
 *
 * O modo Geral responde "quem vem sendo melhor" — por isso compara períodos
 * longos e exige um piso de domingos (ver `MINIMO_DE_CHAMADAS`). O modo
 * Semanal responde "quem se saiu melhor NESTE domingo" — o retrato de um dia
 * só, pensado para divulgar no grupo logo depois do culto. Por ser um só
 * domingo, não tem piso (a classificação já é sobre um dia), e ganha um
 * terceiro quadro que o Geral não tem: visitantes recebidos.
 * ============================================================================
 */

interface Linha {
  id: number | null;
  nome: string;
  congregacao: string | null;
  chamadas: number;
  presencas: number;
  domingos: number;
  alunos: number;
  taxa: number;
  classificado: boolean;
}
interface LinhaSemanal {
  id: number | null;
  nome: string;
  congregacao?: string | null;
  chamadas: number;
  presencas: number;
  taxa: number;
}
interface LinhaVisitantes {
  id: number | null;
  nome: string;
  visitantes: number;
}

const MEDALHAS = ["text-gold-300", "text-brand-100", "text-[#b87333]"];
const fmtDataLonga = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

function Tabela({ titulo, linhas, minimo, minhaId }: { titulo: string; linhas: Linha[]; minimo: number; minhaId?: number | null }) {
  const classificados = linhas.filter((l) => l.classificado);
  const fora = linhas.filter((l) => !l.classificado);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel overflow-hidden rounded-2xl"
    >
      <header className="border-b border-white/8 px-5 py-3.5">
        <h2 className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white">
          {titulo}
        </h2>
        <p className="mt-0.5 text-[0.74rem] text-brand-200/55">
          Percentual de presença sobre as chamadas feitas — corrige o tamanho
        </p>
      </header>

      {classificados.length === 0 ? (
        <EstadoVazio mensagem="Nenhum registro no período." />
      ) : (
        <ul className="divide-y divide-white/6">
          {classificados.map((l, i) => {
            const ehMinha = minhaId != null && l.id === minhaId;
            return (
              <li
                key={`${l.id}-${l.nome}`}
                className={cn("flex items-center gap-3 px-5 py-2.5", ehMinha && "bg-gold-400/[0.06]")}
              >
                <span
                  className={cn(
                    "w-7 shrink-0 text-center font-display text-[0.9rem] font-semibold tabular-nums",
                    i < 3 ? MEDALHAS[i] : "text-brand-200/40",
                  )}
                >
                  {i < 3 ? <Medal className={cn("mx-auto h-4 w-4", MEDALHAS[i])} /> : i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.86rem] text-brand-50">
                    {l.nome}
                    {ehMinha && (
                      <span className="ml-1.5 rounded-full bg-gold-400/15 px-1.5 py-0.5 text-[0.62rem] font-medium uppercase tracking-wide text-gold-200">
                        sua congregação
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[0.72rem] text-brand-200/50">
                    {l.congregacao ? `${l.congregacao} · ` : ""}
                    {l.domingos} {l.domingos === 1 ? "domingo" : "domingos"} · {l.alunos} alunos
                  </p>
                </div>

                <div className="hidden w-40 shrink-0 sm:block">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-brand-400 to-gold-400"
                      style={{ width: `${Math.min(100, l.taxa)}%` }}
                    />
                  </div>
                </div>

                <span className="w-20 shrink-0 text-right text-[0.86rem] font-semibold tabular-nums text-gold-200">
                  {l.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        Quem não entrou aparece assim mesmo, com o motivo. Sumir da lista faria
        alguém procurar a própria classe e concluir que o sistema perdeu os
        dados dela.
      */}
      {fora.length > 0 && (
        <div className="border-t border-white/8 px-5 py-3">
          <p className="text-[0.72rem] text-brand-200/50">
            <span className="text-brand-100/70">
              {fora.length} fora da classificação
            </span>{" "}
            — menos de {minimo} domingos com chamada no período. Com poucas chamadas,
            um único domingo bom vira 100% e passa na frente de quem compareceu o
            trimestre inteiro.
          </p>
          <p className="mt-1 text-[0.72rem] text-brand-200/40">
            {fora.map((f, i) => (
              <span key={`${f.id}-${f.nome}`} className={f.id === minhaId ? "font-medium text-gold-200" : undefined}>
                {i > 0 && " · "}
                {f.nome}
              </span>
            ))}
          </p>
        </div>
      )}
    </motion.section>
  );
}

/** Pódio do modo Semanal — sem piso, sem "fora da classificação": é um domingo só. */
function PodioSemanal({ titulo, subtitulo, linhas }: { titulo: string; subtitulo: string; linhas: LinhaSemanal[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel overflow-hidden rounded-2xl"
    >
      <header className="border-b border-white/8 px-5 py-3.5">
        <h2 className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white">{titulo}</h2>
        <p className="mt-0.5 text-[0.74rem] text-brand-200/55">{subtitulo}</p>
      </header>

      {linhas.length === 0 ? (
        <EstadoVazio mensagem="Nenhuma chamada registrada neste domingo." />
      ) : (
        <ul className="divide-y divide-white/6">
          {linhas.map((l, i) => (
            <li key={`${l.id}-${l.nome}`} className="flex items-center gap-3 px-5 py-2.5">
              <span className={cn("w-7 shrink-0 text-center font-display text-[0.9rem] font-semibold tabular-nums", i < 3 ? MEDALHAS[i] : "text-brand-200/40")}>
                {i < 3 ? <Medal className={cn("mx-auto h-4 w-4", MEDALHAS[i])} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.86rem] text-brand-50">{l.nome}</p>
                {l.congregacao && <p className="truncate text-[0.72rem] text-brand-200/50">{l.congregacao} · {l.presencas} de {l.chamadas}</p>}
                {!l.congregacao && <p className="truncate text-[0.72rem] text-brand-200/50">{l.presencas} de {l.chamadas} chamados</p>}
              </div>
              <div className="hidden w-40 shrink-0 sm:block">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                  <span className="block h-full rounded-full bg-gradient-to-r from-brand-400 to-gold-400" style={{ width: `${Math.min(100, l.taxa)}%` }} />
                </div>
              </div>
              <span className="w-20 shrink-0 text-right text-[0.86rem] font-semibold tabular-nums text-gold-200">
                {l.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

function PodioVisitantes({ linhas }: { linhas: LinhaVisitantes[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel overflow-hidden rounded-2xl"
    >
      <header className="border-b border-white/8 px-5 py-3.5">
        <h2 className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white">Visitantes</h2>
        <p className="mt-0.5 text-[0.74rem] text-brand-200/55">Quem recebeu mais visitantes neste domingo</p>
      </header>

      {linhas.length === 0 || linhas.every((l) => l.visitantes === 0) ? (
        <EstadoVazio mensagem="Nenhum visitante recebido neste domingo." />
      ) : (
        <ul className="divide-y divide-white/6">
          {linhas.filter((l) => l.visitantes > 0).map((l, i) => (
            <li key={`${l.id}-${l.nome}`} className="flex items-center gap-3 px-5 py-2.5">
              <span className={cn("w-7 shrink-0 text-center font-display text-[0.9rem] font-semibold tabular-nums", i < 3 ? MEDALHAS[i] : "text-brand-200/40")}>
                {i < 3 ? <Medal className={cn("mx-auto h-4 w-4", MEDALHAS[i])} /> : i + 1}
              </span>
              <p className="min-w-0 flex-1 truncate text-[0.86rem] text-brand-50">{l.nome}</p>
              <span className="flex shrink-0 items-center gap-1 text-[0.86rem] font-semibold tabular-nums text-gold-200">
                <UserRoundPlus className="h-3.5 w-3.5" />
                {l.visitantes}
              </span>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

type Modo = "geral" | "semanal";

export default function RankingPage() {
  const { sessao } = useAcesso();
  const [modo, setModo] = useState<Modo>("geral");

  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [dados, setDados] = useState<{
    congregacoes: Linha[];
    classes: Linha[];
    minimoDeDomingos: number;
    periodo: { de: string; ate: string };
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [dataSemanal, setDataSemanal] = useState(domingoMaisRecente());
  const [dadosSemanal, setDadosSemanal] = useState<{
    data: string;
    congregacoes: LinhaSemanal[];
    classes: LinhaSemanal[];
    visitantes: LinhaVisitantes[];
  } | null>(null);
  const [erroSemanal, setErroSemanal] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (modo !== "geral") return;
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        const url = new URL("/api/relatorios/ranking", window.location.origin);
        if (de) url.searchParams.set("de", de);
        if (ate) url.searchParams.set("ate", ate);
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        const r = await res.json();
        setDados(r);
        if (!de) setDe(r.periodo.de);
        if (!ate) setAte(r.periodo.ate);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(status === 403 ? "O seu acesso não permite ver esta tela." : "Não foi possível carregar o ranking.");
      }
    })();
    return () => controle.abort();
  }, [modo, de, ate]);

  useEffect(() => {
    if (modo !== "semanal" || !dataSemanal) return;
    const controle = new AbortController();
    (async () => {
      try {
        setErroSemanal(null);
        const url = new URL("/api/relatorios/ranking-semanal", window.location.origin);
        url.searchParams.set("data", dataSemanal);
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDadosSemanal(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErroSemanal(status === 403 ? "O seu acesso não permite ver esta tela." : "Não foi possível carregar o ranking semanal.");
      }
    })();
    return () => controle.abort();
  }, [modo, dataSemanal]);

  async function copiarParaWhatsApp() {
    if (!dadosSemanal) return;
    const linhas: string[] = [];
    linhas.push(`🏆 *RANKING DA EBD* — ${fmtDataLonga.format(new Date(`${dadosSemanal.data}T12:00:00`))}`);
    linhas.push("");
    linhas.push("*Congregações*");
    dadosSemanal.congregacoes.slice(0, 5).forEach((l, i) => {
      linhas.push(`${i + 1}º ${l.nome} — ${l.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}% (${l.presencas}/${l.chamadas})`);
    });
    linhas.push("");
    linhas.push("*Classes*");
    dadosSemanal.classes.slice(0, 5).forEach((l, i) => {
      linhas.push(`${i + 1}º ${l.nome}${l.congregacao ? ` (${l.congregacao})` : ""} — ${l.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%`);
    });
    const comVisitantes = dadosSemanal.visitantes.filter((v) => v.visitantes > 0);
    if (comVisitantes.length > 0) {
      linhas.push("");
      linhas.push("👋 *Visitantes*");
      comVisitantes.slice(0, 5).forEach((l, i) => {
        linhas.push(`${i + 1}º ${l.nome} — ${l.visitantes} visitante${l.visitantes === 1 ? "" : "s"}`);
      });
    }
    try {
      await navigator.clipboard.writeText(linhas.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de clipboard — o botão simplesmente não confirma; a
      // tela já mostra tudo, dá para copiar à mão.
    }
  }

  return (
    <>
      <CabecalhoModulo
        icone={Trophy}
        titulo="Ranking"
        descricao={modo === "geral" ? "Por congregação e por classe, no período" : "De um domingo só — pronto para divulgar no grupo"}
      >
        <div className="flex h-10 items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
          {([["geral", "Geral"], ["semanal", "Semanal"]] as const).map(([v, rotulo]) => (
            <button
              key={v}
              type="button"
              onClick={() => setModo(v)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[0.78rem] transition-colors",
                modo === v ? "bg-gold-400/20 text-gold-100" : "text-brand-200/60 hover:text-brand-100",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
        {modo === "geral" ? (
          <FiltroPeriodo de={de} ate={ate} aoMudar={(c, v) => (c === "de" ? setDe(v) : setAte(v))} />
        ) : (
          <>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
              <span className="shrink-0 text-brand-200/55">Domingo</span>
              <input
                type="date"
                value={dataSemanal}
                onChange={(e) => setDataSemanal(e.target.value)}
                className="bg-transparent text-brand-50 focus:outline-none [color-scheme:dark]"
              />
            </label>
            {dadosSemanal && (
              <Button size="sm" onClick={() => void copiarParaWhatsApp()}>
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiado ? "Copiado!" : "Copiar para WhatsApp"}
              </Button>
            )}
          </>
        )}
      </CabecalhoModulo>

      {modo === "geral" ? (
        erro ? (
          <EstadoErro mensagem={erro} />
        ) : !dados ? (
          <EsqueletoLista linhas={8} />
        ) : (
          <div className="space-y-4">
            <Tabela titulo="Congregações" linhas={dados.congregacoes} minimo={dados.minimoDeDomingos} minhaId={sessao?.congId} />
            <Tabela titulo="Classes" linhas={dados.classes} minimo={dados.minimoDeDomingos} />
          </div>
        )
      ) : erroSemanal ? (
        <EstadoErro mensagem={erroSemanal} />
      ) : !dadosSemanal ? (
        <EsqueletoLista linhas={8} />
      ) : (
        <div className="space-y-4">
          <PodioSemanal titulo="Congregações" subtitulo="Percentual de presença sobre as chamadas feitas neste domingo" linhas={dadosSemanal.congregacoes} />
          <PodioSemanal titulo="Classes" subtitulo="Todas as classes do campo, neste domingo" linhas={dadosSemanal.classes} />
          <PodioVisitantes linhas={dadosSemanal.visitantes} />
        </div>
      )}
    </>
  );
}
