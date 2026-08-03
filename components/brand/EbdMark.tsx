import { cn } from "@/lib/utils";

/**
 * Selo da Escola Biblica Dominical — livro aberto sob um monograma "EBD".
 * Marca secundaria, usada ao lado do emblema institucional no card de login.
 * Tambem provisoria: troque pelos paths oficiais quando tiver a arte.
 */
export function EbdMark({
  className,
  idSuffix = "ebd",
}: {
  className?: string;
  idSuffix?: string;
}) {
  const gradId = `ebd-gold-${idSuffix}`;

  return (
    <svg
      viewBox="0 0 220 220"
      role="img"
      aria-label="Escola Bíblica Dominical"
      className={cn("h-auto w-full", className)}
    >
      <title>Escola Bíblica Dominical</title>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b8871d" />
          <stop offset="45%" stopColor="#f5e3ab" />
          <stop offset="100%" stopColor="#d4a32c" />
        </linearGradient>
      </defs>

      {/* Moldura hexagonal */}
      <path
        d="M110 8 L190 52 V160 L110 204 L30 160 V52 Z M110 22 L42 60 V152 L110 190 L178 152 V60 Z"
        fillRule="evenodd"
        fill={`url(#${gradId})`}
        opacity={0.9}
      />

      {/* Livro aberto */}
      <path
        d="M48 132 C70 122 92 122 108 132 L108 166 C92 156 70 156 48 166 Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M172 132 C150 122 128 122 112 132 L112 166 C128 156 150 156 172 166 Z"
        fill={`url(#${gradId})`}
      />
      <path d="M108 131 H112 V167 H108 Z" fill={`url(#${gradId})`} />

      {/* Raio de luz saindo do livro */}
      <path d="M110 46 L118 112 L102 112 Z" fill={`url(#${gradId})`} opacity={0.85} />
      <path d="M74 66 L98 108 L88 114 Z" fill={`url(#${gradId})`} opacity={0.6} />
      <path d="M146 66 L122 108 L132 114 Z" fill={`url(#${gradId})`} opacity={0.6} />
    </svg>
  );
}
