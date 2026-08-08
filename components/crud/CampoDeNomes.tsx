"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Seletor, type Candidato } from "@/components/dashboard/GerirResponsaveis";

/**
 * Uma lista de nomes, montada por busca — em vez de digitada linha por linha.
 *
 * ============================================================================
 * O VALOR CONTINUA SENDO TEXTO — SÓ A FORMA DE PREENCHER MUDA
 *
 * A rota que grava (Reuniões, por exemplo) sempre esperou um nome por linha
 * numa única string, e `nomesDaLista` (lib/api/legado.ts) já separa e
 * descarta repetidos no servidor. Trocar aqui a caixa de texto por busca não
 * pede mudar nada do lado de lá: o campo continua entregando a mesma string,
 * só que montada clicando em vez de digitando — mais rápido, e sem o erro de
 * grafia que digitar "Jose" no lugar de "José" causaria mais adiante, num
 * relatório que compara nomes.
 *
 * Reaproveita o `Seletor` de `GerirResponsaveis` (busca pessoas E alunos, ou
 * aceita um nome que não está em nenhum cadastro) — mesma busca, sem grudar
 * a pessoa a um vínculo: aqui o nome só entra na lista, nada é gravado até a
 * reunião inteira ser salva.
 * ============================================================================
 */
export function CampoDeNomes({
  value,
  onChange,
  disabled = false,
  placeholder = "Adicionar nome…",
  aoAlternarBusca,
}: {
  value: string;
  onChange: (novoValor: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Avisa quando a busca abre/fecha — o `FormularioModal` usa isso para o Esc não fechar o modal inteiro. */
  aoAlternarBusca?: (ativa: boolean) => void;
}) {
  const nomes = value
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);
  const [buscando, setBuscandoBruto] = useState(false);
  function setBuscando(ativa: boolean) {
    setBuscandoBruto(ativa);
    aoAlternarBusca?.(ativa);
  }

  function adicionar(c: Candidato | null) {
    if (!c) return;
    const nome = c.nome.trim();
    if (!nome || nomes.some((n) => n.toLowerCase() === nome.toLowerCase())) return;
    onChange([...nomes, nome].join("\n"));
  }

  function remover(indice: number) {
    onChange(nomes.filter((_, i) => i !== indice).join("\n"));
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
          // A `key` muda a cada nome adicionado: o `Seletor` remonta do zero,
          // com a busca limpa e o foco de volta — sem isso, adicionar cinco
          // pessoas em fila exigiria apagar o nome anterior à mão a cada vez.
          <Seletor
            key={nomes.length}
            permiteVago={false}
            aoEscolher={adicionar}
            aoCancelar={() => setBuscando(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setBuscando(true)}
            className="flex items-center gap-1.5 py-1 text-[0.78rem] text-gold-200/80 transition-colors hover:text-gold-200"
          >
            <Plus className="h-3.5 w-3.5" />
            {placeholder}
          </button>
        ))}

      {nomes.length === 0 && !buscando && (
        <p className="mt-1 text-[0.7rem] text-brand-200/40">Ninguém adicionado ainda.</p>
      )}
    </div>
  );
}
