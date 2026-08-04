import * as React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Tipo = "info" | "sucesso" | "alerta" | "erro";

const estilos: Record<Tipo, { caixa: string; icone: string }> = {
  info: { caixa: "border-brand-400/30 bg-brand-500/10", icone: "text-brand-200" },
  sucesso: { caixa: "border-emerald-400/30 bg-emerald-500/10", icone: "text-emerald-300" },
  alerta: { caixa: "border-gold-400/30 bg-gold-400/10", icone: "text-gold-200" },
  erro: { caixa: "border-flame-500/35 bg-flame-500/10", icone: "text-flame-400" },
};

const icones: Record<Tipo, typeof Info> = {
  info: Info,
  sucesso: CheckCircle2,
  alerta: TriangleAlert,
  erro: AlertCircle,
};

/**
 * Aviso em linha.
 *
 * `role="alert"` so nos tipos que exigem atencao imediata: leitores de tela
 * interrompem a leitura ao encontrar um, e fazer isso por um aviso informativo
 * e desrespeitoso com quem depende deles.
 */
export function Alert({
  tipo = "info",
  titulo,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & { tipo?: Tipo; titulo?: string }) {
  const Icone = icones[tipo];
  const urgente = tipo === "erro" || tipo === "alerta";

  return (
    <div
      role={urgente ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-[0.82rem]",
        estilos[tipo].caixa,
        className,
      )}
      {...props}
    >
      <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", estilos[tipo].icone)} />
      <div className="min-w-0 flex-1">
        {titulo && <p className="mb-0.5 font-medium text-white">{titulo}</p>}
        <div className="text-brand-100/80">{children}</div>
      </div>
    </div>
  );
}
