"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  escopoDe,
  papelPrincipal,
  podeGravar as papelPodeGravar,
  podeVer as papelPodeVer,
  rotuloDoPapel,
  type Escopo,
  type Papel,
} from "@/lib/auth/papeis";

/**
 * Quem está usando o portal, e o que essa pessoa pode.
 *
 * Uma consulta só, no layout do painel, compartilhada por todas as telas. Sem
 * isto, a Sidebar, a busca global e cada página fariam a mesma requisição a
 * `/api/auth/eu` — quatro ou cinco idas ao servidor a cada navegação, e cada
 * uma podendo responder num instante diferente, com o menu piscando itens que
 * aparecem e somem.
 *
 * ============================================================================
 * ISTO NÃO É A PROTEÇÃO — É A EDUCAÇÃO DA INTERFACE
 *
 * Esconder um botão no navegador não protege nada: qualquer pessoa pode chamar
 * a rota direto. Quem protege é a guarda no servidor (lib/auth/guarda.ts), e é
 * lá que a permissão é conferida de verdade, em toda gravação.
 *
 * O que este arquivo faz é diferente e igualmente necessário: evitar oferecer
 * ao professor um botão que vai recusá-lo. Uma tela que mostra o que a pessoa
 * não pode fazer transforma cada clique numa mensagem de erro e ensina a
 * desconfiar do sistema.
 * ============================================================================
 */

export interface SessaoCliente {
  id: number;
  login: string;
  nome: string;
  perfil: string;
  congId: number | null;
  precisaTrocar: boolean;
  papeis: Papel[];
  congIds: number[];
  escopo: Escopo;
  presumido: boolean;
}

export interface Acesso {
  /** `true` até a primeira resposta chegar. As telas reservam espaço nesse meio-tempo. */
  carregando: boolean;
  sessao: SessaoCliente | null;
  /** `false` quando falta `AUTH_SECRET` no servidor — o portal está aberto. */
  autenticacaoAtiva: boolean;
  papeis: Papel[];
  escopo: Escopo;
  papel: Papel | null;
  rotuloDoAcesso: string;
  presumido: boolean;
  podeVer: (chave: string) => boolean;
  podeGravar: (chave: string) => boolean;
}

const PADRAO: Acesso = {
  carregando: true,
  sessao: null,
  autenticacaoAtiva: false,
  papeis: [],
  escopo: "campo",
  papel: null,
  rotuloDoAcesso: "",
  presumido: false,
  // Enquanto não se sabe quem é, a interface não esconde nada. O contrário
  // faria o menu nascer curto e crescer meio segundo depois, empurrando os
  // itens para baixo justo quando a mão já está indo clicar.
  podeVer: () => true,
  podeGravar: () => true,
};

const Contexto = createContext<Acesso>(PADRAO);

export function useAcesso(): Acesso {
  return useContext(Contexto);
}

export function AcessoProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<{
    carregando: boolean;
    sessao: SessaoCliente | null;
    autenticacaoAtiva: boolean;
  }>({ carregando: true, sessao: null, autenticacaoAtiva: false });

  useEffect(() => {
    let vivo = true;
    void fetch("/api/auth/eu", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        setEstado({
          carregando: false,
          sessao: (d.sessao as SessaoCliente | null) ?? null,
          autenticacaoAtiva: Boolean(d.autenticacaoAtiva),
        });
      })
      .catch(() => {
        if (!vivo) return;
        /*
         * Sem resposta (sem sinal, servidor fora) a interface fica INTEIRA, e
         * não vazia. Esconder tudo por causa de uma falha de rede deixaria o
         * professor olhando um menu de um item, convencido de que perdeu o
         * acesso — e a guarda do servidor continua recusando o que ele não
         * pode, então nada escapa por isso.
         */
        setEstado({ carregando: false, sessao: null, autenticacaoAtiva: false });
      });
    return () => {
      vivo = false;
    };
  }, []);

  const valor = useMemo<Acesso>(() => {
    const { carregando, sessao, autenticacaoAtiva } = estado;

    // Sem sessão não há recorte possível: ou a autenticação está desligada no
    // servidor (portal aberto), ou não deu para perguntar. Nos dois casos a
    // interface aparece completa e o servidor continua sendo quem decide.
    if (!sessao) {
      return { ...PADRAO, carregando, autenticacaoAtiva };
    }

    const papeis = sessao.papeis ?? [];
    const papel = papelPrincipal(papeis);

    return {
      carregando,
      sessao,
      autenticacaoAtiva,
      papeis,
      escopo: sessao.escopo ?? escopoDe(papeis),
      papel,
      rotuloDoAcesso: papel ? rotuloDoPapel(papel) : "",
      presumido: Boolean(sessao.presumido),
      podeVer: (chave) => papelPodeVer(papeis, chave),
      podeGravar: (chave) => papelPodeGravar(papeis, chave),
    };
  }, [estado]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
