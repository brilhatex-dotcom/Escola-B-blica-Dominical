"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cake, GraduationCap, Loader2, Phone, Plus, Power, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CabecalhoModulo,
  CampoDeBusca,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
  Filtro,
} from "@/components/dashboard/PaginaModulo";
import { diaEMes, iniciais } from "@/lib/dashboard/formato";
import { useAcesso } from "@/components/acesso/AcessoProvider";

/**
 * Alunos matriculados.
 *
 * A lista mostra APENAS os ativos por padrao. O cadastro tem 323 alunos, dos
 * quais 291 ativos; abrir com todos faria a secretaria procurar entre gente que
 * ja saiu da EBD toda vez que buscasse alguem.
 */

interface AlunoLista {
  id: number;
  nome: string;
  nasc: string | null;
  tel: string | null;
  resp: string | null;
  ativo: boolean;
  classe: { id: number; nome: string; faixa: string } | null;
  congregacao: { id: number; nome: string } | null;
}

interface ClasseOpcao {
  id: number;
  nome: string;
  congId?: number | null;
}

interface Cong {
  id: number;
  nome: string;
}

export default function AlunosPage() {
  const [busca, setBusca] = useState("");
  const [classe, setClasse] = useState<number | null>(null);
  const [itens, setItens] = useState<AlunoLista[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [classes, setClasses] = useState<ClasseOpcao[]>([]);
  const [congregacoes, setCongregacoes] = useState<Cong[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [alunoAberto, setAlunoAberto] = useState<AlunoLista | null>(null);
  const { podeGravar } = useAcesso();
  const editavel = podeGravar("alunos");

  async function carregar() {
    try {
      setErro(null);
      const url = new URL("/api/alunos", window.location.origin);
      if (busca.trim()) url.searchParams.set("busca", busca.trim());
      if (classe) url.searchParams.set("classe", String(classe));
      url.searchParams.set("porPagina", "200");

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const dados = await res.json();
      setItens(dados.itens);
      setTotal(dados.total);
      return dados.itens as AlunoLista[];
    } catch (e) {
      const status = (e as { status?: number }).status;
      setErro(
        status
          ? "O servidor respondeu com erro. Isso costuma ser banco de dados não configurado — abra /api/diagnostico para ver o motivo."
          : "Sem resposta do servidor. Verifique a conexão e tente de novo.",
      );
      setItens([]);
      return [];
    }
  }

  useEffect(() => {
    void fetch("/api/classes")
      .then((r) => r.json())
      .then((d) =>
        setClasses(
          (d.itens ?? []).map((c: { id: number; nome: string; congregacao: { id: number } | null }) => ({
            id: c.id,
            nome: c.nome,
            congId: c.congregacao?.id ?? null,
          })),
        ),
      )
      .catch(() => setClasses([]));
    if (editavel) {
      fetch("/api/congregacoes", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setCongregacoes((d.itens ?? []).map((c: { id: number; nome: string }) => ({ id: c.id, nome: c.nome }))))
        .catch(() => {});
    }
  }, [editavel]);

  useEffect(() => {
    const controle = new AbortController();
    const t = window.setTimeout(() => void carregar(), 300);
    return () => {
      controle.abort();
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, classe]);

  async function aoMudarAluno() {
    const nova = await carregar();
    if (alunoAberto) {
      const atualizado = nova.find((a) => a.id === alunoAberto.id);
      setAlunoAberto(atualizado ?? null);
    }
  }

  return (
    <>
      <CabecalhoModulo
        icone={GraduationCap}
        titulo="Alunos"
        descricao="Matriculados e ativos na Escola Bíblica"
        total={total}
      >
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <CampoDeBusca
            valor={busca}
            aoMudar={setBusca}
            placeholder="Buscar por nome…"
            className="min-w-0 flex-1 sm:w-64 sm:flex-none"
          />
          <Filtro rotulo="Classe" opcoes={classes} valor={classe} aoMudar={setClasse} />
          {editavel && (
            <Button size="sm" onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" />
              Novo aluno
            </Button>
          )}
        </div>
      </CabecalhoModulo>

      {criando && (
        <Dialog open={criando} onOpenChange={setCriando}>
          <DialogContent>
            <NovoAluno
              congregacoes={congregacoes}
              classes={classes}
              aoFechar={() => setCriando(false)}
              aoCriar={() => {
                setCriando(false);
                void carregar();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {alunoAberto && (
        <Dialog open={Boolean(alunoAberto)} onOpenChange={(v) => !v && setAlunoAberto(null)}>
          <DialogContent>
            <EditarAluno
              aluno={alunoAberto}
              classes={classes}
              aoFechar={() => setAlunoAberto(null)}
              aoMudou={aoMudarAluno}
              aoApagado={() => {
                setAlunoAberto(null);
                void carregar();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : itens === null ? (
        <EsqueletoLista />
      ) : itens.length === 0 ? (
        <EstadoVazio
          mensagem={busca ? `Nenhum aluno encontrado para “${busca}”.` : "Nenhum aluno nesta seleção."}
          dica="Somente alunos ativos aparecem nesta lista."
        />
      ) : (
        <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
          {itens.map((a, i) => (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i, 20) * 0.02, ease: [0.16, 1, 0.3, 1] }}
              onClick={editavel ? () => setAlunoAberto(a) : undefined}
              className={cn(
                "flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-300 hover:bg-white/[0.03]",
                editavel && "cursor-pointer",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-white/12">
                <span className="font-display text-[0.68rem] font-semibold tracking-wider text-brand-50">
                  {iniciais(a.nome)}
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.88rem] text-brand-50">{a.nome}</p>
                <p className="truncate text-[0.74rem] text-brand-200/55">
                  {a.classe?.nome ?? "Sem classe"}
                  {a.congregacao?.nome && <span className="text-brand-200/40"> · {a.congregacao.nome}</span>}
                </p>
                {a.resp && (
                  <p className="truncate text-[0.7rem] text-brand-200/40">Resp.: {a.resp}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {a.nasc && (
                  <span className="hidden items-center gap-1.5 text-[0.74rem] text-brand-200/50 md:flex">
                    <Cake className="h-3 w-3" />
                    {diaEMes(new Date(a.nasc))}
                  </span>
                )}
                {a.tel && (
                  <span className="hidden items-center gap-1.5 text-[0.74rem] tabular-nums text-brand-200/55 sm:flex">
                    <Phone className="h-3 w-3" />
                    {a.tel}
                  </span>
                )}
                {a.classe?.faixa && <Badge variant="info">{a.classe.faixa}</Badge>}
                {!a.ativo && <Badge variant="neutro">inativo</Badge>}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Novo aluno
 * ------------------------------------------------------------------ */

function NovoAluno({
  congregacoes,
  classes,
  aoFechar,
  aoCriar,
}: {
  congregacoes: Cong[];
  classes: ClasseOpcao[];
  aoFechar: () => void;
  aoCriar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [congId, setCongId] = useState<number | "">(congregacoes.length === 1 ? congregacoes[0].id : "");
  const [classeId, setClasseId] = useState<number | "">("");
  const [tel, setTel] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const classesDaCong = classes.filter((c) => congId === "" || c.congId === congId);

  async function criar() {
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/alunos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          tel: tel || undefined,
          congId: congId === "" ? undefined : congId,
          classeId: classeId === "" ? undefined : classeId,
        }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível matricular o aluno.");
      aoCriar();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Novo aluno</DialogTitle>
      </DialogHeader>

      <div className="grid gap-3">
        <CampoTexto rotulo="Nome" valor={nome} aoMudar={setNome} placeholder="Nome completo" />
        <CampoTexto rotulo="Telefone (opcional)" valor={tel} aoMudar={setTel} placeholder="(00) 00000-0000" />

        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.1em] text-brand-200/50">Congregação</span>
          <select
            value={congId}
            onChange={(e) => {
              setCongId(e.target.value ? Number(e.target.value) : "");
              setClasseId("");
            }}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.84rem] text-brand-50 focus:border-gold-400/35 focus:outline-none [&>option]:bg-brand-900"
          >
            <option value="">Escolha…</option>
            {congregacoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.1em] text-brand-200/50">Classe (opcional)</span>
          <select
            value={classeId}
            onChange={(e) => setClasseId(e.target.value ? Number(e.target.value) : "")}
            disabled={congId === ""}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.84rem] text-brand-50 focus:border-gold-400/35 focus:outline-none disabled:opacity-50 [&>option]:bg-brand-900"
          >
            <option value="">Sem classe por enquanto</option>
            {classesDaCong.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {msg && <p className="mt-2 text-[0.8rem] text-flame-400">{msg}</p>}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => void criar()} disabled={salvando || !nome.trim() || congId === ""}>
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
          Matricular
        </Button>
        <Button variant="ghost" onClick={aoFechar}>
          Cancelar
        </Button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Editar / desativar / apagar aluno
 * ------------------------------------------------------------------ */

function EditarAluno({
  aluno,
  classes,
  aoFechar,
  aoMudou,
  aoApagado,
}: {
  aluno: AlunoLista;
  classes: ClasseOpcao[];
  aoFechar: () => void;
  aoMudou: () => void;
  aoApagado: () => void;
}) {
  const [nome, setNome] = useState(aluno.nome);
  const [tel, setTel] = useState(aluno.tel ?? "");
  const [resp, setResp] = useState(aluno.resp ?? "");
  const [classeId, setClasseId] = useState<number | "">(aluno.classe?.id ?? "");
  const [salvando, setSalvando] = useState(false);
  const [alternandoAtivo, setAlternandoAtivo] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const classesDaCong = classes.filter((c) => !aluno.congregacao || c.congId === aluno.congregacao.id);

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/alunos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: aluno.id,
          nome,
          tel,
          resp,
          classeId: classeId === "" ? null : classeId,
        }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível salvar.");
      aoMudou();
      aoFechar();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo() {
    setAlternandoAtivo(true);
    try {
      await fetch("/api/alunos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: aluno.id, ativo: !aluno.ativo }),
      });
      aoMudou();
    } finally {
      setAlternandoAtivo(false);
    }
  }

  async function apagar() {
    if (!window.confirm(`Apagar o cadastro de "${aluno.nome}"? Isso não pode ser desfeito.`)) return;
    setApagando(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/alunos?id=${aluno.id}`, { method: "DELETE" });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível apagar.");
      aoApagado();
    } catch (e) {
      setMsg((e as Error).message);
      setApagando(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{aluno.nome}</DialogTitle>
        <p className="text-[0.8rem] text-brand-200/60">{aluno.congregacao?.nome}</p>
      </DialogHeader>

      <div className="grid gap-3">
        <CampoTexto rotulo="Nome" valor={nome} aoMudar={setNome} />
        <CampoTexto rotulo="Telefone" valor={tel} aoMudar={setTel} />
        <CampoTexto rotulo="Responsável" valor={resp} aoMudar={setResp} />

        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.1em] text-brand-200/50">Classe</span>
          <select
            value={classeId}
            onChange={(e) => setClasseId(e.target.value ? Number(e.target.value) : "")}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.84rem] text-brand-50 focus:border-gold-400/35 focus:outline-none [&>option]:bg-brand-900"
          >
            <option value="">Sem classe</option>
            {classesDaCong.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {msg && <p className="mt-2 text-[0.8rem] text-flame-400">{msg}</p>}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={() => void salvar()} disabled={salvando || !nome.trim()}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void alternarAtivo()}
            disabled={alternandoAtivo}
            title={aluno.ativo ? "Desativar" : "Reativar"}
            className={cn(
              "rounded-lg border p-2 transition-colors",
              aluno.ativo
                ? "border-white/10 bg-white/[0.04] text-brand-200/60 hover:border-flame-500/40 hover:text-flame-400"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
            )}
          >
            {alternandoAtivo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void apagar()}
            disabled={apagando}
            title="Só é possível apagar um aluno sem chamada registrada"
            className="rounded-lg border border-flame-500/25 bg-flame-500/5 p-2 text-flame-400/90 transition-colors hover:bg-flame-500/15"
          >
            {apagando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </>
  );
}

function CampoTexto({
  rotulo,
  valor,
  aoMudar,
  placeholder,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.7rem] uppercase tracking-[0.1em] text-brand-200/50">{rotulo}</span>
      <input
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.84rem] text-brand-50 placeholder:text-brand-200/35 focus:border-gold-400/35 focus:outline-none"
      />
    </label>
  );
}
