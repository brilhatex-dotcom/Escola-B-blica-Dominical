"use client";

import { useEffect, useRef, useState } from "react";
import { Check, GraduationCap, Loader2, Pencil, Search, UserPlus, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAcesso } from "@/components/acesso/AcessoProvider";

/**
 * Definir Dirigente, Vice e Secretário Local de uma congregação.
 *
 * ============================================================================
 * UM SÓ COMPONENTE, USADO NA HIERARQUIA E NAS CONGREGAÇÕES
 *
 * Grava pela mesma rota (`/api/congregacoes/dirigente`), que escreve o vínculo
 * em `PessoaCargos`. Como o papel de acesso vem do cargo (Fase 08), definir o
 * Dirigente aqui já lhe dá a visão da congregação, sem tela de permissão à parte.
 *
 * A BUSCA ACHA PESSOAS E ALUNOS. Quem vai virar dirigente pode ainda não ter
 * cargo nenhum — "Aux. Bartolomeu" estava só como aluno. O seletor mostra os
 * dois; ao escolher um aluno, a rota cria a pessoa na hora. E o tratamento
 * digitado ("Aux.") é ignorado na busca, que casa pelo nome.
 * ============================================================================
 */

export interface Pessoa {
  id: number;
  nome: string;
  tratamento: string | null;
}

const CARGOS = [
  { chave: "Dirigente", rotulo: "Dirigente" },
  { chave: "Vice-Dirigente", rotulo: "Vice-Dirigente" },
  { chave: "Secretário Local", rotulo: "Secretário Local" },
] as const;

type CargoChave = (typeof CARGOS)[number]["chave"];

export interface Candidato {
  tipo: "pessoa" | "aluno" | "novo";
  id: number;
  nome: string;
  tratamento: string | null;
  subtitulo: string;
}

/**
 * A busca de "quem vai receber este cargo" — pessoa, aluno a promover, ou
 * nome novo. Exportado porque `GerirProfessoresDaClasse` (Fase 16) usa a
 * mesma busca para outro cargo (Professor), com outro formato de lista
 * (vários professores por classe, não um só "vago/ocupado").
 */
export function Seletor({
  aoEscolher,
  aoCancelar,
  permiteVago = true,
}: {
  aoEscolher: (c: Candidato | null) => void;
  aoCancelar: () => void;
  /** "Deixar o cargo vago" só faz sentido num cargo de UM titular (Dirigente). */
  permiteVago?: boolean;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Candidato[]>([]);
  const [carregando, setCarregando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) {
      setResultados([]);
      return;
    }
    const controle = new AbortController();
    setCarregando(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pessoas/candidatos?q=${encodeURIComponent(t)}`, {
          signal: controle.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error();
        const dados = await res.json();
        setResultados(dados.candidatos ?? []);
      } catch {
        setResultados([]);
      } finally {
        setCarregando(false);
      }
    }, 250);
    return () => {
      controle.abort();
      clearTimeout(timer);
    };
  }, [termo]);

  return (
    <div className="mt-2 rounded-xl border border-gold-400/25 bg-brand-900/40 p-2">
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-brand-300/60" />
        <input
          ref={campo}
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && aoCancelar()}
          placeholder="Buscar pessoa ou aluno pelo nome…"
          className="min-w-0 flex-1 bg-transparent py-2 text-[0.82rem] text-brand-50 placeholder:text-brand-200/40 focus:outline-none"
        />
        {carregando && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-300/50" />}
        <button
          type="button"
          onClick={aoCancelar}
          aria-label="Cancelar"
          className="shrink-0 rounded p-1 text-brand-200/60 hover:text-brand-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {resultados.length > 0 && (
        <ul className="mt-1.5 max-h-56 overflow-y-auto">
          {resultados.map((c) => (
            <li key={`${c.tipo}-${c.id}`}>
              <button
                type="button"
                onClick={() => aoEscolher(c)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/8"
              >
                {c.tipo === "aluno" ? (
                  <GraduationCap className="h-3.5 w-3.5 shrink-0 text-brand-300/50" />
                ) : (
                  <UserRound className="h-3.5 w-3.5 shrink-0 text-brand-300/50" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.82rem] text-brand-50">
                    {c.tratamento && <span className="text-gold-200/80">{c.tratamento} </span>}
                    {c.nome}
                  </span>
                  <span className="block truncate text-[0.7rem] text-brand-200/50">{c.subtitulo}</span>
                </span>
                {c.tipo === "aluno" && (
                  <span className="shrink-0 rounded-full bg-white/6 px-1.5 py-0.5 text-[0.58rem] uppercase tracking-wider text-brand-200/50">
                    aluno
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {termo.trim().length >= 2 && !carregando && resultados.length === 0 && (
        <p className="px-2.5 pt-2 text-[0.76rem] text-brand-200/45">
          Ninguém encontrado entre pessoas ou alunos.
        </p>
      )}

      {/*
        Cadastrar alguém que não está em lugar nenhum. Aparece sempre que há
        um nome digitado — mesmo com resultados —, porque a pessoa certa pode
        não estar na lista. O nome vai como está; o servidor separa o
        tratamento e evita duplicar quem já existe.
      */}
      {termo.trim().length >= 2 && (
        <button
          type="button"
          onClick={() =>
            aoEscolher({ tipo: "novo", id: 0, nome: termo.trim(), tratamento: null, subtitulo: "" })
          }
          className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-gold-400/30 px-2.5 py-2 text-left text-[0.8rem] text-gold-200/90 transition-colors hover:bg-gold-400/[0.08]"
        >
          <UserPlus className="h-3.5 w-3.5 shrink-0" />
          Cadastrar “{termo.trim()}” como pessoa nova
        </button>
      )}

      {permiteVago && (
        <button
          type="button"
          onClick={() => aoEscolher(null)}
          className="mt-1 w-full rounded-lg px-2.5 py-2 text-left text-[0.76rem] text-brand-200/55 transition-colors hover:bg-white/5 hover:text-brand-100"
        >
          Deixar o cargo vago
        </button>
      )}
    </div>
  );
}

export function GerirResponsaveis({
  congId,
  atuais,
  aoMudar,
}: {
  congId: number;
  atuais: Partial<Record<CargoChave, Pessoa | null>>;
  aoMudar?: () => void;
}) {
  const { podeGravar } = useAcesso();
  // "congregacoes", não "hierarquia": estes três cargos são de CONGREGAÇÃO
  // (Dirigente/Vice/Secretário Local) — quem dirige a própria congregação
  // pode defini-los. Os cargos de CAMPO continuam só em Administração →
  // Liderança, que usa /api/lideranca e a permissão "hierarquia".
  const editavel = podeGravar("congregacoes");

  const [editando, setEditando] = useState<CargoChave | null>(null);
  const [salvando, setSalvando] = useState<CargoChave | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [local, setLocal] = useState(atuais);

  useEffect(() => setLocal(atuais), [atuais]);

  async function gravar(cargo: CargoChave, escolha: Candidato | null) {
    setSalvando(cargo);
    setEditando(null);
    setRecado(null);
    try {
      const res = await fetch("/api/congregacoes/dirigente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          congId,
          cargo,
          // Pessoa existente → pessoaId; aluno a promover → alunoId; nome novo →
          // novoNome; sem escolha, pessoaId null deixa o cargo vago.
          pessoaId: escolha?.tipo === "pessoa" ? escolha.id : escolha ? undefined : null,
          alunoId: escolha?.tipo === "aluno" ? escolha.id : undefined,
          novoNome: escolha?.tipo === "novo" ? escolha.nome : undefined,
        }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível gravar.");

      setLocal((atual) => ({
        ...atual,
        [cargo]: corpo.pessoaId
          ? { id: corpo.pessoaId, nome: corpo.nome, tratamento: escolha?.tratamento ?? null }
          : null,
      }));
      setRecado(corpo.pessoaId ? `${cargo}: ${corpo.nome}.` : `${cargo} ficou vago.`);
      aoMudar?.();
    } catch (e) {
      setRecado((e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="space-y-2">
      {CARGOS.map(({ chave, rotulo }) => {
        const pessoa = local[chave] ?? null;
        return (
          <div key={chave}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.64rem] uppercase tracking-[0.14em] text-brand-200/45">{rotulo}</p>
                <p className={cn("truncate text-[0.86rem]", pessoa ? "text-brand-50" : "italic text-brand-200/45")}>
                  {pessoa
                    ? `${pessoa.tratamento ? pessoa.tratamento + " " : ""}${pessoa.nome}`
                    : "Vago"}
                </p>
              </div>

              {salvando === chave ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-300/50" />
              ) : editavel ? (
                <button
                  type="button"
                  onClick={() => setEditando(editando === chave ? null : chave)}
                  aria-label={`Definir ${rotulo}`}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-brand-200/60 transition-colors hover:border-gold-400/30 hover:text-gold-200"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {editando === chave && (
              <Seletor aoEscolher={(c) => void gravar(chave, c)} aoCancelar={() => setEditando(null)} />
            )}
          </div>
        );
      })}

      {recado && (
        <p className="flex items-center gap-1.5 text-[0.76rem] text-brand-100/80">
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
          {recado}
        </p>
      )}
    </div>
  );
}
