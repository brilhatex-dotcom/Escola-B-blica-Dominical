"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Phone, Trash2, UserRoundPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
  Filtro,
} from "@/components/dashboard/PaginaModulo";
import { diaEMes, iniciais } from "@/lib/dashboard/formato";
import { useAcesso } from "@/components/acesso/AcessoProvider";

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
  tel: string | null;
  obs: string | null;
  nascimento: string | null;
  endereco: string | null;
  data: string;
  classe: { id: number; nome: string } | null;
  congregacao: { id: number; nome: string } | null;
}

export default function VisitantesPage() {
  const [classe, setClasse] = useState<number | null>(null);
  const [classes, setClasses] = useState<Array<{ id: number; nome: string }>>([]);
  const [itens, setItens] = useState<VisitanteLista[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<number | null>(null);
  const { podeGravar } = useAcesso();
  const editavel = podeGravar("visitantes");

  useEffect(() => {
    void fetch("/api/classes")
      .then((r) => r.json())
      .then((d) =>
        setClasses((d.itens ?? []).map((c: { id: number; nome: string }) => ({ id: c.id, nome: c.nome }))),
      )
      .catch(() => setClasses([]));
  }, []);

  async function carregar() {
    try {
      setErro(null);
      const url = new URL("/api/visitantes", window.location.origin);
      if (classe) url.searchParams.set("classe", String(classe));
      url.searchParams.set("porPagina", "200");
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const dados = await res.json();
      setItens(dados.itens);
      setTotal(dados.total);
    } catch (e) {
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
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classe]);

  async function remover(v: VisitanteLista) {
    if (!window.confirm(`Remover o visitante "${v.nome}"?`)) return;
    setRemovendo(v.id);
    try {
      const res = await fetch(`/api/visitantes?id=${v.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Não foi possível remover.");
      setItens((atual) => (atual ? atual.filter((it) => it.id !== v.id) : atual));
      setTotal((t) => (t !== null ? t - 1 : t));
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setRemovendo(null);
    }
  }

  return (
    <>
      <CabecalhoModulo
        icone={UserRoundPlus}
        titulo="Visitantes"
        descricao="Recebidos na Escola Bíblica, do mais recente ao mais antigo"
        total={total}
      >
        <Filtro rotulo="Classe" opcoes={classes} valor={classe} aoMudar={setClasse} />
      </CabecalhoModulo>

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
                  {v.endereco && <span className="text-brand-200/40"> · {v.endereco}</span>}
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
                {v.nascimento && (
                  <span className="hidden text-[0.72rem] tabular-nums text-brand-200/50 sm:inline">
                    nasc. {diaEMes(new Date(v.nascimento))}
                  </span>
                )}
                {v.idade !== null && <Badge variant="neutro">{v.idade} anos</Badge>}
                <span className="w-16 shrink-0 text-right text-[0.74rem] tabular-nums text-brand-200/55">
                  {diaEMes(new Date(v.data))}
                </span>
                {editavel && (
                  <button
                    type="button"
                    onClick={() => void remover(v)}
                    disabled={removendo === v.id}
                    aria-label={`Remover ${v.nome}`}
                    className="rounded-lg p-1.5 text-brand-200/45 hover:bg-white/8 hover:text-flame-400"
                  >
                    {removendo === v.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </>
  );
}
