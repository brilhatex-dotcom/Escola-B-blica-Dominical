"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pencil, Search, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAcesso } from "@/components/acesso/AcessoProvider";

/**
 * Definir Dirigente, Vice e Secretário Local de uma congregação.
 *
 * ============================================================================
 * UM SÓ COMPONENTE, USADO NA HIERARQUIA E NAS CONGREGAÇÕES
 *
 * O usuário pediu para atribuir dirigentes nos dois lugares. Em vez de duas
 * telas que fazem a mesma coisa e divergem, é este componente nos dois — grava
 * pela mesma rota (`/api/congregacoes/dirigente`), que escreve o vínculo em
 * `PessoaCargos`. Como o papel de acesso vem do cargo (Fase 08), definir o
 * Dirigente aqui já lhe dá a visão da congregação, sem tela de permissão à parte.
 *
 * Só aparece o botão de editar para quem pode gravar em `hierarquia` — para os
 * demais, é leitura. E a busca de pessoa é a mesma normalização do resto: digita
 * "jose", acha "José".
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

interface PessoaBusca {
  id: number;
  nome: string;
  tratamento: string | null;
}

function Seletor({
  aoEscolher,
  aoCancelar,
}: {
  aoEscolher: (p: PessoaBusca | null) => void;
  aoCancelar: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<PessoaBusca[]>([]);
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
        const res = await fetch(`/api/pessoas?busca=${encodeURIComponent(t)}&porPagina=8`, {
          signal: controle.signal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error();
        const dados = await res.json();
        setResultados(
          (dados.itens ?? []).map((p: { id: number; nome: string; tratamento: string | null }) => ({
            id: p.id,
            nome: p.nome,
            tratamento: p.tratamento,
          })),
        );
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
          placeholder="Buscar pessoa pelo nome…"
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
        <ul className="mt-1.5 max-h-52 overflow-y-auto">
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => aoEscolher(p)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.82rem] text-brand-50 transition-colors hover:bg-white/8"
              >
                <UserRound className="h-3.5 w-3.5 shrink-0 text-brand-300/50" />
                <span className="truncate">
                  {p.tratamento && <span className="text-gold-200/80">{p.tratamento} </span>}
                  {p.nome}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {termo.trim().length >= 2 && !carregando && resultados.length === 0 && (
        <p className="px-2.5 py-2 text-[0.76rem] text-brand-200/45">Ninguém encontrado.</p>
      )}

      {/* Deixar o cargo vago é uma escolha legítima — e explícita. */}
      <button
        type="button"
        onClick={() => aoEscolher(null)}
        className="mt-1 w-full rounded-lg px-2.5 py-2 text-left text-[0.76rem] text-brand-200/55 transition-colors hover:bg-white/5 hover:text-brand-100"
      >
        Deixar o cargo vago
      </button>
    </div>
  );
}

export function GerirResponsaveis({
  congId,
  atuais,
  aoMudar,
}: {
  congId: number;
  /** Quem ocupa cada cargo hoje. */
  atuais: Partial<Record<CargoChave, Pessoa | null>>;
  /** Chamado após gravar, para a tela recarregar. */
  aoMudar?: () => void;
}) {
  const { podeGravar } = useAcesso();
  const editavel = podeGravar("hierarquia");

  const [editando, setEditando] = useState<CargoChave | null>(null);
  const [salvando, setSalvando] = useState<CargoChave | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [local, setLocal] = useState(atuais);

  useEffect(() => setLocal(atuais), [atuais]);

  async function gravar(cargo: CargoChave, pessoa: PessoaBusca | null) {
    setSalvando(cargo);
    setEditando(null);
    setRecado(null);
    try {
      const res = await fetch("/api/congregacoes/dirigente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congId, cargo, pessoaId: pessoa?.id ?? null }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível gravar.");
      setLocal((atual) => ({
        ...atual,
        [cargo]: pessoa ? { id: pessoa.id, nome: pessoa.nome, tratamento: pessoa.tratamento } : null,
      }));
      setRecado(pessoa ? `${cargo}: ${pessoa.nome}.` : `${cargo} ficou vago.`);
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
              <Seletor aoEscolher={(p) => void gravar(chave, p)} aoCancelar={() => setEditando(null)} />
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
