"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { versiculoAleatorio, type Versiculo } from "@/lib/verses";

/**
 * Versiculo sorteado a cada acesso.
 *
 * O sorteio acontece dentro do `useEffect` de proposito: se fosse feito no
 * corpo do componente, servidor e cliente sorteariam textos diferentes e o
 * React acusaria hydration mismatch. Ate o efeito rodar, mostramos um
 * esqueleto com a altura ja reservada — assim o card nao "pula".
 */
export function VerseOfTheDay() {
  const [verso, setVerso] = useState<Versiculo | null>(null);

  useEffect(() => {
    setVerso(versiculoAleatorio());
  }, []);

  return (
    <div className="relative min-h-[5.6rem] w-full">
      {/* Aspas decorativas */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-1 -top-3 font-serif text-5xl leading-none text-gold-400/20"
      >
        &ldquo;
      </span>

      <AnimatePresence mode="wait">
        {verso ? (
          <motion.blockquote
            key={verso.ref}
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="px-3 text-center"
          >
            <p className="font-serif text-[0.86rem] italic leading-relaxed text-royal-100/78">
              {verso.texto}
            </p>
            <footer className="mt-2.5 flex items-center justify-center gap-2.5">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-gold-400/50" />
              <cite className="font-display text-[0.68rem] not-italic uppercase tracking-[0.2em] text-gold-300/85">
                {verso.ref}
              </cite>
              <span className="h-px w-6 bg-gradient-to-l from-transparent to-gold-400/50" />
            </footer>
          </motion.blockquote>
        ) : (
          <div className="space-y-2 px-3 pt-1" aria-hidden="true">
            <div className="h-2.5 w-full rounded-full bg-white/5" />
            <div className="h-2.5 w-[85%] mx-auto rounded-full bg-white/5" />
            <div className="mx-auto mt-3 h-2 w-20 rounded-full bg-white/5" />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
