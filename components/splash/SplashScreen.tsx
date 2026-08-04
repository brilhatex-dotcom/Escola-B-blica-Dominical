"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "gsap";
import { ChevronRight } from "lucide-react";
import { ParticleField, type ParticleFieldHandle } from "./ParticleField";
import { BrandMark } from "@/components/brand/BrandMark";
import type { DroneBackdropHandle } from "@/components/media/DroneBackdrop";
import { DRONE_DECEL_AT, DRONE_START_AT } from "@/lib/media";
import { ALLOW_SKIP_SPLASH, SPLASH_DURATION } from "@/lib/config";
import { cn } from "@/lib/utils";

/* ==========================================================================
 * Abertura cinematografica — 15 segundos, marcados um a um.
 *
 *  0,0s  preto absoluto
 *  0,6s  pequena luz dourada, pulsando devagar
 *  2,0s  a luz emite particulas (elegantes, nunca exageradas)
 *  3,0s  as particulas somem em fade; comeca o video do drone
 *  4,0s  o video ocupa a tela inteira, so com escurecimento, vinheta e contraste
 *  5,0s  "PORTAL DA / ESCOLA BIBLICA / DOMINICAL"
 *  7,0s  "IEADPE — Campo de Betania, Pernambuco"
 *  9,0s  o lema, em tres linhas
 * 11,0s  a logomarca entra discretamente, com brilho dourado
 * 13,2s  o video comeca a desacelerar enquanto a camera se aproxima
 * 15,0s  congela no melhor enquadramento da fachada -> entrega ao login
 *
 * A coreografia inteira e uma unica `gsap.timeline`, com cada beat na sua
 * posicao absoluta. Ler o `useEffect` abaixo e ler o roteiro: nenhum
 * `setTimeout` solto, e um unico ponto de verdade para pausar, acelerar,
 * depurar ou pular.
 *
 * O VIDEO NAO E RENDERIZADO AQUI. Ele vive em `app/page.tsx`, acima desta tela
 * e do login, e recebe ordens por `backdrop` — start, decelerate, freeze. Sem
 * isso, a troca para o login desmontaria o video e o congelamento "invisivel"
 * viraria um piscar bem no meio da tela.
 * ========================================================================== */

interface SplashScreenProps {
  onFinish: () => void;
  backdrop: RefObject<DroneBackdropHandle | null>;
  /** Avisa a pagina quando o video deve entrar em cena (segundo 3). */
  onVideoIn: () => void;
}

export function SplashScreen({ onFinish, backdrop, onVideoIn }: SplashScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sparkRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const orgRef = useRef<HTMLDivElement>(null);
  const motoRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const particles = useRef<ParticleFieldHandle>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [skipVisible, setSkipVisible] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: onFinish });
      timelineRef.current = tl;

      /* ---- barra de progresso discreta (0 -> 15s) ---- */
      tl.fromTo(
        progressRef.current,
        { scaleX: 0 },
        { scaleX: 1, duration: SPLASH_DURATION, ease: "none" },
        0,
      );

      /* ---- 0,6s | a luz ---- */
      tl.fromTo(
        sparkRef.current,
        { opacity: 0, scale: 0.2 },
        { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" },
        0.6,
      );

      /* ---- 2,0s | particulas ---- */
      tl.call(() => particles.current?.setPhase("emit"), undefined, 2.0);

      /* ---- 3,0s | particulas somem, entra o video ---- */
      tl.call(() => particles.current?.setPhase("disperse"), undefined, 2.9);
      tl.to(sparkRef.current, { opacity: 0, scale: 2.6, duration: 1.0, ease: "power2.inOut" }, 2.9);
      tl.call(
        () => {
          onVideoIn();
          backdrop.current?.start();
        },
        undefined,
        DRONE_START_AT,
      );

      /* ---- 5,0s | o nome do sistema ---- */
      tl.fromTo(
        titleRef.current,
        { opacity: 0, y: 26, filter: "blur(10px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.8, ease: "power3.out" },
        5.0,
      );

      /* ---- 7,0s | instituicao e campo ---- */
      tl.fromTo(
        orgRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 1.5, ease: "power3.out" },
        7.0,
      );

      /* ---- 9,0s | o lema ---- */
      tl.fromTo(
        motoRef.current,
        { opacity: 0, y: 18, filter: "blur(8px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 2.0, ease: "power3.out" },
        9.0,
      );

      /* ---- 11,0s | a logomarca, discreta ---- */
      tl.fromTo(
        markRef.current,
        { opacity: 0, y: 10, filter: "blur(8px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.8, ease: "power3.out" },
        11.0,
      );

      /* ---- 13,2s | a camera se aproxima e o video desacelera ---- */
      tl.call(() => backdrop.current?.decelerate(), undefined, DRONE_DECEL_AT);

      /* ---- 15,0s | congela no melhor quadro ----
         Todo o texto continua visivel: quem sai de cena e a barra de progresso
         e o botao de pular. O card de login entra por cima do quadro parado. */
      tl.call(() => backdrop.current?.freeze(), undefined, SPLASH_DURATION - 0.05);
      tl.to(progressRef.current, { opacity: 0, duration: 0.5 }, SPLASH_DURATION - 0.6);

      // Trava exata dos 15s: sem isso a duracao viraria "a soma do que couber".
      tl.set({}, {}, SPLASH_DURATION);

      // Quem pediu menos movimento recebe a mesma narrativa, so que rapida.
      if (reduced) tl.timeScale(4);
    }, rootRef);

    const skipTimer = window.setTimeout(() => setSkipVisible(true), 3200);

    return () => {
      window.clearTimeout(skipTimer);
      ctx.revert();
    };
  }, [onFinish, backdrop, onVideoIn]);

  /** Pular: acelera a linha do tempo em vez de cortar seco. */
  const handleSkip = () => {
    const tl = timelineRef.current;
    if (!tl) return onFinish();
    if (tl.time() > SPLASH_DURATION - 1.2) return;
    gsap.to(tl, { timeScale: 12, duration: 0.5, ease: "power2.in" });
  };

  return (
    <div ref={rootRef} className="fixed inset-0 z-30 overflow-hidden" role="presentation">
      {/* Ponto de luz inicial — o unico elemento antes do video */}
      <div
        ref={sparkRef}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0"
        aria-hidden="true"
      >
        <div className="animate-soft-pulse relative h-3 w-3">
          <span className="absolute inset-0 rounded-full bg-gold-100" />
          <span className="absolute -inset-6 rounded-full bg-gold-300/35 blur-xl" />
          <span className="absolute -inset-16 rounded-full bg-gold-400/20 blur-3xl" />
          <span className="absolute -inset-32 rounded-full bg-gold-500/10 blur-[70px]" />
        </div>
      </div>

      {/* Particulas: so os segundos 2 a 3, discretas */}
      <ParticleField ref={particles} className="absolute inset-0 h-full w-full" />

      {/* Conteudo sobre o video */}
      <div className="relative flex h-full w-full flex-col items-center justify-center px-6 text-center">
        {/* ---- Nome do sistema ---- */}
        <div ref={titleRef} className="opacity-0">
          <p className="font-display text-[clamp(0.62rem,1.7vw,0.95rem)] uppercase tracking-[0.52em] text-gold-300/90">
            Portal da
          </p>
          <h1 className="mt-3 font-display text-[clamp(1.5rem,5.4vw,3.4rem)] font-semibold uppercase leading-[1.18] tracking-[0.13em] text-white drop-shadow-[0_4px_24px_rgba(2,7,19,0.9)]">
            Escola Bíblica
            <br />
            Dominical
          </h1>
          <div className="mx-auto mt-5 h-px w-48 bg-gradient-to-r from-transparent via-gold-400/75 to-transparent" />
        </div>

        {/* ---- Instituicao ---- */}
        <div ref={orgRef} className="mt-6 opacity-0">
          <p className="font-display text-[clamp(0.78rem,2.1vw,1.15rem)] uppercase tracking-[0.32em] text-gold-gradient">
            IEADPE
          </p>
          <p className="mt-2 font-serif text-[clamp(0.9rem,2.4vw,1.25rem)] italic text-brand-50/85">
            Campo de Betânia — Pernambuco
          </p>
        </div>

        {/* ---- Lema ---- */}
        <div ref={motoRef} className="mt-10 opacity-0">
          <p className="font-serif text-[clamp(0.92rem,2.5vw,1.4rem)] leading-relaxed text-balance text-white/92 drop-shadow-[0_2px_18px_rgba(2,7,19,0.95)]">
            Ensinando a Palavra.
            <br />
            Formando discípulos.
            <br />
            Transformando vidas.
          </p>
        </div>

        {/* ---- Logomarca, discreta ---- */}
        <div ref={markRef} className="mt-11 opacity-0">
          <div className="relative flex aspect-[100/137] w-[clamp(4.5rem,11vw,6rem)] items-center justify-center">
            <div className="relative w-full">
              {/* Brilho dourado — desenhado ATRAS, sem tocar nos pixels da arte */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 scale-[1.6] rounded-full opacity-90 blur-2xl"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(212,175,55,0.42) 0%, rgba(212,175,55,0.14) 55%, transparent 78%)",
                }}
              />
              <BrandMark plate priority sizes="96px" />
            </div>
          </div>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/5">
        <div
          ref={progressRef}
          className="h-full origin-left bg-gradient-to-r from-gold-600/0 via-gold-400/80 to-gold-200"
          style={{ transform: "scaleX(0)" }}
        />
      </div>

      {/* Pular abertura (cortesia de UX — ver lib/config.ts) */}
      {ALLOW_SKIP_SPLASH && (
        <button
          type="button"
          onClick={handleSkip}
          className={cn(
            "group absolute bottom-7 right-7 z-10 flex items-center gap-2 rounded-full border border-white/10",
            "bg-white/5 px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] text-brand-50/70 backdrop-blur-md",
            "transition-all duration-500 hover:border-gold-400/40 hover:text-gold-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60",
            skipVisible ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          Pular
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}
