"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AcessoProvider } from "@/components/acesso/AcessoProvider";
import { AvisoDeSeguranca } from "@/components/dashboard/AvisoDeSeguranca";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SincronizacaoProvider } from "@/components/sync/SincronizacaoProvider";
import { carregarPainel } from "@/lib/dashboard/dados";
import type { Usuario } from "@/lib/dashboard/tipos";

/**
 * Estrutura fixa do sistema: cabecalho, menu lateral e area de conteudo.
 *
 * Fica em `layout.tsx`, e nao dentro da pagina, por um motivo pratico: assim o
 * cabecalho e o menu NAO sao remontados ao navegar entre modulos. O menu nao
 * pisca, a barra de rolagem nao salta e o campo de busca nao perde o foco no
 * meio de uma digitacao.
 */

const LARGURA_ABERTA = "17rem";
const LARGURA_RECOLHIDA = "4.75rem";
const CHAVE_PREFERENCIA = "ebd:menu-recolhido";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [recolhida, setRecolhida] = useState(false);
  const [gaveta, setGaveta] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  /*
   * A preferencia do menu e lida DEPOIS da montagem, nunca durante.
   *
   * `localStorage` nao existe no servidor. Ler no `useState` inicial faria o
   * servidor renderizar sempre "aberto" e o cliente, as vezes, "recolhido" —
   * divergencia de hidratacao, com o React descartando a arvore e o menu dando
   * um salto visivel no primeiro quadro.
   */
  useEffect(() => {
    setRecolhida(window.localStorage.getItem(CHAVE_PREFERENCIA) === "1");
  }, []);

  useEffect(() => {
    void carregarPainel().then((d) => setUsuario(d.usuario));
  }, []);

  const alternar = useCallback(() => {
    setRecolhida((v) => {
      window.localStorage.setItem(CHAVE_PREFERENCIA, v ? "0" : "1");
      return !v;
    });
  }, []);

  // Fecha a gaveta ao passar para desktop: sem isso, quem gira o tablet fica
  // com o fundo escurecido preso sobre um menu que ja esta visivel ao lado.
  useEffect(() => {
    const consulta = window.matchMedia("(min-width: 1024px)");
    const aoMudar = () => consulta.matches && setGaveta(false);
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  // Com a gaveta aberta o fundo nao rola — senao o dedo arrasta a pagina atras
  // do menu em vez de rolar o menu.
  useEffect(() => {
    if (!gaveta) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [gaveta]);

  const largura = recolhida ? LARGURA_RECOLHIDA : LARGURA_ABERTA;

  return (
    /*
      Quem esta usando o portal e apurado UMA vez, aqui, e compartilhado com
      todas as telas. Sem isto, a Sidebar, a busca global e cada pagina fariam a
      mesma pergunta a `/api/auth/eu` a cada navegacao, cada uma respondendo num
      instante diferente — e o menu piscaria itens que aparecem e somem.
    */
    <AcessoProvider>
    <div
      className="relative min-h-[100dvh] bg-brand-990"
      style={{ ["--lateral" as string]: largura }}
    >
      {/*
        O motor de sincronizacao vive no layout, e nao numa tela: a fila precisa
        continuar subindo depois que o professor sai da Chamada.
      */}
      <SincronizacaoProvider />
      {/* ---------------- Ambiente ----------------
        Duas luzes muito difusas, fixas. Sao o que impede o painel de virar um
        retangulo azul chapado — a mesma profundidade do card de login, sem
        video, que aqui pesaria no carregamento a cada visita. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden print:hidden">
        <div
          className="absolute -left-[12%] -top-[18%] h-[42rem] w-[42rem] rounded-full opacity-55"
          style={{
            background:
              "radial-gradient(circle, rgba(22,58,112,0.55) 0%, rgba(11,31,69,0.22) 46%, transparent 70%)",
            filter: "blur(30px)",
          }}
        />
        <div
          className="absolute -bottom-[22%] -right-[10%] h-[38rem] w-[38rem] rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(circle, rgba(212,175,55,0.14) 0%, rgba(22,58,112,0.20) 44%, transparent 72%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* ---------------- Menu fixo (desktop) ---------------- */}
      {/* print:hidden: o relatório impresso (Ficha, Certificados, Relatório
          Semanal) não leva o menu do sistema — ninguém arquiva isso numa pasta. */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[var(--lateral)] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:block print:hidden"
      >
        <Sidebar recolhida={recolhida} />
      </aside>

      {/* ---------------- Gaveta (celular e tablet) ---------------- */}
      <AnimatePresence>
        {gaveta && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setGaveta(false)}
              className="fixed inset-0 z-40 bg-brand-990/70 backdrop-blur-sm lg:hidden"
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-[17rem] max-w-[85vw] lg:hidden"
            >
              <Sidebar
                recolhida={false}
                gaveta
                onNavegar={() => setGaveta(false)}
                onFechar={() => setGaveta(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ---------------- Conteudo ---------------- */}
      <div className="relative lg:pl-[var(--lateral)] lg:transition-[padding] lg:duration-500 lg:ease-[cubic-bezier(0.16,1,0.3,1)] print:pl-0">
        {/*
          O cabecalho so monta quando o usuario chega — um `Header` com nome
          vazio e depois preenchido muda de largura no primeiro quadro e arrasta
          o sino e o avatar de lugar. Mas a BARRA fica desde o inicio, com a
          mesma altura: sem ela, o conteudo comeca colado no topo e desce
          64px assim que os dados chegam.
        */}
        {usuario ? (
          <Header
            usuario={usuario}
            recolhida={recolhida}
            onAlternarRecolhida={alternar}
            onAbrirGaveta={() => setGaveta(true)}
            notificacoes={3}
          />
        ) : (
          <div
            aria-hidden="true"
            className="sticky top-0 z-40 h-16 border-b border-white/8 bg-brand-950/80 backdrop-blur-2xl print:hidden"
          />
        )}

        <main className="mx-auto w-full max-w-[110rem] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          {/*
            O aviso vive no LAYOUT, e nao na pagina do painel: o estado de
            protecao do portal vale em toda tela, e quem entra direto em
            /dashboard/chamada precisa ve-lo tanto quanto quem passa pelo painel.
          */}
          <div className="print:hidden">
            <AvisoDeSeguranca />
          </div>
          {children}
        </main>
      </div>
    </div>
    </AcessoProvider>
  );
}
