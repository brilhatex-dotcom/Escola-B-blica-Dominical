"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/BrandMark";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { grupoDoItem, itemAtivo, menuVisivel, type ItemMenu } from "@/lib/dashboard/navegacao";
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
 *
 * ============================================================================
 * SEIS CATEGORIAS, E SO UMA ABERTA POR VEZ
 *
 * Sao mais de trinta destinos. Numa lista corrida, "Chamada" — o item usado
 * toda semana — ficaria a meio metro de rolagem do topo num celular, e a barra
 * inteira viraria um paredao de texto onde nada se acha.
 *
 * Por isso as secoes sanfonam, e por isso abre-se a secao da tela atual. O
 * usuario nunca precisa procurar onde ele esta: ao chegar, ja esta aberto.
 * ============================================================================
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
  const { papeis, carregando } = useAcesso();
  const ativo = itemAtivo(caminho ?? "/dashboard");
  const soIcones = recolhida && !gaveta;

  /*
   * Enquanto o acesso nao chegou, o menu aparece INTEIRO.
   *
   * O contrario — nascer curto e crescer meio segundo depois — empurraria os
   * itens para baixo justo quando o dedo ja esta descendo para tocar num deles.
   */
  const grupos = menuVisivel(carregando ? null : papeis);

  const grupoAtivo = grupoDoItem(ativo);
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(grupoAtivo ? [grupoAtivo] : []));

  // Navegar para outra secao abre a secao de destino. Sem isto, quem chega em
  // "Ranking" por um link do painel ve o menu apontando para um grupo fechado.
  useEffect(() => {
    if (!grupoAtivo) return;
    setAbertos((atual) => (atual.has(grupoAtivo) ? atual : new Set([...atual, grupoAtivo])));
  }, [grupoAtivo]);

  const alternar = (chave: string) =>
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

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

      {/* ---------------- Categorias ---------------- */}
      <div className={cn("flex-1 space-y-1 overflow-y-auto overscroll-contain p-3", soIcones && "px-2")}>
        {grupos.map((grupo) => {
          /*
           * No modo so-icones a sanfona nao cabe: um cabecalho de secao sem
           * texto e um retangulo mudo, e um grupo fechado esconderia o icone do
           * item em que a pessoa esta. Entao os itens saem todos, corridos,
           * separados por um fio.
           */
          if (soIcones) {
            return (
              <ul key={grupo.chave} className="space-y-1 border-b border-white/6 pb-1 last:border-0">
                {grupo.itens.map((item) => (
                  <li key={item.chave}>
                    <LinkDoMenu
                      item={item}
                      ativo={ativo === item.chave}
                      soIcone
                      onNavegar={onNavegar}
                    />
                  </li>
                ))}
              </ul>
            );
          }

          if (grupo.solo) {
            return (
              <ul key={grupo.chave} className="space-y-1">
                {grupo.itens.map((item) => (
                  <li key={item.chave}>
                    <LinkDoMenu item={item} ativo={ativo === item.chave} onNavegar={onNavegar} />
                  </li>
                ))}
              </ul>
            );
          }

          const aberto = abertos.has(grupo.chave);
          const Icone = grupo.icone;
          const contemAtivo = grupo.itens.some((i) => i.chave === ativo);

          return (
            <div key={grupo.chave}>
              <button
                type="button"
                onClick={() => alternar(grupo.chave)}
                aria-expanded={aberto}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors duration-300",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
                  "hover:bg-white/4",
                  contemAtivo ? "text-brand-50" : "text-brand-200/60",
                )}
              >
                <Icone
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors duration-300",
                    contemAtivo ? "text-gold-300" : "text-brand-300/60",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[0.7rem] font-semibold uppercase tracking-[0.14em]">
                  {grupo.rotulo}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-brand-300/50 transition-transform duration-300",
                    aberto && "rotate-180",
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {aberto && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden pl-2"
                  >
                    {grupo.itens.map((item) => (
                      <li key={item.chave} className="mt-0.5">
                        <LinkDoMenu
                          item={item}
                          ativo={ativo === item.chave}
                          onNavegar={onNavegar}
                        />
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

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

function LinkDoMenu({
  item,
  ativo,
  soIcone = false,
  onNavegar,
}: {
  item: ItemMenu;
  ativo: boolean;
  soIcone?: boolean;
  onNavegar?: () => void;
}) {
  const Icone = item.icone;

  return (
    <Link
      href={item.href}
      onClick={onNavegar}
      aria-current={ativo ? "page" : undefined}
      /*
       * O `title` so entra quando o rotulo esta escondido. Repetir no modo
       * aberto produziria uma tooltip do sistema em cima de um texto que ja
       * esta visivel — barulho puro.
       */
      title={soIcone ? `${item.rotulo} — ${item.descricao}` : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[0.84rem] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
        soIcone && "justify-center px-0 py-2.5",
        ativo ? "bg-white/8 text-white" : "text-brand-200/70 hover:bg-white/5 hover:text-brand-50",
      )}
    >
      {/* Fio dourado do item ativo — some no modo icone, onde nao ha borda a acompanhar */}
      {ativo && !soIcone && (
        <motion.span
          layoutId="sidebar-ativo"
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gold-400"
        />
      )}

      <Icone
        className={cn(
          "h-[1.05rem] w-[1.05rem] shrink-0 transition-colors duration-300",
          ativo ? "text-gold-300" : "text-brand-300/70 group-hover:text-gold-200",
        )}
      />

      {!soIcone && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
          {item.emBreve && (
            <span className="shrink-0 rounded-full bg-white/6 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-wider text-brand-200/50">
              em breve
            </span>
          )}
        </>
      )}
    </Link>
  );
}
