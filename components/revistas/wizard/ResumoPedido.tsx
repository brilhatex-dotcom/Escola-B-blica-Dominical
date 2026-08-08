"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export interface ItemResumo {
  rotulo: string;
  quantidade: number;
}

/**
 * O resumo do pedido em andamento — painel fixo no desktop, barra fixa no
 * celular. As duas leem os MESMOS números; o celular só não repete a lista
 * de itens, porque uma coluna de texto empilhada em cima do teclado é a
 * definição de "atrapalha mais do que ajuda".
 */
export function ResumoPedido({
  congNome,
  trimestreRotulo,
  itens,
  totalRevistas,
  total,
  textoBotao,
  aoContinuar,
  desabilitado,
  carregando,
}: {
  congNome: string;
  trimestreRotulo: string;
  itens: ItemResumo[];
  totalRevistas: number;
  total: number;
  textoBotao: string;
  aoContinuar: () => void;
  desabilitado?: boolean;
  carregando?: boolean;
}) {
  return (
    <>
      {/* Desktop / tablet largo — painel lateral sticky */}
      <aside className="hidden shrink-0 lg:sticky lg:top-[5.5rem] lg:block lg:h-fit lg:w-[19rem]">
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="font-display text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-gold-300">
            Resumo do pedido
          </h3>

          <dl className="mt-3 space-y-2 text-[0.82rem]">
            <div>
              <dt className="text-brand-200/50">Congregação</dt>
              <dd className="truncate text-brand-50">{congNome}</dd>
            </div>
            <div>
              <dt className="text-brand-200/50">Trimestre</dt>
              <dd className="text-brand-50">{trimestreRotulo}</dd>
            </div>
          </dl>

          {itens.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-white/8 pt-3 text-[0.78rem]">
              {itens.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-brand-100/80">
                  <span className="truncate">{it.rotulo}</span>
                  <span className="shrink-0 tabular-nums text-brand-50">{it.quantidade}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3 text-[0.78rem] text-brand-200/55">
            <span>Total de revistas</span>
            <span className="tabular-nums text-brand-50">{totalRevistas}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[0.8rem] uppercase tracking-wide text-brand-200/55">Total</span>
            <span className="font-display text-[1.35rem] font-semibold tabular-nums text-gold-200">
              {dinheiro.format(total)}
            </span>
          </div>

          <Button className="mt-4 w-full" onClick={aoContinuar} disabled={desabilitado || carregando}>
            {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
            {textoBotao}
          </Button>
        </div>
      </aside>

      {/* Celular / tablet estreito — barra fixa no rodapé */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-brand-950/95 px-4 py-3 backdrop-blur-2xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.7rem] text-brand-200/55">
              {totalRevistas} {totalRevistas === 1 ? "revista" : "revistas"}
            </p>
            <p className="font-display text-[1.1rem] font-semibold tabular-nums text-gold-200">{dinheiro.format(total)}</p>
          </div>
          <Button onClick={aoContinuar} disabled={desabilitado || carregando} className="shrink-0">
            {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
            {textoBotao}
          </Button>
        </div>
      </div>
      {/* Reserva o espaço que a barra fixa ocupa, para o último card não ficar escondido atrás dela. */}
      <div className={cn("h-24 lg:hidden")} aria-hidden="true" />
    </>
  );
}
