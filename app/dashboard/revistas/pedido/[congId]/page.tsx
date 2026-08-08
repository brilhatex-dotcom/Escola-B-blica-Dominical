"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, FilePlus2, Loader2, PenLine, Printer, ReceiptText, RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CabecalhoModulo, EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { SeletorTrimestre } from "@/components/revistas/SeletorTrimestre";
import { proximoTrimestre, trimestreDe, trimestreValido } from "@/lib/revistas/trimestre";

/**
 * Detalhe do Pedido — a leitura de UM pedido, confirmado ou em rascunho.
 *
 * ============================================================================
 * QUEM EDITA A QUANTIDADE É SÓ O ASSISTENTE, NUNCA ESTA TELA
 *
 * Até a Fase 22 esta página TAMBÉM digitava quantidade — o mesmo trabalho que
 * o assistente de Novo Pedido (`/dashboard/revistas/novo`) faz agora, em
 * campos de texto soltos numa tabela, sem as sugestões, sem confirmação em
 * etapas. Duas telas editando a mesma coisa por caminhos diferentes é onde
 * bugs de sincronização nascem — e onde a mesma pergunta ("quanto eu pedi?")
 * tinha duas respostas possíveis, dependendo de qual link a pessoa clicou.
 *
 * Esta tela agora só LÊ: confirmado, mostra a tabela travada, o botão de
 * imprimir e o de reabrir. Rascunho ou pedido nunca começado, ela aponta para
 * o assistente — sem oferecer um segundo jeito de fazer a mesma coisa.
 * ============================================================================
 */

interface Linha {
  categoria: string; categoriaRotulo: string; tipo: "aluno" | "professor";
  precoUnitario: number | null; quantidade: number; sugestao: number;
}
interface Dados {
  id: number | null;
  congId: number; congNome: string;
  trimestre: { chave: string; rotulo: string };
  confirmado: boolean; confirmadoEm: string | null; confirmadoPor: string | null;
  podeReabrir: boolean;
  linhas: Linha[]; total: number; revistas: number;
}

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDataAssinatura = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function DetalhePedidoPage({ params }: { params: Promise<{ congId: string }> }) {
  const { congId } = use(params);
  const parametros = useSearchParams();
  // Chegando da tela principal ou do assistente, a URL já traz a chave exata
  // do trimestre ("3T-2026"); "atual" continua reconhecido por link antigo.
  const trimestreDaUrl = parametros.get("trimestre");
  const [trimestre, setTrimestre] = useState(() => {
    if (trimestreDaUrl && trimestreValido(trimestreDaUrl)) return trimestreDaUrl;
    if (trimestreDaUrl === "atual") return trimestreDe(new Date()).chave;
    return proximoTrimestre(new Date()).chave;
  });
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [reabrindo, setReabrindo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { podeGravar } = useAcesso();
  const editavel = podeGravar("revistas");

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const url = new URL("/api/revistas/pedido", window.location.origin);
      url.searchParams.set("congId", congId);
      url.searchParams.set("trimestre", trimestre);
      const res = await fetch(url, { cache: "no-store" });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? `HTTP ${res.status}`);
      setDados(corpo);
    } catch (e) {
      setErro((e as Error).message || "Não foi possível carregar o pedido.");
    }
  }, [congId, trimestre]);

  useEffect(() => { setDados(null); void carregar(); }, [carregar]);

  // "Imprimir Pedido" na tela de sucesso do assistente chega aqui com
  // `?imprimir=1` — dispara a impressão sozinho, assim que o pedido confirmado
  // estiver na tela, sem exigir um segundo clique.
  const jaImprimiu = useRef(false);
  useEffect(() => {
    if (jaImprimiu.current || !dados?.confirmado || parametros.get("imprimir") !== "1") return;
    jaImprimiu.current = true;
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, [dados, parametros]);

  async function reabrir() {
    setReabrindo(true);
    setMsg(null);
    try {
      const res = await fetch("/api/revistas/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congId: Number(congId), trimestre, acao: "reabrir" }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? "Não foi possível reabrir.");
      await carregar();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setReabrindo(false);
    }
  }

  const linkAssistente = `/dashboard/revistas/novo?congId=${congId}&trimestre=${trimestre}`;

  return (
    <>
      <div className="print:hidden">
        <Link href="/dashboard/revistas" className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] text-brand-200/60 transition-colors duration-300 hover:text-gold-200">
          <ArrowLeft className="h-3.5 w-3.5" />
          Pedidos de Lições
        </Link>

        <CabecalhoModulo
          icone={ReceiptText}
          titulo="Detalhe do Pedido"
          descricao={dados ? `${dados.congNome} — ${dados.trimestre.rotulo}` : "Carregando…"}
        >
          <SeletorTrimestre selecionado={trimestre} aoSelecionar={setTrimestre} />
          {dados?.confirmado && (
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          )}
        </CabecalhoModulo>
      </div>

      {erro ? <EstadoErro mensagem={erro} />
      : !dados ? <EsqueletoLista linhas={6} />
      : dados.id === null ? (
        <div className="glass-panel rounded-2xl px-6 py-14 text-center print:hidden">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-gold-400/20">
            <FilePlus2 className="h-6 w-6 text-gold-300" />
          </span>
          <p className="mx-auto mt-4 max-w-sm text-[0.94rem] text-brand-50">
            {dados.congNome} ainda não tem pedido neste trimestre.
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[0.8rem] text-brand-200/55">{dados.trimestre.rotulo}</p>
          {editavel && (
            <Button asChild className="mt-5">
              <Link href={linkAssistente}>
                <FilePlus2 className="h-4 w-4" />
                Fazer Pedido
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {dados.confirmado && (
            <div className="hidden text-center print:mb-5 print:block print:border-b-2 print:border-black print:pb-3">
              <p className="text-[0.72rem] uppercase tracking-[0.2em]">Assembleia de Deus — IEADPE, Campo de Betânia (PE)</p>
              <h1 className="mt-1 text-[1.15rem] font-semibold uppercase tracking-wide">Pedido de Lição</h1>
              <p className="mt-1 text-[0.86rem]">
                <strong>{dados.congNome}</strong> — {dados.trimestre.rotulo}
              </p>
            </div>
          )}

          {dados.confirmado ? (
            <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4 print:hidden">
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
                  <Button size="sm" variant="ghost" onClick={() => void reabrir()} disabled={reabrindo}>
                    {reabrindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
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
            <Alert tipo="info" titulo="Rascunho salvo, ainda não confirmado" className="mb-4 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>Ninguém é cobrado por um rascunho — continue no assistente para revisar e confirmar.</span>
                {editavel && (
                  <Button asChild size="sm">
                    <Link href={linkAssistente}>
                      <PenLine className="h-3.5 w-3.5" />
                      Continuar pedido
                    </Link>
                  </Button>
                )}
              </div>
            </Alert>
          )}

          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left">
                <thead>
                  <tr className="border-b border-white/8 text-[0.64rem] uppercase tracking-[0.12em] text-brand-200/45">
                    <th className="px-4 py-2.5 font-medium">Categoria</th>
                    <th className="px-3 py-2.5 font-medium">Tipo</th>
                    <th className="px-3 py-2.5 text-right font-medium">Preço</th>
                    <th className="px-3 py-2.5 text-right font-medium">Quantidade</th>
                    <th className="px-4 py-2.5 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {dados.linhas.filter((l) => l.quantidade > 0 || !dados.confirmado).map((l) => {
                    const subtotal = l.precoUnitario !== null ? l.quantidade * l.precoUnitario : 0;
                    return (
                      <tr key={`${l.categoria}|${l.tipo}`}>
                        <td className="px-4 py-2 text-[0.82rem] text-brand-50">{l.categoriaRotulo}</td>
                        <td className="px-3 py-2 text-[0.78rem] text-brand-200/60">
                          {l.tipo === "aluno" ? "Revista do Aluno" : "Revista do Professor"}
                        </td>
                        <td className="px-3 py-2 text-right text-[0.8rem] tabular-nums text-brand-200/60">
                          {l.precoUnitario !== null ? dinheiro.format(l.precoUnitario) : <span className="text-flame-400/70">sem preço</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-[0.82rem] tabular-nums text-brand-100/85">{l.quantidade || "—"}</td>
                        <td className="px-4 py-2 text-right text-[0.82rem] font-semibold tabular-nums text-gold-200">
                          {subtotal > 0 ? dinheiro.format(subtotal) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10">
                    <td colSpan={3} className="px-4 py-3 text-[0.72rem] text-brand-200/45 print:hidden">
                      {dados.confirmado ? "Quantidade e preço travados na confirmação." : "Ainda em rascunho — nada travado."}
                    </td>
                    <td className="px-3 py-3 text-right text-[0.78rem] tabular-nums text-brand-200/60 print:pl-4">{dados.revistas} revista(s)</td>
                    <td className="px-4 py-3 text-right text-[0.94rem] font-semibold tabular-nums text-white">{dinheiro.format(dados.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {dados.confirmado && (
            <section className="mt-10 hidden grid-cols-2 gap-8 text-center text-[0.8rem] print:grid">
              <div>
                <div className="mb-1 border-t border-black pt-1.5">{dados.confirmadoPor || " "}</div>
                Secretaria da EBD
              </div>
              <div>
                <div className="mb-1 border-t border-black pt-1.5">{fmtDataAssinatura.format(new Date())}</div>
                Data
              </div>
            </section>
          )}

          {msg && <p className="mt-3 text-[0.82rem] text-flame-400 print:hidden">{msg}</p>}
        </>
      )}
    </>
  );
}
