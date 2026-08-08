"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { chaveItem, type LinhaPedido } from "./tipos";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const ROTULO_TIPO: Record<"aluno" | "professor", string> = {
  aluno: "Revista do Aluno",
  professor: "Revista do Professor",
};

/**
 * Uma categoria (ex.: "Adultos"), com uma linha por tipo (aluno/professor)
 * que tem preço cadastrado — dois tipos por card em vez de vinte cards
 * soltos, para a tela caber numa olhada sem virar uma lista sem fim.
 *
 * Os botões [+]/[−] somam e sobem de 1 em 1; o número no meio também aceita
 * digitação direta — nunca só um dos dois jeitos.
 */
export function CartaoCategoria({
  categoriaRotulo,
  linhas,
  valores,
  aoMudar,
  somenteLeitura,
}: {
  categoriaRotulo: string;
  linhas: LinhaPedido[];
  valores: Record<string, string>;
  aoMudar: (chave: string, valor: string) => void;
  somenteLeitura?: boolean;
}) {
  const subtotalCategoria = linhas.reduce((s, l) => {
    if (l.precoUnitario === null) return s;
    const q = Number(valores[chaveItem(l.categoria, l.tipo)] || 0);
    return s + (Number.isFinite(q) ? q * l.precoUnitario : 0);
  }, 0);

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <header className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
        <h3 className="font-display text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-white">
          {categoriaRotulo}
        </h3>
        {subtotalCategoria > 0 && (
          <span className="text-[0.82rem] font-semibold tabular-nums text-gold-200">{dinheiro.format(subtotalCategoria)}</span>
        )}
      </header>
      <div className="divide-y divide-white/6">
        {linhas.map((l) => (
          <LinhaCartao
            key={chaveItem(l.categoria, l.tipo)}
            linha={l}
            valor={valores[chaveItem(l.categoria, l.tipo)] ?? ""}
            aoMudar={(v) => aoMudar(chaveItem(l.categoria, l.tipo), v)}
            somenteLeitura={somenteLeitura}
          />
        ))}
      </div>
    </div>
  );
}

function LinhaCartao({
  linha,
  valor,
  aoMudar,
  somenteLeitura,
}: {
  linha: LinhaPedido;
  valor: string;
  aoMudar: (v: string) => void;
  somenteLeitura?: boolean;
}) {
  const semPreco = linha.precoUnitario === null;
  const quantidade = Number(valor) || 0;
  const subtotal = semPreco ? 0 : quantidade * linha.precoUnitario!;

  function ajustar(delta: number) {
    aoMudar(String(Math.max(0, quantidade + delta)));
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3 px-4 py-3.5", semPreco && "opacity-50")}>
      <div className="min-w-0 flex-1">
        <p className="text-[0.86rem] text-brand-50">{ROTULO_TIPO[linha.tipo]}</p>
        <p className="mt-0.5 text-[0.72rem] text-brand-200/50">
          {semPreco ? (
            "sem preço cadastrado"
          ) : (
            <>
              {dinheiro.format(linha.precoUnitario!)} / unidade
              {linha.sugestao > 0 && <span className="text-brand-200/40"> · cadastrados: {linha.sugestao}</span>}
            </>
          )}
        </p>
      </div>

      {!semPreco && (
        <>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => ajustar(-1)}
              disabled={somenteLeitura || quantidade === 0}
              aria-label="Diminuir quantidade"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-brand-100/80 transition-colors duration-300 hover:border-gold-400/30 hover:text-gold-200 disabled:pointer-events-none disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              inputMode="numeric"
              value={valor}
              onChange={(e) => aoMudar(e.target.value.replace(/[^0-9]/g, ""))}
              disabled={somenteLeitura}
              placeholder="0"
              aria-label={`Quantidade de ${ROTULO_TIPO[linha.tipo]} — ${linha.categoriaRotulo}`}
              className="h-10 w-14 rounded-xl border border-white/10 bg-white/[0.06] text-center text-[0.94rem] font-semibold tabular-nums text-brand-50 focus:outline-none focus:border-gold-400/40 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => ajustar(1)}
              disabled={somenteLeitura}
              aria-label="Aumentar quantidade"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-brand-100/80 transition-colors duration-300 hover:border-gold-400/30 hover:text-gold-200 disabled:pointer-events-none disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <span className="w-20 shrink-0 text-right text-[0.86rem] font-semibold tabular-nums text-white">
            {subtotal > 0 ? dinheiro.format(subtotal) : "—"}
          </span>
        </>
      )}
    </div>
  );
}
