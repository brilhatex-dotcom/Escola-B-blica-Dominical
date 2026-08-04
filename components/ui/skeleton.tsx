import { cn } from "@/lib/utils";

/**
 * Espaco reservado durante o carregamento.
 *
 * Use com as MEDIDAS do conteudo que vai entrar. Um esqueleto de tamanho
 * diferente do conteudo real empurra a tela quando os dados chegam, e o usuario
 * clica no lugar errado — trocar um spinner por isso so vale se a reserva for
 * fiel.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-white/6", className)}
      {...props}
    />
  );
}
