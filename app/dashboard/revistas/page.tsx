"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookMarked, Building2, CalendarClock, ChevronRight, Coins, Loader2, Plus, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo, EsqueletoLista, EstadoErro, EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { useAcesso } from "@/components/acesso/AcessoProvider";

/**
 * Pedido de Lição — por congregação, com detalhe por classe e baixa parcial.
 *
 * O pedido é a conta pronta (alunos ativos × preço). O que a secretaria faz
 * aqui é acompanhar o pagamento: vê o total de cada congregação, abre as
 * classes, e vai dando baixa à medida que os alunos pagam. A data-limite é a
 * lição 02 do próximo trimestre, e a administração do campo pode mudá-la.
 */

interface Baixa {
  id: number; valor: number; observacao: string | null; autor: string | null; criadoEm: string;
}
interface ClasseItem {
  classeId: number; classe: string; faixa: string; categoriaRotulo: string;
  categoriaEncontrada: boolean; alunos: number; precoUnitario: number | null; subtotal: number;
}
interface CongPedido {
  congId: number; nome: string; revistas: number; totalDevido: number;
  pago: number; saldo: number; semPreco: number; classes: ClasseItem[]; pagamentos: Baixa[];
}
interface Preco {
  categoria: string; rotulo: string; aluno: number | null; ampliada: number | null; capaDura: number | null;
}
interface Dados {
  trimestre: { rotulo: string };
  dataLimite: string; dataLimitePadrao: string; dataLimiteDefinida: boolean; podeDefinirLimite: boolean;
  precos: Preco[];
  congregacoes: CongPedido[];
  resumo: { revistas: number; totalDevido: number; totalPago: number; saldo: number };
}

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function RevistasPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const [verPrecos, setVerPrecos] = useState(false);
  const { podeGravar } = useAcesso();
  const editavel = podeGravar("revistas");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/revistas", { cache: "no-store" });
      if (!res.ok) throw Object.assign(new Error(), { status: res.status });
      setDados(await res.json());
      setErro(null);
    } catch (e) {
      const status = (e as { status?: number }).status;
      setErro(status === 403 ? "O seu acesso não permite ver o pedido." : "Não foi possível carregar o pedido.");
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  return (
    <>
      <CabecalhoModulo
        icone={BookMarked}
        titulo="Pedido de Lição"
        descricao={dados ? dados.trimestre.rotulo : "Revistas por congregação"}
        total={dados?.congregacoes.length ?? null}
      >
        {dados && (
          <button
            type="button"
            onClick={() => setVerPrecos((v) => !v)}
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem] text-brand-200/70 transition-colors hover:border-gold-400/30 hover:text-gold-200"
          >
            <Coins className="h-4 w-4" />
            {verPrecos ? "Ocultar preços" : "Tabela de preços"}
          </button>
        )}
      </CabecalhoModulo>

      {erro ? <EstadoErro mensagem={erro} />
      : !dados ? <EsqueletoLista linhas={6} />
      : (
        <>
          {verPrecos && <TabelaPrecos precos={dados.precos} />}

          {/* Resumo do campo */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Cartao icone={BookMarked} rotulo="Revistas no total" valor={String(dados.resumo.revistas)} nota="uma por aluno ativo" />
            <Cartao icone={Coins} rotulo="Total do pedido" valor={dinheiro.format(dados.resumo.totalDevido)} nota="calculado" />
            <Cartao icone={Coins} rotulo="Já pago" valor={dinheiro.format(dados.resumo.totalPago)} nota="soma das baixas" cor="text-emerald-300" />
            <Cartao
              icone={Coins}
              rotulo="Saldo a pagar"
              valor={dinheiro.format(dados.resumo.saldo)}
              nota="total menos o pago"
              cor={dados.resumo.saldo > 0 ? "text-gold-200" : "text-emerald-300"}
            />
          </div>

          <LimiteDePagamento dados={dados} editavel={editavel} aoMudar={() => void carregar()} />

          {/* Congregações */}
          <div className="mt-4 space-y-2.5">
            {dados.congregacoes.length === 0 ? (
              <EstadoVazio mensagem="Nenhuma congregação no seu alcance." />
            ) : (
              dados.congregacoes.map((c) => (
                <CartaoCongregacao
                  key={c.congId}
                  cong={c}
                  aberto={aberta === c.congId}
                  aoAlternar={() => setAberta(aberta === c.congId ? null : c.congId)}
                  editavel={editavel}
                  aoMudar={() => void carregar()}
                />
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}

function Cartao({ icone: Icone, rotulo, valor, nota, cor }: {
  icone: typeof Coins; rotulo: string; valor: string; nota: string; cor?: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/8">
          <Icone className="h-4 w-4 text-gold-300" />
        </span>
        <div className="min-w-0">
          <p className={cn("font-display text-[1.2rem] font-semibold leading-none tabular-nums", cor ?? "text-white")}>{valor}</p>
          <p className="mt-1 truncate text-[0.74rem] text-brand-100/75">{rotulo}</p>
        </div>
      </div>
      <p className="mt-2 truncate text-[0.7rem] text-brand-200/45">{nota}</p>
    </div>
  );
}

function TabelaPrecos({ precos }: { precos: Preco[] }) {
  return (
    <div className="glass-panel mb-4 overflow-hidden rounded-2xl">
      <header className="border-b border-white/8 px-5 py-3">
        <h2 className="font-display text-[0.82rem] uppercase tracking-[0.14em] text-gold-300">Preços das revistas do aluno</h2>
        <p className="mt-0.5 text-[0.72rem] text-brand-200/50">Por categoria — é o preço que multiplica o número de alunos.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left">
          <thead>
            <tr className="text-[0.66rem] uppercase tracking-[0.12em] text-brand-200/45">
              <th className="px-5 py-2 font-medium">Categoria</th>
              <th className="px-3 py-2 text-right font-medium">Comum</th>
              <th className="px-3 py-2 text-right font-medium">Ampliada</th>
              <th className="px-5 py-2 text-right font-medium">Capa Dura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {precos.map((p) => (
              <tr key={p.categoria}>
                <td className="px-5 py-2 text-[0.82rem] text-brand-50">{p.rotulo}</td>
                <td className="px-3 py-2 text-right text-[0.8rem] tabular-nums text-brand-100/80">
                  {p.aluno !== null ? dinheiro.format(p.aluno) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-[0.8rem] tabular-nums text-brand-200/60">
                  {p.ampliada !== null ? dinheiro.format(p.ampliada) : "—"}
                </td>
                <td className="px-5 py-2 text-right text-[0.8rem] tabular-nums text-brand-200/60">
                  {p.capaDura !== null ? dinheiro.format(p.capaDura) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LimiteDePagamento({ dados, editavel, aoMudar }: { dados: Dados; editavel: boolean; aoMudar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(dados.dataLimite);
  const [salvando, setSalvando] = useState(false);

  async function gravar(novo: string | null) {
    setSalvando(true);
    try {
      await fetch("/api/revistas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataLimite: novo }),
      });
      setEditando(false);
      aoMudar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-gold-400/20 bg-gold-400/[0.05] px-4 py-3">
      <CalendarClock className="h-4 w-4 shrink-0 text-gold-300" />
      {editando ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="h-9 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-[0.82rem] text-brand-50 [color-scheme:dark] focus:outline-none"
          />
          <Button size="sm" onClick={() => void gravar(valor)} disabled={salvando}>
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void gravar(null)} disabled={salvando}>
            Voltar ao padrão
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>
        </div>
      ) : (
        <>
          <p className="text-[0.82rem] text-brand-100/85">
            Data-limite de pagamento:{" "}
            <strong className="text-gold-200">{fmtData.format(new Date(`${dados.dataLimite}T12:00:00`))}</strong>
            <span className="ml-2 text-[0.72rem] text-brand-200/50">
              {dados.dataLimiteDefinida ? "(definida)" : "(padrão: lição 02 do próximo trimestre)"}
            </span>
          </p>
          {editavel && dados.podeDefinirLimite && (
            <button
              type="button"
              onClick={() => { setValor(dados.dataLimite); setEditando(true); }}
              className="text-[0.76rem] text-gold-200/80 underline-offset-2 hover:underline"
            >
              alterar
            </button>
          )}
        </>
      )}
    </div>
  );
}

function CartaoCongregacao({ cong, aberto, aoAlternar, editavel, aoMudar }: {
  cong: CongPedido; aberto: boolean; aoAlternar: () => void; editavel: boolean; aoMudar: () => void;
}) {
  const pct = cong.totalDevido > 0 ? Math.min(100, (cong.pago / cong.totalDevido) * 100) : 0;
  const quitado = cong.saldo <= 0 && cong.totalDevido > 0;

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <button type="button" onClick={aoAlternar} aria-expanded={aberto} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]">
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-brand-300/50 transition-transform duration-300", aberto && "rotate-90")} />
        <Building2 className="h-4 w-4 shrink-0 text-gold-300/70" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[0.92rem] font-semibold text-white">{cong.nome}</p>
          <p className="text-[0.72rem] text-brand-200/55">
            {cong.revistas} revistas · {cong.classes.length} classes
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[0.86rem] font-semibold tabular-nums text-white">{dinheiro.format(cong.totalDevido)}</p>
          {quitado ? (
            <Badge variant="sucesso">quitado</Badge>
          ) : (
            <p className="text-[0.72rem] tabular-nums text-gold-200/80">saldo {dinheiro.format(cong.saldo)}</p>
          )}
        </div>
      </button>

      {cong.totalDevido > 0 && (
        <div className="px-4 pb-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
            <span className={cn("block h-full rounded-full", quitado ? "bg-emerald-400" : "bg-gradient-to-r from-brand-400 to-gold-400")} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {aberto && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-white/6 p-3">
          {cong.semPreco > 0 && (
            <p className="mb-2 text-[0.74rem] text-gold-200/70">
              {cong.semPreco} classe(s) sem preço de categoria — não entraram no total.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left">
              <thead>
                <tr className="text-[0.64rem] uppercase tracking-[0.12em] text-brand-200/45">
                  <th className="px-3 py-2 font-medium">Classe</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 text-right font-medium">Alunos</th>
                  <th className="px-3 py-2 text-right font-medium">Unit.</th>
                  <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {cong.classes.map((cl) => (
                  <tr key={cl.classeId}>
                    <td className="px-3 py-2 text-[0.82rem] text-brand-50">{cl.classe}</td>
                    <td className="px-3 py-2 text-[0.76rem] text-brand-200/60">
                      {cl.categoriaEncontrada ? cl.categoriaRotulo : <span className="text-flame-400/70">sem preço</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-[0.8rem] tabular-nums text-brand-100/80">{cl.alunos}</td>
                    <td className="px-3 py-2 text-right text-[0.8rem] tabular-nums text-brand-200/60">
                      {cl.precoUnitario !== null ? dinheiro.format(cl.precoUnitario) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-[0.82rem] font-semibold tabular-nums text-gold-200">
                      {dinheiro.format(cl.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10">
                  <td colSpan={4} className="px-3 py-2 text-right text-[0.76rem] uppercase tracking-wide text-brand-200/50">Total da congregação</td>
                  <td className="px-3 py-2 text-right text-[0.9rem] font-semibold tabular-nums text-white">{dinheiro.format(cong.totalDevido)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <PagamentosDaCong cong={cong} editavel={editavel} aoMudar={aoMudar} />
        </motion.div>
      )}
    </div>
  );
}

function PagamentosDaCong({ cong, editavel, aoMudar }: { cong: CongPedido; editavel: boolean; aoMudar: () => void }) {
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function darBaixa() {
    const n = Number(valor.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) { setMsg("Informe um valor maior que zero."); return; }
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/revistas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congId: cong.congId, valor: n, observacao: obs.trim() || undefined }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível registrar.");
      setValor(""); setObs("");
      aoMudar();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function desfazer(id: number) {
    await fetch(`/api/revistas?id=${id}`, { method: "DELETE" });
    aoMudar();
  }

  return (
    <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[0.7rem] uppercase tracking-[0.14em] text-brand-200/50">Pagamentos (baixas)</p>
        <p className="text-[0.76rem] tabular-nums text-brand-100/75">
          pago <span className="text-emerald-300">{dinheiro.format(cong.pago)}</span> · saldo{" "}
          <span className={cong.saldo > 0 ? "text-gold-200" : "text-emerald-300"}>{dinheiro.format(cong.saldo)}</span>
        </p>
      </div>

      {cong.pagamentos.length > 0 && (
        <ul className="mb-2 divide-y divide-white/6">
          {cong.pagamentos.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-1.5">
              <span className="w-24 shrink-0 text-[0.82rem] font-medium tabular-nums text-emerald-300">{dinheiro.format(b.valor)}</span>
              <span className="min-w-0 flex-1 truncate text-[0.76rem] text-brand-100/70">
                {b.observacao || "sem observação"}
                {b.autor && <span className="text-brand-300/45"> · {b.autor}</span>}
              </span>
              <span className="shrink-0 text-[0.7rem] tabular-nums text-brand-300/45">
                {fmtData.format(new Date(b.criadoEm))}
              </span>
              {editavel && (
                <button type="button" onClick={() => void desfazer(b.id)} aria-label="Desfazer baixa" className="shrink-0 rounded p-1 text-brand-300/50 hover:text-flame-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editavel && cong.saldo > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[0.66rem] uppercase tracking-wide text-brand-200/45">Valor pago</span>
            <div className="flex h-9 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2">
              <span className="text-[0.74rem] text-brand-300/50">R$</span>
              <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00"
                className="w-20 bg-transparent text-right text-[0.82rem] tabular-nums text-brand-50 focus:outline-none" />
            </div>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[0.66rem] uppercase tracking-wide text-brand-200/45">Observação (opcional)</span>
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: Classe Adultos, 8 alunos"
              className="h-9 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 text-[0.82rem] text-brand-50 placeholder:text-brand-200/35 focus:outline-none" />
          </label>
          <Button size="sm" onClick={() => void darBaixa()} disabled={salvando}>
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Dar baixa
          </Button>
        </div>
      )}
      {msg && <p className="mt-1.5 text-[0.76rem] text-flame-400">{msg}</p>}
      {cong.saldo <= 0 && cong.totalDevido > 0 && (
        <p className="mt-1 text-[0.78rem] text-emerald-300">Pedido quitado.</p>
      )}
    </div>
  );
}
