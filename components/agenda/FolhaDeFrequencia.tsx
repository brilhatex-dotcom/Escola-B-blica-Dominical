"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardList, Loader2, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { campoBase } from "@/components/crud/FormularioModal";
import { LOGO_SRC } from "@/lib/brand";
import { ORG_NAME } from "@/lib/config";
import { rotuloDoPapel } from "@/lib/agenda/convocacao";

/**
 * Lista de frequência para ESTUDOS e REUNIÕES — a folha que circula na mesa
 * para cada um assinar.
 *
 * ============================================================================
 * A ORDEM É A DA LIDERANÇA, CONGREGAÇÃO POR CONGREGAÇÃO
 *
 *   CONG. CARNAUBINHA
 *     Dirigente ............ Pb. Fulano          ______________
 *     Vice-Dirigente ....... Dc. Beltrano        ______________   (só se houver)
 *     Secretário(a) ........ Irmã Sicrana        ______________
 *     Professor(a) ......... ...                 ______________
 *
 * Os nomes vêm da Hierarquia — ninguém digita de novo. O Dirigente e o
 * Secretário aparecem SEMPRE, com o nome em branco quando a congregação não
 * tem ninguém cadastrado: a linha vazia lembra a falta e deixa escrever à
 * mão. O Vice só aparece quando existe, porque nem toda congregação tem um.
 * No fim de cada congregação ficam linhas livres para quem vier e não estiver
 * na lista (um auxiliar, um professor novo).
 * ============================================================================
 */

type Quem = "lideranca" | "professores" | "todos";

interface Grupo {
  congId: number;
  congNome: string;
  pessoas: Array<{ nome: string; papel: string; classes?: string[] }>;
}

interface Folha {
  titulo: string;
  data: string;
  local: string;
  quem: Quem;
  linhasLivres: number;
  grupos: Grupo[];
}

const QUEM: Array<{ valor: Quem; rotulo: string; dica: string }> = [
  { valor: "todos", rotulo: "Liderança e professores", dica: "Dirigente, Vice, Secretário e Professores" },
  { valor: "lideranca", rotulo: "Só a liderança", dica: "Dirigente, Vice e Secretário" },
  { valor: "professores", rotulo: "Só os professores", dica: "Estudo de professores" },
];

const fmtLonga = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

export function FolhaDeFrequencia() {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("Lista de Frequência — Estudo");
  const [data, setData] = useState("");
  const [local, setLocal] = useState("");
  const [quem, setQuem] = useState<Quem>("todos");
  const [congId, setCongId] = useState<string>("");
  const [congregacoes, setCongregacoes] = useState<Array<{ id: number; nome: string }>>([]);
  const [linhasLivres, setLinhasLivres] = useState(2);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [folha, setFolha] = useState<Folha | null>(null);

  // As congregações da escolha vêm da mesma rota (já recortada pelo acesso).
  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    if (!data) setData(new Date().toISOString().slice(0, 10));
    if (congregacoes.length > 0) return;
    fetch("/api/agenda/reunioes/convocados?quem=lideranca", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { congregacoes: Grupo[] }) => setCongregacoes(d.congregacoes.map((g) => ({ id: g.congId, nome: g.congNome }))))
      .catch(() => setErro("Não foi possível carregar as congregações."));
  }, [aberto, data, congregacoes.length]);

  // Imprime assim que a folha estiver montada; some depois da impressão.
  useEffect(() => {
    if (!folha) return;
    const id = setTimeout(() => window.print(), 300);
    const aoVoltar = () => setFolha(null);
    window.addEventListener("afterprint", aoVoltar);
    return () => {
      clearTimeout(id);
      window.removeEventListener("afterprint", aoVoltar);
    };
  }, [folha]);

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/agenda/reunioes/convocados?quem=${quem}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const d: { congregacoes: Grupo[] } = await res.json();
      const grupos = congId ? d.congregacoes.filter((g) => String(g.congId) === congId) : d.congregacoes;
      setAberto(false);
      setFolha({ titulo: titulo.trim() || "Lista de Frequência", data, local: local.trim(), quem, linhasLivres, grupos });
    } catch {
      setErro("Não foi possível montar a lista. Confira a conexão e tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setAberto(true)}>
        <ClipboardList className="h-4 w-4" />
        Lista de frequência
      </Button>

      <Dialog open={aberto} onOpenChange={(v) => !gerando && setAberto(v)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Lista de frequência</DialogTitle>
            <DialogDescription>
              Folha para assinar em estudos e reuniões: por congregação, Dirigente, Vice (quando houver),
              Secretário e Professores.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Título</span>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campoBase} />
              <span className="mt-1 flex flex-wrap gap-1.5">
                {["Lista de Frequência — Estudo", "Lista de Frequência — Reunião", "Estudo de Professores"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTitulo(t)}
                    className="rounded-full border border-white/10 px-2 py-0.5 text-[0.7rem] text-brand-200/70 hover:border-gold-300/40 hover:text-gold-200"
                  >
                    {t}
                  </button>
                ))}
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Data</span>
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={cn(campoBase, "[color-scheme:dark]")} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Local</span>
                <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="opcional" className={campoBase} />
              </label>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-[0.76rem] text-brand-200/70">Quem entra na lista</legend>
              <div className="grid gap-1.5">
                {QUEM.map((q) => (
                  <label
                    key={q.valor}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[0.82rem] transition-colors",
                      quem === q.valor ? "border-gold-300/45 bg-gold-400/10 text-white" : "border-white/10 text-brand-100/80",
                    )}
                  >
                    <input type="radio" name="quem" value={q.valor} checked={quem === q.valor} onChange={() => setQuem(q.valor)} className="accent-[#D4AF37]" />
                    <span className="flex-1">{q.rotulo}</span>
                    <span className="text-[0.7rem] text-brand-200/50">{q.dica}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Congregação</span>
                <select value={congId} onChange={(e) => setCongId(e.target.value)} className={cn(campoBase, "[&>option]:bg-brand-900")}>
                  {congregacoes.length !== 1 && <option value="">Todas</option>}
                  {congregacoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">Linhas em branco por congregação</span>
                <select value={linhasLivres} onChange={(e) => setLinhasLivres(Number(e.target.value))} className={cn(campoBase, "[&>option]:bg-brand-900")}>
                  {[0, 1, 2, 3, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "Nenhuma" : n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {erro && (
              <p role="alert" className="rounded-lg border border-flame-500/35 bg-flame-500/10 px-3 py-2 text-[0.8rem] text-flame-400">
                {erro}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAberto(false)} disabled={gerando}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void gerar()} disabled={gerando || !data}>
              {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Imprimir lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {folha && createPortal(<FolhaImpressa folha={folha} />, document.body)}
    </>
  );
}

/* ------------------------------------------------------------------ */

interface Linha {
  papel: string;
  nome: string;
  detalhe?: string;
}

/** As linhas de uma congregação, na ordem pedida, com os lugares vazios. */
function linhasDoGrupo(g: Grupo, quem: Quem, livres: number): Linha[] {
  const linhas: Linha[] = [];
  const com = (papel: string) => g.pessoas.filter((p) => p.papel.split(" · ")[0] === papel);
  const outros = (p: { papel: string }) => {
    const resto = p.papel.split(" · ").slice(1);
    return resto.length ? `também ${resto.map(rotuloDoPapel).join(", ").toLowerCase()}` : undefined;
  };

  if (quem !== "professores") {
    const dirigentes = com("Dirigente");
    if (dirigentes.length === 0) linhas.push({ papel: "Dirigente", nome: "" });
    dirigentes.forEach((p) => linhas.push({ papel: "Dirigente", nome: p.nome, detalhe: outros(p) }));

    // Vice só quando existe.
    com("Vice-Dirigente").forEach((p) => linhas.push({ papel: "Vice-Dirigente", nome: p.nome, detalhe: outros(p) }));

    const secretarios = com("Secretário Local");
    if (secretarios.length === 0) linhas.push({ papel: "Secretário(a)", nome: "" });
    secretarios.forEach((p) => linhas.push({ papel: "Secretário(a)", nome: p.nome, detalhe: outros(p) }));
  }

  if (quem !== "lideranca") {
    com("Professor").forEach((p) =>
      linhas.push({
        papel: "Professor(a)",
        nome: p.nome,
        detalhe: p.classes?.length ? `classe ${p.classes.join(", ")}` : undefined,
      }),
    );
  }

  for (let i = 0; i < livres; i++) linhas.push({ papel: "", nome: "" });
  return linhas;
}

function FolhaImpressa({ folha }: { folha: Folha }) {
  const grupos = folha.grupos
    .map((g) => ({ g, linhas: linhasDoGrupo(g, folha.quem, folha.linhasLivres) }))
    // "Só os professores" de uma congregação sem professor e sem linha livre não tem o que imprimir.
    .filter((x) => x.linhas.length > 0);

  return (
    // `px-px`: sem ele a borda direita das tabelas cai fora da área impressa.
    <div className="hidden bg-white px-px text-black print:block">
      <div className="border-b-2 border-black pb-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- impressão simples */}
        <img src={LOGO_SRC} alt="" className="mx-auto mb-2 h-14 w-auto object-contain" />
        <p className="text-[0.7rem] uppercase tracking-[0.2em]">{ORG_NAME}</p>
        <h1 className="mt-1 text-[1.1rem] font-bold uppercase tracking-wide">{folha.titulo}</h1>
        <p className="mt-1 text-[0.84rem] first-letter:uppercase">
          {folha.data ? fmtLonga.format(new Date(`${folha.data}T12:00:00`)) : ""}
          {folha.local && <> · {folha.local}</>}
        </p>
      </div>

      <div className="mt-4 space-y-4">
        {grupos.map(({ g, linhas }) => (
          <section key={g.congId} className="break-inside-avoid">
            {/* Borda grossa, e não faixa preta com letra branca: a impressão do
                portal força todo texto para preto (app/globals.css). */}
            <h2 className="border-x border-t-2 border-black px-2 py-1 text-[0.9rem] font-bold uppercase tracking-wide">
              {g.congNome}
            </h2>
            <table className="w-full border-collapse text-left text-[0.82rem]">
              <thead>
                <tr className="text-[0.66rem] uppercase tracking-wide">
                  <th className="w-[22%] border border-black px-2 py-1 font-semibold">Função</th>
                  <th className="w-[40%] border border-black px-2 py-1 font-semibold">Nome</th>
                  <th className="border border-black px-2 py-1 font-semibold">Assinatura</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} className="h-9">
                    <td className="border border-black px-2 align-middle font-medium">{l.papel}</td>
                    <td className="border border-black px-2 align-middle">
                      {l.nome}
                      {l.detalhe && <span className="block text-[0.66rem] leading-tight">{l.detalhe}</span>}
                    </td>
                    <td className="border border-black px-2" />
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        {grupos.length === 0 && <p className="text-center text-[0.86rem]">Ninguém cadastrado para esta lista.</p>}
      </div>

      <p className="mt-6 text-[0.7rem]">
        Nomes da Hierarquia do portal. Linha com nome em branco: cargo sem ninguém cadastrado — escreva à mão e
        atualize depois na tela de Congregações.
      </p>
    </div>
  );
}
