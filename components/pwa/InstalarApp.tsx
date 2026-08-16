"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { LOGO_SRC } from "@/lib/brand";

/**
 * Convite para instalar o app — aparece sozinho, pouco depois de a pessoa
 * abrir o portal, sem precisar procurar um botão escondido em menu nenhum.
 *
 * NENHUM NAVEGADOR DEIXA INSTALAR SEM UM TOQUE DA PESSOA
 *
 * Isso é regra de segurança de todo navegador (Android, iPhone, Windows,
 * Mac) — nenhum site consegue colocar um ícone na tela de alguém sem que a
 * própria pessoa confirme. O que dá para automatizar é tudo o resto: o
 * convite aparecer sozinho (sem a pessoa precisar saber que existe um menu
 * "instalar"), e restar só UM toque no Android/Chrome.
 *
 * No iPhone a Apple não abre exceção nenhuma: não existe um botão
 * "instalar" para nenhum site chamar sozinho, só o caminho manual em
 * Compartilhar → Adicionar à Tela de Início. Por isso ali o cartão mostra o
 * passo a passo em vez de um botão — é o máximo que o Safari permite.
 */

const CHAVE_DISPENSADO = "ebd:instalar-dispensado-em";
const CHAVE_INSTALADO = "ebd:instalar-concluido";
const DIAS_ATE_LEMBRAR_DE_NOVO = 14;
const ATRASO_MS = 2500;

type Modo = "android" | "ios";

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function jaEstaInstalado(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((window.navigator as unknown as { standalone?: boolean }).standalone) return true;
  return localStorage.getItem(CHAVE_INSTALADO) === "1";
}

function ehIOS(): boolean {
  const ua = window.navigator.userAgent;
  const iOSClassico = /iPhone|iPad|iPod/.test(ua);
  const iPadOSDisfarcadoDeMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSClassico || iPadOSDisfarcadoDeMac;
}

function foiDispensadoRecentemente(): boolean {
  const bruto = localStorage.getItem(CHAVE_DISPENSADO);
  if (!bruto) return false;
  const dias = (Date.now() - Number(bruto)) / 86_400_000;
  return dias < DIAS_ATE_LEMBRAR_DE_NOVO;
}

export function InstalarApp() {
  const [modo, setModo] = useState<Modo | null>(null);
  const [eventoPronto, setEventoPronto] = useState<EventoInstalacao | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (jaEstaInstalado() || foiDispensadoRecentemente()) return;

    const aoFicarInstalavel = (e: Event) => {
      e.preventDefault();
      setEventoPronto(e as EventoInstalacao);
      setModo("android");
      setTimeout(() => setVisivel(true), ATRASO_MS);
    };
    window.addEventListener("beforeinstallprompt", aoFicarInstalavel);

    const aoInstalar = () => {
      localStorage.setItem(CHAVE_INSTALADO, "1");
      setVisivel(false);
    };
    window.addEventListener("appinstalled", aoInstalar);

    // O iPhone nunca dispara "beforeinstallprompt" — o único jeito de saber
    // que vale mostrar o passo a passo é perguntar direto à plataforma.
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    if (ehIOS()) {
      temporizador = setTimeout(() => {
        setModo("ios");
        setVisivel(true);
      }, ATRASO_MS);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", aoFicarInstalavel);
      window.removeEventListener("appinstalled", aoInstalar);
      if (temporizador) clearTimeout(temporizador);
    };
  }, []);

  async function instalarAgora() {
    if (!eventoPronto) return;
    await eventoPronto.prompt();
    const escolha = await eventoPronto.userChoice;
    if (escolha.outcome === "accepted") localStorage.setItem(CHAVE_INSTALADO, "1");
    setVisivel(false);
    setEventoPronto(null);
  }

  function dispensar() {
    localStorage.setItem(CHAVE_DISPENSADO, String(Date.now()));
    setVisivel(false);
  }

  if (!modo) return null;

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-label="Instalar o aplicativo da EBD"
          className="glass-panel fixed inset-x-4 bottom-5 z-[70] mx-auto max-w-sm rounded-2xl p-4 shadow-2xl sm:inset-x-auto sm:right-5"
        >
          <button
            type="button"
            onClick={dispensar}
            aria-label="Fechar"
            className="absolute right-3 top-3 rounded-full p-1 text-brand-300/50 transition-colors duration-300 hover:text-brand-100"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- cartão fixo simples, sem pipeline do next/image */}
            <img src={LOGO_SRC} alt="" className="h-11 w-11 shrink-0 rounded-xl bg-white/5 object-contain p-1 ring-1 ring-white/10" />
            <div className="min-w-0">
              <p className="font-display text-[0.92rem] font-semibold text-white">Instale o app da EBD</p>
              <p className="mt-0.5 text-[0.78rem] leading-relaxed text-brand-100/75">
                {modo === "android"
                  ? "Fica um ícone no seu celular e abre direto, mais rápido — e continua funcionando mesmo sem internet."
                  : "Adicione à tela de início para abrir como um aplicativo, direto do seu iPhone."}
              </p>
            </div>
          </div>

          {modo === "android" ? (
            <button
              type="button"
              onClick={() => void instalarAgora()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gold-400/90 px-4 py-2.5 text-[0.84rem] font-semibold text-brand-950 transition-colors duration-300 hover:bg-gold-300"
            >
              <Download className="h-4 w-4" />
              Instalar agora
            </button>
          ) : (
            <div className="mt-3 space-y-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="flex flex-wrap items-center gap-1.5 text-[0.78rem] text-brand-100/85">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[0.7rem] font-semibold text-gold-200">1</span>
                Toque em <Share className="h-4 w-4 shrink-0 text-gold-300" /> (Compartilhar) na barra do Safari
              </p>
              <p className="flex flex-wrap items-center gap-1.5 text-[0.78rem] text-brand-100/85">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[0.7rem] font-semibold text-gold-200">2</span>
                Escolha <SquarePlus className="h-4 w-4 shrink-0 text-gold-300" /> &ldquo;Adicionar à Tela de Início&rdquo;
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
