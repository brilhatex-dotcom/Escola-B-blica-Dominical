import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Etiqueta de estado.
 *
 * As variantes existem para os estados que o sistema realmente tem — inclusive
 * os tres da sincronizacao, que aparecem em toda tela de chamada. Sem nomes
 * proprios para eles, cada tela inventaria a sua propria cor de "pendente".
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.68rem] font-medium tracking-wide transition-colors",
  {
    variants: {
      variant: {
        neutro: "bg-white/8 text-brand-100/80 ring-1 ring-white/10",
        info: "bg-brand-500/20 text-brand-200 ring-1 ring-brand-400/30",
        sucesso: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25",
        alerta: "bg-gold-400/15 text-gold-200 ring-1 ring-gold-400/30",
        erro: "bg-flame-500/15 text-flame-400 ring-1 ring-flame-500/30",
      },
    },
    defaultVariants: { variant: "neutro" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
