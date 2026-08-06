"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  ChevronRight,
  Loader2,
  Plus,
  Power,
  School,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
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
} from "@/components/dashboard/PaginaModulo";
import { useAcesso } from "@/components/acesso/AcessoProvider";

/**
 * Classes da EBD, agrupadas por congregação.
 *
 * ============================================================================
 * SÃO 53 CLASSES — LISTÁ-LAS SOLTAS É UMA PAREDE
 *
 * Uma grade com 53 cartões obriga a rolar procurando a congregação certa. Aqui
 * cada congregação é uma seção que abre e fecha: a tela começa recolhida,
 * mostrando quantas classes e alunos cada uma tem, e a pessoa abre só a que
 * quer ver.
 *
 * A busca continua funcionando por cima disso: digitar um nome ABRE
 * automaticamente as seções que têm classe correspondente, para o resultado não
 * ficar escondido atrás de uma seção fechada.
 * ============================================================================
 *
 * CADA CARTÃO ABRE O DETALHE DA CLASSE — professor, alunos, faixa etária, e os
 * botões de editar/adicionar/remover, quando o acesso permite gravar. Quem só
 * pode ver enxerga o mesmo detalhe sem os botões: a diferença é decidida por
 * `podeGravar("classes")`, não por uma tela à parte.
 */

interface Pessoa {
  id: number;
  nome: string;
  tratamento: string | null;
}

interface ClasseLista {
  id: number;
  nome: string;
  faixa: string;
  tipoClasse: string;
  ativa: boolean;
  profOriginal: string | null;
  congregacao: { id: number; nome: string } | null;
  alunos: number;
  professores: Pessoa[];
}

interface Grupo {
  id: number;
  nome: string;
  classes: ClasseLista[];
  alunos: number;
}

interface Cong {
  id: number;
  nome: string;
}

/** As categorias de revista praticadas — a mesma lista de /api/revistas, sem "Obreiros" e sem juntar Jovens/Adultos. */
const NOME_CATEGORIA: Record<string, string> = {
  bercario: "Berçário",
  maternal: "Maternal",
  jardim: "Jardim de Infância",
  primarios: "Primários",
  juniores: "Juniores",
  preadolesc: "Pré-Adolescentes",
  adolesc: "Adolescentes",
  juvenis: "Juvenis",
  jovens: "Jovens",
  adultos: "Adultos",
};

const FAIXAS_CONHECIDAS = [
  "3 e 4 anos",
  "5 e 6 anos",
  "7 e 8 anos",
  "9 e 10 anos",
  "11 e 12 anos",
  "13 e 14 anos",
  "15 a 17 anos",
  "18 a 25 anos",
  "A partir de 25 anos",
];

function Cartao({ c, aoAbrir }: { c: ClasseLista; aoAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={aoAbrir}
      className={cn(
        "glass-panel relative overflow-hidden rounded-2xl p-4 text-left transition-transform duration-300",
        "hover:-translate-y-0.5 hover:ring-1 hover:ring-gold-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/70",
        !c.ativa && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-display text-[0.9rem] font-semibold text-white">{c.nome}</h3>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/6 px-2 py-1 text-[0.72rem] tabular-nums text-brand-100">
          <Users className="h-3 w-3" />
          {c.alunos}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {c.faixa && <Badge variant="info">{c.faixa}</Badge>}
        {c.tipoClasse && <Badge variant="neutro">{NOME_CATEGORIA[c.tipoClasse] ?? c.tipoClasse}</Badge>}
        {!c.ativa && <Badge variant="erro">inativa</Badge>}
      </div>

      <div className="mt-3 border-t border-white/8 pt-3">
        <p className="text-[0.64rem] uppercase tracking-[0.16em] text-brand-200/40">
          {c.professores.length === 1 ? "Professor" : "Professores"}
        </p>
        {c.professores.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {c.professores.map((p) => (
              <li key={p.id} className="truncate text-[0.8rem] text-brand-50">
                {p.tratamento && <span className="text-gold-200/80">{p.tratamento} </span>}
                {p.nome}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[0.8rem] italic text-brand-200/45">Sem professor definido</p>
        )}

        {c.profOriginal &&
          c.profOriginal.trim() !== c.professores.map((p) => p.nome).join(" e ") && (
            <p className="mt-1.5 truncate text-[0.68rem] text-brand-200/35">
              cadastro original: “{c.profOriginal}”
            </p>
          )}
      </div>
    </button>
  );
}

export default function ClassesPage() {
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<ClasseLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abertas, setAbertas] = useState<Set<number>>(new Set());
  const [congregacoes, setCongregacoes] = useState<Cong[]>([]);
  const [criando, setCriando] = useState(false);
  const [classeAberta, setClasseAberta] = useState<ClasseLista | null>(null);
  const { podeGravar } = useAcesso();
  const editavel = podeGravar("classes");

  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("busca");
    if (b) setBusca(b);
  }, []);

  async function carregar() {
    try {
      setErro(null);
      const url = new URL("/api/classes", window.location.origin);
      if (busca.trim()) url.searchParams.set("busca", busca.trim());
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const dados = await res.json();
      setItens(dados.itens);
      return dados.itens as ClasseLista[];
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
    const controle = new AbortController();
    const t = window.setTimeout(() => void carregar(), 300);
    return () => {
      controle.abort();
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  useEffect(() => {
    if (!editavel) return;
    fetch("/api/congregacoes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCongregacoes((d.itens ?? []).map((c: { id: number; nome: string }) => ({ id: c.id, nome: c.nome }))))
      .catch(() => {});
  }, [editavel]);

  const grupos = useMemo<Grupo[]>(() => {
    if (!itens) return [];
    const mapa = new Map<number, Grupo>();
    for (const c of itens) {
      const id = c.congregacao?.id ?? 0;
      const nome = c.congregacao?.nome ?? "Sem congregação";
      let g = mapa.get(id);
      if (!g) {
        g = { id, nome, classes: [], alunos: 0 };
        mapa.set(id, g);
      }
      g.classes.push(c);
      g.alunos += c.alunos;
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [itens]);

  const buscando = busca.trim().length > 0;

  function alternar(id: number) {
    setAbertas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  }

  async function aoMudarDetalhe() {
    const nova = await carregar();
    if (classeAberta) {
      const atualizada = nova.find((c) => c.id === classeAberta.id);
      setClasseAberta(atualizada ?? null);
    }
  }

  return (
    <>
      <CabecalhoModulo
        icone={School}
        titulo="Classes"
        descricao="Por congregação — clique para abrir"
        total={itens?.length ?? null}
      >
        <div className="flex flex-wrap items-center gap-2">
          <CampoDeBusca valor={busca} aoMudar={setBusca} placeholder="Buscar classe…" className="w-full sm:w-72" />
          {editavel && (
            <Button size="sm" onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" />
              Nova classe
            </Button>
          )}
        </div>
      </CabecalhoModulo>

      {criando && (
        <Dialog open={criando} onOpenChange={setCriando}>
          <DialogContent>
            <NovaClasse
              congregacoes={congregacoes}
              aoFechar={() => setCriando(false)}
              aoCriar={() => {
                setCriando(false);
                void carregar();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {classeAberta && (
        <Dialog open={Boolean(classeAberta)} onOpenChange={(v) => !v && setClasseAberta(null)}>
          <DialogContent className="max-w-2xl">
            <ClasseDetalhe
              classe={classeAberta}
              editavel={editavel}
              aoFechar={() => setClasseAberta(null)}
              aoMudou={aoMudarDetalhe}
              aoApagada={() => {
                setClasseAberta(null);
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
        <EstadoVazio mensagem={busca ? `Nenhuma classe para “${busca}”.` : "Nenhuma classe cadastrada."} />
      ) : (
        <div className="space-y-2.5">
          {grupos.map((g) => {
            const aberto = buscando || abertas.has(g.id);
            return (
              <div key={g.id} className="glass-panel overflow-hidden rounded-2xl">
                <button
                  type="button"
                  onClick={() => alternar(g.id)}
                  aria-expanded={aberto}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-brand-300/50 transition-transform duration-300",
                      aberto && "rotate-90",
                    )}
                  />
                  <Building2 className="h-4 w-4 shrink-0 text-gold-300/70" />
                  <span className="min-w-0 flex-1 truncate font-display text-[0.92rem] font-semibold text-white">
                    {g.nome}
                  </span>
                  <span className="shrink-0 text-[0.72rem] tabular-nums text-brand-300/50">
                    {g.classes.length} classe{g.classes.length === 1 ? "" : "s"} · {g.alunos} aluno
                    {g.alunos === 1 ? "" : "s"}
                  </span>
                </button>

                {aberto && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid gap-3 border-t border-white/6 p-3 sm:grid-cols-2 2xl:grid-cols-3"
                  >
                    {g.classes.map((c) => (
                      <Cartao key={c.id} c={c} aoAbrir={() => setClasseAberta(c)} />
                    ))}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Nova classe
 * ------------------------------------------------------------------ */

function NovaClasse({
  congregacoes,
  aoFechar,
  aoCriar,
}: {
  congregacoes: Cong[];
  aoFechar: () => void;
  aoCriar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [faixa, setFaixa] = useState(FAIXAS_CONHECIDAS[0]);
  const [tipoClasse, setTipoClasse] = useState("jardim");
  const [congId, setCongId] = useState<number | "">(congregacoes.length === 1 ? congregacoes[0].id : "");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function criar() {
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, faixa, tipoClasse, congId: congId === "" ? undefined : congId }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível criar a classe.");
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
        <DialogTitle>Nova classe</DialogTitle>
      </DialogHeader>

      <div className="grid gap-3">
        <Campo rotulo="Nome da classe" valor={nome} aoMudar={setNome} placeholder="Ex.: Primários A" />

        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.1em] text-brand-200/50">Faixa etária</span>
          <select
            value={faixa}
            onChange={(e) => setFaixa(e.target.value)}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.84rem] text-brand-50 focus:border-gold-400/35 focus:outline-none [&>option]:bg-brand-900"
          >
            {FAIXAS_CONHECIDAS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.1em] text-brand-200/50">Categoria (revista)</span>
          <select
            value={tipoClasse}
            onChange={(e) => setTipoClasse(e.target.value)}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.84rem] text-brand-50 focus:border-gold-400/35 focus:outline-none [&>option]:bg-brand-900"
          >
            {Object.entries(NOME_CATEGORIA).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.1em] text-brand-200/50">Congregação</span>
          <select
            value={congId}
            onChange={(e) => setCongId(e.target.value ? Number(e.target.value) : "")}
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
      </div>

      {msg && <p className="mt-2 text-[0.8rem] text-flame-400">{msg}</p>}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => void criar()} disabled={salvando || !nome.trim() || congId === ""}>
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar classe
        </Button>
        <Button variant="ghost" onClick={aoFechar}>
          Cancelar
        </Button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Detalhe da classe — professor, alunos, faixa etária
 * ------------------------------------------------------------------ */

interface AlunoDaClasse {
  id: number;
  nome: string;
  nasc: string | null;
  tel: string | null;
  ativo: boolean;
}

function ClasseDetalhe({
  classe,
  editavel,
  aoFechar,
  aoMudou,
  aoApagada,
}: {
  classe: ClasseLista;
  editavel: boolean;
  aoFechar: () => void;
  aoMudou: () => void;
  aoApagada: () => void;
}) {
  const [nome, setNome] = useState(classe.nome);
  const [faixa, setFaixa] = useState(classe.faixa);
  const [tipoClasse, setTipoClasse] = useState(classe.tipoClasse);
  const [editandoCampos, setEditandoCampos] = useState(false);
  const [salvandoCampos, setSalvandoCampos] = useState(false);
  const [alternandoAtiva, setAlternandoAtiva] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [alunos, setAlunos] = useState<AlunoDaClasse[] | null>(null);

  useEffect(() => {
    setNome(classe.nome);
    setFaixa(classe.faixa);
    setTipoClasse(classe.tipoClasse);
  }, [classe]);

  useEffect(() => {
    setAlunos(null);
    const url = new URL("/api/alunos", window.location.origin);
    url.searchParams.set("classe", String(classe.id));
    url.searchParams.set("porPagina", "200");
    url.searchParams.set("ativo", "0");
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAlunos(d.itens ?? []))
      .catch(() => setAlunos([]));
  }, [classe.id]);

  async function salvarCampos() {
    setSalvandoCampos(true);
    setMsg(null);
    try {
      const res = await fetch("/api/classes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: classe.id, nome, faixa, tipoClasse }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível salvar.");
      setEditandoCampos(false);
      aoMudou();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSalvandoCampos(false);
    }
  }

  async function alternarAtiva() {
    setAlternandoAtiva(true);
    try {
      await fetch("/api/classes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: classe.id, ativa: !classe.ativa }),
      });
      aoMudou();
    } finally {
      setAlternandoAtiva(false);
    }
  }

  async function apagar() {
    if (!window.confirm(`Apagar a classe "${classe.nome}"? Isso não pode ser desfeito.`)) return;
    setApagando(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/classes?id=${classe.id}`, { method: "DELETE" });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível apagar.");
      aoApagada();
    } catch (e) {
      setMsg((e as Error).message);
      setApagando(false);
    }
  }

  async function mudarProfessores(ids: number[]) {
    const res = await fetch("/api/classes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: classe.id, professoresIds: ids }),
    });
    if (!res.ok) {
      const corpo = await res.json().catch(() => ({}));
      throw new Error(corpo?.erro ?? "Não foi possível alterar o professor.");
    }
    aoMudou();
  }

  async function removerAlunoDaClasse(alunoId: number) {
    await fetch("/api/alunos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: alunoId, classeId: null }),
    });
    setAlunos((atual) => (atual ? atual.filter((a) => a.id !== alunoId) : atual));
    aoMudou();
  }

  return (
    <>
      <DialogHeader>
        {editandoCampos ? (
          <div className="grid gap-2 pt-1">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.9rem] text-white focus:border-gold-400/35 focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={faixa}
                onChange={(e) => setFaixa(e.target.value)}
                className="h-9 rounded-xl border border-white/10 bg-white/[0.05] px-2 text-[0.78rem] text-brand-50 focus:border-gold-400/35 focus:outline-none [&>option]:bg-brand-900"
              >
                {[faixa, ...FAIXAS_CONHECIDAS.filter((f) => f !== faixa)].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <select
                value={tipoClasse}
                onChange={(e) => setTipoClasse(e.target.value)}
                className="h-9 rounded-xl border border-white/10 bg-white/[0.05] px-2 text-[0.78rem] text-brand-50 focus:border-gold-400/35 focus:outline-none [&>option]:bg-brand-900"
              >
                {Object.entries(NOME_CATEGORIA).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void salvarCampos()} disabled={salvandoCampos}>
                {salvandoCampos && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditandoCampos(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogTitle>{classe.nome}</DialogTitle>
            <p className="text-[0.8rem] text-brand-200/60">{classe.congregacao?.nome}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="info">{faixa}</Badge>
              <Badge variant="neutro">{NOME_CATEGORIA[tipoClasse] ?? tipoClasse}</Badge>
              {!classe.ativa && <Badge variant="erro">inativa</Badge>}
              {editavel && (
                <button
                  type="button"
                  onClick={() => setEditandoCampos(true)}
                  className="text-[0.72rem] text-brand-200/50 underline decoration-dotted underline-offset-2 hover:text-gold-200"
                >
                  editar
                </button>
              )}
            </div>
          </>
        )}
      </DialogHeader>

      {msg && <p className="mb-3 text-[0.8rem] text-flame-400">{msg}</p>}

      <SecaoProfessores classe={classe} editavel={editavel} aoMudar={mudarProfessores} />

      <SecaoAlunos
        classe={classe}
        alunos={alunos}
        editavel={editavel}
        aoRemover={removerAlunoDaClasse}
        aoAdicionado={() => {
          setAlunos(null);
          const url = new URL("/api/alunos", window.location.origin);
          url.searchParams.set("classe", String(classe.id));
          url.searchParams.set("porPagina", "200");
          url.searchParams.set("ativo", "0");
          fetch(url, { cache: "no-store" })
            .then((r) => r.json())
            .then((d) => setAlunos(d.itens ?? []))
            .catch(() => setAlunos([]));
          aoMudou();
        }}
      />

      {editavel && (
        <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4">
          <button
            type="button"
            onClick={() => void alternarAtiva()}
            disabled={alternandoAtiva}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.76rem] transition-colors",
              classe.ativa
                ? "border-white/10 bg-white/[0.04] text-brand-200/60 hover:border-flame-500/40 hover:text-flame-400"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
            )}
          >
            {alternandoAtiva ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
            {classe.ativa ? "Desativar classe" : "Reativar classe"}
          </button>

          <button
            type="button"
            onClick={() => void apagar()}
            disabled={apagando}
            title="Só é possível apagar uma classe sem aluno, professor ou histórico vinculado"
            className="flex items-center gap-1.5 rounded-lg border border-flame-500/25 bg-flame-500/5 px-2.5 py-1.5 text-[0.76rem] text-flame-400/90 transition-colors hover:bg-flame-500/15"
          >
            {apagando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Apagar classe
          </button>
        </div>
      )}
    </>
  );
}

function SecaoProfessores({
  classe,
  editavel,
  aoMudar,
}: {
  classe: ClasseLista;
  editavel: boolean;
  aoMudar: (ids: number[]) => Promise<void>;
}) {
  const [buscaProf, setBuscaProf] = useState("");
  const [resultados, setResultados] = useState<Pessoa[]>([]);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!buscaProf.trim()) {
      setResultados([]);
      return;
    }
    const t = window.setTimeout(() => {
      const url = new URL("/api/pessoas", window.location.origin);
      url.searchParams.set("busca", buscaProf.trim());
      url.searchParams.set("porPagina", "6");
      fetch(url, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setResultados(d.itens ?? []))
        .catch(() => setResultados([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [buscaProf]);

  async function adicionar(p: Pessoa) {
    setOcupado(true);
    try {
      const ids = [...classe.professores.map((x) => x.id), p.id];
      await aoMudar(ids);
      setBuscaProf("");
      setResultados([]);
    } finally {
      setOcupado(false);
    }
  }

  async function remover(id: number) {
    setOcupado(true);
    try {
      await aoMudar(classe.professores.filter((p) => p.id !== id).map((p) => p.id));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mb-4">
      <p className="mb-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-brand-200/45">
        {classe.professores.length === 1 ? "Professor" : "Professores"}
      </p>

      {classe.professores.length === 0 && !editavel && (
        <p className="text-[0.82rem] italic text-brand-200/45">Sem professor definido</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {classe.professores.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/6 py-1 pl-3 pr-1.5 text-[0.8rem] text-brand-50"
          >
            {p.tratamento && <span className="text-gold-200/80">{p.tratamento}</span>} {p.nome}
            {editavel && (
              <button
                type="button"
                onClick={() => void remover(p.id)}
                disabled={ocupado}
                aria-label={`Remover ${p.nome} como professor`}
                className="rounded-full p-0.5 text-brand-200/50 hover:bg-white/10 hover:text-flame-400"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>

      {editavel && (
        <div className="relative mt-2">
          <div className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5">
            <UserPlus className="h-3.5 w-3.5 shrink-0 text-brand-300/60" />
            <input
              value={buscaProf}
              onChange={(e) => setBuscaProf(e.target.value)}
              placeholder="Adicionar professor pelo nome…"
              className="min-w-0 flex-1 bg-transparent text-[0.8rem] text-brand-50 placeholder:text-brand-200/40 focus:outline-none"
            />
          </div>
          {resultados.length > 0 && (
            <ul className="glass-panel absolute z-10 mt-1 w-full overflow-hidden rounded-xl">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => void adicionar(p)}
                    disabled={ocupado}
                    className="flex w-full items-center px-3 py-2 text-left text-[0.8rem] text-brand-50 hover:bg-white/6"
                  >
                    {p.tratamento && <span className="mr-1 text-gold-200/80">{p.tratamento}</span>}
                    {p.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SecaoAlunos({
  classe,
  alunos,
  editavel,
  aoRemover,
  aoAdicionado,
}: {
  classe: ClasseLista;
  alunos: AlunoDaClasse[] | null;
  editavel: boolean;
  aoRemover: (id: number) => Promise<void>;
  aoAdicionado: () => void;
}) {
  const [buscaAluno, setBuscaAluno] = useState("");
  const [resultados, setResultados] = useState<AlunoDaClasse[]>([]);
  const [criandoAluno, setCriandoAluno] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [ocupado, setOcupado] = useState<number | null>(null);

  useEffect(() => {
    if (!buscaAluno.trim()) {
      setResultados([]);
      return;
    }
    const t = window.setTimeout(() => {
      const url = new URL("/api/alunos", window.location.origin);
      url.searchParams.set("busca", buscaAluno.trim());
      if (classe.congregacao) url.searchParams.set("cong", String(classe.congregacao.id));
      url.searchParams.set("porPagina", "6");
      fetch(url, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setResultados((d.itens ?? []).filter((a: { classe: { id: number } | null }) => a.classe?.id !== classe.id)))
        .catch(() => setResultados([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [buscaAluno, classe.id, classe.congregacao]);

  async function adicionarExistente(alunoId: number) {
    setOcupado(alunoId);
    try {
      await fetch("/api/alunos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alunoId, classeId: classe.id }),
      });
      setBuscaAluno("");
      setResultados([]);
      aoAdicionado();
    } finally {
      setOcupado(null);
    }
  }

  async function matricularNovo() {
    if (!nomeNovo.trim() || !classe.congregacao) return;
    setSalvandoNovo(true);
    try {
      await fetch("/api/alunos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeNovo.trim(), congId: classe.congregacao.id, classeId: classe.id }),
      });
      setNomeNovo("");
      setCriandoAluno(false);
      aoAdicionado();
    } finally {
      setSalvandoNovo(false);
    }
  }

  return (
    <div className="mb-2">
      <p className="mb-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-brand-200/45">
        Alunos {alunos !== null && `(${alunos.length})`}
      </p>

      {alunos === null ? (
        <p className="text-[0.8rem] text-brand-200/45">Carregando…</p>
      ) : alunos.length === 0 ? (
        <p className="text-[0.8rem] italic text-brand-200/45">Nenhum aluno matriculado nesta classe.</p>
      ) : (
        <ul className="max-h-56 divide-y divide-white/6 overflow-y-auto rounded-xl border border-white/8">
          {alunos.map((a) => (
            <li
              key={a.id}
              className={cn("flex items-center gap-2 px-3 py-2", !a.ativo && "opacity-50")}
            >
              <span className="min-w-0 flex-1 truncate text-[0.82rem] text-brand-50">{a.nome}</span>
              {!a.ativo && <Badge variant="neutro">inativo</Badge>}
              {editavel && (
                <button
                  type="button"
                  onClick={() => void aoRemover(a.id)}
                  title="Tirar da classe (não apaga o aluno)"
                  className="shrink-0 rounded-lg p-1 text-brand-200/45 hover:bg-white/8 hover:text-flame-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editavel && (
        <div className="mt-2 space-y-2">
          <div className="relative">
            <div className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-brand-300/60" />
              <input
                value={buscaAluno}
                onChange={(e) => setBuscaAluno(e.target.value)}
                placeholder="Adicionar aluno já cadastrado…"
                className="min-w-0 flex-1 bg-transparent text-[0.8rem] text-brand-50 placeholder:text-brand-200/40 focus:outline-none"
              />
            </div>
            {resultados.length > 0 && (
              <ul className="glass-panel absolute z-10 mt-1 w-full overflow-hidden rounded-xl">
                {resultados.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => void adicionarExistente(a.id)}
                      disabled={ocupado === a.id}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[0.8rem] text-brand-50 hover:bg-white/6"
                    >
                      {a.nome}
                      {ocupado === a.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {criandoAluno ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nomeNovo}
                onChange={(e) => setNomeNovo(e.target.value)}
                placeholder="Nome do novo aluno"
                className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.8rem] text-brand-50 focus:border-gold-400/35 focus:outline-none"
              />
              <Button size="sm" onClick={() => void matricularNovo()} disabled={salvandoNovo || !nomeNovo.trim()}>
                {salvandoNovo && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Matricular
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCriandoAluno(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCriandoAluno(true)}
              className="flex items-center gap-1.5 text-[0.78rem] text-brand-200/60 hover:text-gold-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Matricular novo aluno nesta classe
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Campo({
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
