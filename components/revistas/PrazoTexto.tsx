import { cn } from "@/lib/utils";
import type { NivelPrazo } from "@/lib/revistas/situacao";

/**
 * "Prazo de pagamento: 11/10/2026 — 65 dias restantes", na mesma cor nas
 * três telas que mostram um prazo (painel, assistente de trimestre, revisão
 * do pedido) — verde/amarelo/vermelho, a mesma escala de `nivelDoPrazo`.
 */

const COR_NIVEL: Record<NivelPrazo, { texto: string; ponto: string }> = {
  tranquilo: { texto: "text-emerald-300", ponto: "bg-emerald-400" },
  atencao: { texto: "text-gold-200", ponto: "bg-gold-400" },
  urgente: { texto: "text-flame-400", ponto: "bg-flame-500" },
  vencido: { texto: "text-flame-400", ponto: "bg-flame-500" },
};

export function textoDosDias(dias: number, nivel: NivelPrazo): string {
  if (nivel === "vencido") return `vencido há ${Math.abs(dias)} dia(s)`;
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `${dias} dias restantes`;
}

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function PrazoTexto({
  rotulo,
  data,
  dias,
  nivel,
  className,
}: {
  rotulo: string;
  data: string;
  dias: number;
  nivel: NivelPrazo;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", COR_NIVEL[nivel].ponto)} />
      <p className="text-[0.8rem] text-brand-100/80">
        {rotulo}: <strong className="text-brand-50">{fmtData.format(new Date(`${data}T12:00:00`))}</strong>
        {" — "}
        <span className={COR_NIVEL[nivel].texto}>{textoDosDias(dias, nivel)}</span>
      </p>
    </div>
  );
}
