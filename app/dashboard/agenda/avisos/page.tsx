"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo, EsqueletoLista, EstadoErro, EstadoVazio,
} from "@/components/dashboard/PaginaModulo";

/**
 * Avisos da igreja.
 *
 * ============================================================================
 * UM AVISO EXPIRADO NÃO É UM AVISO
 *
 * `dataExpiracao` existe no cadastro antigo e nunca foi usada — a planilha
 * mostrava todos juntos. Mas um aviso vencido pode estar ERRADO: "Culto às 19h
 * no dia 12" continua no mural em março do ano seguinte e manda a igreja para o
 * lugar errado.
 *
 * Vigentes e vencidos ficam separados, e a tela abre nos vigentes. Os vencidos
 * seguem acessíveis — apagar histórico não é papel desta tela.
 * ============================================================================
 */

interface Aviso {
  id: number; titulo: string; texto: string; prioridade: number;
  publicado: string; expira: string; autor: string;
  congregacao: string | null; diasRestantes: number;
}

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Menor número = mais urgente. Confirmado nos dados: 1 aparece em convocações. */
function urgencia(p: number) {
  if (p <= 1) return { rotulo: "urgente", variante: "erro" as const };
  if (p === 2) return { rotulo: "importante", variante: "alerta" as const };
  return { rotulo: "informativo", variante: "neutro" as const };
}

function Cartao({ a, vencido }: { a: Aviso; vencido: boolean }) {
  const u = urgencia(a.prioridade);
  return (
    <article className={cn("glass-panel rounded-2xl p-4", vencido && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 font-display text-[0.92rem] font-semibold text-white">{a.titulo}</h3>
        <Badge variant={vencido ? "neutro" : u.variante}>{vencido ? "vencido" : u.rotulo}</Badge>
      </div>

      <p className="mt-2 whitespace-pre-line text-[0.82rem] leading-relaxed text-brand-100/80">{a.texto}</p>

      <p className="mt-3 border-t border-white/8 pt-2.5 text-[0.72rem] tabular-nums text-brand-200/50">
        {a.autor}
        {a.congregacao && ` · ${a.congregacao}`}
        {" · publicado "}
        {fmt.format(new Date(`${a.publicado}T12:00:00`))}
        {vencido
          ? ` · venceu em ${fmt.format(new Date(`${a.expira}T12:00:00`))}`
          : a.diasRestantes <= 7
            ? ` · vence em ${a.diasRestantes} ${a.diasRestantes === 1 ? "dia" : "dias"}`
            : ` · vale até ${fmt.format(new Date(`${a.expira}T12:00:00`))}`}
      </p>
    </article>
  );
}

export default function AvisosPage() {
  const [dados, setDados] = useState<{ vigentes: Aviso[]; vencidos: Aviso[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [verVencidos, setVerVencidos] = useState(false);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/agenda/avisos", { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDados(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(status === 403 ? "O seu acesso não permite ver esta tela." : "Não foi possível carregar os avisos.");
      }
    })();
    return () => controle.abort();
  }, []);

  return (
    <>
      <CabecalhoModulo icone={Megaphone} titulo="Avisos" descricao="Comunicados vigentes da igreja" total={dados?.vigentes.length ?? null} />

      {erro ? <EstadoErro mensagem={erro} />
      : !dados ? <EsqueletoLista linhas={4} />
      : (
        <>
          {dados.vigentes.length === 0 ? (
            <EstadoVazio
              mensagem="Nenhum aviso vigente."
              dica={
                dados.vencidos.length > 0
                  ? dados.vencidos.length === 1
                    ? "Um aviso já vencido continua guardado logo abaixo."
                    : `${dados.vencidos.length} avisos já vencidos continuam guardados logo abaixo.`
                  : "Avisos cadastrados aparecem aqui até a data de expiração."
              }
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 gap-3 lg:grid-cols-2"
            >
              {dados.vigentes.map((a) => <Cartao key={a.id} a={a} vencido={false} />)}
            </motion.div>
          )}

          {dados.vencidos.length > 0 && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setVerVencidos((v) => !v)}
                className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-[0.8rem] text-brand-200/70 transition-colors hover:border-white/20 hover:bg-white/8 hover:text-brand-100"
              >
                {verVencidos ? "Ocultar" : "Ver"} {dados.vencidos.length} aviso
                {dados.vencidos.length === 1 ? "" : "s"} vencido{dados.vencidos.length === 1 ? "" : "s"}
              </button>

              {verVencidos && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2"
                >
                  {dados.vencidos.map((a) => <Cartao key={a.id} a={a} vencido />)}
                </motion.div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
