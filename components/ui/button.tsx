"use client";

import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl",
    "font-medium transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-990",
    "disabled:pointer-events-none disabled:opacity-55",
    /*
     * `isolate` faz o botao criar o proprio contexto de empilhamento, e e o que
     * permite as camadas decorativas usarem z-index negativo: elas ficam ACIMA
     * do fundo do botao e ABAIXO do texto, sem escapar para tras dos elementos
     * em volta.
     *
     * Isso substitui o antigo `<span>` que envolvia o conteudo so para
     * carregar um `z-10`. Aquele span era o que quebrava o `asChild`: o Slot do
     * Radix exige UM filho, e o span deixava o elemento do chamador enterrado
     * dentro dele em vez de virar o proprio botao.
     */
    "select-none overflow-hidden isolate",
  ],
  {
    variants: {
      variant: {
        /**
         * Acao principal do portal: azul institucional em repouso, dourado no
         * hover. A troca acontece por uma camada sobreposta (opacidade), nao por
         * `background` animado — gradiente nao interpola bem entre estados.
         */
        primary: [
          "bg-gradient-to-b from-brand-500 to-brand-700 text-white",
          "shadow-[0_10px_30px_-8px_rgba(22,58,112,0.75),inset_0_1px_0_0_rgba(255,255,255,0.22)]",
          "hover:shadow-[0_14px_38px_-8px_rgba(212,175,55,0.55),inset_0_1px_0_0_rgba(255,255,255,0.3)]",
          "hover:text-brand-950 active:scale-[0.985]",
        ],
        ghost:
          "text-brand-200/80 hover:text-gold-200 hover:bg-white/5 rounded-lg",
        link: "text-brand-200/75 hover:text-gold-200 underline-offset-4 hover:underline rounded-md",
      },
      size: {
        default: "h-11 px-5 text-sm",
        lg: "h-[3.35rem] px-7 text-[0.95rem] tracking-[0.14em] uppercase short:h-[2.95rem]",
        sm: "h-9 px-3 text-xs",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, asChild = false, children, ...props }, ref) {
    const Comp = asChild ? Slot : "button";
    const isPrimary = variant === "primary" || variant == null;

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), "group", className)}
        {...props}
      >
        {isPrimary && (
          <>
            {/* Camada dourada que sobe no hover */}
            <span
              aria-hidden="true"
              className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-b from-gold-300 via-gold-400 to-gold-600 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
            {/* Reflexo que atravessa o botao no hover */}
            <span
              aria-hidden="true"
              className="absolute inset-y-0 -left-full -z-10 w-1/2 skew-x-[-18deg] bg-white/25 blur-md transition-all duration-700 group-hover:left-[140%]"
            />
          </>
        )}

        {/*
          `Slottable` marca QUAL destes filhos e o conteudo de verdade. Sem ele,
          o Slot ve tres filhos (duas camadas decorativas e o conteudo) e falha
          com "Expected a single React element child" — que era exatamente o
          erro ao usar `<Button asChild><Link/></Button>`.
        */}
        {asChild ? <Slottable>{children}</Slottable> : children}
      </Comp>
    );
  },
);
