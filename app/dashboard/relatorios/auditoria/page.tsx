"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo,
  CampoDeBusca,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";

/**
 * Auditoria: o que foi criado, alterado e apagado.
 *
 * Desde a Fase 12 o portal grava auditoria — mas só depois que
 * `prisma/aplicar-fase-12.sql` for aplicado no banco. Enquanto não for, o
 * registro TERMINA NA MIGRAÇÃO, e a tela diz isso com o caminho da correção.
 *
 * Quem decide qual das duas frases aparece é o servidor (`gravandoAgora`), que
 * pergunta ao banco. Uma lista que simplesmente para numa data sugere que nada
 * aconteceu depois dela, o que é pior do que não ter registro nenhum.
 */

interface Registro {
  id: number;
  quando: string;
  quem: string;
  login: string;
  acao: string;
  entidade: string;
  descricao: string;
}

const fmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

export default function AuditoriaPage() {
  const [busca, setBusca] = useState("");
  const [entidade, setEntidade] = useState("");
  const [dados, setDados] = useState<{
    itens: Registro[];
    total: number;
    entidades: string[];
    ultimoRegistro: string | null;
    gravandoAgora: boolean;
    linhasDoPortal: number;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setErro(null);
        const url = new URL("/api/relatorios/auditoria", window.location.origin);
        if (busca.trim()) url.searchParams.set("busca", busca.trim());
        if (entidade) url.searchParams.set("entidade", entidade);
        url.searchParams.set("porPagina", "100");
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDados(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status === 403
            ? "O seu acesso não permite ver esta tela — a auditoria não tem coluna de congregação, então não há como recortá-la."
            : "Não foi possível carregar a auditoria.",
        );
      }
    }, 300);
    return () => {
      controle.abort();
      window.clearTimeout(t);
    };
  }, [busca, entidade]);

  return (
    <>
      <CabecalhoModulo
        icone={History}
        titulo="Auditoria"
        descricao="O que foi criado, alterado e apagado"
        total={dados?.total ?? null}
      >
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <CampoDeBusca
            valor={busca}
            aoMudar={setBusca}
            placeholder="Buscar por autor ou descrição…"
            className="min-w-0 flex-1 sm:w-64 sm:flex-none"
          />
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
            <span className="shrink-0 text-brand-200/55">Tipo</span>
            <select
              value={entidade}
              onChange={(e) => setEntidade(e.target.value)}
              className="min-w-[7rem] bg-transparent text-brand-50 focus:outline-none [&>option]:bg-brand-900"
            >
              <option value="">Todos</option>
              {(dados?.entidades ?? []).map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
        </div>
      </CabecalhoModulo>

      {dados && !dados.gravandoAgora && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-gold-400/20 bg-gold-400/[0.06] px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
          <p className="text-[0.78rem] leading-relaxed text-brand-100/85">
            Estes registros vêm do <strong>sistema antigo</strong> e vão até{" "}
            {dados.ultimoRegistro
              ? fmt.format(new Date(dados.ultimoRegistro))
              : "a data da migração"}
            . O portal <strong>já sabe gravar auditoria</strong>, mas ainda não gravou
            nada neste banco: falta aplicar o arquivo{" "}
            <code className="rounded bg-white/8 px-1 py-0.5 text-[0.72rem]">
              prisma/aplicar-fase-12.sql
            </code>{" "}
            no SQL Editor do Neon. Não é que nada aconteceu desde então — é que ainda
            não está sendo registrado.
          </p>
        </div>
      )}

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : !dados ? (
        <EsqueletoLista linhas={10} />
      ) : dados.itens.length === 0 ? (
        <EstadoVazio mensagem={busca ? `Nada encontrado para “${busca}”.` : "Nenhum registro."} />
      ) : (
        <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
          {dados.itens.map((r, i) => (
            <motion.li
              key={r.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: Math.min(i, 20) * 0.012 }}
              className="flex flex-wrap items-start gap-3 px-4 py-2.5 transition-colors duration-300 hover:bg-white/[0.03]"
            >
              <span className="w-32 shrink-0 text-[0.74rem] tabular-nums text-brand-200/55">
                {fmt.format(new Date(r.quando))}
              </span>
              <Badge variant="neutro" className="shrink-0">
                {r.entidade}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.84rem] text-brand-50">{r.descricao || r.acao}</p>
                <p className="truncate text-[0.72rem] text-brand-200/50">
                  {r.quem}
                  {r.login && r.login !== r.quem && <span className="text-brand-200/35"> · {r.login}</span>}
                </p>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </>
  );
}
