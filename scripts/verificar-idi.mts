/**
 * Verificação do Índice de Destaque Inteligente — IDI (Fase 21).
 *
 *   npm run verificar:idi
 *
 * Roda no Node, sem banco — tudo aqui é função pura.
 */
import {
  calcularIDI,
  calcularRetencao,
  gerarJustificativaIDI,
  maiorPorCriterio,
  PESOS_IDI,
  type ComponentesIDI,
} from "../lib/relatorios/idi";

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "OK  " : "FALHA"}  ${msg}`);
  if (!cond) falhas++;
};

console.log("1. Os pesos somam exatamente 100");
const somaPesos = Object.values(PESOS_IDI).reduce((a: number, b: number) => a + b, 0);
ok(somaPesos === 100, `soma dos 10 pesos = ${somaPesos}`);

const cheio: ComponentesIDI = {
  frequencia: 90,
  regularidade: 100,
  crescimentoTrimestral: 60,
  crescimentoAnual: 55,
  visitantes: 80,
  visitantesNaoCrentes: 70,
  visitantesRetornaram: 50,
  retencaoAlunos: 85,
  participacaoProfessores: 95,
  igs: 88,
};

console.log("\n2. calcularIDI — com os dez componentes, a média é ponderada pelos pesos certos");
const resultadoCheio = calcularIDI(cheio);
const esperado =
  (90 * 18 + 100 * 12 + 60 * 10 + 55 * 8 + 80 * 10 + 70 * 10 + 50 * 8 + 85 * 8 + 95 * 8 + 88 * 8) / 100;
ok(resultadoCheio?.nota === Math.round(esperado * 10) / 10, `nota bate com a média ponderada manual (${esperado.toFixed(1)})`);
ok(resultadoCheio?.componentesUsados.length === 10, "os 10 componentes entraram na conta");

console.log("\n3. calcularIDI — componente ausente REDISTRIBUI o peso, não zera");
const semVisitantes: ComponentesIDI = { ...cheio, visitantes: null, visitantesNaoCrentes: null, visitantesRetornaram: null };
const resultadoSemVisitantes = calcularIDI(semVisitantes);
ok(resultadoSemVisitantes !== null, "ainda calcula, com os 7 componentes que sobraram");
ok(resultadoSemVisitantes?.componentesUsados.length === 7, "7 componentes usados (10 - 3 nulos)");
ok(
  resultadoSemVisitantes!.nota !== 0,
  "não zera por falta de visitante — congregação sem visitante não é congregação com nota zero",
);

console.log("\n4. calcularIDI — nenhum componente disponível → null, nunca inventa 0");
const vazio: ComponentesIDI = {
  frequencia: null,
  regularidade: null,
  crescimentoTrimestral: null,
  crescimentoAnual: null,
  visitantes: null,
  visitantesNaoCrentes: null,
  visitantesRetornaram: null,
  retencaoAlunos: null,
  participacaoProfessores: null,
  igs: null,
};
ok(calcularIDI(vazio) === null, "tudo nulo → IDI null");

console.log("\n5. gerarJustificativaIDI — a frase no molde pedido");
const frase = gerarJustificativaIDI({
  nome: "Bredos Altos",
  frequencia: 92,
  crescimentoTrimestral: 12,
  visitantes: 18,
  visitantesNaoCrentes: 11,
  regularidade: 100,
  domingosNoPeriodo: 12,
  domingosComChamada: 12,
});
ok(frase.includes("Bredos Altos"), "menciona o nome da congregação");
ok(frase.includes("92%"), "menciona a frequência");
ok(frase.includes("12%"), "menciona o crescimento trimestral");
ok(frase.includes("18 visitantes"), "menciona o total de visitantes");
ok(frase.includes("11 não eram crentes"), "menciona quantos não eram crentes");
ok(frase.includes("100%"), "regularidade perfeita vira '100% das chamadas'");
ok(frase.trim().endsWith("."), "termina com ponto — é uma frase, não uma lista");

console.log("\n6. gerarJustificativaIDI — sem dado nenhum, não inventa números");
const fraseVazia = gerarJustificativaIDI({
  nome: "Nova",
  frequencia: null,
  crescimentoTrimestral: null,
  visitantes: 0,
  visitantesNaoCrentes: 0,
  regularidade: null,
  domingosNoPeriodo: 0,
  domingosComChamada: 0,
});
ok(fraseVazia.includes("poucos dados"), "avisa que faltam dados, em vez de inventar uma frase vazia");

console.log("\n7. maiorPorCriterio — empate leva os dois, quem não tem valor fica de fora");
const candidatos = [
  { id: 1, nome: "A", valor: 80 },
  { id: 2, nome: "B", valor: 95 },
  { id: 3, nome: "C", valor: 95 },
  { id: 4, nome: "D", valor: null },
];
const vencedor = maiorPorCriterio(candidatos);
ok(vencedor?.ids.length === 2 && vencedor.nomes.includes("B") && vencedor.nomes.includes("C"), "B e C empatam em 95 e os dois vencem");
ok(vencedor?.valor === 95, "o valor do empate é 95");
ok(maiorPorCriterio([]) === null, "lista vazia → null");
ok(maiorPorCriterio([{ id: 9, nome: "Só", valor: null }]) === null, "só candidato sem valor → null");

console.log("\n7b. maiorPorCriterio — exclusão de ids (usado pela Congregação Revelação)");
const semB = maiorPorCriterio(candidatos, [2]);
ok(semB?.ids.length === 1 && semB.nomes[0] === "C", "excluindo B (o outro empatado), sobra só C");

console.log("\n8. calcularRetencao — quantos da primeira metade continuam na segunda");
ok(calcularRetencao([1, 2, 3, 4], [2, 3, 4, 5]) === 75, "3 de 4 continuam = 75%");
ok(calcularRetencao([1, 2], [1, 2]) === 100, "todos continuam = 100%");
ok(calcularRetencao([1, 2], []) === 0, "ninguém continua = 0%");
ok(calcularRetencao([], [1, 2]) === null, "sem ninguém no início, não tem o que reter → null, não 0%");

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
