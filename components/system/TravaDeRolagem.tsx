"use client";

import { useEffect } from "react";

/**
 * Impede a rolagem enquanto estiver montado.
 *
 * A abertura e o login ocupam exatamente a viewport e nada neles rola; sem a
 * trava, o dedo arrasta a tela inteira no celular e o video de fundo sai do
 * lugar. O Dashboard, ao contrario, precisa rolar — dai a trava ser um
 * componente que entra e sai com a tela, em vez de uma regra fixa no `body`.
 *
 * A classe vai no `<html>`, e nao num style inline, para o CSS continuar sendo
 * o dono da aparencia (ver `app/globals.css`).
 */
export function TravaDeRolagem() {
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.add("ebd-sem-rolagem");
    return () => raiz.classList.remove("ebd-sem-rolagem");
  }, []);

  return null;
}
