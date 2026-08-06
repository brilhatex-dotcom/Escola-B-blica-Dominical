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
        <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
          {itens.map((a, i) => (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i, 20) * 0.02, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-300 hover:bg-white/[0.03]"
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
                {/*
                  A posição no ministério vem ANTES da faixa etária.
                  "Pb." e "Dc." mudam como a pessoa é tratada na igreja; a faixa
                  etária é atributo da classe, não dela.
                */}
                {a.posicao && <Badge variant="alerta">{rotuloDaPosicao(a.posicao)}</Badge>}
                {a.classe?.faixa && <Badge variant="info">{a.classe.faixa}</Badge>}

                {podeMexer && (
                  <AcoesDoRegistro
                    nome={a.nome}
                    onEditar={() => setEmEdicao(a)}
                    onExcluir={async () => {
                      await gravar(`/api/alunos/${a.id}`, "DELETE", {});
                    }}
                  />
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      <FormularioModal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Novo aluno"
        descricao="A congregação vem da classe escolhida — não precisa informar."
        campos={camposDoAluno(classes)}
        valores={{ nome: "", classeId: classe ? String(classe) : "", nasc: "", posicao: "", tel: "", resp: "" }}
        rotuloGravar="Matricular"
        aoGravar={(v) =>
          gravar("/api/alunos", "POST", {
            nome: v.nome,
            classeId: Number(v.classeId),
            nasc: v.nasc || null,
            posicao: v.posicao || null,
            tel: v.tel,
            resp: v.resp,
          })
        }
      />

      <FormularioModal
        aberto={emEdicao !== null}
        aoFechar={() => setEmEdicao(null)}
        titulo="Editar aluno"
        campos={camposDoAluno(classes)}
        valores={{
          nome: emEdicao?.nome ?? "",
          classeId: emEdicao?.classe ? String(emEdicao.classe.id) : "",
          nasc: emEdicao?.nasc?.slice(0, 10) ?? "",
          posicao: emEdicao?.posicao ?? "",
          tel: emEdicao?.tel ?? "",
          resp: emEdicao?.resp ?? "",
        }}
        aoGravar={(v) =>
          gravar(`/api/alunos/${emEdicao?.id}`, "PATCH", {
            nome: v.nome,
            classeId: Number(v.classeId),
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

/**
 * Os campos do cadastro de aluno.
 *
 * É uma função, e não uma constante, porque a lista de classes só existe depois
 * que o servidor responde. Uma constante montada na carga do módulo teria o
 * seletor de classe permanentemente vazio.
 */
function camposDoAluno(classes: ClasseOpcao[]): readonly CampoForm[] {
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
  ];
}
