import Image from "next/image";
import { cn } from "@/lib/utils";
import { LOGO_ALT, LOGO_HEIGHT, LOGO_SRC, LOGO_WIDTH } from "@/lib/brand";

interface BrandMarkProps {
  className?: string;
  /** Carrega com prioridade — use nas duas telas, onde a marca e o elemento principal. */
  priority?: boolean;
  /** Dica de tamanho para o srcset do next/image. */
  sizes?: string;
  /** Marca decorativa (ja existe um texto equivalente ao lado). */
  decorative?: boolean;
  /**
   * Selo claro atras da marca.
   *
   * POR QUE ISSO EXISTE — o texto arqueado "ASSEMBLEIA DE DEUS" e o
   * "PERNAMBUCO" da arte oficial sao azuis (#1060A0). Medido sobre os fundos
   * deste portal, o contraste da:
   *
   *     contra o preto da splash ............ 3,20:1
   *     contra o azul do card (#0B1F45) ..... 2,47:1
   *     (a versao icone oficial e pior ainda: 1,15:1)
   *
   * Ou seja: a logomarca foi desenhada para fundo CLARO. Em fundo escuro o
   * letreiro some e a marca fica sem leitura.
   *
   * Como a arte nao pode ser alterada — nem recolorir o texto, nem trocar por
   * uma versao "para fundo escuro" — a saida correta de manual de marca e a
   * de sempre: apoiar a logo sobre a superficie clara para a qual ela foi
   * feita. O selo e desenhado ATRAS; a arte continua intacta, pixel por pixel.
   */
  plate?: boolean;
}

/**
 * Logomarca oficial da IEADPE.
 *
 * Renderiza o bitmap oficial sem nenhuma transformacao de cor ou forma.
 * Repare no que este componente NAO faz: nao aplica `filter` de cor, nao
 * recorta, nao troca `fill`, nao inverte, nao espelha. Sombra, halo e selo
 * ficam todos atras da marca, sem tocar nos pixels dela.
 */
export function BrandMark({
  className,
  priority = false,
  sizes = "(max-width: 640px) 40vw, 320px",
  decorative = false,
  plate = false,
}: BrandMarkProps) {
  const img = (
    <Image
      src={LOGO_SRC}
      alt={decorative ? "" : LOGO_ALT}
      aria-hidden={decorative || undefined}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      sizes={sizes}
      priority={priority}
      draggable={false}
      className={cn("relative h-auto w-full select-none", className)}
    />
  );

  if (!plate) return img;

  return (
    /*
     * O selo cresce para FORA (percentuais > 100%), em vez de empurrar a marca
     * para dentro com padding. Assim a largura deste wrapper continua sendo
     * exatamente a largura da logomarca — e a norma dos 90–120px do card pode
     * ser aplicada direto, sem descontar respiro.
     */
    <div className="relative">
      {/* Selo circular claro: a superficie para a qual a arte foi desenhada. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute left-1/2 top-1/2 w-[126%] -translate-x-1/2 -translate-y-1/2 rounded-full",
          "bg-gradient-to-b from-white via-white to-brand-50",
          "ring-1 ring-gold-400/45",
          "shadow-[0_18px_44px_-12px_rgba(2,7,19,0.85),inset_0_-8px_20px_-12px_rgba(22,58,112,0.35)]",
        )}
        style={{ aspectRatio: "1 / 1" }}
      />
      {/* Fio dourado externo — acabamento de selo, bem discreto */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 w-[137%] -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-gold-400/20"
        style={{ aspectRatio: "1 / 1" }}
      />
      {img}
    </div>
  );
}
