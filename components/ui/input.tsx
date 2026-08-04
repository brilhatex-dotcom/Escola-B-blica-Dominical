"use client";

import * as React from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Campo de texto do sistema.
 *
 * E a versao generica do campo que nasceu na tela de login: rotulo flutuante,
 * icone interno, brilho no foco e mensagem de erro. O rotulo flutua em vez de
 * virar placeholder de proposito — placeholder some quando a pessoa comeca a
 * digitar, e num formulario de cadastro isso deixa o usuario sem saber qual
 * campo esta preenchendo.
 */
export interface InputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  icon?: LucideIcon;
  error?: string;
  /** Acrescenta o botao de mostrar/ocultar. */
  revealable?: boolean;
  /** Texto de apoio abaixo do campo, quando nao ha erro. */
  hint?: string;
}

export function Input({
  label,
  value,
  onChange,
  icon: Icon,
  error,
  revealable = false,
  hint,
  className,
  id,
  type = "text",
  disabled,
  ...props
}: InputProps) {
  const reactId = React.useId();
  const fieldId = id ?? reactId;
  const [focused, setFocused] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);

  const flutuando = focused || value.length > 0;
  const tipo = revealable ? (revealed ? "text" : "password") : type;
  const auxId = error ? `${fieldId}-erro` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "group relative rounded-xl border bg-brand-950/40 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          disabled && "opacity-55",
          error
            ? "border-flame-400/70 shadow-[0_0_0_1px_rgba(214,40,40,0.35)]"
            : focused
              ? "border-brand-300/70 shadow-[0_0_0_1px_rgba(138,165,208,0.55),0_0_26px_-2px_rgba(45,83,145,0.75)]"
              : "border-white/12 hover:border-white/25",
        )}
      >
        {Icon && (
          <Icon
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute left-4 top-1/2 h-[1.05rem] w-[1.05rem] -translate-y-1/2 transition-all duration-400",
              error
                ? "text-flame-400"
                : focused
                  ? "scale-110 text-brand-200"
                  : "text-brand-200/45",
            )}
          />
        )}

        <label
          htmlFor={fieldId}
          className={cn(
            "pointer-events-none absolute origin-left transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]",
            Icon ? "left-11" : "left-4",
            flutuando
              ? "top-[0.44rem] text-[0.62rem] uppercase tracking-[0.16em] text-brand-200/65"
              : "top-1/2 -translate-y-1/2 text-[0.9rem] text-brand-200/50",
          )}
        >
          {label}
        </label>

        <input
          id={fieldId}
          type={tipo}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={Boolean(error)}
          aria-describedby={auxId}
          className={cn(
            "relative h-[3.4rem] w-full rounded-xl bg-transparent pt-4 text-[0.95rem] text-white outline-none",
            "short:h-[3.05rem] short:pt-3.5",
            Icon ? "pl-11" : "pl-4",
            revealable ? "pr-12" : "pr-4",
          )}
          {...props}
        />

        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            tabIndex={-1}
            aria-label={revealed ? "Ocultar" : "Mostrar"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-brand-200/45 transition-all duration-300 hover:bg-white/5 hover:text-gold-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>

      {error ? (
        <p id={`${fieldId}-erro`} role="alert" className="pl-1 pt-1.5 text-[0.74rem] text-flame-400/95">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="pl-1 pt-1.5 text-[0.74rem] text-brand-200/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
