"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Church, ExternalLink, FileText, PartyPopper, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";

/**
 * Agenda: o que vai acontecer.
 *
 * Eventos e reuniões numa lista só. No sistema antigo eram abas separadas, mas
 * para quem usa sempre foram a mesma pergunta — e a tela não deve herdar a
 * divisão da planilha.
 *
 * As ESCALAS DE CULTO saem numa lista à parte, de documentos: apesar do nome,
 * elas não são compromissos. As colunas (`mesAno`, `nomeArquivo`, `url`) mostram
 * que o que a igreja guardava ali era o ARQUIVO da escala do mês. Colocá-las na
 * linha do tempo inventaria um evento que nunca existiu.
 */

interface ItemAgenda {
  id: string;
  origem: "evento" | "reuniao";
  tipo: string;
  titulo: string;
  local: string;
  data: string;
  detalhe: string | null;
}

interface Escala {
  id: number;
  titulo: string;
  mesAno: string;
  arquivo: string;
  url: string;
  congregacao: string | null;
}

const ICONES: Record<string, typeof Church> = {
  culto: Church,
  ebd: Users,
  reuniao: Users,
  evento: PartyPopper,
};

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export default function AgendaPage() {
  const [itens, setItens] = useState<ItemAgenda[] | null>(null);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [passados, setPassados] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        setItens(null);
        const url = new URL("/api/agenda", window.location.origin);
        if (passados) url.searchParams.set("passados", "1");
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        const d = await res.json();
        setItens(d.itens);
        setEscalas(d.escalas ?? []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status
            ? "O servidor respondeu com erro. Abra /api/diagnostico para ver o motivo."
            : "Sem resposta do servidor. Verifique a conexão.",
        );
        setItens([]);
      }
    })();
    return () => controle.abort();
  }, [passados]);

  return (
    <>
      <CabecalhoModulo
        icone={CalendarDays}
        titulo="Agenda"
        descricao="Cultos, EBD, eventos e reuniões"
        total={itens?.length ?? null}
      >
        <div role="group" className="flex gap-0.5 rounded-lg bg-white/5 p-0.5">
          {([
            [false, "Próximos"],
            [true, "Histórico"],
          ] as const).map(([v, rotulo]) => (
            <button
              key={rotulo}
              type="button"
              onClick={() => setPassados(v)}
              aria-pressed={passados === v}
              className={cn(
                "rounded-md px-3 py-1.5 text-[0.76rem] font-medium transition-all duration-300",
                passados === v
                  ? "bg-white/10 text-white"
                  : "text-brand-200/60 hover:text-brand-100",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </CabecalhoModulo>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : itens === null ? (
        <EsqueletoLista linhas={5} />
      ) : itens.length === 0 ? (
        <EstadoVazio
          mensagem={
            passados
              ? "Nenhum compromisso registrado."
              : "Nenhum compromisso agendado daqui para a frente."
          }
          dica="Eventos e reuniões cadastrados aparecem aqui automaticamente."
        />
      ) : (
        <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
          {itens.map((item, i) => {
            const quando = new Date(item.data);
            const Icone = ICONES[item.tipo] ?? PartyPopper;
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i, 20) * 0.025, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-4 px-4 py-3 transition-colors duration-300 hover:bg-white/[0.03]"
              >
                {/* Bloco de data à esquerda: é por ela que se procura numa agenda */}
                <div className="w-14 shrink-0 text-center">
                  <p className="font-display text-[1.15rem] font-semibold leading-none text-white tabular-nums">
                    {String(quando.getUTCDate()).padStart(2, "0")}
                  </p>
                  <p className="mt-0.5 text-[0.66rem] uppercase tracking-wider text-gold-300/70">
                    {fmtData.format(quando).split(" ").at(-1)}
                  </p>
                </div>

                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
                  <Icone className="h-4 w-4 text-brand-200" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.88rem] text-brand-50">{item.titulo}</p>
                  <p className="truncate text-[0.74rem] text-brand-200/55">{item.local}</p>
                  {item.detalhe && (
                    <p className="truncate text-[0.7rem] text-brand-200/40">{item.detalhe}</p>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      {/* ---------------- Escalas de culto (documentos) ---------------- */}
      {escalas.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel mt-4 overflow-hidden rounded-2xl"
        >
          <header className="border-b border-white/8 px-5 py-3.5">
            <h2 className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white">
              Escalas de culto
            </h2>
            <p className="mt-0.5 text-[0.74rem] text-brand-200/55">
              Arquivos enviados, um por mês
            </p>
          </header>
          <ul className="divide-y divide-white/6">
            {escalas.map((e) => (
              <li key={e.id}>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-5 py-3 transition-colors duration-300 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60"
                >
                  <FileText className="h-4 w-4 shrink-0 text-brand-300/70" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.84rem] text-brand-50">{e.titulo}</p>
                    <p className="truncate text-[0.72rem] text-brand-200/50">
                      {fmtMes.format(new Date(`${e.mesAno}T12:00:00`))}
                      {e.congregacao && ` · ${e.congregacao}`}
                    </p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-brand-300/50" />
                </a>
              </li>
            ))}
          </ul>
        </motion.section>
      )}
    </>
  );
}
