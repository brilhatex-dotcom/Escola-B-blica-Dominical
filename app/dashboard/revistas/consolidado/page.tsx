"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, Loader2, PackageCheck, Printer, Receipt, ShoppingCart } from "lucide-react";
import { CabecalhoModulo, EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import { Button } from "@/components/ui/button";
import { SeletorTrimestre } from "@/components/revistas/SeletorTrimestre";
import { numero } from "@/lib/dashboard/formato";
import { trimestreDe, trimestreValido } from "@/lib/revistas/trimestre";
import { LOGO_SRC } from "@/lib/brand";

/**
 * Pedido Consolidado para a CPAD — todos os pedidos confirmados do
 * trimestre, somados numa única lista no formato do formulário oficial da
 * CPAD Megastore Recife, pronta para imprimir/exportar e enviar.
 */

interface Linha {
  categoria: string; tipo: string; codigo: number; classe: string; idade: string;
  quantidade: number; unitario: number; bruto: number; liquido: number;
}
interface Pendente { congId: number; nome: string }
interface Dados {
  trimestre: { chave: string; rotulo: string };
  congregacoesTotal: number; congregacoesConfirmadas: number; congregacoesPendentes: Pendente[];
  linhas: Linha[];
  totais: { quantidade: number; bruto: number; liquido: number };
}

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDataHoje = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function ConsolidadoCpadPage() {
  return (
    <Suspense fallback={<EsqueletoLista linhas={8} />}>
      <ConsolidadoCpadConteudo />
    </Suspense>
  );
}

function ConsolidadoCpadConteudo() {
  const parametros = useSearchParams();
  const trimestreDaUrl = parametros.get("trimestre");
  const [trimestre, setTrimestre] = useState(() =>
    trimestreDaUrl && trimestreValido(trimestreDaUrl) ? trimestreDaUrl : trimestreDe(new Date()).chave,
  );
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        const res = await fetch(`/api/revistas/consolidado?trimestre=${trimestre}`, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDados(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(status === 403 ? "Só a administração do campo vê o pedido consolidado." : "Não foi possível carregar o pedido consolidado.");
      }
    })();
    return () => controle.abort();
  }, [trimestre]);

  async function exportarXlsx() {
    if (!dados) return;
    setExportando(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Pedido CPAD");
      ws.columns = [
        { width: 12 }, { width: 8 }, { width: 30 }, { width: 22 }, { width: 12 }, { width: 14 }, { width: 14 },
      ];

      const titulo = (texto: string, linha: number, negrito = true, tamanho = 11) => {
        ws.mergeCells(linha, 1, linha, 7);
        const cel = ws.getCell(linha, 1);
        cel.value = texto;
        cel.font = { bold: negrito, size: tamanho };
        cel.alignment = { horizontal: "center" };
      };

      titulo("IGREJA EVANGÉLICA ASSEMBLÉIA DE DEUS EM PERNAMBUCO", 1, true, 12);
      titulo("Campo de Betânia (PE)", 2, false, 10);
      titulo(`PEDIDO DE LIÇÕES — CONSOLIDADO — ${dados.trimestre.rotulo}`, 3, true, 13);
      titulo(`Gerado em ${fmtDataHoje.format(new Date())}`, 4, false, 9);
      ws.addRow([]);

      const linhaCab = ws.addRow(["CÓDIGO", "QT", "CLASSE", "IDADE", "UN", "BRUTO", "LÍQUIDO"]);
      linhaCab.font = { bold: true };
      linhaCab.eachCell((c) => {
        c.alignment = { horizontal: "center" };
        c.border = { bottom: { style: "thin" } };
      });

      for (const l of dados.linhas) {
        const r = ws.addRow([l.codigo, l.quantidade || null, l.classe, l.idade, l.unitario, l.bruto, l.liquido]);
        r.getCell(5).numFmt = '"R$" #,##0.00';
        r.getCell(6).numFmt = '"R$" #,##0.00';
        r.getCell(7).numFmt = '"R$" #,##0.00';
        r.getCell(2).alignment = { horizontal: "center" };
      }

      const linhaTotal = ws.addRow(["", dados.totais.quantidade, "TOTAL DO PEDIDO", "", "", dados.totais.bruto, dados.totais.liquido]);
      linhaTotal.font = { bold: true };
      linhaTotal.getCell(6).numFmt = '"R$" #,##0.00';
      linhaTotal.getCell(7).numFmt = '"R$" #,##0.00';
      linhaTotal.eachCell((c) => { c.border = { top: { style: "thin" } }; });

      if (dados.congregacoesPendentes.length > 0) {
        ws.addRow([]);
        const nota = ws.addRow([
          `Fora deste total: ${dados.congregacoesPendentes.length} congregação(ões) sem pedido confirmado — ${dados.congregacoesPendentes.map((p) => p.nome).join(", ")}`,
        ]);
        ws.mergeCells(nota.number, 1, nota.number, 7);
        nota.font = { italic: true, size: 9 };
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pedido-cpad-${dados.trimestre.chave}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  return (
    <>
      <div className="print:hidden">
        <Link href="/dashboard/revistas" className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] text-brand-200/60 transition-colors duration-300 hover:text-gold-200">
          <ArrowLeft className="h-3.5 w-3.5" />
          Pedidos de Lições
        </Link>

        <CabecalhoModulo icone={Receipt} titulo="Pedido Consolidado — CPAD" descricao="Todos os pedidos confirmados do campo, no formato oficial da CPAD">
          <SeletorTrimestre selecionado={trimestre} aoSelecionar={setTrimestre} />
          {dados && (
            <>
              <Button size="sm" variant="ghost" onClick={() => void exportarXlsx()} disabled={exportando}>
                {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Exportar XLSX
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Imprimir / PDF
              </Button>
            </>
          )}
        </CabecalhoModulo>
      </div>

      {erro ? (
        <div className="print:hidden"><EstadoErro mensagem={erro} /></div>
      ) : !dados ? (
        <div className="print:hidden"><EsqueletoLista linhas={8} /></div>
      ) : (
        <>
          {/* Cabeçalho impresso — logo + identificação institucional */}
          <div className="hidden text-center print:mb-5 print:block print:border-b-2 print:border-black print:pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- impressão simples, sem pipeline do next/image */}
            <img src={LOGO_SRC} alt="" className="mx-auto mb-2 h-16 w-auto object-contain" />
            <p className="text-[0.72rem] uppercase tracking-[0.2em]">Igreja Evangélica Assembleia de Deus em Pernambuco</p>
            <p className="text-[0.7rem] uppercase tracking-[0.16em]">Campo de Betânia (PE)</p>
            <h1 className="mt-1.5 text-[1.15rem] font-bold uppercase tracking-wide">Pedido de Lição — Consolidado</h1>
            <p className="mt-1 text-[0.86rem]">
              {dados.trimestre.rotulo} · gerado em {fmtDataHoje.format(new Date())}
            </p>
          </div>

          <div className="print:hidden">
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi icone={ShoppingCart} rotulo="Itens no pedido" valor={numero(dados.totais.quantidade)} nota="soma de todas as congregações" />
              <Kpi icone={PackageCheck} rotulo="Congregações confirmadas" valor={`${dados.congregacoesConfirmadas} de ${dados.congregacoesTotal}`} nota="pedidos que entraram na soma" />
              <Kpi icone={Receipt} rotulo="Total líquido (CPAD)" valor={dinheiro.format(dados.totais.liquido)} nota={`bruto ${dinheiro.format(dados.totais.bruto)}`} />
            </div>

            {dados.congregacoesPendentes.length > 0 && (
              <p className="mt-3 text-[0.76rem] text-brand-200/50">
                Fora deste total — sem pedido confirmado neste trimestre: {dados.congregacoesPendentes.map((p) => p.nome).join(", ")}.
              </p>
            )}
          </div>

          <div className="glass-panel mt-4 overflow-hidden rounded-2xl print:mt-0 print:border-none print:bg-transparent print:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left">
                <thead>
                  <tr className="border-b border-white/8 text-[0.66rem] uppercase tracking-[0.14em] text-brand-200/45 print:border-black print:text-black">
                    <th className="px-4 py-2.5 font-medium">Código</th>
                    <th className="px-2 py-2.5 text-right font-medium">Qt</th>
                    <th className="px-3 py-2.5 font-medium">Classe</th>
                    <th className="px-3 py-2.5 font-medium">Idade</th>
                    <th className="px-3 py-2.5 text-right font-medium">Un.</th>
                    <th className="px-3 py-2.5 text-right font-medium">Bruto</th>
                    <th className="px-4 py-2.5 text-right font-medium">Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 print:divide-black/20">
                  {dados.linhas.map((l) => (
                    <tr key={`${l.categoria}|${l.tipo}`} className={l.quantidade === 0 ? "opacity-45 print:opacity-100" : ""}>
                      <td className="px-4 py-2 text-[0.8rem] tabular-nums text-brand-200/60 print:text-black">{l.codigo}</td>
                      <td className="px-2 py-2 text-right text-[0.86rem] font-semibold tabular-nums text-white print:text-black">{l.quantidade || "—"}</td>
                      <td className="px-3 py-2 text-[0.82rem] text-brand-50 print:text-black">{l.classe}</td>
                      <td className="px-3 py-2 text-[0.76rem] text-brand-200/55 print:text-black">{l.idade}</td>
                      <td className="px-3 py-2 text-right text-[0.78rem] tabular-nums text-brand-200/55 print:text-black">{dinheiro.format(l.unitario)}</td>
                      <td className="px-3 py-2 text-right text-[0.78rem] tabular-nums text-brand-200/60 print:text-black">{l.bruto > 0 ? dinheiro.format(l.bruto) : "—"}</td>
                      <td className="px-4 py-2 text-right text-[0.82rem] font-semibold tabular-nums text-gold-200 print:text-black">{l.liquido > 0 ? dinheiro.format(l.liquido) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-white/15 print:border-black">
                    <td className="px-4 py-3" />
                    <td className="px-2 py-3 text-right text-[0.86rem] font-semibold tabular-nums text-white print:text-black">{numero(dados.totais.quantidade)}</td>
                    <td className="px-3 py-3 text-[0.8rem] font-semibold uppercase tracking-wide text-brand-100/85 print:text-black" colSpan={2}>Total do pedido</td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-right text-[0.86rem] font-semibold tabular-nums text-white print:text-black">{dinheiro.format(dados.totais.bruto)}</td>
                    <td className="px-4 py-3 text-right text-[0.92rem] font-bold tabular-nums text-gold-200 print:text-black">{dinheiro.format(dados.totais.liquido)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <section className="mt-10 hidden grid-cols-2 gap-8 text-center text-[0.8rem] print:grid">
            <div>
              <div className="mb-1 border-t border-black pt-1.5">&nbsp;</div>
              Secretaria do Campo
            </div>
            <div>
              <div className="mb-1 border-t border-black pt-1.5">{fmtDataHoje.format(new Date())}</div>
              Data
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Kpi({ icone: Icone, rotulo, valor, nota }: { icone: typeof ShoppingCart; rotulo: string; valor: string; nota: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/8">
          <Icone className="h-4 w-4 text-gold-300" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[1.2rem] font-semibold leading-none text-white tabular-nums">{valor}</p>
          <p className="mt-1 truncate text-[0.74rem] text-brand-100/75">{rotulo}</p>
        </div>
      </div>
      <p className="mt-2 truncate text-[0.7rem] text-brand-200/45">{nota}</p>
    </div>
  );
}
