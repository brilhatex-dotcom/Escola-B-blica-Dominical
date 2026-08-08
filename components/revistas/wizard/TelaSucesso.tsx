"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, FilePlus2, Printer, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * A tela de sucesso — o fim de um caminho que começou em "Para qual
 * congregação...?". O número do pedido é o `PedidoRevista.id` de verdade
 * (nunca inventado), formatado como recibo.
 */
export function TelaSucesso({
  pedidoId,
  congId,
  congNome,
  trimestreChave,
  trimestreRotulo,
  revistas,
  total,
  aoNovoPedido,
}: {
  pedidoId: number | null;
  congId: number;
  congNome: string;
  trimestreChave: string;
  trimestreRotulo: string;
  revistas: number;
  total: number;
  aoNovoPedido: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel mx-auto max-w-lg rounded-2xl p-8 text-center"
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
        <CheckCircle2 className="h-7 w-7 text-emerald-300" />
      </span>
      <h2 className="mt-4 font-display text-[1.2rem] font-semibold text-white">Pedido realizado com sucesso!</h2>
      {pedidoId !== null && (
        <p className="mt-1 text-[0.8rem] tabular-nums text-brand-200/55">Número do pedido: #{String(pedidoId).padStart(6, "0")}</p>
      )}

      <dl className="mt-6 space-y-2.5 text-left text-[0.86rem]">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-2.5">
          <dt className="text-brand-200/55">Congregação</dt>
          <dd className="truncate text-brand-50">{congNome}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-2.5">
          <dt className="text-brand-200/55">Trimestre</dt>
          <dd className="text-brand-50">{trimestreRotulo}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-2.5">
          <dt className="text-brand-200/55">Quantidade</dt>
          <dd className="tabular-nums text-brand-50">{revistas} revista(s)</dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-2.5">
          <dt className="text-brand-200/55">Valor</dt>
          <dd className="font-display text-[1.05rem] font-semibold tabular-nums text-gold-200">{dinheiro.format(total)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-brand-200/55">Status</dt>
          <dd>
            <Badge variant="sucesso">Pedido confirmado</Badge>
          </dd>
        </div>
      </dl>

      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Button asChild variant="ghost">
          <Link href={`/dashboard/revistas/pedido/${congId}?trimestre=${trimestreChave}`}>
            <ReceiptText className="h-4 w-4" />
            Ver Pedido
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/dashboard/revistas/pedido/${congId}?trimestre=${trimestreChave}&imprimir=1`}>
            <Printer className="h-4 w-4" />
            Imprimir Pedido
          </Link>
        </Button>
        <Button onClick={aoNovoPedido}>
          <FilePlus2 className="h-4 w-4" />
          Novo Pedido
        </Button>
      </div>
    </motion.div>
  );
}
