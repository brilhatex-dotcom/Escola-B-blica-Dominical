"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cake, GraduationCap, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo,
  CampoDeBusca,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
  Filtro,
} from "@/components/dashboard/PaginaModulo";
import { diaEMes, iniciais } from "@/lib/dashboard/formato";

/**
 * Alunos matriculados.
 *
 * A lista mostra APENAS os ativos por padrao. O cadastro tem 323 alunos, dos
 * quais 291 ativos; abrir com todos faria a secretaria procurar entre gente que
 * ja saiu da EBD toda vez que buscasse alguem.
 */

interface AlunoLista {
  id: number;
  nome: string;
  nasc: string | null;
  tel: string | null;
  resp: string | null;
  ativo: boolean;
  classe: { id: number; nome: string; faixa: string } | null;
  congregacao: { id: number; nome: string } | null;
}

interface ClasseOpcao {
  id: number;
  nome: string;
}

export default function AlunosPage() {
  const [busca, setBusca] = useState("");
  const [classe, setClasse] = useState<number | null>(null);
  const [itens, setItens] = useState<AlunoLista[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [classes, setClasses] = useState<ClasseOpcao[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/classes")
      .then((r) => r.json())
      .then((d) => setClasses((d.itens ?? []).map((c: ClasseOpcao) => ({ id: c.id, nome: c.nome }))))
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setErro(null);
        const url = new URL("/api/alunos", window.location.origin);
        if (busca.trim()) url.searchParams.set("busca", busca.trim());
        if (classe) url.searchParams.set("classe", String(classe));
        url.searchParams.set("porPagina", "200");

        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        const dados = await res.json();
        setItens(dados.itens);
        setTotal(dados.total);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        /*
         * "O servidor não respondeu" era mentira quando ele respondia 500 — e
         * mandava procurar problema na internet, que estava perfeita. A
         * mensagem agora separa os dois casos: sem rede o `fetch` lança e não
         * há `status`; com resposta de erro, o problema está no banco.
         */
        const status = (e as { status?: number }).status;
        setErro(
          status
            ? "O servidor respondeu com erro. Isso costuma ser banco de dados não configurado — abra /api/diagnostico para ver o motivo."
            : "Sem resposta do servidor. Verifique a conexão e tente de novo.",
        );
        setItens([]);
      }
    }, 300);

    return () => {
      controle.abort();
      window.clearTimeout(t);
    };
  }, [busca, classe]);

  return (
    <>
      <CabecalhoModulo
        icone={GraduationCap}
        titulo="Alunos"
        descricao="Matriculados e ativos na Escola Bíblica"
        total={total}
      >
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <CampoDeBusca
            valor={busca}
            aoMudar={setBusca}
            placeholder="Buscar por nome…"
            className="min-w-0 flex-1 sm:w-64 sm:flex-none"
          />
          <Filtro rotulo="Classe" opcoes={classes} valor={classe} aoMudar={setClasse} />
        </div>
      </CabecalhoModulo>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : itens === null ? (
        <EsqueletoLista />
      ) : itens.length === 0 ? (
        <EstadoVazio
          mensagem={busca ? `Nenhum aluno encontrado para “${busca}”.` : "Nenhum aluno nesta seleção."}
          dica="Somente alunos ativos aparecem nesta lista."
        />
      ) : (
        <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
          {itens.map((a, i) => (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i, 20) * 0.02, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-300 hover:bg-white/[0.03]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-white/12">
                <span className="font-display text-[0.68rem] font-semibold tracking-wider text-brand-50">
                  {iniciais(a.nome)}
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.88rem] text-brand-50">{a.nome}</p>
                <p className="truncate text-[0.74rem] text-brand-200/55">
                  {a.classe?.nome ?? "Sem classe"}
                  {a.congregacao?.nome && <span className="text-brand-200/40"> · {a.congregacao.nome}</span>}
                </p>
                {a.resp && (
                  <p className="truncate text-[0.7rem] text-brand-200/40">Resp.: {a.resp}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {a.nasc && (
                  <span className="hidden items-center gap-1.5 text-[0.74rem] text-brand-200/50 md:flex">
                    <Cake className="h-3 w-3" />
                    {diaEMes(new Date(a.nasc))}
                  </span>
                )}
                {a.tel && (
                  <span className="hidden items-center gap-1.5 text-[0.74rem] tabular-nums text-brand-200/55 sm:flex">
                    <Phone className="h-3 w-3" />
                    {a.tel}
                  </span>
                )}
                {a.classe?.faixa && <Badge variant="info">{a.classe.faixa}</Badge>}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </>
  );
}
