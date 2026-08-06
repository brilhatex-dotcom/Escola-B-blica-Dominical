"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo, EsqueletoLista, EstadoErro,
} from "@/components/dashboard/PaginaModulo";
import { GerirResponsaveis } from "@/components/dashboard/GerirResponsaveis";

/**
 * O organograma do campo.
 *
 * ============================================================================
 * QUEM ACUMULA CARGO APARECE DUAS VEZES — E É ASSIM QUE TEM DE SER
 *
 * O organograma desenha CARGOS, e a mesma pessoa pode ocupar dois. O Pb. que é
 * Supervisor da EBD e também Dirigente de uma congregação precisa estar nas
 * duas caixas: apagar a segunda esconderia exatamente o fato que o organograma
 * existe para mostrar.
 *
 * A CONTAGEM, essa sim, é de pessoas únicas — a regra que a Fase 05 fixou. Por
 * isso o resumo separa "pessoas" de "cargos ocupados" e diz, com todas as
 * letras, quantas acumulam. São números diferentes de propósito, e quem lê
 * precisa saber qual está lendo.
 * ============================================================================
 */

interface Ocupante {
  vinculoId: number; pessoaId: number; nome: string;
  tratamento: string | null; cargo: string; ordem: number;
}
interface Classe { id: number; nome: string; faixa: string; ocupantes: Ocupante[] }
interface Cong { id: number; nome: string; ocupantes: Ocupante[]; classes: Classe[] }
interface Dados {
  campo: Ocupante[];
  congregacoes: Cong[];
  resumo: {
    pessoasUnicas: number; cargosOcupados: number; congregacoes: number;
    classesComProfessor: number; acumulam: number;
  };
}

/** O ocupante de um cargo numa congregação, no formato do seletor de pessoa. */
function ocupanteComoPessoa(c: Cong, cargo: string) {
  const o = c.ocupantes.find((x) => x.cargo === cargo);
  return o ? { id: o.pessoaId, nome: o.nome, tratamento: o.tratamento } : null;
}

function Pessoa({ o, destaque }: { o: Ocupante; destaque?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-2.5",
        destaque
          ? "border-gold-400/25 bg-gold-400/[0.06]"
          : "border-white/8 bg-white/[0.03]",
      )}
    >
      <p className="text-[0.7rem] uppercase tracking-[0.1em] text-gold-300/70">{o.cargo}</p>
      <p className="mt-0.5 truncate text-[0.86rem] font-medium text-white">
        {o.tratamento ? `${o.tratamento} ` : ""}
        {o.nome}
      </p>
    </div>
  );
}

export default function HierarquiaPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);

  const carregar = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/hierarquia", { signal, cache: "no-store" });
      if (!res.ok) throw Object.assign(new Error(), { status: res.status });
      setDados(await res.json());
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const status = (e as { status?: number }).status;
      setErro(
        status === 403
          ? "O seu acesso não permite ver o organograma."
          : "Não foi possível carregar o organograma.",
      );
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  return (
    <>
      <CabecalhoModulo
        icone={Network}
        titulo="Hierarquia"
        descricao="O organograma do campo, do Pastor às classes"
      />

      {erro ? <EstadoErro mensagem={erro} />
      : !dados ? <EsqueletoLista linhas={6} />
      : (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4"
        >
          {/* O resumo — quatro números que NÃO são o mesmo número */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {[
              ["Pessoas", dados.resumo.pessoasUnicas, "sem repetir quem acumula"],
              ["Cargos ocupados", dados.resumo.cargosOcupados, `${dados.resumo.acumulam} pessoa(s) acumulam`],
              ["Congregações", dados.resumo.congregacoes, "no campo"],
              ["Classes com professor", dados.resumo.classesComProfessor, "com alguém no cargo"],
            ].map(([rotulo, valor, nota]) => (
              <div key={rotulo as string} className="glass-panel rounded-2xl px-4 py-3.5">
                <p className="text-[0.7rem] uppercase tracking-[0.1em] text-brand-200/50">{rotulo}</p>
                <p className="mt-1 font-display text-[1.6rem] tabular-nums leading-none text-white">
                  {valor as number}
                </p>
                <p className="mt-1.5 text-[0.7rem] text-brand-300/45">{nota}</p>
              </div>
            ))}
          </div>

          {/* Nível 1 — o campo */}
          <section className="glass-panel rounded-2xl p-4">
            <h2 className="mb-3 font-display text-[0.78rem] uppercase tracking-[0.16em] text-gold-300">
              Campo
            </h2>
            {dados.campo.length === 0 ? (
              <p className="text-[0.8rem] text-brand-300/50">
                Nenhum cargo de campo atribuído. Isso se resolve em Administração → Liderança.
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {dados.campo.map((o) => <Pessoa key={o.vinculoId} o={o} destaque />)}
              </div>
            )}
          </section>

          {/* Nível 2 — as congregações, e dentro delas as classes */}
          <section className="glass-panel rounded-2xl p-2">
            <h2 className="px-2 pb-2 pt-2 font-display text-[0.78rem] uppercase tracking-[0.16em] text-gold-300">
              Congregações
            </h2>
            <div className="divide-y divide-white/6">
              {dados.congregacoes.map((c) => {
                const aberto = aberta === c.id;
                const semNinguem = c.ocupantes.length === 0 && c.classes.length === 0;
                /*
                 * Congregação COM classes e SEM ninguém na direção é o caso
                 * mais comum hoje: os 68 cargos cadastrados são 5 do campo e 63
                 * de professor — nenhum Dirigente foi atribuído ainda.
                 *
                 * Deixar isso passar em branco faria o organograma parecer
                 * completo. É justamente a lacuna que alguém precisa fechar.
                 */
                const semDirecao = c.ocupantes.length === 0 && c.classes.length > 0;
                return (
                  <div key={c.id}>
                    <button
                      type="button"
                      onClick={() => setAberta(aberto ? null : c.id)}
                      aria-expanded={aberto}
                      className="flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 text-brand-300/50 transition-transform duration-300",
                          aberto && "rotate-90",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-[0.88rem] font-medium text-white">
                        {c.nome}
                      </span>
                      {/*
                        A congregação SEM NINGUÉM é a que mais precisa aparecer:
                        é ela que alguém tem de resolver. Marcá-la é mais útil
                        do que escondê-la para a lista ficar bonita.
                      */}
                      {semNinguem ? (
                        <Badge variant="alerta">sem cargo atribuído</Badge>
                      ) : (
                        <span className="flex shrink-0 items-center gap-2">
                          {semDirecao && <Badge variant="alerta">sem dirigente</Badge>}
                          <span className="text-[0.72rem] tabular-nums text-brand-300/45">
                            {/* "0 na direção" ao lado de "sem dirigente" diz a
                                mesma coisa duas vezes — some quando a etiqueta
                                já deu o recado. */}
                            {!semDirecao && `${c.ocupantes.length} na direção · `}
                            {c.classes.length} classe{c.classes.length === 1 ? "" : "s"}
                          </span>
                        </span>
                      )}
                    </button>

                    {aberto && (
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="space-y-3 px-2 pb-4 pl-9"
                      >
                        {/*
                          Definir Dirigente, Vice e Secretário aqui mesmo — é o
                          vínculo que faltava para o organograma receber os
                          dirigentes pela tela. Só aparece editável para quem
                          pode gravar em hierarquia.
                        */}
                        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                          <GerirResponsaveis
                            congId={c.id}
                            atuais={{
                              Dirigente: ocupanteComoPessoa(c, "Dirigente"),
                              "Vice-Dirigente": ocupanteComoPessoa(c, "Vice-Dirigente"),
                              "Secretário Local": ocupanteComoPessoa(c, "Secretário Local"),
                            }}
                            aoMudar={() => void carregar()}
                          />
                        </div>

                        {c.classes.length > 0 && (
                          <p className="pt-1 text-[0.64rem] uppercase tracking-[0.14em] text-brand-200/40">
                            Classes
                          </p>
                        )}

                        {c.classes.map((cl) => (
                          <div key={cl.id} className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
                            <p className="text-[0.78rem] font-medium text-brand-100/85">
                              {cl.nome}
                              {cl.faixa && (
                                <span className="ml-2 text-[0.7rem] text-brand-300/45">{cl.faixa}</span>
                              )}
                            </p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {cl.ocupantes.map((o) => <Pessoa key={o.vinculoId} o={o} />)}
                            </div>
                          </div>
                        ))}

                        {semNinguem && (
                          <p className="text-[0.78rem] text-brand-300/50">
                            Ninguém com cargo cadastrado nesta congregação.
                          </p>
                        )}

                        {semDirecao && (
                          <p className="text-[0.78rem] text-gold-200/70">
                            Nenhum Dirigente ou Vice cadastrado — as classes abaixo estão
                            sem ninguém respondendo por elas no organograma. Isso se
                            resolve em Professores, atribuindo o cargo à pessoa.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </motion.div>
      )}
    </>
  );
}
