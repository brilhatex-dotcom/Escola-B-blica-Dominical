"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AmbientVideo } from "@/components/media/AmbientVideo";
import { LoginCard } from "./LoginCard";
import { AuthSuccessOverlay } from "./AuthSuccessOverlay";

/**
 * Tela de login.
 *
 * Video em tela cheia ao fundo (escurecido, com leve blur, lento, em loop) e o
 * card de vidro centralizado por cima. O scroll fica travado no `body`: as duas
 * telas do portal sao viewport-fixed. Em telas muito baixas — celular deitado —
 * o proprio container rola, para o botao Entrar nunca ficar inalcancavel.
 */
export function LoginScreen() {
  const [autenticado, setAutenticado] = useState<string | null>(null);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative h-screen-safe w-full overflow-hidden bg-[#01040c]"
    >
      {/*
        Aqui o scrim e o "soft": o card de vidro ja escurece o miolo da tela por
        conta propria, entao somar o scrim pesado apagaria a luz de vitral e o
        fundo viraria um retangulo preto sem leitura nenhuma.
      */}
      <AmbientVideo blur={18} opacity={0.55} playbackRate={0.5} scrim="soft" />

      {/* Brilhos de ambiente atras do card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle, rgba(31,62,226,0.16) 0%, rgba(212,163,44,0.06) 42%, transparent 68%)",
          filter: "blur(40px)",
        }}
      />

      {/* Conteudo */}
      <div className="relative z-10 flex h-full w-full items-center justify-center overflow-y-auto overscroll-contain px-4 py-8 sm:px-6">
        <LoginCard onAuthenticated={(u) => setAutenticado(u)} />
      </div>

      <AnimatePresence>
        {autenticado && (
          <AuthSuccessOverlay
            nome={autenticado}
            onDone={() => {
              /* ----------------------------------------------------------
               * Aqui entra o Dashboard.
               *
               * A spec pediu apenas estas duas telas, entao a navegacao fica
               * comentada de proposito — apontar para uma rota inexistente
               * daria 404 logo depois de uma animacao bonita.
               *
               * Quando o painel existir:
               *   const router = useRouter();   // next/navigation
               *   router.replace("/dashboard");
               * ---------------------------------------------------------- */
            }}
          />
        )}
      </AnimatePresence>
    </motion.main>
  );
}
