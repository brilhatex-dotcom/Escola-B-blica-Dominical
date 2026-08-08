import { AlertTriangle, BadgeCheck, CircleDashed, Clock, HandCoins, PenLine, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

/**
 * O status de UM pedido, numa etiqueta só — usada na lista de pedidos, no
 * seletor de congregação do assistente e na revisão final, sempre com o
 * mesmo texto e a mesma cor para o mesmo estado.
 *
 * "Rascunho" não existe como campo no banco — é `situacao === "sem-pedido"`
 * com um `PedidoRevista` já criado e ainda não confirmado (a pessoa começou a
 * digitar e não terminou). A conta de `situacao` (`lib/revistas/situacao.ts`)
 * não sabe disso porque, para o dinheiro, um rascunho vale zero — mas para
 * quem está OLHANDO A LISTA, "ninguém mexeu ainda" e "alguém começou e
 * parou" são informações bem diferentes, e é só isso que esta etiqueta
 * acrescenta.
 */

export type SituacaoExibida = "sem-pedido" | "rascunho" | "pendente" | "parcial" | "quitado" | "atraso";

type Variant = VariantProps<typeof badgeVariants>["variant"];

const CONFIG: Record<SituacaoExibida, { texto: string; variant: Variant; Icone: LucideIcon }> = {
  "sem-pedido": { texto: "Sem pedido", variant: "neutro", Icone: CircleDashed },
  rascunho: { texto: "Rascunho", variant: "info", Icone: PenLine },
  pendente: { texto: "Pendente", variant: "alerta", Icone: Clock },
  parcial: { texto: "Parcial", variant: "alerta", Icone: HandCoins },
  quitado: { texto: "Pago", variant: "sucesso", Icone: BadgeCheck },
  atraso: { texto: "Atrasado", variant: "erro", Icone: AlertTriangle },
};

export function situacaoExibida(
  situacao: "sem-pedido" | "quitado" | "pendente" | "parcial" | "atraso",
  pedido: { confirmado: boolean } | null,
): SituacaoExibida {
  if (situacao === "sem-pedido" && pedido && !pedido.confirmado) return "rascunho";
  return situacao;
}

export function SituacaoBadge({
  situacao,
  pedido,
  className,
}: {
  situacao: "sem-pedido" | "quitado" | "pendente" | "parcial" | "atraso";
  pedido: { confirmado: boolean } | null;
  className?: string;
}) {
  const { texto, variant, Icone } = CONFIG[situacaoExibida(situacao, pedido)];
  return (
    <Badge variant={variant} className={className}>
      <Icone className="h-3 w-3" />
      {texto}
    </Badge>
  );
}
