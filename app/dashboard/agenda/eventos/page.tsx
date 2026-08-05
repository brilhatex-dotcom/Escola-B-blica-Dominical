"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo, EsqueletoLista, EstadoErro, EstadoVazio,
} from "@/components/dashboard/PaginaModulo";

/**
 * Eventos do campo.
 *
 * "EM CURSO" CONTA COMO PRÓXIMO. Um congresso de três dias continua acontecendo
 * no segundo dia — filtrar pela data de início o faria sumir da lista justo no
 * dia em que mais gente procura por ele.
 */

interface Evento {
  id: number; titulo: string; descricao: string | null; tipo: string;
  local: string; congregacao: string | null;
  inicio: string; fim: string; diasDeDuracao: number; emCurso: boolean;
  obs: string | null;
}

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export default function EventosPage() {
  const [passados, setPassados] = useState(false);
  const [itens, setItens] = useState<Evento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null); setItens(null);
        const res = await fetch(`/api/agenda/eventos${passados ? "?passados=1" : ""}`, {
          signal: controle.signal, cache: "no-store",
        });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setItens((await res.json()).itens);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(status === 403 ? "O seu acesso não permite ver esta tela." : "Não foi possível carregar os eventos.");
        setItens([]);
      }
    })();
    return () => controle.abort();
  }, [passados]);

  return (
    <>
      <CabecalhoModulo icone={PartyPopper} titulo="Eventos" descricao="Congressos, encontros e programações" total={itens?.length ?? null}>
        <div role="group" className="flex gap-0.5 rounded-lg bg-white/5 p-0.5">
          {([[false, "Próximos"], [true, "Realizados"]] as const).map(([v, r]) => (
            <button key={r} type="button" onClick={() => setPassados(v)} aria-pressed={passados === v}
              className={cn("rounded-md px-3 py-1.5 text-[0.76rem] font-medium transition-all duration-300",
                passados === v ? "bg-white/10 text-white" : "text-brand-200/60 hover:text-brand-100")}>
              {r}
            </button>
          ))}
        </div>
      </CabecalhoModulo>

      {erro ? <EstadoErro mensagem={erro} />
      : itens === null ? <EsqueletoLista linhas={5} />
      : itens.length === 0 ? (
        <EstadoVazio
          mensagem={passados ? "Nenhum evento realizado registrado." : "Nenhum evento marcado daqui para a frente."}
          dica="Eventos cadastrados aparecem aqui e no calendário automaticamente."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {itens.map((e, i) => (
            <motion.article key={e.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: Math.min(i, 14) * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className={cn("glass-panel rounded-2xl p-4", e.emCurso && "ring-1 ring-gold-400/25")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-[0.95rem] font-semibold text-white">{e.titulo}</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[0.76rem] text-brand-200/55">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {e.local}
                  </p>
                </div>
                {e.emCurso && <Badge variant="alerta">acontecendo</Badge>}
              </div>

              <p className="mt-3 border-t border-white/8 pt-3 text-[0.8rem] tabular-nums text-brand-100/80">
                {fmt.format(new Date(`${e.inicio}T12:00:00`))}
                {e.fim !== e.inicio && <> — {fmt.format(new Date(`${e.fim}T12:00:00`))}</>}
                {e.diasDeDuracao > 1 && (
                  <span className="text-brand-200/45"> · {e.diasDeDuracao} dias</span>
                )}
              </p>

              {(e.descricao || e.obs) && (
                <p className="mt-2 text-[0.78rem] leading-relaxed text-brand-200/60">
                  {e.descricao || e.obs}
                </p>
              )}
            </motion.article>
          ))}
        </div>
      )}
    </>
  );
}
