import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Superficie padrao do sistema.
 *
 * `glass` e o vidro fosco usado sobre foto ou video — o card de login e o
 * exemplo. `solido` e para conteudo sobre fundo chapado, onde o vidro nao tem
 * o que refratar e so deixaria o texto menos legivel.
 */
type Tom = "glass" | "solido";

const tons: Record<Tom, string> = {
  glass: "glass-panel",
  solido:
    "border border-white/10 bg-brand-900/60 shadow-[0_18px_50px_-24px_rgba(2,7,19,0.9)]",
};

export function Card({
  className,
  tom = "solido",
  ...props
}: React.ComponentProps<"div"> & { tom?: Tom }) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl", tons[tom], className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "font-display text-[0.95rem] font-semibold uppercase tracking-[0.14em] text-white",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-[0.82rem] text-brand-200/70", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 border-t border-white/8 p-5 py-3", className)}
      {...props}
    />
  );
}
