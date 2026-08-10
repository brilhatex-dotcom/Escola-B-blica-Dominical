"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CartaoCategoria } from "./CartaoCategoria";
import { chaveItem, type DadosPedido } from "./tipos";

/**
 * Etapa 3 — as quantidades, uma categoria por card.
 *
 * As categorias que a congregação de fato tem classe (a sugestão calculada é
 * maior que zero) vêm primeiro, abertas; as que não tem ficam recolhidas em
 * "Outras categorias" — continuam editáveis (a igreja pode pedir revista de
 * uma categoria sem classe hoje), só não competem por atenção com o que
 * importa na maioria das vezes.
 */
export function EtapaQuantidades({
  dados,
  valores,
  aoMudar,
  aoUsarSugestoes,
}: {
  dados: DadosPedido;
  valores: Record<string, string>;
  aoMudar: (chave: string, valor: string) => void;
  aoUsarSugestoes: () => void;
}) {
  const [outrasAbertas, setOutrasAbertas] = useState(false);

  const { principais, outras, totalAlunosCadastrados, totalProfessoresCadastrados } = useMemo(() => {
    const porCategoria = new Map<string, typeof dados.linhas>();
    for (const l of dados.linhas) {
      if (l.precoUnitario === null && l.sugestao === 0 && !valores[chaveItem(l.categoria, l.tipo)]) continue;
      const lista = porCategoria.get(l.categoria) ?? [];
      lista.push(l);
      porCategoria.set(l.categoria, lista);
    }
    const principais: { categoria: string; rotulo: string; linhas: typeof dados.linhas }[] = [];
    const outras: { categoria: string; rotulo: string; linhas: typeof dados.linhas }[] = [];
    for (const [categoria, linhas] of porCategoria) {
      const temSugestao = linhas.some((l) => l.sugestao > 0);
      const temQuantidade = linhas.some((l) => Number(valores[chaveItem(categoria, l.tipo)] || 0) > 0);
      const item = { categoria, rotulo: linhas[0].categoriaRotulo, linhas };
      (temSugestao || temQuantidade ? principais : outras).push(item);
    }
    const totalAlunos = dados.linhas.filter((l) => l.grupo === "aluno").reduce((s, l) => s + l.sugestao, 0);
    const totalProfessores = dados.linhas.filter((l) => l.grupo === "professor").reduce((s, l) => s + l.sugestao, 0);
    return { principais, outras, totalAlunosCadastrados: totalAlunos, totalProfessoresCadastrados: totalProfessores };
  }, [dados.linhas, valores]);

  return (
    <div>
      <h2 className="mb-1 font-display text-[1.05rem] font-semibold text-white">Quantas revistas você precisa?</h2>
      <p className="mb-4 text-[0.82rem] text-brand-200/55">
        Ajuste com os botões ou digite direto — o total ao lado atualiza sozinho.
      </p>

      {(totalAlunosCadastrados > 0 || totalProfessoresCadastrados > 0) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-400/20 bg-gold-400/[0.05] p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.12em] text-gold-300/80">
              <Wand2 className="h-3.5 w-3.5" />
              Quantidade sugerida
            </p>
            <p className="mt-1 text-[0.82rem] text-brand-100/85">
              {totalAlunosCadastrados} {totalAlunosCadastrados === 1 ? "aluno cadastrado" : "alunos cadastrados"}
              {" · "}
              {totalProfessoresCadastrados} {totalProfessoresCadastrados === 1 ? "professor cadastrado" : "professores cadastrados"}
            </p>
          </div>
          <button
            type="button"
            onClick={aoUsarSugestoes}
            className="shrink-0 rounded-xl border border-gold-400/30 bg-gold-400/10 px-4 py-2 text-[0.78rem] font-medium text-gold-200 transition-colors hover:bg-gold-400/20"
          >
            Usar quantidades sugeridas
          </button>
        </div>
      )}

      <div className="space-y-3">
        {principais.map((c) => (
          <CartaoCategoria
            key={c.categoria}
            categoriaRotulo={c.rotulo}
            linhas={c.linhas}
            valores={valores}
            aoMudar={aoMudar}
          />
        ))}
      </div>

      {outras.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOutrasAbertas((v) => !v)}
            className="flex w-full items-center gap-2 rounded-xl px-1 py-2 text-[0.76rem] text-brand-200/55 transition-colors hover:text-brand-100"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", outrasAbertas && "rotate-180")} />
            Outras categorias ({outras.length}) — sem classe cadastrada nesta congregação, mas pode pedir também
          </button>
          {outrasAbertas && (
            <div className="mt-2 space-y-3">
              {outras.map((c) => (
                <CartaoCategoria
                  key={c.categoria}
                  categoriaRotulo={c.rotulo}
                  linhas={c.linhas}
                  valores={valores}
                  aoMudar={aoMudar}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
