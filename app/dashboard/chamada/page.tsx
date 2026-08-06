"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Check,
  CheckCheck,
  CloudOff,
  Loader2,
  Pencil,
  Save,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
  Filtro,
} from "@/components/dashboard/PaginaModulo";
import { iniciais } from "@/lib/dashboard/formato";
import { temBancoLocal } from "@/lib/db/local";
import { guardarChamada, lerChamadaLocal, situacaoDoEnvio } from "@/lib/db/chamadas";
import type { ChamadaLocal } from "@/lib/db/schema";
import { sincronizar } from "@/lib/sync/motor";
import { useAcesso } from "@/components/acesso/AcessoProvider";

/**
 * Chamada — o coracao do sistema.
 *
 * ============================================================================
 * TRES ESTADOS POR ALUNO, E NAO DOIS
 *
 *   presente   · veio
 *   ausente    · faltou
 *   null       · AINDA NAO FOI MARCADO
 *
 * A diferenca entre "faltou" e "ninguem marcou" e a diferenca entre um dado e a
 * ausencia dele. Com dois estados, todo aluno nasce "ausente" e uma chamada
 * esquecida no meio vira trinta faltas — que entram no relatorio do mes como se
 * fossem reais.
 * ============================================================================
 *
 * ============================================================================
 * GRAVAR E ESCREVER NO APARELHO — ENVIAR VEM DEPOIS
 *
 * O botao "Gravar chamada" nao fala com o servidor. Ele escreve no IndexedDB e
 * enfileira o pacote; quem fala com o servidor e o motor de sincronizacao
 * (lib/sync), que insiste sozinho ate conseguir.
 *
 * A ordem importa e e o coracao desta tela. Enviando primeiro, existe uma
 * janela — do toque no botao ate a resposta chegar — em que a chamada so existe
 * na memoria da aba: e ali que ela se perde quando o sinal cai no meio, quando
 * a tela bloqueia e o sistema descarta a pagina, ou quando alguem fecha a aba
 * sem esperar. Escrevendo primeiro, essa janela nao existe. No pior caso a
 * chamada esta guardada e ainda nao subiu — que e uma situacao com conserto,
 * ao contrario de perdida.
 *
 * A gravacao manda a chamada INTEIRA num pacote so. Uma requisicao por aluno
 * significaria trinta requisicoes na rede da igreja, com algumas chegando e
 * outras nao, deixando a chamada pela metade sem ninguem saber quais faltaram.
 * ============================================================================
 */

interface AlunoChamada {
  id: number;
  nome: string;
  nasc: string | null;
  presente: boolean | null;
}

interface Chamada {
  classe: {
    id: number;
    nome: string;
    faixa: string;
    congregacao: { id: number; nome: string } | null;
    professores: Array<{ id: number; nome: string; tratamento: string | null }>;
  };
  data: string;
  iniciada: boolean;
  alunos: AlunoChamada[];
}

/**
 * Remonta a tela a partir do que ficou guardado no aparelho.
 *
 * E o caminho de quem abre a Chamada sem sinal: o `GET` nao responde, mas a
 * classe ja foi carregada antes e o instantaneo continua aqui. Sem isto, a tela
 * mostraria "não foi possível carregar" para uma chamada que esta inteira no
 * aparelho, e o professor recomecaria do zero — no papel.
 */
function daMemoriaDoAparelho(local: ChamadaLocal): Chamada | null {
  if (!local.cache) return null;
  const marcado = new Map(local.marcas.map((m) => [m.alunoId, m.presente]));
  return {
    classe: {
      id: local.classeId,
      nome: local.cache.classeNome,
      faixa: local.cache.faixa,
      congregacao: null,
      professores: local.cache.professores.map((nome, i) => ({
        id: -1 - i,
        nome,
        tratamento: null,
      })),
    },
    data: local.data,
    iniciada: local.marcas.length > 0,
    alunos: local.cache.alunos.map((a) => ({
      ...a,
      presente: marcado.get(a.id) ?? null,
    })),
  };
}

/** Domingo mais recente, "YYYY-MM-DD" — o dia que a chamada quase sempre quer. */
function domingoMaisRecente(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export default function ChamadaPage() {
  const [classes, setClasses] = useState<Array<{ id: number; nome: string }>>([]);
  const [classeId, setClasseId] = useState<number | null>(null);
  const [data, setData] = useState<string>("");
  const [chamada, setChamada] = useState<Chamada | null>(null);
  const [marcas, setMarcas] = useState<Map<number, boolean>>(new Map());
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  /** Ha um pacote guardado no aparelho que ainda nao chegou ao servidor. */
  const [naFila, setNaFila] = useState(false);
  /** O servidor recusou de um jeito que insistir nao resolve. Exige acao. */
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  /** A tela esta mostrando o que ficou guardado, e nao o que o servidor tem. */
  const [semServidor, setSemServidor] = useState(false);

  // A data so e calculada no cliente: no servidor, em UTC, "hoje" pode ser
  // outro dia para quem esta em Pernambuco.
  useEffect(() => setData(domingoMaisRecente()), []);

  useEffect(() => {
    void fetch("/api/classes")
      .then((r) => r.json())
      .then((d) => {
        const lista = (d.itens ?? []).map((c: { id: number; nome: string }) => ({
          id: c.id,
          nome: c.nome,
        }));
        setClasses(lista);
        setClasseId((atual) => atual ?? lista[0]?.id ?? null);
      })
      .catch(() => setErro("Não foi possível carregar as classes."));
  }, []);

  useEffect(() => {
    if (!classeId || !data) return;
    const controle = new AbortController();

    (async () => {
      setCarregando(true);
      setErro(null);
      setAviso(null);
      setBloqueio(null);
      setSemServidor(false);
      setNaFila(false);

      // 1. O servidor, se der.
      let doServidor: Chamada | null = null;
      try {
        const url = new URL("/api/chamada", window.location.origin);
        url.searchParams.set("classe", String(classeId));
        url.searchParams.set("data", data);
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        doServidor = await res.json();
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }

      // 2. O que estiver guardado neste aparelho.
      const local = temBancoLocal()
        ? await lerChamadaLocal(classeId, data).catch(() => undefined)
        : undefined;

      // Trocar de classe no meio da leitura do aparelho: sem esta conferencia,
      // a busca antiga terminaria depois da nova e desenharia a classe errada.
      if (controle.signal.aborted) return;

      const pendente = !!local && local.estado !== "sincronizado";

      const base = doServidor ?? (local ? daMemoriaDoAparelho(local) : null);
      if (!base) {
        setErro("Não foi possível carregar a chamada.");
        setChamada(null);
        setCarregando(false);
        return;
      }

      setChamada(base);
      setSemServidor(!doServidor);

      /*
       * Quem manda nas marcacoes: o aparelho, quando ha pendencia.
       *
       * O pacote guardado e mais novo que o do servidor por definicao — ele
       * existe justamente porque ainda nao chegou la. Deixar o servidor vencer
       * apagaria da tela a chamada que o professor fez no domingo sem sinal,
       * e ele a refaria sem saber que ja estava feita.
       *
       * E o pacote entra INTEIRO: as marcacoes dele substituem as do servidor
       * em vez de se somarem. Somando, um aluno desmarcado no aparelho voltaria
       * marcado pela versao antiga do servidor.
       */
      if (pendente && local) {
        setMarcas(new Map(local.marcas.map((m) => [m.alunoId, m.presente])));
        const situacao = await situacaoDoEnvio(classeId, data);
        if (controle.signal.aborted) return;
        setNaFila(situacao.situacao === "aguardando" || situacao.situacao === "bloqueada");
        if (situacao.situacao === "bloqueada") setBloqueio(situacao.motivo);
      } else {
        setMarcas(
          new Map(
            base.alunos
              .filter((a) => a.presente !== null)
              .map((a) => [a.id, a.presente as boolean]),
          ),
        );
      }

      setCarregando(false);
    })();

    return () => controle.abort();
  }, [classeId, data]);

  const marcar = useCallback((alunoId: number, presente: boolean) => {
    setMarcas((atual) => {
      const novo = new Map(atual);
      // Tocar de novo no mesmo botao DESMARCA, voltando ao estado "nao
      // marcado". Sem isso, um toque errado nao teria desfazer: o aluno ficaria
      // preso como falta e ninguem saberia que foi engano.
      if (novo.get(alunoId) === presente) novo.delete(alunoId);
      else novo.set(alunoId, presente);
      return novo;
    });
    setAviso(null);
  }, []);

  const marcarTodos = useCallback(
    (presente: boolean) => {
      if (!chamada) return;
      setMarcas(new Map(chamada.alunos.map((a) => [a.id, presente])));
      setAviso(null);
    },
    [chamada],
  );

  async function salvar() {
    if (!chamada || salvando) return;

    setSalvando(true);
    setErro(null);
    setAviso(null);
    setBloqueio(null);

    const classeId = chamada.classe.id;
    const dia = chamada.data;
    const presencas = [...marcas].map(([alunoId, presente]) => ({ alunoId, presente }));
    const quantas = `${presencas.length} ${presencas.length === 1 ? "marcação" : "marcações"}`;

    try {
      /*
       * Sem IndexedDB nao ha onde guardar, e mentir seria pior do que avisar:
       * aqui a gravacao volta a depender da rede, e a tela diz isso.
       */
      if (!temBancoLocal()) {
        const res = await fetch("/api/chamada", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classeId, data: dia, presencas }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setAviso(`Chamada enviada — ${quantas}.`);
        return;
      }

      // 1. Guardar. A partir daqui a chamada nao se perde mais.
      await guardarChamada({
        classeId,
        data: dia,
        marcas: presencas,
        cache: {
          classeNome: chamada.classe.nome,
          faixa: chamada.classe.faixa,
          professores: chamada.classe.professores.map((p) =>
            [p.tratamento, p.nome].filter(Boolean).join(" "),
          ),
          alunos: chamada.alunos.map((a) => ({ id: a.id, nome: a.nome, nasc: a.nasc })),
        },
      });
      setNaFila(true);

      // 2. Tentar enviar agora. Se nao der, o motor continua tentando sozinho.
      await sincronizar();

      const situacao = await situacaoDoEnvio(classeId, dia);
      if (situacao.situacao === "enviada") {
        setNaFila(false);
        setSemServidor(false);
        setAviso(`Chamada gravada e enviada — ${quantas}.`);
      } else if (situacao.situacao === "bloqueada") {
        setBloqueio(situacao.motivo);
      } else {
        setAviso(
          `Chamada guardada neste aparelho — ${quantas}. ` +
            "Ela será enviada sozinha assim que houver conexão; pode fechar a tela.",
        );
      }
    } catch (e) {
      // So chega aqui o caminho sem IndexedDB: o outro nao lanca, porque
      // gravar no aparelho e a parte que nao depende de nada externo.
      console.error("[chamada] falha ao gravar:", e);
      setErro(
        "Não foi possível enviar agora, e este navegador não permite guardar no aparelho. " +
          "Não feche esta tela — as marcações continuam aqui.",
      );
    } finally {
      setSalvando(false);
    }
  }

  const presentes = [...marcas.values()].filter(Boolean).length;
  const ausentes = [...marcas.values()].filter((v) => !v).length;
  const naoMarcados = (chamada?.alunos.length ?? 0) - marcas.size;

  return (
    <>
      <CabecalhoModulo
        icone={BookOpen}
        titulo="Chamada"
        descricao="Marque a presença da classe neste domingo"
      >
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Filtro rotulo="Classe" opcoes={classes} valor={classeId} aoMudar={setClasseId} />
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
            <span className="shrink-0 text-brand-200/55">Data</span>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="bg-transparent text-brand-50 focus:outline-none [color-scheme:dark]"
            />
          </label>
        </div>
      </CabecalhoModulo>

      {erro && <EstadoErro mensagem={erro} />}

      {/*
        O bloqueio vem antes de tudo porque e o unico aviso desta tela que pede
        uma acao de quem esta lendo. Os outros informam; este e uma tarefa.
      */}
      {bloqueio && (
        <Alert tipo="alerta" titulo="A chamada está guardada, mas o envio foi recusado" className="mb-3">
          {bloqueio} A chamada continua salva neste aparelho e sobe sozinha assim
          que isso for resolvido — nada foi perdido.
        </Alert>
      )}

      {semServidor && chamada && (
        <Alert tipo="info" className="mb-3">
          Sem conexão com o servidor. Esta é a última versão desta chamada
          guardada no aparelho — dá para marcar e gravar normalmente.
        </Alert>
      )}

      {naFila && !bloqueio && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-gold-400/25 bg-gold-400/10 px-4 py-2.5 text-[0.82rem] text-gold-100">
          <CloudOff className="h-4 w-4 shrink-0" />
          Guardada no aparelho, aguardando envio.
        </div>
      )}

      {aviso && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-[0.82rem] text-emerald-200">
          <Check className="h-4 w-4 shrink-0" />
          {aviso}
        </div>
      )}

      {carregando ? (
        <EsqueletoLista />
      ) : !chamada ? (
        <EstadoVazio mensagem="Escolha uma classe para começar." />
      ) : chamada.alunos.length === 0 ? (
        <EstadoVazio
          mensagem={`A classe ${chamada.classe.nome} não tem alunos ativos.`}
          dica="Matricule alunos no módulo Alunos para poder fazer a chamada."
        />
      ) : (
        <>
          {/* ---------------- Resumo e ações ---------------- */}
          <div className="glass-panel mb-3 flex flex-wrap items-center gap-3 rounded-2xl p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9rem] text-white">{chamada.classe.nome}</p>
              <p className="truncate text-[0.74rem] text-brand-200/55">
                {chamada.classe.professores.length > 0
                  ? chamada.classe.professores
                      .map((p) => [p.tratamento, p.nome].filter(Boolean).join(" "))
                      .join(" · ")
                  : "Sem professor definido"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="sucesso">{presentes} presentes</Badge>
              <Badge variant="erro">{ausentes} faltas</Badge>
              {naoMarcados > 0 && <Badge variant="neutro">{naoMarcados} sem marcar</Badge>}
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              <Button variant="ghost" size="sm" onClick={() => marcarTodos(true)}>
                <CheckCheck className="h-4 w-4" />
                Todos presentes
              </Button>
              <Button size="sm" onClick={salvar} disabled={salvando || marcas.size === 0}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {salvando ? "Gravando…" : "Gravar chamada"}
              </Button>
            </div>
          </div>

          {/* ---------------- Lista ---------------- */}
          <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
            {chamada.alunos.map((a, i) => {
              const marca = marcas.get(a.id);
              return (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i, 20) * 0.015 }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 transition-colors duration-300",
                    marca === true && "bg-emerald-500/[0.06]",
                    marca === false && "bg-flame-500/[0.05]",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-white/12">
                    <span className="font-display text-[0.64rem] font-semibold tracking-wider text-brand-50">
                      {iniciais(a.nome)}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1 truncate text-[0.86rem] text-brand-50">
                    {a.nome}
                  </span>

                  {/*
                    Dois botoes, e nao um interruptor. Um interruptor tem dois
                    estados e a chamada tem tres — com ele, nao existiria o
                    "ainda nao marcado", que e o unico jeito de saber que a
                    chamada nao foi terminada. Os alvos tem 40px: e chamada
                    feita com o polegar, em pe, no meio da sala.
                  */}
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => marcar(a.id, true)}
                      aria-pressed={marca === true}
                      aria-label={`${a.nome}: presente`}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
                        marca === true
                          ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                          : "border-white/10 bg-white/[0.03] text-brand-200/50 hover:border-emerald-400/30 hover:text-emerald-300",
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => marcar(a.id, false)}
                      aria-pressed={marca === false}
                      aria-label={`${a.nome}: ausente`}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
                        marca === false
                          ? "border-flame-500/40 bg-flame-500/20 text-flame-400"
                          : "border-white/10 bg-white/[0.03] text-brand-200/50 hover:border-flame-500/30 hover:text-flame-400",
                      )}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </ul>

          <PainelVisitantes classe={chamada.classe} data={chamada.data} />
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Visitantes — recebidos nesta classe, neste domingo
 * ------------------------------------------------------------------ */

interface Visitante {
  id: number;
  nome: string;
  nascimento: string | null;
  endereco: string | null;
}

function formatarNascimento(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function PainelVisitantes({
  classe,
  data,
}: {
  classe: Chamada["classe"];
  data: string;
}) {
  const { podeGravar } = useAcesso();
  const editavel = podeGravar("visitantes");

  const [visitantes, setVisitantes] = useState<Visitante[] | null>(null);
  const [incluindo, setIncluindo] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);

  async function carregar() {
    const url = new URL("/api/visitantes", window.location.origin);
    url.searchParams.set("classe", String(classe.id));
    url.searchParams.set("de", data);
    url.searchParams.set("ate", data);
    url.searchParams.set("porPagina", "100");
    try {
      const r = await fetch(url, { cache: "no-store" });
      const d = await r.json();
      setVisitantes(d.itens ?? []);
    } catch {
      setVisitantes([]);
    }
  }

  useEffect(() => {
    setVisitantes(null);
    setIncluindo(false);
    setEditando(null);
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classe.id, data]);

  async function remover(id: number) {
    if (!window.confirm("Remover este visitante?")) return;
    await fetch(`/api/visitantes?id=${id}`, { method: "DELETE" });
    setVisitantes((atual) => (atual ? atual.filter((v) => v.id !== id) : atual));
  }

  return (
    <div className="glass-panel mt-3 rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-[0.82rem] font-medium text-brand-100">
          <Users className="h-4 w-4 text-gold-300/80" />
          Visitantes {visitantes !== null && `(${visitantes.length})`}
        </p>
        {editavel && !incluindo && (
          <Button size="sm" variant="ghost" onClick={() => setIncluindo(true)}>
            <UserPlus className="h-4 w-4" />
            Incluir visitante
          </Button>
        )}
      </div>

      {visitantes === null ? (
        <p className="text-[0.8rem] text-brand-200/45">Carregando…</p>
      ) : visitantes.length === 0 && !incluindo ? (
        <p className="text-[0.8rem] italic text-brand-200/45">Nenhum visitante recebido neste domingo.</p>
      ) : (
        <ul className="divide-y divide-white/6">
          {visitantes.map((v) =>
            editando === v.id ? (
              <li key={v.id} className="py-2">
                <FormVisitante
                  inicial={v}
                  aoSalvar={async (dados) => {
                    await fetch("/api/visitantes", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: v.id, ...dados }),
                    });
                    setEditando(null);
                    void carregar();
                  }}
                  aoCancelar={() => setEditando(null)}
                />
              </li>
            ) : (
              <li key={v.id} className="flex items-center gap-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-500/70 to-gold-700/70 ring-1 ring-white/12">
                  <span className="font-display text-[0.62rem] font-semibold tracking-wider text-brand-950">
                    {iniciais(v.nome)}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.84rem] text-brand-50">{v.nome}</p>
                  <p className="truncate text-[0.72rem] text-brand-200/50">
                    {[v.nascimento && `nasc. ${formatarNascimento(v.nascimento)}`, v.endereco]
                      .filter(Boolean)
                      .join(" · ") || "Sem dados adicionais"}
                  </p>
                </div>
                {editavel && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditando(v.id)}
                      aria-label={`Editar ${v.nome}`}
                      className="rounded-lg p-1.5 text-brand-200/50 hover:bg-white/8 hover:text-gold-200"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remover(v.id)}
                      aria-label={`Remover ${v.nome}`}
                      className="rounded-lg p-1.5 text-brand-200/50 hover:bg-white/8 hover:text-flame-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {incluindo && editavel && (
        <div className="mt-2 border-t border-white/8 pt-2">
          <FormVisitante
            aoSalvar={async (dados) => {
              if (!classe.congregacao) return;
              await fetch("/api/visitantes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...dados,
                  congId: classe.congregacao.id,
                  classeId: classe.id,
                  data,
                }),
              });
              setIncluindo(false);
              void carregar();
            }}
            aoCancelar={() => setIncluindo(false)}
          />
        </div>
      )}
    </div>
  );
}

function FormVisitante({
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  inicial?: Visitante;
  aoSalvar: (dados: { nome: string; nascimento: string | null; endereco: string }) => Promise<void>;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [nascimento, setNascimento] = useState(inicial?.nascimento?.slice(0, 10) ?? "");
  const [endereco, setEndereco] = useState(inicial?.endereco ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await aoSalvar({ nome: nome.trim(), nascimento: nascimento || null, endereco: endereco.trim() });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome do visitante"
        className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.82rem] text-brand-50 placeholder:text-brand-200/35 focus:border-gold-400/35 focus:outline-none sm:col-span-1"
      />
      <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3">
        <span className="shrink-0 text-[0.72rem] text-brand-200/50">Nascimento</span>
        <input
          type="date"
          value={nascimento}
          onChange={(e) => setNascimento(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[0.8rem] text-brand-50 focus:outline-none [color-scheme:dark]"
        />
      </label>
      <input
        value={endereco}
        onChange={(e) => setEndereco(e.target.value)}
        placeholder="Local que mora"
        className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.82rem] text-brand-50 placeholder:text-brand-200/35 focus:border-gold-400/35 focus:outline-none"
      />

      <div className="flex items-center gap-2 sm:col-span-3">
        <Button size="sm" onClick={() => void salvar()} disabled={salvando || !nome.trim()}>
          {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
