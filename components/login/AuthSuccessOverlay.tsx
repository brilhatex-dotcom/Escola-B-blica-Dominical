"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ParticleField, type ParticleFieldHandle } from "@/components/splash/ParticleField";
import { BrandMark } from "@/components/brand/BrandMark";

/**
 * Selo de entrada.
 *
 * Depois que a autenticacao volta OK: a tela escurece, a logomarca reaparece
 * com uma pequena animacao de particulas e so entao o Dashboard assume.
 * E o mesmo campo de particulas da splash, reaproveitado — a abertura e a
 * entrada no sistema conversam visualmente em vez de parecerem dois produtos.
 */
export function AuthSuccessOverlay({
  nome,
  onDone,
}: {
  nome?: string;
  onDone?: () => void;
}) {
  const particles = useRef<ParticleFieldHandle>(null);

  useEffect(() => {
    // Sem swirl: aqui as particulas ja nascem se organizando. A entrada precisa
    // ser breve — ninguem quer 15s de novo toda vez que faz login.
    const t1 = window.setTimeout(() => particles.current?.setPhase("form"), 60);
    const t2 = window.setTimeout(() => particles.current?.setPhase("hold"), 1500);
    const t3 = window.setTimeout(() => particles.current?.setPhase("disperse"), 2300);
    const t4 = window.setTimeout(() => onDone?.(), 3000);
    return () => [t1, t2, t3, t4].forEach(window.clearTimeout);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#020713]/96 backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <ParticleField ref={particles} className="absolute inset-0 h-full w-full" scale={0.26} offsetY={-0.05} />

      <div className="relative flex flex-col items-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
          className="relative w-[min(22vh,170px)]"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 scale-150 rounded-full opacity-80 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(212,175,55,0.32) 0%, rgba(22,58,112,0.26) 55%, transparent 78%)",
            }}
          />
          <BrandMark plate priority sizes="170px" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 1.0 }}
          className="mt-8 font-display text-[0.78rem] uppercase tracking-[0.34em] text-gold-gradient"
        >
          Bem-vindo{nome ? `, ${nome}` : ""}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.5 }}
          className="mt-3 font-serif text-sm italic text-brand-200/60"
        >
          Preparando o seu painel…
        </motion.p>
      </div>
    </motion.div>
  );
}
