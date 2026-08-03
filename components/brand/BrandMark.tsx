import { cn } from "@/lib/utils";
import { MARK_PATHS, MARK_VIEWBOX } from "@/lib/brand-mark";

interface BrandMarkProps {
  className?: string;
  /** Ativa o gradiente dourado institucional. Desligue para versao monocromatica. */
  gold?: boolean;
  /** Sufixo unico dos ids internos — evita colisao quando ha varias marcas na pagina. */
  idSuffix?: string;
  title?: string;
}

/**
 * Emblema da IEADPE.
 * O desenho vem de `lib/brand-mark.ts`, a mesma fonte que alimenta a formacao
 * de particulas da splash — trocar a arte la atualiza os dois lugares.
 */
export function BrandMark({
  className,
  gold = true,
  idSuffix = "brand",
  title = "IEADPE — Campo de Betânia",
}: BrandMarkProps) {
  const gradId = `mark-gold-${idSuffix}`;
  const glowId = `mark-glow-${idSuffix}`;

  return (
    <svg
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      role="img"
      aria-label={title}
      className={cn("h-auto w-full", className)}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8f6716" />
          <stop offset="26%" stopColor="#e2ba4d" />
          <stop offset="48%" stopColor="#fbf3d8" />
          <stop offset="72%" stopColor="#d4a32c" />
          <stop offset="100%" stopColor="#8f6716" />
        </linearGradient>
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={`url(#${glowId})`}>
        {MARK_PATHS.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fillRule="evenodd"
            fill={gold ? `url(#${gradId})` : "currentColor"}
            opacity={p.opacity ?? 1}
          />
        ))}
      </g>
    </svg>
  );
}
