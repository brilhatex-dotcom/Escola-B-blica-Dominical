"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarRange, ChevronDown, ExternalLink, FileText, Plus } from "lucide-react";
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
 * Escalas de culto.
 *
 * ============================================================================
 * O LINK DO DRIVE FOI SUBSTITUÍDO PELO BUILDER — DE VEZ
 *
 * Até aqui, a escala era um PDF montado fora do sistema e o portal só
 * registrava qual arquivo valia para qual mês (`Escala_Cultos`/`/api/escalas`,
 * ver o comentário lá — inclusive o porquê de rejeitar modelar turnos, na
 * Fase 11). O pastor pediu o oposto: montar a escala mensal DENTRO do portal,
 * mais rápido do que hoje — e decidiu que o link do Drive sai de circulação,
 * não que os dois convivam.
 *
 * Então esta tela não publica mais nenhum link novo. O que já foi publicado
 * antes da troca continua listado — de leitura, para não sumir do histórico —
 * e todo mês novo nasce pelo builder (`/dashboard/escalas/[id]`), que grava em
 * `EscalaMensal`/`EscalaItem`.
 * ============================================================================
 */

interface EscalaArquivo {
  id: number; titulo: string; mes: string; doMesAtual: boolean;
  enviadaEm: string; arquivo: string; url: string;
  obs: string | null; autor: string; congregacao: string | null; doCampo: boolean;
}

interface EscalaMensal {
  id: number; titulo: string; mesAno: string; status: string; autor: string; atualizado: string; quantidadeItens: number;
}

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export default function EscalasPage() {
  const router = useRouter();
  const { podeGravar, escopo } = useAcesso();
  const podeMontar = podeGravar("escalas") && escopo === "campo";
  const podeMexerArquivo = podeGravar("escalas");
  const { aviso, limparAviso, recarga, gravar } = useCrud();
  const [criando, setCriando] = useState(false);
  const [mostrarArquivo, setMostrarArquivo] = useState(false);
  const [emEdicaoArquivo, setEmEdicaoArquivo] = useState<EscalaArquivo | null>(null);

  const [mensais, setMensais] = useState<EscalaMensal[] | null>(null);
  const [arquivo, setArquivo] = useState<{ itens: EscalaArquivo[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        const [resMensal, resArquivo] = await Promise.all([
          fetch("/api/escalas-mensais", { signal: controle.signal, cache: "no-store" }),
          fetch("/api/escalas", { signal: controle.signal, cache: "no-store" }),
        ]);
        if (!resMensal.ok) throw Object.assign(new Error(), { status: resMensal.status });
        const dMensal = await resMensal.json();
        setMensais(dMensal.itens ?? []);
        if (resArquivo.ok) setArquivo(await resArquivo.json());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const status = (e as { status?: number }).status;
        setErro(
          status === 403
            ? "O seu acesso não permite ver as escalas."
            : "Não foi possível carregar as escalas.",
        );
      }
    })();
    return () => controle.abort();
  }, [recarga]);

  const mesAtual = new Date().toISOString().slice(0, 7);
  const temMesAtual = mensais?.some((m) => m.mesAno.slice(0, 7) === mesAtual) ?? false;

  async function criar(valores: Record<string, string>) {
    try {
      const res = await fetch("/api/escalas-mensais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) return corpo.erro ?? "Não foi possível criar a escala.";
      setCriando(false);
      router.push(`/dashboard/escalas/${corpo.id}`);
    } catch {
      return "Sem resposta do servidor. Verifique a conexão.";
    }
  }

  return (
    <>
      <CabecalhoModulo
        icone={CalendarRange}
        titulo="Escalas"
        descricao="Escala de culto do mês, montada pelo campo"
        total={mensais?.length ?? null}
      >
        {podeMontar && (
          <Button size="sm" onClick={() => setCriando(true)}>
            <Plus className="h-4 w-4" />
            Montar escala mensal
          </Button>
        )}
      </CabecalhoModulo>

      <AvisoDeGravacao mensagem={aviso} aoFechar={limparAviso} />

      {erro ? <EstadoErro mensagem={erro} />
      : !mensais ? <EsqueletoLista linhas={4} />
      : (
        <>
          {!temMesAtual && (
            <div className="mb-4 rounded-2xl border border-gold-400/25 bg-gold-400/[0.06] px-4 py-3 text-[0.82rem] text-gold-100">
              O mês corrente ainda não tem escala montada.
            </div>
          )}

          {mensais.length === 0 ? (
            <EstadoVazio
              mensagem="Nenhuma escala mensal montada ainda."
              dica={podeMontar ? "Clique em \"Montar escala mensal\" para começar." : "Quem administra o campo monta a escala pelo builder."}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 gap-3 lg:grid-cols-2"
            >
              {mensais.map((m) => (
                <Link
                  key={m.id}
                  href={`/dashboard/escalas/${m.id}`}
                  className="glass-panel block rounded-2xl p-4 transition-colors duration-300 hover:border-gold-400/25"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-[0.95rem] font-semibold capitalize text-white">
                        {fmtMes.format(new Date(`${m.mesAno}T12:00:00`))}
                      </h3>
                      <p className="mt-0.5 truncate text-[0.78rem] text-brand-200/60">{m.titulo}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {m.mesAno.slice(0, 7) === mesAtual && <Badge variant="sucesso">mês atual</Badge>}
                      <Badge variant={m.status === "publicado" ? "info" : "alerta"}>
                        {m.status === "publicado" ? "publicada" : "rascunho"}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-[0.76rem] text-brand-200/50">
                    {m.quantidadeItens} culto{m.quantidadeItens === 1 ? "" : "s"} lançado{m.quantidadeItens === 1 ? "" : "s"}
                  </p>
                  <p className="mt-2 border-t border-white/8 pt-2.5 text-[0.72rem] tabular-nums text-brand-200/50">
                    {m.autor} · atualizado em {fmt.format(new Date(m.atualizado))}
                  </p>
                </Link>
              ))}
            </motion.div>
          )}
        </>
      )}

      {arquivo && arquivo.itens.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setMostrarArquivo((v) => !v)}
            className="flex items-center gap-1.5 text-[0.78rem] text-brand-200/55 transition-colors hover:text-brand-100"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mostrarArquivo ? "rotate-180" : ""}`} />
            Escalas antigas — arquivo do Drive ({arquivo.itens.length})
          </button>

          {mostrarArquivo && (
            <>
              <p className="mb-3 mt-2 max-w-2xl text-[0.76rem] text-brand-200/45">
                Publicadas antes da escala passar a ser montada pelo portal. Ficam aqui só para consulta —
                nenhuma escala nova é publicada por link.
              </p>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {arquivo.itens.map((e) => (
                  <article key={e.id} className="glass-panel rounded-2xl p-4 opacity-80">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-[0.9rem] font-semibold capitalize text-white">{e.mes}</h3>
                        <p className="mt-0.5 text-[0.76rem] text-brand-200/60">
                          {e.titulo}{" · "}{e.doCampo ? "campo inteiro" : e.congregacao}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                      <FileText className="h-4 w-4 shrink-0 text-brand-300/60" />
                      <span className="min-w-0 flex-1 truncate text-[0.76rem] text-brand-100/75">{e.arquivo}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-2.5">
                      <p className="text-[0.72rem] tabular-nums text-brand-200/50">
                        {e.autor} · enviada em {fmt.format(new Date(`${e.enviadaEm}T12:00:00`))}
                      </p>
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/25 bg-gold-400/[0.08] px-3 py-1.5 text-[0.76rem] text-gold-200 transition-colors hover:bg-gold-400/15"
                      >
                        Abrir a escala
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {podeMexerArquivo && (
                        <AcoesDoRegistro
                          nome={e.titulo}
                          onEditar={() => setEmEdicaoArquivo(e)}
                          aviso={`A escala "${e.titulo}" sai do portal. O arquivo em si continua no Drive.`}
                          onExcluir={async () => {
                            await gravar(`/api/escalas/${e.id}`, "DELETE");
                          }}
                        />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <FormularioModal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Montar escala mensal"
        descricao="Cria o mês vazio — os cultos são lançados na tela seguinte."
        campos={CAMPOS_NOVA_ESCALA}
        valores={{ titulo: "", mesAno: "" }}
        rotuloGravar="Começar a montar"
        aoGravar={criar}
      />

      <FormularioModal
        aberto={emEdicaoArquivo !== null}
        aoFechar={() => setEmEdicaoArquivo(null)}
        titulo="Editar escala antiga"
        descricao="Só corrige o registro do arquivo — não publica um mês novo."
        campos={CAMPOS_ARQUIVO}
        valores={{
          titulo: emEdicaoArquivo?.titulo ?? "",
          mesAno: emEdicaoArquivo?.mes?.slice(0, 7) ?? "",
          url: emEdicaoArquivo?.url ?? "",
          nomeArquivo: emEdicaoArquivo?.arquivo ?? "",
          obs: emEdicaoArquivo?.obs ?? "",
        }}
        aoGravar={(v) => gravar(`/api/escalas/${emEdicaoArquivo?.id}`, "PATCH", v)}
      />
    </>
  );
}

const CAMPOS_NOVA_ESCALA: readonly CampoForm[] = [
  { chave: "titulo", rotulo: "Título", obrigatorio: true, largo: true, placeholder: "Lista Oficial de Culto do Mês de Agosto de 2026" },
  {
    chave: "mesAno",
    rotulo: "Mês (AAAA-MM)",
    obrigatorio: true,
    placeholder: "2026-08",
    ajuda: "O mês que esta escala cobre.",
  },
];

const CAMPOS_ARQUIVO: readonly CampoForm[] = [
  { chave: "titulo", rotulo: "Título", obrigatorio: true, largo: true },
  { chave: "mesAno", rotulo: "Mês (AAAA-MM)", obrigatorio: true, placeholder: "2026-08" },
  { chave: "url", rotulo: "Endereço do arquivo", obrigatorio: true, largo: true, placeholder: "https://drive.google.com/…" },
  { chave: "nomeArquivo", rotulo: "Nome do arquivo", largo: true },
  { chave: "obs", rotulo: "Observação", tipo: "area" },
];
