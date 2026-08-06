"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, MapPin, Phone, Plus, UserRoundPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
  Filtro,
} from "@/components/dashboard/PaginaModulo";
import { AcoesDoRegistro } from "@/components/crud/AcoesDoRegistro";
import { FormularioModal, type CampoForm } from "@/components/crud/FormularioModal";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { diaEMes, iniciais } from "@/lib/dashboard/formato";

/**
 * Visitantes recebidos.
 *
 * Ordenados do mais recente para o mais antigo: quem abre esta tela quer saber
 * quem veio no ultimo domingo, para dar retorno na semana. A lista historica
 * completa e assunto do modulo de Relatorios.
 */

interface VisitanteLista {
  id: number;
  nome: string;
  idade: number | null;
  nasc: string | null;
  local: string | null;
  /** Calculada no servidor: da data de nascimento, ou da idade herdada. */
  anos: number | null;
  tel: string | null;
  obs: string | null;
  data: string;
  classe: { id: number; nome: string } | null;
  congregacao: { id: number; nome: string } | null;
}

export default function VisitantesPage() {
  const { podeGravar } = useAcesso();
  const podeMexer = podeGravar("visitantes");

  const [aviso, setAviso] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<VisitanteLista | null>(null);
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
        if (dados.mensagem) setAviso(dados.mensagem);
        setRecarga((n) => n + 1);
      } catch {
        return "Sem resposta do servidor. Verifique a conexão.";
      }
    },
    [],
  );

  const [classe, setClasse] = useState<number | null>(null);
  const [classes, setClasses] = useState<Array<{ id: number; nome: string }>>([]);
  const [itens, setItens] = useState<VisitanteLista[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/classes")
      .then((r) => r.json())
      .then((d) =>
        setClasses((d.itens ?? []).map((c: { id: number; nome: string }) => ({ id: c.id, nome: c.nome }))),
      )
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        setErro(null);
        const url = new URL("/api/visitantes", window.location.origin);
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
    })();
    return () => controle.abort();
  }, [classe, recarga]);

  return (
    <>
      <CabecalhoModulo
        icone={UserRoundPlus}
        titulo="Visitantes"
        descricao="Recebidos na Escola Bíblica, do mais recente ao mais antigo"
        total={total}
      >
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Filtro rotulo="Classe" opcoes={classes} valor={classe} aoMudar={setClasse} />
          {podeMexer && (
            <Button size="sm" onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" />
              Novo visitante
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
          mensagem="Nenhum visitante registrado nesta seleção."
          dica="Os visitantes são cadastrados durante a chamada de domingo."
        />
      ) : (
        <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
          {itens.map((v, i) => (
            <motion.li
              key={v.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i, 20) * 0.02, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-300 hover:bg-white/[0.03]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400/15 ring-1 ring-gold-400/25">
                <span className="font-display text-[0.68rem] font-semibold tracking-wider text-gold-100">
                  {iniciais(v.nome)}
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.88rem] text-brand-50">{v.nome}</p>
                <p className="truncate text-[0.74rem] text-brand-200/55">
                  {v.classe?.nome ?? "Sem classe"}
                  {v.congregacao?.nome && (
                    <span className="text-brand-200/40"> · {v.congregacao.nome}</span>
                  )}
                </p>
                {v.obs && <p className="truncate text-[0.7rem] italic text-brand-200/40">{v.obs}</p>}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {v.tel && (
                  <span className="hidden items-center gap-1.5 text-[0.74rem] tabular-nums text-brand-200/55 sm:flex">
                    <Phone className="h-3 w-3" />
                    {v.tel}
                  </span>
                )}
                {v.local && (
                  <span className="hidden max-w-[10rem] items-center gap-1.5 truncate text-[0.74rem] text-brand-200/55 md:flex">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{v.local}</span>
                  </span>
                )}
                {/*
                  `anos` vem calculado do servidor porque a fonte muda conforme a
                  época do registro: nos visitantes novos sai da data de
                  nascimento; nos 89 herdados, do número solto que a planilha
                  trazia. A tela não precisa saber de qual dos dois veio.
                */}
                {v.anos !== null && <Badge variant="neutro">{v.anos} anos</Badge>}
                <span className="w-16 shrink-0 text-right text-[0.74rem] tabular-nums text-brand-200/55">
                  {diaEMes(new Date(v.data))}
                </span>

                {podeMexer && (
                  <AcoesDoRegistro
                    nome={v.nome}
                    onEditar={() => setEmEdicao(v)}
                    aviso={`${v.nome} será excluído definitivamente. Visitante não tem histórico ligado, então não há o que arquivar.`}
                    onExcluir={async () => {
                      await gravar(`/api/visitantes/${v.id}`, "DELETE", {});
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
        titulo="Novo visitante"
        descricao="A congregação vem da classe escolhida."
        campos={camposDoVisitante(classes)}
        valores={{
          nome: "",
          classeId: classe ? String(classe) : "",
          data: hojeCivil(),
          nasc: "",
          local: "",
          tel: "",
          obs: "",
        }}
        rotuloGravar="Registrar"
        aoGravar={(v) =>
          gravar("/api/visitantes", "POST", {
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
        aberto={emEdicao !== null}
        aoFechar={() => setEmEdicao(null)}
        titulo="Editar visitante"
        campos={camposDoVisitante(classes).filter((c) => c.chave !== "classeId" && c.chave !== "data")}
        valores={{
          nome: emEdicao?.nome ?? "",
          nasc: emEdicao?.nasc?.slice(0, 10) ?? "",
          local: emEdicao?.local ?? "",
          tel: emEdicao?.tel ?? "",
          obs: emEdicao?.obs ?? "",
        }}
        aoGravar={(v) =>
          gravar(`/api/visitantes/${emEdicao?.id}`, "PATCH", {
            nome: v.nome,
            nasc: v.nasc || null,
            local: v.local,
            tel: v.tel,
            obs: v.obs,
          })
        }
      />
    </>
  );
}

/**
 * Hoje, no fuso do aparelho.
 *
 * Calculado no cliente, e não no servidor: o servidor roda em UTC, num data
 * center, e às 22h de um sábado em Recife ele já está no domingo — o visitante
 * de sábado seria registrado no dia seguinte.
 */
function hojeCivil(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function camposDoVisitante(classes: Array<{ id: number; nome: string }>): readonly CampoForm[] {
  return [
    { chave: "nome", rotulo: "Nome do visitante", obrigatorio: true, largo: true },
    { chave: "data", rotulo: "Data da visita", tipo: "data", obrigatorio: true },
    {
      chave: "classeId",
      rotulo: "Classe que visitou",
      tipo: "lista",
      opcoes: classes.map((c) => ({ valor: String(c.id), rotulo: c.nome })),
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
