"use client";

/**
 * Os dois campos de data que todo relatório usa.
 *
 * Repetidos em cinco telas, eles divergiriam — uma começaria em 30 dias, outra
 * em 90, uma chamaria "Início" e outra "De". Concentrados, o período significa a
 * mesma coisa em todo lugar.
 */
export function FiltroPeriodo({
  de,
  ate,
  aoMudar,
}: {
  de: string;
  ate: string;
  aoMudar: (campo: "de" | "ate", valor: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(
        [
          ["De", "de", de],
          ["Até", "ate", ate],
        ] as const
      ).map(([rotulo, campo, valor]) => (
        <label
          key={campo}
          className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[0.8rem]"
        >
          <span className="shrink-0 text-brand-200/55">{rotulo}</span>
          <input
            type="date"
            value={valor}
            onChange={(e) => aoMudar(campo, e.target.value)}
            className="bg-transparent text-brand-50 focus:outline-none [color-scheme:dark]"
          />
        </label>
      ))}
    </div>
  );
}
