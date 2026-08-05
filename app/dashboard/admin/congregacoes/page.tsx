"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Check, Loader2, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  CabecalhoModulo, EsqueletoLista, EstadoErro,
} from "@/components/dashboard/PaginaModulo";

/**
 * Cadastro das congregações.
 *
 * ============================================================================
 * A TELA MOSTRA O QUE DEPENDE DE CADA CONGREGAÇÃO ANTES DE DEIXAR MEXER NELA
 *
 * Classes, alunos, cargos e chamadas aparecem na própria linha. Não é
 * enfeite: é a informação que falta para entender por que esta tela corrige o
 * nome e não apaga a congregação. "Cong. Carnaubinha — 4 classes, 21 alunos,
 * 312 chamadas" responde sozinho o que uma mensagem de erro depois do clique
 * teria de explicar.
 * ============================================================================
 */

interface Cong {
  id: number; nome: string; classes: number; alunos: number;
  alunosAtivos: number; cargos: number; chamadas: number;
}

const num = new Intl.NumberFormat("pt-BR");

export default function AdminCongregacoesPage() {
  const [itens, setItens] = useState<Cong[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  async function carregar() {
    try {
      const res = await fetch("/api/admin/congregacoes", { cache: "no-store" });
      if (!res.ok) throw Object.assign(new Error(), { status: res.status });
      setItens((await res.json()).itens);
    } catch (e) {
      const status = (e as { status?: number }).status;
      setErro(
        status === 403
          ? "O seu acesso não permite ver o cadastro das congregações."
          : "Não foi possível carregar as congregações.",
      );
    }
  }

  useEffect(() => { void carregar(); }, []);

  async function gravar(id: number) {
    const nome = rascunho.trim();
    if (!nome) return;
    setSalvando(true);
    setRecado(null);
    try {
      const res = await fetch("/api/admin/congregacoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, nome }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível gravar.");

      setItens((atual) => atual?.map((c) => (c.id === id ? { ...c, nome } : c)) ?? null);
      setEditando(null);
      setRecado(corpo.mudou ? `Nome gravado: ${nome}.` : "O nome já era esse — nada mudou.");
    } catch (e) {
      setRecado((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <CabecalhoModulo
        icone={Building2}
        titulo="Congregações"
        descricao="Cadastro das congregações do campo"
        total={itens?.length ?? null}
      />

      <Alert tipo="info" titulo="Esta tela corrige o nome — só isso">
        O número da congregação é a chave que liga classes, alunos, chamadas e cargos.
        Criar ou apagar aqui deixaria todo esse histórico órfão, então abrir e fechar
        congregação continua sendo decisão do campo, feita fora do portal.
      </Alert>

      {recado && (
        <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[0.8rem] text-brand-100/85">
          {recado}
        </p>
      )}

      <div className="mt-4">
        {erro ? <EstadoErro mensagem={erro} />
        : !itens ? <EsqueletoLista linhas={8} />
        : (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel divide-y divide-white/6 rounded-2xl"
          >
            {itens.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <span className="w-8 shrink-0 text-[0.72rem] tabular-nums text-brand-300/50">
                  #{c.id}
                </span>

                {editando === c.id ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      autoFocus
                      value={rascunho}
                      onChange={(e) => setRascunho(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void gravar(c.id);
                        if (e.key === "Escape") setEditando(null);
                      }}
                      maxLength={80}
                      className="min-w-0 flex-1 rounded-lg border border-gold-400/35 bg-white/[0.06] px-3 py-1.5 text-[0.88rem] text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void gravar(c.id)}
                      disabled={salvando}
                      aria-label="Gravar"
                      className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-1.5 text-emerald-300 transition-colors hover:bg-emerald-400/20 disabled:opacity-50"
                    >
                      {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditando(null)}
                      aria-label="Cancelar"
                      className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-brand-200/70 transition-colors hover:bg-white/8"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="min-w-0 flex-1 font-display text-[0.92rem] font-semibold text-white">
                      {c.nome || <span className="text-brand-300/50">sem nome</span>}
                    </h3>
                    <button
                      type="button"
                      onClick={() => { setEditando(c.id); setRascunho(c.nome); setRecado(null); }}
                      aria-label={`Corrigir o nome de ${c.nome}`}
                      className="order-last rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-brand-200/60 transition-colors hover:border-gold-400/30 hover:text-gold-200 sm:order-none"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Badge variant="neutro">{c.classes} classe{c.classes === 1 ? "" : "s"}</Badge>
                  <Badge variant={c.alunosAtivos > 0 ? "sucesso" : "neutro"}>
                    {c.alunosAtivos} ativo{c.alunosAtivos === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="neutro">{c.cargos} cargo{c.cargos === 1 ? "" : "s"}</Badge>
                  <span className="text-[0.72rem] tabular-nums text-brand-300/45">
                    {num.format(c.chamadas)} chamadas
                  </span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </>
  );
}
