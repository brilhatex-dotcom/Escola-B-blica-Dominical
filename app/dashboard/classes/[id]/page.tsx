"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  Check,
  GraduationCap,
  Phone,
  Plus,
  School,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CabecalhoModulo, EsqueletoLista, EstadoErro } from "@/components/dashboard/PaginaModulo";
import { AcoesDoRegistro } from "@/components/crud/AcoesDoRegistro";
import { FormularioModal, type CampoForm } from "@/components/crud/FormularioModal";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { CATEGORIAS_DE_CLASSE, faixaSugerida, rotuloDaCategoria } from "@/lib/ebd/categorias";
import { idadeEm } from "@/lib/ebd/idade";
import { POSICOES, nomeComTratamento, rotuloDaPosicao } from "@/lib/ebd/posicoes";
import { diaEMes, iniciais } from "@/lib/dashboard/formato";

/**
 * A classe por dentro.
 *
 * ============================================================================
 * AS TRÊS PERGUNTAS QUE ESTA TELA RESPONDE
 *
 *   quem dá a aula   · os professores, do cadastro de pessoas
 *   quem são os alunos · a lista, com idade e situação
 *   para que idade   · a categoria e a faixa etária
 *
 * Eram três lugares diferentes no sistema antigo, e nenhum deles respondia a
 * terceira: a faixa etária existia como texto solto, sem ligação com a
 * categoria que define a lição e a revista da classe.
 * ============================================================================
 *
 * Os botões de criar, editar e excluir ficam VISÍVEIS desde a abertura, e não
 * escondidos atrás de um menu de três pontinhos. Quem abre a classe vem
 * justamente para mexer nela; esconder a ação principal atrás de mais um clique
 * é cobrar pedágio no caminho mais usado.
 */

interface AlunoDaClasse {
  id: number;
  nome: string;
  nasc: string | null;
  tel: string | null;
  resp: string | null;
  posicao: string | null;
  ativo: boolean;
  presencas: number;
}

interface Professor {
  vinculoId: number;
  id: number;
  nome: string;
  tratamento: string | null;
  tel: string | null;
}

interface DetalheClasse {
  id: number;
  nome: string;
  faixa: string;
  tipoClasse: string;
  ativa: boolean;
  profOriginal: string | null;
  congregacao: { id: number; nome: string } | null;
  professores: Professor[];
  outrosCargos: Array<Professor & { cargo: string }>;
  alunos: AlunoDaClasse[];
  ativos: number;
  ultimaChamada: string | null;
}

const CAMPOS_ALUNO: readonly CampoForm[] = [
  { chave: "nome", rotulo: "Nome completo", obrigatorio: true, largo: true },
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

export default function ClasseDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { podeGravar } = useAcesso();
  const podeMexer = podeGravar("classes");
  const podeMexerEmAlunos = podeGravar("alunos");

  const [classe, setClasse] = useState<DetalheClasse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [editandoClasse, setEditandoClasse] = useState(false);
  const [alunoEmEdicao, setAlunoEmEdicao] = useState<AlunoDaClasse | null>(null);
  const [criandoAluno, setCriandoAluno] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const res = await fetch(`/api/classes/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setClasse(await res.json());
    } catch {
      setErro("Não foi possível carregar esta classe. Talvez ela não exista ou não seja sua.");
      setClasse(null);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Manda ao servidor e recarrega. Devolve a mensagem de erro, se houver. */
  const gravar = useCallback(
    async (url: string, metodo: string, corpo: unknown): Promise<string | void> => {
      try {
        const res = await fetch(url, {
          method: metodo,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        });
        const dados = await res.json().catch(() => ({}));
        if (!res.ok) return dados.erro ?? "Não foi possível salvar.";
        if (dados.mensagem) setAviso(dados.mensagem);
        await carregar();
      } catch {
        return "Sem resposta do servidor. Verifique a conexão.";
      }
    },
    [carregar],
  );

  if (erro) {
    return (
      <>
        <VoltarParaClasses />
        <EstadoErro mensagem={erro} />
      </>
    );
  }

  if (!classe) {
    return (
      <>
        <VoltarParaClasses />
        <EsqueletoLista linhas={6} />
      </>
    );
  }

  const categoria = rotuloDaCategoria(classe.tipoClasse);

  return (
    <>
      <VoltarParaClasses />

      <CabecalhoModulo
        icone={School}
        titulo={classe.nome}
        descricao={`${categoria}${classe.congregacao ? ` · ${classe.congregacao.nome}` : ""}`}
      >
        {podeMexer && (
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="ghost" size="sm" onClick={() => setEditandoClasse(true)}>
              Editar classe
            </Button>
            {podeMexerEmAlunos && (
              <Button size="sm" onClick={() => setCriandoAluno(true)}>
                <Plus className="h-4 w-4" />
                Matricular aluno
              </Button>
            )}
          </div>
        )}
      </CabecalhoModulo>

      {aviso && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-[0.82rem] text-emerald-200">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {!classe.ativa && (
        <Alert tipo="alerta" titulo="Classe desativada" className="mb-4">
          Ela não aparece na chamada nem nas listas do dia a dia. O histórico dela
          continua valendo nos relatórios.
        </Alert>
      )}

      {/* ---------------- Ficha ---------------- */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Ficha icone={GraduationCap} rotulo="Faixa etária">
          {classe.faixa || (
            <span className="text-brand-200/45">
              não informada — sugerida: {faixaSugerida(classe.tipoClasse) || "—"}
            </span>
          )}
        </Ficha>
        <Ficha icone={BookOpen} rotulo="Categoria">
          {categoria}
        </Ficha>
        <Ficha icone={UserRound} rotulo="Alunos ativos">
          {classe.ativos}
          {classe.alunos.length !== classe.ativos && (
            <span className="text-brand-200/45"> de {classe.alunos.length}</span>
          )}
        </Ficha>
        <Ficha icone={CalendarCheck} rotulo="Última chamada">
          {classe.ultimaChamada ? (
            diaEMes(new Date(classe.ultimaChamada))
          ) : (
            <span className="text-brand-200/45">nenhuma ainda</span>
          )}
        </Ficha>
      </div>

      {/* ---------------- Professores ---------------- */}
      <section className="glass-panel mb-4 rounded-2xl p-4">
        <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
          Quem dá a aula
        </h2>

        {classe.professores.length === 0 && classe.outrosCargos.length === 0 ? (
          <p className="text-[0.84rem] text-brand-200/55">
            Nenhum professor registrado para esta classe.
            {classe.profOriginal && (
              <>
                {" "}
                No sistema antigo estava escrito{" "}
                <span className="text-brand-100">“{classe.profOriginal}”</span> — o texto foi
                mantido, mas ninguém do cadastro de pessoas foi ligado a ele ainda.
              </>
            )}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {/*
              O cargo é resolvido AQUI, e não no JSX.
              Os professores vêm sem o campo `cargo` (ele é implícito) e os
              demais vêm com ele. Testar isso no meio da marcação obrigaria a
              conferir o formato duas vezes por linha, e é o tipo de coisa que
              silencia quando um dos dois lados muda.
            */}
            {[
              ...classe.professores.map((p) => ({ ...p, cargo: "Professor" })),
              ...classe.outrosCargos,
            ].map((p) => (
              <li
                key={p.vinculoId}
                className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-white/12">
                  <span className="font-display text-[0.6rem] font-semibold tracking-wider text-brand-50">
                    {iniciais(p.nome)}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.84rem] text-brand-50">
                    {[p.tratamento, p.nome].filter(Boolean).join(" ")}
                  </span>
                  <span className="block truncate text-[0.7rem] text-brand-200/50">
                    {p.cargo}
                    {p.tel && ` · ${p.tel}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/*
          Trocar professor é alteração de CARGO, e o lugar disso é a Liderança —
          a mesma fonte que decide o acesso da pessoa ao portal. Um segundo
          lugar para atribuir professor faria as duas telas discordarem, e o
          organograma passaria a mentir sobre quem dá aula onde.
        */}
        <p className="mt-3 border-t border-white/6 pt-3 text-[0.72rem] leading-relaxed text-brand-200/45">
          Para trocar quem dá aula nesta classe, altere o cargo da pessoa em{" "}
          <Link
            href="/dashboard/configuracoes"
            className="text-gold-200/80 underline-offset-2 hover:underline"
          >
            Administração → Liderança
          </Link>
          . É a mesma informação que define o acesso dela ao portal — por isso mora
          num lugar só.
        </p>
      </section>

      {/* ---------------- Alunos ---------------- */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand-200/50">
            Alunos matriculados
          </h2>
          {classe.alunos.length > 0 && (
            <span className="text-[0.72rem] text-brand-200/45">
              {classe.alunos.length} {classe.alunos.length === 1 ? "aluno" : "alunos"}
            </span>
          )}
        </div>

        {classe.alunos.length === 0 ? (
          <div className="glass-panel rounded-2xl px-6 py-10 text-center">
            <p className="text-[0.9rem] text-brand-100/80">Esta classe ainda não tem alunos.</p>
            {podeMexerEmAlunos && (
              <Button className="mt-4" size="sm" onClick={() => setCriandoAluno(true)}>
                <Plus className="h-4 w-4" />
                Matricular o primeiro
              </Button>
            )}
          </div>
        ) : (
          <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
            {classe.alunos.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i, 20) * 0.015 }}
                className={cn(
                  "flex flex-wrap items-center gap-3 px-4 py-2.5",
                  !a.ativo && "opacity-50",
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-white/12">
                  <span className="font-display text-[0.62rem] font-semibold tracking-wider text-brand-50">
                    {iniciais(a.nome)}
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.86rem] text-brand-50">
                    {nomeComTratamento(a.nome, a.posicao)}
                  </p>
                  <p className="truncate text-[0.72rem] text-brand-200/50">
                    {a.nasc ? `${idadeEm(a.nasc)} anos` : "idade não informada"}
                    {a.posicao && ` · ${rotuloDaPosicao(a.posicao)}`}
                    {a.resp && ` · resp. ${a.resp}`}
                    {!a.ativo && " · arquivado"}
                  </p>
                </div>

                {a.tel && (
                  <span className="hidden items-center gap-1.5 text-[0.74rem] text-brand-200/55 sm:flex">
                    <Phone className="h-3.5 w-3.5" />
                    {a.tel}
                  </span>
                )}

                <Badge variant="neutro">{a.presencas} presenças</Badge>

                {podeMexerEmAlunos && (
                  <AcoesDoRegistro
                    nome={a.nome}
                    onEditar={() => setAlunoEmEdicao(a)}
                    aviso={
                      a.presencas > 0
                        ? `${a.nome} tem ${a.presencas} presenças registradas. Por isso ele será arquivado, e não apagado — os relatórios dos meses anteriores continuam corretos.`
                        : undefined
                    }
                    onExcluir={async () => {
                      await gravar(`/api/alunos/${a.id}`, "DELETE", {});
                    }}
                  />
                )}
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- Formulários ---------------- */}
      <FormularioModal
        aberto={editandoClasse}
        aoFechar={() => setEditandoClasse(false)}
        titulo="Editar classe"
        descricao="A categoria define qual lição e qual revista esta classe recebe."
        campos={[
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
            placeholder: faixaSugerida(classe.tipoClasse),
            ajuda: "Texto livre — aparece na chamada e na ficha da classe.",
          },
        ]}
        valores={{
          nome: classe.nome,
          tipoClasse: classe.tipoClasse,
          faixa: classe.faixa,
        }}
        aoGravar={(v) =>
          gravar(`/api/classes/${classe.id}`, "PATCH", {
            nome: v.nome,
            tipoClasse: v.tipoClasse,
            faixa: v.faixa,
          })
        }
      />

      <FormularioModal
        aberto={criandoAluno}
        aoFechar={() => setCriandoAluno(false)}
        titulo="Matricular aluno"
        descricao={`Ele entra direto na classe ${classe.nome}.`}
        campos={CAMPOS_ALUNO}
        valores={{ nome: "", nasc: "", posicao: "", tel: "", resp: "" }}
        rotuloGravar="Matricular"
        aoGravar={(v) =>
          gravar("/api/alunos", "POST", {
            nome: v.nome,
            nasc: v.nasc || null,
            posicao: v.posicao || null,
            tel: v.tel,
            resp: v.resp,
            classeId: classe.id,
          })
        }
      />

      <FormularioModal
        aberto={alunoEmEdicao !== null}
        aoFechar={() => setAlunoEmEdicao(null)}
        titulo="Editar aluno"
        campos={CAMPOS_ALUNO}
        valores={{
          nome: alunoEmEdicao?.nome ?? "",
          nasc: alunoEmEdicao?.nasc?.slice(0, 10) ?? "",
          posicao: alunoEmEdicao?.posicao ?? "",
          tel: alunoEmEdicao?.tel ?? "",
          resp: alunoEmEdicao?.resp ?? "",
        }}
        aoGravar={(v) =>
          gravar(`/api/alunos/${alunoEmEdicao?.id}`, "PATCH", {
            nome: v.nome,
            nasc: v.nasc || null,
            posicao: v.posicao || null,
            tel: v.tel,
            resp: v.resp,
          })
        }
      />
    </>
  );
}

function VoltarParaClasses() {
  return (
    <Link
      href="/dashboard/classes"
      className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] text-brand-200/60 transition-colors duration-300 hover:text-gold-200"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Todas as classes
    </Link>
  );
}

function Ficha({
  icone: Icone,
  rotulo,
  children,
}: {
  icone: typeof School;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel rounded-2xl p-3.5">
      <span className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.12em] text-brand-200/45">
        <Icone className="h-3.5 w-3.5 text-gold-300/70" />
        {rotulo}
      </span>
      <p className="mt-1.5 truncate text-[0.92rem] text-brand-50">{children}</p>
    </div>
  );
}
