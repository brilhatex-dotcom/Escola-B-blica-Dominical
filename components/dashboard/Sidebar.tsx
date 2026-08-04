"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/BrandMark";
import { MENU, itemAtivo } from "@/lib/dashboard/navegacao";
import { APP_VERSION } from "@/lib/config";

/**
 * Menu lateral do sistema.
 *
 * O MESMO componente serve aos dois casos: a barra fixa do desktop e a gaveta
 * do celular. A diferenca e so posicionamento, resolvida por props — duplicar
 * o menu em dois componentes garantiria que um dia eles divergissem, e o
 * usuario de celular acabaria sem o item novo.
 *
 * `recolhida` mostra so os icones. Nao e enfeite: num notebook de 1366px, a
 * barra aberta come 17rem de uma tela que a tabela de chamada ja disputa.
 */

export interface SidebarProps {
  recolhida: boolean;
  /** Renderiza como gaveta (celular/tablet), com botao de fechar. */
  gaveta?: boolean;
  onNavegar?: () => void;
  onFechar?: () => void;
  className?: string;
}

export function Sidebar({ recolhida, gaveta = false, onNavegar, onFechar, className }: SidebarProps) {
  const caminho = usePathname();
  const ativo = itemAtivo(caminho ?? "/dashboard");
  const soIcones = recolhida && !gaveta;

  return (
    <nav
      aria-label="Menu principal"
      className={cn(
        "flex h-full flex-col border-r border-white/8 bg-brand-950/70 backdrop-blur-2xl",
        className,
      )}
    >
      {/* ---------------- Topo: marca ---------------- */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-3 border-b border-white/8 px-4",
          soIcones && "justify-center px-0",
        )}
      >
        <div className="relative w-9 shrink-0">
          <BrandMark plate decorative sizes="36px" />
        </div>

        {!soIcones && (
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white">
              EBD Betânia
            </p>
            <p className="truncate text-[0.66rem] text-brand-200/55">Portal Oficial</p>
          </div>
        )}

        {gaveta && (
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar menu"
            className="rounded-lg p-2 text-brand-200/70 transition-colors duration-300 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ---------------- Itens ---------------- */}
      <ul className={cn("flex-1 space-y-1 overflow-y-auto overscroll-contain p-3", soIcones && "px-2")}>
        {MENU.map((item) => {
          const Icone = item.icone;
          const estaAtivo = ativo === item.chave;

          return (
            <li key={item.chave}>
              <Link
                href={item.href}
                onClick={onNavegar}
                aria-current={estaAtivo ? "page" : undefined}
                /*
                 * O `title` so entra quando o rotulo esta escondido. Repetir no
                 * modo aberto produziria uma tooltip do sistema em cima de um
                 * texto que ja esta visivel — barulho puro.
                 */
                title={soIcones ? `${item.rotulo} — ${item.descricao}` : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.86rem] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
                  soIcones && "justify-center px-0",
                  estaAtivo
                    ? "bg-white/8 text-white"
                    : "text-brand-200/70 hover:bg-white/5 hover:text-brand-50",
                )}
              >
                {/* Fio dourado do item ativo — some no modo icone, onde nao ha borda a acompanhar */}
                {estaAtivo && !soIcones && (
                  <motion.span
                    layoutId="sidebar-ativo"
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gold-400"
                  />
                )}

                <Icone
                  className={cn(
                    "h-[1.15rem] w-[1.15rem] shrink-0 transition-colors duration-300",
                    estaAtivo ? "text-gold-300" : "text-brand-300/70 group-hover:text-gold-200",
                  )}
                />

                {!soIcones && (
                  <>
                    <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
                    {item.emBreve && (
                      <span className="shrink-0 rounded-full bg-white/6 px-1.5 py-0.5 text-[0.58rem] uppercase tracking-wider text-brand-200/50">
                        em breve
                      </span>
                    )}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* ---------------- Rodape ---------------- */}
      {!soIcones && (
        <div className="shrink-0 border-t border-white/8 px-4 py-3">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-brand-200/35">
            Versão {APP_VERSION}
          </p>
          <p className="mt-0.5 text-[0.66rem] text-brand-200/40">IEADPE — Campo de Betânia</p>
        </div>
      )}
    </nav>
  );
}
