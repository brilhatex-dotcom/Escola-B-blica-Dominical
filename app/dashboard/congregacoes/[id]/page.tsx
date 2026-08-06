"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  Building2,
  CalendarClock,
  Download,
  FileSpreadsheet,
  GraduationCap,
  History,
  Map as MapIcon,
  Minus,
  Phone,
  Printer,
  School,
  Share2,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserRound,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import { diaEMes, dataPorExtenso, hora, numero } from "@/lib/dashboard/formato";
import type { IndicadorCor } from "@/lib/relatorios/congregacao";

/*
 * Os gráficos entram sob demanda — mesma regra do Painel e do Dashboard:
 * Recharts pesa mais do que o resto da tela somado, e o cabeçalho e os
 * números do resumo já contam o essencial antes de qualquer gráfico baixar.
 */
const GraficoFrequenciaSemanal = dynamic(
  () => import("@/components/relatorios/GraficoFrequenciaSemanal").then((m) => m.GraficoFrequenciaSemanal),
  { ssr: false, loading: () => <div className="h-56 animate-pulse rounded-xl bg-white/[0.03]" /> },
);
const GraficoBarrasSemanal = dynamic(
  () => import("@/components/relatorios/GraficoBarrasSemanal").then((m) => m.GraficoBarrasSemanal),
  { ssr: false, loading: () => <div className="h-56 animate-pulse rounded-xl bg-white/[0.03]" /> },
);
const GraficoEvolucao = dynamic(
  () => import("@/components/relatorios/GraficoEvolucao").then((m) => m.GraficoEvolucao),
  { ssr: false, loading: () => <div className="h-56 animate-pulse rounded-xl bg-white/[0.03]" /> },
);
const GraficoEvolucaoAnual = dynamic(
  () => import("@/components/relatorios/GraficoEvolucaoAnual").then((m) => m.GraficoEvolucaoAnual),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-xl bg-white/[0.03]" /> },
);

/**
 * O prontuário de uma congregação — a Central Completa de Informações,
 * aberta a partir de um clique num cartão do Painel (Fase 19).
 *
 * ============================================================================
 * O QUE ESTA TELA DELIBERADAMENTE NÃO MOSTRA, E POR QUÊ
 *
 * "Visitantes convertidos em alunos": não existe um vínculo no banco entre um
 * Visitante e o Aluno em que ele eventualmente virou — inventar um por
 * coincidência de nome erraria tanto quanto acertaria.
 *
 * "Metas da congregação" (barra de progresso): precisa de um número que
 * ALGUÉM define e o sistema hoje não guarda — fica para uma fase própria,
 * com uma tela de cadastro de meta.
 *
 * "Foto", "Cidade/Bairro": o cadastro de congregação não tem esses campos
 * ainda (só nome). Mostrá-los sempre em branco, sem um jeito de preenchê-los,
 * seria pior que não mostrar.
 *
 * "Exportar PDF": o botão Imprimir já ABRE o diálogo de impressão do
 * navegador, que salva em PDF — a mesma tela dos outros três relatórios com
 * botão de imprimir do portal. Um segundo botão gerando um PDF por conta
 * própria duplicaria a mesma saída por dois caminhos diferentes.
 *
 * "Exportar Excel": sai como CSV, que o Excel abre direto — dizer "Excel"
 * sem gerar de fato um .xlsx seria uma etiqueta emprestada. O rótulo do botão
 * diz "Exportar CSV" pelo mesmo motivo que "Visita Ministerial" fica em
 * branco no Relatório Semanal: um espaço vazio, ou um rótulo exato, nunca
 * mentem.
 * ============================================================================
 */

interface Pessoa {
  nome: string;
  tratamento: string | null;
  telefone?: string | null;
}
interface ClasseAnalise {
  classeId: number;
  nome: string;
  professores: string[];
  matriculados: number;
  presentes: number;
  ausentes: number;
  visitantes: number;
  percentual: number | null;
  indicador: IndicadorCor;
  tendenciaPct: number | null;
  diasSemChamada: number | null;
}
interface ProfessorAnalise {
  pessoaId: number;
  nome: string;
  classe: string;
  classeId: number;
  frequenciaMediaClasse: number | null;
  chamadasRealizadas: number;
  visitantesRecebidos: number;
  tempoNaFuncao: string | null;
  crescimentoClasse: number | null;
}
interface Alerta {
  nivel: "critico" | "atencao";
  tipo: string;
  titulo: string;
  descricao: string;
  destino?: string;
}
interface EventoHistorico {
  quando: string;
  quem: string;
  acao: string;
  entidade: string;
  descricao: string;
}
interface Dados {
  periodo: { de: string; ate: string };
  cabecalho: {
    congId: number;
    nome: string;
    dirigente: Pessoa | null;
    vice: Pessoa | null;
    secretario: Pessoa | null;
    classes: number;
    professores: number;
    alunos: number;
    igsNota: number | null;
    classificacaoRotulo: string | null;
    classificacaoFaixa: string | null;
  };
  resumo: {
    matriculados: number;
    professores: number;
    classes: number;
    visitantes: number;
    taxaFrequencia: number | null;
    igsNota: number | null;
    tendenciaPct: number | null;
  };
  semanas: Array<{ data: string; presentes: number; ausentes: number; visitantes: number; taxa: number | null }>;
  indicadoresAutomaticos: {
    maiorFrequencia: { data: string; taxa: number } | null;
    menorFrequencia: { data: string; taxa: number } | null;
    melhorDomingo: { data: string; presentes: number } | null;
    piorDomingo: { data: string; presentes: number } | null;
    maiorVisitantes: { data: string; visitantes: number } | null;
  };
  evolucaoMensal: Array<{ mes: string; taxa: number | null; chamadas: number }>;
  maiorCrescimentoMes: { mes: string; mesAnterior: string; deltaPct: number } | null;
  maiorReducaoMes: { mes: string; mesAnterior: string; deltaPct: number } | null;
  evolucaoAnual: Array<{ ano: number; taxa: number | null; chamadas: number }>;
  classes: ClasseAnalise[];
  professores: ProfessorAnalise[];
  visitantes: {
    total: number;
    variacaoPct: number | null;
    recorrentes: number;
    unicos: number;
    porMes: Array<{ mes: string; total: number }>;
  };
  analise: string[];
  alertas: Alerta[];
  historico: EventoHistorico[];
  comparativoCampo: { taxaFrequencia: { congregacao: number | null; campo: number | null } };
  ranking: {
    frequencia: { posicao: number; total: number } | null;
    visitantes: { posicao: number; total: number } | null;
    crescimento: { posicao: number; total: number } | null;
    chamadas: { posicao: number; total: number } | null;
    alunos: { posicao: number; total: number } | null;
    igs: { posicao: number; total: number } | null;
  } | null;
  melhorCongregacao: { nome: string; nota: number } | null;
  piorCongregacao: { nome: string; nota: number } | null;
  vejoOCampoTodo: boolean;
}

const CORES_FAIXA: Record<string, string> = {
  excelente: "#34d399",
  "muito-boa": "#5578b4",
  atencao: "#D4AF37",
  critica: "#D62828",
};
const CORES_INDICADOR: Record<IndicadorCor, string> = {
  verde: "#34d399",
  amarelo: "#D4AF37",
  vermelho: "#D62828",
  "sem-dado": "#8aa5d0",
};

export default function CongregacaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        setDados(null);
        const res = await fetch(`/api/relatorios/congregacao/${id}`, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) {
          const corpo = await res.json().catch(() => null);
          throw Object.assign(new Error(corpo?.erro ?? `HTTP ${res.status}`), { status: res.status });
        }
        setDados(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setErro((e as Error).message || "Não foi possível carregar esta congregação.");
      }
    })();
    return () => controle.abort();
  }, [id]);

  const semanasGrafico = useMemo(
    () => (dados?.semanas ?? []).map((s) => ({ data: s.data, presentes: s.presentes, ausentes: s.ausentes, visitantes: s.visitantes })),
    [dados],
  );

  const exportarCsv = () => {
    if (!dados) return;
    const linhas = [
      ["Classe", "Professores", "Matriculados", "Presentes", "Ausentes", "Visitantes", "Percentual"],
      ...dados.classes.map((c) => [
        c.nome,
        c.professores.join(" | ") || "—",
        String(c.matriculados),
        String(c.presentes),
        String(c.ausentes),
        String(c.visitantes),
        c.percentual !== null ? `${c.percentual}%` : "—",
      ]),
    ];
    const csv = linhas.map((l) => l.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dados.cabecalho.nome.replace(/[^\w-]+/g, "-")}-classes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const compartilhar = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: dados?.cabecalho.nome ?? "Congregação", url });
        return;
      } catch {
        /* usuário cancelou — cai para a cópia */
      }
    }
    await navigator.clipboard.writeText(url);
    window.alert("Link copiado para a área de transferência.");
  };

  return (
    <>
      <div className="print:hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/relatorios"
            className="flex items-center gap-1.5 text-[0.8rem] text-brand-200/60 transition-colors hover:text-gold-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Painel
          </Link>
          {dados && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={compartilhar}>
                <Share2 className="h-4 w-4" />
                Compartilhar
              </Button>
              <Button size="sm" variant="ghost" onClick={exportarCsv}>
                <FileSpreadsheet className="h-4 w-4" />
                Exportar CSV
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Imprimir / PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      {erro ? (
        <div className="print:hidden">
          <EstadoErro mensagem={erro} />
        </div>
      ) : !dados ? (
        <div className="print:hidden">
          <EsqueletoLista linhas={8} />
        </div>
      ) : (
        <Prontuario dados={dados} semanasGrafico={semanasGrafico} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * O prontuário
 * ------------------------------------------------------------------ */

function Prontuario({
  dados,
  semanasGrafico,
}: {
  dados: Dados;
  semanasGrafico: Array<{ data: string; presentes: number; ausentes: number; visitantes: number }>;
}) {
  const cor = dados.cabecalho.classificacaoFaixa ? CORES_FAIXA[dados.cabecalho.classificacaoFaixa] : "#8aa5d0";

  return (
    <div className="space-y-5">
      {/* ---------------- Institucional (só na impressão) ---------------- */}
      <header className="hidden text-center print:mb-4 print:block">
        <p className="text-[0.7rem] uppercase tracking-[0.2em]">Assembleia de Deus — IEADPE, Campo de Betânia (PE)</p>
        <p className="text-[0.68rem] text-brand-200/50">
          Impresso em {dataPorExtenso(new Date())} às {hora(new Date())}
        </p>
      </header>

      {/* ---------------- Cabeçalho ---------------- */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel relative overflow-hidden rounded-2xl p-5 sm:p-6 print:border print:border-black print:bg-white"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-20 blur-3xl print:hidden"
          style={{ background: cor }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-gold-400/20 print:hidden">
              <Building2 className="h-5.5 w-5.5 text-gold-300" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[1.3rem] font-semibold uppercase leading-tight tracking-[0.1em] text-white print:text-black sm:text-[1.5rem]">
                {dados.cabecalho.nome}
              </h1>
              <p className="mt-1 text-[0.78rem] text-brand-200/55 print:text-black">
                Período analisado: {diaMes(dados.periodo.de)} a {diaMes(dados.periodo.ate)}
              </p>
            </div>
          </div>

          {dados.cabecalho.igsNota !== null && (
            <div className="flex items-baseline gap-2 print:text-black">
              <span className="font-display text-[2.2rem] font-semibold leading-none text-white print:text-black tabular-nums">
                {dados.cabecalho.igsNota}
              </span>
              <div>
                <p className="text-[0.66rem] uppercase tracking-[0.14em] text-brand-200/50 print:text-black">IGS</p>
                <p className="text-[0.82rem] font-medium text-white print:text-black">{dados.cabecalho.classificacaoRotulo}</p>
              </div>
            </div>
          )}
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoLinha rotulo="Dirigente" pessoa={dados.cabecalho.dirigente} />
          <InfoLinha rotulo="Vice-Dirigente" pessoa={dados.cabecalho.vice} />
          <InfoLinha rotulo="Secretário Local" pessoa={dados.cabecalho.secretario} />
          <div>
            <p className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.12em] text-brand-200/50 print:text-black">
              <Phone className="h-3 w-3" /> Telefone
            </p>
            <p className="mt-0.5 text-[0.86rem] text-brand-50 print:text-black">
              {dados.cabecalho.dirigente?.telefone || "—"}
            </p>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap gap-4 border-t border-white/8 pt-4 text-[0.78rem] text-brand-200/60 print:border-black print:text-black">
          <span>{dados.cabecalho.classes} classes</span>
          <span>{dados.cabecalho.professores} professores</span>
          <span>{dados.cabecalho.alunos} alunos matriculados</span>
        </div>
      </motion.section>

      {/* ---------------- Resumo geral ---------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CartaoResumo icone={GraduationCap} rotulo="Matriculados" valor={numero(dados.resumo.matriculados)} />
        <CartaoResumo icone={UserRound} rotulo="Professores" valor={numero(dados.resumo.professores)} />
        <CartaoResumo icone={School} rotulo="Classes" valor={numero(dados.resumo.classes)} />
        <CartaoResumo icone={UserRoundPlus} rotulo="Visitantes" valor={numero(dados.resumo.visitantes)} />
        <CartaoResumo
          icone={Activity}
          rotulo="Frequência média"
          valor={dados.resumo.taxaFrequencia !== null ? `${arred(dados.resumo.taxaFrequencia)}%` : "—"}
        />
        <CartaoResumo
          icone={Sparkles}
          rotulo="Crescimento"
          valor={dados.resumo.tendenciaPct !== null ? `${dados.resumo.tendenciaPct > 0 ? "+" : ""}${arred(dados.resumo.tendenciaPct)}%` : "—"}
          cor={
            dados.resumo.tendenciaPct === null
              ? undefined
              : Math.abs(dados.resumo.tendenciaPct) < 3
                ? undefined
                : dados.resumo.tendenciaPct > 0
                  ? "#34d399"
                  : "#D62828"
          }
        />
      </div>

      {/* ---------------- Comparativo com o campo ---------------- */}
      <section className="glass-panel rounded-2xl p-5 print:border print:border-black print:bg-white">
        <h2 className="mb-3 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50 print:text-black">
          Comparativos
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <ComparativoCartao
            rotulo="Frequência desta congregação"
            valor={dados.comparativoCampo.taxaFrequencia.congregacao}
          />
          <ComparativoCartao rotulo="Média do campo" valor={dados.comparativoCampo.taxaFrequencia.campo} />
          {dados.vejoOCampoTodo ? (
            <>
              {dados.melhorCongregacao && (
                <ComparativoCartao
                  rotulo={`Melhor do campo (${dados.melhorCongregacao.nome})`}
                  valor={dados.melhorCongregacao.nota}
                  sufixo=""
                />
              )}
            </>
          ) : (
            <div className="flex items-center rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[0.72rem] text-brand-200/45">
              Comparação com outras congregações disponível para quem enxerga o campo inteiro.
            </div>
          )}
        </div>
      </section>

      {/* ---------------- Ranking ---------------- */}
      {dados.vejoOCampoTodo && dados.ranking && (
        <section className="glass-panel rounded-2xl p-5 print:border print:border-black print:bg-white">
          <h2 className="mb-3 flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50 print:text-black">
            <Trophy className="h-4 w-4 text-gold-300" />
            Ranking entre as congregações do campo
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <PosicaoRanking rotulo="Frequência" pos={dados.ranking.frequencia} />
            <PosicaoRanking rotulo="Visitantes" pos={dados.ranking.visitantes} />
            <PosicaoRanking rotulo="Crescimento" pos={dados.ranking.crescimento} />
            <PosicaoRanking rotulo="Chamadas" pos={dados.ranking.chamadas} />
            <PosicaoRanking rotulo="Alunos" pos={dados.ranking.alunos} />
            <PosicaoRanking rotulo="IGS" pos={dados.ranking.igs} />
          </div>
        </section>
      )}

      {/* ---------------- Frequência semanal ---------------- */}
      {semanasGrafico.length > 0 && (
        <>
          <section className="glass-panel rounded-2xl p-5 print:border print:border-black print:bg-white">
            <h2 className="mb-1 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50 print:text-black">
              Frequência — domingo a domingo
            </h2>
            <p className="mb-3 text-[0.72rem] text-brand-200/45 print:text-black">
              Presentes, ausentes e visitantes de cada domingo com chamada registrada no período.
            </p>
            <GraficoFrequenciaSemanal dados={semanasGrafico} />
          </section>

          <section className="glass-panel rounded-2xl p-5 print:hidden">
            <h2 className="mb-3 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
              O mesmo, em barras
            </h2>
            <GraficoBarrasSemanal dados={semanasGrafico} />
          </section>
        </>
      )}

      {/* ---------------- Evolução mensal e anual ---------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {dados.evolucaoMensal.some((p) => p.taxa !== null) && (
          <section className="glass-panel rounded-2xl p-5 print:hidden">
            <h2 className="mb-1 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
              Evolução mensal — últimos 12 meses
            </h2>
            {(dados.maiorCrescimentoMes || dados.maiorReducaoMes) && (
              <p className="mb-3 text-[0.72rem] text-brand-200/45">
                {dados.maiorCrescimentoMes &&
                  `Maior crescimento: ${mesRotulo(dados.maiorCrescimentoMes.mes)} (+${dados.maiorCrescimentoMes.deltaPct}%). `}
                {dados.maiorReducaoMes &&
                  `Maior redução: ${mesRotulo(dados.maiorReducaoMes.mes)} (${dados.maiorReducaoMes.deltaPct}%).`}
              </p>
            )}
            <GraficoEvolucao dados={dados.evolucaoMensal} />
          </section>
        )}

        {dados.evolucaoAnual.some((p) => p.taxa !== null) && (
          <section className="glass-panel rounded-2xl p-5 print:hidden">
            <h2 className="mb-1 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
              Evolução anual
            </h2>
            <p className="mb-3 text-[0.72rem] text-brand-200/45">Frequência média, ano a ano, desde o primeiro registro.</p>
            <GraficoEvolucaoAnual dados={dados.evolucaoAnual} />
          </section>
        )}
      </div>

      {/* ---------------- Indicadores automáticos ---------------- */}
      <section className="glass-panel rounded-2xl p-5 print:border print:border-black print:bg-white">
        <h2 className="mb-3 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50 print:text-black">
          Indicadores automáticos
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <IndicadorAuto
            rotulo="Maior frequência"
            valor={dados.indicadoresAutomaticos.maiorFrequencia ? `${dados.indicadoresAutomaticos.maiorFrequencia.taxa}%` : "—"}
            data={dados.indicadoresAutomaticos.maiorFrequencia?.data}
          />
          <IndicadorAuto
            rotulo="Menor frequência"
            valor={dados.indicadoresAutomaticos.menorFrequencia ? `${dados.indicadoresAutomaticos.menorFrequencia.taxa}%` : "—"}
            data={dados.indicadoresAutomaticos.menorFrequencia?.data}
          />
          <IndicadorAuto
            rotulo="Melhor domingo"
            valor={dados.indicadoresAutomaticos.melhorDomingo ? `${dados.indicadoresAutomaticos.melhorDomingo.presentes} pessoas` : "—"}
            data={dados.indicadoresAutomaticos.melhorDomingo?.data}
          />
          <IndicadorAuto
            rotulo="Pior domingo"
            valor={dados.indicadoresAutomaticos.piorDomingo ? `${dados.indicadoresAutomaticos.piorDomingo.presentes} pessoas` : "—"}
            data={dados.indicadoresAutomaticos.piorDomingo?.data}
          />
          <IndicadorAuto
            rotulo="Mais visitantes"
            valor={dados.indicadoresAutomaticos.maiorVisitantes ? `${dados.indicadoresAutomaticos.maiorVisitantes.visitantes}` : "—"}
            data={dados.indicadoresAutomaticos.maiorVisitantes?.data}
          />
        </div>
      </section>

      {/* ---------------- Análise automática ---------------- */}
      {dados.analise.length > 0 && (
        <section className="glass-panel rounded-2xl p-5 print:border print:border-black print:bg-white">
          <h2 className="mb-3 flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-gold-200/80 print:text-black">
            <Sparkles className="h-4 w-4" />
            Análise automática
          </h2>
          <ul className="space-y-2">
            {dados.analise.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[0.86rem] leading-relaxed text-brand-100/85 print:text-black">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-300/70 print:hidden" />
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-white/8 pt-2.5 text-[0.68rem] text-brand-200/40 print:hidden">
            Geradas por regra a partir dos números acima — não por um modelo de IA consultando o banco.
          </p>
        </section>
      )}

      {/* ---------------- Alertas ---------------- */}
      {dados.alertas.length > 0 && (
        <section className="print:hidden">
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

      {/* ---------------- Análise das classes ---------------- */}
      <section className="glass-panel overflow-hidden rounded-2xl p-5 print:border print:border-black print:bg-white">
        <h2 className="mb-3 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50 print:text-black">
          Análise das classes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.8rem]">
            <thead>
              <tr className="border-b border-white/10 text-[0.68rem] uppercase tracking-[0.08em] text-brand-200/50 print:border-black print:text-black">
                <th className="py-2 pr-3">Classe</th>
                <th className="py-2 pr-3">Professor(es)</th>
                <th className="py-2 pr-3 text-right">Matric.</th>
                <th className="py-2 pr-3 text-right">Presentes</th>
                <th className="py-2 pr-3 text-right">Ausentes</th>
                <th className="py-2 pr-3 text-right">Visitantes</th>
                <th className="py-2 pr-3 text-right">%</th>
                <th className="py-2 pl-1"></th>
              </tr>
            </thead>
            <tbody>
              {dados.classes.map((c) => (
                <tr
                  key={c.classeId}
                  className="border-b border-white/5 text-brand-100/85 last:border-0 print:border-black print:text-black"
                >
                  <td className="py-2 pr-3">
                    <Link
                      href={`/dashboard/classes/${c.classeId}`}
                      className="text-brand-50 hover:text-gold-200 print:text-black"
                    >
                      {c.nome}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-brand-200/70 print:text-black">
                    {c.professores.length > 0 ? c.professores.join(", ") : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.matriculados}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.presentes}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.ausentes}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.visitantes}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.percentual !== null ? `${c.percentual}%` : "—"}</td>
                  <td className="py-2 pl-1">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full print:hidden"
                      style={{ background: CORES_INDICADOR[c.indicador] }}
                      title={c.indicador}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------- Análise dos professores ---------------- */}
      {dados.professores.length > 0 && (
        <section className="glass-panel overflow-hidden rounded-2xl p-5 print:border print:border-black print:bg-white">
          <h2 className="mb-3 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50 print:text-black">
            Análise dos professores
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.8rem]">
              <thead>
                <tr className="border-b border-white/10 text-[0.68rem] uppercase tracking-[0.08em] text-brand-200/50 print:border-black print:text-black">
                  <th className="py-2 pr-3">Professor</th>
                  <th className="py-2 pr-3">Classe</th>
                  <th className="py-2 pr-3 text-right">Freq. média</th>
                  <th className="py-2 pr-3 text-right">Chamadas</th>
                  <th className="py-2 pr-3 text-right">Visitantes</th>
                  <th className="py-2 pr-3">Na função</th>
                  <th className="py-2 pr-3 text-right">Crescimento</th>
                </tr>
              </thead>
              <tbody>
                {dados.professores.map((p, i) => (
                  <tr
                    key={`${p.pessoaId}-${p.classeId}-${i}`}
                    className="border-b border-white/5 text-brand-100/85 last:border-0 print:border-black print:text-black"
                  >
                    <td className="py-2 pr-3 text-brand-50 print:text-black">{p.nome}</td>
                    <td className="py-2 pr-3 text-brand-200/70 print:text-black">{p.classe}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {p.frequenciaMediaClasse !== null ? `${p.frequenciaMediaClasse}%` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.chamadasRealizadas}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.visitantesRecebidos}</td>
                    <td className="py-2 pr-3 text-brand-200/70 print:text-black">{p.tempoNaFuncao ?? "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {p.crescimentoClasse !== null ? `${p.crescimentoClasse > 0 ? "+" : ""}${p.crescimentoClasse}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---------------- Visitantes ---------------- */}
      <section className="glass-panel rounded-2xl p-5 print:border print:border-black print:bg-white">
        <h2 className="mb-3 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50 print:text-black">
          Visitantes
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CartaoResumo icone={UserRoundPlus} rotulo="No período" valor={numero(dados.visitantes.total)} />
          <CartaoResumo
            icone={TrendingUp}
            rotulo="Variação"
            valor={dados.visitantes.variacaoPct !== null ? `${dados.visitantes.variacaoPct > 0 ? "+" : ""}${dados.visitantes.variacaoPct}%` : "—"}
          />
          <CartaoResumo icone={Users} rotulo="Nomes distintos" valor={numero(dados.visitantes.unicos)} />
          <CartaoResumo
            icone={Award}
            rotulo="Recorrentes"
            valor={numero(dados.visitantes.recorrentes)}
          />
        </div>
        <p className="mt-3 text-[0.68rem] text-brand-200/40 print:hidden">
          "Recorrentes" conta nomes que aparecem em dois domingos ou mais — não há cadastro único de
          visitante, então dois nomes iguais contam como recorrência mesmo quando são pessoas diferentes.
        </p>
      </section>

      {/* ---------------- Meta (deferido) ---------------- */}
      <section className="glass-panel rounded-2xl p-5 opacity-70 print:hidden">
        <h2 className="mb-1.5 flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
          <Target className="h-4 w-4" />
          Meta da congregação
        </h2>
        <p className="text-[0.78rem] text-brand-200/50">
          Em breve. Precisa de uma tela para a liderança definir a meta de alunos, frequência e
          visitantes do trimestre — o sistema ainda não guarda essa informação.
        </p>
      </section>

      {/* ---------------- Mapa (deferido) ---------------- */}
      <section className="glass-panel rounded-2xl p-5 opacity-70 print:hidden">
        <h2 className="mb-1.5 flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
          <MapIcon className="h-4 w-4" />
          Localização
        </h2>
        <p className="text-[0.78rem] text-brand-200/50">
          Em breve — espaço reservado para o mapa da congregação, quando o cadastro tiver endereço.
        </p>
      </section>

      {/* ---------------- Histórico ---------------- */}
      {dados.historico.length > 0 && (
        <section className="glass-panel rounded-2xl p-5 print:hidden">
          <h2 className="mb-3 flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
            <History className="h-4 w-4" />
            Histórico
          </h2>
          <p className="mb-3 text-[0.7rem] text-brand-200/40">
            Registrado a partir de quando o sistema passou a gravar auditoria por congregação.
          </p>
          <ol className="space-y-3 border-l border-white/10 pl-4">
            {dados.historico.map((h, i) => (
              <li key={i} className="relative text-[0.8rem]">
                <span className="absolute -left-[1.15rem] top-1.5 h-2 w-2 rounded-full bg-gold-400/60" />
                <p className="text-brand-50">{h.descricao}</p>
                <p className="mt-0.5 text-[0.7rem] text-brand-200/45">
                  {h.quem} · {dataPorExtenso(new Date(h.quando))} às {hora(new Date(h.quando))}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Peças
 * ------------------------------------------------------------------ */

function diaMes(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}
function mesRotulo(iso: string): string {
  const [ano, mes] = iso.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(new Date(`${ano}-${mes}-15T12:00:00`));
}
function arred(n: number): number {
  return Math.round(n * 10) / 10;
}

function InfoLinha({ rotulo, pessoa }: { rotulo: string; pessoa: Pessoa | null }) {
  return (
    <div>
      <p className="text-[0.68rem] uppercase tracking-[0.12em] text-brand-200/50 print:text-black">{rotulo}</p>
      <p className="mt-0.5 text-[0.86rem] text-brand-50 print:text-black">
        {pessoa ? `${pessoa.tratamento ? pessoa.tratamento + " " : ""}${pessoa.nome}` : "Vago"}
      </p>
    </div>
  );
}

function CartaoResumo({
  icone: Icone,
  rotulo,
  valor,
  cor,
}: {
  icone: typeof Users;
  rotulo: string;
  valor: string;
  cor?: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-3.5 print:border print:border-black print:bg-white">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/8 print:hidden">
        <Icone className="h-4 w-4 text-gold-300" />
      </span>
      <p
        className="mt-2.5 font-display text-[1.3rem] font-semibold leading-none tabular-nums print:text-black"
        style={{ color: cor ?? "white" }}
      >
        {valor}
      </p>
      <p className="mt-1 truncate text-[0.68rem] uppercase tracking-[0.1em] text-brand-200/50 print:text-black">{rotulo}</p>
    </div>
  );
}

function ComparativoCartao({ rotulo, valor, sufixo = "%" }: { rotulo: string; valor: number | null; sufixo?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3 print:border-black">
      <p className="text-[0.7rem] text-brand-200/55 print:text-black">{rotulo}</p>
      <p className="mt-1 font-display text-[1.15rem] font-semibold text-white print:text-black tabular-nums">
        {valor !== null ? `${arred(valor)}${sufixo}` : "—"}
      </p>
    </div>
  );
}

function PosicaoRanking({ rotulo, pos }: { rotulo: string; pos: { posicao: number; total: number } | null }) {
  return (
    <div className="glass-panel rounded-xl p-3 text-center">
      <p className="font-display text-[1.3rem] font-semibold text-gold-200 tabular-nums">
        {pos ? `${pos.posicao}º` : "—"}
      </p>
      <p className="mt-0.5 text-[0.66rem] uppercase tracking-[0.1em] text-brand-200/50">{rotulo}</p>
      {pos && <p className="text-[0.64rem] text-brand-200/35">de {pos.total}</p>}
    </div>
  );
}

function IndicadorAuto({ rotulo, valor, data }: { rotulo: string; valor: string; data?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 print:border-black">
      <p className="text-[0.66rem] uppercase tracking-[0.1em] text-brand-200/50 print:text-black">{rotulo}</p>
      <p className="mt-1 font-display text-[1.05rem] font-semibold text-white print:text-black tabular-nums">{valor}</p>
      {data && <p className="text-[0.68rem] text-brand-200/45 print:text-black">{diaEMes(new Date(`${data}T12:00:00`))}</p>}
    </div>
  );
}

const ICONE_ALERTA: Record<string, typeof AlertTriangle> = {
  "congregacao-critica": AlertTriangle,
  "queda-frequencia": TrendingDown,
  "classe-sem-chamada": CalendarClock,
  "visitantes-caindo": UserRoundPlus,
  "abaixo-da-media": Activity,
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
