"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, HelpCircle, LogOut, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { iniciais } from "@/lib/dashboard/formato";
import type { Usuario } from "@/lib/dashboard/tipos";

/**
 * Identificacao e menu do usuario.
 *
 * A foto e opcional e quase sempre ausente — o cadastro herdado da planilha nao
 * tem fotos. Por isso o padrao sao as INICIAIS, e nao um boneco cinza generico:
 * as iniciais identificam a pessoa, o boneco so ocupa espaco.
 */

export interface UserMenuProps {
  usuario: Usuario;
  className?: string;
}

const ITENS = [
  { chave: "perfil", rotulo: "Meu perfil", icone: UserRound },
  { chave: "config", rotulo: "Configurações", icone: Settings },
  { chave: "ajuda", rotulo: "Ajuda", icone: HelpCircle },
] as const;

export function UserMenu({ usuario, className }: UserMenuProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    const aoClicar = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };

    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={caixa} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={cn(
          "flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-1.5 transition-colors duration-300 sm:pr-2.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
          aberto ? "bg-white/8" : "hover:bg-white/5",
        )}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-gold-400/25">
          {usuario.foto ? (
            <Image src={usuario.foto} alt="" fill sizes="36px" className="object-cover" />
          ) : (
            <span className="font-display text-[0.72rem] font-semibold tracking-wider text-gold-100">
              {iniciais(usuario.nome)}
            </span>
          )}
        </span>

        {/* Nome e cargo somem no celular: o header nao tem largura para os dois */}
        <span className="hidden min-w-0 text-left md:block">
          <span className="block truncate text-[0.8rem] font-medium leading-tight text-brand-50">
            {usuario.nome}
          </span>
          <span className="block truncate text-[0.68rem] leading-tight text-brand-200/55">
            {usuario.cargo}
          </span>
        </span>

        <ChevronDown
          className={cn(
            "hidden h-3.5 w-3.5 shrink-0 text-brand-300/60 transition-transform duration-300 sm:block",
            aberto && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel absolute right-0 top-[calc(100%+0.6rem)] z-50 w-60 origin-top-right overflow-hidden rounded-2xl p-1.5"
          >
            <div className="border-b border-white/8 px-3 pb-2.5 pt-2">
              <p className="truncate text-[0.84rem] font-medium text-white">{usuario.nome}</p>
              <p className="truncate text-[0.72rem] text-gold-200/75">{usuario.cargo}</p>
              <p className="mt-0.5 truncate text-[0.7rem] text-brand-200/50">
                {usuario.congregacao}
              </p>
            </div>

            <ul className="py-1">
              {ITENS.map(({ chave, rotulo, icone: Icone }) => (
                <li key={chave}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setAberto(false)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[0.82rem] text-brand-100/85 transition-colors duration-200 hover:bg-white/6 hover:text-white"
                  >
                    <Icone className="h-4 w-4 shrink-0 text-brand-300/70" />
                    {rotulo}
                  </button>
                </li>
              ))}
            </ul>

            <div className="border-t border-white/8 pt-1">
              <button
                type="button"
                role="menuitem"
                /*
                 * Sair volta para a raiz, que e a abertura + login.
                 *
                 * `replace` e nao `push`: com `push`, o botao "voltar" do
                 * navegador levaria de volta ao painel de quem acabou de sair —
                 * e num celular emprestado isso e um problema de verdade.
                 *
                 * A limpeza da sessao entra junto com a autenticacao real; o
                 * banco local NAO deve ser apagado aqui sem antes checar a
                 * fila, ou uma chamada ainda nao enviada iria embora.
                 */
                onClick={async () => {
                  setAberto(false);
                  // Encerra a sessao no SERVIDOR antes de navegar. Sem isto o
                  // cookie continuaria valido: bastaria digitar /dashboard para
                  // voltar, e "Sair" seria so uma troca de tela.
                  await fetch("/api/auth/sair", { method: "POST" }).catch(() => {});
                  router.replace("/");
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[0.82rem] text-flame-400/90 transition-colors duration-200 hover:bg-flame-500/10 hover:text-flame-400"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sair do sistema
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
