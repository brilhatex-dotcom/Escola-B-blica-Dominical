"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, MapPin, Printer, Plus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo, EsqueletoLista, EstadoErro, EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { Button } from "@/components/ui/button";
import { AcoesDoRegistro } from "@/components/crud/AcoesDoRegistro";
import { AvisoDeGravacao } from "@/components/crud/AvisoDeGravacao";
import { useCrud } from "@/components/crud/useCrud";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { ModalReuniao, type ParticipanteReuniao } from "@/components/agenda/ModalReuniao";
import { LOGO_SRC } from "@/lib/brand";
import { ORG_NAME } from "@/lib/config";

/**
 * Reuniões, com a lista de presença de cada uma.
 *
 * "9 DE 18 PRESENTES" DIZ POUCO — quem faltou é o que a secretaria precisa para
 * cobrar. Por isso a lista de participantes é aberta no próprio item, e não numa
 * tela seguinte: cobrar cinco ausentes não deveria custar cinco navegações.
 *
 * Desde a Fase 27, a lista de uma reunião de campo (Dirigentes e Secretários de
 * cada congregação) nasce pronta — ver `ModalReuniao` — e cada participante
 * carrega a congregação e o papel de onde veio, o que permite agrupar a
 * presença POR CONGREGAÇÃO aqui e na impressão.
 */

interface Reuniao {
  id: number; titulo: string; tipo: string; data: string;
  local: string | null; obs: string | null; autor: string;
  presentes: number; totalConvocados: number;
  participantes: ParticipanteReuniao[] | null;
  registradoEm: string;
}

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtLonga = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

/** Agrupa participantes por congregação — usado na tela e na impressão. */
function agruparPorCongregacao(participantes: ParticipanteReuniao[]) {
  const porCong = new Map<string, { congNome: string; itens: ParticipanteReuniao[] }>();
  const semCong: ParticipanteReuniao[] = [];
  for (const p of participantes) {
    if (p.congNome) {
      const g = porCong.get(p.congNome) ?? { congNome: p.congNome, itens: [] };
      g.itens.push(p);
      porCong.set(p.congNome, g);
    } else {
      semCong.push(p);
    }
  }
  return {
    grupos: [...porCong.values()].sort((a, b) => a.congNome.localeCompare(b.congNome, "pt-BR")),
    semCong,
  };
}

export default function ReunioesPage() {
  const { podeGravar } = useAcesso();
  const podeMexer = podeGravar("agenda-reunioes");
  const { aviso, limparAviso, recarga, gravar } = useCrud();
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Reuniao | null>(null);
  const [imprimindo, setImprimindo] = useState<Reuniao | null>(null);

  const [tipo, setTipo] = useState("");
  const [dados, setDados] = useState<{ itens: Reuniao[]; total: number; tipos: string[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        const url = new URL("/api/agenda/reunioes", window.location.origin);
        if (tipo) url.searchParams.set("tipo", tipo);
        url.searchParams.set("porPagina", "100");
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDados(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(status === 403 ? "O seu acesso não permite ver esta tela." : "Não foi possível carregar as reuniões.");
      }
    })();
    return () => controle.abort();
  }, [tipo, recarga]);

  useEffect(() => {
    if (!imprimindo) return;
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, [imprimindo]);

  useEffect(() => {
    if (!imprimindo) return;
    const aoVoltar = () => setImprimindo(null);
    window.addEventListener("afterprint", aoVoltar);
    return () => window.removeEventListener("afterprint", aoVoltar);
  }, [imprimindo]);

  return (
    <>
      <div className="print:hidden">
        <CabecalhoModulo icone={Users} titulo="Reuniões" descricao="Com a lista de presença de cada uma" total={dados?.total ?? null}>
          {podeMexer && (
            <Button size="sm" onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" />
              Nova reunião
            </Button>
          )}
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
            <span className="shrink-0 text-brand-200/55">Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}
              className="min-w-[9rem] bg-transparent text-brand-50 focus:outline-none [&>option]:bg-brand-900">
              <option value="">Todos</option>
              {(dados?.tipos ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </CabecalhoModulo>

        <AvisoDeGravacao mensagem={aviso} aoFechar={limparAviso} />

        {erro ? <EstadoErro mensagem={erro} />
        : !dados ? <EsqueletoLista linhas={6} />
        : dados.itens.length === 0 ? (
          <EstadoVazio mensagem="Nenhuma reunião registrada." />
        ) : (
          <ul className="space-y-3">
            {dados.itens.map((r, i) => {
              const abertaAgora = aberta === r.id;
              const taxa = r.totalConvocados > 0 ? r.presentes / r.totalConvocados : 0;
              const { grupos, semCong } = agruparPorCongregacao(r.participantes ?? []);

              return (
                <motion.li key={r.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(i, 14) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  className="glass-panel overflow-hidden rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setAberta(abertaAgora ? null : r.id)}
                    aria-expanded={abertaAgora}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors duration-300 hover:bg-white/[0.03]"
                  >
                    <div className="w-16 shrink-0 text-center">
                      <p className="font-display text-[1rem] font-semibold leading-none text-white tabular-nums">
                        {r.data.slice(8, 10)}/{r.data.slice(5, 7)}
                      </p>
                      <p className="mt-0.5 text-[0.62rem] tabular-nums text-brand-200/45">{r.data.slice(0, 4)}</p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9rem] text-brand-50">{r.titulo}</p>
                      <p className="truncate text-[0.74rem] text-brand-200/55">
                        {r.tipo}
                        {r.local && (
                          <span className="text-brand-200/40"> · {r.local}</span>
                        )}
                      </p>
                    </div>

                    <div className="hidden w-28 shrink-0 sm:block">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                        <span className="block h-full rounded-full bg-gradient-to-r from-brand-400 to-gold-400"
                          style={{ width: `${taxa * 100}%` }} />
                      </div>
                    </div>

                    <Badge variant={taxa >= 0.7 ? "sucesso" : taxa >= 0.4 ? "alerta" : "erro"}>
                      {r.presentes} de {r.totalConvocados}
                    </Badge>
                  </button>

                  {/*
                    Os botões ficam FORA do <button> da sanfona.
                    Um botão dentro de outro botão é HTML inválido: o navegador
                    desmonta a árvore por conta própria, e o clique no lápis passa
                    a abrir e fechar a reunião em vez de editar.
                  */}
                  <div className="flex justify-end gap-2 border-t border-white/6 px-4 py-2">
                    {(r.participantes?.length ?? 0) > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setImprimindo(r)}>
                        <Printer className="h-3.5 w-3.5" />
                        Imprimir
                      </Button>
                    )}
                    {podeMexer && (
                      <AcoesDoRegistro
                        nome={r.titulo}
                        onEditar={() => setEmEdicao(r)}
                        aviso={`A reunião "${r.titulo}" será excluída com a lista de presença dela. Não há como recuperar depois.`}
                        onExcluir={async () => {
                          await gravar(`/api/agenda/reunioes/${r.id}`, "DELETE");
                        }}
                      />
                    )}
                  </div>

                  {abertaAgora && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden border-t border-white/8"
                    >
                      <div className="px-4 py-3">
                        {r.obs && (
                          <p className="mb-3 text-[0.8rem] leading-relaxed text-brand-100/75">{r.obs}</p>
                        )}

                        {r.participantes === null ? (
                          /*
                           * O JSON do sistema antigo pode não ter trazido a lista.
                           * Dizer isso é melhor que mostrar uma lista vazia, que
                           * pareceria "ninguém foi convocado".
                           */
                          <p className="text-[0.78rem] text-brand-200/50">
                            Esta reunião não trouxe a lista de participantes na importação —
                            só os números.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {grupos.map((g) => (
                              <div key={g.congNome}>
                                <p className="mb-1 flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.12em] text-brand-200/45">
                                  <MapPin className="h-3 w-3" />
                                  {g.congNome}
                                </p>
                                <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                                  {g.itens.map((p, j) => <LinhaPresenca key={`${p.nome}-${j}`} p={p} />)}
                                </ul>
                              </div>
                            ))}
                            {semCong.length > 0 && (
                              <div>
                                {grupos.length > 0 && (
                                  <p className="mb-1 text-[0.68rem] uppercase tracking-[0.12em] text-brand-200/45">
                                    Outros
                                  </p>
                                )}
                                <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                                  {semCong.map((p, j) => <LinhaPresenca key={`${p.nome}-${j}`} p={p} />)}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        <p className="mt-3 border-t border-white/8 pt-2.5 text-[0.72rem] text-brand-200/45">
                          Registrado por {r.autor} em {fmt.format(new Date(r.registradoEm))}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      <ModalReuniao
        aberto={criando}
        aoFechar={() => setCriando(false)}
        reuniao={null}
        aoGravar={(corpo) => gravar("/api/agenda/reunioes", "POST", corpo)}
      />

      <ModalReuniao
        aberto={emEdicao !== null}
        aoFechar={() => setEmEdicao(null)}
        reuniao={emEdicao ? {
          titulo: emEdicao.titulo,
          tipo: emEdicao.tipo,
          data: emEdicao.data,
          local: emEdicao.local,
          obs: emEdicao.obs,
          participantes: emEdicao.participantes,
        } : null}
        aoGravar={(corpo) => gravar(`/api/agenda/reunioes/${emEdicao?.id}`, "PATCH", corpo)}
      />

      {imprimindo && <ImpressaoReuniao reuniao={imprimindo} />}
    </>
  );
}

function LinhaPresenca({ p }: { p: ParticipanteReuniao }) {
  return (
    <li className={cn("flex items-center gap-2 rounded-lg px-2 py-1 text-[0.8rem]",
      p.presente ? "text-brand-100/80" : "bg-flame-500/[0.06] text-flame-400/85")}>
      {p.presente
        ? <Check className="h-3 w-3 shrink-0 text-emerald-300" />
        : <X className="h-3 w-3 shrink-0" />}
      <span className="truncate">{p.nome}</span>
      {p.papel && <span className="shrink-0 text-[0.65rem] text-brand-200/40">({p.papel})</span>}
    </li>
  );
}

/**
 * Impressão em duas páginas: a lista simples de presentes, e a presença
 * completa por congregação (quem veio e quem faltou).
 *
 * `print:break-after-page` separa as duas de verdade — a segunda só começa
 * numa folha nova, tanto na impressora quanto em "Salvar como PDF".
 */
function ImpressaoReuniao({ reuniao }: { reuniao: Reuniao }) {
  const participantes = reuniao.participantes ?? [];
  const presentes = participantes.filter((p) => p.presente);
  const { grupos, semCong } = agruparPorCongregacao(participantes);

  return (
    <div className="hidden print:block">
      {/* Página 1 — lista de presentes */}
      <section className="print:break-after-page">
        <CabecalhoImpresso reuniao={reuniao} />
        <h2 className="mt-5 text-center text-[0.95rem] font-bold uppercase tracking-wide">Lista de Presentes</h2>
        <p className="mt-1 text-center text-[0.8rem]">{presentes.length} de {participantes.length} convocados</p>
        <ol className="mx-auto mt-5 max-w-md list-decimal space-y-1.5 pl-6 text-[0.86rem]">
          {presentes.map((p, i) => (
            <li key={`${p.nome}-${i}`}>
              {p.nome}
              {p.congNome && <span className="text-[0.76rem]"> — {p.congNome}</span>}
            </li>
          ))}
        </ol>
        {presentes.length === 0 && <p className="mt-4 text-center text-[0.84rem]">Ninguém marcado como presente.</p>}
      </section>

      {/* Página 2 — presença completa por congregação */}
      <section>
        <CabecalhoImpresso reuniao={reuniao} />
        <h2 className="mt-5 text-center text-[0.95rem] font-bold uppercase tracking-wide">Presença por Congregação</h2>
        <div className="mt-5 space-y-5">
          {grupos.map((g) => (
            <div key={g.congNome} className="break-inside-avoid">
              <h3 className="border-b border-black pb-1 text-[0.86rem] font-semibold uppercase tracking-wide">
                {g.congNome}
              </h3>
              <table className="mt-1.5 w-full text-left text-[0.82rem]">
                <tbody>
                  {g.itens.map((p, i) => (
                    <tr key={`${p.nome}-${i}`}>
                      <td className="w-6 py-0.5 align-top">{p.presente ? "✓" : "✗"}</td>
                      <td className="py-0.5 align-top">{p.nome}</td>
                      <td className="py-0.5 align-top text-[0.74rem]">{p.papel ?? ""}</td>
                      <td className="py-0.5 align-top text-[0.74rem] font-medium">
                        {p.presente ? "presente" : "falta"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {semCong.length > 0 && (
            <div className="break-inside-avoid">
              <h3 className="border-b border-black pb-1 text-[0.86rem] font-semibold uppercase tracking-wide">Outros</h3>
              <table className="mt-1.5 w-full text-left text-[0.82rem]">
                <tbody>
                  {semCong.map((p, i) => (
                    <tr key={`${p.nome}-${i}`}>
                      <td className="w-6 py-0.5 align-top">{p.presente ? "✓" : "✗"}</td>
                      <td className="py-0.5 align-top">{p.nome}</td>
                      <td className="py-0.5 align-top text-[0.74rem] font-medium">
                        {p.presente ? "presente" : "falta"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CabecalhoImpresso({ reuniao }: { reuniao: Reuniao }) {
  return (
    <div className="border-b-2 border-black pb-3 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- impressão simples, sem pipeline do next/image */}
      <img src={LOGO_SRC} alt="" className="mx-auto mb-2 h-14 w-auto object-contain" />
      <p className="text-[0.7rem] uppercase tracking-[0.2em]">{ORG_NAME}</p>
      <h1 className="mt-1 text-[1.05rem] font-bold uppercase tracking-wide">{reuniao.titulo}</h1>
      <p className="mt-1 text-[0.82rem]">
        {reuniao.tipo} · {fmtLonga.format(new Date(`${reuniao.data}T12:00:00`))}
        {reuniao.local && <> · {reuniao.local}</>}
      </p>
    </div>
  );
}
