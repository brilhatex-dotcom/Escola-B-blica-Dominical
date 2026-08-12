"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, CalendarRange, Loader2, Pencil, Plus, Printer, Save, Trash2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CabecalhoModulo, EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { useCrud } from "@/components/crud/useCrud";
import { CampoPregadores } from "@/components/escalas/CampoPregadores";
import { TIPOS_CULTO, rotuloDoTipo } from "@/lib/escalas/tiposCulto";

/**
 * Montar (ou ler) a escala mensal de um mês.
 *
 * ============================================================================
 * A GRADE É EDITADA NA TELA E GRAVADA DE UMA VEZ SÓ
 *
 * Um mês tem mais de cem cultos. Gravar cada linha assim que é digitada
 * exigiria uma ida ao servidor por linha — o oposto de "mais rápido" — e
 * deixaria a tela num estado incerto se a conexão falhasse no meio. Em vez
 * disso a grade inteira vive em memória (`itens`) enquanto é montada, e um
 * único botão "Salvar" manda tudo de uma vez para `PATCH
 * /api/escalas-mensais/[id]`, que troca a lista antiga pela nova dentro de
 * uma transação.
 * ============================================================================
 */

interface ItemAPI {
  id: number; data: string; tipoCodigo: number; congId: number | null;
  congregacao: string | null; local: string; pregadores: string; destaque: string | null; ordem: number;
}
interface DadosEscala {
  id: number; titulo: string; mesAno: string; avisos: string; autor: string; atualizado: string; itens: ItemAPI[];
}
interface ItemLocal {
  chave: string; data: string; tipoCodigo: number; congId: number | null; local: string; pregadores: string; destaque: string;
}
interface CongregacaoOpcao { id: number; nome: string }
interface Lider { cargo: string; ordem: number; nome: string | null; tratamento: string | null }

const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const fmtDataLonga = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const fmtDiaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });

function novoItem(dataPadrao: string, tipoPadrao: number): ItemLocal {
  return {
    chave: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
    data: dataPadrao, tipoCodigo: tipoPadrao, congId: null, local: "", pregadores: "", destaque: "",
  };
}

export default function EscalaMensalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { podeGravar, escopo } = useAcesso();
  const editavel = podeGravar("escalas") && escopo === "campo";
  const { gravar } = useCrud();

  const [dados, setDados] = useState<DadosEscala | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<CongregacaoOpcao[]>([]);
  const [lideres, setLideres] = useState<Lider[]>([]);

  const [titulo, setTitulo] = useState("");
  const [avisos, setAvisos] = useState("");
  const [itens, setItens] = useState<ItemLocal[]>([]);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const [form, setForm] = useState<ItemLocal>(() => novoItem("", 2));
  const [editandoChave, setEditandoChave] = useState<string | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);
  /*
   * O `CampoPregadores` guarda sozinho se a busca está aberta. Sem remontar,
   * ela ficaria aberta (e vazia) depois de "Adicionar culto" — como se
   * ninguém tivesse clicado em nada — em vez de voltar ao botão "+
   * Adicionar pregador…". Um contador que muda a cada início de formulário
   * novo força o remonte, do mesmo jeito que `CampoDeNomes` já faz com o
   * `Seletor` a cada nome adicionado.
   */
  const [formVersao, setFormVersao] = useState(0);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch(`/api/escalas-mensais/${id}`, { cache: "no-store" });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? `HTTP ${res.status}`);
      const d = corpo as DadosEscala;
      setDados(d);
      setTitulo(d.titulo);
      setAvisos(d.avisos);
      setItens(
        d.itens.map((i) => ({
          chave: crypto.randomUUID(), data: i.data, tipoCodigo: i.tipoCodigo, congId: i.congId,
          local: i.local, pregadores: i.pregadores, destaque: i.destaque ?? "",
        })),
      );
      setForm(novoItem(d.itens[0]?.data ?? d.mesAno, 2));
      setSujo(false);
    } catch (e) {
      setErro((e as Error).message || "Não foi possível carregar a escala.");
    }
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    void fetch("/api/escalas-mensais/congregacoes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCongregacoes(d.itens ?? []))
      .catch(() => {});
    void fetch("/api/lideranca", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLideres(d.itens ?? []))
      .catch(() => {});
  }, []);

  // Aviso simples ao sair com a grade suja — não impede, só evita a surpresa
  // de perder cem lançamentos por fechar a aba sem querer.
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

  function iniciarEdicao(it: ItemLocal) {
    setForm({ ...it });
    setEditandoChave(it.chave);
    setErroForm(null);
    setFormVersao((v) => v + 1);
  }

  function cancelarEdicao() {
    setForm(novoItem(form.data, form.tipoCodigo));
    setEditandoChave(null);
    setErroForm(null);
    setFormVersao((v) => v + 1);
  }

  function remover(chave: string) {
    setItens((a) => a.filter((it) => it.chave !== chave));
    setSujo(true);
    if (editandoChave === chave) cancelarEdicao();
  }

  function confirmarItem() {
    if (!form.data) return setErroForm("Informe a data do culto.");
    if (!form.local.trim()) return setErroForm("Informe o local (congregação) do culto.");
    if (!form.pregadores.trim()) return setErroForm("Informe quem prega.");

    if (editandoChave) {
      setItens((a) => a.map((it) => (it.chave === editandoChave ? { ...form } : it)));
    } else {
      setItens((a) => [...a, { ...form }]);
    }
    setSujo(true);
    setErroForm(null);
    // Mantém data e tipo — no PDF oficial, um dia inteiro costuma repetir os
    // dois, e é o que torna lançar congregação atrás de congregação rápido.
    setForm(novoItem(form.data, form.tipoCodigo));
    setEditandoChave(null);
    setFormVersao((v) => v + 1);
  }

  function escolherCongregacao(congId: number | null) {
    const nome = congId ? congregacoes.find((c) => c.id === congId)?.nome ?? "" : form.local;
    setForm((f) => ({ ...f, congId, local: congId ? nome : f.local }));
  }

  async function salvar() {
    setSalvando(true);
    setErroSalvar(null);
    const problema = await gravar(`/api/escalas-mensais/${id}`, "PATCH", {
      titulo,
      avisos,
      itens: itens.map((it) => ({
        data: it.data, tipoCodigo: it.tipoCodigo, congId: it.congId,
        local: it.local, pregadores: it.pregadores, destaque: it.destaque || undefined,
      })),
    });
    setSalvando(false);
    if (problema) { setErroSalvar(problema); return; }
    setSujo(false);
    await carregar();
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
          descricao={dados ? `${itens.length} culto(s) lançado(s) · última gravação por ${dados.autor}` : "Carregando…"}
        >
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          {editavel && (
            <Button size="sm" onClick={() => void salvar()} disabled={salvando || !sujo}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {salvando ? "Salvando…" : sujo ? "Salvar alterações" : "Tudo salvo"}
            </Button>
          )}
        </CabecalhoModulo>
      </div>

      {erroSalvar && <Alert tipo="erro" titulo={erroSalvar} className="mb-4 print:hidden" />}

      {erro ? <EstadoErro mensagem={erro} />
      : !dados ? <EsqueletoLista linhas={6} />
      : (
        <>
          {editavel && (
            <div className="glass-panel mb-4 rounded-2xl p-4 print:hidden">
              <label className="block">
                <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Título da escala</span>
                <input
                  value={titulo}
                  onChange={(e) => { setTitulo(e.target.value); setSujo(true); }}
                  className={campoBase}
                />
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="block">
                  <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Data <span className="text-gold-300">*</span></span>
                  <input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                    className={cn(campoBase, "[color-scheme:dark]")}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Tipo de culto</span>
                  <select
                    value={form.tipoCodigo}
                    onChange={(e) => setForm((f) => ({ ...f, tipoCodigo: Number(e.target.value) }))}
                    className={cn(campoBase, "[&>option]:bg-brand-900")}
                  >
                    {TIPOS_CULTO.map((t) => (
                      <option key={t.codigo} value={t.codigo}>
                        {String(t.codigo).padStart(2, "0")} — {t.rotulo}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block sm:col-span-2 lg:col-span-2">
                  <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">
                    Congregação / local <span className="text-gold-300">*</span>
                  </span>
                  <div className="flex gap-2">
                    <select
                      value={form.congId ?? ""}
                      onChange={(e) => escolherCongregacao(e.target.value ? Number(e.target.value) : null)}
                      className={cn(campoBase, "w-auto shrink-0 [&>option]:bg-brand-900")}
                    >
                      <option value="">Outro local…</option>
                      {congregacoes.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                    <input
                      value={form.local}
                      onChange={(e) => setForm((f) => ({ ...f, local: e.target.value, congId: null }))}
                      placeholder="Nome do local"
                      className={campoBase}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Destaque (opcional)</span>
                  <input
                    value={form.destaque}
                    onChange={(e) => setForm((f) => ({ ...f, destaque: e.target.value }))}
                    placeholder="Ex.: Consagração Geral"
                    className={campoBase}
                  />
                </label>
              </div>

              <div className="mt-3">
                <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">
                  Quem prega <span className="text-gold-300">*</span>
                </span>
                <CampoPregadores
                  key={formVersao}
                  value={form.pregadores}
                  onChange={(v) => setForm((f) => ({ ...f, pregadores: v }))}
                />
              </div>

              {erroForm && <p className="mt-3 text-[0.8rem] text-flame-400" role="alert">{erroForm}</p>}

              <div className="mt-3 flex items-center gap-2">
                <Button type="button" size="sm" onClick={confirmarItem}>
                  {editandoChave ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {editandoChave ? "Salvar alteração" : "Adicionar culto"}
                </Button>
                {editandoChave && (
                  <Button type="button" size="sm" variant="ghost" onClick={cancelarEdicao}>
                    <X className="h-3.5 w-3.5" />
                    Cancelar edição
                  </Button>
                )}
              </div>

              <label className="mt-5 block border-t border-white/8 pt-4">
                <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">
                  Avisos (aparece no rodapé da escala impressa)
                </span>
                <textarea
                  rows={4}
                  value={avisos}
                  onChange={(e) => { setAvisos(e.target.value); setSujo(true); }}
                  placeholder="Ex.: grupos escalados para doutrina no Templo Matriz, versículo de encerramento…"
                  className={cn(campoBase, "h-auto py-2.5 leading-relaxed")}
                />
              </label>
            </div>
          )}

          {/* A grade em edição — some na impressão, que usa a réplica abaixo. */}
          <div className="space-y-4 print:hidden">
            {grupos.length === 0 ? (
              <div className="glass-panel rounded-2xl px-6 py-12 text-center">
                <p className="text-[0.9rem] text-brand-100/80">Nenhum culto lançado ainda.</p>
                {editavel && (
                  <p className="mx-auto mt-2 max-w-sm text-[0.78rem] text-brand-200/50">
                    Preencha o formulário acima e clique em "Adicionar culto".
                  </p>
                )}
              </div>
            ) : (
              grupos.map(([data, doDia]) => (
                <div key={data} className="glass-panel overflow-hidden rounded-2xl">
                  <div className="border-b border-white/8 bg-white/[0.03] px-4 py-2.5">
                    <p className="text-[0.82rem] font-semibold capitalize text-white">
                      {fmtDataLonga.format(new Date(`${data}T12:00:00`))}
                    </p>
                    <p className="text-[0.7rem] capitalize text-brand-200/50">{fmtDiaSemana.format(new Date(`${data}T12:00:00`))}</p>
                  </div>
                  <ul className="divide-y divide-white/6">
                    {doDia.map((it) => (
                      <li key={it.chave} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.84rem] text-brand-50">{it.pregadores}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.74rem] text-brand-200/55">
                            <Badge variant="info">{String(it.tipoCodigo).padStart(2, "0")}</Badge>
                            {rotuloDoTipo(it.tipoCodigo)} · {it.local}
                            {it.destaque && <Badge variant="alerta">{it.destaque}</Badge>}
                          </p>
                        </div>
                        {editavel && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" onClick={() => iniciarEdicao(it)} aria-label="Editar" className="rounded-lg p-1.5 text-brand-200/50 hover:bg-white/8 hover:text-brand-100">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => remover(it.chave)} aria-label="Remover" className="rounded-lg p-1.5 text-brand-200/50 hover:bg-flame-500/15 hover:text-flame-400">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
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
                {TIPOS_CULTO.map((t) => (
                  <p key={t.codigo}>{t.codigo}-{t.rotulo}</p>
                ))}
              </div>
            </section>

            <section className="mt-3 grid grid-cols-2 gap-2">
              {grupos.map(([data, doDia]) => (
                <div key={data} className="break-inside-avoid border border-black text-[0.68rem]">
                  <p className="border-b border-black bg-black px-1.5 py-0.5 text-center font-semibold uppercase text-white">
                    Dia {fmtDataLonga.format(new Date(`${data}T12:00:00`))} — <span className="capitalize">{fmtDiaSemana.format(new Date(`${data}T12:00:00`))}</span>
                  </p>
                  {doDia.map((it) => (
                    <p key={it.chave} className="border-b border-black/30 px-1.5 py-0.5 last:border-b-0">
                      <strong>{it.pregadores}</strong> — {String(it.tipoCodigo).padStart(2, "0")} — {it.local}
                      {it.destaque && <> ({it.destaque})</>}
                    </p>
                  ))}
                </div>
              ))}
            </section>

            {avisos.trim() && (
              <section className="mt-3 border border-black text-[0.68rem]">
                <p className="border-b border-black bg-gray-200 px-1.5 py-0.5 font-semibold uppercase">Avisos</p>
                <p className="whitespace-pre-wrap p-1.5">{avisos}</p>
              </section>
            )}
          </div>
        </>
      )}
    </>
  );
}

const campoBase = cn(
  "h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3",
  "text-[0.86rem] text-brand-50 placeholder:text-brand-200/35",
  "transition-colors duration-300 focus:border-gold-400/35 focus:outline-none",
  "disabled:opacity-50",
);
