"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo, CampoDeBusca, EsqueletoLista, EstadoErro, EstadoVazio,
} from "@/components/dashboard/PaginaModulo";

/**
 * Logs — quem entrou e o que fez.
 *
 * ============================================================================
 * A MESMA LISTA, DUAS ORIGENS, E A TELA MARCA QUAL É QUAL
 *
 * As 1.671 linhas herdadas e as que o portal grava desde a Fase 12 são o mesmo
 * histórico e devem ser lidas juntas. Mas não têm o mesmo valor: as antigas
 * vieram de um sistema que ninguém mais mantém, e a coluna de congregação está
 * vazia em todas elas.
 *
 * Apresentar as duas sem distinção faria alguém tomar por auditoria atual uma
 * linha de 2025. A etiqueta "sistema antigo" custa um pixel e evita isso.
 * ============================================================================
 */

interface Linha {
  id: number; quando: string; quem: string; login: string;
  acao: string; entidade: string; descricao: string;
  congregacao: string | null; origem: "portal" | "antigo";
}

interface Dados {
  itens: Linha[]; total: number; pagina: number; temMais: boolean;
  acoes: { acao: string; linhas: number }[];
  gravandoAgora: boolean; linhasDoPortal: number; ultimaDoPortal: string | null;
}

const fmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const num = new Intl.NumberFormat("pt-BR");

/** A cor do verbo. LOGIN é o mais comum e o menos interessante — fica neutro. */
function corDaAcao(a: string): "sucesso" | "info" | "alerta" | "erro" | "neutro" {
  if (a === "CREATE") return "sucesso";
  if (a === "UPDATE") return "alerta";
  if (a === "DELETE") return "erro";
  return "neutro";
}

export default function LogsPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [acao, setAcao] = useState("");
  const [origem, setOrigem] = useState("");
  const [pag, setPag] = useState(1);

  useEffect(() => { setPag(1); }, [busca, acao, origem]);

  useEffect(() => {
    const controle = new AbortController();
    const atraso = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ pagina: String(pag), porPagina: "40" });
        if (busca) q.set("busca", busca);
        if (acao) q.set("acao", acao);
        if (origem) q.set("origem", origem);

        const res = await fetch(`/api/configuracoes/logs?${q}`, {
          signal: controle.signal, cache: "no-store",
        });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDados(await res.json());
        setErro(null);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status === 403
            ? "Os logs são restritos a quem enxerga o campo inteiro — as linhas antigas não têm congregação, e não há como recortá-las."
            : "Não foi possível carregar os logs.",
        );
      }
    }, busca ? 300 : 0);

    return () => { clearTimeout(atraso); controle.abort(); };
  }, [busca, acao, origem, pag]);

  return (
    <>
      <CabecalhoModulo
        icone={ScrollText}
        titulo="Logs"
        descricao="Quem entrou e o que fez, com data e hora"
        total={dados?.total ?? null}
      >
        <div className="flex flex-wrap items-center gap-2">
          <CampoDeBusca
            valor={busca}
            aoMudar={setBusca}
            placeholder="Pessoa, ação ou descrição…"
            className="w-full sm:w-64"
          />
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
            <span className="shrink-0 text-brand-200/55">Ação</span>
            <select
              value={acao}
              onChange={(e) => setAcao(e.target.value)}
              className="bg-transparent text-brand-50 focus:outline-none [&>option]:bg-brand-900"
            >
              <option value="">Todas</option>
              {dados?.acoes.map((a) => (
                <option key={a.acao} value={a.acao}>
                  {a.acao} ({num.format(a.linhas)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
            <span className="shrink-0 text-brand-200/55">Origem</span>
            <select
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              className="bg-transparent text-brand-50 focus:outline-none [&>option]:bg-brand-900"
            >
              <option value="">Todas</option>
              <option value="portal">Portal</option>
              <option value="antigo">Sistema antigo</option>
            </select>
          </label>
        </div>
      </CabecalhoModulo>

      {dados && !dados.gravandoAgora && (
        <Alert tipo="alerta" titulo="O portal ainda não gravou nada neste banco">
          O código da auditoria já está no ar, mas falta aplicar o arquivo{" "}
          <code className="rounded bg-white/10 px-1">prisma/aplicar-fase-12.sql</code> no
          SQL Editor do Neon — sem ele não existe numeração para as linhas novas. Até
          lá, o que aparece abaixo é só o histórico do sistema antigo.
        </Alert>
      )}

      {dados?.gravandoAgora && (
        <p className="mb-3 text-[0.78rem] text-brand-200/60">
          <span className="tabular-nums text-brand-50">{num.format(dados.linhasDoPortal)}</span>{" "}
          registro(s) gravados pelo portal
          {dados.ultimaDoPortal && ` · o mais recente em ${fmt.format(new Date(dados.ultimaDoPortal))}`}
          .
        </p>
      )}

      <div className="mt-3">
        {erro ? <EstadoErro mensagem={erro} />
        : !dados ? <EsqueletoLista linhas={10} />
        : dados.itens.length === 0 ? (
          <EstadoVazio mensagem="Nenhum registro com esses filtros." />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel divide-y divide-white/6 rounded-2xl"
          >
            {dados.itens.map((l) => (
              <div
                key={l.id}
                className={cn(
                  "flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-3",
                  l.origem === "antigo" && "opacity-70",
                )}
              >
                <span className="w-32 shrink-0 text-[0.74rem] tabular-nums text-brand-300/50">
                  {fmt.format(new Date(l.quando))}
                </span>
                <Badge variant={corDaAcao(l.acao)}>{l.acao}</Badge>
                <span className="shrink-0 text-[0.78rem] text-brand-100/70">{l.entidade}</span>

                <p className="min-w-0 flex-1 basis-full text-[0.82rem] text-white sm:basis-auto">
                  {l.descricao}
                </p>

                <span className="shrink-0 text-[0.74rem] text-brand-200/55">
                  {l.quem}
                  {l.congregacao && ` · ${l.congregacao}`}
                </span>
                {l.origem === "antigo" && (
                  <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.1em] text-brand-300/40">
                    sistema antigo
                  </span>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {dados && (dados.pagina > 1 || dados.temMais) && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPag((p) => Math.max(1, p - 1))}
            disabled={dados.pagina === 1}
            className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-[0.8rem] text-brand-200/70 transition-colors hover:bg-white/8 disabled:opacity-35"
          >
            Anteriores
          </button>
          <span className="text-[0.78rem] tabular-nums text-brand-300/50">
            página {dados.pagina}
          </span>
          <button
            type="button"
            onClick={() => setPag((p) => p + 1)}
            disabled={!dados.temMais}
            className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-[0.8rem] text-brand-200/70 transition-colors hover:bg-white/8 disabled:opacity-35"
          >
            Próximos
          </button>
        </div>
      )}
    </>
  );
}
