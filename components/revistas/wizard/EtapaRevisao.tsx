"use client";

import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrazoTexto } from "@/components/revistas/PrazoTexto";
import type { DadosPedido, Prazo } from "./tipos";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Etapa 4 — a última chance de conferir antes de travar quantidade e preço.
 * Só os itens com quantidade > 0 aparecem aqui: uma revisão de vinte linhas
 * zeradas não revisa nada, só cansa o olho antes da parte que importa.
 */
export function EtapaRevisao({
  congNome,
  dados,
  valores,
  prazoPagamento,
  aoVoltar,
  aoConfirmar,
  confirmando,
  erro,
}: {
  congNome: string;
  dados: DadosPedido;
  valores: Record<string, string>;
  prazoPagamento: { data: string; prazo: Prazo };
  aoVoltar: () => void;
  aoConfirmar: () => void;
  confirmando: boolean;
  erro: string | null;
}) {
  const itens = dados.linhas
    .map((l) => ({ ...l, quantidade: Number(valores[`${l.categoria}|${l.tipo}`] || 0) }))
    .filter((l) => l.quantidade > 0);
  const total = itens.reduce((s, l) => s + l.quantidade * (l.precoUnitario ?? 0), 0);
  const totalRevistas = itens.reduce((s, l) => s + l.quantidade, 0);

  return (
    <div>
      <h2 className="mb-1 font-display text-[1.05rem] font-semibold text-white">Revise seu pedido</h2>
      <p className="mb-4 text-[0.82rem] text-brand-200/55">
        Depois de confirmado, a quantidade e o preço ficam travados neste valor — conferir agora evita
        pedir de novo.
      </p>

      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="grid gap-4 border-b border-white/8 p-5 sm:grid-cols-2">
          <div>
            <p className="text-[0.66rem] uppercase tracking-[0.12em] text-brand-200/45">Congregação</p>
            <p className="mt-0.5 font-display text-[1rem] font-semibold text-white">{congNome}</p>
          </div>
          <div>
            <p className="text-[0.66rem] uppercase tracking-[0.12em] text-brand-200/45">Trimestre</p>
            <p className="mt-0.5 font-display text-[1rem] font-semibold text-white">{dados.trimestre.rotulo}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1 text-[0.66rem] uppercase tracking-[0.12em] text-brand-200/45">Prazo de pagamento</p>
            <PrazoTexto rotulo="Vence em" data={prazoPagamento.data} dias={prazoPagamento.prazo.dias} nivel={prazoPagamento.prazo.nivel} />
          </div>
        </div>

        {itens.length === 0 ? (
          <p className="p-5 text-[0.84rem] text-brand-200/55">Nenhuma quantidade informada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left">
              <thead>
                <tr className="text-[0.64rem] uppercase tracking-[0.12em] text-brand-200/45">
                  <th className="px-5 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 text-right font-medium">Preço</th>
                  <th className="px-3 py-2 text-right font-medium">Quantidade</th>
                  <th className="px-5 py-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {itens.map((l) => (
                  <tr key={`${l.categoria}|${l.tipo}`}>
                    <td className="px-5 py-2 text-[0.84rem] text-brand-50">
                      {l.categoriaRotulo} — {l.rotulo}
                    </td>
                    <td className="px-3 py-2 text-right text-[0.8rem] tabular-nums text-brand-200/60">
                      {dinheiro.format(l.precoUnitario ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right text-[0.84rem] font-medium tabular-nums text-brand-50">{l.quantidade}</td>
                    <td className="px-5 py-2 text-right text-[0.86rem] font-semibold tabular-nums text-gold-200">
                      {dinheiro.format(l.quantidade * (l.precoUnitario ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10">
                  <td className="px-5 py-3 text-[0.76rem] uppercase tracking-wide text-brand-200/50">Total</td>
                  <td />
                  <td className="px-3 py-3 text-right text-[0.8rem] tabular-nums text-brand-200/60">{totalRevistas} revista(s)</td>
                  <td className="px-5 py-3 text-right text-[1rem] font-semibold tabular-nums text-white">{dinheiro.format(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {erro && <p className="mt-3 text-[0.82rem] text-flame-400">{erro}</p>}

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Button variant="ghost" onClick={aoVoltar} disabled={confirmando}>
          <ArrowLeft className="h-4 w-4" />
          Voltar e editar
        </Button>
        <Button onClick={aoConfirmar} disabled={confirmando || itens.length === 0}>
          {confirmando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirmar Pedido
        </Button>
      </div>
    </div>
  );
}
