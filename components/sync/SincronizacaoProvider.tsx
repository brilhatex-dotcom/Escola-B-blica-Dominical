"use client";

import { useEffect } from "react";
import { temBancoLocal } from "@/lib/db/local";
import { hidratarCacheLocal } from "@/lib/db/hidratar";
import { configurarTransporte, iniciarSincronizacaoAutomatica } from "@/lib/sync/motor";
import { transporteHttp } from "@/lib/sync/transporte";

/**
 * Liga o motor de sincronizacao ao servidor.
 *
 * Nao desenha nada. Existe porque o motor e o transporte sao modulos comuns, e
 * alguem precisa apresenta-los um ao outro DENTRO do navegador — no servidor
 * nao ha IndexedDB, nem `fetch` para "/api/chamada", nem evento `online`.
 *
 * Fica no layout do painel, e nao na tela da Chamada, por um motivo concreto:
 * o professor grava a chamada sem sinal e navega para os Relatorios. Se o motor
 * so existisse na tela da Chamada, a fila pararia de subir no instante em que
 * ele saisse dela — e voltaria a subir so quando alguem abrisse aquela tela
 * outra vez.
 *
 * Sem IndexedDB (navegador antigo, aba anonima em alguns casos) nao ha fila, e
 * ligar o motor so produziria erro a cada 30 segundos. A tela, nesse caso,
 * avisa que a gravacao depende de conexao.
 */
export function SincronizacaoProvider() {
  useEffect(() => {
    if (!temBancoLocal()) return;

    configurarTransporte(transporteHttp);
    const parar = iniciarSincronizacaoAutomatica();

    /*
     * A DESCIDA do cache para a busca offline. Roda uma vez ao abrir o painel
     * (com conexão), e de novo quando a internet volta — o mesmo gatilho da
     * subida. Falha em silêncio: o espelho antigo continua servindo a busca.
     */
    void hidratarCacheLocal();
    const aoVoltar = () => void hidratarCacheLocal();
    window.addEventListener("online", aoVoltar);

    return () => {
      parar();
      configurarTransporte(null);
      window.removeEventListener("online", aoVoltar);
    };
  }, []);

  return null;
}
