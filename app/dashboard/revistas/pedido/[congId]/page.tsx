"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, ClipboardList, Loader2, Lock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CabecalhoModulo, EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import { useAcesso } from "@/components/acesso/AcessoProvider";

/**
 * Fazer Pedido — a tela que faltava: digitar a quantidade de cada categoria
 * e CONFIRMAR, travando a quantidade e o preço daquele momento.
 *
 * Abre no próximo trimestre por padrão (a CPAD recebe pedido com antecedência
 * — ver `lib/revistas/trimestre.ts`), com um botão para olhar/editar o
 * trimestre atual também.
 */

interface Linha {
  categoria: string; categoriaRotulo: string; tipo: "aluno" | "professor";
  precoUnitario: number | null; quantidade: number; sugestao: number;
}
interface Dados {
  congId: number; congNome: string;
  trimestre: { chave: string; rotulo: string };
  confirmado: boolean; confirmadoEm: string | null; confirmadoPor: string | null;
  podeReabrir: boolean;
  linhas: Linha[]; total: number; revistas: number;
}

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function FazerPedidoPage({ params }: { params: Promise<{ congId: string }> }) {
  const { congId } = use(params);
  // Chegando da tela principal com "?trimestre=atual", abre já no atual —
  // senão, o padrão continua sendo o próximo (a CPAD recebe pedido com
  // antecedência).
  const trimestreDaUrl = useSearchParams().get("trimestre");
  const [periodo, setPeriodo] = useState<"proximo" | "atual">(trimestreDaUrl === "atual" ? "atual" : "proximo");
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<"rascunho" | "confirmar" | "reabrir" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { podeGravar } = useAcesso();
  const editavel = podeGravar("revistas");

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const url = new URL("/api/revistas/pedido", window.location.origin);
      url.searchParams.set("congId", congId);
      url.searchParams.set("trimestre", periodo);
      const res = await fetch(url, { cache: "no-store" });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? `HTTP ${res.status}`);
      setDados(corpo);
      setQuantidades(
        Object.fromEntries((corpo.linhas as Linha[]).map((l) => [`${l.categoria}|${l.tipo}`, l.quantidade > 0 ? String(l.quantidade) : ""])),
      );
    } catch (e) {
      setErro((e as Error).message || "Não foi possível carregar o pedido.");
    }
  }, [congId, periodo]);

  useEffect(() => { setDados(null); void carregar(); }, [carregar]);

  const totalDigitado = useMemo(() => {
    if (!dados) return 0;
    return dados.linhas.reduce((s, l) => {
      const q = Number(quantidades[`${l.categoria}|${l.tipo}`] || 0);
      return s + (Number.isFinite(q) && l.precoUnitario !== null ? q * l.precoUnitario : 0);
    }, 0);
  }, [dados, quantidades]);
  const revistasDigitadas = useMemo(() => {
    if (!dados) return 0;
    return dados.linhas.reduce((s, l) => s + (Number(quantidades[`${l.categoria}|${l.tipo}`]) || 0), 0);
  }, [dados, quantidades]);

  async function salvarRascunho(): Promise<boolean> {
    setSalvando("rascunho");
    setMsg(null);
    try {
      const itens = Object.entries(quantidades).map(([chave, valor]) => {
        const [categoria, tipo] = chave.split("|");
        return { categoria, tipo, quantidade: valor === "" ? 0 : Number(valor) };
      });
      const res = await fetch("/api/revistas/pedido", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congId: Number(congId), trimestre: periodo, itens }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? "Não foi possível salvar.");
      return true;
    } catch (e) {
      setMsg((e as Error).message);
      return false;
    } finally {
      setSalvando(null);
    }
  }

  async function confirmar() {
    const salvou = await salvarRascunho();
    if (!salvou) return;
    setSalvando("confirmar");
    try {
      const res = await fetch("/api/revistas/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congId: Number(congId), trimestre: periodo, acao: "confirmar" }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? "Não foi possível confirmar.");
      await carregar();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  async function reabrir() {
    setSalvando("reabrir");
    setMsg(null);
    try {
      const res = await fetch("/api/revistas/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congId: Number(congId), trimestre: periodo, acao: "reabrir" }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? "Não foi possível reabrir.");
      await carregar();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  return (
    <>
      <Link href="/dashboard/revistas" className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] text-brand-200/60 transition-colors duration-300 hover:text-gold-200">
        <ArrowLeft className="h-3.5 w-3.5" />
        Pedido de Lição
      </Link>

      <CabecalhoModulo
        icone={ClipboardList}
        titulo="Fazer Pedido"
        descricao={dados ? `${dados.congNome} — ${dados.trimestre.rotulo}` : "Carregando…"}
      >
        <div className="flex gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(["proximo", "atual"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[0.78rem] transition-colors duration-300",
                periodo === p ? "bg-gold-400/15 text-gold-200" : "text-brand-200/60 hover:text-brand-100",
              )}
            >
              {p === "proximo" ? "Próximo trimestre" : "Trimestre atual"}
            </button>
          ))}
        </div>
      </CabecalhoModulo>

      {erro ? <EstadoErro mensagem={erro} />
      : !dados ? <EsqueletoLista linhas={6} />
      : (
        <>
          {dados.confirmado ? (
            <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-300" />
                  <div>
                    <p className="text-[0.86rem] font-semibold text-white">Pedido confirmado</p>
                    <p className="text-[0.76rem] text-brand-200/60">
                      {dados.confirmadoPor ? `por ${dados.confirmadoPor} — ` : ""}
                      {dados.confirmadoEm ? fmtDataHora.format(new Date(dados.confirmadoEm)) : ""}
                    </p>
                  </div>
                </div>
                {editavel && dados.podeReabrir && (
                  <Button size="sm" variant="ghost" onClick={() => void reabrir()} disabled={salvando !== null}>
                    {salvando === "reabrir" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Reabrir para editar
                  </Button>
                )}
              </div>
              {!dados.podeReabrir && (
                <p className="mt-2 text-[0.72rem] text-brand-200/45">
                  Travado — só a administração do campo pode reabrir um pedido já confirmado.
                </p>
              )}
            </div>
          ) : (
            <Alert tipo="info" titulo="Pedido em rascunho" className="mb-4">
              As quantidades abaixo ainda não foram confirmadas. Ninguém é cobrado por um rascunho — só
              depois de "Confirmar Pedido" ele passa a valer para pagamento.
            </Alert>
          )}

          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem] text-left">
                <thead>
                  <tr className="border-b border-white/8 text-[0.64rem] uppercase tracking-[0.12em] text-brand-200/45">
                    <th className="px-4 py-2.5 font-medium">Categoria</th>
                    <th className="px-3 py-2.5 font-medium">Tipo</th>
                    <th className="px-3 py-2.5 text-right font-medium">Preço</th>
                    <th className="px-3 py-2.5 text-right font-medium">Quantidade</th>
                    <th className="px-3 py-2.5 text-right font-medium">Sugestão</th>
                    <th className="px-4 py-2.5 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {dados.linhas.map((l) => {
                    const chave = `${l.categoria}|${l.tipo}`;
                    const qtd = quantidades[chave] ?? "";
                    const subtotal = l.precoUnitario !== null ? (Number(qtd) || 0) * l.precoUnitario : 0;
                    return (
                      <tr key={chave}>
                        <td className="px-4 py-2 text-[0.82rem] text-brand-50">{l.categoriaRotulo}</td>
                        <td className="px-3 py-2 text-[0.78rem] text-brand-200/60">
                          {l.tipo === "aluno" ? "Revista do Aluno" : "Revista do Professor"}
                        </td>
                        <td className="px-3 py-2 text-right text-[0.8rem] tabular-nums text-brand-200/60">
                          {l.precoUnitario !== null ? dinheiro.format(l.precoUnitario) : <span className="text-flame-400/70">sem preço</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editavel && !dados.confirmado && l.precoUnitario !== null ? (
                            <input
                              inputMode="numeric"
                              value={qtd}
                              onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9]/g, "");
                                setQuantidades((q) => ({ ...q, [chave]: v }));
                              }}
                              placeholder="0"
                              className="h-8 w-16 rounded-lg border border-white/10 bg-white/[0.06] px-2 text-right text-[0.82rem] tabular-nums text-brand-50 focus:outline-none focus:border-gold-400/40"
                            />
                          ) : (
                            <span className="text-[0.82rem] tabular-nums text-brand-100/80">{l.quantidade || "—"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-[0.74rem] tabular-nums text-brand-200/40">
                          {l.sugestao > 0 ? l.sugestao : "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-[0.82rem] font-semibold tabular-nums text-gold-200">
                          {subtotal > 0 ? dinheiro.format(subtotal) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10">
                    <td colSpan={3} className="px-4 py-3 text-[0.72rem] text-brand-200/45">
                      "Sugestão" é o que o cálculo automático aponta (alunos/professores ativos) — só
                      referência, não é o pedido.
                    </td>
                    <td className="px-3 py-3 text-right text-[0.78rem] tabular-nums text-brand-200/60">
                      {dados.confirmado ? dados.revistas : revistasDigitadas} revista(s)
                    </td>
                    <td />
                    <td className="px-4 py-3 text-right text-[0.94rem] font-semibold tabular-nums text-white">
                      {dinheiro.format(dados.confirmado ? dados.total : totalDigitado)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {msg && <p className="mt-3 text-[0.82rem] text-flame-400">{msg}</p>}

          {editavel && !dados.confirmado && (
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Button variant="ghost" onClick={() => void salvarRascunho()} disabled={salvando !== null}>
                {salvando === "rascunho" && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar rascunho
              </Button>
              <Button onClick={() => void confirmar()} disabled={salvando !== null || revistasDigitadas === 0}>
                {salvando === "confirmar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Confirmar Pedido
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
