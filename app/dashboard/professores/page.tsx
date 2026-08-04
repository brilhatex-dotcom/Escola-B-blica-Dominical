"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Phone, TriangleAlert, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo,
  CampoDeBusca,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { iniciais } from "@/lib/dashboard/formato";

/**
 * Pessoas e cargos.
 *
 * ESTA E A TELA QUE O SISTEMA ANTIGO NAO CONSEGUIA TER. La, "professor" era um
 * texto dentro da classe; quem dava aula em duas classes aparecia duas vezes e
 * nao havia como abrir o cadastro de ninguem.
 *
 * Aqui cada linha e UMA PESSOA, com os cargos dela ao lado. Quem acumula funcao
 * aparece uma vez, com duas etiquetas — e o contraste entre "59 pessoas" e "68
 * cargos" fica visivel item a item, nao so no numero do painel.
 */

interface CargoDaPessoa {
  id: number;
  origem: string | null;
  cargo: { id: number; nome: string; ordem: number; escopo: string };
  congregacao: { id: number; nome: string } | null;
  classe: { id: number; nome: string } | null;
}

interface PessoaLista {
  id: number;
  nome: string;
  tratamento: string | null;
  tel: string | null;
  foto: string | null;
  ativo: boolean;
  revisar: boolean;
  observacao: string | null;
  cargos: CargoDaPessoa[];
  totalCargos: number;
}

function Conteudo() {
  const params = useSearchParams();
  const soRevisar = params.get("revisar") === "1";

  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<PessoaLista[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  /*
   * Espera 300ms depois da ultima tecla antes de consultar.
   *
   * Sem isso, digitar "raimundo" dispara oito requisicoes, e a resposta da
   * quarta pode chegar depois da oitava e sobrescrever a lista com um resultado
   * velho. O `AbortController` fecha a lacuna que sobra: ao trocar a busca, a
   * consulta anterior e cancelada antes de responder.
   */
  useEffect(() => {
    const controle = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setErro(null);
        const url = new URL("/api/pessoas", window.location.origin);
        if (busca.trim()) url.searchParams.set("busca", busca.trim());
        if (soRevisar) url.searchParams.set("revisar", "1");
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
  }, [busca, soRevisar]);

  const acumulam = useMemo(
    () => (itens ?? []).filter((p) => p.totalCargos > 1).length,
    [itens],
  );

  return (
    <>
      <CabecalhoModulo
        icone={UserRound}
        titulo={soRevisar ? "Cadastros a conferir" : "Pessoas e cargos"}
        descricao={
          soRevisar
            ? "Possíveis duplicidades encontradas na importação"
            : "Cadastro único — uma pessoa em vários cargos continua sendo uma pessoa"
        }
        total={total}
      >
        <CampoDeBusca
          valor={busca}
          aoMudar={setBusca}
          placeholder="Buscar por nome…"
          className="w-full sm:w-72"
        />
      </CabecalhoModulo>

      {!soRevisar && acumulam > 0 && (
        <p className="mb-3 text-[0.78rem] text-brand-200/55">
          <span className="font-semibold text-gold-200">{acumulam}</span>{" "}
          {acumulam === 1 ? "pessoa exerce" : "pessoas exercem"} mais de uma função.
        </p>
      )}

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : itens === null ? (
        <EsqueletoLista />
      ) : itens.length === 0 ? (
        <EstadoVazio
          mensagem={busca ? `Ninguém encontrado para “${busca}”.` : "Nenhuma pessoa cadastrada."}
          dica={
            busca
              ? "A busca ignora acentos e maiúsculas."
              : "O cadastro é preenchido pela importação do sistema antigo."
          }
        />
      ) : (
        <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
          {itens.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              // O escalonamento para no 20º item: além disso, o último da lista
              // esperaria segundos para aparecer, e a animação vira atraso.
              transition={{ duration: 0.4, delay: Math.min(i, 20) * 0.02, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-300 hover:bg-white/[0.03]"
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
                  p.revisar
                    ? "bg-gold-400/15 ring-gold-400/30"
                    : "bg-gradient-to-br from-brand-500 to-brand-700 ring-white/12",
                )}
              >
                <span className="font-display text-[0.68rem] font-semibold tracking-wider text-brand-50">
                  {iniciais(p.nome)}
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.88rem] text-brand-50">
                  {p.tratamento && <span className="text-gold-200/80">{p.tratamento} </span>}
                  {p.nome}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {p.cargos.map((c) => (
                    <span key={c.id} className="text-[0.72rem] text-brand-200/60">
                      {c.cargo.nome}
                      {c.classe && <span className="text-brand-200/40"> · {c.classe.nome}</span>}
                    </span>
                  ))}
                  {p.cargos.length === 0 && (
                    <span className="text-[0.72rem] italic text-brand-200/40">Sem função ativa</span>
                  )}
                </div>

                {p.revisar && p.observacao && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[0.72rem] leading-snug text-gold-200/75">
                    <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                    {p.observacao}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {p.tel && (
                  <span className="hidden items-center gap-1.5 text-[0.74rem] tabular-nums text-brand-200/55 sm:flex">
                    <Phone className="h-3 w-3" />
                    {p.tel}
                  </span>
                )}
                {/*
                  A etiqueta so aparece com 2+ cargos. Em quem tem um, "1 cargo"
                  seria ruido repetido em cinquenta linhas — e o que interessa
                  destacar e justamente quem acumula.
                */}
                {p.totalCargos > 1 && (
                  <Badge variant="alerta">{p.totalCargos} cargos</Badge>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * `useSearchParams` exige Suspense no App Router.
 *
 * Sem ele, o Next se recusa a gerar a pagina estaticamente e o build falha com
 * "missing suspense boundary" — a rota inteira cairia para renderizacao sob
 * demanda por causa de um unico parametro de query.
 */
export default function ProfessoresPage() {
  return (
    <Suspense fallback={<EsqueletoLista />}>
      <Conteudo />
    </Suspense>
  );
}
