"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SplashScreen } from "@/components/splash/SplashScreen";
import { LoginScreen } from "@/components/login/LoginScreen";
import { TravaDeRolagem } from "@/components/system/TravaDeRolagem";
import {
  DroneBackdrop,
  type BackdropPhase,
  type DroneBackdropHandle,
} from "@/components/media/DroneBackdrop";
import {
  REPLAY_SPLASH_EVERY_VISIT,
  SPLASH_SESSION_KEY,
  SPLASH_TO_LOGIN_MS,
} from "@/lib/config";
import { aparelhoLembrado, servidorResponde } from "@/lib/offline/aparelho";

/*
 * Trava contra laço de recarga: se o painel ainda não estiver guardado neste
 * aparelho (ex.: o Service Worker novo ainda não assumiu), abrir /dashboard
 * offline cai de volta na abertura — que mandaria para o painel de novo, para
 * sempre. Uma tentativa a cada 20 s; a segunda vez cai no login, que explica.
 */
const MARCA_REDIRECIONAMENTO = "ebd:offline-redirecionou";

function redirecionouHaPouco(): boolean {
  try {
    const quando = Number(window.sessionStorage.getItem(MARCA_REDIRECIONAMENTO) ?? 0);
    return Date.now() - quando < 20_000;
  } catch {
    return false;
  }
}

function irParaPainelOffline(router: ReturnType<typeof useRouter>): void {
  try {
    window.sessionStorage.setItem(MARCA_REDIRECIONAMENTO, String(Date.now()));
  } catch {
    /* sem sessionStorage a trava não existe, mas a entrada funciona */
  }
  router.replace("/dashboard");
}

type Stage = "boot" | "splash" | "login";

/**
 * Porta de entrada do portal: abertura cinematografica e, na sequencia, login.
 *
 * O VIDEO DO DRONE FICA AQUI, e nao dentro da splash, por um motivo so: ele
 * precisa continuar em cena depois que a abertura termina. A spec pede que o
 * congelamento seja imperceptivel e que o login apareca sobre o quadro parado —
 * e isso so funciona se for literalmente o mesmo elemento de video, pausado.
 * Se ele fosse remontado (ou trocado por um <img> do poster) haveria um piscar
 * exatamente onde o usuario esta olhando.
 *
 * A troca splash -> login tambem acontece dentro da mesma rota. Navegar para
 * `/login` no meio causaria flash branco e remount justo durante o fade.
 *
 * `stage: "boot"` existe para o primeiro paint: so no cliente da para saber se
 * a abertura ja foi vista nesta sessao, e decidir isso no servidor produziria
 * hydration mismatch.
 */
export default function Home() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("boot");
  const [backdropPhase, setBackdropPhase] = useState<BackdropPhase>("hidden");
  const backdrop = useRef<DroneBackdropHandle>(null);

  useEffect(() => {
    /*
     * Aparelho lembrado e sem internet: vai direto ao painel, sem login.
     *
     * Pedir usuário e senha sem rede para conferir é inútil, e trancaria quem
     * já usa o portal justo quando o offline precisa funcionar. Ver
     * `lib/offline/aparelho.ts` — isto não é autenticação.
     *
     * "Sem internet" é testado de dois jeitos: `navigator.onLine` (modo avião)
     * de imediato, e uma sonda ao servidor em paralelo com a abertura — o
     * celular com sinal fraco diz que está online e nada passa.
     */
    const podeEntrarOffline = aparelhoLembrado() && !redirecionouHaPouco();
    if (podeEntrarOffline && !navigator.onLine) {
      irParaPainelOffline(router);
      return;
    }

    if (REPLAY_SPLASH_EVERY_VISIT) {
      setStage("splash");
    } else if (window.sessionStorage.getItem(SPLASH_SESSION_KEY)) {
      // Sem abertura: o fundo ja entra congelado, como o login espera.
      setStage("login");
      setBackdropPhase("frozen");
      backdrop.current?.freeze();
    } else {
      setStage("splash");
    }

    if (!podeEntrarOffline) return;
    let vivo = true;
    void servidorResponde().then((responde) => {
      if (vivo && !responde) irParaPainelOffline(router);
    });
    return () => {
      vivo = false;
    };
  }, [router]);

  const mostrarVideo = useCallback(() => setBackdropPhase("cinema"), []);

  const finalizarSplash = useCallback(() => {
    if (!REPLAY_SPLASH_EVERY_VISIT) {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    }
    setBackdropPhase("frozen");
    setStage("login");
  }, []);

  return (
    <>
      {/* Estas duas telas nao rolam; o Dashboard rola. Ver o componente. */}
      <TravaDeRolagem />

      {/* Fundo persistente: atravessa a troca de telas sem desmontar */}
      <DroneBackdrop ref={backdrop} phase={backdropPhase} />

      <AnimatePresence mode="sync">
        {stage === "boot" && (
          <div key="boot" className="fixed inset-0 z-40 bg-brand-990" aria-hidden="true" />
        )}

        {stage === "splash" && (
          <motion.div
            key="splash"
            exit={{ opacity: 0 }}
            transition={{ duration: SPLASH_TO_LOGIN_MS / 1000, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-30"
          >
            <SplashScreen
              onFinish={finalizarSplash}
              onVideoIn={mostrarVideo}
              backdrop={backdrop}
            />
          </motion.div>
        )}

        {stage === "login" && <LoginScreen key="login" />}
      </AnimatePresence>
    </>
  );
}
