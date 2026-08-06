"use client";

import { useEffect, useState } from "react";
import { NotebookPen, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { CabecalhoModulo, EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import { Button } from "@/components/ui/button";
import { domingoMaisRecente } from "@/lib/dashboard/formato";

/**
 * Relatório Semanal — o formulário de papel da Superintendência das Escolas
 * Dominicais, calculado.
 *
 * ============================================================================
 * SEM BÍBLIAS, SEM OFERTAS — POR PEDIDO EXPLÍCITO, E PORQUE NÃO HÁ DE ONDE TIRAR
 *
 * O modelo original tem sete colunas; esta tem cinco. "Bíblias" e "Ofertas"
 * saíram porque o usuário pediu, e também porque a oferta já tinha saído dos
 * relatórios do portal antes (ver README) — não existe tabela de bíblias
 * distribuídas em lugar nenhum do sistema.
 *
 * "Visita Ministerial" e "Nº de Conversões" continuam no papel, mas em
 * branco: não há como calcular o que nenhuma tabela guarda. A tela deixa
 * claro que são para preencher à mão, em vez de fingir um zero apurado.
 * ============================================================================
 */

interface Linha {
  classeId: number; nome: string; matriculados: number;
  presentes: number | null; visitantes: number; professores: number; total: number | null;
}
interface PrimeiroLugar { nomes: string[]; valor: number }
interface Dados {
  congId: number; congNome: string; data: string;
  linhas: Linha[];
  totais: { matriculados: number; presentes: number | null; visitantes: number; professores: number };
  primeiroLugar: { frequencia: PrimeiroLugar | null; visitantes: PrimeiroLugar | null };
  lideranca: {
    dirigente: string | null; viceDirigente: string | null; secretarioLocal: string | null;
    coordenador: string | null; totalProfessores: number;
  };
}
interface CongOpcao { id: number; nome: string }

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function RelatorioSemanalPage() {
  const [congregacoes, setCongregacoes] = useState<CongOpcao[] | null>(null);
  const [congId, setCongId] = useState<number | null>(null);
  const [data, setData] = useState("");
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCong, setErroCong] = useState<string | null>(null);

  useEffect(() => setData(domingoMaisRecente()), []);

  useEffect(() => {
    void fetch("/api/congregacoes", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.erro ?? `HTTP ${r.status}`);
        return d;
      })
      .then((d) => {
        const lista: CongOpcao[] = (d.itens ?? []).map((c: { id: number; nome: string }) => ({
          id: c.id,
          nome: c.nome || `Congregação ${c.id}`,
        }));
        setCongregacoes(lista);
        if (lista.length >= 1) setCongId(lista[0].id);
        else setErroCong("Nenhuma congregação no seu alcance.");
      })
      .catch((e) =>
        setErroCong((e as Error).message || "Não foi possível carregar as congregações."),
      );
  }, []);

  useEffect(() => {
    if (congId === null || !data) return;
    const controle = new AbortController();
    setErro(null);
    (async () => {
      try {
        const url = new URL("/api/relatorios/semanal", window.location.origin);
        url.searchParams.set("cong", String(congId));
        url.searchParams.set("data", data);
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        const corpo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(corpo.erro ?? `HTTP ${res.status}`);
        setDados(corpo);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setErro((e as Error).message || "Não foi possível carregar o relatório.");
        setDados(null);
      }
    })();
    return () => controle.abort();
  }, [congId, data]);

  return (
    <>
      <div className="print:hidden">
        <CabecalhoModulo
          icone={NotebookPen}
          titulo="Relatório Semanal"
          descricao="No modelo da Superintendência das Escolas Dominicais — sem bíblias e sem ofertas"
        >
          <div className="flex flex-wrap items-center gap-2">
            {congregacoes && congregacoes.length > 1 && (
              <select
                value={congId ?? ""}
                onChange={(e) => setCongId(Number(e.target.value))}
                className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.82rem] text-brand-50 [&>option]:bg-brand-900 focus:outline-none"
              >
                {congregacoes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.82rem] text-brand-50 [color-scheme:dark] focus:outline-none"
            />
            {dados && (
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            )}
          </div>
        </CabecalhoModulo>

        {erroCong && <EstadoErro mensagem={erroCong} />}
      </div>

      {erro ? (
        <div className="print:hidden"><EstadoErro mensagem={erro} /></div>
      ) : erroCong || congId === null ? null : !dados ? (
        <div className="print:hidden"><EsqueletoLista linhas={6} /></div>
      ) : (
        <RelatorioImpresso dados={dados} />
      )}
    </>
  );
}

function RelatorioImpresso({ dados }: { dados: Dados }) {
  const semChamadaAlguma = dados.linhas.every((l) => l.presentes === null);

  return (
    <div className="glass-panel mx-auto max-w-[52rem] overflow-hidden rounded-2xl p-6 print:m-0 print:max-w-none print:rounded-none print:border-0 print:p-2 print:shadow-none sm:p-8">
      {/* ---------------- Cabeçalho institucional ---------------- */}
      <header className="mb-5 border-b-2 border-gold-400/30 pb-4 text-center print:border-black">
        <p className="font-display text-[0.72rem] uppercase tracking-[0.2em] text-gold-300/80 print:text-black">
          Superintendência das Escolas Dominicais
        </p>
        <p className="mt-0.5 text-[0.7rem] text-brand-200/55 print:text-black">
          Assembleia de Deus — IEADPE, Campo de Betânia (PE)
        </p>
        <h1 className="mt-2 font-display text-[1.3rem] font-semibold uppercase tracking-wide text-white print:text-black">
          Relatório Semanal
        </h1>
        <p className="mt-1 text-[0.86rem] text-brand-100/80 print:text-black">
          <strong>{dados.congNome}</strong> — {fmtData.format(new Date(`${dados.data}T12:00:00`))}
        </p>
      </header>

      {/* ---------------- Classes ---------------- */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-white/15 text-[0.68rem] uppercase tracking-[0.1em] text-brand-200/55 print:border-black print:text-black">
              <th className="py-2 pr-2 font-semibold">Classe</th>
              <th className="px-2 py-2 text-right font-semibold">Matric.</th>
              <th className="px-2 py-2 text-right font-semibold">Presentes</th>
              <th className="px-2 py-2 text-right font-semibold">Visitantes</th>
              <th className="px-2 py-2 text-right font-semibold">Professor</th>
              <th className="px-2 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8 print:divide-black">
            {dados.linhas.map((l) => (
              <tr key={l.classeId}>
                <td className="py-1.5 pr-2 text-[0.84rem] text-brand-50 print:text-black">{l.nome}</td>
                <td className="px-2 py-1.5 text-right text-[0.84rem] tabular-nums text-brand-100/85 print:text-black">
                  {l.matriculados}
                </td>
                <td className="px-2 py-1.5 text-right text-[0.84rem] tabular-nums text-brand-100/85 print:text-black">
                  {l.presentes === null ? "—" : l.presentes}
                </td>
                <td className="px-2 py-1.5 text-right text-[0.84rem] tabular-nums text-brand-100/85 print:text-black">
                  {l.visitantes}
                </td>
                <td className="px-2 py-1.5 text-right text-[0.84rem] tabular-nums text-brand-100/85 print:text-black">
                  {l.professores}
                </td>
                <td className="px-2 py-1.5 text-right text-[0.86rem] font-semibold tabular-nums text-gold-200 print:text-black">
                  {l.total === null ? "—" : l.total}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-white/20 print:border-black">
              <td className="py-2 pr-2 text-[0.78rem] font-semibold uppercase tracking-wide text-brand-100/85 print:text-black">
                Total
              </td>
              <td className="px-2 py-2 text-right text-[0.86rem] font-semibold tabular-nums text-white print:text-black">
                {dados.totais.matriculados}
              </td>
              <td className="px-2 py-2 text-right text-[0.86rem] font-semibold tabular-nums text-white print:text-black">
                {dados.totais.presentes === null ? "—" : dados.totais.presentes}
              </td>
              <td className="px-2 py-2 text-right text-[0.86rem] font-semibold tabular-nums text-white print:text-black">
                {dados.totais.visitantes}
              </td>
              <td className="px-2 py-2 text-right text-[0.86rem] font-semibold tabular-nums text-white print:text-black">
                {dados.totais.professores}
              </td>
              <td className="px-2 py-2 text-right text-[0.86rem] font-semibold tabular-nums text-gold-200 print:text-black">
                {dados.totais.presentes === null ? "—" : dados.totais.presentes + dados.totais.visitantes}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {semChamadaAlguma && (
        <p className="mt-1.5 text-[0.72rem] text-brand-200/45 print:text-black">
          Nenhuma classe fez chamada nesta data ainda — "Presentes" aparece como "—", não como zero.
        </p>
      )}
      <p className="mt-1 text-[0.68rem] text-brand-200/40 print:text-black">
        "Professor" conta vínculos por classe — quem dá aula em duas classes entra duas vezes aqui.
      </p>

      {/* ---------------- Liderança e outros ---------------- */}
      <section className="mt-6 grid gap-x-8 gap-y-1.5 border-t border-white/10 pt-4 text-[0.84rem] sm:grid-cols-2 print:border-black">
        <LinhaLideranca rotulo="Dirigente" valor={dados.lideranca.dirigente} />
        <LinhaLideranca rotulo="Vice-Dirigente" valor={dados.lideranca.viceDirigente} />
        <LinhaLideranca rotulo="Secretário(a)" valor={dados.lideranca.secretarioLocal} />
        {dados.lideranca.coordenador && <LinhaLideranca rotulo="Coordenador(a)" valor={dados.lideranca.coordenador} />}
        <LinhaLideranca rotulo="Total de professores" valor={String(dados.lideranca.totalProfessores)} />
        <LinhaLideranca rotulo="Visita Ministerial" valor={null} preencherAMao />
        <LinhaLideranca rotulo="Nº de Conversões" valor={null} preencherAMao />
      </section>

      {/* ---------------- 1º lugar ---------------- */}
      <section className="mt-6 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 print:border-black">
        <CaixaPrimeiroLugar titulo="1º Lugar — Frequência" resultado={dados.primeiroLugar.frequencia} unidade="presentes" />
        <CaixaPrimeiroLugar titulo="1º Lugar — Visitantes" resultado={dados.primeiroLugar.visitantes} unidade="visitantes" />
      </section>

      {/* ---------------- Assinaturas ---------------- */}
      <section className="mt-10 grid gap-8 text-center text-[0.8rem] text-brand-100/75 sm:grid-cols-2 print:text-black">
        <div>
          <div className="mb-1 border-t border-brand-200/40 pt-1.5 print:border-black">
            {dados.lideranca.secretarioLocal || " "}
          </div>
          Secretário(a)
        </div>
        <div>
          <div className="mb-1 border-t border-brand-200/40 pt-1.5 print:border-black">
            {dados.lideranca.dirigente || " "}
          </div>
          Dirigente
        </div>
      </section>
    </div>
  );
}

function LinhaLideranca({ rotulo, valor, preencherAMao }: { rotulo: string; valor: string | null; preencherAMao?: boolean }) {
  return (
    <p className="flex items-baseline justify-between gap-2 text-brand-100/80 print:text-black">
      <span className="text-brand-200/55 print:text-black">{rotulo}:</span>
      <span
        className={cn(
          "min-w-[8rem] flex-1 text-right",
          valor ? "text-brand-50 print:text-black" : "border-b border-dotted border-brand-200/30 print:border-black",
        )}
      >
        {valor ?? (preencherAMao ? "" : "—")}
      </span>
    </p>
  );
}

function CaixaPrimeiroLugar({ titulo, resultado, unidade }: { titulo: string; resultado: PrimeiroLugar | null; unidade: string }) {
  return (
    <div className="rounded-xl border border-gold-400/25 bg-gold-400/[0.04] px-4 py-3 text-center print:border-black print:bg-transparent">
      <p className="text-[0.66rem] uppercase tracking-[0.12em] text-gold-300/80 print:text-black">{titulo}</p>
      {resultado ? (
        <p className="mt-1 text-[0.86rem] text-brand-50 print:text-black">
          <strong>{resultado.nomes.join(" e ")}</strong> — {resultado.valor} {unidade}
        </p>
      ) : (
        <p className="mt-1 text-[0.8rem] italic text-brand-200/45 print:text-black">sem dado ainda</p>
      )}
    </div>
  );
}
