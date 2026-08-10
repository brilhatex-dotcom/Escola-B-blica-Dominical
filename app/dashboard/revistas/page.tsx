"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle, BadgeCheck, BookMarked, Building2, ChevronRight,
  Clock, Coins, FilePlus2, HandCoins, Loader2, PenLine, Plus, Settings2, Sparkles, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo, EsqueletoLista, EstadoErro, EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { SeletorTrimestre } from "@/components/revistas/SeletorTrimestre";
import { SituacaoBadge } from "@/components/revistas/SituacaoBadge";
import { PrazoTexto } from "@/components/revistas/PrazoTexto";
import { trimestreDe } from "@/lib/revistas/trimestre";

/**
 * Pedidos de Lições — o painel de acompanhamento, separado de propósito do
 * assistente de "Novo Pedido" (`/dashboard/revistas/novo`).
 *
 * ============================================================================
 * ACOMPANHAR NÃO É A MESMA TAREFA QUE PEDIR
 *
 * Até a Fase 22, uma tela só fazia as duas coisas: digitar quantidade E
 * conferir quem já pagou. As duas pedem atenções diferentes — uma é "eu,
 * agora, decidindo quanto pedir"; a outra é "eu, de vez em quando, olhando
 * como o campo está indo" — e misturadas, cada visita à tela carregava a
 * complexidade das duas. Esta tela ficou só com a segunda: números do
 * trimestre, quem está com pedido/rascunho/pago/atrasado, e o detalhe de
 * cada congregação para dar baixa. Pedir revista de verdade é sempre no
 * assistente.
 * ============================================================================
 */

interface Baixa {
  id: number; valor: number; observacao: string | null; autor: string | null; criadoEm: string;
}
interface ClasseItem {
  classeId: number; classe: string; faixa: string; categoriaRotulo: string;
  categoriaEncontrada: boolean; alunos: number; precoUnitario: number | null; subtotal: number;
  professores: number; precoProfessor: number | null; subtotalProfessor: number;
}
type SituacaoCongregacao = "sem-pedido" | "quitado" | "pendente" | "parcial" | "atraso";
interface PedidoResumo {
  confirmado: boolean; confirmadoEm: string | null; confirmadoPor: string | null;
  total: number; revistas: number;
}
interface Sugestao { revistas: number; total: number }
interface CongPedido {
  congId: number; nome: string; revistas: number; totalDevido: number;
  pago: number; saldo: number; situacao: SituacaoCongregacao;
  pedido: PedidoResumo | null; sugestao: Sugestao;
  semPreco: number; classes: ClasseItem[]; pagamentos: Baixa[];
}
interface Preco {
  categoria: string; rotulo: string; aluno: number | null; ampliada: number | null; capaDura: number | null;
}
type SituacaoTrimestre = "aberto" | "fechado" | "pago" | "atraso";
type NivelPrazo = "tranquilo" | "atencao" | "urgente" | "vencido";
interface Prazo { dias: number; nivel: NivelPrazo }
type TipoAlertaRevista = "pagamento-vencido" | "prazo-encerrando" | "sem-pagamento" | "sem-pedido";
interface AlertaRevista {
  nivel: "critico" | "atencao"; tipo: TipoAlertaRevista; congId: number; congNome: string;
  titulo: string; descricao: string;
}
interface Dados {
  trimestre: { chave: string; rotulo: string; tema: string | null };
  trimestreProximo: string;
  dataLimite: string; dataLimitePadrao: string; dataLimiteDefinida: boolean; podeDefinirLimite: boolean;
  dataLimitePagamento: string; dataLimitePedido: string | null;
  prazos: { pagamento: Prazo; pedido: Prazo | null };
  situacao: { situacao: SituacaoTrimestre; rotulo: string };
  precos: Preco[];
  congregacoes: CongPedido[];
  resumo: {
    revistas: number; congregacoes: number; totalDevido: number; totalPago: number; saldo: number;
    percentualPago: number | null;
    congregacoesPagas: number; congregacoesPendentes: number; congregacoesAtrasadas: number;
    congregacoesSemPedido: number;
  };
  alertas: AlertaRevista[];
}

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function RevistasPage() {
  const [trimestre, setTrimestre] = useState(() => trimestreDe(new Date()).chave);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const [verPrecos, setVerPrecos] = useState(false);
  const { podeGravar } = useAcesso();
  const editavel = podeGravar("revistas");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/revistas?trimestre=${trimestre}`, { cache: "no-store" });
      if (!res.ok) throw Object.assign(new Error(), { status: res.status });
      setDados(await res.json());
      setErro(null);
    } catch (e) {
      const status = (e as { status?: number }).status;
      setErro(status === 403 ? "O seu acesso não permite ver o pedido." : "Não foi possível carregar o pedido.");
    }
  }, [trimestre]);

  useEffect(() => { setDados(null); void carregar(); }, [carregar]);

  const pedidosDoTrimestre = dados ? dados.resumo.congregacoes - dados.resumo.congregacoesSemPedido : 0;
  const nenhumPedidoAinda = dados ? dados.congregacoes.every((c) => c.pedido === null) : false;

  return (
    <>
      <CabecalhoModulo icone={BookMarked} titulo="Pedidos de Lições" descricao="Faça e acompanhe os pedidos de revistas da Escola Bíblica Dominical.">
        {editavel && (
          <Button asChild>
            <Link href={`/dashboard/revistas/novo?trimestre=${trimestre}`}>
              <Plus className="h-4 w-4" />
              Novo Pedido
            </Link>
          </Button>
        )}
        <SeletorTrimestre selecionado={trimestre} aoSelecionar={setTrimestre} />
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
        {dados?.podeDefinirLimite && (
          <Link
            href="/dashboard/revistas/precos"
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem] text-brand-200/70 transition-colors hover:border-gold-400/30 hover:text-gold-200"
          >
            <Settings2 className="h-4 w-4" />
            Editar preços
          </Link>
        )}
      </CabecalhoModulo>

      {erro ? <EstadoErro mensagem={erro} />
      : !dados ? <EsqueletoLista linhas={6} />
      : nenhumPedidoAinda ? (
        <>
          {verPrecos && <TabelaPrecos precos={dados.precos} />}
          <PainelTrimestre dados={dados} editavel={editavel} aoMudar={() => void carregar()} />
          <div className="glass-panel mt-4 rounded-2xl px-6 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-gold-400/20">
              <FilePlus2 className="h-6 w-6 text-gold-300" />
            </span>
            <p className="mx-auto mt-4 max-w-sm text-[0.94rem] text-brand-50">
              Você ainda não possui pedidos neste trimestre.
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-[0.8rem] text-brand-200/55">
              Comece fazendo o pedido de revistas da sua congregação.
            </p>
            {editavel && (
              <Button asChild className="mt-5">
                <Link href={`/dashboard/revistas/novo?trimestre=${trimestre}`}>
                  <Plus className="h-4 w-4" />
                  Fazer Primeiro Pedido
                </Link>
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          {verPrecos && <TabelaPrecos precos={dados.precos} />}

          <PainelTrimestre dados={dados} editavel={editavel} aoMudar={() => void carregar()} />

          {/* Indicadores do trimestre */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Cartao icone={BookMarked} rotulo="Pedidos do trimestre" valor={String(pedidosDoTrimestre)} nota={`de ${dados.resumo.congregacoes} congregações`} />
            <Cartao icone={Coins} rotulo="Total pedido" valor={dinheiro.format(dados.resumo.totalDevido)} nota="calculado" />
            <Cartao icone={HandCoins} rotulo="Total pago" valor={dinheiro.format(dados.resumo.totalPago)} nota="soma das baixas" cor="text-emerald-300" />
            <Cartao
              icone={Coins}
              rotulo="Saldo a pagar"
              valor={dinheiro.format(dados.resumo.saldo)}
              nota={dados.resumo.percentualPago !== null ? `${dados.resumo.percentualPago}% do pedido pago` : "total menos o pago"}
              cor={dados.resumo.saldo > 0 ? "text-gold-200" : "text-emerald-300"}
            />
            <Cartao
              icone={Clock}
              rotulo="Pedidos pendentes"
              valor={String(dados.resumo.congregacoesPendentes)}
              nota="dentro do prazo"
              cor="text-gold-200"
            />
            <Cartao
              icone={AlertTriangle}
              rotulo="Pedidos em atraso"
              valor={String(dados.resumo.congregacoesAtrasadas)}
              nota="prazo já passou"
              cor={dados.resumo.congregacoesAtrasadas > 0 ? "text-flame-400" : "text-brand-100/80"}
            />
          </div>

          {/* Pedidos */}
          <div className="mt-4 space-y-2.5">
            {dados.congregacoes.length === 0 ? (
              <EstadoVazio mensagem="Nenhuma congregação no seu alcance." />
            ) : (
              dados.congregacoes.map((c) => (
                <CartaoCongregacao
                  key={c.congId}
                  cong={c}
                  trimestre={trimestre}
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

/* ------------------------------------------------------------------ *
 * Painel do trimestre — tema, situação, os dois prazos
 * ------------------------------------------------------------------ */

const ROTULO_SITUACAO: Record<SituacaoTrimestre, string> = {
  aberto: "Aberto",
  fechado: "Fechado — aguardando pagamento",
  pago: "Pago",
  atraso: "Em atraso",
};
const VARIANTE_SITUACAO: Record<SituacaoTrimestre, "info" | "neutro" | "sucesso" | "erro"> = {
  aberto: "info",
  fechado: "neutro",
  pago: "sucesso",
  atraso: "erro",
};

function PainelTrimestre({ dados, editavel, aoMudar }: { dados: Dados; editavel: boolean; aoMudar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [tema, setTema] = useState(dados.trimestre.tema ?? "");
  const [pedido, setPedido] = useState(dados.dataLimitePedido ?? "");
  const [pagamento, setPagamento] = useState(dados.dataLimitePagamento);
  const [salvando, setSalvando] = useState(false);

  async function gravar() {
    setSalvando(true);
    try {
      await fetch("/api/revistas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trimestre: dados.trimestre.chave,
          tema: tema.trim() || null,
          dataLimitePedido: pedido || null,
          dataLimite: pagamento || null,
        }),
      });
      setEditando(false);
      aoMudar();
    } finally {
      setSalvando(false);
    }
  }

  function abrirEdicao() {
    setTema(dados.trimestre.tema ?? "");
    setPedido(dados.dataLimitePedido ?? "");
    setPagamento(dados.dataLimitePagamento);
    setEditando(true);
  }

  return (
    <div className="mt-3 rounded-2xl border border-gold-400/20 bg-gold-400/[0.05] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={VARIANTE_SITUACAO[dados.situacao.situacao]}>{ROTULO_SITUACAO[dados.situacao.situacao]}</Badge>
            {dados.trimestre.tema && !editando && (
              <span className="flex items-center gap-1.5 text-[0.82rem] text-brand-100/85">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-gold-300/70" />
                {dados.trimestre.tema}
              </span>
            )}
          </div>
        </div>
        {editavel && dados.podeDefinirLimite && !editando && (
          <button
            type="button"
            onClick={abrirEdicao}
            className="flex shrink-0 items-center gap-1.5 text-[0.76rem] text-gold-200/80 underline-offset-2 hover:underline"
          >
            <PenLine className="h-3.5 w-3.5" />
            editar tema e prazos
          </button>
        )}
      </div>

      {editando ? (
        <div className="mt-3 space-y-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[0.66rem] uppercase tracking-wide text-brand-200/45">Tema do trimestre</span>
            <input
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ex.: A Grandeza da Graça de Deus"
              className="h-9 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-[0.82rem] text-brand-50 placeholder:text-brand-200/35 focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[0.66rem] uppercase tracking-wide text-brand-200/45">Prazo do pedido (opcional)</span>
              <input
                type="date"
                value={pedido}
                onChange={(e) => setPedido(e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-[0.82rem] text-brand-50 [color-scheme:dark] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[0.66rem] uppercase tracking-wide text-brand-200/45">Prazo de pagamento</span>
              <input
                type="date"
                value={pagamento}
                onChange={(e) => setPagamento(e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-[0.82rem] text-brand-50 [color-scheme:dark] focus:outline-none"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => void gravar()} disabled={salvando}>
              {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setPedido(""); }}>Remover prazo do pedido</Button>
            <Button size="sm" variant="ghost" onClick={() => { setPagamento(dados.dataLimitePadrao); }}>Prazo de pagamento padrão</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {dados.prazos.pedido && (
            <PrazoTexto rotulo="Prazo do pedido" data={dados.dataLimitePedido!} dias={dados.prazos.pedido.dias} nivel={dados.prazos.pedido.nivel} />
          )}
          <div className="flex items-center gap-2">
            <PrazoTexto rotulo="Prazo de pagamento" data={dados.dataLimitePagamento} dias={dados.prazos.pagamento.dias} nivel={dados.prazos.pagamento.nivel} />
            <span className="text-[0.72rem] text-brand-200/45">
              {dados.dataLimiteDefinida ? "(definido)" : "(padrão: lição 02 do próximo trimestre)"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CartaoCongregacao({ cong, trimestre, aberto, aoAlternar, editavel, aoMudar }: {
  cong: CongPedido; trimestre: string; aberto: boolean; aoAlternar: () => void; editavel: boolean; aoMudar: () => void;
}) {
  const pct = cong.totalDevido > 0 ? Math.min(100, (cong.pago / cong.totalDevido) * 100) : 0;
  const quitado = cong.situacao === "quitado";

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <button type="button" onClick={aoAlternar} aria-expanded={aberto} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]">
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-brand-300/50 transition-transform duration-300", aberto && "rotate-90")} />
        <Building2 className="h-4 w-4 shrink-0 text-gold-300/70" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[0.92rem] font-semibold text-white">{cong.nome}</p>
          <p className="text-[0.72rem] text-brand-200/55">
            {cong.pedido?.confirmado ? `${cong.pedido.revistas} revistas pedidas` : cong.pedido ? "rascunho iniciado" : "pedido não iniciado"}
            {" · "}
            {cong.classes.length} classe(s)
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[0.86rem] font-semibold tabular-nums text-white">{dinheiro.format(cong.totalDevido)}</p>
          <SituacaoBadge situacao={cong.situacao} pedido={cong.pedido} />
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
            <div className="min-w-0">
              {cong.pedido?.confirmado ? (
                <>
                  <p className="flex items-center gap-1.5 text-[0.82rem] text-brand-50">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                    Pedido confirmado — {cong.pedido.revistas} revista(s), {dinheiro.format(cong.pedido.total)}
                  </p>
                  {cong.pedido.confirmadoEm && (
                    <p className="mt-0.5 text-[0.72rem] text-brand-200/45">
                      {cong.pedido.confirmadoPor ? `por ${cong.pedido.confirmadoPor} — ` : ""}
                      {fmtData.format(new Date(cong.pedido.confirmadoEm))}
                    </p>
                  )}
                </>
              ) : cong.pedido ? (
                <>
                  <p className="text-[0.82rem] text-brand-50">Rascunho salvo, ainda não confirmado</p>
                  <p className="mt-0.5 text-[0.72rem] text-brand-200/45">
                    {cong.pedido.revistas} revista(s) digitada(s) até agora, {dinheiro.format(cong.pedido.total)}
                  </p>
                </>
              ) : (
                <p className="text-[0.82rem] text-brand-50">Pedido ainda não iniciado neste trimestre</p>
              )}
            </div>
            {editavel && (
              <Button asChild size="sm">
                <Link href={cong.pedido?.confirmado ? `/dashboard/revistas/pedido/${cong.congId}?trimestre=${trimestre}` : `/dashboard/revistas/novo?congId=${cong.congId}&trimestre=${trimestre}`}>
                  {cong.pedido?.confirmado ? "Ver pedido" : cong.pedido ? "Continuar pedido" : "Fazer Pedido"}
                </Link>
              </Button>
            )}
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
