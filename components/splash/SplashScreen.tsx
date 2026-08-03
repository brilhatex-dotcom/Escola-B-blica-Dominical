"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ChevronRight } from "lucide-react";
import { ParticleField, type ParticleFieldHandle } from "./ParticleField";
import { AmbientVideo } from "@/components/media/AmbientVideo";
import { BrandMark } from "@/components/brand/BrandMark";
import { LOGO_MASK_SRC } from "@/lib/brand";
import { ALLOW_SKIP_SPLASH, SPLASH_DURATION } from "@/lib/config";
import { cn } from "@/lib/utils";

/* ==========================================================================
 * Abertura cinematografica — 15 segundos, marcados um a um.
 *
 *  0.0s  preto absoluto
 *  0.5s  ponto de luz dourada, pulsando devagar
 *  1.0s  a luz solta particulas; elas giram (sensacao celestial)
 *  2.0s  as particulas comecam a formar a logomarca
 *  4.0s  logomarca nitida; brilho dourado varre da esquerda para a direita
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
 *
 * A logomarca oficial e o unico protagonista: os efeitos acontecem ao redor
 * dela (particulas, halo, brilho, inclinacao 3D) e nunca sobre os pixels da
 * arte. Ela nao muda de cor, nao deforma, nao gira por completo e nunca sai
 * de foco depois de formada.
 * ========================================================================== */

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sparkRef = useRef<HTMLDivElement>(null);
  /** Caixa que ancora luz + particulas + logomarca no mesmo ponto. */
  const markBoxRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  /** Camada que recebe a inclinacao 3D (parallax). */
  const tiltRef = useRef<HTMLDivElement>(null);
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

      /* ---- 2.0s | comecam a formar a logomarca ---- */
      tl.call(() => particles.current?.setPhase("form"), undefined, 2.0);
      // A luz-semente se dissolve conforme as particulas assumem o desenho.
      tl.to(sparkRef.current, { opacity: 0, scale: 2.4, duration: 1.6, ease: "power2.inOut" }, 2.2);

      /* ---- 4.0s | logomarca nitida + varredura dourada ---- */
      tl.call(() => particles.current?.setPhase("hold"), undefined, 3.8);
      tl.fromTo(
        markRef.current,
        { opacity: 0, filter: "blur(16px)" },
        { opacity: 1, filter: "blur(0px)", duration: 1.5, ease: "power3.out" },
        3.6,
      );
      // O brilho atravessa a marca da esquerda para a direita.
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

    /* ------------------------------------------------------------------
     * Parallax 3D da logomarca.
     *
     * Rotacao rigida limitada a ±5° em cada eixo, com perspectiva — da
     * volume sem deformar, sem girar por completo e sem tocar nas cores.
     * Fica fora da timeline porque responde ao ponteiro, nao ao tempo.
     *
     * `quickTo` mantem uma unica tween viva por eixo em vez de criar uma
     * nova a cada `pointermove`; sem isso, um mouse rapido enfileira
     * centenas de tweens e o movimento engasga.
     * ------------------------------------------------------------------ */
    const MAX_TILT = 5;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    let onPointerMove: ((e: PointerEvent) => void) | null = null;

    if (finePointer && !reduced && tiltRef.current) {
      const rotX = gsap.quickTo(tiltRef.current, "rotationX", { duration: 1.1, ease: "power3.out" });
      const rotY = gsap.quickTo(tiltRef.current, "rotationY", { duration: 1.1, ease: "power3.out" });

      onPointerMove = (e: PointerEvent) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        rotY(nx * MAX_TILT);
        rotX(-ny * MAX_TILT);
      };
      window.addEventListener("pointermove", onPointerMove, { passive: true });
    }

    /*
     * Respiro proprio, para a marca nao ficar inerte.
     *
     * Os eixos sao divididos de proposito: onde ha ponteiro, o respiro cuida
     * so do deslocamento vertical e deixa a rotacao inteira para o parallax.
     * Se os dois animassem rotationX/Y, brigariam pela mesma propriedade e a
     * marca tremeria. Em touch, onde nao ha ponteiro, o respiro assume tambem
     * a rotacao — e assim o volume 3D aparece no celular do mesmo jeito.
     */
    const idle = tiltRef.current
      ? gsap.to(tiltRef.current, {
          ...(finePointer ? {} : { rotationY: 3.2, rotationX: -2.2 }),
          y: -6,
          duration: 4.5,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          paused: reduced,
        })
      : null;

    return () => {
      window.clearTimeout(skipTimer);
      if (onPointerMove) window.removeEventListener("pointermove", onPointerMove);
      idle?.kill();
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
            Caixa da logomarca. Ancora unica das tres camadas que precisam
            coincidir no mesmo ponto: a luz inicial, as particulas e o bitmap
            nitido. Ela ja ocupa o layout desde o quadro 0 (mesmo invisivel),
            entao as particulas se formam exatamente onde a marca vai surgir.

            `perspective` mora aqui para o parallax 3D acontecer no filho.
          */}
          {/*
            O selo e um circulo de 137% da largura da marca, posicionado de forma
            absoluta — ou seja, transborda a caixa da logo e NAO ocupa espaco no
            fluxo. Se as margens em volta tentassem compensar esse transbordo na
            mao, cada altura de tela pediria um numero diferente (e numa tela
            baixa o selo chegava a sair pelo topo).

            Esta caixa externa resolve pela geometria: `aspect-[100/137]` reserva
            exatamente o quadrado do selo. A partir daqui, margens normais
            funcionam em qualquer viewport.
          */}
          <div className="mb-9 flex aspect-[100/137] w-[clamp(9.5rem,26vh,15.5rem)] items-center justify-center">
            <div
              ref={markBoxRef}
              className="relative w-full"
              style={{ perspective: "1200px" }}
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

            {/*
              `tiltRef` recebe SOMENTE rotacao rigida em X/Y (maximo ±5°) com
              perspectiva. E inclinacao, nao deformacao: a marca nunca gira por
              completo, nunca estica e nunca troca de cor.
            */}
            <div ref={tiltRef} className="relative will-change-transform" style={{ transformStyle: "preserve-3d" }}>
              <div ref={markRef} className="relative opacity-0 will-change-transform">
                {/* Halo por TRAS da marca — nao encosta nos pixels dela */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -z-10 scale-125 rounded-full opacity-70 blur-3xl"
                  style={{
                    background:
                      "radial-gradient(closest-side, rgba(212,175,55,0.34) 0%, rgba(22,58,112,0.22) 55%, transparent 78%)",
                  }}
                />

                <BrandMark plate priority sizes="(max-width: 640px) 60vw, 340px" />

                {/*
                  Brilho horizontal. A mascara e a propria silhueta da marca,
                  entao a luz varre o desenho e nao o retangulo em volta.
                  `screen` clareia sem repintar: as cores oficiais continuam as
                  mesmas assim que o brilho passa.
                */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div
                    ref={glareRef}
                    className="absolute inset-y-0 -inset-x-1/2 opacity-0"
                    style={{
                      maskImage: `url("${LOGO_MASK_SRC}")`,
                      WebkitMaskImage: `url("${LOGO_MASK_SRC}")`,
                      maskSize: "50% 100%",
                      WebkitMaskSize: "50% 100%",
                      maskPosition: "center",
                      WebkitMaskPosition: "center",
                      maskRepeat: "no-repeat",
                      WebkitMaskRepeat: "no-repeat",
                      background:
                        "linear-gradient(100deg, transparent 40%, rgba(255,250,232,0.80) 50%, transparent 60%)",
                      mixBlendMode: "screen",
                    }}
                  />
                </div>
              </div>
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
            <p className="font-serif text-[clamp(1.15rem,3.6vw,2rem)] italic text-brand-100/90">
              Campo de Betânia
            </p>
          </div>

          {/* Frase-tema */}
          <div ref={taglineRef} className="mt-12 opacity-0">
            <p className="font-serif text-[clamp(1rem,3vw,1.6rem)] leading-relaxed text-balance text-gold-100/95 drop-shadow-[0_0_26px_rgba(212,175,55,0.35)]">
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
            "radial-gradient(closest-side at 50% 42%, rgba(247,239,210,0.52) 0%, rgba(212,175,55,0.26) 40%, transparent 78%)",
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
            "bg-white/5 px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] text-brand-100/70 backdrop-blur-md",
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
