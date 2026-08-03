"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { HAS_AMBIENT_VIDEO } from "@/lib/config";

/* ==========================================================================
 * Video ambiente (igreja iluminada, Biblias, louvor, adoracao).
 *
 * Nao ha nenhum arquivo de video versionado no repositorio — por peso e por
 * direito de imagem das pessoas filmadas. Entao este componente foi feito
 * para nunca depender do video existir:
 *
 *   • O fundo "catedral" em CSS abaixo SEMPRE e renderizado. Sozinho, ja
 *     entrega a atmosfera (luz de vitral, feixes, poeira em suspensao).
 *   • Se um arquivo em `sources` carregar, ele entra por cima com fade.
 *     Se nao carregar, ninguem percebe: nao ha buraco visual nem erro.
 *
 * Para ativar o video: coloque os arquivos em `public/media/` com os nomes
 * documentados em `public/media/README.md`.
 * ========================================================================== */

interface AmbientVideoProps {
  sources?: string[];
  poster?: string;
  className?: string;
  /** Blur em px aplicado ao video (a spec pede "extremamente desfocado"). */
  blur?: number;
  /** Opacidade final do video quando carregado. */
  opacity?: number;
  /** Velocidade de reproducao — a spec pede movimento lento. */
  playbackRate?: number;
  /** Tonalidade do overlay de escurecimento. */
  scrim?: "deep" | "soft";
}

const DEFAULT_SOURCES = ["/media/ambient-worship.webm", "/media/ambient-worship.mp4"];

export function AmbientVideo({
  sources = DEFAULT_SOURCES,
  poster = "/media/ambient-poster.jpg",
  className,
  blur = 26,
  opacity = 0.5,
  playbackRate = 0.55,
  scrim = "deep",
}: AmbientVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    el.playbackRate = playbackRate;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      el.pause();
      return;
    }

    // Autoplay pode ser recusado (politica de midia, economia de bateria).
    // Se for, ficamos com o fundo CSS — que ja e suficiente.
    const attempt = el.play();
    if (attempt) attempt.catch(() => setReady(false));
  }, [playbackRate]);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {/* ---------- Camada 1: catedral em CSS (sempre presente) ---------- */}
      <div className="absolute inset-0 bg-[#020713]" />

      {/* Luz alta entrando por uma janela alta a esquerda */}
      <div
        className="animate-slow-drift absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 22% -12%, rgba(212,175,55,0.30) 0%, rgba(212,175,55,0.10) 30%, transparent 62%)," +
            "radial-gradient(95% 75% at 84% 6%, rgba(138,165,208,0.28) 0%, transparent 58%)," +
            "radial-gradient(85% 70% at 50% 108%, rgba(22,58,112,0.42) 0%, transparent 62%)," +
            "radial-gradient(140% 110% at 50% 120%, rgba(11,31,69,0.92) 0%, transparent 68%)",
        }}
      />

      {/* Feixes de luz oblíquos */}
      <div
        className="absolute inset-0 opacity-70 mix-blend-screen"
        style={{
          background:
            "repeating-linear-gradient(103deg, rgba(255,240,205,0.085) 0px, rgba(255,240,205,0.085) 2px, transparent 2px, transparent 74px)",
          maskImage: "radial-gradient(70% 60% at 30% 0%, #000 0%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(70% 60% at 30% 0%, #000 0%, transparent 75%)",
          filter: "blur(3px)",
        }}
      />

      {/* Brasa quente no rodape — sugere altar/velas */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            "radial-gradient(65% 100% at 50% 128%, rgba(212,175,55,0.26) 0%, transparent 72%)",
        }}
      />

      {/* ---------- Camada 2: video, quando houver arquivo ---------- */}
      {HAS_AMBIENT_VIDEO && (
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        poster={poster}
        aria-hidden="true"
        onCanPlay={() => setReady(true)}
        onError={() => setReady(false)}
        className={cn(
          "absolute inset-0 h-full w-full scale-110 object-cover transition-opacity duration-[2200ms] ease-out",
        )}
        style={{
          filter: `blur(${blur}px) saturate(0.85) brightness(0.62)`,
          opacity: ready ? opacity : 0,
        }}
      >
        {sources.map((src) => (
          <source
            key={src}
            src={src}
            type={src.endsWith(".webm") ? "video/webm" : "video/mp4"}
          />
        ))}
      </video>
      )}

      {/* ---------- Camada 3: escurecimento + vinheta ---------- */}
      <div
        className="absolute inset-0"
        style={{
          background:
            scrim === "deep"
              ? "linear-gradient(180deg, rgba(2,7,19,0.86) 0%, rgba(4,12,29,0.74) 45%, rgba(2,7,19,0.92) 100%)"
              : "linear-gradient(180deg, rgba(2,7,19,0.62) 0%, rgba(4,12,29,0.48) 45%, rgba(2,7,19,0.76) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 92% at 50% 45%, transparent 40%, rgba(2,7,19,0.66) 100%)",
        }}
      />

      {/* Grao de filme — tira o aspecto "gradiente de CSS" */}
      <div
        className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
