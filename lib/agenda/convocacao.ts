/**
 * A ordem de quem aparece numa lista de frequência de estudo ou reunião,
 * dentro de cada congregação — a mesma que a liderança usa de cabeça:
 *
 *   Dirigente → Vice-Dirigente (quando houver) → Secretário Local → Professores
 *
 * Vale para a tela, para a impressão e para a folha de assinatura, para os
 * três nunca listarem a mesma congregação em ordens diferentes.
 */

export const PAPEIS_LIDERANCA = ["Dirigente", "Vice-Dirigente", "Secretário Local"] as const;
export const PAPEL_PROFESSOR = "Professor";

const ORDEM: Record<string, number> = {
  Dirigente: 0,
  "Vice-Dirigente": 1,
  "Secretário Local": 2,
  Professor: 3,
};

/**
 * Posição de um papel na lista. Aceita o papel combinado ("Dirigente ·
 * Professor"): vale o primeiro, que é o mais alto. Quem veio sem papel
 * (convidado adicionado à mão) vai para o fim.
 */
export function ordemDoPapel(papel: string | null | undefined): number {
  if (!papel) return 9;
  return ORDEM[papel.split(" · ")[0]] ?? 8;
}

/**
 * O nome sem o tratamento na frente ("Pb.", "Ir.ª", "Irmã", "Dc."...), para
 * ordenar: "Pb. Reginaldo" fica no R, junto de "Raila", e não no P.
 */
export function semTratamento(nome: string): string {
  return nome.replace(/^(?:(?:pb|pr|pra|ev|dc|dca|diác|miss|ir|irm|sr|sra)\.?ª?|irmã|irmão|pastor|pastora|presbítero|diácono|diaconisa|evangelista|missionária?o?)\s+/i, "");
}

export function porPapelENome<T extends { papel: string | null; nome: string }>(a: T, b: T): number {
  return (
    ordemDoPapel(a.papel) - ordemDoPapel(b.papel) ||
    semTratamento(a.nome).localeCompare(semTratamento(b.nome), "pt-BR")
  );
}

/** "Secretário Local" fica "Secretário(a)" no papel impresso — é como a igreja chama. */
export function rotuloDoPapel(papel: string | null | undefined): string {
  if (!papel) return "";
  return papel.replace("Secretário Local", "Secretário(a)");
}
