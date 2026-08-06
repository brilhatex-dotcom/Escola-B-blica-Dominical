"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookMarked, CircleCheck, CircleDashed, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { Button } from "@/components/ui/button";
import { AcoesDoRegistro } from "@/components/crud/AcoesDoRegistro";
import { AvisoDeGravacao } from "@/components/crud/AvisoDeGravacao";
import { FormularioModal, type CampoForm } from "@/components/crud/FormularioModal";
import { useCrud } from "@/components/crud/useCrud";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { CATEGORIAS_DE_CLASSE, rotuloDaCategoria } from "@/lib/ebd/categorias";

/**
 * Lições do trimestre, e o que cada classe já ministrou.
 *
 * O QUE FOI DADO vem de `Freq_Licao`, e não do calendário. Marcar como
 * ministrada toda lição cuja data já passou seria fácil e mentiria: o número
 * viria do relógio, não da igreja, e um trimestre inteiro sem chamada apareceria
 * como um trimestre em dia.
 */

interface Licao {
  id: number;
  data: string;
  titulo: string;
  trim: string;
  tipoClasse: string;
  escopo: string;
  /** `null` = nenhuma classe registrou; distinto de zero. */
  classesQueDeram: number | null;
}

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export default function LicoesPage() {
  const { podeGravar } = useAcesso();
  const podeMexer = podeGravar("licoes");
  const { aviso, limparAviso, recarga, gravar } = useCrud();
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Licao | null>(null);

  const [ano, setAno] = useState<number | null>(null);
  const [trim, setTrim] = useState<string>("");
  const [dados, setDados] = useState<{
    itens: Licao[];
    trimestres: string[];
    totalClasses: number;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setAno(new Date().getFullYear()), []);

  useEffect(() => {
    if (ano === null) return;
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        setDados(null);
        const url = new URL("/api/licoes", window.location.origin);
        url.searchParams.set("ano", String(ano));
        if (trim) url.searchParams.set("trim", trim);
        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDados(await res.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status === 403
            ? "O seu acesso não permite ver esta tela."
            : status
              ? "O servidor respondeu com erro."
              : "Sem resposta do servidor. Verifique a conexão.",
        );
      }
    })();
    return () => controle.abort();
  }, [ano, trim, recarga]);

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <>
      <CabecalhoModulo
        icone={BookMarked}
        titulo="Lições"
        descricao="Lições do trimestre e o que cada classe ministrou"
        total={dados?.itens.length ?? null}
      >
        <div className="flex flex-wrap items-center gap-2">
          {podeMexer && (
            <Button size="sm" onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" />
              Nova lição
            </Button>
          )}
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
            <span className="shrink-0 text-brand-200/55">Ano</span>
            <input
              type="number"
              value={ano ?? ""}
              onChange={(e) => setAno(Number(e.target.value))}
              className="w-16 bg-transparent tabular-nums text-brand-50 focus:outline-none"
            />
          </label>
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
            <span className="shrink-0 text-brand-200/55">Trimestre</span>
            <select
              value={trim}
              onChange={(e) => setTrim(e.target.value)}
              className="bg-transparent text-brand-50 focus:outline-none [&>option]:bg-brand-900"
            >
              <option value="">Todos</option>
              {(dados?.trimestres ?? []).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      </CabecalhoModulo>

      <AvisoDeGravacao mensagem={aviso} aoFechar={limparAviso} />

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : dados === null ? (
        <EsqueletoLista linhas={8} />
      ) : dados.itens.length === 0 ? (
        <EstadoVazio
          mensagem={`Nenhuma lição cadastrada para ${ano}${trim ? ` no ${trim}` : ""}.`}
          dica="As lições vêm da revista do trimestre, importadas do sistema antigo."
        />
      ) : (
        <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
          {dados.itens.map((l, i) => {
            const passou = l.data <= hoje;
            const deram = l.classesQueDeram;
            return (
              <motion.li
                key={l.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i, 20) * 0.015 }}
                className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition-colors duration-300 hover:bg-white/[0.03]"
              >
                <div className="w-14 shrink-0 text-center">
                  <p className="font-display text-[0.95rem] font-semibold leading-none text-white tabular-nums">
                    {l.data.slice(8, 10)}
                  </p>
                  <p className="mt-0.5 text-[0.62rem] uppercase tracking-wider text-gold-300/60">
                    {fmtData.format(new Date(`${l.data}T12:00:00`)).split(" ").at(-1)}
                  </p>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.86rem] text-brand-50">{l.titulo}</p>
                  <p className="truncate text-[0.72rem] text-brand-200/50">
                    {l.trim} · {rotuloDaCategoria(l.tipoClasse)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {deram !== null ? (
                    <span className="flex items-center gap-1.5 text-[0.76rem] text-emerald-300/85">
                      <CircleCheck className="h-3.5 w-3.5" />
                      {deram} {deram === 1 ? "classe" : "classes"}
                    </span>
                  ) : passou ? (
                    /*
                     * Data passada e nenhum registro: isso é uma pendência de
                     * verdade. Antes de a data chegar, é só uma lição futura —
                     * e chamar de "pendente" o que ainda não venceu treina a
                     * secretaria a ignorar o aviso.
                     */
                    <span className="flex items-center gap-1.5 text-[0.76rem] text-gold-200/80">
                      <CircleDashed className="h-3.5 w-3.5" />
                      sem registro
                    </span>
                  ) : (
                    <Badge variant="neutro">a ministrar</Badge>
                  )}

                  {podeMexer && (
                    <AcoesDoRegistro
                      nome={l.titulo}
                      onEditar={() => setEmEdicao(l)}
                      aviso={
                        deram !== null
                          ? `Esta lição já foi ministrada por ${deram} ${deram === 1 ? "classe" : "classes"} — o portal vai recusar a exclusão, porque apagá-la apagaria a prova de que elas estavam em dia.`
                          : undefined
                      }
                      onExcluir={async () => {
                        await gravar(`/api/licoes/${l.id}`, "DELETE");
                      }}
                    />
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      <FormularioModal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Nova lição"
        descricao="A lição é do campo e vale para todas as classes daquela categoria."
        campos={CAMPOS_LICAO}
        valores={{ titulo: "", data: "", trim: "", tipoClasse: "" }}
        rotuloGravar="Cadastrar"
        aoGravar={(v) => gravar("/api/licoes", "POST", v)}
      />

      <FormularioModal
        aberto={emEdicao !== null}
        aoFechar={() => setEmEdicao(null)}
        titulo="Editar lição"
        campos={CAMPOS_LICAO}
        valores={{
          titulo: emEdicao?.titulo ?? "",
          data: emEdicao?.data?.slice(0, 10) ?? "",
          trim: emEdicao?.trim ?? "",
          tipoClasse: emEdicao?.tipoClasse ?? "",
        }}
        aoGravar={(v) => gravar(`/api/licoes/${emEdicao?.id}`, "PATCH", v)}
      />
    </>
  );
}

const CAMPOS_LICAO: readonly CampoForm[] = [
  {
    chave: "titulo",
    rotulo: "Título",
    obrigatorio: true,
    largo: true,
    placeholder: "Lição 5: O Juízo contra Sodoma e Gomorra",
  },
  { chave: "data", rotulo: "Domingo", tipo: "data", obrigatorio: true },
  {
    chave: "trim",
    rotulo: "Trimestre",
    tipo: "lista",
    obrigatorio: true,
    opcoes: [
      { valor: "1T", rotulo: "1º trimestre" },
      { valor: "2T", rotulo: "2º trimestre" },
      { valor: "3T", rotulo: "3º trimestre" },
      { valor: "4T", rotulo: "4º trimestre" },
    ],
  },
  {
    chave: "tipoClasse",
    rotulo: "Categoria de classe",
    tipo: "lista",
    obrigatorio: true,
    opcoes: CATEGORIAS_DE_CLASSE.map((c) => ({ valor: c.chave, rotulo: c.rotulo })),
    ajuda: "A mesma lição vale para todas as classes desta categoria, no campo inteiro.",
  },
];
