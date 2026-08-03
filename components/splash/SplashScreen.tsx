"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ChevronRight } from "lucide-react";
import { ParticleField, type ParticleFieldHandle } from "./ParticleField";
import { AmbientVideo } from "@/components/media/AmbientVideo";
import { BrandMark } from "@/components/brand/BrandMark";
import { markSvgDataUri } from "@/lib/brand-mark";
import { ALLOW_SKIP_SPLASH, SPLASH_DURATION } from "@/lib/config";
import { cn } from "@/lib/utils";

/* ==========================================================================
 * Abertura cinematografica — 15 segundos, marcados um a um.
 *
 *  0.0s  preto absoluto
 *  0.5s  ponto de luz dourada, pulsando devagar
 *  1.0s  a luz solta particulas; elas giram (sensacao celestial)
 *  2.0s  as particulas comecam a formar o emblema
 *  4.0s  emblema formado; brilho dourado varre da esquerda para a direita
 *  5.0s  "ASSEMBLEIA DE DEUS EM PERNAMBUCO" em fade
 *  7.0s  "Campo de Betânia" em fade elegante
 *  9.0s  leve zoom de camera + video desfocado ao fundo
 * 11.0s  "Ensinando a Palavra. / Transformando vidas."
 * 13.0s  brilho dourado toma a tela; particulas se desfazem
 * 15.0s  fade para preto -> entrega o controle para o login
 *
 * A linha do tempo inteira e uma unica `gsap.timeline`, com cada beat na sua
 * posicao absoluta. Ler o `useEffect` abaixo e ler o roteiro: nenhum
 * `setTimeout` solto, e um unico ponto de verdade para pausar, acelerar,
 * depurar ou pular.
 * ========================================================================== */

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sparkRef = useRef<HTMLDivElement>(null);
  /** Caixa que ancora luz + particulas + emblema no mesmo ponto. */
  const markBoxRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const orgRef = useRef<HTMLDivElement>(null);
  const fieldNameRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const blackoutRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const particles = useRef<ParticleFieldHandle>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [skipVisible, setSkipVisible] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: onFinish,
      });
      timelineRef.current = tl;

      /* ---- barra de progresso discreta (0 -> 15s) ---- */
      tl.fromTo(
        progressRef.current,
        { scaleX: 0 },
        { scaleX: 1, duration: SPLASH_DURATION, ease: "none" },
        0,
      );

      /* ---- 0.5s | a luz ---- */
      tl.fromTo(
        sparkRef.current,
        { opacity: 0, scale: 0.2 },
        { opacity: 1, scale: 1, duration: 1.1, ease: "power2.out" },
        0.5,
      );

      /* ---- 1.0s | particulas nascem e giram ---- */
      tl.call(() => particles.current?.setPhase("emit"), undefined, 1.0);
      tl.call(() => particles.current?.setPhase("swirl"), undefined, 1.9);

      /* ---- 2.0s | comecam a formar o emblema ---- */
      tl.call(() => particles.current?.setPhase("form"), undefined, 2.0);
      // A luz-semente se dissolve conforme as particulas assumem o desenho.
      tl.to(sparkRef.current, { opacity: 0, scale: 2.4, duration: 1.6, ease: "power2.inOut" }, 2.2);

      /* ---- 4.0s | emblema nitido + varredura dourada ---- */
      tl.call(() => particles.current?.setPhase("hold"), undefined, 3.8);
      tl.fromTo(
        markRef.current,
        { opacity: 0, scale: 0.94, filter: "blur(14px)" },
        { opacity: 1, scale: 1, filter: "blur(0px)", duration: 1.4, ease: "power3.out" },
        3.6,
      );
      // O brilho atravessa o emblema da esquerda para a direita.
      tl.fromTo(
        glareRef.current,
        { xPercent: -140, opacity: 0 },
        { xPercent: 140, opacity: 1, duration: 1.5, ease: "power2.inOut" },
        4.0,
      );
      tl.to(glareRef.current, { opacity: 0, duration: 0.3 }, 5.3);

      /* ---- 5.0s | nome da instituicao ---- */
      tl.fromTo(
        orgRef.current,
        { opacity: 0, y: 22, letterSpacing: "0.62em" },
        { opacity: 1, y: 0, letterSpacing: "0.34em", duration: 1.6, ease: "power3.out" },
        5.0,
      );

      /* ---- 7.0s | campo ---- */
      tl.fromTo(
        fieldNameRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 1.5, ease: "power3.out" },
        7.0,
      );

      /* ---- 9.0s | zoom de camera + video ao fundo ---- */
      tl.to(
        stageRef.current,
        { scale: 1.07, duration: 6, ease: "power1.inOut" },
        9.0,
      );
      tl.fromTo(
        backdropRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 2.6, ease: "power2.out" },
        9.0,
      );

      /* ---- 11.0s | frase-tema ---- */
      tl.fromTo(
        taglineRef.current,
        { opacity: 0, y: 20, filter: "blur(8px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.8, ease: "power3.out" },
        11.0,
      );

      /* ---- 13.0s | brilho dourado toma a tela, particulas se desfazem ---- */
      tl.call(() => particles.current?.setPhase("disperse"), undefined, 13.0);
      tl.fromTo(
        bloomRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1.1, ease: "power2.in" },
        13.0,
      );
      tl.to(bloomRef.current, { opacity: 0.35, duration: 0.9, ease: "power2.out" }, 14.1);

      /* ---- 15.0s | fade para preto ---- */
      tl.to(
        [markRef.current, orgRef.current, fieldNameRef.current, taglineRef.current],
        { opacity: 0, y: -10, duration: 1.0, ease: "power2.in" },
        13.9,
      );
      tl.to(blackoutRef.current, { opacity: 1, duration: 0.9, ease: "power2.inOut" }, 14.1);

      // Trava exata dos 15s: sem isso a duracao viraria "a soma do que couber".
      tl.set({}, {}, SPLASH_DURATION);

      // Quem pediu menos movimento recebe a mesma narrativa, so que rapida.
      if (reduced) tl.timeScale(4);
    }, rootRef);

    const skipTimer = window.setTimeout(() => setSkipVisible(true), 2600);

    return () => {
      window.clearTimeout(skipTimer);
      ctx.revert();
    };
  }, [onFinish]);

  /** Pular: acelera a linha do tempo em vez de cortar seco. */
  const handleSkip = () => {
    const tl = timelineRef.current;
    if (!tl) return onFinish();
    if (tl.time() > SPLASH_DURATION - 1.4) return;
    gsap.to(tl, { timeScale: 14, duration: 0.5, ease: "power2.in" });
  };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 overflow-hidden bg-black"
      role="presentation"
    >
      {/* Video ao fundo — so aparece a partir do segundo 9 */}
      <div ref={backdropRef} className="absolute inset-0 opacity-0">
        <AmbientVideo blur={34} opacity={0.42} playbackRate={0.45} scrim="deep" />
      </div>

      {/* Palco: recebe o zoom de camera */}
      <div
        ref={stageRef}
        className="absolute inset-0 flex origin-center flex-col items-center justify-center will-change-transform"
      >
        {/* Particulas: cobrem a tela toda, mas formam a figura sobre a ancora */}
        <ParticleField
          ref={particles}
          className="absolute inset-0 h-full w-full"
          anchorRef={markBoxRef}
        />

        {/* Conteudo */}
        <div className="relative flex w-full max-w-3xl flex-col items-center px-6 text-center">
          {/*
            Caixa do emblema. Serve de ancora unica para as tres camadas que
            precisam coincidir no mesmo ponto: a luz inicial, as particulas e o
            SVG nitido. Ela ja ocupa o layout desde o quadro 0 (mesmo invisivel),
            entao as particulas se formam exatamente onde o emblema vai surgir.
          */}
          <div
            ref={markBoxRef}
            className="relative mb-8 w-[min(34vh,240px)] sm:w-[min(38vh,300px)]"
          >
            {/* Ponto de luz inicial — no centro exato da caixa */}
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

            {/* Emblema nitido + varredura */}
            <div ref={markRef} className="relative opacity-0 will-change-transform">
              <BrandMark idSuffix="splash" className="drop-shadow-[0_0_38px_rgba(226,186,77,0.30)]" />

              {/* O brilho e mascarado pelo proprio desenho: varre o emblema, nao a caixa. */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div
                  ref={glareRef}
                  className="absolute inset-y-0 -inset-x-1/2 opacity-0"
                  style={{
                    maskImage: `url("${markSvgDataUri("#fff")}")`,
                    WebkitMaskImage: `url("${markSvgDataUri("#fff")}")`,
                    maskSize: "50% 100%",
                    WebkitMaskSize: "50% 100%",
                    maskPosition: "center",
                    WebkitMaskPosition: "center",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    background:
                      "linear-gradient(100deg, transparent 38%, rgba(255,247,222,0.95) 50%, transparent 62%)",
                    mixBlendMode: "screen",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Instituicao */}
          <div ref={orgRef} className="opacity-0">
            <h1 className="font-display text-[clamp(0.82rem,2.5vw,1.45rem)] font-semibold uppercase text-gold-gradient">
              Assembleia de Deus em Pernambuco
            </h1>
            <div className="mx-auto mt-4 h-px w-40 bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" />
          </div>

          {/* Campo */}
          <div ref={fieldNameRef} className="mt-5 opacity-0">
            <p className="font-serif text-[clamp(1.15rem,3.6vw,2rem)] italic text-royal-100/90">
              Campo de Betânia
            </p>
          </div>

          {/* Frase-tema */}
          <div ref={taglineRef} className="mt-12 opacity-0">
            <p className="font-serif text-[clamp(1rem,3vw,1.6rem)] leading-relaxed text-balance text-gold-100/95 drop-shadow-[0_0_26px_rgba(226,186,77,0.35)]">
              Ensinando a Palavra.
              <br />
              Transformando vidas.
            </p>
          </div>
        </div>
      </div>

      {/* Brilho dourado do segundo 13 */}
      <div
        ref={bloomRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0"
        style={{
          background:
            "radial-gradient(closest-side at 50% 42%, rgba(255,240,205,0.55) 0%, rgba(226,186,77,0.28) 40%, transparent 78%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Blackout final */}
      <div
        ref={blackoutRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black opacity-0"
      />

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
            "bg-white/5 px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] text-royal-100/70 backdrop-blur-md",
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
