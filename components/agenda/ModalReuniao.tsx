"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Loader2, Plus, Save, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { campoBase } from "@/components/crud/FormularioModal";
import { Seletor, type Candidato } from "@/components/dashboard/GerirResponsaveis";

/**
 * Cadastro de reunião — com a lista de presença montada a partir da
 * Hierarquia, não digitada.
 *
 * ============================================================================
 * TODO CONVOCADO COMEÇA EM FALTA, E NINGUÉM FICA DE FORA DA LISTA
 *
 * Numa reunião de campo (dirigentes e secretários de cada congregação), a
 * lista de quem deveria estar já é conhecida — é a Hierarquia. Digitar os
 * ~28 nomes toda vez é trabalho repetido e um convite a esquecer alguém. O
 * botão "Carregar Dirigentes e Secretários" busca em
 * `/api/agenda/reunioes/convocados` e entra com todos em FALTA: quem está
 * conduzindo a reunião só risca quem apareceu, em vez de montar a lista do
 * zero. Isso não fere "falta não é o mesmo que não marcado" — ninguém fica
 * sem registro; todo convocado tem um `presente` explícito desde o início,
 * só que o valor padrão combinado é `false`.
 *
 * Uma reunião NOVA já chega com a lista carregada sozinha — é o caso comum.
 * Editar uma reunião existente NÃO recarrega por conta própria (uma reunião
 * de outro tipo, como "Estudo de Professores" de uma única congregação, não
 * deveria ganhar a lista do campo inteiro sem alguém pedir) — por isso ali o
 * botão continua à mão, para quem quiser completar uma lista antiga.
 * ============================================================================
 */

export interface ParticipanteReuniao {
  nome: string;
  presente: boolean;
  congId: number | null;
  congNome: string | null;
  papel: string | null;
}

export interface ReuniaoParaEditar {
  titulo: string;
  tipo: string;
  data: string;
  local: string | null;
  obs: string | null;
  participantes: ParticipanteReuniao[] | null;
}

interface GrupoConvocados {
  congId: number;
  congNome: string;
  pessoas: Array<{ nome: string; papel: string }>;
}

export function ModalReuniao({
  aberto,
  aoFechar,
  reuniao,
  aoGravar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** `null` = nova reunião. */
  reuniao: ReuniaoParaEditar | null;
  aoGravar: (corpo: {
    titulo: string;
    tipo: string;
    data: string;
    local: string;
    obs: string;
    participantes: ParticipanteReuniao[];
  }) => Promise<string | void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("");
  const [data, setData] = useState("");
  const [local, setLocal] = useState("");
  const [obs, setObs] = useState("");
  const [participantes, setParticipantes] = useState<ParticipanteReuniao[]>([]);
  const [carregandoConvocados, setCarregandoConvocados] = useState(false);
  const [semRegistro, setSemRegistro] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ehNova = reuniao === null;

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setBuscando(false);
    setSemRegistro([]);
    if (reuniao) {
      setTitulo(reuniao.titulo);
      setTipo(reuniao.tipo);
      setData(reuniao.data);
      setLocal(reuniao.local ?? "");
      setObs(reuniao.obs ?? "");
      setParticipantes(reuniao.participantes ?? []);
    } else {
      setTitulo("Reunião de Dirigentes e Secretários");
      setTipo("Reunião de Dirigentes e Secretários");
      setData(new Date().toISOString().slice(0, 10));
      setLocal("");
      setObs("");
      setParticipantes([]);
      void carregarConvocados({ silencioso: true });
    }
    // Só reage à abertura/troca de reunião — recarregar a cada digitação
    // apagaria o que a pessoa está preenchendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, reuniao]);

  async function carregarConvocados({ silencioso = false }: { silencioso?: boolean } = {}) {
    setCarregandoConvocados(true);
    try {
      const res = await fetch("/api/agenda/reunioes/convocados", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const dados: { congregacoes: GrupoConvocados[] } = await res.json();
      setSemRegistro(dados.congregacoes.filter((g) => g.pessoas.length === 0).map((g) => g.congNome));
      setParticipantes((atual) => {
        const existentes = new Set(atual.map((p) => p.nome.toLowerCase()));
        const novos: ParticipanteReuniao[] = [];
        for (const g of dados.congregacoes) {
          for (const pessoa of g.pessoas) {
            if (existentes.has(pessoa.nome.toLowerCase())) continue;
            existentes.add(pessoa.nome.toLowerCase());
            novos.push({
              nome: pessoa.nome,
              presente: false,
              congId: g.congId,
              congNome: g.congNome,
              papel: pessoa.papel,
            });
          }
        }
        return [...atual, ...novos];
      });
    } catch {
      if (!silencioso) setErro("Não foi possível carregar a lista de Dirigentes e Secretários.");
    } finally {
      setCarregandoConvocados(false);
    }
  }

  function alternarPresenca(indice: number) {
    setParticipantes((atual) => atual.map((p, i) => (i === indice ? { ...p, presente: !p.presente } : p)));
  }

  function remover(indice: number) {
    setParticipantes((atual) => atual.filter((_, i) => i !== indice));
  }

  function adicionarConvidado(c: Candidato | null) {
    setBuscando(false);
    if (!c) return;
    const nome = c.tratamento ? `${c.tratamento} ${c.nome}` : c.nome;
    if (participantes.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) return;
    // Quem é adicionado à mão, e não veio da lista de convocados, entra
    // direto como presente — é por isso que alguém o está adicionando agora.
    setParticipantes((atual) => [...atual, { nome, presente: true, congId: null, congNome: null, papel: null }]);
  }

  const grupos = useMemo(() => {
    const porCong = new Map<string, { congNome: string; itens: Array<{ p: ParticipanteReuniao; indice: number }> }>();
    const semCong: Array<{ p: ParticipanteReuniao; indice: number }> = [];
    participantes.forEach((p, indice) => {
      if (p.congNome) {
        const g = porCong.get(p.congNome) ?? { congNome: p.congNome, itens: [] };
        g.itens.push({ p, indice });
        porCong.set(p.congNome, g);
      } else {
        semCong.push({ p, indice });
      }
    });
    return {
      listaCong: [...porCong.values()].sort((a, b) => a.congNome.localeCompare(b.congNome, "pt-BR")),
      semCong,
    };
  }, [participantes]);

  const totalPresentes = participantes.filter((p) => p.presente).length;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (gravando) return;
    if (!titulo.trim()) {
      setErro("Informe o título da reunião.");
      return;
    }
    if (!data) {
      setErro("Informe a data da reunião.");
      return;
    }
    setGravando(true);
    setErro(null);
    try {
      const problema = await aoGravar({
        titulo: titulo.trim(),
        tipo: tipo.trim(),
        data,
        local: local.trim(),
        obs: obs.trim(),
        participantes,
      });
      if (problema) setErro(problema);
      else aoFechar();
    } finally {
      setGravando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !gravando && !v && aoFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ehNova ? "Nova reunião" : "Editar reunião"}</DialogTitle>
          <DialogDescription>Todo convocado começa em falta — marque só quem esteve presente.</DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">
                Título<span className="ml-1 text-gold-300">*</span>
              </span>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={gravando} className={campoBase} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">
                Data<span className="ml-1 text-gold-300">*</span>
              </span>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                disabled={gravando}
                className={cn(campoBase, "[color-scheme:dark]")}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Tipo</span>
              <input value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={gravando} className={campoBase} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Local</span>
              <input value={local} onChange={(e) => setLocal(e.target.value)} disabled={gravando} className={campoBase} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Observação</span>
              <textarea
                rows={2}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                disabled={gravando}
                className={cn(campoBase, "h-auto py-2.5 leading-relaxed")}
              />
            </label>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-gold-300" />
                <span className="text-[0.8rem] font-semibold text-brand-50">
                  {totalPresentes} de {participantes.length} presentes
                </span>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => void carregarConvocados()} disabled={carregandoConvocados || gravando}>
                {carregandoConvocados ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                Carregar Dirigentes e Secretários
              </Button>
            </div>

            {participantes.length === 0 && !carregandoConvocados && (
              <p className="py-4 text-center text-[0.8rem] text-brand-200/45">
                Ninguém na lista ainda — carregue os Dirigentes e Secretários ou adicione alguém abaixo.
              </p>
            )}

            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {grupos.listaCong.map((g) => (
                <div key={g.congNome}>
                  <p className="mb-1 text-[0.68rem] uppercase tracking-[0.12em] text-brand-200/45">{g.congNome}</p>
                  <ul className="space-y-1">
                    {g.itens.map(({ p, indice }) => (
                      <LinhaParticipante key={indice} p={p} onToggle={() => alternarPresenca(indice)} onRemover={() => remover(indice)} disabled={gravando} />
                    ))}
                  </ul>
                </div>
              ))}
              {grupos.semCong.length > 0 && (
                <div>
                  {grupos.listaCong.length > 0 && (
                    <p className="mb-1 text-[0.68rem] uppercase tracking-[0.12em] text-brand-200/45">Outros convidados</p>
                  )}
                  <ul className="space-y-1">
                    {grupos.semCong.map(({ p, indice }) => (
                      <LinhaParticipante key={indice} p={p} onToggle={() => alternarPresenca(indice)} onRemover={() => remover(indice)} disabled={gravando} />
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {semRegistro.length > 0 && (
              <p className="mt-2 border-t border-white/8 pt-2 text-[0.72rem] leading-relaxed text-gold-200/75">
                Sem Dirigente nem Secretário Local cadastrado: {semRegistro.join(", ")}. Essas congregações não
                entraram na lista — chame por telefone, ou adicione alguém abaixo.
              </p>
            )}

            <div className="mt-2 border-t border-white/8 pt-2">
              {buscando ? (
                <Seletor aoEscolher={adicionarConvidado} aoCancelar={() => setBuscando(false)} permiteVago={false} />
              ) : (
                <button
                  type="button"
                  onClick={() => setBuscando(true)}
                  disabled={gravando}
                  className="flex items-center gap-1.5 py-1 text-[0.78rem] text-gold-200/80 transition-colors hover:text-gold-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar alguém que não está na lista
                </button>
              )}
            </div>
          </div>

          {erro && (
            <p role="alert" className="rounded-lg border border-flame-500/35 bg-flame-500/10 px-3 py-2 text-[0.8rem] text-flame-400">
              {erro}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar} disabled={gravando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={gravando}>
              {gravando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {gravando ? "Salvando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinhaParticipante({
  p, onToggle, onRemover, disabled,
}: {
  p: ParticipanteReuniao; onToggle: () => void; onRemover: () => void; disabled: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.82rem] transition-colors duration-300",
        p.presente ? "bg-emerald-500/[0.08] text-brand-50" : "text-brand-200/70",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={p.presente}
        aria-label={p.presente ? `Marcar ${p.nome} como falta` : `Marcar ${p.nome} como presente`}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-300",
          p.presente ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-300" : "border-white/15 bg-white/[0.03] text-transparent",
        )}
      >
        <Check className="h-3 w-3" />
      </button>
      <span className="min-w-0 flex-1 truncate">{p.nome}</span>
      {p.papel && (
        <span className="shrink-0 rounded-full bg-white/6 px-1.5 py-0.5 text-[0.58rem] uppercase tracking-wider text-brand-200/50">
          {p.papel}
        </span>
      )}
      <button
        type="button"
        onClick={onRemover}
        disabled={disabled}
        aria-label={`Remover ${p.nome}`}
        className="shrink-0 rounded p-0.5 text-brand-300/40 transition-colors hover:text-flame-400"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}
