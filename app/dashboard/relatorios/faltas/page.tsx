"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Phone, TriangleAlert, UserRoundX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { iniciais } from "@/lib/dashboard/formato";

/**
 * Alerta de faltas — quem está sumindo.
 *
 * ESTA TELA EXISTE PARA GERAR TELEFONEMAS, e é por isso que o telefone e o nome
 * do responsável ficam visíveis na linha: quem abre aqui vai ligar, e mandá-lo
 * abrir a ficha de cada aluno para achar o número transformaria uma lista de
 * trinta em trinta idas e voltas.
 */

interface Falta {
  id: number;
  nome: string;
  tel: string | null;
  responsavel: string | null;
  classe: string;
  congregacao: string;
  seguidas: number;
  ultimaPresenca: string | null;
  ultimaChamada: string;
}

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function FaltasPage() {
  const [minimo, setMinimo] = useState(3);
  const [itens, setItens] = useState<Falta[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        setItens(null);
        const res = await fetch(`/api/relatorios/faltas?minimo=${minimo}`, {
          signal: controle.signal,
          cache: "no-store",
        });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setItens((await res.json()).itens);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(status === 403 ? "O seu acesso não permite ver esta tela." : "Não foi possível carregar a lista.");
        setItens([]);
      }
    })();
    return () => controle.abort();
  }, [minimo]);

  const nunca = (itens ?? []).filter((a) => !a.ultimaPresenca).length;

  return (
    <>
      <CabecalhoModulo
        icone={UserRoundX}
        titulo="Alerta de Faltas"
        descricao="Alunos ausentes em chamadas seguidas"
        total={itens?.length ?? null}
      >
        <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
          <span className="shrink-0 text-brand-200/55">A partir de</span>
          <select
            value={minimo}
            onChange={(e) => setMinimo(Number(e.target.value))}
            className="bg-transparent text-brand-50 focus:outline-none [&>option]:bg-brand-900"
          >
            {[2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n} faltas
              </option>
            ))}
          </select>
        </label>
      </CabecalhoModulo>

      {/*
        A frase abaixo é a diferença entre um relatório confiável e um que
        acusa quem não fez nada. A contagem é sobre as chamadas em que o aluno
        foi CHAMADO — domingo sem chamada não produz falta.
      */}
      <p className="mb-3 flex items-start gap-2 text-[0.76rem] leading-relaxed text-brand-200/55">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-300/70" />
        Conta faltas <strong className="text-brand-100/80">seguidas nas chamadas feitas</strong> —
        um domingo em que a classe não registrou não conta como falta de ninguém.
      </p>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : itens === null ? (
        <EsqueletoLista linhas={8} />
      ) : itens.length === 0 ? (
        <EstadoVazio
          mensagem={`Ninguém com ${minimo} faltas seguidas.`}
          dica="Boa notícia — ou a chamada não vem sendo registrada."
        />
      ) : (
        <>
          {nunca > 0 && (
            <p className="mb-3 text-[0.76rem] text-brand-200/55">
              <span className="font-semibold text-gold-200">{nunca}</span>{" "}
              {nunca === 1 ? "aluno nunca apareceu" : "alunos nunca apareceram"} presente em
              nenhum registro — pode ser matrícula que nunca chegou a frequentar.
            </p>
          )}

          <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
            {itens.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i, 20) * 0.015 }}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-300 hover:bg-white/[0.03]"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
                    a.seguidas >= 6
                      ? "bg-flame-500/15 ring-flame-500/30"
                      : "bg-gold-400/12 ring-gold-400/25",
                  )}
                >
                  <span className="font-display text-[0.66rem] font-semibold tracking-wider text-brand-50">
                    {iniciais(a.nome)}
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.88rem] text-brand-50">{a.nome}</p>
                  <p className="truncate text-[0.74rem] text-brand-200/55">
                    {a.classe}
                    <span className="text-brand-200/40"> · {a.congregacao}</span>
                  </p>
                  <p className="truncate text-[0.7rem] text-brand-200/45">
                    {a.ultimaPresenca ? (
                      <>Última presença em {fmt.format(new Date(`${a.ultimaPresenca}T12:00:00`))}</>
                    ) : (
                      <span className="text-gold-200/70">Sem nenhuma presença registrada</span>
                    )}
                    {a.responsavel && <> · Resp.: {a.responsavel}</>}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {a.tel && (
                    <a
                      href={`tel:${a.tel.replace(/\D/g, "")}`}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[0.76rem] tabular-nums text-brand-100/85 transition-colors duration-300 hover:border-gold-400/30 hover:text-gold-200"
                    >
                      <Phone className="h-3 w-3" />
                      {a.tel}
                    </a>
                  )}
                  <Badge variant={a.seguidas >= 6 ? "erro" : "alerta"}>{a.seguidas} faltas</Badge>
                </div>
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
