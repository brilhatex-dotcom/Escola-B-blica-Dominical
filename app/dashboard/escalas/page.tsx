"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarRange, ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  CabecalhoModulo, EsqueletoLista, EstadoErro, EstadoVazio,
} from "@/components/dashboard/PaginaModulo";

/**
 * Escalas de culto.
 *
 * A escala é um PDF montado fora do sistema e guardado no Drive; o portal
 * registra qual arquivo vale para qual mês. A tela abre o arquivo — não tenta
 * redesenhar a escala dentro dela, o que criaria uma segunda versão da escala
 * para divergir da que o campo distribui.
 */

interface Escala {
  id: number; titulo: string; mes: string; doMesAtual: boolean;
  enviadaEm: string; arquivo: string; url: string; urlPreview: string;
  obs: string | null; autor: string; congregacao: string | null; doCampo: boolean;
}

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function EscalasPage() {
  const [dados, setDados] = useState<{ itens: Escala[]; mesAtualTemEscala: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/escalas", { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDados(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status === 403
            ? "O seu acesso não permite ver as escalas."
            : "Não foi possível carregar as escalas.",
        );
      }
    })();
    return () => controle.abort();
  }, []);

  return (
    <>
      <CabecalhoModulo
        icone={CalendarRange}
        titulo="Escalas"
        descricao="Escalas de culto do mês"
        total={dados?.itens.length ?? null}
      />

      {erro ? <EstadoErro mensagem={erro} />
      : !dados ? <EsqueletoLista linhas={4} />
      : (
        <>
          {/*
            O mês corrente sem escala é a informação mais útil desta tela, e ela
            só existe se alguém a calcular. Uma lista ordenada por data mostra a
            escala de maio no topo e não diz nada sobre agosto estar faltando.
          */}
          {!dados.mesAtualTemEscala && (
            <Alert tipo="alerta" titulo="Este mês ainda não tem escala publicada">
              A escala mais recente é de outro mês. Enquanto o arquivo do mês corrente
              não for cadastrado, quem abrir esta tela vai ver a escala antiga — e é
              exatamente assim que alguém acaba servindo no dia errado.
            </Alert>
          )}

          <div className="mt-4">
            {dados.itens.length === 0 ? (
              <EstadoVazio
                mensagem="Nenhuma escala cadastrada."
                dica="As escalas são arquivos publicados pela secretaria do campo."
              />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-1 gap-3 lg:grid-cols-2"
              >
                {dados.itens.map((e) => (
                  <article key={e.id} className="glass-panel rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-[0.95rem] font-semibold capitalize text-white">
                          {e.mes}
                        </h3>
                        <p className="mt-0.5 text-[0.78rem] text-brand-200/60">
                          {e.titulo}
                          {" · "}
                          {e.doCampo ? "campo inteiro" : e.congregacao}
                        </p>
                      </div>
                      {e.doMesAtual && <Badge variant="sucesso">mês atual</Badge>}
                    </div>

                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                      <FileText className="h-4 w-4 shrink-0 text-brand-300/60" />
                      <span className="min-w-0 flex-1 truncate text-[0.76rem] text-brand-100/75">
                        {e.arquivo}
                      </span>
                    </div>

                    {e.obs && (
                      <p className="mt-2 text-[0.78rem] text-brand-100/70">{e.obs}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-2.5">
                      <p className="text-[0.72rem] tabular-nums text-brand-200/50">
                        {e.autor} · enviada em {fmt.format(new Date(`${e.enviadaEm}T12:00:00`))}
                      </p>
                      {/*
                        `rel="noreferrer"` junto com o target: sem ele, a página
                        aberta recebe uma referência à nossa via `window.opener`.
                      */}
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/25 bg-gold-400/[0.08] px-3 py-1.5 text-[0.76rem] text-gold-200 transition-colors hover:bg-gold-400/15"
                      >
                        Abrir a escala
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </article>
                ))}
              </motion.div>
            )}
          </div>
        </>
      )}
    </>
  );
}
