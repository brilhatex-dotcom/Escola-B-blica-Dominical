"use client";

import { use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MENU } from "@/lib/dashboard/navegacao";

/**
 * Tela dos modulos que ainda nao existem.
 *
 * Uma rota curinga cobrindo TODO `/dashboard/*` — e a alternativa a duas coisas
 * piores. Esconder os itens do menu deixaria o usuario sem ideia do que o
 * sistema vai ter, e cada entrega pareceria um produto diferente. Deixa-los
 * navegaveis sem esta tela daria a pagina de 404 do Next, que num sistema
 * recem-instalado e lida como defeito, nao como "ainda nao pronto".
 *
 * Ela sai sozinha: assim que `app/dashboard/alunos/page.tsx` existir, o Next
 * passa a servir a rota especifica, que sempre vence a curinga. Nao ha nada a
 * remover depois.
 */
export default function ModuloEmConstrucao({
  params,
}: {
  params: Promise<{ modulo: string[] }>;
}) {
  const { modulo } = use(params);
  const caminho = `/dashboard/${modulo.join("/")}`;
  const item = MENU.find((i) => i.href === caminho);
  const Icone = item?.icone ?? Hammer;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel mx-auto mt-6 max-w-lg rounded-2xl px-6 py-10 text-center"
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-gold-400/20">
        <Icone className="h-6 w-6 text-gold-300" />
      </span>

      <h1 className="mt-5 font-display text-[1.1rem] font-semibold uppercase tracking-[0.14em] text-white">
        {item?.rotulo ?? "Módulo"}
      </h1>

      <p className="mx-auto mt-3 max-w-sm text-[0.86rem] leading-relaxed text-brand-200/70">
        {item?.descricao
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
