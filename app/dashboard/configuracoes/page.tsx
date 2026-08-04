"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown, Loader2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo,
  EsqueletoLista,
  EstadoErro,
} from "@/components/dashboard/PaginaModulo";
import { iniciais } from "@/lib/dashboard/formato";
import type { Lider } from "@/lib/dashboard/tipos";

/**
 * Configurações — edição da Liderança do Campo.
 *
 * É esta tela que cumpre a exigência de que o card institucional fosse
 * "preparado para edição futura através do painel administrativo, sem
 * necessidade de alterar o código". Trocar o Supervisor da EBD passa a ser uma
 * escolha numa lista.
 *
 * A LISTA DE CANDIDATOS SAO AS PESSOAS JA CADASTRADAS, e não um campo de texto
 * livre. Digitar o nome à mão foi exatamente o que produziu "Ana costa", "Ana
 * maria da costa" e "Ana Maria costa" no sistema antigo — três linhas para uma
 * pessoa. Aqui só se escolhe quem já existe; se a pessoa não estiver na lista,
 * ela precisa ser cadastrada antes, e aí passa pela chave única.
 */

interface PessoaOpcao {
  id: number;
  nome: string;
  tratamento: string | null;
}

export default function ConfiguracoesPage() {
  const [lideranca, setLideranca] = useState<Lider[] | null>(null);
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [salvando, setSalvando] = useState<number | null>(null);
  const [salvo, setSalvo] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    try {
      setErro(null);
      const [l, p] = await Promise.all([
        fetch("/api/lideranca", { cache: "no-store" }).then((r) => {
          if (!r.ok) throw Object.assign(new Error(), { status: r.status });
          return r.json();
        }),
        fetch("/api/pessoas?porPagina=200", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setLideranca(l.itens);
      setPessoas(
        (p.itens ?? []).map((x: PessoaOpcao) => ({
          id: x.id,
          nome: x.nome,
          tratamento: x.tratamento,
        })),
      );
    } catch (e) {
      const status = (e as { status?: number }).status;
      setErro(
        status
          ? "O servidor respondeu com erro. Abra /api/diagnostico para ver o motivo."
          : "Sem resposta do servidor. Verifique a conexão.",
      );
      setLideranca([]);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function trocar(cargoId: number, pessoaId: number | null) {
    setSalvando(cargoId);
    setSalvo(null);
    try {
      const res = await fetch("/api/lideranca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cargoId, pessoaId }),
      });
      if (!res.ok) throw new Error();
      await carregar();
      setSalvo(cargoId);
      window.setTimeout(() => setSalvo(null), 2500);
    } catch {
      setErro("Não foi possível gravar a alteração.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <>
      <CabecalhoModulo
        icone={Settings}
        titulo="Configurações"
        descricao="Liderança do campo e parâmetros do sistema"
      />

      {erro && <EstadoErro mensagem={erro} />}

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel overflow-hidden rounded-2xl"
      >
        <header className="border-b border-white/8 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 shrink-0 text-gold-300" />
            <h2 className="font-display text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-white">
              Liderança do Campo
            </h2>
          </div>
          <p className="mt-1 text-[0.74rem] leading-relaxed text-brand-200/55">
            A alteração vale na hora, e o card do Dashboard passa a mostrar o novo nome.
            O vínculo anterior não é apagado — fica registrado com a data em que a pessoa
            deixou a função.
          </p>
        </header>

        {lideranca === null ? (
          <EsqueletoLista linhas={5} />
        ) : (
          <ul className="divide-y divide-white/6">
            {lideranca.map((l) => (
              <li key={l.cargoId} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1",
                    l.nome
                      ? "bg-gradient-to-br from-brand-500 to-brand-700 ring-white/12"
                      : "border border-dashed border-white/15 bg-white/[0.03] ring-white/8",
                  )}
                >
                  {l.nome ? (
                    <span className="font-display text-[0.7rem] font-semibold tracking-wider text-brand-50">
                      {iniciais(l.nome)}
                    </span>
                  ) : (
                    <span className="text-[0.7rem] text-brand-200/35">—</span>
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[0.7rem] uppercase tracking-[0.14em] text-gold-300/75">
                    {l.cargo}
                  </p>
                  <p
                    className={cn(
                      "truncate text-[0.88rem]",
                      l.nome ? "text-white" : "italic text-brand-200/45",
                    )}
                  >
                    {l.nome ? (
                      <>
                        {l.tratamento && (
                          <span className="text-gold-200/85">{l.tratamento} </span>
                        )}
                        {l.nome}
                      </>
                    ) : (
                      "Cargo vago"
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {salvo === l.cargoId && (
                    <span className="flex items-center gap-1 text-[0.74rem] text-emerald-300">
                      <Check className="h-3.5 w-3.5" />
                      salvo
                    </span>
                  )}
                  {salvando === l.cargoId && (
                    <Loader2 className="h-4 w-4 animate-spin text-brand-200" />
                  )}
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]">
                    <span className="sr-only">Quem ocupa {l.cargo}</span>
                    <select
                      value={l.pessoaId ?? ""}
                      disabled={salvando !== null}
                      onChange={(e) =>
                        trocar(l.cargoId, e.target.value ? Number(e.target.value) : null)
                      }
                      className="min-w-[11rem] bg-transparent text-brand-50 focus:outline-none disabled:opacity-50 [&>option]:bg-brand-900"
                    >
                      <option value="">— deixar vago —</option>
                      {pessoas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {[p.tratamento, p.nome].filter(Boolean).join(" ")}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {/*
        O que ainda NAO da para configurar por aqui fica dito, e nao escondido.
        Uma tela de configuracoes com um unico bloco parece inacabada; dizendo o
        que vem, ela vira um mapa.
      */}
      <div className="glass-panel mt-4 rounded-2xl px-5 py-4">
        <h2 className="font-display text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-brand-100/70">
          Ainda não configurável por aqui
        </h2>
        <ul className="mt-2 space-y-1 text-[0.8rem] text-brand-200/55">
          <li>· Usuários e permissões — depende da autenticação real</li>
          <li>· Preços de revistas e parâmetros — hoje editados direto no banco</li>
          <li>· Cadastro de cargos novos — a lista atual cobre a estrutura do campo</li>
        </ul>
      </div>
    </>
  );
}
