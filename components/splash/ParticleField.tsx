"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { LOGO_MASK_SRC, LOGO_RATIO } from "@/lib/brand";

/* ==========================================================================
 * Campo de particulas da abertura.
 *
 * As particulas nascem de um ponto de luz, orbitam em espiral e depois "se
 * arrumam" ate desenharem o contorno da logomarca oficial. O truque para a formacao parecer magica
 * e nao coreografada:
 *
 *   1. a mascara de alfa da logomarca oficial e rasterizada fora de tela;
 *   2. os pixels opacos viram a nuvem de destinos;
 *   3. cada particula recebe um destino, um atraso proprio e uma curva
 *      levemente diferente — entao a figura "cristaliza" em ondas, nunca
 *      num estalo so.
 *
 * Tudo roda em canvas 2D com composicao aditiva (`lighter`), que e o que da a
 * sensacao de luz somando luz em vez de tinta sobre tinta.
 * ========================================================================== */

export type ParticlePhase =
  | "dormant" // nada em cena
  | "emit" // a luz comeca a soltar particulas
  | "swirl" // orbita celestial
  | "form" // convergem para o emblema
  | "hold" // emblema formado, respirando
  | "disperse"; // se desfazem para o fim da abertura

export interface ParticleFieldHandle {
  setPhase: (phase: ParticlePhase) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Destino no emblema. */
  tx: number;
  ty: number;
  /** Orbita durante o swirl. */
  angle: number;
  orbit: number;
  spin: number;
  size: number;
  /** 0 = livre no swirl, 1 = travada no destino. */
  bound: number;
  delay: number;
  twinkle: number;
  warm: number;
}

interface ParticleFieldProps {
  className?: string;
  /** Fracao do menor lado da viewport ocupada pelo emblema. Usado so sem ancora. */
  scale?: number;
  /** Deslocamento vertical do centro (-1..1). Usado so sem ancora. */
  offsetY?: number;
  /**
   * Elemento onde o emblema realmente sera desenhado.
   *
   * Quando informado, o campo le o rect desse elemento e forma a figura
   * exatamente ali. E o que faz a ilusao fechar: as particulas assentam em
   * cima do SVG nitido que aparece depois, e nao a alguns pixels de distancia.
   * Sem ancora, cairia num palpite de `scale`/`offsetY` que sempre erra em
   * alguma altura de tela — justo o que quebra a ilusao em celular e ultrawide.
   */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const MAX_PARTICLES = 1500;
const TAU = Math.PI * 2;

/** Ruido barato e deterministico o bastante para variar orbitas. */
function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export const ParticleField = forwardRef<ParticleFieldHandle, ParticleFieldProps>(
  function ParticleField({ className, scale = 0.34, offsetY = -0.06, anchorRef }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const phaseRef = useRef<ParticlePhase>("dormant");
    const phaseAtRef = useRef(0);

    useImperativeHandle(ref, () => ({
      setPhase(phase) {
        if (phaseRef.current === phase) return;
        phaseRef.current = phase;
        phaseAtRef.current = performance.now();
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      let width = 0;
      let height = 0;
      let cx = 0;
      let cy = 0;
      let dpr = 1;
      let markW = 0;
      let markH = 0;
      let particles: Particle[] = [];
      let targets: Array<{ x: number; y: number }> = [];
      let raf = 0;
      let disposed = false;

      /* ---------------- amostragem do emblema ---------------- */

      const sampleTargets = (img: HTMLImageElement) => {
        const off = document.createElement("canvas");
        // A grade de amostragem segue a proporcao real da marca. Amostrar num
        // quadrado esticaria a logo — e a arte oficial nao se deforma.
        const ratio = img.naturalWidth / img.naturalHeight || 1;
        const resX = 200;
        const resY = Math.max(1, Math.round(resX / ratio));
        off.width = resX;
        off.height = resY;
        const octx = off.getContext("2d", { willReadFrequently: true });
        if (!octx) return;
        octx.drawImage(img, 0, 0, resX, resY);

        const { data } = octx.getImageData(0, 0, resX, resY);
        const found: Array<{ x: number; y: number }> = [];
        const step = 2;
        for (let y = 0; y < resY; y += step) {
          for (let x = 0; x < resX; x += step) {
            const alpha = data[(y * resX + x) * 4 + 3];
            if (alpha > 130) {
              found.push({
                x: cx + (x / resX - 0.5) * markW,
                y: cy + (y / resY - 0.5) * markH,
              });
            }
          }
        }

        // Fisher-Yates: sem embaralhar, as particulas preencheriam o emblema
        // de cima para baixo em varredura, o que denuncia o truque.
        for (let i = found.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [found[i], found[j]] = [found[j], found[i]];
        }
        targets = found;
      };

      /* ---------------- criacao das particulas ---------------- */

      const build = () => {
        const count = Math.min(
          MAX_PARTICLES,
          targets.length,
          // Telas pequenas nao aguentam 1500 particulas a 60fps.
          Math.floor((width * height) / 900),
        );
        particles = new Array(count);
        for (let i = 0; i < count; i++) {
          const t = targets[i % targets.length];
          const angle = rand(0, TAU);
          const orbit = rand(Math.min(width, height) * 0.06, Math.min(width, height) * 0.42);
          particles[i] = {
            x: cx + Math.cos(angle) * 4,
            y: cy + Math.sin(angle) * 4,
            vx: 0,
            vy: 0,
            tx: t.x,
            ty: t.y,
            angle,
            orbit,
            spin: rand(0.12, 0.42) * (Math.random() < 0.22 ? -1 : 1),
            size: rand(0.7, 2.1),
            bound: 0,
            // O atraso escalonado e o que faz o emblema "cristalizar" em ondas.
            delay: rand(0, 0.55),
            twinkle: rand(0, TAU),
            warm: rand(0, 1),
          };
        }
      };

      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        // Preferimos o rect real do emblema; o palpite so entra como reserva.
        const anchor = anchorRef?.current;
        const rect = anchor?.getBoundingClientRect();
        if (rect && rect.width > 8) {
          cx = rect.left + rect.width / 2;
          cy = rect.top + rect.height / 2;
          markW = rect.width;
          markH = rect.height;
        } else {
          cx = width / 2;
          cy = height / 2 + height * offsetY;
          markW = Math.min(width, height) * scale;
          markH = markW / LOGO_RATIO;
        }

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      /* ---------------- loop ---------------- */

      let last = performance.now();

      const frame = (now: number) => {
        if (disposed) return;
        const dt = Math.min((now - last) / 1000, 1 / 30);
        last = now;

        const phase = phaseRef.current;
        const sincePhase = (now - phaseAtRef.current) / 1000;

        ctx.clearRect(0, 0, width, height);

        if (phase === "dormant") {
          raf = requestAnimationFrame(frame);
          return;
        }

        ctx.globalCompositeOperation = "lighter";

        // Quanto o campo esta "materializado" (0..1) e quanto ja se desfez.
        const emergence =
          phase === "emit" ? Math.min(sincePhase / 1.1, 1) : 1;
        const dissolve =
          phase === "disperse" ? Math.min(sincePhase / 2.0, 1) : 0;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // Alvo de "quao preso ao emblema" a particula deve estar.
          let want = 0;
          if (phase === "form") {
            want = Math.min(Math.max((sincePhase - p.delay) / 1.5, 0), 1);
            want = easeOutCubic(want);
          } else if (phase === "hold") {
            want = 1;
          } else if (phase === "disperse") {
            want = Math.max(1 - dissolve * 1.4, 0);
          }
          p.bound += (want - p.bound) * Math.min(dt * 3.4, 1);

          // --- posicao livre: espiral em torno do centro ---
          p.angle += p.spin * dt;
          const breathe = 1 + Math.sin(now / 1400 + p.twinkle) * 0.06;
          const freeX = cx + Math.cos(p.angle) * p.orbit * breathe * emergence;
          const freeY = cy + Math.sin(p.angle) * p.orbit * 0.82 * breathe * emergence;

          // --- posicao alvo: o pixel do emblema ---
          const targetX = freeX + (p.tx - freeX) * p.bound;
          const targetY = freeY + (p.ty - freeY) * p.bound;

          // Mola critica: segue o alvo sem estalar nem oscilar.
          const stiffness = phase === "form" ? 12 : 7;
          p.vx += (targetX - p.x) * stiffness * dt;
          p.vy += (targetY - p.y) * stiffness * dt;
          p.vx *= 0.86;
          p.vy *= 0.86;

          if (phase === "disperse") {
            // Sobem e abrem, como fagulha que apaga.
            p.vx += Math.cos(p.angle) * 26 * dt * dissolve;
            p.vy -= 34 * dt * dissolve;
          }

          p.x += p.vx * dt * 60 * (reduced ? 0.4 : 1);
          p.y += p.vy * dt * 60 * (reduced ? 0.4 : 1);

          // --- desenho ---
          const twinkle = 0.62 + Math.sin(now / 620 + p.twinkle) * 0.38;
          let alpha = twinkle * emergence * (1 - dissolve);
          // Particulas ja assentadas brilham um pouco mais.
          alpha *= 0.45 + p.bound * 0.55;
          if (alpha <= 0.01) continue;

          const size = p.size * (1 + p.bound * 0.45);
          // Creme luminoso -> dourado oficial (#D4AF37). A variacao evita que o
          // campo vire um borrao amarelo chapado.
          const r = Math.round(247 - p.warm * 35);
          const g = Math.round(239 - p.warm * 64);
          const b = Math.round(210 - p.warm * 155);

          ctx.beginPath();
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.arc(p.x, p.y, size, 0, TAU);
          ctx.fill();

          // Halo apenas nas maiores: halo em todas custa caro e suja a imagem.
          if (p.size > 1.6) {
            ctx.beginPath();
            ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.14})`;
            ctx.arc(p.x, p.y, size * 3.4, 0, TAU);
            ctx.fill();
          }
        }

        ctx.globalCompositeOperation = "source-over";
        raf = requestAnimationFrame(frame);
      };

      /* ---------------- boot ---------------- */

      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (disposed) return;
        resize();
        sampleTargets(img);
        build();
        last = performance.now();
        raf = requestAnimationFrame(frame);
      };
      img.src = LOGO_MASK_SRC;

      const onResize = () => {
        if (!img.complete) return;
        resize();
        sampleTargets(img);
        build();
      };
      window.addEventListener("resize", onResize, { passive: true });

      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
      };
    }, [scale, offsetY, anchorRef]);

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={className}
      />
    );
  },
);
