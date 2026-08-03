"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl",
    "font-medium transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-royal-990",
    "disabled:pointer-events-none disabled:opacity-55",
    "select-none overflow-hidden",
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
          "bg-gradient-to-b from-royal-500 to-royal-700 text-white",
          "shadow-[0_10px_30px_-8px_rgba(31,62,226,0.65),inset_0_1px_0_0_rgba(255,255,255,0.22)]",
          "hover:shadow-[0_14px_38px_-8px_rgba(212,163,44,0.6),inset_0_1px_0_0_rgba(255,255,255,0.3)]",
          "hover:text-royal-950 active:scale-[0.985]",
        ],
        ghost:
          "text-royal-200/80 hover:text-gold-200 hover:bg-white/5 rounded-lg",
        link: "text-royal-200/75 hover:text-gold-200 underline-offset-4 hover:underline rounded-md",
      },
      size: {
        default: "h-11 px-5 text-sm",
        lg: "h-[3.35rem] px-7 text-[0.95rem] tracking-[0.14em] uppercase",
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
              className="absolute inset-0 rounded-xl bg-gradient-to-b from-gold-300 via-gold-400 to-gold-600 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
            {/* Reflexo que atravessa o botao no hover */}
            <span
              aria-hidden="true"
              className="absolute inset-y-0 -left-full w-1/2 skew-x-[-18deg] bg-white/25 blur-md transition-all duration-700 group-hover:left-[140%]"
            />
          </>
        )}
        <span className="relative z-10 flex items-center gap-2.5">{children}</span>
      </Comp>
    );
  },
);
