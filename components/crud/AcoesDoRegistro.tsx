"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Editar e excluir, ao lado de cada linha.
 *
 * ============================================================================
 * EXCLUIR SEMPRE PERGUNTA — E A PERGUNTA DIZ O NOME
 *
 * "Tem certeza?" é a confirmação inútil clássica: quem clicou por engano
 * confirma por reflexo, porque a pergunta não traz informação nenhuma. Dizendo
 * "Excluir Maria da Silva?", o engano fica visível — é o nome errado na tela,
 * antes de o dano acontecer.
 *
 * E o botão de confirmar repete o verbo ("Excluir"), em vez de "OK". Numa
 * caixa com dois botões, "OK" e "Cancelar" exigem ler a pergunta inteira para
 * saber qual é qual; o verbo responde sozinho.
 * ============================================================================
 *
 * Os alvos têm 36px e ficam sempre visíveis, e não escondidos atrás do
 * `hover` — metade da igreja usa isto no celular, onde `hover` não existe.
 */

export interface AcoesDoRegistroProps {
  /** Aparece na confirmação: "Excluir Maria da Silva?" */
  nome: string;
  onEditar: () => void;
  onExcluir: () => Promise<void> | void;
  /** Frase extra na confirmação — o que o sistema fará com o histórico. */
  aviso?: string;
  desabilitado?: boolean;
  className?: string;
}

export function AcoesDoRegistro({
  nome,
  onEditar,
  onExcluir,
  aviso,
  desabilitado = false,
  className,
}: AcoesDoRegistroProps) {
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function confirmar() {
    setExcluindo(true);
    try {
      await onExcluir();
      setConfirmando(false);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <>
      <div className={cn("flex shrink-0 items-center gap-1", className)}>
        <button
          type="button"
          onClick={onEditar}
          disabled={desabilitado}
          aria-label={`Editar ${nome}`}
          title={`Editar ${nome}`}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]",
            "text-brand-200/60 transition-all duration-300",
            "hover:border-gold-400/30 hover:text-gold-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setConfirmando(true)}
          disabled={desabilitado}
          aria-label={`Excluir ${nome}`}
          title={`Excluir ${nome}`}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]",
            "text-brand-200/60 transition-all duration-300",
            "hover:border-flame-500/35 hover:text-flame-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <Dialog open={confirmando} onOpenChange={(aberto) => !excluindo && setConfirmando(aberto)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir {nome}?</DialogTitle>
            <DialogDescription>
              {aviso ??
                "Esta ação não pode ser desfeita pela tela. Se houver histórico ligado a este registro, ele será arquivado em vez de apagado — e a mensagem seguinte dirá qual dos dois aconteceu."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmando(false)} disabled={excluindo}>
              Cancelar
            </Button>
            <Button variant="perigo" onClick={confirmar} disabled={excluindo}>
              {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {excluindo ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
