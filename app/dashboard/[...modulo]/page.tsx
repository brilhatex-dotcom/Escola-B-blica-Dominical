"use client";

import { use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Hammer, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { MENU } from "@/lib/dashboard/navegacao";

/**
 * Tela dos modulos que ainda nao existem — e dos que existem e nao sao seus.
 *
 * Uma rota curinga cobrindo TODO `/dashboard/*` — e a alternativa a duas coisas
 * piores. Esconder os itens do menu deixaria o usuario sem ideia do que o
 * sistema vai ter, e cada entrega pareceria um produto diferente. Deixa-los
 * navegaveis sem esta tela daria a pagina de 404 do Next, que num sistema
 * recem-instalado e lida como defeito, nao como "ainda nao pronto".
 *
 * Ela sai sozinha: assim que `app/dashboard/licoes/page.tsx` existir, o Next
 * passa a servir a rota especifica, que sempre vence a curinga. Nao ha nada a
 * remover depois.
 *
 * ============================================================================
 * "EM CONSTRUCAO" E "SEM ACESSO" SAO DUAS MENSAGENS, E NAO UMA
 *
 * Quem digita o endereco de um modulo que o cargo dele nao alcanca precisa ler
 * exatamente isso. Dizer "em construcao" ali seria uma inverdade cortes: a
 * pessoa esperaria a proxima versao por um modulo que ja existe e nunca sera
 * dela, e a secretaria receberia a cobranca de uma entrega que ja foi feita.
 * ============================================================================
 */
export default function ModuloEmConstrucao({
  params,
}: {
  params: Promise<{ modulo: string[] }>;
}) {
  const { modulo } = use(params);
  const { podeVer, carregando } = useAcesso();

  const caminho = `/dashboard/${modulo.join("/")}`;
  const item = MENU.find((i) => i.href === caminho);

  // Enquanto o acesso nao chegou, nao se acusa ninguem de nada.
  const semAcesso = !carregando && !!item && !podeVer(item.chave);

  const Icone = semAcesso ? Lock : (item?.icone ?? Hammer);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel mx-auto mt-6 max-w-lg rounded-2xl px-6 py-10 text-center"
    >
      <span
        className={cnAnel(semAcesso)}
      >
        <Icone className={semAcesso ? "h-6 w-6 text-flame-400" : "h-6 w-6 text-gold-300"} />
      </span>

      <h1 className="mt-5 font-display text-[1.1rem] font-semibold uppercase tracking-[0.14em] text-white">
        {semAcesso ? "Sem acesso" : (item?.rotulo ?? "Módulo")}
      </h1>

      <p className="mx-auto mt-3 max-w-sm text-[0.86rem] leading-relaxed text-brand-200/70">
        {semAcesso
          ? `O módulo ${item?.rotulo} existe, mas o seu acesso não alcança esta área. Se você precisa dela, fale com quem administra o campo.`
          : item?.descricao
            ? `${item.descricao}. Este módulo está sendo construído e entra numa próxima etapa do portal.`
            : "Esta área ainda não faz parte do portal."}
      </p>

      <Button asChild variant="ghost" className="mt-7">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Link>
      </Button>
    </motion.div>
  );
}

function cnAnel(semAcesso: boolean): string {
  return semAcesso
    ? "mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-flame-500/10 ring-1 ring-flame-500/25"
    : "mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-gold-400/20";
}
