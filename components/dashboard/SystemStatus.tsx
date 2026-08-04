"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CloudUpload, RefreshCw, TriangleAlert, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { aoMudar, sincronizar, type EstadoMotor } from "@/lib/sync/motor";
import { temBancoLocal } from "@/lib/db/local";
import { tempoRelativo } from "@/lib/dashboard/formato";

/**
 * Situacao do sistema: online, offline, sincronizando.
 *
 * ESTE COMPONENTE NAO E DEMONSTRACAO. Enquanto o resto do Dashboard mostra
 * numeros de exemplo, aqui tudo e real — o `navigator.onLine` do aparelho e o
 * motor de sincronizacao da Fase 01, com a fila do IndexedDB de verdade. Foi de
 * proposito: e o unico indicador do painel em que uma informacao errada tem
 * consequencia. Se ele disser "tudo enviado" quando ha trinta presencas presas
 * no celular, a secretaria fecha o relatorio sem elas.
 *
 * A spec pede a animacao "Sincronizando… / Dados enviados / Sistema atualizado".
 * Ela existe e e disparada pelas transicoes reais do motor; o passo final fica
 * ~2,5s na tela e some sozinho, para nao virar enfeite permanente.
 */

type Fase = "parado" | "sincronizando" | "enviado" | "atualizado";

export interface SystemStatusProps {
  /** `compacto` cabe no header; `detalhado` e o bloco do painel lateral. */
  variante?: "compacto" | "detalhado";
  className?: string;
}

export function SystemStatus({ variante = "compacto", className }: SystemStatusProps) {
  /*
   * Comeca como `true` mesmo sem saber.
   *
   * No servidor nao existe `navigator`, e um primeiro quadro dizendo "offline"
   * para quem esta perfeitamente conectado e pior do que esperar 16ms: o
   * usuario ve o alerta vermelho piscar toda vez que abre o painel e para de
   * acreditar nele.
   */
  const [online, setOnline] = useState(true);
  const [estado, setEstado] = useState<EstadoMotor>("ocioso");
  const [pendentes, setPendentes] = useState(0);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("parado");
  const [ultimaSync, setUltimaSync] = useState<number | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);

    const aoConectar = () => setOnline(true);
    const aoCair = () => setOnline(false);
    window.addEventListener("online", aoConectar);
    window.addEventListener("offline", aoCair);

    // Sem IndexedDB (navegador antigo, aba anonima em alguns casos) o motor nao
    // tem onde ler a fila. O indicador entao so reporta a conexao.
    if (!temBancoLocal()) {
      return () => {
        window.removeEventListener("online", aoConectar);
        window.removeEventListener("offline", aoCair);
      };
    }

    const parar = aoMudar((novoEstado, restantes, porQue) => {
      setEstado(novoEstado);
      setPendentes(restantes);
      setMotivo(porQue ?? null);
    });

    // Uma passada inicial. Se o transporte ainda nao tiver sido configurado
    // (o SincronizacaoProvider monta no mesmo instante), ela volta "ocioso" na
    // hora, sem erro nem requisicao — e o intervalo do motor pega a seguinte.
    void sincronizar();

    return () => {
      parar();
      window.removeEventListener("online", aoConectar);
      window.removeEventListener("offline", aoCair);
    };
  }, []);

  /*
   * A narrativa de tres passos.
   *
   * Dispara quando o motor SAI de "sincronizando" com a fila vazia — ou seja,
   * quando algo de fato subiu. Sem essa condicao, a mensagem "Dados enviados"
   * apareceria tambem nas passadas em que nao havia nada a enviar, e o usuario
   * aprenderia a ignora-la.
   */
  useEffect(() => {
    if (estado === "sincronizando") {
      setFase("sincronizando");
      return;
    }
    if (fase !== "sincronizando") return;

    if (estado === "ocioso" && pendentes === 0) {
      setUltimaSync(Date.now());
      setFase("enviado");
      const t1 = window.setTimeout(() => setFase("atualizado"), 1200);
      const t2 = window.setTimeout(() => setFase("parado"), 3700);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
    setFase("parado");
  }, [estado, pendentes, fase]);

  const trabalhandoOffline = !online;
  const sincronizando = fase === "sincronizando";

  /*
   * "Bloqueado" tem cor propria, e nao a de erro.
   *
   * Falha de envio passa sozinha — o motor tenta de novo e o usuario nao
   * precisa fazer nada. Bloqueio nao passa: alguem tem de agir (trocar a senha
   * herdada, entrar de novo). Pintar os dois de vermelho ensinaria a ignorar os
   * dois, e o unico que exige atencao e justamente o que ficaria escondido no
   * meio dos falsos alarmes de rede instavel.
   */
  const bloqueado = !trabalhandoOffline && estado === "bloqueado";

  const cor = trabalhandoOffline
    ? { ponto: "bg-gold-400", texto: "text-gold-200", anel: "ring-gold-400/30", fundo: "bg-gold-400/10" }
    : bloqueado
      ? { ponto: "bg-flame-500", texto: "text-flame-400", anel: "ring-flame-500/40", fundo: "bg-flame-500/15" }
      : estado === "erro"
        ? { ponto: "bg-gold-400", texto: "text-gold-200", anel: "ring-gold-400/30", fundo: "bg-gold-400/10" }
        : { ponto: "bg-emerald-400", texto: "text-emerald-300", anel: "ring-emerald-400/25", fundo: "bg-emerald-500/10" };

  const rotulo = trabalhandoOffline
    ? "Trabalhando offline"
    : bloqueado
      ? "Envio bloqueado"
      : sincronizando
        ? "Sincronizando…"
        : estado === "erro"
          ? "Reenviando…"
          : "Online";

  /* ---------------------------------------------------------------- *
   * Compacto — cabe no header, ao lado das notificacoes
   * ---------------------------------------------------------------- */
  if (variante === "compacto") {
    return (
      <div
        role="status"
        aria-live="polite"
        title={
          trabalhandoOffline
            ? "Todas as alterações estão sendo salvas no dispositivo."
            : `Sistema ${rotulo.toLowerCase()}`
        }
        className={cn(
          "flex items-center gap-2 rounded-full px-2.5 py-1.5 ring-1 transition-colors duration-500",
          cor.fundo,
          cor.anel,
          className,
        )}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {/* O halo pulsante so aparece em movimento — parado ele viraria ruido */}
          {(sincronizando || trabalhandoOffline) && (
            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", cor.ponto)} />
          )}
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", cor.ponto)} />
        </span>

        <span className={cn("hidden text-[0.72rem] font-medium sm:inline", cor.texto)}>{rotulo}</span>

        {pendentes > 0 && (
          <span className="rounded-full bg-white/10 px-1.5 text-[0.65rem] font-semibold text-brand-50">
            {pendentes}
          </span>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- *
   * Detalhado — bloco do painel lateral
   * ---------------------------------------------------------------- */
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("rounded-2xl border border-white/8 bg-white/[0.03] p-4", className)}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl ring-1", cor.fundo, cor.anel)}>
          {trabalhandoOffline ? (
            <WifiOff className={cn("h-4 w-4", cor.texto)} />
          ) : bloqueado ? (
            <TriangleAlert className={cn("h-4 w-4", cor.texto)} />
          ) : sincronizando ? (
            <RefreshCw className={cn("h-4 w-4 animate-spin", cor.texto)} />
          ) : (
            <Wifi className={cn("h-4 w-4", cor.texto)} />
          )}
        </span>
        <div className="min-w-0">
          <p className={cn("text-[0.82rem] font-medium", cor.texto)}>{rotulo}</p>
          <p className="text-[0.7rem] text-brand-200/55">
            {ultimaSync
              ? `Sincronizado ${tempoRelativo(ultimaSync)}`
              : "Aguardando a primeira sincronização"}
          </p>
        </div>
      </div>

      {/*
        O motivo do bloqueio, por extenso.
        "Envio bloqueado" sozinho e uma parede: o professor le, nao tem o que
        fazer com aquilo e conclui que o sistema quebrou. A frase completa diz o
        que aconteceu e o que resolve.
      */}
      {bloqueado && motivo && (
        <p className="mt-3 rounded-lg border border-flame-500/25 bg-flame-500/[0.07] px-3 py-2 text-[0.76rem] leading-relaxed text-flame-100/90">
          {motivo}{" "}
          <span className="text-brand-100/70">
            O que está guardado no aparelho não se perde — sobe assim que isto for
            resolvido.
          </span>
        </p>
      )}

      {/*
        A frase que a spec pede, palavra por palavra. Ela e a diferenca entre o
        professor guardar o celular tranquilo e refazer a chamada inteira com
        medo de ter perdido tudo.
      */}
      <AnimatePresence initial={false}>
        {trabalhandoOffline && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 overflow-hidden text-[0.76rem] leading-relaxed text-brand-100/75"
          >
            Todas as alterações estão sendo salvas no dispositivo.
          </motion.p>
        )}
      </AnimatePresence>

      {/* Os tres passos da volta da internet */}
      <AnimatePresence mode="wait">
        {fase !== "parado" && !trabalhandoOffline && (
          <motion.div
            key={fase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 flex items-center gap-2 text-[0.76rem] text-brand-100/80"
          >
            {fase === "sincronizando" && (
              <>
                <CloudUpload className="h-3.5 w-3.5 text-brand-200" />
                Sincronizando…
              </>
            )}
            {fase === "enviado" && (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                Dados enviados.
              </>
            )}
            {fase === "atualizado" && (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                Sistema atualizado.
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {pendentes > 0 && (
        <p className="mt-3 border-t border-white/8 pt-3 text-[0.74rem] text-brand-200/70">
          <span className="font-semibold text-gold-200">{pendentes}</span>{" "}
          {pendentes === 1 ? "alteração aguardando envio" : "alterações aguardando envio"}
        </p>
      )}
    </div>
  );
}
