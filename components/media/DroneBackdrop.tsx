"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import {
  DRONE_POSTER,
  DRONE_SOURCES,
  DRONE_DECEL_SECONDS,
  DRONE_FINAL_RATE,
} from "@/lib/media";

/* ==========================================================================
 * Video oficial da igreja, gravado por drone.
 *
 * Este componente vive ACIMA da splash e do login, em `app/page.tsx`, e nao
 * desmonta na troca entre as duas telas. Essa e a peca central do efeito que a
 * spec pede: "o congelamento deve ser imperceptivel; o usuario deve acreditar
 * que ainda e uma imagem viva".
 *
 * Se o video fosse remontado no login — ou trocado por um <img> do poster —
 * haveria um piscar no ponto exato em que o usuario esta olhando. Mantendo o
 * MESMO elemento pausado no ultimo quadro, nao existe troca nenhuma: e
 * literalmente o mesmo pixel que ja estava na tela.
 *
 * O clipe foi cortado para terminar exatamente no melhor enquadramento da
 * fachada (ver lib/media.ts), entao "pausar no fim" e "congelar no quadro
 * certo" sao a mesma coisa.
 * ========================================================================== */

export type BackdropPhase =
  | "hidden" // antes do segundo 3: a abertura ainda esta no preto
  | "cinema" // video em cena, nitido, so com escurecimento e vinheta
  | "frozen"; // congelado e desfocado, servindo de fundo para o login

export interface DroneBackdropHandle {
  /** Comeca a reproducao (segundo 3 da abertura). */
  start: () => void;
  /** Rampa suave de velocidade ate quase zero — o "desacelera" do segundo 15. */
  decelerate: () => void;
  /** Trava no ultimo quadro. Idempotente. */
  freeze: () => void;
}

interface DroneBackdropProps {
  phase: BackdropPhase;
  className?: string;
}

export const DroneBackdrop = forwardRef<DroneBackdropHandle, DroneBackdropProps>(
  function DroneBackdrop({ phase, className }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const rateTween = useRef<gsap.core.Tween | null>(null);
    const [failed, setFailed] = useState(false);

    useImperativeHandle(ref, () => ({
      start() {
        const el = videoRef.current;
        if (!el) return;

        // Quem pediu menos movimento recebe direto o quadro final: a mensagem
        // e a mesma, sem 11 segundos de camera se mexendo.
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          this.freeze();
          return;
        }

        el.playbackRate = 1;
        // Autoplay pode ser recusado (economia de bateria, data saver). Nesse
        // caso o poster ja esta na tela e a abertura segue sem buraco visual.
        el.play().catch(() => setFailed(true));
      },

      /*
       * Desacelera de forma ADAPTATIVA, para pousar no ultimo quadro exatamente
       * quando a janela acabar.
       *
       * A versao ingenua — rampa fixa de 1,0 ate 0,1 — assume que o video
       * comecou no milissegundo previsto. Ele nunca comeca: `play()` tem
       * latencia de decodificacao (medi ~1s em headless), e ela varia com o
       * aparelho e a rede. O efeito colateral aparece na tela: o clipe termina
       * antes da hora e a imagem fica parada uns instantes antes do congelamento
       * "oficial" — justo o contrario do que a spec pede, que e a camera ainda
       * se aproximando ate o fim.
       *
       * Aqui a conta e feita no momento da chamada, com o que realmente falta:
       *
       *   conteudo restante = duracao - tempo atual
       *   com rampa LINEAR de r0 a r1, o consumo e T * (r0 + r1) / 2
       *   logo:  r0 = 2 * restante / T - r1
       *
       * Se o video estiver adiantado, r0 sai menor e ele desacelera mais; se
       * estiver atrasado, sai maior e ele recupera. Em qualquer caso chega ao
       * fim junto com a janela. A ease e linear de proposito: qualquer outra
       * curva quebraria a media que sustenta a formula.
       */
      decelerate() {
        const el = videoRef.current;
        if (!el || el.paused || !Number.isFinite(el.duration)) return;

        const restante = el.duration - el.currentTime;
        if (restante <= 0.02) return;

        const T = DRONE_DECEL_SECONDS;
        const r1 = DRONE_FINAL_RATE;
        // Clamp: acima de 2x a aproximacao viraria um solavanco; abaixo de 0,05
        // o navegador trata como pausa.
        const r0 = Math.min(2, Math.max(0.05, (2 * restante) / T - r1));

        rateTween.current?.kill();
        el.playbackRate = r0;
        rateTween.current = gsap.to(el, {
          playbackRate: r1,
          duration: T,
          ease: "none",
        });
      },

      freeze() {
        const el = videoRef.current;
        if (!el) return;
        rateTween.current?.kill();
        el.pause();
        // A rampa deixa o video a fracoes de segundo do fim; este ajuste
        // garante o quadro exato. O salto e sub-quadro, entao nao aparece.
        if (Number.isFinite(el.duration) && el.duration > 0) {
          el.currentTime = el.duration;
        }
      },
    }));

    useEffect(() => {
      const el = videoRef.current;
      if (!el) return;

      // Se o video acabar sozinho, o ultimo quadro ja fica em tela — so
      // garantimos que nao volte ao inicio.
      const onEnded = () => {
        el.pause();
        if (Number.isFinite(el.duration)) el.currentTime = el.duration;
      };
      el.addEventListener("ended", onEnded);

      /*
       * Aquecimento do decodificador.
       *
       * Nos primeiros 3 segundos a tela esta preta e o video nao aparece — e
       * exatamente por isso da para pagar aqui o custo do primeiro quadro. Um
       * `play()` seguido de `pause()` imediato forca o navegador a montar o
       * pipeline e decodificar o quadro inicial. Sem isso, o `start()` do
       * segundo 3 gasta um tempo variavel so para acordar, e a abertura entra
       * atrasada num ponto em que ninguem tem margem para esperar.
       */
      let cancelado = false;
      const aquecer = () => {
        if (cancelado) return;
        el.play()
          .then(() => {
            el.pause();
            el.currentTime = 0;
          })
          .catch(() => {
            /* autoplay recusado: o poster cobre a tela e a abertura segue */
          });
      };
      if (el.readyState >= 2) aquecer();
      else el.addEventListener("loadeddata", aquecer, { once: true });

      return () => {
        cancelado = true;
        el.removeEventListener("ended", onEnded);
        el.removeEventListener("loadeddata", aquecer);
      };
    }, []);

    const visible = phase !== "hidden";
    const frozen = phase === "frozen";

    return (
      <div
        aria-hidden="true"
        className={cn("pointer-events-none fixed inset-0 overflow-hidden bg-brand-990", className)}
      >
        {/*
          `object-cover` e obrigatorio aqui: a spec pede tela cheia, sem barras
          e sem margens. Como o clipe e 16:9 e as telas nao sao, alguma sobra
          precisa sair — cortar as bordas e o unico caminho que nao deixa
          tarja preta.
        */}
        <video
          ref={videoRef}
          muted
          playsInline
          preload="auto"
          poster={DRONE_POSTER}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            "transition-[opacity,filter,transform] ease-[cubic-bezier(0.16,1,0.3,1)]",
            visible ? "opacity-100" : "opacity-0",
          )}
          style={{
            // O blur do congelamento entra junto com a transicao de 900ms.
            filter: `contrast(1.08) saturate(1.04) brightness(${frozen ? 0.78 : 0.88}) blur(${frozen ? 11 : 0}px)`,
            // Escala levemente maior no estado congelado: sem isso, o blur
            // deixaria as bordas do quadro transparentes.
            transform: frozen ? "scale(1.06)" : "scale(1.01)",
            transitionDuration: "900ms",
          }}
        >
          {!failed &&
            DRONE_SOURCES.map((src) => (
              <source
                key={src}
                src={src}
                type={src.endsWith(".webm") ? "video/webm" : "video/mp4"}
              />
            ))}
        </video>

        {/* Escurecimento — leve durante a abertura, mais firme sob o card */}
        <div
          className="absolute inset-0 transition-opacity duration-[900ms]"
          style={{
            background:
              "linear-gradient(180deg, rgba(2,7,19,0.62) 0%, rgba(4,12,29,0.30) 38%, rgba(2,7,19,0.72) 100%)",
            opacity: visible ? 1 : 0,
          }}
        />
        <div
          className="absolute inset-0 transition-opacity duration-[900ms]"
          style={{
            background:
              "linear-gradient(180deg, rgba(7,20,46,0.34) 0%, rgba(11,31,69,0.26) 50%, rgba(2,7,19,0.52) 100%)",
            opacity: frozen ? 1 : 0,
          }}
        />

        {/* Vinheta */}
        <div
          className="absolute inset-0 transition-opacity duration-[900ms]"
          style={{
            background:
              "radial-gradient(124% 94% at 50% 46%, transparent 38%, rgba(2,7,19,0.74) 100%)",
            opacity: visible ? 1 : 0,
          }}
        />
      </div>
    );
  },
);
