"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Info, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { FiltroPeriodo } from "@/components/dashboard/FiltroPeriodo";

/**
 * Certificados de frequência.
 *
 * O SISTEMA APURA, A IGREJA DECIDE. Esta tela lista quem atinge o critério —
 * ela não emite nem grava nada. Emitir automaticamente transformaria um
 * reconhecimento da igreja em efeito colateral de uma consulta, e o primeiro
 * erro de digitação numa chamada viraria um certificado indevido com o nome de
 * alguém impresso nele.
 */

interface Apto {
  id: number;
  nome: string;
  classe: string;
  congregacao: string;
  chamadas: number;
  presencas: number;
  taxa: number;
}

export default function CertificadosPage() {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [minimo, setMinimo] = useState(75);
  const [dados, setDados] = useState<{
    itens: Apto[];
    avaliados: number;
    minimoDeChamadas: number;
    periodo: { de: string; ate: string };
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        const url = new URL("/api/relatorios/certificados", window.location.origin);
        if (de) url.searchParams.set("de", de);
        if (ate) url.searchParams.set("ate", ate);
        url.searchParams.set("minimo", String(minimo));
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        const r = await res.json();
        setDados(r);
        if (!de) setDe(r.periodo.de);
        if (!ate) setAte(r.periodo.ate);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(status === 403 ? "O seu acesso não permite ver esta tela." : "Não foi possível carregar a lista.");
      }
    })();
    return () => controle.abort();
  }, [de, ate, minimo]);

  return (
    <>
      <CabecalhoModulo
        icone={Award}
        titulo="Certificados"
        descricao="Quem alcançou o critério de frequência no período"
        total={dados?.itens.length ?? null}
      >
        <div className="flex flex-wrap gap-2">
          <FiltroPeriodo de={de} ate={ate} aoMudar={(c, v) => (c === "de" ? setDe(v) : setAte(v))} />
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
            <span className="shrink-0 text-brand-200/55">Mínimo</span>
            <select
              value={minimo}
              onChange={(e) => setMinimo(Number(e.target.value))}
              className="bg-transparent text-brand-50 focus:outline-none [&>option]:bg-brand-900"
            >
              {[50, 60, 70, 75, 80, 90, 100].map((n) => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
            </select>
          </label>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </CabecalhoModulo>

      <div className="mb-3 flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-300/70" />
        <p className="text-[0.78rem] leading-relaxed text-brand-100/75">
          Esta é a lista de <strong>aptos</strong> — o sistema apura, a emissão continua
          sendo decisão da igreja. Entram apenas alunos com pelo menos{" "}
          <strong>{dados?.minimoDeChamadas ?? 3} chamadas</strong> no período: 100% em duas
          chamadas não é frequência exemplar, é amostra pequena.
        </p>
      </div>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : !dados ? (
        <EsqueletoLista linhas={8} />
      ) : dados.itens.length === 0 ? (
        <EstadoVazio
          mensagem={`Ninguém alcançou ${minimo}% no período.`}
          dica={`${dados.avaliados} alunos foram avaliados. Experimente um percentual menor ou um período maior.`}
        />
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel overflow-hidden rounded-2xl"
        >
          <header className="border-b border-white/8 px-5 py-3">
            <p className="text-[0.78rem] text-brand-100/80">
              <span className="font-semibold text-gold-200">{dados.itens.length}</span> aptos de{" "}
              {dados.avaliados} avaliados
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left">
              <thead>
                <tr className="text-[0.68rem] uppercase tracking-[0.14em] text-brand-200/45">
                  <th className="px-5 py-2.5 font-medium">Aluno</th>
                  <th className="px-3 py-2.5 font-medium">Classe</th>
                  <th className="px-3 py-2.5 font-medium">Congregação</th>
                  <th className="px-3 py-2.5 text-right font-medium">Presenças</th>
                  <th className="px-5 py-2.5 text-right font-medium">Frequência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {dados.itens.map((a) => (
                  <tr key={a.id} className="transition-colors duration-300 hover:bg-white/[0.03]">
                    <td className="px-5 py-2 text-[0.84rem] text-brand-50">{a.nome}</td>
                    <td className="px-3 py-2 text-[0.78rem] text-brand-200/60">{a.classe}</td>
                    <td className="px-3 py-2 text-[0.78rem] text-brand-200/60">{a.congregacao}</td>
                    <td className="px-3 py-2 text-right text-[0.8rem] tabular-nums text-brand-200/70">
                      {a.presencas} / {a.chamadas}
                    </td>
                    <td className="px-5 py-2 text-right text-[0.86rem] font-semibold tabular-nums text-gold-200">
                      {a.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>
      )}
    </>
  );
}
