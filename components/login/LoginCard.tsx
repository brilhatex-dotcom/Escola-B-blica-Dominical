"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Lock, LogIn, Loader2, User } from "lucide-react";
import { FormField } from "./FormField";
import { VerseOfTheDay } from "./VerseOfTheDay";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandMark } from "@/components/brand/BrandMark";
import { APP_VERSION, ORG_NAME, SESSAO_LOCAL_CHAVE } from "@/lib/config";

interface LoginCardProps {
  /** `precisaTrocar` chega `true` quando a senha ainda e a herdada da planilha. */
  onAuthenticated: (usuario: string, precisaTrocar: boolean) => void;
}

/** Entrada escalonada dos blocos do card. */
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.085, delayChildren: 0.25 } },
};
const rise = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function LoginCard({ onAuthenticated }: LoginCardProps) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrar, setLembrar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [erros, setErros] = useState<{ usuario?: string; senha?: string; geral?: string }>({});
  const [verAjuda, setVerAjuda] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    const falhas: typeof erros = {};
    if (!usuario.trim()) falhas.usuario = "Informe o seu usuário.";
    if (!senha) falhas.senha = "Informe a sua senha.";
    setErros(falhas);
    if (Object.keys(falhas).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: usuario.trim(), senha }),
      });
      const dados = await res.json().catch(() => ({}));

      if (!res.ok) {
        /*
         * A mensagem do servidor e usada como veio.
         *
         * Ela e deliberadamente igual para "usuario nao existe" e "senha
         * errada": distinguir os dois entrega a lista de logins validos a quem
         * estiver testando. Trocar aqui por algo "mais util" desfaria isso.
         */
        setErros({ geral: dados.erro ?? "Não foi possível entrar." });
        return;
      }

      // Lembrete local de "este aparelho já entrou" — não é a sessão em si
      // (essa é o cookie httpOnly), só o que permite a próxima abertura sem
      // internet pular direto para o painel. Ver `app/page.tsx`.
      localStorage.setItem(SESSAO_LOCAL_CHAVE, String(Date.now()));
      onAuthenticated(dados.nome || usuario.trim(), Boolean(dados.precisaTrocar));
    } catch {
      const jaEntrouNesteAparelho = Boolean(localStorage.getItem(SESSAO_LOCAL_CHAVE));
      setErros({
        geral: !navigator.onLine && !jaEntrouNesteAparelho
          ? "Sem internet, e este aparelho ainda não entrou no portal antes. Entre pelo menos uma vez com internet — depois disso, ele abre direto, mesmo sem sinal."
          : "Sem resposta do servidor. Verifique a conexão.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="glass-panel relative w-full max-w-[460px] overflow-hidden rounded-[1.75rem] px-7 py-9 sm:px-9 short:py-5 shorter:py-6"
    >
      {/* Fio de luz no topo do card */}
      <span
        aria-hidden="true"
        className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/60 to-transparent"
      />
      {/* Halo dourado no canto superior */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-gold-400/10 blur-3xl"
      />

      {/* ---------------- Topo: logomarca oficial ---------------- */}
      {/*
        Em telas baixas a marca vai para o LADO do titulo, nao acima.

        Empilhado, este bloco custa 227px dos 736 do card — e num notebook
        1366x768 (625px uteis) isso e o que empurrava o botao Entrar para fora
        da tela. Lado a lado, a altura passa a ser a do maior dos dois em vez
        da soma, e o card inteiro cabe sem rolagem. E o mesmo lockup horizontal
        que qualquer manual de marca ja preve para espacos de pouca altura.
      */}
      <motion.div
        variants={rise}
        className="flex flex-col items-center shorter:flex-row shorter:items-center shorter:gap-4 shorter:text-left"
      >
        {/*
          Largura da MARCA entre 90px e 120px, conforme a norma: 96px no celular,
          116px a partir de sm. `clamp` deixa o passo continuo, sem salto no
          breakpoint.

          `aspect-[100/137]` reserva no fluxo o quadrado do selo, que e maior que
          a marca e fica posicionado de forma absoluta. Sem isso, as margens em
          volta teriam de compensar o transbordo na mao — e cada tamanho de tela
          pediria um numero diferente.

          A flutuacao vive no wrapper externo, separada do elemento da imagem:
          assim o `translate` da animacao nunca se mistura com o `transform` de
          entrada do Framer Motion, que e o que faz a marca "pular" ao montar.
        */}
        <div className="animate-logo-float mb-1 flex aspect-[100/137] w-[clamp(6rem,19vw,7.25rem)] items-center justify-center short:w-[6rem] shorter:w-[5.9rem] shorter:shrink-0 shorter:mb-0">
          <div className="relative w-full">
          {/* Iluminacao suave — desenhada ATRAS da marca, sem tocar nos pixels */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 scale-[1.45] rounded-full opacity-80 blur-2xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(212,175,55,0.30) 0%, rgba(22,58,112,0.28) 52%, transparent 76%)",
            }}
          />
            <BrandMark
              plate
              priority
              sizes="(max-width: 640px) 96px, 116px"
            />
          </div>
        </div>

        <div className="shorter:min-w-0 shorter:flex-1">
          <p className="mt-4 font-display text-[0.62rem] uppercase tracking-[0.42em] text-gold-300/85 short:mt-2 shorter:mt-0">
            Portal da
          </p>
          <h1 className="mt-2 font-display text-[1.18rem] font-semibold uppercase leading-tight tracking-[0.17em] text-white short:mt-1.5 short:text-[1.05rem]">
            Escola Bíblica
            <br />
            Dominical
          </h1>
          <p className="mt-3 font-serif text-[0.9rem] italic text-brand-100/80 short:mt-2 short:text-[0.82rem]">
            Campo de Betânia — PE
          </p>
        </div>
      </motion.div>

      {/* ---------------- Versiculo ---------------- */}
      <motion.div variants={rise} className="my-7 short:my-3 shorter:my-3">
        <div className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent short:mb-4" />
        <VerseOfTheDay />
        <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent short:mt-4" />
      </motion.div>

      {/* ---------------- Formulario ---------------- */}
      <motion.form variants={rise} onSubmit={handleSubmit} className="space-y-3.5 short:space-y-2.5" noValidate>
        <FormField
          label="Usuário"
          icon={User}
          value={usuario}
          onChange={(v) => {
            setUsuario(v);
            if (erros.usuario) setErros((e) => ({ ...e, usuario: undefined }));
          }}
          error={erros.usuario}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          disabled={loading}
        />

        <FormField
          label="Senha"
          icon={Lock}
          value={senha}
          onChange={(v) => {
            setSenha(v);
            if (erros.senha) setErros((e) => ({ ...e, senha: undefined }));
          }}
          error={erros.senha}
          revealable
          autoComplete="current-password"
          disabled={loading}
        />

        {erros.geral && (
          <p role="alert" className="rounded-lg border border-flame-500/35 bg-flame-500/10 px-3 py-2 text-[0.78rem] text-flame-400">
            {erros.geral}
          </p>
        )}

        {/* Lembrar-me / Esqueci minha senha */}
        <div className="flex items-center justify-between pt-1.5 short:pt-0.5">
          <label className="group flex cursor-pointer select-none items-center gap-2.5">
            <Checkbox
              checked={lembrar}
              onCheckedChange={(v) => setLembrar(v === true)}
              disabled={loading}
            />
            <span className="text-[0.78rem] text-brand-200/70 transition-colors duration-300 group-hover:text-brand-100">
              Lembrar-me
            </span>
          </label>

          <Button
            type="button"
            variant="link"
            size="sm"
            className="px-0 text-[0.78rem]"
            aria-expanded={verAjuda}
            onClick={() => setVerAjuda((v) => !v)}
          >
            Esqueci minha senha
          </Button>
        </div>

        {/*
          Não existe recuperação por e-mail: a igreja não tem servidor de e-mail
          configurado, e um formulário que redefine a senha só com o nome do
          usuário deixaria qualquer pessoa trocar a senha de qualquer conta. Por
          isso a recuperação é feita por quem administra o portal — e este painel
          explica o caminho em vez de o botão não fazer nada.
        */}
        {verAjuda && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-[0.76rem] leading-relaxed text-brand-100/80"
          >
            <p className="font-medium text-brand-50">Para recuperar o acesso:</p>
            <p className="mt-1.5">
              Fale com quem administra o portal do campo — é essa pessoa que
              redefine a sua senha. Por segurança, o próprio sistema não troca a
              senha só com o nome de usuário.
            </p>
            <p className="mt-2 text-brand-200/60">
              Ao entrar com a senha compartilhada do sistema antigo, o portal pede
              para você criar a sua própria senha. É esse o caminho normal até a
              reunião da liderança.
            </p>
          </motion.div>
        )}

        <Button type="submit" size="lg" disabled={loading} className="mt-3 w-full short:mt-2">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Entrando…
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-0.5" />
              Entrar
            </>
          )}
        </Button>
      </motion.form>

      {/* ---------------- Rodape ---------------- */}
      <motion.footer variants={rise} className="mt-8 text-center short:mt-4 shorter:mt-3">
        <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent short:mb-3" />
        <p className="font-sans text-[0.66rem] uppercase tracking-[0.2em] text-brand-200/40">
          Versão {APP_VERSION}
        </p>
        <p className="mt-1.5 text-[0.7rem] leading-snug text-brand-200/50 shorter:mt-1">
          Sistema Oficial da Escola Bíblica Dominical
        </p>
        <p className="mt-0.5 text-[0.7rem] text-brand-200/35">
          {ORG_NAME}
        </p>
      </motion.footer>
    </motion.div>
  );
}
