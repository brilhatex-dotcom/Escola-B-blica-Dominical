"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Check, CheckCheck, Loader2, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
 * A gravacao manda a chamada INTEIRA num pacote so. Uma requisicao por aluno
 * significaria trinta requisicoes na rede da igreja, com algumas chegando e
 * outras nao, deixando a chamada pela metade sem ninguem saber quais faltaram.
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
      try {
        const url = new URL("/api/chamada", window.location.origin);
        url.searchParams.set("classe", String(classeId));
        url.searchParams.set("data", data);
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const dados: Chamada = await res.json();
        setChamada(dados);
        setMarcas(
          new Map(
            dados.alunos
              .filter((a) => a.presente !== null)
              .map((a) => [a.id, a.presente as boolean]),
          ),
        );
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setErro("Não foi possível carregar a chamada.");
        setChamada(null);
      } finally {
        setCarregando(false);
      }
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
    try {
      const res = await fetch("/api/chamada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classeId: chamada.classe.id,
          data: chamada.data,
          presencas: [...marcas].map(([alunoId, presente]) => ({ alunoId, presente })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const r = await res.json();
      setAviso(`Chamada gravada — ${r.total} ${r.total === 1 ? "registro" : "registros"}.`);
    } catch {
      /*
       * TODO (Fase 06): em vez de avisar, enfileirar em lib/db/repositorio e
       * deixar o motor de sincronizacao reenviar. A infraestrutura ja existe
       * desde a Fase 01; falta so ligar o transporte.
       */
      setErro(
        "Não foi possível enviar agora. Não feche esta tela — as marcações continuam aqui.",
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
        </>
      )}
    </>
  );
}
