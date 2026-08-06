"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, Check, ChevronRight, Plus, School, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo,
  CampoDeBusca,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { AcoesDoRegistro } from "@/components/crud/AcoesDoRegistro";
import { FormularioModal } from "@/components/crud/FormularioModal";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { CATEGORIAS_DE_CLASSE, rotuloDaCategoria } from "@/lib/ebd/categorias";

/**
 * Classes da EBD, agrupadas por congregação.
 *
 * ============================================================================
 * SÃO 53 CLASSES — LISTÁ-LAS SOLTAS É UMA PAREDE
 *
 * Uma grade com 53 cartões obriga a rolar procurando a congregação certa. Aqui
 * cada congregação é uma seção que abre e fecha: a tela começa recolhida,
 * mostrando quantas classes e alunos cada uma tem, e a pessoa abre só a que
 * quer ver.
 *
 * A busca continua funcionando por cima disso: digitar um nome ABRE
 * automaticamente as seções que têm classe correspondente, para o resultado não
 * ficar escondido atrás de uma seção fechada.
 * ============================================================================
 *
 * A COLUNA "PROFESSORES" MOSTRA PESSOAS, e não o texto que estava na planilha.
 * Onde o cadastro antigo dizia "Pb. Lourival e Aux. Danilo" — uma string —, aqui
 * aparecem as pessoas que existem no cadastro.
 */

interface ClasseLista {
  id: number;
  nome: string;
  faixa: string;
  tipoClasse: string;
  ativa: boolean;
  profOriginal: string | null;
  congregacao: { id: number; nome: string } | null;
  alunos: number;
  professores: Array<{ id: number; nome: string; tratamento: string | null }>;
}

interface Grupo {
  id: number;
  nome: string;
  classes: ClasseLista[];
  alunos: number;
}

/**
 * O cartão da classe.
 *
 * ============================================================================
 * O CARTÃO INTEIRO É UM LINK
 *
 * Clicar na classe abre a classe — com os professores, os alunos e a faixa
 * etária. Era a primeira coisa que se tentava fazer nesta tela e a única que
 * não acontecia; um cartão que mostra um resumo e não leva a lugar nenhum
 * ensina a não clicar.
 *
 * O link cobre o cartão por baixo (`absolute inset-0`) e os botões ficam acima
 * dele (`relative z-10`). É o que permite "clicar em qualquer lugar para abrir"
 * sem transformar o lápis e a lixeira em atalhos para navegar.
 * ============================================================================
 */
function Cartao({
  c,
  podeMexer,
  aoEditar,
  aoExcluir,
}: {
  c: ClasseLista;
  podeMexer: boolean;
  aoEditar: () => void;
  aoExcluir: () => Promise<void>;
}) {
  return (
    <article
      className={cn(
        "glass-panel group relative overflow-hidden rounded-2xl p-4 transition-all duration-300",
        "hover:ring-1 hover:ring-gold-400/25",
        !c.ativa && "opacity-60",
      )}
    >
      <Link
        href={`/dashboard/classes/${c.id}`}
        aria-label={`Abrir a classe ${c.nome}`}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60"
      />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1 truncate font-display text-[0.9rem] font-semibold text-white">
          {c.nome}
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-brand-200/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-gold-300" />
        </h3>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/6 px-2 py-1 text-[0.72rem] tabular-nums text-brand-100">
          <Users className="h-3 w-3" />
          {c.alunos}
        </span>
      </div>

      <div className="relative z-10 mt-2.5 flex flex-wrap items-center gap-1.5">
        {c.faixa && <Badge variant="info">{c.faixa}</Badge>}
        {c.tipoClasse && <Badge variant="neutro">{rotuloDaCategoria(c.tipoClasse)}</Badge>}
        {!c.ativa && <Badge variant="erro">inativa</Badge>}

        {podeMexer && (
          <AcoesDoRegistro
            className="ml-auto"
            nome={c.nome}
            onEditar={aoEditar}
            aviso={
              c.alunos > 0
                ? `A classe ${c.nome} tem ${c.alunos} ${c.alunos === 1 ? "aluno matriculado" : "alunos matriculados"}. Por isso ela será desativada, e não apagada — o histórico continua valendo nos relatórios.`
                : undefined
            }
            onExcluir={aoExcluir}
          />
        )}
      </div>

      <div className="relative z-10 mt-3 border-t border-white/8 pt-3">
        <p className="text-[0.64rem] uppercase tracking-[0.16em] text-brand-200/40">
          {c.professores.length === 1 ? "Professor" : "Professores"}
        </p>
        {c.professores.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {c.professores.map((p) => (
              <li key={p.id} className="truncate text-[0.8rem] text-brand-50">
                {p.tratamento && <span className="text-gold-200/80">{p.tratamento} </span>}
                {p.nome}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[0.8rem] italic text-brand-200/45">Sem professor definido</p>
        )}

        {c.profOriginal &&
          c.profOriginal.trim() !== c.professores.map((p) => p.nome).join(" e ") && (
            <p className="mt-1.5 truncate text-[0.68rem] text-brand-200/35">
              cadastro original: “{c.profOriginal}”
            </p>
          )}
      </div>
    </article>
  );
}

export default function ClassesPage() {
  const { podeGravar } = useAcesso();
  const podeMexer = podeGravar("classes");

  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<ClasseLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abertas, setAbertas] = useState<Set<number>>(new Set());
  const [aviso, setAviso] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<ClasseLista | null>(null);
  const [recarga, setRecarga] = useState(0);

  /** Manda ao servidor e recarrega. Devolve a mensagem de erro, se houver. */
  const gravar = useCallback(
    async (url: string, metodo: string, corpo: unknown): Promise<string | void> => {
      try {
        const res = await fetch(url, {
          method: metodo,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        });
        const dados = await res.json().catch(() => ({}));
        if (!res.ok) return dados.erro ?? "Não foi possível salvar.";
        // A resposta da exclusão diz se APAGOU ou apenas arquivou — e a tela
        // repete isso. Responder "excluído" e deixar o registro na lista de
        // inativos, sem avisar, ensina a não confiar no botão.
        if (dados.mensagem) setAviso(dados.mensagem);
        setRecarga((n) => n + 1);
      } catch {
        return "Sem resposta do servidor. Verifique a conexão.";
      }
    },
    [],
  );

  // Semeado pela busca global (?busca=): clicar numa classe cai aqui filtrado.
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("busca");
    if (b) setBusca(b);
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setErro(null);
        const url = new URL("/api/classes", window.location.origin);
        if (busca.trim()) url.searchParams.set("busca", busca.trim());
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        setItens((await res.json()).itens);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
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
  }, [busca, recarga]);

  const grupos = useMemo<Grupo[]>(() => {
    if (!itens) return [];
    const mapa = new Map<number, Grupo>();
    for (const c of itens) {
      const id = c.congregacao?.id ?? 0;
      const nome = c.congregacao?.nome ?? "Sem congregação";
      let g = mapa.get(id);
      if (!g) {
        g = { id, nome, classes: [], alunos: 0 };
        mapa.set(id, g);
      }
      g.classes.push(c);
      g.alunos += c.alunos;
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [itens]);

  // Com busca, todas as seções com resultado abrem sozinhas — senão o achado
  // ficaria escondido atrás de uma seção fechada.
  const buscando = busca.trim().length > 0;

  function alternar(id: number) {
    setAbertas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  }

  return (
    <>
      <CabecalhoModulo
        icone={School}
        titulo="Classes"
        descricao="Por congregação — clique para abrir"
        total={itens?.length ?? null}
      >
        <CampoDeBusca valor={busca} aoMudar={setBusca} placeholder="Buscar classe…" className="w-full sm:w-72" />
      </CabecalhoModulo>

      {aviso && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-[0.82rem] text-emerald-200">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : itens === null ? (
        <EsqueletoLista />
      ) : itens.length === 0 ? (
        <EstadoVazio mensagem={busca ? `Nenhuma classe para “${busca}”.` : "Nenhuma classe cadastrada."} />
      ) : (
        <div className="space-y-2.5">
          {grupos.map((g) => {
            const aberto = buscando || abertas.has(g.id);
            return (
              <div key={g.id} className="glass-panel overflow-hidden rounded-2xl">
                <button
                  type="button"
                  onClick={() => alternar(g.id)}
                  aria-expanded={aberto}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-brand-300/50 transition-transform duration-300",
                      aberto && "rotate-90",
                    )}
                  />
                  <Building2 className="h-4 w-4 shrink-0 text-gold-300/70" />
                  <span className="min-w-0 flex-1 truncate font-display text-[0.92rem] font-semibold text-white">
                    {g.nome}
                  </span>
                  <span className="shrink-0 text-[0.72rem] tabular-nums text-brand-300/50">
                    {g.classes.length} classe{g.classes.length === 1 ? "" : "s"} · {g.alunos} aluno
                    {g.alunos === 1 ? "" : "s"}
                  </span>
                </button>

                {aberto && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid gap-3 border-t border-white/6 p-3 sm:grid-cols-2 2xl:grid-cols-3"
                  >
                    {g.classes.map((c) => (
                      <Cartao
                        key={c.id}
                        c={c}
                        podeMexer={podeMexer}
                        aoEditar={() => setEmEdicao(c)}
                        aoExcluir={async () => {
                          await gravar(`/api/classes/${c.id}`, "DELETE", {});
                        }}
                      />
                    ))}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <FormularioModal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Nova classe"
        descricao="A categoria define qual lição e qual revista a classe recebe."
        campos={CAMPOS_CLASSE}
        valores={{ nome: "", tipoClasse: "", faixa: "" }}
        rotuloGravar="Criar classe"
        aoGravar={(v) =>
          gravar("/api/classes", "POST", {
            nome: v.nome,
            tipoClasse: v.tipoClasse,
            faixa: v.faixa,
          })
        }
      />

      <FormularioModal
        aberto={emEdicao !== null}
        aoFechar={() => setEmEdicao(null)}
        titulo="Editar classe"
        campos={CAMPOS_CLASSE}
        valores={{
          nome: emEdicao?.nome ?? "",
          tipoClasse: emEdicao?.tipoClasse ?? "",
          faixa: emEdicao?.faixa ?? "",
        }}
        aoGravar={(v) =>
          gravar(`/api/classes/${emEdicao?.id}`, "PATCH", {
            nome: v.nome,
            tipoClasse: v.tipoClasse,
            faixa: v.faixa,
          })
        }
      />
    </>
  );
}

const CAMPOS_CLASSE = [
  { chave: "nome", rotulo: "Nome da classe", obrigatorio: true, largo: true },
  {
    chave: "tipoClasse",
    rotulo: "Categoria",
    tipo: "lista" as const,
    obrigatorio: true,
    opcoes: CATEGORIAS_DE_CLASSE.map((c) => ({ valor: c.chave, rotulo: c.rotulo })),
    ajuda: "É por ela que chegam a lição do trimestre e o pedido de revistas.",
  },
  {
    chave: "faixa",
    rotulo: "Faixa etária",
    placeholder: "ex.: 10 a 11 anos",
    ajuda: "Texto livre — aparece na chamada e na ficha da classe.",
  },
];
