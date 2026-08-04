"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, KeyRound, Loader2, Lock } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CabecalhoModulo } from "@/components/dashboard/PaginaModulo";

/**
 * Troca de senha.
 *
 * A senha herdada da planilha é a MESMA nas 19 contas — o hash é idêntico em
 * todas. Enquanto ela não for trocada, o sistema aceita gravações de quem
 * souber uma senha que meia igreja conhece; por isso quem entra com ela é
 * trazido para cá antes do painel, e as rotas de escrita ficam bloqueadas até a
 * troca.
 *
 * A senha ATUAL é pedida mesmo já havendo sessão: sem isso, um celular deixado
 * desbloqueado em cima do banco permite tomar a conta de quem estava logado.
 */
export default function TrocarSenhaPage() {
  const router = useRouter();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetida, setRepetida] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (salvando) return;

    // A conferência das duas digitações é feita AQUI e não no servidor: ela não
    // é uma regra de segurança, é proteção contra erro de digitação, e mandar
    // ao servidor só para ouvir "não conferem" custa uma ida à rede.
    if (nova !== repetida) {
      setErro("A nova senha e a repetição não são iguais.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/auth/trocar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atual, nova }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados.erro ?? "Não foi possível trocar a senha.");
        return;
      }
      setPronto(true);
      window.setTimeout(() => router.replace("/dashboard"), 1600);
    } catch {
      setErro("Sem resposta do servidor. Verifique a conexão.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <CabecalhoModulo
        icone={KeyRound}
        titulo="Trocar senha"
        descricao="Escolha uma senha só sua antes de continuar"
      />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel mx-auto max-w-lg rounded-2xl p-6"
      >
        <Alert tipo="alerta" titulo="Por que estamos pedindo isto" className="mb-5">
          A senha que veio do sistema antigo é a <strong>mesma para todos os
          usuários</strong>. Enquanto ela estiver em uso, qualquer pessoa que a
          conheça pode gravar chamadas em nome da secretaria.
        </Alert>

        {pronto ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
              <Check className="h-6 w-6 text-emerald-300" />
            </span>
            <p className="text-[0.95rem] text-white">Senha trocada.</p>
            <p className="text-[0.8rem] text-brand-200/60">Levando você ao painel…</p>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-4" noValidate>
            {([
              ["Senha atual", atual, setAtual, "current-password"],
              ["Nova senha", nova, setNova, "new-password"],
              ["Repita a nova senha", repetida, setRepetida, "new-password"],
            ] as const).map(([rotulo, valor, definir, autoComplete]) => (
              <label key={rotulo} className="block">
                <span className="mb-1.5 block text-[0.78rem] text-brand-200/70">{rotulo}</span>
                <span className="flex h-12 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 transition-colors duration-300 focus-within:border-gold-400/35">
                  <Lock className="h-4 w-4 shrink-0 text-brand-300/70" />
                  <input
                    type="password"
                    value={valor}
                    autoComplete={autoComplete}
                    onChange={(e) => {
                      definir(e.target.value);
                      setErro(null);
                    }}
                    disabled={salvando}
                    className="min-w-0 flex-1 bg-transparent text-[0.88rem] text-brand-50 focus:outline-none disabled:opacity-50"
                  />
                </span>
              </label>
            ))}

            <p className="text-[0.74rem] leading-relaxed text-brand-200/50">
              Pelo menos 6 caracteres, e que não seja só números. Prefira algo
              longo e fácil de lembrar a algo curto e cheio de símbolos.
            </p>

            {erro && (
              <p role="alert" className="rounded-lg border border-flame-500/35 bg-flame-500/10 px-3 py-2 text-[0.8rem] text-flame-400">
                {erro}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={salvando || !atual || !nova || !repetida}
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {salvando ? "Gravando…" : "Trocar senha"}
            </Button>
          </form>
        )}
      </motion.div>
    </>
  );
}
