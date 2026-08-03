"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SplashScreen } from "@/components/splash/SplashScreen";
import { LoginScreen } from "@/components/login/LoginScreen";
import {
  REPLAY_SPLASH_EVERY_VISIT,
  SPLASH_SESSION_KEY,
  SPLASH_TO_LOGIN_MS,
} from "@/lib/config";

type Stage = "boot" | "splash" | "login";

/**
 * Porta de entrada do portal: abertura cinematografica e, na sequencia, login.
 *
 * A troca acontece dentro da mesma rota, de proposito. Navegar para `/login`
 * entre as duas telas causaria um flash branco e um remount no meio do fade —
 * exatamente o que a transicao de 800ms da spec quer evitar. O `AnimatePresence`
 * mantem as duas telas montadas durante o cruzamento e o resultado e continuo.
 *
 * `stage: "boot"` existe para o primeiro paint: so no cliente da para saber se
 * a splash ja foi vista nesta sessao, e decidir isso no servidor produziria
 * hydration mismatch.
 */
export default function Home() {
  const [stage, setStage] = useState<Stage>("boot");

  useEffect(() => {
    if (REPLAY_SPLASH_EVERY_VISIT) {
      setStage("splash");
      return;
    }
    const visto = window.sessionStorage.getItem(SPLASH_SESSION_KEY);
    setStage(visto ? "login" : "splash");
  }, []);

  const finalizarSplash = useCallback(() => {
    if (!REPLAY_SPLASH_EVERY_VISIT) {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    }
    setStage("login");
  }, []);

  return (
    <AnimatePresence mode="sync">
      {stage === "boot" && (
        <div key="boot" className="fixed inset-0 z-50 bg-black" aria-hidden="true" />
      )}

      {stage === "splash" && (
        <motion.div
          key="splash"
          exit={{ opacity: 0 }}
          transition={{ duration: SPLASH_TO_LOGIN_MS / 1000, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50"
        >
          <SplashScreen onFinish={finalizarSplash} />
        </motion.div>
      )}

      {stage === "login" && <LoginScreen key="login" />}
    </AnimatePresence>
  );
}
