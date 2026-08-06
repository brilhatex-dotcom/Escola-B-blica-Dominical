"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, MapPin, Plus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo, EsqueletoLista, EstadoErro, EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { Button } from "@/components/ui/button";
import { AcoesDoRegistro } from "@/components/crud/AcoesDoRegistro";
import { AvisoDeGravacao } from "@/components/crud/AvisoDeGravacao";
import { FormularioModal, type CampoForm } from "@/components/crud/FormularioModal";
import { useCrud } from "@/components/crud/useCrud";
import { useAcesso } from "@/components/acesso/AcessoProvider";

/**
 * Reuniões, com a lista de presença.
 *
 * "9 DE 18 PRESENTES" DIZ POUCO — quem faltou é o que a secretaria precisa para
 * cobrar. Por isso a lista de participantes é aberta no próprio item, e não numa
 * tela seguinte: cobrar cinco ausentes não deveria custar cinco navegações.
 */

interface Reuniao {
  id: number; titulo: string; tipo: string; data: string;
  local: string | null; obs: string | null; autor: string;
  presentes: number; totalConvocados: number;
  participantes: Array<{ nome: string; presente: boolean }> | null;
  registradoEm: string;
}

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function ReunioesPage() {
  const { podeGravar } = useAcesso();
  const podeMexer = podeGravar("agenda-reunioes");
  const { aviso, limparAviso, recarga, gravar } = useCrud();
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Reuniao | null>(null);

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

  return (
    <>
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
            const ausentes = r.participantes?.filter((p) => !p.presente) ?? [];

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
                {podeMexer && (
                  <div className="flex justify-end gap-2 border-t border-white/6 px-4 py-2">
                    <AcoesDoRegistro
                      nome={r.titulo}
                      onEditar={() => setEmEdicao(r)}
                      aviso={`A reunião "${r.titulo}" será excluída com a lista de presença dela. Não há como recuperar depois.`}
                      onExcluir={async () => {
                        await gravar(`/api/agenda/reunioes/${r.id}`, "DELETE");
                      }}
                    />
                  </div>
                )}

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
                        <>
                          {ausentes.length > 0 && (
                            <p className="mb-2 text-[0.76rem] text-gold-200/80">
                              {ausentes.length} {ausentes.length === 1 ? "ausente" : "ausentes"}
                            </p>
                          )}
                          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                            {r.participantes.map((p, j) => (
                              <li key={`${p.nome}-${j}`}
                                className={cn("flex items-center gap-2 rounded-lg px-2 py-1 text-[0.8rem]",
                                  p.presente ? "text-brand-100/80" : "bg-flame-500/[0.06] text-flame-400/85")}>
                                {p.presente
                                  ? <Check className="h-3 w-3 shrink-0 text-emerald-300" />
                                  : <X className="h-3 w-3 shrink-0" />}
                                <span className="truncate">{p.nome}</span>
                              </li>
                            ))}
                          </ul>
                        </>
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

      <FormularioModal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Nova reunião"
        descricao="Presentes e ausentes em caixas separadas — quem não estiver em nenhuma não foi convocado."
        campos={CAMPOS_REUNIAO}
        valores={{ titulo: "", tipo: "", data: "", local: "", presentes: "", ausentes: "", obs: "" }}
        rotuloGravar="Registrar"
        aoGravar={(v) => gravar("/api/agenda/reunioes", "POST", v)}
      />

      <FormularioModal
        aberto={emEdicao !== null}
        aoFechar={() => setEmEdicao(null)}
        titulo="Editar reunião"
        campos={CAMPOS_REUNIAO}
        valores={{
          titulo: emEdicao?.titulo ?? "",
          tipo: emEdicao?.tipo ?? "",
          data: emEdicao?.data?.slice(0, 10) ?? "",
          local: emEdicao?.local ?? "",
          // As duas caixas são reconstruídas a partir do JSON guardado. Editar
          // uma reunião e gravar sem mexer nelas devolve exatamente a mesma
          // lista — o instantâneo volta igual ao que estava.
          presentes: (emEdicao?.participantes ?? [])
            .filter((p) => p.presente)
            .map((p) => p.nome)
            .join("\n"),
          ausentes: (emEdicao?.participantes ?? [])
            .filter((p) => !p.presente)
            .map((p) => p.nome)
            .join("\n"),
          obs: emEdicao?.obs ?? "",
        }}
        aoGravar={(v) => gravar(`/api/agenda/reunioes/${emEdicao?.id}`, "PATCH", v)}
      />
    </>
  );
}

const CAMPOS_REUNIAO: readonly CampoForm[] = [
  { chave: "titulo", rotulo: "Título", obrigatorio: true, largo: true },
  { chave: "data", rotulo: "Data", tipo: "data", obrigatorio: true },
  { chave: "tipo", rotulo: "Tipo", placeholder: "ex.: Reunião de obreiros" },
  { chave: "local", rotulo: "Local", largo: true },
  {
    chave: "presentes",
    rotulo: "Presentes (um nome por linha)",
    tipo: "area",
    ajuda: "Nomes repetidos são descartados — colar do WhatsApp costuma duplicar.",
  },
  { chave: "ausentes", rotulo: "Ausentes (um nome por linha)", tipo: "area" },
  { chave: "obs", rotulo: "Observação", tipo: "area" },
];
