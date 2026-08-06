"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, PartyPopper, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo, EsqueletoLista, EstadoErro, EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { Button } from "@/components/ui/button";
import { AcoesDoRegistro } from "@/components/crud/AcoesDoRegistro";
import { AvisoDeGravacao } from "@/components/crud/AvisoDeGravacao";
import { FormularioModal, type CampoForm } from "@/components/crud/FormularioModal";
import { useCrud } from "@/components/crud/useCrud";
import { useAcesso } from "@/components/acesso/AcessoProvider";

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
  const { podeGravar } = useAcesso();
  const podeMexer = podeGravar("agenda-eventos");
  const { aviso, limparAviso, recarga, gravar } = useCrud();
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Evento | null>(null);

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
  }, [passados, recarga]);

  return (
    <>
      <CabecalhoModulo icone={PartyPopper} titulo="Eventos" descricao="Congressos, encontros e programações" total={itens?.length ?? null}>
        {podeMexer && (
          <Button size="sm" onClick={() => setCriando(true)}>
            <Plus className="h-4 w-4" />
            Novo evento
          </Button>
        )}
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

      <AvisoDeGravacao mensagem={aviso} aoFechar={limparAviso} />

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
                <div className="flex shrink-0 items-center gap-2">
                  {e.emCurso && <Badge variant="alerta">acontecendo</Badge>}
                {podeMexer && (
                  <AcoesDoRegistro
                    nome={e.titulo}
                    onEditar={() => setEmEdicao(e)}
                    onExcluir={async () => {
                      await gravar(`/api/agenda/eventos/${e.id}`, "DELETE");
                    }}
                  />
                )}
                </div>
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

      <FormularioModal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Novo evento"
        descricao="Deixe a data de término em branco se o evento durar um dia só."
        campos={CAMPOS_EVENTO}
        valores={{ titulo: "", tipo: "evento", data: "", dataFim: "", local: "", descricao: "", obs: "" }}
        rotuloGravar="Criar evento"
        aoGravar={(v) => gravar("/api/agenda/eventos", "POST", v)}
      />

      <FormularioModal
        aberto={emEdicao !== null}
        aoFechar={() => setEmEdicao(null)}
        titulo="Editar evento"
        campos={CAMPOS_EVENTO}
        valores={{
          titulo: emEdicao?.titulo ?? "",
          tipo: emEdicao?.tipo ?? "evento",
          data: emEdicao?.inicio?.slice(0, 10) ?? "",
          dataFim: emEdicao?.fim?.slice(0, 10) ?? "",
          local: emEdicao?.local ?? "",
          descricao: emEdicao?.descricao ?? "",
          obs: emEdicao?.obs ?? "",
        }}
        aoGravar={(v) => gravar(`/api/agenda/eventos/${emEdicao?.id}`, "PATCH", v)}
      />
    </>
  );
}

const CAMPOS_EVENTO: readonly CampoForm[] = [
  { chave: "titulo", rotulo: "Título", obrigatorio: true, largo: true },
  { chave: "data", rotulo: "Início", tipo: "data", obrigatorio: true },
  {
    chave: "dataFim",
    rotulo: "Término",
    tipo: "data",
    ajuda: "Em branco = evento de um dia só.",
  },
  {
    chave: "tipo",
    rotulo: "Tipo",
    tipo: "lista",
    opcoes: [
      { valor: "evento", rotulo: "Evento" },
      { valor: "culto", rotulo: "Culto" },
      { valor: "ebd", rotulo: "EBD" },
      { valor: "congresso", rotulo: "Congresso" },
    ],
  },
  { chave: "local", rotulo: "Local" },
  { chave: "descricao", rotulo: "Descrição", tipo: "area" },
  { chave: "obs", rotulo: "Observação", tipo: "area" },
];
