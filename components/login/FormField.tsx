"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ==========================================================================
 * Campo de formulario do portal.
 *
 * Acabamento pedido na spec: icone interno, borda azul, glow ao focar e
 * animacao de foco. O rotulo flutua para cima quando o campo recebe foco ou
 * ja tem conteudo — o mesmo padrao de campo de sistemas corporativos, sem
 * placeholder que some e deixa o usuario sem contexto.
 * ========================================================================== */

interface FormFieldProps extends Omit<React.ComponentProps<"input">, "onChange"> {
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Adiciona o botao de mostrar/ocultar senha. */
  revealable?: boolean;
}

export function FormField({
  label,
  icon: Icon,
  value,
  onChange,
  error,
  revealable = false,
  className,
  id,
  type = "text",
  ...props
}: FormFieldProps) {
  const reactId = React.useId();
  const fieldId = id ?? reactId;
  const [focused, setFocused] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);

  const floating = focused || value.length > 0;
  const inputType = revealable ? (revealed ? "text" : "password") : type;

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "group relative rounded-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "border bg-royal-950/40",
          error
            ? "border-red-400/60 shadow-[0_0_0_1px_rgba(248,113,113,0.35),0_0_22px_-4px_rgba(248,113,113,0.45)]"
            : focused
              ? "border-royal-300/70 shadow-[0_0_0_1px_rgba(142,176,255,0.55),0_0_26px_-2px_rgba(53,94,244,0.55)]"
              : "border-white/12 hover:border-white/25",
        )}
      >
        {/* Brilho interno que acende no foco */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-500",
            focused ? "opacity-100" : "opacity-0",
          )}
          style={{
            background:
              "linear-gradient(100deg, rgba(53,94,244,0.14) 0%, rgba(142,176,255,0.06) 45%, transparent 75%)",
          }}
        />

        <Icon
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-4 top-1/2 h-[1.05rem] w-[1.05rem] -translate-y-1/2 transition-all duration-400",
            error
              ? "text-red-300"
              : focused
                ? "scale-110 text-royal-200"
                : "text-royal-200/45 group-hover:text-royal-200/70",
          )}
        />

        <label
          htmlFor={fieldId}
          className={cn(
            "pointer-events-none absolute left-11 origin-left transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]",
            floating
              ? "top-[0.44rem] text-[0.62rem] uppercase tracking-[0.16em] text-royal-200/65"
              : "top-1/2 -translate-y-1/2 text-[0.9rem] text-royal-200/50",
          )}
        >
          {label}
        </label>

        <input
          id={fieldId}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={cn(
            "relative h-[3.4rem] w-full rounded-xl bg-transparent pl-11 pr-12 pt-4 text-[0.95rem]",
            "text-white outline-none placeholder:text-transparent",
            "font-sans tracking-[0.01em]",
          )}
          {...props}
        />

        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            tabIndex={-1}
            aria-label={revealed ? "Ocultar senha" : "Mostrar senha"}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2",
              "text-royal-200/45 transition-all duration-300",
              "hover:bg-white/5 hover:text-gold-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
            )}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}

        {/* Fio de luz na base, cresce do centro ao focar */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-0 left-1/2 h-px -translate-x-1/2 rounded-full transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)]",
            error
              ? "w-[85%] bg-gradient-to-r from-transparent via-red-400/70 to-transparent"
              : focused
                ? "w-[85%] bg-gradient-to-r from-transparent via-royal-300/80 to-transparent"
                : "w-0 bg-transparent",
          )}
        />
      </div>

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={`${fieldId}-error`}
            role="alert"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden pl-1 pt-1.5 text-[0.74rem] text-red-300/90"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
