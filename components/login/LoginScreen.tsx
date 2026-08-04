"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoginCard } from "./LoginCard";
import { AuthSuccessOverlay } from "./AuthSuccessOverlay";
import { SPLASH_TO_LOGIN_MS } from "@/lib/config";

/**
 * Tela de login.
 *
 * Nao renderiza fundo proprio: o quadro congelado do video do drone ja esta em
 * cena, montado em `app/page.tsx`, e continua ali. Este componente so entrega o
 * card por cima dele.
 *
 * O scroll fica travado no `body` — as duas telas do portal sao viewport-fixed.
 * Em telas muito baixas, como celular deitado, o proprio container rola, para o
 * botao Entrar nunca ficar inalcancavel.
 */
export function LoginScreen() {
  const [autenticado, setAutenticado] = useState<string | null>(null);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        // Entra no mesmo ritmo do congelamento do video: 900ms, sem corte.
        duration: SPLASH_TO_LOGIN_MS / 1000,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative z-20 h-screen-safe w-full overflow-hidden"
    >
      {/* Halo de ambiente atras do card, para descolar do fundo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle, rgba(22,58,112,0.42) 0%, rgba(212,175,55,0.07) 44%, transparent 68%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative z-10 flex h-full w-full items-center justify-center overflow-y-auto overscroll-contain px-4 py-8 sm:px-6 short:py-3 shorter:py-2">
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
               * A spec pediu apenas a experiencia inicial, entao a navegacao
               * fica comentada de proposito — apontar para uma rota
               * inexistente daria 404 logo depois de uma animacao bonita.
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
