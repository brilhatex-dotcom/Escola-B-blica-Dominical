/**
 * Formatacao em portugues do Brasil.
 *
 * Tudo passa por `Intl`, que ja conhece os meses, os dias da semana e a
 * pontuacao de milhar do pt-BR. Escrever essas listas a mao e o caminho curto
 * para "Domingo, 09 de Agosto" virar "Sunday, August 09" no aparelho de alguem.
 *
 * Os formatadores sao criados UMA vez, fora das funcoes: montar um
 * `Intl.DateTimeFormat` custa caro, e a lista de atividades chama isso a cada
 * item, a cada renderizacao.
 */

const fmtDiaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const fmtDataLonga = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});
const fmtDiaMes = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtNumero = new Intl.NumberFormat("pt-BR");

/** "Domingo, 09 de agosto de 2026" — com a inicial do dia em maiuscula. */
export function dataPorExtenso(d: Date): string {
  const dia = fmtDiaSemana.format(d);
  return `${dia[0].toUpperCase()}${dia.slice(1)}, ${fmtDataLonga.format(d)}`;
}

/** "09 de ago." */
export function diaEMes(d: Date): string {
  return fmtDiaMes.format(d);
}

/** "08:00" */
export function hora(d: Date): string {
  return fmtHora.format(d);
}

/** 1234 -> "1.234" */
export function numero(n: number): string {
  return fmtNumero.format(n);
}

/**
 * Saudacao pela hora do relogio.
 *
 * Os cortes seguem o uso brasileiro: "boa tarde" comeca ao meio-dia e "boa
 * noite" as 18h. Nao ha "boa madrugada" — ninguem fala assim; de 0h as 5h a
 * saudacao continua sendo "boa noite", que e o que se diz a quem ainda esta
 * acordado.
 */
export function saudacao(d: Date): string {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * "há 4 min", "há 2 h", "ontem", "há 3 dias".
 *
 * Tempo relativo e mais util que hora cheia numa lista de atividades: quem
 * olha quer saber se acabou de acontecer, nao a que horas foi. Passando de uma
 * semana o relativo perde a graca ("há 34 dias" nao diz nada), entao volta a
 * data.
 */
export function tempoRelativo(epochMs: number, agora = Date.now()): string {
  const seg = Math.round((agora - epochMs) / 1000);

  if (seg < 45) return "agora mesmo";
  if (seg < 3600) return `há ${Math.round(seg / 60)} min`;
  if (seg < 86_400) {
    const h = Math.round(seg / 3600);
    return `há ${h} h`;
  }

  const dias = Math.round(seg / 86_400);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return diaEMes(new Date(epochMs));
}

/**
 * Iniciais para o lugar da foto.
 *
 * Primeiro e ultimo nome, ignorando "de", "da", "dos" e afins — sem isso,
 * "Maria da Silva" viraria "MD", que nao ajuda ninguem a reconhecer a pessoa.
 */
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

export function iniciais(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => !PARTICULAS.has(p.toLowerCase()));

  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Domingo mais recente, "YYYY-MM-DD" — o dia que a Chamada e o Relatório Semanal quase sempre querem. */
export function domingoMaisRecente(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Converte "MM-DD" numa data do ano corrente.
 *
 * Aniversario nao tem ano — guardar um ano falso so para poder formatar
 * produziria "1900" em qualquer tela que esquecesse de escondê-lo.
 */
export function dataDoAniversario(diaMes: string, ano = new Date().getFullYear()): Date {
  const [mes, dia] = diaMes.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}
