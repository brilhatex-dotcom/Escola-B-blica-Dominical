"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LoginCard } from "./LoginCard";
import { AuthSuccessOverlay } from "./AuthSuccessOverlay";
import { EXIGIR_SENHA_PROPRIA_PARA_GRAVAR, SPLASH_TO_LOGIN_MS } from "@/lib/config";

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
  const router = useRouter();
  const [autenticado, setAutenticado] = useState<string | null>(null);
  const [precisaTrocar, setPrecisaTrocar] = useState(false);

  /*
   * Adianta o carregamento do Dashboard enquanto o usuario digita.
   *
   * O selo de entrada dura 3s, e sem isso os 3s sao gastos no ar: so quando ele
   * termina e que o navegador comeca a buscar o JavaScript do painel, e o
   * usuario ve um segundo tempo de espera logo depois da animacao. Com o
   * `prefetch` feito aqui, a troca de tela e imediata.
   */
  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

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
        <LoginCard
          onAuthenticated={(u, trocar) => {
            setPrecisaTrocar(trocar);
            setAutenticado(u);
          }}
        />
      </div>

      <AnimatePresence>
        {autenticado && (
          <AuthSuccessOverlay
            nome={autenticado}
            /* ------------------------------------------------------------
             * Terminado o selo de entrada, o Dashboard assume.
             *
             * `replace` e nao `push`: com `push`, o botao "voltar" do navegador
             * traria de volta a tela de login com a sessao ja aberta — o que
             * parece um sistema que "deslogou sozinho" e, num aparelho
             * emprestado, e uma porta aberta para o proximo que pegar.
             * ------------------------------------------------------------ */
            /*
             * Quem entrou com a senha herdada vai direto para a troca — mas so
             * enquanto a troca for OBRIGATORIA para gravar.
             *
             * As 19 contas do sistema antigo compartilham o mesmo hash, ou
             * seja, a mesma senha. Com a trava ligada, mandar para ca e um
             * favor: a alternativa e a pessoa descobrir o bloqueio ao perder a
             * chamada de trinta alunos.
             *
             * Com a trava desligada (o estado de hoje, ate a reuniao da
             * lideranca), gravar funciona — e parar toda entrada numa tela que
             * ninguem e obrigado a preencher so ensina a passar batido por ela.
             * O aviso do painel continua dizendo, em toda tela, que a senha e
             * compartilhada.
             */
            onDone={() =>
              router.replace(
                precisaTrocar && EXIGIR_SENHA_PROPRIA_PARA_GRAVAR
                  ? "/dashboard/trocar-senha"
                  : "/dashboard",
              )
            }
          />
        )}
      </AnimatePresence>
    </motion.main>
  );
}
