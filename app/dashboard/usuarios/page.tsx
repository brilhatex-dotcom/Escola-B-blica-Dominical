"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Building2, CircleHelp, ShieldCheck, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  CabecalhoModulo,
  CampoDeBusca,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { iniciais } from "@/lib/dashboard/formato";
import type { Escopo, Papel } from "@/lib/auth/papeis";

/**
 * Usuários — as contas de acesso do portal.
 *
 * ============================================================================
 * A TELA NÃO EDITA O PAPEL, E ISSO É A ARQUITETURA, NÃO UMA FALTA
 *
 * O papel de cada conta vem do CARGO que a pessoa ocupa. Quem quiser mudar o
 * acesso de alguém muda o cargo, em Administração → Liderança, que é onde a
 * igreja já registra quem faz o quê.
 *
 * Um seletor de papel aqui criaria um segundo lugar dizendo a mesma coisa — e
 * dois lugares divergem: a pessoa deixa de ser Dirigente no organograma e
 * continua Dirigente no acesso, porque ninguém lembrou da outra tela. O
 * organograma da igreja passaria a mentir sobre o próprio sistema.
 * ============================================================================
 *
 * O que esta tela faz de essencial é EXPOR o palpite. As 19 contas herdadas não
 * são pessoas — são contas de congregação ("Cong. Pinheiro", "T. Matriz") —, e
 * enquanto ninguém disser quem responde por cada uma, o portal deduz o alcance
 * a partir da planilha. Cada dedução aparece marcada, uma por uma.
 */

interface Conta {
  id: number;
  nome: string;
  login: string;
  ativo: boolean;
  perfilHerdado: string;
  congregacao: { id: number; nome: string } | null;
  pessoa: { id: number; nome: string; tratamento: string | null } | null;
  papel: Papel | null;
  papelRotulo: string;
  papeis: Papel[];
  escopo: Escopo;
  presumido: boolean;
  congregacoesDoAcesso: Array<{ id: number; nome: string }>;
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export default function UsuariosPage() {
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [presumidos, setPresumidos] = useState(0);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/usuarios", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setContas(d.itens ?? []);
        setPresumidos(d.presumidos ?? 0);
      })
      .catch(() =>
        setErro(
          "Não foi possível carregar as contas. Se o seu acesso não alcança esta área, ela não aparece mesmo.",
        ),
      );
  }, []);

  const lista = useMemo(() => {
    if (!contas) return [];
    const t = normalizar(busca.trim());
    if (!t) return contas;
    return contas.filter(
      (c) =>
        normalizar(c.nome).includes(t) ||
        normalizar(c.login).includes(t) ||
        normalizar(c.papelRotulo).includes(t) ||
        normalizar(c.congregacao?.nome ?? "").includes(t),
    );
  }, [contas, busca]);

  return (
    <>
      <CabecalhoModulo
        icone={UsersRound}
        titulo="Usuários"
        descricao="Contas de acesso e o papel de cada uma"
        total={contas?.length ?? null}
      >
        <CampoDeBusca
          valor={busca}
          aoMudar={setBusca}
          placeholder="Buscar por nome, login ou papel…"
          className="w-full sm:w-72"
        />
      </CabecalhoModulo>

      {erro && <EstadoErro mensagem={erro} />}

      {presumidos > 0 && (
        <Alert
          tipo="alerta"
          titulo={`${presumidos} ${presumidos === 1 ? "conta ainda tem acesso presumido" : "contas ainda têm acesso presumido"}`}
          className="mb-4"
        >
          <p>
            Elas vieram do sistema antigo sem estar ligadas a uma pessoa, e o
            portal deduziu o alcance a partir do perfil da planilha. Nada foi
            alterado no cadastro herdado — é só um palpite, e ele está marcado
            como tal em cada linha.
          </p>
          <p className="mt-1.5">
            Para confirmar: ligue a conta a uma pessoa e dê a ela o cargo que
            exerce, em <strong>Administração → Liderança</strong>. A partir daí o
            acesso passa a vir do organograma.
          </p>
        </Alert>
      )}

      {!contas && !erro ? (
        <EsqueletoLista />
      ) : lista.length === 0 ? (
        <EstadoVazio
          mensagem={busca ? "Nenhuma conta encontrada." : "Nenhuma conta cadastrada."}
          dica={busca ? "Tente parte do nome, do login ou do papel." : undefined}
        />
      ) : (
        <ul className="glass-panel divide-y divide-white/6 overflow-hidden rounded-2xl">
          {lista.map((c, i) => (
            <motion.li
              key={c.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i, 20) * 0.015 }}
              className={cn(
                "flex flex-wrap items-center gap-3 px-4 py-3",
                !c.ativo && "opacity-55",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-white/12">
                <span className="font-display text-[0.62rem] font-semibold tracking-wider text-brand-50">
                  {iniciais(c.pessoa?.nome ?? c.nome)}
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.88rem] text-brand-50">
                  {c.pessoa
                    ? [c.pessoa.tratamento, c.pessoa.nome].filter(Boolean).join(" ")
                    : c.nome}
                </p>
                <p className="truncate text-[0.72rem] text-brand-200/55">
                  {c.login}
                  {c.congregacao && (
                    <>
                      {" · "}
                      {c.congregacao.nome}
                    </>
                  )}
                  {!c.ativo && " · conta desativada"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/*
                  O alcance vem antes do papel na leitura: "Campo" e
                  "Congregação" é a informação que muda o que a pessoa vê, e é a
                  pergunta que a administração faz primeiro.
                */}
                <Badge variant={c.escopo === "campo" ? "sucesso" : "neutro"}>
                  {c.escopo === "campo" ? (
                    <>
                      <ShieldCheck className="h-3 w-3" />
                      Campo inteiro
                    </>
                  ) : (
                    <>
                      <Building2 className="h-3 w-3" />
                      {c.congregacoesDoAcesso.length === 1
                        ? c.congregacoesDoAcesso[0].nome
                        : `${c.congregacoesDoAcesso.length} congregações`}
                    </>
                  )}
                </Badge>

                <Badge variant="info">{c.papelRotulo}</Badge>

                {c.presumido && (
                  <span
                    title={`Deduzido do perfil "${c.perfilHerdado}" da planilha. Nenhum cargo atribuído ainda.`}
                    className="inline-flex items-center gap-1 rounded-full border border-gold-400/30 bg-gold-400/10 px-2 py-0.5 text-[0.65rem] text-gold-200"
                  >
                    <CircleHelp className="h-3 w-3" />
                    presumido
                  </span>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </>
  );
}
