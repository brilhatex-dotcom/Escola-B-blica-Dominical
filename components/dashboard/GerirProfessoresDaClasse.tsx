"use client";

import { useState } from "react";
import { Loader2, Plus, UserRound, X } from "lucide-react";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { Seletor, type Candidato } from "./GerirResponsaveis";

/**
 * Quem dá aula numa classe — adicionar e remover (Fase 16).
 *
 * Diferente de `GerirResponsaveis` (um titular por cargo — Dirigente,
 * Vice…), uma classe pode ter mais de um professor ao mesmo tempo, então não
 * há "vago": só uma lista de pílulas removíveis e um botão para adicionar
 * mais um.
 */

export interface ProfessorDaClasse {
  vinculoId: number;
  id: number;
  nome: string;
  tratamento: string | null;
}

export function GerirProfessoresDaClasse({
  classeId,
  professores,
  aoMudar,
}: {
  classeId: number;
  professores: ProfessorDaClasse[];
  aoMudar: () => void;
}) {
  const { podeGravar } = useAcesso();
  const editavel = podeGravar("classes");

  const [adicionando, setAdicionando] = useState(false);
  const [salvando, setSalvando] = useState<number | "novo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar(escolha: Candidato | null) {
    setAdicionando(false);
    if (!escolha) return;
    setSalvando("novo");
    setErro(null);
    try {
      const res = await fetch(`/api/classes/${classeId}/professores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pessoaId: escolha.tipo === "pessoa" ? escolha.id : undefined,
          alunoId: escolha.tipo === "aluno" ? escolha.id : undefined,
          novoNome: escolha.tipo === "novo" ? escolha.nome : undefined,
        }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível adicionar.");
      aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  async function remover(vinculoId: number) {
    setSalvando(vinculoId);
    setErro(null);
    try {
      const res = await fetch(`/api/classes/${classeId}/professores?vinculoId=${vinculoId}`, { method: "DELETE" });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível remover.");
      aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div>
      {professores.length === 0 ? (
        <p className="text-[0.82rem] italic text-brand-200/45">Nenhum professor registrado.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {professores.map((p) => (
            <li
              key={p.vinculoId}
              className="flex items-center gap-1.5 rounded-full bg-white/6 py-1 pl-3 pr-1.5 text-[0.82rem] text-brand-50"
            >
              <UserRound className="h-3 w-3 shrink-0 text-brand-300/60" />
              {p.tratamento && <span className="text-gold-200/80">{p.tratamento}</span>}
              {p.nome}
              {editavel && (
                salvando === p.vinculoId ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-brand-300/60" />
                ) : (
                  <button
                    type="button"
                    onClick={() => void remover(p.vinculoId)}
                    aria-label={`Remover ${p.nome} desta classe`}
                    className="shrink-0 rounded-full p-0.5 text-brand-300/50 hover:text-flame-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {editavel && (
        <div className="mt-2">
          {adicionando ? (
            <Seletor
              permiteVago={false}
              aoEscolher={(c) => void adicionar(c)}
              aoCancelar={() => setAdicionando(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdicionando(true)}
              disabled={salvando === "novo"}
              className="flex items-center gap-1.5 text-[0.78rem] text-gold-200/80 transition-colors hover:text-gold-200"
            >
              {salvando === "novo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Adicionar professor
            </button>
          )}
        </div>
      )}

      {erro && <p className="mt-1.5 text-[0.76rem] text-flame-400">{erro}</p>}
    </div>
  );
}
