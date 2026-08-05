"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Printer, ScrollText, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { numero } from "@/lib/dashboard/formato";

/**
 * Pedido de revistas por classe.
 *
 * ============================================================================
 * O PEDIDO VEM CALCULADO, E A SECRETARIA AJUSTA
 *
 * A aba `Pedidos_Revistas` do sistema antigo veio VAZIA — nunca foi usada. O
 * que existe são os alunos por classe e a tabela de preços do campo, e com as
 * duas o pedido de cada classe já nasce pronto: uma revista por aluno ativo.
 *
 * O ajuste é local, na tela, e some ao sair. Isso é deliberado enquanto não há
 * onde gravar: um número que a pessoa digita e o sistema esquece sem avisar é
 * pior do que um número que ela sabe que é rascunho. A tela diz isso.
 * ============================================================================
 */

interface ItemRevista {
  classeId: number;
  classe: string;
  faixa: string;
  tipoClasse: string;
  congregacao: string;
  quantidade: number;
  categoriaEncontrada: boolean;
  precoUnitario: number | null;
  subtotal: number | null;
}

interface Pedido {
  itens: ItemRevista[];
  revistas: number;
  valor: number;
  semCategoria: number;
}

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function RevistasPage() {
  const [dados, setDados] = useState<Pedido | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  /** Ajustes locais, por classe. Rascunho — não é gravado. */
  const [ajuste, setAjuste] = useState<Record<number, number>>({});

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/revistas", { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDados(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status === 403
            ? "O seu acesso não permite ver esta tela."
            : status
              ? "O servidor respondeu com erro."
              : "Sem resposta do servidor. Verifique a conexão.",
        );
      }
    })();
    return () => controle.abort();
  }, []);

  const totais = useMemo(() => {
    if (!dados) return { revistas: 0, valor: 0 };
    let revistas = 0;
    let valor = 0;
    for (const i of dados.itens) {
      const qtd = ajuste[i.classeId] ?? i.quantidade;
      revistas += qtd;
      // Só soma o que tem preço. Tratar categoria ausente como zero produziria
      // um total menor que o real, com aparência de conferido.
      if (i.precoUnitario !== null) valor += i.precoUnitario * qtd;
    }
    return { revistas, valor: Number(valor.toFixed(2)) };
  }, [dados, ajuste]);

  return (
    <>
      <CabecalhoModulo
        icone={ScrollText}
        titulo="Pedido de Revistas"
        descricao="Uma revista por aluno ativo, com os preços do campo"
        total={dados?.itens.length ?? null}
      >
        <Button variant="ghost" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </CabecalhoModulo>

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : dados === null ? (
        <EsqueletoLista linhas={8} />
      ) : dados.itens.length === 0 ? (
        <EstadoVazio mensagem="Nenhuma classe ativa no seu alcance." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Revistas", numero(totais.revistas), "uma por aluno ativo"],
              ["Valor estimado", dinheiro.format(totais.valor), "pelos preços do campo"],
              ["Classes", numero(dados.itens.length), "com pedido"],
            ].map(([rotulo, valor, nota]) => (
              <div key={rotulo} className="glass-panel rounded-2xl p-4">
                <p className="font-display text-[1.4rem] font-semibold leading-none text-white tabular-nums">
                  {valor}
                </p>
                <p className="mt-1.5 text-[0.78rem] text-brand-100/75">{rotulo}</p>
                <p className="text-[0.7rem] text-brand-200/45">{nota}</p>
              </div>
            ))}
          </div>

          {dados.semCategoria > 0 && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-gold-400/20 bg-gold-400/[0.06] px-4 py-3">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
              <p className="text-[0.78rem] leading-relaxed text-brand-100/85">
                <span className="font-semibold text-gold-200">{dados.semCategoria}</span>{" "}
                {dados.semCategoria === 1 ? "classe está" : "classes estão"} com um tipo que
                não casa com nenhuma categoria da tabela de preços. Elas entram na contagem
                de revistas, mas <strong>ficam fora do valor</strong> — o total seria menor
                que o real se elas fossem tratadas como zero.
              </p>
            </div>
          )}

          <div className="glass-panel mt-4 overflow-hidden rounded-2xl">
            <header className="border-b border-white/8 px-5 py-3">
              <p className="text-[0.74rem] text-brand-200/55">
                A quantidade pode ser ajustada aqui para conferência —{" "}
                <strong className="text-brand-100/80">o ajuste não é gravado</strong> e some
                ao sair da tela.
              </p>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left">
                <thead>
                  <tr className="text-[0.68rem] uppercase tracking-[0.14em] text-brand-200/45">
                    <th className="px-5 py-2.5 font-medium">Classe</th>
                    <th className="px-3 py-2.5 font-medium">Congregação</th>
                    <th className="px-3 py-2.5 font-medium">Categoria</th>
                    <th className="px-3 py-2.5 text-right font-medium">Qtd.</th>
                    <th className="px-3 py-2.5 text-right font-medium">Unit.</th>
                    <th className="px-5 py-2.5 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {dados.itens.map((i, idx) => {
                    const qtd = ajuste[i.classeId] ?? i.quantidade;
                    const sub = i.precoUnitario !== null ? i.precoUnitario * qtd : null;
                    return (
                      <motion.tr
                        key={i.classeId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: Math.min(idx, 20) * 0.015 }}
                        className="transition-colors duration-300 hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-2 text-[0.84rem] text-brand-50">{i.classe}</td>
                        <td className="px-3 py-2 text-[0.78rem] text-brand-200/60">
                          {i.congregacao}
                        </td>
                        <td className="px-3 py-2 text-[0.78rem]">
                          {i.categoriaEncontrada ? (
                            <span className="text-brand-200/60">{i.tipoClasse}</span>
                          ) : (
                            <span className="text-gold-200/80">
                              {i.tipoClasse || "—"} · sem preço
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={qtd}
                            onChange={(e) =>
                              setAjuste((a) => ({
                                ...a,
                                [i.classeId]: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            aria-label={`Quantidade para ${i.classe}`}
                            className={cn(
                              "w-16 rounded-lg border bg-white/[0.04] px-2 py-1 text-right text-[0.82rem] tabular-nums text-brand-50",
                              "focus:outline-none focus:border-gold-400/40",
                              qtd !== i.quantidade ? "border-gold-400/40" : "border-white/10",
                            )}
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-[0.8rem] tabular-nums text-brand-200/70">
                          {i.precoUnitario !== null ? dinheiro.format(i.precoUnitario) : "—"}
                        </td>
                        <td className="px-5 py-2 text-right text-[0.84rem] font-semibold tabular-nums text-gold-200">
                          {sub !== null ? dinheiro.format(sub) : "—"}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
