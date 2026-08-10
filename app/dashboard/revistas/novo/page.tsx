"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BookMarked, Loader2, RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { proximoTrimestre, trimestreValido } from "@/lib/revistas/trimestre";
import { EtapaCongregacao } from "@/components/revistas/wizard/EtapaCongregacao";
import { EtapaTrimestre } from "@/components/revistas/wizard/EtapaTrimestre";
import { EtapaQuantidades } from "@/components/revistas/wizard/EtapaQuantidades";
import { EtapaRevisao } from "@/components/revistas/wizard/EtapaRevisao";
import { TelaSucesso } from "@/components/revistas/wizard/TelaSucesso";
import { ResumoPedido, type ItemResumo } from "@/components/revistas/wizard/ResumoPedido";
import { IndicadorEtapas } from "@/components/revistas/wizard/IndicadorEtapas";
import { chaveItem, type DadosPedido, type Etapa, type LinhaPedido, type PainelDados } from "@/components/revistas/wizard/tipos";

/**
 * O assistente de Novo Pedido — quatro perguntas, uma de cada vez:
 * congregação, trimestre, quantidades, revisão. Antes disto, tudo (situação
 * do pedido, valores, congregações, alertas) morava numa tela só, e "fazer um
 * pedido novo" e "acompanhar o que já existe" competiam pelo mesmo espaço.
 *
 * Não existe rota nem tabela nova aqui — as mesmas duas chamadas de sempre
 * (`/api/revistas` para a lista de congregações do trimestre, e
 * `/api/revistas/pedido` para as linhas de UM pedido) alimentam as quatro
 * etapas. `?congId=&trimestre=` pulam direto para "quantidades" quando a
 * pessoa já chega sabendo os dois (o botão "Fazer Pedido" de um alerta, por
 * exemplo); uma sessão vinculada a uma única congregação pula a Etapa 1
 * sozinha.
 */
function Conteudo() {
  const searchParams = useSearchParams();
  const { sessao, carregando: carregandoSessao, podeGravar } = useAcesso();
  const editavel = podeGravar("revistas");

  const [etapa, setEtapa] = useState<Etapa>("congregacao");
  const [trimestre, setTrimestre] = useState(() => {
    const t = searchParams.get("trimestre");
    return t && trimestreValido(t) ? t : proximoTrimestre(new Date()).chave;
  });
  const [congId, setCongId] = useState<number | null>(null);

  const [painel, setPainel] = useState<PainelDados | null>(null);
  const [erroPainel, setErroPainel] = useState<string | null>(null);
  const [pedido, setPedido] = useState<DadosPedido | null>(null);
  const [erroPedido, setErroPedido] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});

  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [reabrindo, setReabrindo] = useState(false);
  const [resultado, setResultado] = useState<{ id: number | null; revistas: number; total: number } | null>(null);

  // Carrega a lista de congregações do trimestre escolhido — usada nas
  // Etapas 1 e 2. Sem `setPainel(null)` na troca de trimestre: os cartões
  // continuam na tela (com os números do trimestre anterior) até os novos
  // chegarem, em vez de piscar em branco.
  useEffect(() => {
    let cancelado = false;
    setErroPainel(null);
    (async () => {
      try {
        const res = await fetch(`/api/revistas?trimestre=${trimestre}`, { cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        const dados = await res.json();
        if (!cancelado) setPainel(dados);
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (!cancelado) setErroPainel(status === 403 ? "O seu acesso não permite ver o pedido." : "Não foi possível carregar as congregações.");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [trimestre]);

  // Carrega o pedido (rascunho ou confirmado) da congregação escolhida.
  useEffect(() => {
    if (congId === null) {
      setPedido(null);
      return;
    }
    let cancelado = false;
    setPedido(null);
    setErroPedido(null);
    (async () => {
      try {
        const url = new URL("/api/revistas/pedido", window.location.origin);
        url.searchParams.set("congId", String(congId));
        url.searchParams.set("trimestre", trimestre);
        const res = await fetch(url, { cache: "no-store" });
        const corpo = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(corpo.erro ?? "Não foi possível carregar o pedido.");
        if (cancelado) return;
        setPedido(corpo);
        setValores(
          Object.fromEntries(
            (corpo.linhas as LinhaPedido[]).map((l) => [chaveItem(l.categoria, l.tipo), l.quantidade > 0 ? String(l.quantidade) : ""]),
          ),
        );
      } catch (e) {
        if (!cancelado) setErroPedido((e as Error).message);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [congId, trimestre]);

  // Decide UMA vez, quando a lista de congregações e a sessão já estão
  // prontas, se alguma etapa deve ser pulada.
  const jaDecidiu = useRef(false);
  useEffect(() => {
    if (jaDecidiu.current || !painel || carregandoSessao) return;
    jaDecidiu.current = true;

    const congIdUrl = searchParams.get("congId");
    const trimestreUrl = searchParams.get("trimestre");
    const congregacaoDaUrl = congIdUrl ? painel.congregacoes.find((c) => c.congId === Number(congIdUrl)) : undefined;

    if (congregacaoDaUrl && trimestreUrl && trimestreValido(trimestreUrl)) {
      setCongId(congregacaoDaUrl.congId);
      setEtapa("quantidades");
      return;
    }
    if (congregacaoDaUrl) {
      setCongId(congregacaoDaUrl.congId);
      setEtapa("trimestre");
      return;
    }
    if (sessao && sessao.escopo === "congregacao" && sessao.congIds.length === 1) {
      setCongId(sessao.congIds[0]);
      setEtapa("trimestre");
    }
  }, [painel, carregandoSessao, sessao, searchParams]);

  const totalDigitado = useMemo(() => {
    if (!pedido) return 0;
    return pedido.linhas.reduce((s, l) => {
      const q = Number(valores[chaveItem(l.categoria, l.tipo)] || 0);
      return s + (Number.isFinite(q) && l.precoUnitario !== null ? q * l.precoUnitario : 0);
    }, 0);
  }, [pedido, valores]);

  const revistasDigitadas = useMemo(() => {
    if (!pedido) return 0;
    return pedido.linhas.reduce((s, l) => s + (Number(valores[chaveItem(l.categoria, l.tipo)]) || 0), 0);
  }, [pedido, valores]);

  const itensResumo: ItemResumo[] = useMemo(() => {
    if (!pedido) return [];
    return pedido.linhas
      .map((l) => ({ rotulo: `${l.categoriaRotulo} — ${l.rotulo}`, quantidade: Number(valores[chaveItem(l.categoria, l.tipo)] || 0) }))
      .filter((it) => it.quantidade > 0);
  }, [pedido, valores]);

  async function salvarRascunho(): Promise<boolean> {
    if (congId === null) return false;
    setSalvando(true);
    setErroAcao(null);
    try {
      const itens = Object.entries(valores).map(([chave, valor]) => {
        const [categoria, tipo] = chave.split("|");
        return { categoria, tipo, quantidade: valor === "" ? 0 : Number(valor) };
      });
      const res = await fetch("/api/revistas/pedido", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congId, trimestre, itens }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? "Não foi possível salvar.");
      return true;
    } catch (e) {
      setErroAcao((e as Error).message);
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function continuarDeQuantidades() {
    if (revistasDigitadas === 0) {
      setErroAcao("Informe ao menos uma quantidade antes de continuar.");
      return;
    }
    const ok = await salvarRascunho();
    if (ok) setEtapa("revisao");
  }

  async function confirmarPedido() {
    if (congId === null) return;
    setConfirmando(true);
    setErroAcao(null);
    try {
      const salvouOk = await salvarRascunho();
      if (!salvouOk) return;
      const res = await fetch("/api/revistas/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congId, trimestre, acao: "confirmar" }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? "Não foi possível confirmar.");
      setResultado({ id: corpo.id ?? null, revistas: revistasDigitadas, total: totalDigitado });
      setEtapa("sucesso");
    } catch (e) {
      setErroAcao((e as Error).message);
    } finally {
      setConfirmando(false);
    }
  }

  async function reabrirPedido() {
    if (congId === null) return;
    setReabrindo(true);
    try {
      const res = await fetch("/api/revistas/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congId, trimestre, acao: "reabrir" }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? "Não foi possível reabrir.");
      setPedido((p) => (p ? { ...p, confirmado: false, confirmadoEm: null, confirmadoPor: null } : p));
    } catch (e) {
      setErroAcao((e as Error).message);
    } finally {
      setReabrindo(false);
    }
  }

  function usarSugestoes() {
    if (!pedido) return;
    setValores((atual) => {
      const novos = { ...atual };
      for (const l of pedido.linhas) {
        if (l.precoUnitario === null) continue;
        novos[chaveItem(l.categoria, l.tipo)] = l.sugestao > 0 ? String(l.sugestao) : "";
      }
      return novos;
    });
  }

  function novoPedido() {
    jaDecidiu.current = true; // não repete o auto-seleciona por URL antiga
    setResultado(null);
    setCongId(null);
    setPedido(null);
    setValores({});
    setErroAcao(null);
    if (sessao && sessao.escopo === "congregacao" && sessao.congIds.length === 1) {
      setCongId(sessao.congIds[0]);
      setEtapa("trimestre");
    } else {
      setEtapa("congregacao");
    }
  }

  const congAtual = painel?.congregacoes.find((c) => c.congId === congId) ?? null;
  const podeVoltarParaCongregacao = (painel?.congregacoes.length ?? 0) > 1;

  return (
    <>
      <div className="print:hidden">
        <Link href="/dashboard/revistas" className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] text-brand-200/60 transition-colors duration-300 hover:text-gold-200">
          <ArrowLeft className="h-3.5 w-3.5" />
          Pedidos de Lições
        </Link>

        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-gold-400/20">
            <BookMarked className="h-5 w-5 text-gold-300" />
          </span>
          <div>
            <h1 className="font-display text-[1.25rem] font-semibold uppercase leading-tight tracking-[0.12em] text-white sm:text-[1.4rem]">
              Novo Pedido
            </h1>
            <p className="mt-1 text-[0.82rem] text-brand-200/60">Peça as revistas de lição de uma congregação, passo a passo.</p>
          </div>
        </div>
      </div>

      {!editavel && !carregandoSessao ? (
        <Alert tipo="alerta" titulo="Sem acesso para criar pedidos">
          O seu acesso permite acompanhar os pedidos, mas não criar ou confirmar um novo.
        </Alert>
      ) : erroPainel ? (
        <EstadoErro mensagem={erroPainel} />
      ) : !painel ? (
        <EsqueletoLista linhas={4} />
      ) : etapa === "sucesso" && resultado ? (
        <TelaSucesso
          pedidoId={resultado.id}
          congId={congId!}
          congNome={congAtual?.nome ?? pedido?.congNome ?? ""}
          trimestreChave={trimestre}
          trimestreRotulo={painel.trimestre.rotulo}
          revistas={resultado.revistas}
          total={resultado.total}
          aoNovoPedido={novoPedido}
        />
      ) : (
        <>
          <IndicadorEtapas atual={etapa} />

          {etapa === "congregacao" && (
            <EtapaCongregacao
              congregacoes={painel.congregacoes}
              aoSelecionar={(id) => {
                setCongId(id);
                setEtapa("trimestre");
              }}
            />
          )}

          {etapa === "trimestre" && (
            <div>
              <EtapaTrimestre dados={painel} trimestre={trimestre} aoSelecionar={setTrimestre} />
              <div className="mt-5 flex flex-wrap gap-2.5">
                {podeVoltarParaCongregacao && (
                  <Button variant="ghost" onClick={() => setEtapa("congregacao")}>
                    <ArrowLeft className="h-4 w-4" />
                    Trocar congregação
                  </Button>
                )}
                <Button onClick={() => setEtapa("quantidades")} disabled={!pedido && !erroPedido}>
                  {!pedido && !erroPedido && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {etapa === "quantidades" && (
            <div className="lg:flex lg:items-start lg:gap-6">
              <div className="min-w-0 flex-1">
                {erroPedido ? (
                  <EstadoErro mensagem={erroPedido} />
                ) : !pedido ? (
                  <EsqueletoLista linhas={5} />
                ) : pedido.confirmado ? (
                  <Alert tipo="sucesso" titulo="Este pedido já foi confirmado">
                    <p>
                      {congAtual?.nome ?? pedido.congNome} já tem um pedido confirmado para {painel.trimestre.rotulo}.
                      {pedido.confirmadoPor && ` Por ${pedido.confirmadoPor}.`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/dashboard/revistas/pedido/${congId}?trimestre=${trimestre}`}>Ver pedido</Link>
                      </Button>
                      {pedido.podeReabrir && (
                        <Button size="sm" variant="ghost" onClick={() => void reabrirPedido()} disabled={reabrindo}>
                          {reabrindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          Reabrir para editar
                        </Button>
                      )}
                    </div>
                  </Alert>
                ) : (
                  <>
                    <EtapaQuantidades dados={pedido} valores={valores} aoMudar={(chave, v) => setValores((a) => ({ ...a, [chave]: v }))} aoUsarSugestoes={usarSugestoes} />
                    {erroAcao && <p className="mt-3 text-[0.82rem] text-flame-400">{erroAcao}</p>}
                    <div className="mt-5 lg:hidden">
                      <Button variant="ghost" onClick={() => setEtapa("trimestre")}>
                        <ArrowLeft className="h-4 w-4" />
                        Voltar
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {pedido && !pedido.confirmado && (
                <ResumoPedido
                  congNome={congAtual?.nome ?? pedido.congNome}
                  trimestreRotulo={painel.trimestre.rotulo}
                  itens={itensResumo}
                  totalRevistas={revistasDigitadas}
                  total={totalDigitado}
                  textoBotao="Revisar Pedido"
                  aoContinuar={() => void continuarDeQuantidades()}
                  desabilitado={revistasDigitadas === 0}
                  carregando={salvando}
                />
              )}
            </div>
          )}

          {etapa === "revisao" && pedido && (
            <div className="lg:flex lg:items-start lg:gap-6">
              <div className="min-w-0 flex-1">
                <EtapaRevisao
                  congNome={congAtual?.nome ?? pedido.congNome}
                  dados={pedido}
                  valores={valores}
                  prazoPagamento={{ data: painel.dataLimitePagamento, prazo: painel.prazos.pagamento }}
                  aoVoltar={() => setEtapa("quantidades")}
                  aoConfirmar={() => void confirmarPedido()}
                  confirmando={confirmando}
                  erro={erroAcao}
                />
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function NovoPedidoPage() {
  return (
    <Suspense fallback={<EsqueletoLista linhas={4} />}>
      <Conteudo />
    </Suspense>
  );
}
