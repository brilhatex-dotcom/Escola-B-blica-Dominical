"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, CircleHelp, KeyRound, Loader2, Power, ShieldCheck, UserPlus, UsersRound, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo,
  CampoDeBusca,
  EsqueletoLista,
  EstadoErro,
  EstadoVazio,
} from "@/components/dashboard/PaginaModulo";
import { iniciais } from "@/lib/dashboard/formato";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { normalizarLogin } from "@/lib/auth/login";
import type { Escopo, Papel } from "@/lib/auth/papeis";

/**
 * Usuários — as contas de acesso do portal.
 *
 * ============================================================================
 * CADA SECRETÁRIA TEM O SEU LOGIN, PRESO À SUA CONGREGAÇÃO
 *
 * A administração cria aqui uma conta por secretária: login, senha inicial e a
 * congregação dela. A conta nasce em bcrypt (formato novo) e só enxerga e só
 * grava na própria congregação — cadastra alunos, faz chamada, atualiza.
 *
 * O PAPEL detalhado (Dirigente, Supervisor…) continua vindo do CARGO, não daqui
 * — mudar o organograma é em Administração → Liderança. O que esta tela cria é
 * o ACESSO da conta: a que congregação ela pertence e quanto pode gravar nela.
 * ============================================================================
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

interface Cong {
  id: number;
  nome: string;
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export default function UsuariosPage() {
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [congregacoes, setCongregacoes] = useState<Cong[]>([]);
  const [presumidos, setPresumidos] = useState(0);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const { podeGravar } = useAcesso();
  const editavel = podeGravar("usuarios");

  const [criando, setCriando] = useState(false);
  const [redefinindo, setRedefinindo] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/usuarios", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setContas(d.itens ?? []);
      setCongregacoes(d.congregacoes ?? []);
      setPresumidos(d.presumidos ?? 0);
    } catch {
      setErro(
        "Não foi possível carregar as contas. Se o seu acesso não alcança esta área, ela não aparece mesmo.",
      );
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

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
        <div className="flex flex-wrap items-center gap-2">
          <CampoDeBusca
            valor={busca}
            aoMudar={setBusca}
            placeholder="Buscar por nome, login ou papel…"
            className="w-full sm:w-64"
          />
          {editavel && (
            <Button size="sm" onClick={() => setCriando((v) => !v)}>
              <UserPlus className="h-4 w-4" />
              Novo login
            </Button>
          )}
        </div>
      </CabecalhoModulo>

      {erro && <EstadoErro mensagem={erro} />}

      {criando && editavel && (
        <FormNovaConta
          congregacoes={congregacoes}
          aoFechar={() => setCriando(false)}
          aoCriar={() => {
            setCriando(false);
            void carregar();
          }}
        />
      )}

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
              className={cn("px-4 py-3", !c.ativo && "opacity-55")}
            >
              <div className="flex flex-wrap items-center gap-3">
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
                    {c.congregacao && ` · ${c.congregacao.nome}`}
                    {!c.ativo && " · conta desativada"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
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

                  {editavel && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRedefinindo(redefinindo === c.id ? null : c.id)}
                        title="Redefinir a senha"
                        className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-brand-200/60 transition-colors hover:border-gold-400/30 hover:text-gold-200"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                      {c.perfilHerdado !== "master" && (
                        <AlternarAtivo conta={c} aoMudar={() => void carregar()} />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {redefinindo === c.id && editavel && (
                <RedefinirSenha
                  conta={c}
                  aoFechar={() => setRedefinindo(null)}
                  aoRedefinir={() => setRedefinindo(null)}
                />
              )}
            </motion.li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function FormNovaConta({
  congregacoes,
  aoFechar,
  aoCriar,
}: {
  congregacoes: Cong[];
  aoFechar: () => void;
  aoCriar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [congId, setCongId] = useState<number | "">("");
  const [perfil, setPerfil] = useState<"secretario" | "coord">("secretario");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function criar() {
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, login, senha, congId: congId === "" ? undefined : congId, perfil }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível criar a conta.");
      aoCriar();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="glass-panel mb-4 rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-[0.9rem] font-semibold text-white">Novo login de secretária</h2>
        <button type="button" onClick={aoFechar} aria-label="Fechar" className="text-brand-200/60 hover:text-brand-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome da pessoa" valor={nome} aoMudar={setNome} placeholder="Ex.: Maria da Silva" />
        {/*
          O login gravado aparece EMBAIXO do campo, enquanto se digita.

          O portal tira os espaços e baixa a caixa antes de gravar. Fazendo isso
          em silêncio, quem cadastrou "Maria Bandeiras" recebe "mariabandeiras"
          no banco, tenta entrar com o que digitou e ouve "usuário ou senha
          inválidos" — procurando o problema na senha, que estava certa. Dizer o
          resultado na hora custa uma linha e evita esse telefonema inteiro.
        */}
        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.1em] text-brand-200/50">
            Login (sem espaços)
          </span>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Ex.: mariabandeiras"
            className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.84rem] text-brand-50 placeholder:text-brand-200/35 focus:border-gold-400/35 focus:outline-none"
          />
          {login.trim() !== "" && (
            <span className="text-[0.68rem] leading-relaxed text-brand-200/50">
              Ela vai entrar digitando{" "}
              <strong className="text-gold-200">{normalizarLogin(login)}</strong>
              {normalizarLogin(login) !== login.trim() && " — sem espaços e em letras minúsculas"}
            </span>
          )}
        </label>
        <Campo rotulo="Senha inicial" valor={senha} aoMudar={setSenha} placeholder="Mínimo 6 caracteres" tipo="text" />

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

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[0.7rem] uppercase tracking-[0.1em] text-brand-200/50">Tipo de acesso</span>
          <select
            value={perfil}
            onChange={(e) => setPerfil(e.target.value as "secretario" | "coord")}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.84rem] text-brand-50 focus:border-gold-400/35 focus:outline-none [&>option]:bg-brand-900"
          >
            <option value="secretario">Secretário(a) — chamada, alunos, visitantes, lições e revistas</option>
            <option value="coord">Dirigente — o mesmo, mais classes e professores</option>
          </select>
        </label>
      </div>

      <p className="mt-2 text-[0.72rem] text-brand-200/45">
        A conta só enxerga e só grava na congregação escolhida. Passe a senha à secretária
        e peça que a troque no primeiro acesso.
      </p>

      {msg && <p className="mt-2 text-[0.8rem] text-flame-400">{msg}</p>}

      <div className="mt-3 flex items-center gap-3">
        <Button onClick={() => void criar()} disabled={salvando}>
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar login
        </Button>
      </div>
    </div>
  );
}

function RedefinirSenha({
  conta,
  aoFechar,
  aoRedefinir,
}: {
  conta: Conta;
  aoFechar: () => void;
  aoRedefinir: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function gravar() {
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/usuarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conta.id, novaSenha: senha }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível redefinir.");
      aoRedefinir();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-gold-400/25 bg-brand-900/40 p-3">
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[0.7rem] uppercase tracking-[0.1em] text-brand-200/50">
          Nova senha para {conta.login}
        </span>
        <input
          autoFocus
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.84rem] text-brand-50 focus:border-gold-400/35 focus:outline-none"
        />
      </label>
      <Button onClick={() => void gravar()} disabled={salvando || senha.length < 6}>
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
        Redefinir
      </Button>
      <Button variant="ghost" onClick={aoFechar}>
        Cancelar
      </Button>
      {msg && <p className="w-full text-[0.78rem] text-flame-400">{msg}</p>}
    </div>
  );
}

function AlternarAtivo({ conta, aoMudar }: { conta: Conta; aoMudar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  async function alternar() {
    setOcupado(true);
    try {
      await fetch("/api/usuarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conta.id, ativo: !conta.ativo }),
      });
      aoMudar();
    } finally {
      setOcupado(false);
    }
  }
  return (
    <button
      type="button"
      onClick={() => void alternar()}
      disabled={ocupado}
      title={conta.ativo ? "Desativar a conta" : "Reativar a conta"}
      className={cn(
        "rounded-lg border p-1.5 transition-colors",
        conta.ativo
          ? "border-white/10 bg-white/[0.04] text-brand-200/60 hover:border-flame-500/40 hover:text-flame-400"
          : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
      )}
    >
      {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
    </button>
  );
}

function Campo({
  rotulo,
  valor,
  aoMudar,
  placeholder,
  tipo = "text",
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  tipo?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.7rem] uppercase tracking-[0.1em] text-brand-200/50">{rotulo}</span>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[0.84rem] text-brand-50 placeholder:text-brand-200/35 focus:border-gold-400/35 focus:outline-none"
      />
    </label>
  );
}
