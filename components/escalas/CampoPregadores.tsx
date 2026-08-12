"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Seletor, type Candidato } from "@/components/dashboard/GerirResponsaveis";

/**
 * Quem prega num culto da escala — um ou mais nomes, montados por busca,
 * como o `CampoDeNomes` das Reuniões. A diferença é o TRATAMENTO: a escala
 * oficial escreve "Pb. Reginaldo / Dc. Gilberto", não só o nome, então aqui
 * ele entra junto — vindo do cadastro quando a pessoa tem um, ou digitado à
 * mão quando o pregador é um nome novo, ainda sem tratamento cadastrado.
 *
 * O valor gravado é UMA string com " / " entre os nomes — o mesmo separador
 * que o PDF oficial já usa, para o texto ficar idêntico ao que a secretaria
 * sempre digitou.
 */
export function CampoPregadores({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (novoValor: string) => void;
  disabled?: boolean;
}) {
  const nomes = value
    .split(" / ")
    .map((n) => n.trim())
    .filter(Boolean);
  const [buscando, setBuscando] = useState(false);

  function adicionar(c: Candidato | null) {
    if (!c) return;
    const nome = (c.tratamento ? `${c.tratamento} ${c.nome}` : c.nome).trim();
    if (!nome || nomes.some((n) => n.toLowerCase() === nome.toLowerCase())) return;
    onChange([...nomes, nome].join(" / "));
  }

  function remover(indice: number) {
    onChange(nomes.filter((_, i) => i !== indice).join(" / "));
  }

  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/[0.04] p-2", disabled && "opacity-50")}>
      {nomes.length > 0 && (
        <ul className="mb-1.5 flex flex-wrap gap-1.5">
          {nomes.map((nome, i) => (
            <li
              key={`${nome}-${i}`}
              className="flex items-center gap-1.5 rounded-full bg-white/8 py-1 pl-3 pr-1.5 text-[0.78rem] text-brand-50"
            >
              {nome}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remover(i)}
                  aria-label={`Remover ${nome}`}
                  className="shrink-0 rounded-full p-0.5 text-brand-300/50 hover:text-flame-400"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled &&
        (buscando ? (
          <Seletor
            key={nomes.length}
            permiteVago={false}
            aoEscolher={(c) => {
              adicionar(c);
            }}
            aoCancelar={() => setBuscando(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setBuscando(true)}
            className="flex items-center gap-1.5 py-1 text-[0.78rem] text-gold-200/80 transition-colors hover:text-gold-200"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar pregador…
          </button>
        ))}

      {nomes.length === 0 && !buscando && (
        <p className="mt-1 text-[0.7rem] text-brand-200/40">Ninguém adicionado ainda.</p>
      )}
    </div>
  );
}
