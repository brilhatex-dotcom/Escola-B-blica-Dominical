"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cake, Phone } from "lucide-react";
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
 * Aniversariantes do mês.
 *
 * A idade mostrada é a que a pessoa COMPLETA neste mês, não a de hoje. Numa
 * lista de aniversariantes, "faz 15 anos" é a informação; "tem 14" seria
 * verdade até a data e inútil depois.
 */

interface Aniversariante {
  id: number;
  nome: string;
  dia: number;
  idade: number;
  tel: string | null;
  classe: string;
  congregacao: string;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function AniversariantesPage() {
  const [mes, setMes] = useState<number | null>(null);
  const [itens, setItens] = useState<Aniversariante[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [hojeDia, setHojeDia] = useState<number | null>(null);

  // O mês corrente só existe no cliente: no servidor, em UTC, a virada do mês
  // acontece três horas antes do que em Pernambuco.
  useEffect(() => {
    const agora = new Date();
    setMes(agora.getMonth() + 1);
    setHojeDia(agora.getDate());
  }, []);

  useEffect(() => {
    if (mes === null) return;
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        setItens(null);
        const res = await fetch(`/api/aniversariantes?mes=${mes}`, {
          signal: controle.signal,
          cache: "no-store",
        });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setItens((await res.json()).itens);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status === 403
            ? "O seu acesso não permite ver esta tela."
            : status
              ? "O servidor respondeu com erro."
              : "Sem resposta do servidor. Verifique a conexão.",
        );
        setItens([]);
      }
    })();
    return () => controle.abort();
  }, [mes]);

  const mesAtual = new Date().getMonth() + 1;

  return (
    <>
      <CabecalhoModulo
        icone={Cake}
        titulo="Aniversariantes"
        descricao="Por mês, congregação e classe"
        total={itens?.length ?? null}
      >
        <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
          <span className="shrink-0 text-brand-200/55">Mês</span>
          <select
            value={mes ?? ""}
            onChange={(e) => setMes(Number(e.target.value))}
            className="min-w-[7rem] bg-transparent text-brand-50 focus:outline-none [&>option]:bg-brand-900"
          >
            {MESES.map((nome, i) => (
              <option key={nome} value={i + 1}>
                {nome}
              </option>
            ))}
          </select>
        </label>
      </CabecalhoModulo>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : itens === null ? (
        <EsqueletoLista linhas={6} />
      ) : itens.length === 0 ? (
        <EstadoVazio
          mensagem={`Nenhum aniversariante em ${MESES[(mes ?? 1) - 1]}.`}
          dica="Só aparecem alunos ativos com data de nascimento cadastrada — 149 dos 323 vieram sem data do sistema antigo."
        />
      ) : (
        <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
          {itens.map((a, i) => {
            // "Hoje" só faz sentido no mês corrente: dia 12 de setembro não é
            // hoje só porque hoje é dia 12 de agosto.
            const ehHoje = mes === mesAtual && a.dia === hojeDia;
            return (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i, 20) * 0.02, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-300",
                  ehHoje ? "bg-gold-400/[0.07]" : "hover:bg-white/[0.03]",
                )}
              >
                {/* Bloco do dia à esquerda: é por ele que se procura numa lista de aniversários */}
                <div className="w-11 shrink-0 text-center">
                  <p
                    className={cn(
                      "font-display text-[1.15rem] font-semibold leading-none tabular-nums",
                      ehHoje ? "text-gold-200" : "text-white",
                    )}
                  >
                    {String(a.dia).padStart(2, "0")}
                  </p>
                  {ehHoje && (
                    <p className="mt-0.5 text-[0.6rem] uppercase tracking-wider text-gold-300/80">
                      hoje
                    </p>
                  )}
                </div>

                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
                    ehHoje
                      ? "bg-gradient-to-br from-gold-500 to-gold-700 ring-gold-300/40"
                      : "bg-gradient-to-br from-brand-500 to-brand-700 ring-white/12",
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
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {a.tel && (
                    <span className="hidden items-center gap-1.5 text-[0.74rem] tabular-nums text-brand-200/55 sm:flex">
                      <Phone className="h-3 w-3" />
                      {a.tel}
                    </span>
                  )}
                  <Badge variant={ehHoje ? "alerta" : "neutro"}>{a.idade} anos</Badge>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </>
  );
}
