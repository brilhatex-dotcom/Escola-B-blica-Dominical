"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  ChevronRight,
  GraduationCap,
  Loader2,
  Phone,
  Plus,
  School,
  UserCog,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CabecalhoModulo, EsqueletoLista, EstadoErro, EstadoVazio } from "@/components/dashboard/PaginaModulo";
import { AcoesDoRegistro } from "@/components/crud/AcoesDoRegistro";
import { FormularioModal, type CampoForm } from "@/components/crud/FormularioModal";
import { useCrud } from "@/components/crud/useCrud";
import { iniciais } from "@/lib/dashboard/formato";
import { GerirResponsaveis } from "@/components/dashboard/GerirResponsaveis";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { CATEGORIAS_DE_CLASSE, faixaSugerida, rotuloDaCategoria } from "@/lib/ebd/categorias";
import { POSICOES } from "@/lib/ebd/posicoes";

/**
 * Congregações do campo, cada uma com quem responde por ela.
 *
 * CARGO VAGO APARECE COMO VAGO, com o lugar reservado. Omitir a linha do
 * Dirigente numa congregação que não tem faria a tela parecer completa — e é
 * justamente essa ausência que alguém precisa ver para providenciar.
 *
 * ============================================================================
 * O NOME DA CONGREGAÇÃO ABRE AS CLASSES DELA — E NÃO SÓ ABRE, MEXE
 *
 * Antes desta tela só o cartão de responsáveis vivia aqui; para mexer numa
 * classe era preciso ir a outro módulo, achar a congregação de novo na lista e
 * abrir a classe outra vez. Clicar no nome agora expande, dentro do mesmo
 * cartão, as classes, os alunos e os visitantes daquela congregação — com
 * adicionar, editar e remover ali mesmo, sem trocar de tela.
 * ============================================================================
 */

interface Pessoa {
  id: number;
  nome: string;
  tratamento: string | null;
  tel: string | null;
}

interface CongregacaoLista {
  id: number;
  nome: string;
  semNome: boolean;
  classes: number;
  alunos: number;
  dirigente: Pessoa | null;
  vice: Pessoa | null;
  secretario: Pessoa | null;
}

function Responsavel({ papel, pessoa }: { papel: string; pessoa: Pessoa | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1",
          pessoa
            ? "bg-gradient-to-br from-brand-500 to-brand-700 ring-white/12"
            : "border border-dashed border-white/15 bg-white/[0.03] ring-white/8",
        )}
      >
        {pessoa ? (
          <span className="font-display text-[0.62rem] font-semibold tracking-wider text-brand-50">
            {iniciais(pessoa.nome)}
          </span>
        ) : (
          <span className="text-[0.65rem] text-brand-200/35">—</span>
        )}
      </span>
      <div className="min-w-0">
        <p className="text-[0.64rem] uppercase tracking-[0.14em] text-gold-300/70">{papel}</p>
        <p
          className={cn(
            "truncate text-[0.8rem] leading-tight",
            pessoa ? "text-brand-50" : "italic text-brand-200/45",
          )}
        >
          {pessoa ? (
            <>
              {pessoa.tratamento && <span className="text-gold-200/80">{pessoa.tratamento} </span>}
              {pessoa.nome}
            </>
          ) : (
            "vago"
          )}
        </p>
        {pessoa?.tel && (
          <p className="flex items-center gap-1 text-[0.68rem] tabular-nums text-brand-200/45">
            <Phone className="h-2.5 w-2.5" />
            {pessoa.tel}
          </p>
        )}
      </div>
    </div>
  );
}

export default function CongregacoesPage() {
  const [itens, setItens] = useState<CongregacaoLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerindo, setGerindo] = useState<number | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const { podeGravar } = useAcesso();
  const editavel = podeGravar("hierarquia");

  const carregar = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/congregacoes", { signal, cache: "no-store" });
      if (!res.ok) throw Object.assign(new Error(), { status: res.status });
      setItens((await res.json()).itens);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const status = (e as { status?: number }).status;
      setErro(
        status === 403
          ? "O seu acesso não permite ver esta tela."
          : status
            ? "O servidor respondeu com erro. Abra /api/diagnostico para ver o motivo."
            : "Sem resposta do servidor. Verifique a conexão.",
      );
      setItens([]);
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  const semNome = (itens ?? []).filter((c) => c.semNome).length;

  return (
    <>
      <CabecalhoModulo
        icone={Building2}
        titulo="Congregações"
        descricao="Clique no nome para abrir as classes, os alunos e os visitantes"
        total={itens?.length ?? null}
      />

      {semNome > 0 && (
        <p className="mb-3 text-[0.78rem] text-brand-200/55">
          <span className="font-semibold text-gold-200">{semNome}</span>{" "}
          {semNome === 1 ? "congregação está" : "congregações estão"} sem nome cadastrado —
          aparecem pelo número até alguém nomeá-{semNome === 1 ? "la" : "las"}.
        </p>
      )}

      {erro ? (
        <EstadoErro mensagem={erro} />
      ) : itens === null ? (
        <EsqueletoLista linhas={6} />
      ) : itens.length === 0 ? (
        <EstadoVazio mensagem="Nenhuma congregação no seu alcance." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {itens.map((c, i) => {
            const abertaAqui = aberta === c.id;
            return (
              <motion.article
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: Math.min(i, 14) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "glass-panel overflow-hidden rounded-2xl p-4",
                  abertaAqui && "2xl:col-span-2",
                )}
              >
                <header className="flex items-start justify-between gap-3 border-b border-white/8 pb-3">
                  <button
                    type="button"
                    onClick={() => setAberta(abertaAqui ? null : c.id)}
                    aria-expanded={abertaAqui}
                    className="group flex min-w-0 items-start gap-1.5 text-left"
                  >
                    <ChevronRight
                      className={cn(
                        "mt-1 h-3.5 w-3.5 shrink-0 text-brand-300/50 transition-transform duration-300",
                        abertaAqui && "rotate-90",
                      )}
                    />
                    <span className="min-w-0">
                      <h2
                        className={cn(
                          "truncate font-display text-[0.95rem] font-semibold transition-colors",
                          c.semNome ? "italic text-brand-200/60" : "text-white group-hover:text-gold-200",
                        )}
                      >
                        {c.nome}
                      </h2>
                      <p className="text-[0.7rem] text-brand-200/45">Congregação nº {c.id}</p>
                    </span>
                  </button>
                  <div className="flex shrink-0 gap-3 text-right">
                    <span className="flex items-center gap-1 text-[0.76rem] tabular-nums text-brand-100/80">
                      <School className="h-3 w-3 text-brand-300/70" />
                      {c.classes}
                    </span>
                    <span className="flex items-center gap-1 text-[0.76rem] tabular-nums text-brand-100/80">
                      <GraduationCap className="h-3 w-3 text-brand-300/70" />
                      {c.alunos}
                    </span>
                  </div>
                </header>

                {gerindo === c.id ? (
                  <div className="mt-3">
                    <GerirResponsaveis
                      congId={c.id}
                      atuais={{
                        Dirigente: c.dirigente,
                        "Vice-Dirigente": c.vice,
                        "Secretário Local": c.secretario,
                      }}
                      aoMudar={() => void carregar()}
                    />
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <Responsavel papel="Dirigente" pessoa={c.dirigente} />
                    <Responsavel papel="Vice-Dirigente" pessoa={c.vice} />
                    {c.secretario && <Responsavel papel="Secretário Local" pessoa={c.secretario} />}
                  </div>
                )}

                {editavel && (
                  <button
                    type="button"
                    onClick={() => setGerindo(gerindo === c.id ? null : c.id)}
                    className="mt-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.74rem] text-brand-200/70 transition-colors hover:border-gold-400/30 hover:text-gold-200"
                  >
                    <UserCog className="h-3.5 w-3.5" />
                    {gerindo === c.id ? "Concluir" : "Definir responsáveis"}
                  </button>
                )}

                {abertaAqui && (
                  <div className="mt-4 border-t border-white/8 pt-4">
                    <PainelDaCongregacao congId={c.id} congNome={c.nome} aoMudarNumeros={() => void carregar()} />
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>
      )}

      {itens && itens.length > 0 && itens.every((c) => !c.dirigente) && (
        <div className="glass-panel mt-4 flex items-start gap-3 rounded-2xl px-5 py-4">
          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
          <p className="text-[0.8rem] leading-relaxed text-brand-100/75">
            Nenhuma congregação tem dirigente cadastrado ainda. O sistema antigo não
            guardava essa informação — {editavel ? "use o botão " : "ela é atribuída pelo botão "}
            <strong>Definir responsáveis</strong> em cada cartão (ou em{" "}
            <strong>Administração → Hierarquia</strong>). É o mesmo vínculo que define
            quem enxerga cada congregação.
          </p>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * O painel expandido: classes, alunos e visitantes DESTA congregação
 * ------------------------------------------------------------------ */

interface ClasseResumo {
  id: number;
  nome: string;
  faixa: string;
  tipoClasse: string;
  ativa: boolean;
  alunos: number;
}

interface AlunoResumo {
  id: number;
  nome: string;
  nasc: string | null;
  tel: string | null;
  posicao: string | null;
  ativo: boolean;
  classe: { id: number; nome: string } | null;
}

interface VisitanteResumo {
  id: number;
  nome: string;
  nasc: string | null;
  local: string | null;
  anos: number | null;
  data: string;
  classe: { id: number; nome: string } | null;
}

function PainelDaCongregacao({
  congId,
  congNome,
  aoMudarNumeros,
}: {
  congId: number;
  congNome: string;
  aoMudarNumeros: () => void;
}) {
  const { podeGravar } = useAcesso();
  const podeClasses = podeGravar("classes");
  const podeAlunos = podeGravar("alunos");
  const podeVisitantes = podeGravar("visitantes");

  const [secao, setSecao] = useState<"classes" | "alunos" | "visitantes">("classes");

  const [classes, setClasses] = useState<ClasseResumo[] | null>(null);
  const [alunos, setAlunos] = useState<AlunoResumo[] | null>(null);
  const [visitantes, setVisitantes] = useState<VisitanteResumo[] | null>(null);

  const crudClasses = useCrud();
  const crudAlunos = useCrud();
  const crudVisitantes = useCrud();

  const [criandoClasse, setCriandoClasse] = useState(false);
  const [classeEmEdicao, setClasseEmEdicao] = useState<ClasseResumo | null>(null);
  const [criandoAluno, setCriandoAluno] = useState(false);
  const [alunoEmEdicao, setAlunoEmEdicao] = useState<AlunoResumo | null>(null);
  const [criandoVisitante, setCriandoVisitante] = useState(false);
  const [visitanteEmEdicao, setVisitanteEmEdicao] = useState<VisitanteResumo | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    void fetch(`/api/classes?cong=${congId}`, { signal: controle.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setClasses(d.itens ?? []))
      .catch(() => setClasses([]));
    return () => controle.abort();
  }, [congId, crudClasses.recarga]);

  useEffect(() => {
    aoMudarNumeros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crudClasses.recarga]);

  useEffect(() => {
    if (secao !== "alunos") return;
    const controle = new AbortController();
    void fetch(`/api/alunos?cong=${congId}&porPagina=100`, { signal: controle.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAlunos(d.itens ?? []))
      .catch(() => setAlunos([]));
    return () => controle.abort();
  }, [congId, secao, crudAlunos.recarga]);

  useEffect(() => {
    if (secao !== "visitantes") return;
    const controle = new AbortController();
    void fetch(`/api/visitantes?cong=${congId}&porPagina=50`, { signal: controle.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setVisitantes(d.itens ?? []))
      .catch(() => setVisitantes([]));
    return () => controle.abort();
  }, [congId, secao, crudVisitantes.recarga]);

  const opcoesClasse = (classes ?? []).map((c) => ({ valor: String(c.id), rotulo: c.nome }));

  return (
    <div>
      <div className="mb-3 flex gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] p-1">
        <AbaSecao rotulo="Classes" ativa={secao === "classes"} onClick={() => setSecao("classes")} />
        <AbaSecao rotulo="Alunos" ativa={secao === "alunos"} onClick={() => setSecao("alunos")} />
        <AbaSecao rotulo="Visitantes" ativa={secao === "visitantes"} onClick={() => setSecao("visitantes")} />
      </div>

      {crudClasses.aviso && secao === "classes" && <Aviso texto={crudClasses.aviso} />}
      {crudAlunos.aviso && secao === "alunos" && <Aviso texto={crudAlunos.aviso} />}
      {crudVisitantes.aviso && secao === "visitantes" && <Aviso texto={crudVisitantes.aviso} />}

      {secao === "classes" && (
        <div>
          {podeClasses && (
            <Button size="sm" variant="ghost" className="mb-2" onClick={() => setCriandoClasse(true)}>
              <Plus className="h-4 w-4" />
              Nova classe
            </Button>
          )}

          {classes === null ? (
            <ListaCarregando />
          ) : classes.length === 0 ? (
            <ListaVazia texto="Nenhuma classe nesta congregação ainda." />
          ) : (
            <ul className="max-h-72 divide-y divide-white/6 overflow-y-auto rounded-xl border border-white/8">
              {classes.map((c) => (
                <li key={c.id} className={cn("flex items-center gap-3 px-3 py-2.5", !c.ativa && "opacity-50")}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-white/12">
                    <School className="h-3.5 w-3.5 text-brand-50" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.84rem] text-brand-50">{c.nome}</p>
                    <p className="truncate text-[0.7rem] text-brand-200/50">
                      {rotuloDaCategoria(c.tipoClasse)}
                      {c.faixa && ` · ${c.faixa}`} · {c.alunos} {c.alunos === 1 ? "aluno" : "alunos"}
                      {!c.ativa && " · inativa"}
                    </p>
                  </div>
                  {podeClasses && (
                    <AcoesDoRegistro
                      nome={c.nome}
                      onEditar={() => setClasseEmEdicao(c)}
                      aviso={
                        c.alunos > 0
                          ? `A classe ${c.nome} tem ${c.alunos} ${c.alunos === 1 ? "aluno matriculado" : "alunos matriculados"}. Por isso ela será desativada, e não apagada.`
                          : undefined
                      }
                      onExcluir={async () => {
                        await crudClasses.gravar(`/api/classes/${c.id}`, "DELETE");
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {secao === "alunos" && (
        <div>
          {podeAlunos && (
            <Button
              size="sm"
              variant="ghost"
              className="mb-2"
              disabled={(classes ?? []).length === 0}
              onClick={() => setCriandoAluno(true)}
            >
              <Plus className="h-4 w-4" />
              Novo aluno
            </Button>
          )}
          {podeAlunos && (classes ?? []).length === 0 && (
            <p className="mb-2 text-[0.72rem] text-brand-200/45">
              Cadastre uma classe primeiro — todo aluno precisa entrar numa.
            </p>
          )}

          {alunos === null ? (
            <ListaCarregando />
          ) : alunos.length === 0 ? (
            <ListaVazia texto="Nenhum aluno matriculado nesta congregação." />
          ) : (
            <ul className="max-h-72 divide-y divide-white/6 overflow-y-auto rounded-xl border border-white/8">
              {alunos.map((a) => (
                <li key={a.id} className={cn("flex items-center gap-3 px-3 py-2.5", !a.ativo && "opacity-50")}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-white/12">
                    <span className="font-display text-[0.58rem] font-semibold tracking-wider text-brand-50">
                      {iniciais(a.nome)}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.84rem] text-brand-50">{a.nome}</p>
                    <p className="truncate text-[0.7rem] text-brand-200/50">
                      {a.classe?.nome ?? "Sem classe"}
                      {!a.ativo && " · arquivado"}
                    </p>
                  </div>
                  {podeAlunos && (
                    <AcoesDoRegistro
                      nome={a.nome}
                      onEditar={() => setAlunoEmEdicao(a)}
                      onExcluir={async () => {
                        await crudAlunos.gravar(`/api/alunos/${a.id}`, "DELETE");
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {secao === "visitantes" && (
        <div>
          {podeVisitantes && (
            <Button size="sm" variant="ghost" className="mb-2" onClick={() => setCriandoVisitante(true)}>
              <UserRoundPlus className="h-4 w-4" />
              Novo visitante
            </Button>
          )}

          {visitantes === null ? (
            <ListaCarregando />
          ) : visitantes.length === 0 ? (
            <ListaVazia texto="Nenhum visitante registrado nesta congregação." />
          ) : (
            <ul className="max-h-72 divide-y divide-white/6 overflow-y-auto rounded-xl border border-white/8">
              {visitantes.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-400/15 ring-1 ring-gold-400/25">
                    <span className="font-display text-[0.58rem] font-semibold tracking-wider text-gold-100">
                      {iniciais(v.nome)}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.84rem] text-brand-50">{v.nome}</p>
                    <p className="truncate text-[0.7rem] text-brand-200/50">
                      {v.classe?.nome ?? "Sem classe"}
                      {v.local && ` · ${v.local}`}
                      {v.anos !== null && ` · ${v.anos} anos`}
                    </p>
                  </div>
                  {podeVisitantes && (
                    <AcoesDoRegistro
                      nome={v.nome}
                      onEditar={() => setVisitanteEmEdicao(v)}
                      aviso={`${v.nome} será excluído definitivamente. Visitante não tem histórico ligado.`}
                      onExcluir={async () => {
                        await crudVisitantes.gravar(`/api/visitantes/${v.id}`, "DELETE");
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ---------------- Formulários ---------------- */}
      <FormularioModal
        aberto={criandoClasse}
        aoFechar={() => setCriandoClasse(false)}
        titulo="Nova classe"
        descricao={`Nasce em ${congNome}. A categoria define qual lição e qual revista a classe recebe.`}
        campos={CAMPOS_CLASSE}
        valores={{ nome: "", tipoClasse: "", faixa: "" }}
        rotuloGravar="Criar classe"
        aoGravar={(v) =>
          crudClasses.gravar("/api/classes", "POST", {
            nome: v.nome,
            tipoClasse: v.tipoClasse,
            faixa: v.faixa,
            congId,
          })
        }
      />

      <FormularioModal
        aberto={classeEmEdicao !== null}
        aoFechar={() => setClasseEmEdicao(null)}
        titulo="Editar classe"
        campos={CAMPOS_CLASSE}
        valores={{
          nome: classeEmEdicao?.nome ?? "",
          tipoClasse: classeEmEdicao?.tipoClasse ?? "",
          faixa: classeEmEdicao?.faixa ?? "",
        }}
        aoGravar={(v) =>
          crudClasses.gravar(`/api/classes/${classeEmEdicao?.id}`, "PATCH", {
            nome: v.nome,
            tipoClasse: v.tipoClasse,
            faixa: v.faixa,
          })
        }
      />

      <FormularioModal
        aberto={criandoAluno}
        aoFechar={() => setCriandoAluno(false)}
        titulo="Novo aluno"
        descricao={`Matriculado em ${congNome}.`}
        campos={camposAluno(opcoesClasse)}
        valores={{ nome: "", classeId: "", nasc: "", posicao: "", tel: "", resp: "" }}
        rotuloGravar="Matricular"
        aoGravar={(v) =>
          crudAlunos.gravar("/api/alunos", "POST", {
            nome: v.nome,
            classeId: v.classeId ? Number(v.classeId) : null,
            nasc: v.nasc || null,
            posicao: v.posicao || null,
            tel: v.tel,
            resp: v.resp,
          })
        }
      />

      <FormularioModal
        aberto={alunoEmEdicao !== null}
        aoFechar={() => setAlunoEmEdicao(null)}
        titulo="Editar aluno"
        campos={camposAluno(opcoesClasse)}
        valores={{
          nome: alunoEmEdicao?.nome ?? "",
          classeId: alunoEmEdicao?.classe ? String(alunoEmEdicao.classe.id) : "",
          nasc: alunoEmEdicao?.nasc?.slice(0, 10) ?? "",
          posicao: alunoEmEdicao?.posicao ?? "",
          tel: alunoEmEdicao?.tel ?? "",
          resp: "",
        }}
        aoGravar={(v) =>
          crudAlunos.gravar(`/api/alunos/${alunoEmEdicao?.id}`, "PATCH", {
            nome: v.nome,
            classeId: v.classeId ? Number(v.classeId) : undefined,
            nasc: v.nasc || null,
            posicao: v.posicao || null,
            tel: v.tel,
            resp: v.resp,
          })
        }
      />

      <FormularioModal
        aberto={criandoVisitante}
        aoFechar={() => setCriandoVisitante(false)}
        titulo="Novo visitante"
        descricao={`Recebido em ${congNome}.`}
        campos={camposVisitante(opcoesClasse)}
        valores={{ nome: "", data: hojeCivil(), classeId: "", nasc: "", local: "", tel: "", obs: "" }}
        rotuloGravar="Registrar"
        aoGravar={(v) =>
          crudVisitantes.gravar("/api/visitantes", "POST", {
            nome: v.nome,
            classeId: v.classeId ? Number(v.classeId) : null,
            data: v.data,
            nasc: v.nasc || null,
            local: v.local,
            tel: v.tel,
            obs: v.obs,
          })
        }
      />

      <FormularioModal
        aberto={visitanteEmEdicao !== null}
        aoFechar={() => setVisitanteEmEdicao(null)}
        titulo="Editar visitante"
        campos={camposVisitante(opcoesClasse).filter((c) => c.chave !== "classeId" && c.chave !== "data")}
        valores={{
          nome: visitanteEmEdicao?.nome ?? "",
          nasc: visitanteEmEdicao?.nasc?.slice(0, 10) ?? "",
          local: visitanteEmEdicao?.local ?? "",
          tel: "",
          obs: "",
        }}
        aoGravar={(v) =>
          crudVisitantes.gravar(`/api/visitantes/${visitanteEmEdicao?.id}`, "PATCH", {
            nome: v.nome,
            nasc: v.nasc || null,
            local: v.local,
            tel: v.tel,
            obs: v.obs,
          })
        }
      />
    </div>
  );
}

function AbaSecao({ rotulo, ativa, onClick }: { rotulo: string; ativa: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg px-3 py-1.5 text-[0.76rem] font-medium transition-colors",
        ativa ? "bg-white/8 text-gold-200" : "text-brand-200/55 hover:text-brand-100",
      )}
    >
      {rotulo}
    </button>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p className="mb-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-[0.76rem] text-emerald-200">
      {texto}
    </p>
  );
}

function ListaCarregando() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/8 px-3 py-4 text-[0.8rem] text-brand-200/50">
      <Loader2 className="h-4 w-4 animate-spin" />
      Carregando…
    </div>
  );
}

function ListaVazia({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[0.8rem] italic text-brand-200/45">
      {texto}
    </p>
  );
}

/** Hoje, no fuso do aparelho — o servidor roda em UTC e erraria o dia perto da meia-noite. */
function hojeCivil(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

const CAMPOS_CLASSE: readonly CampoForm[] = [
  { chave: "nome", rotulo: "Nome da classe", obrigatorio: true, largo: true },
  {
    chave: "tipoClasse",
    rotulo: "Categoria",
    tipo: "lista",
    obrigatorio: true,
    opcoes: CATEGORIAS_DE_CLASSE.map((c) => ({ valor: c.chave, rotulo: c.rotulo })),
    ajuda: "É por ela que chegam a lição do trimestre e o pedido de revistas.",
  },
  {
    chave: "faixa",
    rotulo: "Faixa etária",
    placeholder: "ex.: 10 a 11 anos",
    ajuda: "Texto livre — aparece na chamada e na ficha da classe.",
  },
];

function camposAluno(opcoesClasse: Array<{ valor: string; rotulo: string }>): readonly CampoForm[] {
  return [
    { chave: "nome", rotulo: "Nome completo", obrigatorio: true, largo: true },
    {
      chave: "classeId",
      rotulo: "Classe",
      tipo: "lista",
      obrigatorio: true,
      opcoes: opcoesClasse,
    },
    { chave: "nasc", rotulo: "Data de nascimento", tipo: "data" },
    {
      chave: "posicao",
      rotulo: "Posição no ministério",
      tipo: "lista",
      opcoes: POSICOES.map((p) => ({ valor: p.chave, rotulo: p.rotulo })),
      ajuda: "Define o tratamento (Pr., Ev., Pb., Dc., Aux.). Não é cargo da EBD.",
    },
    { chave: "tel", rotulo: "Telefone", tipo: "telefone", placeholder: "(87) 9 9999-9999" },
    {
      chave: "resp",
      rotulo: "Responsável",
      largo: true,
      ajuda: "Para crianças e adolescentes — quem procurar em caso de necessidade.",
    },
  ];
}

function camposVisitante(opcoesClasse: Array<{ valor: string; rotulo: string }>): readonly CampoForm[] {
  return [
    { chave: "nome", rotulo: "Nome do visitante", obrigatorio: true, largo: true },
    { chave: "data", rotulo: "Data da visita", tipo: "data", obrigatorio: true },
    {
      chave: "classeId",
      rotulo: "Classe que visitou",
      tipo: "lista",
      opcoes: opcoesClasse,
      ajuda: "Deixe em branco se a pessoa não entrou em nenhuma sala.",
    },
    { chave: "nasc", rotulo: "Data de nascimento", tipo: "data" },
    {
      chave: "local",
      rotulo: "Onde mora",
      placeholder: "bairro, sítio ou povoado",
      ajuda: "Texto livre — a zona rural do campo não cabe numa lista de bairros.",
    },
    { chave: "tel", rotulo: "Telefone", tipo: "telefone", placeholder: "(87) 9 9999-9999" },
    { chave: "obs", rotulo: "Observação", tipo: "area", placeholder: "quem convidou, se quer retorno…" },
  ];
}
