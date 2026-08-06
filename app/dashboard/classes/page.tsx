"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ChevronRight, Plus, School, Users } from "lucide-react";
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
 * Classes da EBD.
 *
 * ============================================================================
 * O CARTÃO INTEIRO É UM LINK
 *
 * Clicar na classe abre a classe — com os professores, os alunos e a faixa
 * etária. Era a primeira coisa que se tentava fazer nesta tela e a única que
 * não acontecia; um cartão que mostra um resumo e não leva a lugar nenhum
 * ensina a não clicar.
 *
 * Editar e excluir ficam FORA do link, como botões próprios. Dentro dele, o
 * clique no lápis navegaria para a classe antes de abrir o formulário.
 * ============================================================================
 *
 * A COLUNA "PROFESSORES" MOSTRA PESSOAS, e nao o texto que estava na planilha.
 * Onde o cadastro antigo dizia "Pb. Lourival e Aux. Danilo" — uma string —, aqui
 * aparecem duas pessoas que existem no cadastro e podem ser abertas.
 *
 * Quando a lista de pessoas nao bate com o texto original, o texto e mostrado
 * embaixo, para conferencia. Ele nao e escondido: enquanto a secretaria nao
 * revisar os nomes separados pela importacao, o original e a unica fonte
 * incontestavel do que a igreja escreveu.
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

export default function ClassesPage() {
  const { podeGravar } = useAcesso();
  const podeMexer = podeGravar("classes");

  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<ClasseLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<ClasseLista | null>(null);
  const [recarga, setRecarga] = useState(0);

  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);

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
        if (dados.mensagem) setAviso(dados.mensagem);
        recarregar();
      } catch {
        return "Sem resposta do servidor. Verifique a conexão.";
      }
    },
    [recarregar],
  );

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
  }, [busca, recarga]);

  return (
    <>
      <CabecalhoModulo
        icone={School}
        titulo="Classes"
        descricao="Por congregação, faixa etária e professor"
        total={itens?.length ?? null}
      >
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <CampoDeBusca
            valor={busca}
            aoMudar={setBusca}
            placeholder="Buscar classe…"
            className="w-full sm:w-64"
          />
          {podeMexer && (
            <Button size="sm" onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" />
              Nova classe
            </Button>
          )}
        </div>
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
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {itens.map((c, i) => (
            <motion.article
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: Math.min(i, 20) * 0.03, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "glass-panel group relative overflow-hidden rounded-2xl p-4 transition-all duration-300",
                "hover:ring-1 hover:ring-gold-400/25",
                !c.ativa && "opacity-60",
              )}
            >
              {/*
                O link cobre o cartão inteiro por baixo (`absolute inset-0`), e
                os botões ficam acima dele com `relative z-10`. É o que permite
                "clicar em qualquer lugar para abrir" sem transformar o lápis e a
                lixeira em atalhos para navegar.
              */}
              <Link
                href={`/dashboard/classes/${c.id}`}
                aria-label={`Abrir a classe ${c.nome}`}
                className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60"
              />

              <div className="relative z-10 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-1 truncate font-display text-[0.92rem] font-semibold text-white">
                    {c.nome}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-brand-200/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-gold-300" />
                  </h2>
                  <p className="mt-0.5 truncate text-[0.74rem] text-brand-200/55">
                    {c.congregacao?.nome || "Sem congregação"}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/6 px-2 py-1 text-[0.72rem] tabular-nums text-brand-100">
                  <Users className="h-3 w-3" />
                  {c.alunos}
                </span>
              </div>

              <div className="relative z-10 mt-3 flex flex-wrap items-center gap-1.5">
                {c.faixa && <Badge variant="info">{c.faixa}</Badge>}
                {c.tipoClasse && <Badge variant="neutro">{rotuloDaCategoria(c.tipoClasse)}</Badge>}
                {!c.ativa && <Badge variant="erro">inativa</Badge>}

                {podeMexer && (
                  <AcoesDoRegistro
                    className="ml-auto"
                    nome={c.nome}
                    onEditar={() => setEmEdicao(c)}
                    aviso={
                      c.alunos > 0
                        ? `A classe ${c.nome} tem ${c.alunos} ${c.alunos === 1 ? "aluno matriculado" : "alunos matriculados"}. Por isso ela será desativada, e não apagada — o histórico continua valendo nos relatórios.`
                        : undefined
                    }
                    onExcluir={async () => {
                      await gravar(`/api/classes/${c.id}`, "DELETE", {});
                    }}
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

                {/*
                  O texto original so aparece quando NAO bate com os nomes
                  separados — em "Ana costa" para uma pessoa "Ana costa", repetir
                  seria ruido. Aparece em "Pb. Lourival e Aux. Danilo", onde a
                  separacao em duas pessoas e uma interpretacao que merece
                  conferencia.
                */}
                {c.profOriginal &&
                  c.profOriginal.trim() !==
                    c.professores.map((p) => p.nome).join(" e ") && (
                    <p className="mt-1.5 truncate text-[0.68rem] text-brand-200/35">
                      cadastro original: “{c.profOriginal}”
                    </p>
                  )}
              </div>
            </motion.article>
          ))}
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
