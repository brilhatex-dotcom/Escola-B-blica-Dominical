import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabela do sistema.
 *
 * O wrapper com `overflow-x-auto` nao e opcional: as listas de alunos e
 * frequencia tem mais colunas do que cabe num celular, e sem ele a pagina
 * INTEIRA passa a rolar na horizontal — o layout quebra em vez da tabela.
 */
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-[0.85rem]", className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("border-b border-white/10", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-white/6", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("transition-colors duration-200 hover:bg-white/4", className)}
      {...props}
    />
  );
}

export function TableTh({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-left text-[0.68rem] font-medium uppercase tracking-[0.14em] text-brand-200/60",
        className,
      )}
      {...props}
    />
  );
}

export function TableTd({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-3 py-2.5 text-brand-100/85", className)} {...props} />;
}
