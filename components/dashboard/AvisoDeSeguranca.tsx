"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, ShieldAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { EXIGIR_SENHA_PROPRIA_PARA_GRAVAR } from "@/lib/config";

/**
 * Tarja de estado da proteção do portal.
 *
 * Dois avisos, com causas diferentes e ações diferentes:
 *
 *   PORTAL DESPROTEGIDO · falta `AUTH_SECRET` no servidor, então não há como
 *     verificar sessão nenhuma e as rotas de escrita ficam abertas. É o mesmo
 *     grau de abertura de antes desta fase — a diferença é estar visível, em
 *     vez de ser um fato que só quem leu o código conhecia.
 *
 *   SENHA HERDADA · a pessoa entrou com a senha que veio da planilha, idêntica
 *     nas 19 contas. Ler é liberado; gravar, não, até a troca.
 *
 * NENHUM DOS DOIS É DISPENSÁVEL COM UM "X". Um aviso que se fecha vira um aviso
 * que se fecha todo dia sem ler — e estes descrevem o estado do sistema, não um
 * recado do momento. Eles somem sozinhos quando a causa deixa de existir.
 */
export function AvisoDeSeguranca() {
  const [estado, setEstado] = useState<{
    autenticacaoAtiva: boolean;
    precisaTrocar: boolean;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/auth/eu", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) =>
        setEstado({
          autenticacaoAtiva: Boolean(d.autenticacaoAtiva),
          precisaTrocar: Boolean(d.sessao?.precisaTrocar),
        }),
      )
      .catch(() => setEstado(null));
  }, []);

  if (!estado) return null;

  if (!estado.autenticacaoAtiva) {
    return (
      <Alert tipo="erro" titulo="Portal sem proteção" className="mb-4">
        <p>
          Qualquer pessoa com o endereço pode gravar chamadas e alterar a
          liderança — não há login exigido.
        </p>
        <p className="mt-1.5">
          Para ligar a proteção, defina a variável{" "}
          <code className="rounded bg-white/8 px-1">AUTH_SECRET</code> nas
          variáveis de ambiente da Vercel e publique de novo.
        </p>
      </Alert>
    );
  }

  if (estado.precisaTrocar) {
    return (
      <Alert
        tipo="alerta"
        titulo={
          EXIGIR_SENHA_PROPRIA_PARA_GRAVAR
            ? "Senha herdada do sistema antigo"
            : "A sua senha é a mesma de outras 18 contas"
        }
        className="mb-4"
      >
        {/*
          Duas frases para dois estados do sistema, e a diferença importa.

          Com a trava ligada, o aviso explica por que a gravação foi recusada —
          é a resposta a algo que acabou de acontecer com a pessoa. Com a trava
          desligada (o estado de hoje, até a reunião da liderança), gravar
          funciona, e dizer "você não pode gravar" seria simplesmente falso: o
          aviso passa a ser sobre o RISCO, que é quem mais entra como você.
        */}
        {EXIGIR_SENHA_PROPRIA_PARA_GRAVAR ? (
          <p>
            A sua senha é a mesma das outras 18 contas. Até trocá-la, você pode
            consultar, mas não gravar.
          </p>
        ) : (
          <p>
            Ela veio do sistema antigo e é <strong>idêntica em todas as contas</strong>.
            Gravar continua liberado até a reunião da liderança — mas, enquanto
            for assim, qualquer pessoa que conheça essa senha entra no portal
            como você, e a auditoria registrará o seu nome.
          </p>
        )}
        <Link
          href="/dashboard/trocar-senha"
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gold-400/15 px-3 py-1.5 text-[0.78rem] font-medium text-gold-200 ring-1 ring-gold-400/25 transition-colors duration-300 hover:bg-gold-400/25"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Trocar agora
        </Link>
      </Alert>
    );
  }

  return null;
}

/** Ícone reexportado para quem quiser sinalizar o mesmo estado noutro lugar. */
export { ShieldAlert };
