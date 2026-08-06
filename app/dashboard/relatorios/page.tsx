"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  Building2,
  CalendarClock,
  ChartColumn,
  GraduationCap,
  Minus,
  Radar,
  School,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserRound,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
} from "@/components/dashboard/PaginaModulo";
import type { PontoIGS } from "@/components/relatorios/GraficoIGS";
import type { PontoEvolucao } from "@/components/relatorios/GraficoEvolucao";
import { numero } from "@/lib/dashboard/formato";

/*
 * O Recharts entra por `dynamic(..., { ssr: false })` — mesma regra do
 * gráfico do Dashboard principal (ver components/dashboard/ChartCard.tsx).
 * Ele pesa mais do que o resto desta tela somado, e nada nele é necessário
 * para a primeira leitura: o IGE e os alertas já contam o essencial antes de
 * a barra terminar de baixar.
 */
const GraficoIGS = dynamic(
  () => import("@/components/relatorios/GraficoIGS").then((m) => m.GraficoIGS),
  { ssr: false, loading: () => <div className="h-44 animate-pulse rounded-xl bg-white/[0.03]" /> },
);
const GraficoEvolucao = dynamic(
  () => import("@/components/relatorios/GraficoEvolucao").then((m) => m.GraficoEvolucao),
  { ssr: false, loading: () => <div className="h-56 animate-pulse rounded-xl bg-white/[0.03]" /> },
);

/**
 * O Painel de Relatórios — a Central de Inteligência da EBD.
 *
 * ============================================================================
 * A PERGUNTA QUE ESTA TELA RESPONDE É "ONDE EU OLHO PRIMEIRO", NÃO "O QUE
 * ACONTECEU EM CADA CLASSE"
 *
 * Ela abre com UM número (o Índice Geral da EBD), depois as congregações
 * agrupadas por faixa de saúde — não uma tabela de 14 linhas para cada pessoa
 * somar de cabeça — e por último os alertas e a leitura em texto, que já
 * apontam O QUE fazer, não só O QUE aconteceu.
 *
 * Os relatórios detalhados (frequência dia a dia, ranking, faltas nominais,
 * ficha do aluno) continuam existindo como telas próprias, linkadas a partir
 * daqui. Esta tela nunca tenta ser a tabela — ela é o resumo que decide se
 * vale a pena abrir a tabela.
 * ============================================================================
 */

type Faixa = "excelente" | "muito-boa" | "atencao" | "critica";
interface Classificacao {
  faixa: Faixa;
  rotulo: string;
  emoji: string;
}
interface ResultadoIGS {
  nota: number;
  componentesUsados: string[];
}
interface CongregacaoBI {
  congId: number;
  nome: string;
  chamadas: number;
  taxaFrequencia: number | null;
  tendenciaPct: number | null;
  visitantesAnt: number;
  visitantesRec: number;
  igs: ResultadoIGS | null;
  classificacao: Classificacao | null;
  dadosSuficientes: boolean;
}
interface Alerta {
  nivel: "critico" | "atencao";
  tipo: string;
  titulo: string;
  descricao: string;
  destino?: string;
}
interface Painel {
  periodo: { de: string; ate: string };
  campo: {
    taxaFrequencia: number | null;
    tendenciaPct: number | null;
    visitantesAnt: number;
    visitantesRec: number;
    igs: ResultadoIGS | null;
    classificacao: Classificacao | null;
  };
  congregacoes: CongregacaoBI[];
  totais: {
    pessoas: number;
    alunos: number;
    classes: number;
    congregacoes: number;
    professores: number;
    dirigentes: number;
  };
  alertas: Alerta[];
  analise: string[];
  evolucaoMensal: PontoEvolucao[];
}

const CORES_FAIXA: Record<Faixa, string> = {
  excelente: "#34d399", // emerald-400
  "muito-boa": "#5578b4", // brand-400
  atencao: "#D4AF37", // gold-400
  critica: "#D62828", // flame-500
};

const ORDEM_FAIXAS: Array<{ faixa: Faixa; titulo: string }> = [
  { faixa: "excelente", titulo: "🟢 Excelente — 90 a 100" },
  { faixa: "muito-boa", titulo: "🟢 Muito Boa — 80 a 89" },
  { faixa: "atencao", titulo: "🟡 Atenção — 60 a 79" },
  { faixa: "critica", titulo: "🔴 Crítica — abaixo de 60" },
];

export default function PainelRelatoriosPage() {
  const [dados, setDados] = useState<Painel | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        const res = await fetch("/api/relatorios/painel", {
          signal: controle.signal,
          cache: "no-store",
        });
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        setDados(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status
            ? "O servidor respondeu com erro. Isso costuma ser banco de dados não configurado — abra /api/diagnostico para ver o motivo."
            : "Sem resposta do servidor. Verifique a conexão e tente de novo.",
        );
      }
    })();
    return () => controle.abort();
  }, []);

  const porFaixa = useMemo(() => {
    const mapa = new Map<Faixa, CongregacaoBI[]>();
    for (const f of ["excelente", "muito-boa", "atencao", "critica"] as Faixa[]) mapa.set(f, []);
    const semDado: CongregacaoBI[] = [];
    for (const c of dados?.congregacoes ?? []) {
      if (!c.dadosSuficientes || !c.classificacao) semDado.push(c);
      else mapa.get(c.classificacao.faixa)!.push(c);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => (b.igs?.nota ?? 0) - (a.igs?.nota ?? 0));
    return { mapa, semDado };
  }, [dados]);

  const graficoIGS = useMemo<PontoIGS[]>(
    () =>
      (dados?.congregacoes ?? [])
        .filter((c) => c.dadosSuficientes && c.igs)
        .map((c) => ({ nome: c.nome, nota: c.igs!.nota, faixa: c.classificacao!.faixa }))
        .sort((a, b) => b.nota - a.nota),
    [dados],
  );

  return (
    <>
      <CabecalhoModulo
        icone={Sparkles}
        titulo="Painel"
        descricao="Índice de Saúde por congregação, alertas e análise automática"
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/relatorios/comparativo"
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-[0.8rem] text-brand-200/70 transition-colors duration-300 hover:border-gold-400/30 hover:text-gold-200"
          >
            <Radar className="h-4 w-4" />
            Comparar congregações
          </Link>
          <Link
            href="/dashboard/relatorios/frequencia"
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-[0.8rem] text-brand-200/70 transition-colors duration-300 hover:border-gold-400/30 hover:text-gold-200"
          >
            <ChartColumn className="h-4 w-4" />
            Ver frequência detalhada
          </Link>
        </div>
      </CabecalhoModulo>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : !dados ? (
        <EsqueletoLista linhas={6} />
      ) : (
        <div className="space-y-5">
          <p className="-mt-2 text-[0.74rem] text-brand-200/45">
            Período analisado: {diaMes(dados.periodo.de)} a {diaMes(dados.periodo.ate)} · últimos 90 dias
          </p>

          {/* ---------------- IGE — o número que abre a tela ---------------- */}
          <CartaoIGE campo={dados.campo} />

          {/* ---------------- Evolução — a profundidade que o instantâneo não dá ---------------- */}
          {dados.evolucaoMensal.some((p) => p.taxa !== null) && (
            <section className="glass-panel rounded-2xl p-5">
              <h2 className="mb-1 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
                Evolução — últimos 12 meses
              </h2>
              <p className="mb-3 text-[0.72rem] text-brand-200/45">
                Frequência média do campo, mês a mês. Um recesso de julho aparece aqui como o padrão
                que se repete todo ano — não como uma queda isolada.
              </p>
              <GraficoEvolucao dados={dados.evolucaoMensal} />
            </section>
          )}

          {/* ---------------- Indicadores gerais ---------------- */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Indicador icone={Users} rotulo="Pessoas" valor={dados.totais.pessoas} />
            <Indicador icone={GraduationCap} rotulo="Alunos" valor={dados.totais.alunos} />
            <Indicador icone={UserRound} rotulo="Professores" valor={dados.totais.professores} />
            <Indicador icone={Award} rotulo="Dirigentes" valor={dados.totais.dirigentes} />
            <Indicador icone={School} rotulo="Classes" valor={dados.totais.classes} />
            <Indicador icone={Building2} rotulo="Congregações" valor={dados.totais.congregacoes} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <IndicadorComTendencia
              icone={ChartColumn}
              rotulo="Frequência geral"
              valor={dados.campo.taxaFrequencia}
              sufixo="%"
              tendenciaPct={dados.campo.tendenciaPct}
              referencia="vs. primeira metade do período"
            />
            <IndicadorComTendencia
              icone={UserRoundPlus}
              rotulo="Visitantes"
              valor={dados.campo.visitantesAnt + dados.campo.visitantesRec}
              tendenciaPct={variacaoDeContagem(dados.campo.visitantesAnt, dados.campo.visitantesRec)}
              referencia={`${dados.campo.visitantesRec} na 2ª metade, ${dados.campo.visitantesAnt} na 1ª`}
            />
            <IndicadorComTendencia
              icone={Sparkles}
              rotulo="Média geral da EBD"
              valor={dados.campo.igs?.nota ?? null}
              tendenciaPct={null}
              referencia={dados.campo.classificacao?.rotulo ?? "Sem dado suficiente"}
              semSeta
            />
          </div>

          {/* ---------------- Análise automática ---------------- */}
          {dados.analise.length > 0 && (
            <section className="glass-panel rounded-2xl p-5">
              <h2 className="mb-3 flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-gold-200/80">
                <Sparkles className="h-4 w-4" />
                Análise automática
              </h2>
              <ul className="space-y-2">
                {dados.analise.map((frase, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[0.86rem] leading-relaxed text-brand-100/85">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-300/70" />
                    {frase}
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-white/8 pt-2.5 text-[0.68rem] text-brand-200/40">
                Geradas por regra a partir dos números acima — não por um modelo de IA consultando o
                banco.
              </p>
            </section>
          )}

          {/* ---------------- Alertas automáticos ---------------- */}
          {dados.alertas.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
                Alertas ({dados.alertas.length})
              </h2>
              <div className="space-y-2">
                {dados.alertas.map((a, i) => (
                  <AlertaCartao key={i} alerta={a} />
                ))}
              </div>
            </section>
          )}

          {/* ---------------- Gráfico: IGS por congregação ---------------- */}
          {graficoIGS.length > 0 && (
            <section className="glass-panel rounded-2xl p-5">
              <h2 className="mb-4 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
                Índice de Saúde por congregação
              </h2>
              <GraficoIGS dados={graficoIGS} />
            </section>
          )}

          {/* ---------------- Painel de Saúde: congregações por faixa ---------------- */}
          <section>
            <h2 className="mb-3 px-1 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
              Saúde da EBD — por congregação
            </h2>
            <div className="space-y-4">
              {ORDEM_FAIXAS.map(({ faixa, titulo }) => {
                const lista = porFaixa.mapa.get(faixa) ?? [];
                if (lista.length === 0) return null;
                return (
                  <div key={faixa}>
                    <p className="mb-2 text-[0.72rem] font-medium text-brand-200/55">
                      {titulo} <span className="text-brand-200/35">· {lista.length}</span>
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {lista.map((c) => (
                        <CongregacaoCartao key={c.congId} c={c} />
                      ))}
                    </div>
                  </div>
                );
              })}

              {porFaixa.semDado.length > 0 && (
                <div>
                  <p className="mb-2 text-[0.72rem] font-medium text-brand-200/45">
                    Dados insuficientes no período{" "}
                    <span className="text-brand-200/35">· {porFaixa.semDado.length}</span>
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {porFaixa.semDado.map((c) => (
                      <Link
                        key={c.congId}
                        href={`/dashboard/congregacoes/${c.congId}`}
                        className="glass-panel block rounded-xl p-3.5 opacity-50 transition-opacity duration-300 hover:opacity-80"
                        title="Menos de 3 chamadas registradas no período — nota insuficiente para uma leitura confiável."
                      >
                        <p className="truncate text-[0.84rem] text-brand-50">{c.nome}</p>
                        <p className="mt-0.5 text-[0.7rem] text-brand-200/50">
                          {c.chamadas} {c.chamadas === 1 ? "chamada registrada" : "chamadas registradas"}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Peças
 * ------------------------------------------------------------------ */

function diaMes(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

/** Visitantes não têm "taxa" — a variação é sobre a contagem mesmo. */
function variacaoDeContagem(ant: number, rec: number): number | null {
  if (ant === 0) return null;
  return Math.round(((rec - ant) / ant) * 1000) / 10;
}

function CartaoIGE({ campo }: { campo: Painel["campo"] }) {
  if (!campo.igs || !campo.classificacao) {
    return (
      <Alert tipo="info" titulo="Índice Geral da EBD ainda sem dado suficiente">
        O campo precisa de pelo menos 3 chamadas registradas no período para uma nota confiável.
      </Alert>
    );
  }

  const cor = CORES_FAIXA[campo.classificacao.faixa];
  const TendIcone =
    campo.tendenciaPct === null || Math.abs(campo.tendenciaPct) < 3
      ? Minus
      : campo.tendenciaPct > 0
        ? TrendingUp
        : TrendingDown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel relative overflow-hidden rounded-2xl p-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: cor }}
      />
      <div className="relative flex flex-wrap items-center gap-6">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[3.2rem] font-semibold leading-none text-white tabular-nums">
            {campo.igs.nota}
          </span>
          <span className="text-[0.9rem] text-brand-200/50">/ 100</span>
        </div>

        <div className="min-w-0">
          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-brand-200/50">
            Índice Geral da EBD
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[1.05rem] font-medium text-white">
            {campo.classificacao.emoji} {campo.classificacao.rotulo}
          </p>
        </div>

        {campo.tendenciaPct !== null && (
          <div className="ml-auto flex items-center gap-1.5">
            <TendIcone
              className={cn(
                "h-4 w-4",
                Math.abs(campo.tendenciaPct) < 3
                  ? "text-brand-200/50"
                  : campo.tendenciaPct > 0
                    ? "text-emerald-300"
                    : "text-flame-400",
              )}
            />
            <span className="text-[0.82rem] tabular-nums text-brand-100/80">
              {campo.tendenciaPct > 0 ? "+" : ""}
              {campo.tendenciaPct}% na frequência
            </span>
          </div>
        )}
      </div>

      <p className="relative mt-4 max-w-2xl text-[0.76rem] leading-relaxed text-brand-200/50">
        Combina frequência média, regularidade das chamadas, tendência, visitantes recebidos e
        faltosos recorrentes — ponderados apenas pelo que há dado real para medir. Sem crescimento
        de matrícula nem desempenho de professor: o cadastro não guarda esse histórico.
      </p>
    </motion.div>
  );
}

function Indicador({
  icone: Icone,
  rotulo,
  valor,
}: {
  icone: typeof Users;
  rotulo: string;
  valor: number;
}) {
  return (
    <div className="glass-panel rounded-2xl p-3.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/8">
        <Icone className="h-4 w-4 text-gold-300" />
      </span>
      <p className="mt-2.5 font-display text-[1.4rem] font-semibold leading-none text-white tabular-nums">
        {numero(valor)}
      </p>
      <p className="mt-1 truncate text-[0.68rem] uppercase tracking-[0.1em] text-brand-200/50">
        {rotulo}
      </p>
    </div>
  );
}

function IndicadorComTendencia({
  icone: Icone,
  rotulo,
  valor,
  sufixo = "",
  tendenciaPct,
  referencia,
  semSeta = false,
}: {
  icone: typeof Users;
  rotulo: string;
  valor: number | null;
  sufixo?: string;
  tendenciaPct: number | null;
  referencia: string;
  semSeta?: boolean;
}) {
  const parado = tendenciaPct !== null && Math.abs(tendenciaPct) < 3;
  const sobe = tendenciaPct !== null && tendenciaPct > 0;
  const TendIcone = parado ? Minus : sobe ? TrendingUp : TrendingDown;
  const cor = parado ? "text-brand-200/55" : sobe ? "text-emerald-300" : "text-flame-400";

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/8">
          <Icone className="h-4 w-4 text-gold-300" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[1.3rem] font-semibold leading-none text-white tabular-nums">
            {valor === null ? "—" : `${numero(Math.round(valor * 10) / 10)}${sufixo}`}
          </p>
          <p className="mt-1 truncate text-[0.72rem] text-brand-200/60">{rotulo}</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/8 pt-2.5">
        {!semSeta && tendenciaPct !== null && (
          <>
            <TendIcone className={cn("h-3.5 w-3.5 shrink-0", cor)} />
            <span className={cn("text-[0.74rem] font-medium tabular-nums", cor)}>
              {sobe ? "+" : ""}
              {tendenciaPct}%
            </span>
          </>
        )}
        <span className="truncate text-[0.7rem] text-brand-200/45">{referencia}</span>
      </div>
    </div>
  );
}

/**
 * Cada cartão abre o prontuário completo da congregação (Fase 19) — cabeçalho,
 * resumo, gráficos, classes, professores, visitantes, ranking, histórico. O
 * cartão em si continua mostrando só o resumo de sempre: o clique é o convite
 * a aprofundar, não uma pista escondida.
 */
function CongregacaoCartao({ c }: { c: CongregacaoBI }) {
  const cor = c.classificacao ? CORES_FAIXA[c.classificacao.faixa] : "#8aa5d0";
  const TendIcone =
    c.tendenciaPct === null || Math.abs(c.tendenciaPct) < 3
      ? Minus
      : c.tendenciaPct > 0
        ? TrendingUp
        : TrendingDown;

  return (
    <Link
      href={`/dashboard/congregacoes/${c.congId}`}
      className="glass-panel block rounded-xl p-3.5 transition-colors duration-300 hover:border-gold-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[0.86rem] text-brand-50">{c.nome}</p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[0.74rem] font-semibold tabular-nums"
          style={{ background: `${cor}26`, color: cor }}
        >
          {c.igs?.nota}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[0.72rem] text-brand-200/55">
        <span>{c.taxaFrequencia !== null ? `${Math.round(c.taxaFrequencia)}% freq.` : "—"}</span>
        {c.tendenciaPct !== null && (
          <span
            className={cn(
              "flex items-center gap-1",
              Math.abs(c.tendenciaPct) < 3
                ? "text-brand-200/45"
                : c.tendenciaPct > 0
                  ? "text-emerald-300/85"
                  : "text-flame-400/85",
            )}
          >
            <TendIcone className="h-3 w-3" />
            {c.tendenciaPct > 0 ? "+" : ""}
            {c.tendenciaPct}%
          </span>
        )}
      </div>
    </Link>
  );
}

const ICONE_ALERTA: Record<string, typeof AlertTriangle> = {
  "congregacao-critica": AlertTriangle,
  "queda-frequencia": TrendingDown,
  "classe-sem-chamada": CalendarClock,
  "visitantes-caindo": UserRoundPlus,
  "abaixo-da-media": ChartColumn,
};

function AlertaCartao({ alerta }: { alerta: Alerta }) {
  const Icone = ICONE_ALERTA[alerta.tipo] ?? AlertTriangle;
  const critico = alerta.nivel === "critico";

  const conteudo = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors duration-300",
        critico
          ? "border-flame-500/30 bg-flame-500/[0.06] hover:bg-flame-500/[0.09]"
          : "border-gold-400/25 bg-gold-400/[0.05] hover:bg-gold-400/[0.08]",
      )}
    >
      <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", critico ? "text-flame-400" : "text-gold-300")} />
      <div className="min-w-0 flex-1">
        <p className="text-[0.84rem] text-brand-50">{alerta.titulo}</p>
        <p className="mt-0.5 text-[0.76rem] leading-relaxed text-brand-200/60">{alerta.descricao}</p>
      </div>
      <Badge variant={critico ? "erro" : "alerta"} className="shrink-0">
        {critico ? "crítico" : "atenção"}
      </Badge>
    </div>
  );

  return alerta.destino ? (
    <Link href={alerta.destino} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}
