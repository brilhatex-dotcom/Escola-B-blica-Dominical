"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Coins, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { CabecalhoModulo, EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import { useAcesso } from "@/components/acesso/AcessoProvider";

/**
 * Editar os preços das revistas — só a administração do campo.
 *
 * ============================================================================
 * MUDAR UM PREÇO AQUI NÃO REESCREVE PEDIDO NENHUM
 *
 * `PedidoRevistaItem.precoUnitario` é gravado no momento do pedido, de
 * propósito — um pedido confirmado precisa continuar mostrando o valor que
 * foi cobrado, mesmo que a tabela mude depois (ver o comentário no schema).
 * O que se edita aqui vale a partir do PRÓXIMO pedido digitado. Corrigir um
 * trimestre já confirmado (como aconteceu na virada do preço no 4º
 * trimestre de 2026) é uma correção deliberada, feita à parte.
 * ============================================================================
 */

interface Preco {
  key: string;
  categoria: string;
  label: string;
  preco: number;
}
interface Categoria {
  chave: string;
  rotulo: string;
}
interface Dados {
  categorias: Categoria[];
  precos: Preco[];
}

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function PrecosRevistasPage() {
  const { sessao, carregando: carregandoSessao } = useAcesso();
  const souCampo = sessao?.escopo === "campo";

  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const res = await fetch("/api/revistas/precos", { cache: "no-store" });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? "Não foi possível carregar os preços.");
      setDados(corpo);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, Preco[]>();
    for (const p of dados?.precos ?? []) {
      const lista = mapa.get(p.categoria) ?? [];
      lista.push(p);
      mapa.set(p.categoria, lista);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    return mapa;
  }, [dados]);

  async function gravar(item: Preco): Promise<string | void> {
    try {
      const res = await fetch("/api/revistas/precos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) return corpo.erro ?? "Não foi possível salvar.";
      setAviso(`"${item.label}" atualizado.`);
      await carregar();
    } catch {
      return "Sem resposta do servidor. Verifique a conexão.";
    }
  }

  async function excluir(item: Preco): Promise<string | void> {
    try {
      const url = new URL("/api/revistas/precos", window.location.origin);
      url.searchParams.set("categoria", item.categoria);
      url.searchParams.set("key", item.key);
      const res = await fetch(url, { method: "DELETE" });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) return corpo.erro ?? "Não foi possível remover.";
      setAviso(`"${item.label}" removida.`);
      await carregar();
    } catch {
      return "Sem resposta do servidor. Verifique a conexão.";
    }
  }

  return (
    <>
      <Link
        href="/dashboard/revistas"
        className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] text-brand-200/60 transition-colors duration-300 hover:text-gold-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Pedidos de Lições
      </Link>

      <CabecalhoModulo
        icone={Coins}
        titulo="Preços das Revistas"
        descricao="Cada modalidade — aluno, professor, ampliada, capa dura, visual — com o preço praticado hoje."
      />

      {!carregandoSessao && !souCampo ? (
        <Alert tipo="alerta" titulo="Sem acesso a esta tela">
          Só a administração do campo edita os preços das revistas.
        </Alert>
      ) : erro ? (
        <EstadoErro mensagem={erro} />
      ) : !dados ? (
        <EsqueletoLista linhas={6} />
      ) : (
        <div className="space-y-4">
          {aviso && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-[0.82rem] text-emerald-200">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{aviso}</span>
            </div>
          )}

          {dados.categorias.map((cat) => (
            <GrupoCategoria
              key={cat.chave}
              categoria={cat}
              itens={porCategoria.get(cat.chave) ?? []}
              aoGravar={gravar}
              aoExcluir={excluir}
            />
          ))}
        </div>
      )}
    </>
  );
}

function GrupoCategoria({
  categoria,
  itens,
  aoGravar,
  aoExcluir,
}: {
  categoria: Categoria;
  itens: Preco[];
  aoGravar: (item: Preco) => Promise<string | void>;
  aoExcluir: (item: Preco) => Promise<string | void>;
}) {
  const [criando, setCriando] = useState(false);

  return (
    <section className="glass-panel overflow-hidden rounded-2xl">
      <header className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <h2 className="font-display text-[0.86rem] font-semibold uppercase tracking-[0.1em] text-white">
          {categoria.rotulo}
        </h2>
        <button
          type="button"
          onClick={() => setCriando((v) => !v)}
          className="flex items-center gap-1.5 text-[0.76rem] text-gold-200/80 transition-colors hover:text-gold-200"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova modalidade
        </button>
      </header>

      <div className="divide-y divide-white/6">
        {itens.length === 0 && !criando && (
          <p className="px-4 py-4 text-[0.8rem] italic text-brand-200/45">Nenhuma modalidade cadastrada ainda.</p>
        )}
        {itens.map((item) => (
          <LinhaPreco key={item.key} item={item} aoGravar={aoGravar} aoExcluir={aoExcluir} />
        ))}
        {criando && (
          <FormularioNovaModalidade
            categoria={categoria.chave}
            aoGravar={async (item) => {
              const problema = await aoGravar(item);
              if (!problema) setCriando(false);
              return problema;
            }}
            aoCancelar={() => setCriando(false)}
          />
        )}
      </div>
    </section>
  );
}

function LinhaPreco({
  item,
  aoGravar,
  aoExcluir,
}: {
  item: Preco;
  aoGravar: (item: Preco) => Promise<string | void>;
  aoExcluir: (item: Preco) => Promise<string | void>;
}) {
  const [valor, setValor] = useState(String(item.preco));
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  useEffect(() => setValor(String(item.preco)), [item.preco]);

  const numero = Number(valor.replace(",", "."));
  const mudou = Number.isFinite(numero) && numero !== item.preco;

  async function salvar() {
    if (!Number.isFinite(numero) || numero < 0) {
      setErro("Preço inválido.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const problema = await aoGravar({ ...item, preco: numero });
    if (problema) setErro(problema);
    setSalvando(false);
  }

  async function confirmarExclusao() {
    setExcluindo(true);
    const problema = await aoExcluir(item);
    if (problema) {
      setErro(problema);
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
    // sucesso: a linha some da lista quando o pai recarrega — nada a fazer aqui.
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.84rem] text-brand-50">{item.label}</p>
        <p className="mt-0.5 truncate text-[0.68rem] text-brand-200/40">{item.key}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-[0.78rem] text-brand-200/50">R$</span>
        <input
          inputMode="decimal"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value.replace(/[^0-9,.]/g, ""));
            setErro(null);
          }}
          className="h-9 w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-right text-[0.86rem] tabular-nums text-brand-50 focus:border-gold-400/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={!mudou || salvando}
          aria-label={`Salvar preço de ${item.label}`}
          title="Salvar"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-brand-200/60 transition-colors hover:border-gold-400/30 hover:text-gold-200 disabled:pointer-events-none disabled:opacity-30"
        >
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        </button>

        {confirmandoExclusao ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void confirmarExclusao()}
              disabled={excluindo}
              className="flex h-9 items-center rounded-lg border border-flame-500/35 bg-flame-500/10 px-2 text-[0.72rem] text-flame-300 transition-colors hover:bg-flame-500/20"
            >
              {excluindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(false)}
              disabled={excluindo}
              className="flex h-9 items-center rounded-lg px-2 text-[0.72rem] text-brand-200/55 hover:text-brand-100"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmandoExclusao(true)}
            aria-label={`Remover ${item.label}`}
            title="Remover"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-brand-200/60 transition-colors hover:border-flame-500/35 hover:text-flame-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {erro && <p className="w-full text-[0.74rem] text-flame-400">{erro}</p>}
    </div>
  );
}

function FormularioNovaModalidade({
  categoria,
  aoGravar,
  aoCancelar,
}: {
  categoria: string;
  aoGravar: (item: Preco) => Promise<string | void>;
  aoCancelar: () => void;
}) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [preco, setPreco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const chave = key.trim().toLowerCase();
    const numero = Number(preco.replace(",", "."));
    if (!/^[a-z][a-z0-9-]{1,40}$/.test(chave)) {
      setErro("A chave deve ter só letras minúsculas, números e hífen (ex.: aluno-comum).");
      return;
    }
    if (!label.trim()) {
      setErro("Informe o texto que aparece na tela.");
      return;
    }
    if (!Number.isFinite(numero) || numero < 0) {
      setErro("Informe um preço válido.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const problema = await aoGravar({ key: chave, categoria, label: label.trim(), preco: numero });
    if (problema) setErro(problema);
    setSalvando(false);
  }

  return (
    <div className="space-y-2.5 px-4 py-3.5">
      <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_7rem]">
        <label className="block">
          <span className="mb-1 block text-[0.7rem] text-brand-200/55">Chave (única)</span>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="ex.: aluno-comum"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[0.82rem] text-brand-50 focus:border-gold-400/40 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.7rem] text-brand-200/55">Texto na tela</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ex.: Revista do Aluno"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[0.82rem] text-brand-50 focus:border-gold-400/40 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.7rem] text-brand-200/55">Preço (R$)</span>
          <input
            inputMode="decimal"
            value={preco}
            onChange={(e) => setPreco(e.target.value.replace(/[^0-9,.]/g, ""))}
            placeholder="0,00"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-right text-[0.82rem] tabular-nums text-brand-50 focus:border-gold-400/40 focus:outline-none"
          />
        </label>
      </div>
      {erro && <p className="text-[0.74rem] text-flame-400">{erro}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Adicionar
        </Button>
        <Button size="sm" variant="ghost" onClick={aoCancelar} disabled={salvando} className={cn(salvando && "pointer-events-none")}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
