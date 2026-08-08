"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cake, Check, GraduationCap, Phone, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo,
  CampoDeBusca,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
  Filtro,
} from "@/components/dashboard/PaginaModulo";
import { AcoesDoRegistro } from "@/components/crud/AcoesDoRegistro";
import { FormularioModal, type CampoForm } from "@/components/crud/FormularioModal";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { POSICOES, rotuloDaPosicao } from "@/lib/ebd/posicoes";
import { diaEMes, iniciais } from "@/lib/dashboard/formato";

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
  posicao: string | null;
  ativo: boolean;
  matriculadoEm: string | null;
  classe: { id: number; nome: string; faixa: string } | null;
  congregacao: { id: number; nome: string } | null;
}

interface ClasseOpcao {
  id: number;
  nome: string;
}

export default function AlunosPage() {
  const { podeGravar } = useAcesso();
  const podeMexer = podeGravar("alunos");

  const [busca, setBusca] = useState("");
  const [classe, setClasse] = useState<number | null>(null);
  const [itens, setItens] = useState<AlunoLista[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [classes, setClasses] = useState<ClasseOpcao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<AlunoLista | null>(null);
  const [recarga, setRecarga] = useState(0);

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
        // A resposta da exclusão diz se APAGOU ou apenas arquivou, e a tela
        // repete isso: responder "excluído" e deixar o aluno na lista de
        // inativos, sem avisar, ensina a não confiar no botão.
        if (dados.mensagem) setAviso(dados.mensagem);
        setRecarga((n) => n + 1);
      } catch {
        return "Sem resposta do servidor. Verifique a conexão.";
      }
    },
    [],
  );

  useEffect(() => {
    void fetch("/api/classes")
      .then((r) => r.json())
      .then((d) => setClasses((d.itens ?? []).map((c: ClasseOpcao) => ({ id: c.id, nome: c.nome }))))
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setErro(null);
        const url = new URL("/api/alunos", window.location.origin);
        if (busca.trim()) url.searchParams.set("busca", busca.trim());
        if (classe) url.searchParams.set("classe", String(classe));
        url.searchParams.set("porPagina", "200");

        const res = await fetch(url, { signal: controle.signal, cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        const dados = await res.json();
        setItens(dados.itens);
        setTotal(dados.total);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        /*
         * "O servidor não respondeu" era mentira quando ele respondia 500 — e
         * mandava procurar problema na internet, que estava perfeita. A
         * mensagem agora separa os dois casos: sem rede o `fetch` lança e não
         * há `status`; com resposta de erro, o problema está no banco.
         */
        const status = (e as { status?: number }).status;
        setErro(
          status
            ? "O servidor respondeu com erro. Isso costuma ser banco de dados não configurado — abra /api/diagnostico para ver o motivo."
            : "Sem resposta do servidor. Verifique a conexão e tente de novo.",
        );
        setItens([]);
      }
    }, 300);

    return () => {
      controle.abort();
      window.clearTimeout(t);
    };
  }, [busca, classe, recarga]);

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
          {podeMexer && (
            <Button size="sm" onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" />
              Novo aluno
            </Button>
          )}
        </div>
      </CabecalhoModulo>

      {aviso && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-[0.82rem] text-emerald-200">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{aviso}</span>
        </div>
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
        <AlunosPorClasse itens={itens} podeMexer={podeMexer} onEditar={setEmEdicao} gravar={gravar} />
      )}

      <FormularioModal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Novo aluno"
        descricao="A congregação vem da classe escolhida — não precisa informar."
        campos={camposDoAluno(classes, "criar")}
        valores={{
          nome: "",
          classeId: classe ? String(classe) : "",
          nasc: "",
          posicao: "",
          tel: "",
          resp: "",
          matriculadoEm: "",
        }}
        rotuloGravar="Matricular"
        aoGravar={(v) =>
          gravar("/api/alunos", "POST", {
            nome: v.nome,
            classeId: Number(v.classeId),
            nasc: v.nasc || null,
            posicao: v.posicao || null,
            tel: v.tel,
            resp: v.resp,
            // Em branco, o servidor grava HOJE — não manda nada. Só quando a
            // pessoa preenche uma data passada é que ela vale, para matricular
            // alguém que já frequentava a classe antes de ser cadastrado.
            matriculadoEm: v.matriculadoEm ? v.matriculadoEm : undefined,
          })
        }
      />

      <FormularioModal
        aberto={emEdicao !== null}
        aoFechar={() => setEmEdicao(null)}
        titulo="Editar aluno"
        campos={camposDoAluno(classes, "editar")}
        valores={{
          nome: emEdicao?.nome ?? "",
          classeId: emEdicao?.classe ? String(emEdicao.classe.id) : "",
          nasc: emEdicao?.nasc?.slice(0, 10) ?? "",
          posicao: emEdicao?.posicao ?? "",
          tel: emEdicao?.tel ?? "",
          resp: emEdicao?.resp ?? "",
          matriculadoEm: emEdicao?.matriculadoEm?.slice(0, 10) ?? "",
        }}
        aoGravar={(v) =>
          gravar(`/api/alunos/${emEdicao?.id}`, "PATCH", {
            nome: v.nome,
            classeId: Number(v.classeId),
            nasc: v.nasc || null,
            posicao: v.posicao || null,
            tel: v.tel,
            resp: v.resp,
            // Aqui, em branco LIMPA a restrição (vira matrícula antiga, sem
            // data) — a tela já mostra o valor atual preenchido, então apagar
            // é uma escolha, não um esquecimento.
            matriculadoEm: v.matriculadoEm || null,
          })
        }
      />
    </>
  );
}

/**
 * Os alunos, agrupados em caixinhas por classe.
 *
 * ============================================================================
 * "A LISTA CORRIDA" NÃO RESPONDIA "QUEM ESTÁ NA ADOLESCENTES" SEM ROLAR A TELA
 * INTEIRA CATANDO NOME POR NOME
 *
 * Uma classe é a unidade que a secretaria pensa — é nela que a chamada
 * acontece, é dela que sai o pedido de revista. Agrupar por classe, com o
 * nome da classe e a contagem no topo de cada caixinha, deixa a pergunta
 * "quem tem a Adolescentes?" respondida com um olhar, sem procurar.
 *
 * Um aluno sem classe (o cadastro tem alguns) cai numa caixinha própria,
 * "Sem classe" — nunca escondido, porque é exatamente o registro que precisa
 * de atenção.
 * ============================================================================
 */
function AlunosPorClasse({
  itens,
  podeMexer,
  onEditar,
  gravar,
}: {
  itens: AlunoLista[];
  podeMexer: boolean;
  onEditar: (a: AlunoLista) => void;
  gravar: (url: string, metodo: string, corpo: unknown) => Promise<string | void>;
}) {
  interface Grupo {
    chave: string;
    classeNome: string;
    faixa: string | null;
    congNome: string | null;
    alunos: AlunoLista[];
  }
  const porClasse = new Map<string, Grupo>();
  for (const a of itens) {
    const chave = a.classe ? String(a.classe.id) : "sem-classe";
    let g = porClasse.get(chave);
    if (!g) {
      g = {
        chave,
        classeNome: a.classe?.nome ?? "Sem classe",
        faixa: a.classe?.faixa || null,
        congNome: a.congregacao?.nome ?? null,
        alunos: [],
      };
      porClasse.set(chave, g);
    }
    g.alunos.push(a);
  }
  const grupos = [...porClasse.values()].sort((x, y) => {
    if (x.chave === "sem-classe") return 1;
    if (y.chave === "sem-classe") return -1;
    return x.classeNome.localeCompare(y.classeNome, "pt-BR");
  });

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      {grupos.map((g, gi) => (
        <motion.section
          key={g.chave}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: Math.min(gi, 12) * 0.035, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel overflow-hidden rounded-2xl"
        >
          <header className="flex items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-[0.86rem] font-semibold text-white">{g.classeNome}</h2>
              <p className="truncate text-[0.7rem] text-brand-200/50">
                {g.congNome}
                {g.faixa && <span> · {g.faixa}</span>}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white/8 px-2.5 py-1 text-[0.72rem] tabular-nums text-brand-100/80">
              {g.alunos.length}
            </span>
          </header>

          <ul className="divide-y divide-white/6">
            {g.alunos.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-2.5 px-4 py-2.5 transition-colors duration-300 hover:bg-white/[0.03]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-white/12">
                  <span className="font-display text-[0.6rem] font-semibold tracking-wider text-brand-50">
                    {iniciais(a.nome)}
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.84rem] text-brand-50">{a.nome}</p>
                  {a.resp && <p className="truncate text-[0.68rem] text-brand-200/40">Resp.: {a.resp}</p>}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {a.nasc && (
                    <span className="hidden items-center gap-1 text-[0.7rem] text-brand-200/50 md:flex">
                      <Cake className="h-3 w-3" />
                      {diaEMes(new Date(a.nasc))}
                    </span>
                  )}
                  {a.tel && (
                    <span className="hidden items-center gap-1 text-[0.7rem] tabular-nums text-brand-200/55 lg:flex">
                      <Phone className="h-3 w-3" />
                      {a.tel}
                    </span>
                  )}
                  {a.posicao && <Badge variant="alerta">{rotuloDaPosicao(a.posicao)}</Badge>}

                  {podeMexer && (
                    <AcoesDoRegistro
                      nome={a.nome}
                      onEditar={() => onEditar(a)}
                      onExcluir={async () => {
                        await gravar(`/api/alunos/${a.id}`, "DELETE", {});
                      }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </motion.section>
      ))}
    </div>
  );
}

/**
 * Os campos do cadastro de aluno.
 *
 * É uma função, e não uma constante, porque a lista de classes só existe depois
 * que o servidor responde. Uma constante montada na carga do módulo teria o
 * seletor de classe permanentemente vazio.
 */
function camposDoAluno(classes: ClasseOpcao[], modo: "criar" | "editar"): readonly CampoForm[] {
  return [
    { chave: "nome", rotulo: "Nome completo", obrigatorio: true, largo: true },
    {
      chave: "classeId",
      rotulo: "Classe",
      tipo: "lista",
      obrigatorio: true,
      opcoes: classes.map((c) => ({ valor: String(c.id), rotulo: c.nome })),
      ajuda: "A congregação do aluno acompanha a classe.",
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
    /*
     * A Chamada só deixa marcar presença/falta a partir desta data. Serve
     * para o caso do professor que esqueceu de cadastrar um aluno que já
     * frequentava a classe há tempo: sem poder corrigir esta data, o aluno
     * ficaria fora da lista de todos os domingos passados que já viveu de
     * verdade, mesmo depois de cadastrado.
     */
    modo === "criar"
      ? {
          chave: "matriculadoEm",
          rotulo: "Matriculado em",
          tipo: "data",
          ajuda:
            "Em branco, a matrícula começa hoje. Só preencha com uma data passada se este aluno já " +
            "frequentava a classe antes de ser cadastrado — assim ele entra na chamada desde essa data.",
        }
      : {
          chave: "matriculadoEm",
          rotulo: "Matriculado em",
          tipo: "data",
          ajuda:
            "Em branco, a matrícula fica sem restrição de data (como um cadastro antigo). Preencha ou " +
            "corrija se o aluno já frequentava a classe antes desta data.",
        },
  ];
}
