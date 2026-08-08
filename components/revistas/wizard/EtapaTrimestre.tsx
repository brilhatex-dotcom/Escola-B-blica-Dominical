"use client";

import { Sparkles } from "lucide-react";
import { SeletorTrimestre } from "@/components/revistas/SeletorTrimestre";
import { PrazoTexto } from "@/components/revistas/PrazoTexto";
import type { PainelDados } from "./tipos";

/**
 * Etapa 2 — o trimestre já vem escolhido (o seletor de 4 trimestres abre no
 * atual, ou no que veio pela URL) — aqui é só CONFIRMAR ou trocar, com o
 * prazo de pagamento already em destaque, para a pessoa nunca avançar sem
 * saber até quando tem para pagar.
 */
export function EtapaTrimestre({
  dados,
  trimestre,
  aoSelecionar,
}: {
  dados: PainelDados;
  trimestre: string;
  aoSelecionar: (chave: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 font-display text-[1.05rem] font-semibold text-white">Qual trimestre você está pedindo?</h2>
      <p className="mb-4 text-[0.82rem] text-brand-200/55">
        Para encomendar com antecedência (a CPAD precisa de tempo para imprimir e enviar), escolha um dos
        trimestres seguintes.
      </p>

      <SeletorTrimestre selecionado={trimestre} aoSelecionar={aoSelecionar} />

      <div className="mt-5 rounded-2xl border border-gold-400/20 bg-gold-400/[0.05] p-5">
        <p className="font-display text-[1.4rem] font-semibold text-white">{dados.trimestre.rotulo}</p>
        {dados.trimestre.tema && (
          <p className="mt-1 flex items-center gap-1.5 text-[0.82rem] text-brand-100/80">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-gold-300/70" />
            {dados.trimestre.tema}
          </p>
        )}
        <div className="mt-3">
          <PrazoTexto
            rotulo="Prazo para pagamento"
            data={dados.dataLimitePagamento}
            dias={dados.prazos.pagamento.dias}
            nivel={dados.prazos.pagamento.nivel}
          />
        </div>
      </div>
    </div>
  );
}
