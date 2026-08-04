"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/BrandMark";
import { SearchBar } from "./SearchBar";
import { SystemStatus } from "./SystemStatus";
import { UserMenu } from "./UserMenu";
import type { Usuario } from "@/lib/dashboard/tipos";

/**
 * Barra superior fixa.
 *
 * Tres zonas: identidade a esquerda, busca no centro, estado e usuario a
 * direita. A ordem nao e estetica — e a ordem de leitura de quem chega: onde
 * estou, o que procuro, quem sou.
 *
 * No celular a busca sai da barra e vira uma linha propria abaixo dela. Espremer
 * campo de busca, logo, sino e avatar em 360px produz alvos de toque menores que
 * o minimo utilizavel, e o campo vira decorativo.
 */

export interface HeaderProps {
  usuario: Usuario;
  recolhida: boolean;
  onAlternarRecolhida: () => void;
  onAbrirGaveta: () => void;
  /** Quantidade de notificações não lidas; `0` esconde o marcador. */
  notificacoes?: number;
}

export function Header({
  usuario,
  recolhida,
  onAlternarRecolhida,
  onAbrirGaveta,
  notificacoes = 0,
}: HeaderProps) {
  const [buscaMovel, setBuscaMovel] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-brand-950/80 backdrop-blur-2xl">
      <div className="flex h-16 items-center gap-3 px-3 sm:px-5">
        {/* ---------------- Esquerda ---------------- */}
        <button
          type="button"
          onClick={onAbrirGaveta}
          aria-label="Abrir menu"
          className="rounded-lg p-2 text-brand-200/75 transition-colors duration-300 hover:bg-white/6 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onAlternarRecolhida}
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
          className="hidden rounded-lg p-2 text-brand-200/75 transition-colors duration-300 hover:bg-white/6 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60 lg:block"
        >
          {recolhida ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>

        {/*
          O NOME do portal fica sempre aqui; a MARCA, nao.
          Com a barra lateral aberta ela ja exibe a logomarca a poucos pixels
          daqui, e duas logomarcas lado a lado na mesma tela sao repeticao, nao
          reforco de identidade. Recolhida a barra — ou no celular, onde ela nem
          existe —, a marca volta, porque ai e a unica da tela.
        */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={cn("relative w-8 shrink-0", !recolhida && "lg:hidden")}>
            <BrandMark plate decorative sizes="32px" />
          </div>
          {/*
            NOME INTEIRO OU NOME NENHUM — nunca "PORTAL DA ESCOL…".

            Duas regras sustentam isso. `shrink-0` impede que o bloco ceda
            espaco para a busca e acabe cortado; e o texto so aparece a partir de
            `xl`, largura em que ele cabe por completo sem espremer o campo de
            busca. Abaixo disso a identidade nao se perde: a barra lateral exibe
            "EBD Betânia" e, no celular, a logomarca ao lado ja responde onde o
            usuario esta.

            A versao curta vale ate 1536px; dai para cima cabe o nome completo.
          */}
          <div className="hidden shrink-0 xl:block">
            <p className="font-display text-[0.7rem] font-semibold uppercase leading-tight tracking-[0.13em] text-white">
              <span className="2xl:hidden">Escola Bíblica Dominical</span>
              <span className="hidden 2xl:inline">Portal da Escola Bíblica Dominical</span>
            </p>
            <p className="text-[0.66rem] leading-tight text-brand-200/55">
              Campo de Betânia — PE
            </p>
          </div>
        </div>

        {/* ---------------- Centro: busca ---------------- */}
        <div className="mx-auto hidden w-full max-w-md md:block 2xl:max-w-xl">
          <SearchBar />
        </div>

        {/* ---------------- Direita ---------------- */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={() => setBuscaMovel((v) => !v)}
            aria-label="Pesquisar"
            aria-expanded={buscaMovel}
            className="rounded-lg p-2 text-brand-200/75 transition-colors duration-300 hover:bg-white/6 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60 md:hidden"
          >
            {/* O mesmo icone da SearchBar, para o gesto ser reconhecivel */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>

          <SystemStatus variante="compacto" />

          <button
            type="button"
            aria-label={
              notificacoes > 0
                ? `Notificações — ${notificacoes} não lidas`
                : "Notificações"
            }
            className="relative rounded-lg p-2 text-brand-200/75 transition-colors duration-300 hover:bg-white/6 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60"
          >
            <Bell className="h-5 w-5" />
            {notificacoes > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-flame-500 px-1 text-[0.6rem] font-semibold text-white ring-2 ring-brand-950">
                {notificacoes > 9 ? "9+" : notificacoes}
              </span>
            )}
          </button>

          <span aria-hidden="true" className="mx-0.5 hidden h-6 w-px bg-white/10 sm:block" />

          <UserMenu usuario={usuario} />
        </div>
      </div>

      {/* ---------------- Busca no celular ---------------- */}
      <AnimatePresence>
        {buscaMovel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-white/8 md:hidden"
          >
            <div className="px-3 py-2.5">
              <SearchBar />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
