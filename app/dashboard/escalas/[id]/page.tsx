"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, ArrowRightCircle, BadgeCheck, CalendarRange,
  ChevronLeft, ChevronRight, Loader2, Menu, Pencil, Plus, Printer, Save, Search, Send,
  Trash2, Undo2, UserRound, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CabecalhoModulo, EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { TIPOS_CULTO, rotuloDoTipo } from "@/lib/escalas/tiposCulto";

/**
 * Montar (ou ler) a escala mensal de um mês.
 *
 * ============================================================================
 * OBREIRO É PESSOA, NÃO TEXTO — E É POR ISSO QUE A LATERAL EXISTE
 *
 * A primeira versão guardava "PB. Reginaldo / Dc. Gilberto" como uma string
 * solta. Isso impedia exatamente o que se pede de um sistema de escala:
 * contar quantas vezes cada obreiro serve no mês, e avisar quando o mesmo
 * obreiro cai duas vezes no mesmo dia. Por isso `EscalaItemObreiro` liga
 * cada lançamento a uma `Pessoa` de verdade — e a lateral vira um painel de
 * pessoas de carne e osso, não uma lista de textos.
 *
 * A GRADE É EDITADA NA TELA E GRAVADA DE UMA VEZ SÓ — um mês tem mais de cem
 * cultos; gravar linha por linha seria o oposto de "mais rápido". Um único
 * "Salvar" manda tudo para `PATCH /api/escalas-mensais/[id]`.
 * ============================================================================
 */

interface ObreiroItem {
  pessoaId?: number; alunoId?: number; nomeNovo?: string;
  nome: string; tratamento: string | null;
}
interface ItemAPI {
  id: number; data: string; tipoCodigo: number; congId: number | null; congregacao: string | null;
  local: string; destaque: string | null; ordem: number;
  obreiros: { pessoaId: number; nome: string; tratamento: string | null }[];
}
interface AvisoAPI { id: number; data: string | null; titulo: string; descricao: string; ordem: number }
interface DadosEscala {
  id: number; titulo: string; mesAno: string; status: string; publicadoEm: string | null;
  publicadoPor: string | null; autor: string; atualizado: string; itens: ItemAPI[]; avisos: AvisoAPI[];
}
interface ItemLocal {
  chave: string; id?: number; data: string; tipoCodigo: number; congId: number | null;
  local: string; destaque: string; obreiros: ObreiroItem[];
}
interface AvisoLocal { chave: string; data: string; titulo: string; descricao: string }
interface CongregacaoOpcao { id: number; nome: string }
interface ObreiroDir { id: number; nome: string; tratamento: string | null }
interface Lider { cargo: string; ordem: number; nome: string | null; tratamento: string | null }
interface EscalaResumo { id: number; mesAno: string }
interface Candidato {
  tipo: "pessoa" | "aluno" | "novo"; id: number; nome: string; tratamento: string | null; subtitulo: string;
}

const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const fmtDataLonga = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const fmtDiaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const fmtDataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

const GRUPOS_OBREIRO: readonly { abrev: string; rotulo: string }[] = [
  { abrev: "Pr.", rotulo: "Pastores" },
  { abrev: "Ev.", rotulo: "Evangelistas" },
  { abrev: "Pb.", rotulo: "Presbíteros" },
  { abrev: "Dc.", rotulo: "Diáconos" },
  { abrev: "Aux.", rotulo: "Auxiliares" },
];

function nomeObreiro(o: { nome: string; tratamento: string | null }): string {
  return o.tratamento ? `${o.tratamento} ${o.nome}` : o.nome;
}

function novoItem(dataPadrao: string, tipoPadrao: number): ItemLocal {
  return {
    chave: crypto.randomUUID(), data: dataPadrao, tipoCodigo: tipoPadrao,
    congId: null, local: "", destaque: "", obreiros: [],
  };
}

export default function EscalaMensalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const { podeGravar, escopo } = useAcesso();
  const editavel = podeGravar("escalas") && escopo === "campo";

  const [dados, setDados] = useState<DadosEscala | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<CongregacaoOpcao[]>([]);
  const [lideres, setLideres] = useState<Lider[]>([]);
  const [obreirosDir, setObreirosDir] = useState<ObreiroDir[]>([]);
  const [meses, setMeses] = useState<EscalaResumo[]>([]);

  const [titulo, setTitulo] = useState("");
  const [itens, setItens] = useState<ItemLocal[]>([]);
  const [avisos, setAvisos] = useState<AvisoLocal[]>([]);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [buscaObreiro, setBuscaObreiro] = useState("");
  const [filtroTratamento, setFiltroTratamento] = useState<string | null>(null);
  const [obreiroSelecionado, setObreiroSelecionado] = useState<ObreiroDir | null>(null);

  const [novoCultoAberto, setNovoCultoAberto] = useState(false);
  const [formNovo, setFormNovo] = useState<ItemLocal>(() => novoItem("", 2));
  const [editandoChave, setEditandoChave] = useState<string | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [buscaFallback, setBuscaFallback] = useState<string | null>(null); // chave do item com o "+ obreiro" aberto
  const [termoFallback, setTermoFallback] = useState("");
  const [resultadosFallback, setResultadosFallback] = useState<Candidato[]>([]);

  const [confirmandoPublicar, setConfirmandoPublicar] = useState(false);
  const [publicando, setPublicando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch(`/api/escalas-mensais/${id}`, { cache: "no-store" });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? `HTTP ${res.status}`);
      const d = corpo as DadosEscala;
      setDados(d);
      setTitulo(d.titulo);
      setItens(
        d.itens.map((i) => ({
          chave: crypto.randomUUID(), id: i.id, data: i.data, tipoCodigo: i.tipoCodigo, congId: i.congId,
          local: i.local, destaque: i.destaque ?? "",
          obreiros: i.obreiros.map((o) => ({ pessoaId: o.pessoaId, nome: o.nome, tratamento: o.tratamento })),
        })),
      );
      setAvisos(
        d.avisos.map((a) => ({ chave: crypto.randomUUID(), data: a.data ?? "", titulo: a.titulo, descricao: a.descricao })),
      );
      setFormNovo(novoItem(d.itens[0]?.data ?? d.mesAno, 2));
      setSujo(false);
    } catch (e) {
      setErro((e as Error).message || "Não foi possível carregar a escala.");
    }
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    void fetch("/api/escalas-mensais/congregacoes", { cache: "no-store" })
      .then((r) => r.json()).then((d) => setCongregacoes(d.itens ?? [])).catch(() => {});
    void fetch("/api/lideranca", { cache: "no-store" })
      .then((r) => r.json()).then((d) => setLideres(d.itens ?? [])).catch(() => {});
    void fetch("/api/escalas-mensais/obreiros", { cache: "no-store" })
      .then((r) => r.json()).then((d) => setObreirosDir(d.itens ?? [])).catch(() => {});
    void fetch("/api/escalas-mensais", { cache: "no-store" })
      .then((r) => r.json()).then((d) => setMeses((d.itens ?? []).map((e: { id: number; mesAno: string }) => ({ id: e.id, mesAno: e.mesAno })))).catch(() => {});
  }, []);

  // Busca do "+ obreiro" de reserva, por item — usada para quem não tem
  // tratamento cadastrado (ainda não é "obreiro" para a lateral), como um
  // aluno que vai pregar pela primeira vez.
  useEffect(() => {
    const t = termoFallback.trim();
    if (t.length < 2) { setResultadosFallback([]); return; }
    const controle = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pessoas/candidatos?q=${encodeURIComponent(t)}`, { signal: controle.signal, cache: "no-store" });
        const d = await res.json();
        setResultadosFallback(d.candidatos ?? []);
      } catch { setResultadosFallback([]); }
    }, 250);
    return () => { controle.abort(); clearTimeout(timer); };
  }, [termoFallback]);

  // Aviso simples ao sair com a grade suja.
  useEffect(() => {
    if (!sujo) return;
    const aoSair = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [sujo]);

  const grupos = useMemo(() => {
    const porData = new Map<string, ItemLocal[]>();
    for (const it of itens) {
      if (!porData.has(it.data)) porData.set(it.data, []);
      porData.get(it.data)!.push(it);
    }
    return [...porData.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [itens]);

  const workload = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const it of itens) {
      for (const o of it.obreiros) {
        if (o.pessoaId === undefined) continue;
        mapa.set(o.pessoaId, (mapa.get(o.pessoaId) ?? 0) + 1);
      }
    }
    return mapa;
  }, [itens]);

  const kpis = useMemo(() => {
    const congsUsadas = new Set(itens.map((i) => i.congId ?? `local:${i.local}`));
    const obreirosUsados = new Set(itens.flatMap((i) => i.obreiros.map((o) => o.pessoaId).filter((x): x is number => x !== undefined)));
    const pendentes = itens.filter((i) => i.obreiros.length === 0);
    return {
      cultos: itens.length,
      obreiros: obreirosUsados.size,
      congregacoes: congsUsadas.size,
      pendencias: pendentes,
    };
  }, [itens]);

  const obreirosFiltrados = useMemo(() => {
    const termo = buscaObreiro.trim().toLowerCase();
    return obreirosDir
      .filter((o) => !filtroTratamento || o.tratamento === filtroTratamento)
      .filter((o) => !termo || o.nome.toLowerCase().includes(termo))
      .map((o) => ({ ...o, escalas: workload.get(o.id) ?? 0 }));
  }, [obreirosDir, buscaObreiro, filtroTratamento, workload]);

  const gruposObreiro = useMemo(() => {
    const grupos = GRUPOS_OBREIRO.map((g) => ({ ...g, itens: obreirosFiltrados.filter((o) => o.tratamento === g.abrev) }));
    const conhecidos = new Set(GRUPOS_OBREIRO.map((g) => g.abrev));
    const outros = obreirosFiltrados.filter((o) => !conhecidos.has(o.tratamento ?? ""));
    if (outros.length > 0) grupos.push({ abrev: "", rotulo: "Outros", itens: outros });
    return grupos.filter((g) => g.itens.length > 0);
  }, [obreirosFiltrados]);

  const indiceMesAtual = meses.findIndex((m) => m.id === id);
  const mesAnterior = indiceMesAtual >= 0 ? meses[indiceMesAtual + 1] : undefined; // ordenado desc
  const mesSeguinte = indiceMesAtual >= 0 ? meses[indiceMesAtual - 1] : undefined;

  function iniciarNovoCulto(dataSugestao?: string) {
    setFormNovo(novoItem(dataSugestao ?? formNovo.data ?? dados?.mesAno ?? "", formNovo.tipoCodigo));
    setEditandoChave(null);
    setNovoCultoAberto(true);
    setErroForm(null);
  }

  function iniciarEdicao(it: ItemLocal) {
    setFormNovo({ ...it });
    setEditandoChave(it.chave);
    setNovoCultoAberto(true);
    setErroForm(null);
  }

  function fecharForm() {
    setNovoCultoAberto(false);
    setEditandoChave(null);
    setErroForm(null);
  }

  function confirmarCulto() {
    if (!formNovo.data) return setErroForm("Informe a data do culto.");
    if (!formNovo.local.trim()) return setErroForm("Informe o local (congregação) do culto.");

    if (editandoChave) {
      setItens((a) => a.map((it) => (it.chave === editandoChave ? { ...formNovo, obreiros: it.obreiros } : it)));
    } else {
      setItens((a) => [...a, { ...formNovo }]);
    }
    setSujo(true);
    fecharForm();
  }

  function removerCulto(chave: string) {
    setItens((a) => a.filter((it) => it.chave !== chave));
    setSujo(true);
    if (editandoChave === chave) fecharForm();
  }

  function escolherCongregacaoNovo(congId: number | null) {
    const nome = congId ? congregacoes.find((c) => c.id === congId)?.nome ?? "" : formNovo.local;
    setFormNovo((f) => ({ ...f, congId, local: congId ? nome : f.local }));
  }

  function duplicarDia(data: string) {
    const proxima = window.prompt("Duplicar os cultos deste dia para qual data? (AAAA-MM-DD)", data);
    if (!proxima || !/^\d{4}-\d{2}-\d{2}$/.test(proxima)) return;
    const doDia = itens.filter((i) => i.data === data);
    setItens((a) => [
      ...a,
      ...doDia.map((it) => ({ ...it, chave: crypto.randomUUID(), id: undefined, data: proxima })),
    ]);
    setSujo(true);
  }

  function adicionarObreiroAoItem(chaveItem: string, obreiro: ObreiroItem) {
    setItens((a) =>
      a.map((it) => {
        if (it.chave !== chaveItem) return it;
        const jaTem = it.obreiros.some((o) => o.pessoaId !== undefined && o.pessoaId === obreiro.pessoaId);
        if (jaTem) return it;
        return { ...it, obreiros: [...it.obreiros, obreiro] };
      }),
    );
    setSujo(true);
  }

  function removerObreiroDoItem(chaveItem: string, indice: number) {
    setItens((a) => a.map((it) => (it.chave !== chaveItem ? it : { ...it, obreiros: it.obreiros.filter((_, i) => i !== indice) })));
    setSujo(true);
  }

  function cliqueNoCard(item: ItemLocal) {
    if (!obreiroSelecionado || !editavel) return;
    const conflito = itens.some(
      (it) => it.data === item.data && it.chave !== item.chave && it.obreiros.some((o) => o.pessoaId === obreiroSelecionado.id),
    );
    const jaNesteItem = item.obreiros.some((o) => o.pessoaId === obreiroSelecionado.id);
    if (jaNesteItem) return;
    if (conflito) {
      const ok = window.confirm(
        `${nomeObreiro(obreiroSelecionado)} já está escalado neste dia, em outra congregação. Adicionar mesmo assim?`,
      );
      if (!ok) return;
    }
    adicionarObreiroAoItem(item.chave, { pessoaId: obreiroSelecionado.id, nome: obreiroSelecionado.nome, tratamento: obreiroSelecionado.tratamento });
  }

  function escolherFallback(chaveItem: string, c: Candidato) {
    if (c.tipo === "pessoa") adicionarObreiroAoItem(chaveItem, { pessoaId: c.id, nome: c.nome, tratamento: c.tratamento });
    else if (c.tipo === "aluno") adicionarObreiroAoItem(chaveItem, { alunoId: c.id, nome: c.nome, tratamento: c.tratamento });
    else adicionarObreiroAoItem(chaveItem, { nomeNovo: c.nome, nome: c.nome, tratamento: null });
    setBuscaFallback(null);
    setTermoFallback("");
  }

  function adicionarAviso() {
    setAvisos((a) => [...a, { chave: crypto.randomUUID(), data: "", titulo: "", descricao: "" }]);
    setSujo(true);
  }
  function atualizarAviso(chave: string, campo: keyof AvisoLocal, valor: string) {
    setAvisos((a) => a.map((av) => (av.chave === chave ? { ...av, [campo]: valor } : av)));
    setSujo(true);
  }
  function removerAviso(chave: string) {
    setAvisos((a) => a.filter((av) => av.chave !== chave));
    setSujo(true);
  }

  async function salvar(): Promise<boolean> {
    setSalvando(true);
    setErroSalvar(null);
    try {
      const res = await fetch(`/api/escalas-mensais/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          avisos: avisos.map((a) => ({ data: a.data || undefined, titulo: a.titulo, descricao: a.descricao })),
          itens: itens.map((it) => ({
            data: it.data, tipoCodigo: it.tipoCodigo, congId: it.congId, local: it.local,
            destaque: it.destaque || undefined,
            obreiros: it.obreiros.map((o) => ({ pessoaId: o.pessoaId, alunoId: o.alunoId, nomeNovo: o.nomeNovo })),
          })),
        }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) { setErroSalvar(corpo.erro ?? "Não foi possível salvar."); return false; }
      setSujo(false);
      await carregar();
      return true;
    } catch {
      setErroSalvar("Sem resposta do servidor. Verifique a conexão.");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function publicar() {
    setPublicando(true);
    if (sujo && !(await salvar())) { setPublicando(false); return; }
    try {
      const res = await fetch(`/api/escalas-mensais/${id}/publicar`, { method: "POST" });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) { setErroSalvar(corpo.erro ?? "Não foi possível publicar."); return; }
      setConfirmandoPublicar(false);
      await carregar();
    } finally {
      setPublicando(false);
    }
  }

  async function reabrirRascunho() {
    setPublicando(true);
    try {
      await fetch(`/api/escalas-mensais/${id}/publicar`, { method: "DELETE" });
      await carregar();
    } finally {
      setPublicando(false);
    }
  }

  const presidente = lideres.find((l) => l.ordem === 10);
  const localLider = lideres.find((l) => l.ordem === 20);

  return (
    <>
      <div className="print:hidden">
        <Link href="/dashboard/escalas" className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] text-brand-200/60 transition-colors duration-300 hover:text-gold-200">
          <ArrowLeft className="h-3.5 w-3.5" />
          Escalas
        </Link>

        <CabecalhoModulo
          icone={CalendarRange}
          titulo={dados ? `Escala — ${fmtMes.format(new Date(`${dados.mesAno}T12:00:00`))}` : "Escala mensal"}
          descricao={dados ? `${dados.status === "publicado" ? "Publicada" : "Rascunho"} · última gravação por ${dados.autor}` : "Carregando…"}
        >
          <div className="flex items-center gap-1">
            <Link
              href={mesAnterior ? `/dashboard/escalas/${mesAnterior.id}` : "#"}
              aria-disabled={!mesAnterior}
              className={cn("rounded-lg p-2 text-brand-200/60 hover:bg-white/8 hover:text-brand-100", !mesAnterior && "pointer-events-none opacity-30")}
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href={mesSeguinte ? `/dashboard/escalas/${mesSeguinte.id}` : "#"}
              aria-disabled={!mesSeguinte}
              className={cn("rounded-lg p-2 text-brand-200/60 hover:bg-white/8 hover:text-brand-100", !mesSeguinte && "pointer-events-none opacity-30")}
              title="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => setSidebarAberta(true)}>
            <Menu className="h-4 w-4" />
            Obreiros
          </Button>
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          {editavel && dados?.status === "publicado" && (
            <Button size="sm" variant="ghost" onClick={() => void reabrirRascunho()} disabled={publicando}>
              {publicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              Reabrir como rascunho
            </Button>
          )}
          {editavel && dados?.status !== "publicado" && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmandoPublicar(true)}>
              <Send className="h-4 w-4" />
              Publicar
            </Button>
          )}
          {editavel && (
            <Button size="sm" onClick={() => void salvar()} disabled={salvando || !sujo}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {salvando ? "Salvando…" : sujo ? "Salvar alterações" : "Tudo salvo"}
            </Button>
          )}
        </CabecalhoModulo>

        {dados && (
          <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Kpi rotulo="Cultos no mês" valor={kpis.cultos} />
            <Kpi rotulo="Obreiros escalados" valor={kpis.obreiros} />
            <Kpi rotulo="Congregações" valor={kpis.congregacoes} />
            <Kpi rotulo="Pendências" valor={kpis.pendencias.length} alerta={kpis.pendencias.length > 0} />
          </div>
        )}

        {kpis.pendencias.length > 0 && (
          <Alert tipo="alerta" titulo={`${kpis.pendencias.length} culto(s) ainda sem obreiro`} className="mb-4">
            {kpis.pendencias.slice(0, 4).map((p) => `${fmtDataCurta.format(new Date(`${p.data}T12:00:00`))} — ${p.local}`).join(" · ")}
            {kpis.pendencias.length > 4 && "…"}
          </Alert>
        )}
      </div>

      {erroSalvar && <Alert tipo="erro" titulo={erroSalvar} className="mb-4 print:hidden" />}

      {erro ? <EstadoErro mensagem={erro} />
      : !dados ? <EsqueletoLista linhas={6} />
      : (
        <>
          <div className="print:hidden lg:flex lg:items-start lg:gap-4">
            {/* ÁREA A — painel lateral de obreiros */}
            <aside
              className={cn(
                "z-30 lg:sticky lg:top-4 lg:block lg:w-72 lg:shrink-0",
                sidebarAberta ? "fixed inset-0 bg-brand-950/80 p-4 backdrop-blur-sm" : "hidden",
              )}
              onClick={(e) => { if (e.target === e.currentTarget) setSidebarAberta(false); }}
            >
              <div className="glass-panel max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-brand-200/60">Obreiros</h2>
                  <button type="button" className="lg:hidden rounded-lg p-1 text-brand-200/60" onClick={() => setSidebarAberta(false)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5">
                  <Search className="h-3.5 w-3.5 shrink-0 text-brand-300/60" />
                  <input
                    value={buscaObreiro}
                    onChange={(e) => setBuscaObreiro(e.target.value)}
                    placeholder="Buscar obreiro…"
                    className="min-w-0 flex-1 bg-transparent py-2 text-[0.8rem] text-brand-50 placeholder:text-brand-200/40 focus:outline-none"
                  />
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFiltroTratamento(null)}
                    className={cn("rounded-full px-2.5 py-1 text-[0.68rem]", !filtroTratamento ? "bg-gold-400/20 text-gold-200" : "bg-white/6 text-brand-200/60")}
                  >
                    Todos
                  </button>
                  {GRUPOS_OBREIRO.map((g) => (
                    <button
                      key={g.abrev}
                      type="button"
                      onClick={() => setFiltroTratamento(filtroTratamento === g.abrev ? null : g.abrev)}
                      className={cn("rounded-full px-2.5 py-1 text-[0.68rem]", filtroTratamento === g.abrev ? "bg-gold-400/20 text-gold-200" : "bg-white/6 text-brand-200/60")}
                    >
                      {g.rotulo}
                    </button>
                  ))}
                </div>

                {editavel && obreiroSelecionado && (
                  <div className="mb-2 flex items-center justify-between rounded-xl border border-gold-400/30 bg-gold-400/[0.08] px-2.5 py-2 text-[0.76rem] text-gold-100">
                    <span className="truncate">{nomeObreiro(obreiroSelecionado)} selecionado</span>
                    <button type="button" onClick={() => setObreiroSelecionado(null)} className="shrink-0 text-gold-200/70 hover:text-gold-100">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {gruposObreiro.length === 0 ? (
                  <p className="px-1 py-4 text-[0.76rem] text-brand-200/45">Nenhum obreiro encontrado.</p>
                ) : (
                  gruposObreiro.map((g) => (
                    <div key={g.rotulo} className="mb-3">
                      <p className="mb-1 px-1 text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-brand-200/45">{g.rotulo}</p>
                      <ul className="space-y-0.5">
                        {g.itens.map((o) => (
                          <li key={o.id}>
                            <button
                              type="button"
                              disabled={!editavel}
                              onClick={() => setObreiroSelecionado(obreiroSelecionado?.id === o.id ? null : o)}
                              title={`${o.escalas} escala(s) neste mês`}
                              className={cn(
                                "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[0.8rem] transition-colors",
                                obreiroSelecionado?.id === o.id ? "bg-gold-400/20 text-gold-100" : "text-brand-100/80 hover:bg-white/6",
                              )}
                            >
                              <span className="min-w-0 flex-1 truncate">{nomeObreiro(o)}</span>
                              {o.escalas > 0 && (
                                <span className="shrink-0 rounded-full bg-white/8 px-1.5 py-0.5 text-[0.64rem] tabular-nums text-brand-200/55">
                                  {o.escalas}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}

                {editavel && (
                  <p className="mt-2 border-t border-white/8 px-1 pt-2 text-[0.68rem] leading-relaxed text-brand-200/40">
                    Clique num obreiro para selecionar e depois clique no culto — ou toque duas vezes para desmarcar.
                  </p>
                )}
              </div>
            </aside>

            {/* ÁREA B — escala mensal, organizada por dia */}
            <div className="min-w-0 flex-1">
              {editavel && (
                <div className="mb-3 flex items-center justify-between">
                  <input
                    value={titulo}
                    onChange={(e) => { setTitulo(e.target.value); setSujo(true); }}
                    className={cn(campoBase, "font-display text-[0.9rem]")}
                  />
                  <Button size="sm" variant="ghost" className="ml-2 shrink-0" onClick={() => iniciarNovoCulto()}>
                    <Plus className="h-3.5 w-3.5" />
                    Novo culto
                  </Button>
                </div>
              )}

              {novoCultoAberto && editavel && (
                <div className="glass-panel mb-4 rounded-2xl p-4">
                  <p className="mb-3 text-[0.8rem] font-semibold text-white">{editandoChave ? "Editar culto" : "Novo culto"}</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block">
                      <span className="mb-1.5 block text-[0.74rem] text-brand-200/70">Data <span className="text-gold-300">*</span></span>
                      <input
                        type="date"
                        value={formNovo.data}
                        onChange={(e) => setFormNovo((f) => ({ ...f, data: e.target.value }))}
                        className={cn(campoBase, "[color-scheme:dark]")}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[0.74rem] text-brand-200/70">Tipo de culto</span>
                      <select
                        value={formNovo.tipoCodigo}
                        onChange={(e) => setFormNovo((f) => ({ ...f, tipoCodigo: Number(e.target.value) }))}
                        className={cn(campoBase, "[&>option]:bg-brand-900")}
                      >
                        {TIPOS_CULTO.map((t) => (
                          <option key={t.codigo} value={t.codigo}>{String(t.codigo).padStart(2, "0")} — {t.rotulo}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-[0.74rem] text-brand-200/70">Congregação / local <span className="text-gold-300">*</span></span>
                      <div className="flex gap-2">
                        <select
                          value={formNovo.congId ?? ""}
                          onChange={(e) => escolherCongregacaoNovo(e.target.value ? Number(e.target.value) : null)}
                          className={cn(campoBase, "w-auto shrink-0 [&>option]:bg-brand-900")}
                        >
                          <option value="">Outro local…</option>
                          {congregacoes.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                        </select>
                        <input
                          value={formNovo.local}
                          onChange={(e) => setFormNovo((f) => ({ ...f, local: e.target.value, congId: null }))}
                          placeholder="Nome do local"
                          className={campoBase}
                        />
                      </div>
                    </label>
                    <label className="block sm:col-span-2 lg:col-span-4">
                      <span className="mb-1.5 block text-[0.74rem] text-brand-200/70">Observação (opcional)</span>
                      <input
                        value={formNovo.destaque}
                        onChange={(e) => setFormNovo((f) => ({ ...f, destaque: e.target.value }))}
                        placeholder="Ex.: Consagração Geral"
                        className={campoBase}
                      />
                    </label>
                  </div>
                  {erroForm && <p className="mt-3 text-[0.8rem] text-flame-400" role="alert">{erroForm}</p>}
                  <div className="mt-3 flex items-center gap-2">
                    <Button type="button" size="sm" onClick={confirmarCulto}>
                      <Save className="h-3.5 w-3.5" />
                      {editandoChave ? "Salvar culto" : "Adicionar à escala"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={fecharForm}>Cancelar</Button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {grupos.length === 0 ? (
                  <div className="glass-panel rounded-2xl px-6 py-12 text-center">
                    <p className="text-[0.9rem] text-brand-100/80">Nenhum culto lançado ainda.</p>
                    {editavel && <p className="mx-auto mt-2 max-w-sm text-[0.78rem] text-brand-200/50">Clique em "Novo culto" para começar.</p>}
                  </div>
                ) : (
                  grupos.map(([data, doDia]) => (
                    <div key={data}>
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="text-[0.86rem] font-semibold capitalize text-white">{fmtDataLonga.format(new Date(`${data}T12:00:00`))}</p>
                          <p className="text-[0.7rem] capitalize text-brand-200/50">{fmtDiaSemana.format(new Date(`${data}T12:00:00`))}</p>
                        </div>
                        {editavel && (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => iniciarNovoCulto(data)} title="Adicionar outra congregação neste dia" className="rounded-lg p-1.5 text-brand-200/50 hover:bg-white/8 hover:text-brand-100">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => duplicarDia(data)} title="Duplicar este dia para outra data" className="rounded-lg p-1.5 text-brand-200/50 hover:bg-white/8 hover:text-brand-100">
                              <ArrowRightCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                        {doDia.map((it) => (
                          <div
                            key={it.chave}
                            onClick={() => cliqueNoCard(it)}
                            className={cn(
                              "glass-panel rounded-2xl p-3 transition-colors",
                              obreiroSelecionado && editavel && "cursor-pointer hover:border-gold-400/30",
                              it.obreiros.length === 0 && "border-gold-400/20",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-[0.82rem] font-semibold text-brand-50">{it.local}</p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.7rem] text-brand-200/55">
                                  <Badge variant="info">{String(it.tipoCodigo).padStart(2, "0")}</Badge>
                                  {rotuloDoTipo(it.tipoCodigo)}
                                  {it.destaque && <Badge variant="alerta">{it.destaque}</Badge>}
                                </p>
                              </div>
                              {editavel && (
                                <div className="flex shrink-0 items-center gap-0.5">
                                  <button type="button" onClick={(e) => { e.stopPropagation(); iniciarEdicao(it); }} aria-label="Editar" className="rounded-lg p-1.5 text-brand-200/50 hover:bg-white/8 hover:text-brand-100">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); removerCulto(it.chave); }} aria-label="Remover" className="rounded-lg p-1.5 text-brand-200/50 hover:bg-flame-500/15 hover:text-flame-400">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {it.obreiros.length === 0 && !editavel && (
                                <span className="text-[0.72rem] text-brand-200/40">Sem obreiro escalado.</span>
                              )}
                              {it.obreiros.map((o, i) => (
                                <span key={i} className="flex items-center gap-1 rounded-full bg-white/8 py-1 pl-2.5 pr-1.5 text-[0.74rem] text-brand-50">
                                  <UserRound className="h-3 w-3 shrink-0 text-brand-300/50" />
                                  {nomeObreiro(o)}
                                  {editavel && (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); removerObreiroDoItem(it.chave, i); }} aria-label={`Remover ${o.nome}`} className="shrink-0 rounded-full p-0.5 text-brand-300/50 hover:text-flame-400">
                                      <X className="h-3 w-3" />
                                    </button>
                                  )}
                                </span>
                              ))}
                              {editavel && buscaFallback !== it.chave && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setBuscaFallback(it.chave); setTermoFallback(""); setResultadosFallback([]); }}
                                  className="flex items-center gap-1 rounded-full border border-dashed border-white/15 px-2.5 py-1 text-[0.72rem] text-brand-200/55 hover:border-gold-400/30 hover:text-gold-200"
                                >
                                  <Plus className="h-3 w-3" />
                                  Obreiro
                                </button>
                              )}
                            </div>

                            {editavel && buscaFallback === it.chave && (
                              <div className="mt-2 rounded-xl border border-gold-400/25 bg-brand-900/40 p-2" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2">
                                  <Search className="h-3.5 w-3.5 shrink-0 text-brand-300/60" />
                                  <input
                                    autoFocus
                                    value={termoFallback}
                                    onChange={(e) => setTermoFallback(e.target.value)}
                                    onKeyDown={(e) => e.key === "Escape" && setBuscaFallback(null)}
                                    placeholder="Buscar pessoa ou aluno…"
                                    className="min-w-0 flex-1 bg-transparent py-1.5 text-[0.78rem] text-brand-50 placeholder:text-brand-200/40 focus:outline-none"
                                  />
                                  <button type="button" onClick={() => setBuscaFallback(null)} className="shrink-0 p-1 text-brand-200/60"><X className="h-3.5 w-3.5" /></button>
                                </div>
                                {resultadosFallback.length > 0 && (
                                  <ul className="mt-1 max-h-40 overflow-y-auto">
                                    {resultadosFallback.map((c) => (
                                      <li key={`${c.tipo}-${c.id}`}>
                                        <button type="button" onClick={() => escolherFallback(it.chave, c)} className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[0.78rem] text-brand-50 hover:bg-white/8">
                                          {c.tratamento && <span className="text-gold-200/80">{c.tratamento}</span>} {c.nome}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {editavel && (
                <div className="glass-panel mt-6 rounded-2xl p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-[0.8rem] font-semibold text-white">Avisos (aparecem no rodapé da escala impressa)</h2>
                    <Button size="sm" variant="ghost" onClick={adicionarAviso}><Plus className="h-3.5 w-3.5" />Novo aviso</Button>
                  </div>
                  {avisos.length === 0 ? (
                    <p className="text-[0.78rem] text-brand-200/45">Nenhum aviso cadastrado.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {avisos.map((a) => (
                        <div key={a.chave} className="grid grid-cols-1 gap-2 rounded-xl border border-white/8 p-2.5 sm:grid-cols-[7rem_1fr_1fr_auto]">
                          <input type="date" value={a.data} onChange={(e) => atualizarAviso(a.chave, "data", e.target.value)} className={cn(campoBase, "h-9 [color-scheme:dark]")} />
                          <input value={a.titulo} onChange={(e) => atualizarAviso(a.chave, "titulo", e.target.value)} placeholder="Título" className={cn(campoBase, "h-9")} />
                          <input value={a.descricao} onChange={(e) => atualizarAviso(a.chave, "descricao", e.target.value)} placeholder="Descrição" className={cn(campoBase, "h-9")} />
                          <button type="button" onClick={() => removerAviso(a.chave)} className="rounded-lg p-2 text-brand-200/50 hover:bg-flame-500/15 hover:text-flame-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* A réplica impressa — some na tela, só aparece no papel/PDF. */}
          <div className="hidden print:block">
            <header className="text-center">
              <p className="text-[0.7rem] uppercase tracking-[0.2em]">Assembleia de Deus — IEADPE Betânia (PE)</p>
              {(presidente?.nome || localLider?.nome) && (
                <p className="mt-0.5 text-[0.68rem]">
                  {presidente?.nome && <>{presidente.cargo}: {presidente.tratamento ? `${presidente.tratamento} ` : ""}{presidente.nome}</>}
                  {presidente?.nome && localLider?.nome && "  ·  "}
                  {localLider?.nome && <>{localLider.cargo}: {localLider.tratamento ? `${localLider.tratamento} ` : ""}{localLider.nome}</>}
                </p>
              )}
              <h1 className="mt-2 text-[1.05rem] font-bold uppercase tracking-wide">{titulo}</h1>
            </header>

            <section className="mt-3 border border-black text-[0.6rem] leading-tight">
              <p className="border-b border-black bg-gray-200 px-1.5 py-0.5 font-semibold uppercase">Legenda dos tipos de culto</p>
              <div className="grid grid-cols-2 gap-x-2 p-1.5 sm:grid-cols-4">
                {TIPOS_CULTO.map((t) => (<p key={t.codigo}>{t.codigo}-{t.rotulo}</p>))}
              </div>
            </section>

            <section className="mt-3 grid grid-cols-2 gap-2">
              {grupos.map(([data, doDia]) => (
                <div key={data} className="break-inside-avoid border border-black text-[0.68rem]">
                  <p className="border-b border-black bg-gray-200 px-1.5 py-0.5 text-center font-semibold uppercase">
                    Dia {fmtDataLonga.format(new Date(`${data}T12:00:00`))} — <span className="capitalize">{fmtDiaSemana.format(new Date(`${data}T12:00:00`))}</span>
                  </p>
                  {doDia.map((it) => (
                    <p key={it.chave} className="border-b border-black/30 px-1.5 py-0.5 last:border-b-0">
                      <strong>{it.obreiros.map(nomeObreiro).join(" / ") || "—"}</strong> — {String(it.tipoCodigo).padStart(2, "0")} — {it.local}
                      {it.destaque && <> ({it.destaque})</>}
                    </p>
                  ))}
                </div>
              ))}
            </section>

            {avisos.length > 0 && (
              <section className="mt-3 border border-black text-[0.68rem]">
                <p className="border-b border-black bg-gray-200 px-1.5 py-0.5 font-semibold uppercase">Avisos</p>
                <div className="p-1.5">
                  {avisos.map((a) => (
                    <p key={a.chave} className="mb-1">
                      <strong>{a.titulo}</strong>{a.data && ` — ${fmtDataCurta.format(new Date(`${a.data}T12:00:00`))}`}: {a.descricao}
                    </p>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {confirmandoPublicar && dados && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-brand-950/80 p-4 backdrop-blur-sm print:hidden" onClick={() => setConfirmandoPublicar(false)}>
          <div className="glass-panel w-full max-w-sm rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-gold-300" />
              <h2 className="text-[0.94rem] font-semibold text-white">Publicar escala de {fmtMes.format(new Date(`${dados.mesAno}T12:00:00`))}?</h2>
            </div>
            <p className="text-[0.82rem] text-brand-200/70">
              Você está prestes a publicar {kpis.cultos} culto(s), em {kpis.congregacoes} congregação/local, com {kpis.obreiros} obreiro(s) escalado(s).
              A partir de agora, todo mundo com acesso às escalas vê este mês.
            </p>
            {kpis.pendencias.length > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[0.78rem] text-gold-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {kpis.pendencias.length} culto(s) ainda sem obreiro — pode publicar assim mesmo e completar depois.
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmandoPublicar(false)} disabled={publicando}>Cancelar</Button>
              <Button onClick={() => void publicar()} disabled={publicando}>
                {publicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Kpi({ rotulo, valor, alerta }: { rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className="glass-panel rounded-xl px-3 py-2.5">
      <p className="text-[0.66rem] uppercase tracking-[0.08em] text-brand-200/50">{rotulo}</p>
      <p className={cn("mt-0.5 text-[1.15rem] font-semibold tabular-nums", alerta ? "text-gold-300" : "text-white")}>{valor}</p>
    </div>
  );
}

const campoBase = cn(
  "h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3",
  "text-[0.86rem] text-brand-50 placeholder:text-brand-200/35",
  "transition-colors duration-300 focus:border-gold-400/35 focus:outline-none",
  "disabled:opacity-50",
);
