"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Download, Loader2, Printer, Share2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LOGO_SRC } from "@/lib/brand";
import { ORG_NAME } from "@/lib/config";

/**
 * Comprovante de pagamento — abre sozinho assim que uma baixa é registrada.
 *
 * ============================================================================
 * "AUTOMÁTICO" É A TELA ABRINDO SOZINHA, NÃO UM CLIQUE A MAIS
 *
 * A pessoa já fez o trabalho de digitar o valor e clicar em "Dar baixa" — o
 * comprovante não deveria custar um segundo passo para achar. Por isso este
 * modal abre IMEDIATAMENTE depois que a baixa é gravada (ver `PagamentosDaCong`
 * em `app/dashboard/revistas/page.tsx`), já com os dados daquele pagamento
 * específico — nenhuma segunda tela, nenhum "agora vá emitir o comprovante".
 *
 * O mesmo modal também abre para uma baixa JÁ REGISTRADA (o ícone de recibo ao
 * lado de cada pagamento na lista) — então um comprovante perdido ou nunca
 * tirado tem como ser emitido depois, sem precisar desfazer e refazer a baixa.
 * ============================================================================
 *
 * A IMPRESSÃO NÃO FICA PRESA AO TAMANHO DO MODAL
 *
 * O cartão bonito na tela é um `Dialog` — uma caixa de tamanho fixo, que
 * imprimiria cortada ou minúscula se fosse ela mesma mandada para a
 * impressora. A réplica de impressão é desenhada à parte e colocada
 * diretamente no `<body>` via `createPortal`, fora de qualquer `print:hidden`
 * que a página de Revistas tenha — assim ela imprime como página cheia,
 * igual aos outros relatórios do portal, não importa o quão fundo este
 * componente esteja aninhado.
 */

export interface ComprovanteDados {
  id: number;
  congNome: string;
  trimestreRotulo: string;
  valor: number;
  observacao: string | null;
  autor: string | null;
  criadoEm: string;
  /** Saldo do pedido DEPOIS desta baixa — zero ou negativo é "quitado". */
  saldoApos: number;
}

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

function numeroDoComprovante(id: number): string {
  return `#${String(id).padStart(6, "0")}`;
}

export function ComprovanteModal({ dados, aoFechar }: { dados: ComprovanteDados | null; aoFechar: () => void }) {
  const [gerando, setGerando] = useState<"imagem" | "compartilhar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function gerarImagem(): Promise<Blob | null> {
    const no = document.getElementById(`comprovante-captura-${dados?.id}`);
    if (!no) return null;
    const { toBlob } = await import("html-to-image");
    // Sem `width`/`height` forçados: o cartão já tem o tamanho de recibo
    // certo (a largura do modal) — forçar 720px só esticava a tela sem
    // fazer o conteúdo reocupar o espaço, sobrando faixa vazia à direita.
    // `pixelRatio` sozinho já garante a imagem nítida para o celular.
    return toBlob(no, { quality: 0.95, pixelRatio: 2.5 });
  }

  async function baixarImagem() {
    if (!dados) return;
    setErro(null);
    setGerando("imagem");
    try {
      const blob = await gerarImagem();
      if (!blob) throw new Error();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `comprovante-${dados.congNome.toLowerCase().replace(/\s+/g, "-")}-${dados.criadoEm.slice(0, 10)}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setErro("Não foi possível gerar a imagem. Tente novamente, ou use Imprimir.");
    } finally {
      setGerando(null);
    }
  }

  async function compartilhar() {
    if (!dados) return;
    setErro(null);
    setGerando("compartilhar");
    try {
      const blob = await gerarImagem();
      if (!blob) throw new Error();
      const arquivo = new File([blob], `comprovante-${dados.congNome}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: "Comprovante de Pagamento" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `comprovante-${dados.congNome}.jpg`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErro("Não foi possível compartilhar. Tente baixar a imagem.");
    } finally {
      setGerando(null);
    }
  }

  const quitado = dados ? dados.saldoApos <= 0 : false;

  return (
    <>
      <Dialog open={dados !== null} onOpenChange={(v) => !v && aoFechar()}>
        <DialogContent className="max-w-sm print:hidden">
          <DialogHeader>
            <DialogTitle>Comprovante de Pagamento</DialogTitle>
          </DialogHeader>

          {dados && (
            <>
              {/* O MESMO nó serve de prévia na tela e de alvo da captura de imagem —
                  um id estável (`comprovante-captura-{id}`) é o que a função de
                  captura usa para achá-lo, já que o html-to-image precisa do
                  elemento DOM real, não de uma ref passada entre componentes. */}
              <div
                id={`comprovante-captura-${dados.id}`}
                className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-b from-brand-900 to-brand-950 p-6 text-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- captura por html-to-image precisa de <img> direto */}
                <img src={LOGO_SRC} alt="" className="mx-auto h-12 w-auto object-contain" />
                <p className="mt-1.5 text-[0.62rem] uppercase tracking-[0.2em] text-brand-200/55">{ORG_NAME}</p>

                <span className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                  <CheckCircle2 className="h-8 w-8 text-emerald-300" />
                </span>
                <p className="mt-3 text-[0.78rem] uppercase tracking-[0.14em] text-brand-200/60">Pagamento registrado</p>
                <p className="mt-1 font-display text-[2rem] font-bold leading-none text-white">{dinheiro.format(dados.valor)}</p>

                <div className="mx-4 mt-5 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-left text-[0.8rem]">
                  <Linha rotulo="Congregação" valor={dados.congNome} />
                  <Linha rotulo="Trimestre" valor={dados.trimestreRotulo} />
                  <Linha rotulo="Data" valor={fmtDataHora.format(new Date(dados.criadoEm))} />
                  {dados.observacao && <Linha rotulo="Observação" valor={dados.observacao} />}
                  {dados.autor && <Linha rotulo="Registrado por" valor={dados.autor} />}
                  <Linha rotulo="Comprovante" valor={numeroDoComprovante(dados.id)} />
                </div>

                <p className={`mt-4 text-[0.8rem] font-semibold ${quitado ? "text-emerald-300" : "text-gold-200"}`}>
                  {quitado ? "Pedido do trimestre quitado" : `Saldo restante: ${dinheiro.format(dados.saldoApos)}`}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => window.print()} disabled={gerando !== null}>
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <Button onClick={() => void baixarImagem()} disabled={gerando !== null}>
                  {gerando === "imagem" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Baixar imagem
                </Button>
              </div>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button variant="ghost" className="mt-2 w-full" onClick={() => void compartilhar()} disabled={gerando !== null}>
                  {gerando === "compartilhar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  Compartilhar
                </Button>
              )}
              {erro && <p className="mt-2 text-center text-[0.76rem] text-flame-400">{erro}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>

      {dados && typeof document !== "undefined" && createPortal(
        <ReciboImpresso dados={dados} quitado={quitado} />,
        document.body,
      )}
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-brand-200/50">{rotulo}</span>
      <span className="min-w-0 text-right text-brand-50">{valor}</span>
    </div>
  );
}

function ReciboImpresso({ dados, quitado }: { dados: ComprovanteDados; quitado: boolean }) {
  return (
    <div className="hidden print:block">
      <div className="mx-auto max-w-md border-2 border-black p-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- impressão simples, sem pipeline do next/image */}
        <img src={LOGO_SRC} alt="" className="mx-auto h-16 w-auto object-contain" />
        <p className="mt-2 text-[0.72rem] uppercase tracking-[0.2em]">{ORG_NAME}</p>
        <h1 className="mt-2 text-[1.1rem] font-bold uppercase tracking-wide">Comprovante de Pagamento</h1>
        <p className="mt-1 text-[0.8rem]">Pedido de Lição — {dados.trimestreRotulo}</p>

        <p className="mt-6 text-[2rem] font-bold">{dinheiro.format(dados.valor)}</p>

        <table className="mx-auto mt-6 w-full max-w-xs text-left text-[0.86rem]">
          <tbody>
            <tr><td className="py-1 pr-3 text-brand-200/60">Congregação</td><td className="py-1 font-medium">{dados.congNome}</td></tr>
            <tr><td className="py-1 pr-3 text-brand-200/60">Data</td><td className="py-1 font-medium">{fmtDataHora.format(new Date(dados.criadoEm))}</td></tr>
            {dados.observacao && <tr><td className="py-1 pr-3 text-brand-200/60">Observação</td><td className="py-1 font-medium">{dados.observacao}</td></tr>}
            {dados.autor && <tr><td className="py-1 pr-3 text-brand-200/60">Registrado por</td><td className="py-1 font-medium">{dados.autor}</td></tr>}
            <tr><td className="py-1 pr-3 text-brand-200/60">Comprovante</td><td className="py-1 font-medium">{numeroDoComprovante(dados.id)}</td></tr>
          </tbody>
        </table>

        <p className="mt-6 text-[0.9rem] font-semibold">
          {quitado ? "Pedido do trimestre quitado." : `Saldo restante: ${dinheiro.format(dados.saldoApos)}`}
        </p>
      </div>
    </div>
  );
}
