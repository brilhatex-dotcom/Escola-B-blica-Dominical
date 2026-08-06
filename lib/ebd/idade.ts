/**
 * Idade a partir da data de nascimento.
 *
 * ============================================================================
 * A CONTA É EM UTC, E O MOTIVO É O MESMO DE SEMPRE
 *
 * `nasc` é uma data civil (`@db.Date`) — não tem hora nem fuso. Lida como hora
 * local em Pernambuco (UTC−3), ela recua para as 21h do dia anterior, e quem
 * nasceu no dia 1º passa a fazer aniversário no dia 31. Num sistema que decide
 * a classe da criança pela idade, isso troca de faixa etária uma vez por ano
 * sem que ninguém entenda por quê.
 * ============================================================================
 */
export function idadeEm(nasc: Date | string, quando: Date = new Date()): number {
  const d = typeof nasc === "string" ? new Date(nasc) : nasc;

  const anoRef = quando.getUTCFullYear();
  const mesRef = quando.getUTCMonth();
  const diaRef = quando.getUTCDate();

  let anos = anoRef - d.getUTCFullYear();
  const mes = d.getUTCMonth();
  const dia = d.getUTCDate();

  // Ainda não fez aniversário este ano.
  if (mesRef < mes || (mesRef === mes && diaRef < dia)) anos--;

  return anos;
}

/**
 * A idade a mostrar, venha ela de onde vier.
 *
 * Prefere a data de nascimento quando existe; cai no número herdado da planilha
 * quando não existe. `null` significa "ninguém informou" — e `null` não é zero:
 * um visitante com idade desconhecida não é um recém-nascido.
 */
export function idadeParaExibir(
  nasc: Date | string | null | undefined,
  idadeGravada: number | null | undefined,
  quando: Date = new Date(),
): { anos: number | null; origem: "nascimento" | "planilha" | "ausente" } {
  if (nasc) return { anos: idadeEm(nasc, quando), origem: "nascimento" };
  if (typeof idadeGravada === "number") return { anos: idadeGravada, origem: "planilha" };
  return { anos: null, origem: "ausente" };
}
