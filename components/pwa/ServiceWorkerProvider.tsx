"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";

/**
 * Registra o Service Worker e cuida da troca de versao.
 *
 * SOBRE "ATUALIZACAO AUTOMATICA"
 *
 * A especificacao pede atualizacao automatica, e aqui ela e automatica no que
 * importa: o download da versao nova acontece sozinho, em segundo plano, sem
 * ninguem clicar em nada.
 *
 * O que NAO e automatico e o instante da troca — e isso e proposital. Recarregar
 * a pagina sozinho e destrutivo num sistema de chamada: o professor esta no meio
 * de marcar presenca de trinta alunos, o app recarrega e o trabalho da manha vai
 * embora. Entao a versao nova fica pronta e esperando, e o usuario escolhe a
 * hora — ou ela entra sozinha na proxima vez que o app for aberto do zero.
 *
 * Em dev o registro e ignorado: o Service Worker serviria as telas do cache e
 * as alteracoes de codigo pareceriam nao surtir efeito.
 */
export function ServiceWorkerProvider() {
  const [aguardando, setAguardando] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let registro: ServiceWorkerRegistration | undefined;

    const registrar = async () => {
      try {
        registro = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        // Ja havia uma versao pronta esperando de uma visita anterior.
        if (registro.waiting) setAguardando(registro.waiting);

        registro.addEventListener("updatefound", () => {
          const novo = registro?.installing;
          if (!novo) return;
          novo.addEventListener("statechange", () => {
            // "installed" com um controller ativo significa: versao nova pronta,
            // versao antiga ainda no comando. Sem controller, e a primeira
            // instalacao — nada a avisar.
            if (novo.state === "installed" && navigator.serviceWorker.controller) {
              setAguardando(novo);
            }
          });
        });

        // Procura atualizacao quando o app volta ao primeiro plano. Sem isso,
        // um app instalado que fica dias aberto nunca perceberia uma versao nova.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") registro?.update();
        });
      } catch {
        /* sem Service Worker o portal continua funcionando, so que sem offline */
      }
    };

    registrar();

    /*
     * Recarrega quando a versao nova assume — mas SO quando e de fato uma
     * troca de versao.
     *
     * Na PRIMEIRA visita o Service Worker chama `clients.claim()` e o
     * `controllerchange` dispara na mesma hora. Sem a checagem abaixo, isso
     * recarregava a pagina no meio dos 15 segundos da abertura: o visitante
     * via o video cortar e a splash recomecar do zero, logo na primeira
     * impressao do sistema. `controller` nulo aqui significa "ainda nao havia
     * Service Worker nenhum", ou seja, instalacao inicial — nada a recarregar.
     *
     * O segundo guard evita o laco classico de recarregamento quando ha
     * varias abas abertas.
     */
    const jaTinhaControlador = Boolean(navigator.serviceWorker.controller);
    let jaRecarregou = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!jaTinhaControlador || jaRecarregou) return;
      jaRecarregou = true;
      window.location.reload();
    });
  }, []);

  const atualizar = () => {
    aguardando?.postMessage({ tipo: "APLICAR_ATUALIZACAO" });
    setAguardando(null);
  };

  return (
    <AnimatePresence>
      {aguardando && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full px-5 py-2.5"
          role="status"
        >
          <span className="text-[0.8rem] text-brand-50/90">
            Nova versão disponível
          </span>
          <button
            type="button"
            onClick={atualizar}
            className="flex items-center gap-1.5 rounded-full bg-gold-400/90 px-3 py-1 text-[0.72rem] font-medium text-brand-950 transition-colors duration-300 hover:bg-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-200"
          >
            <RefreshCw className="h-3 w-3" />
            Atualizar
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
