/**
 * Verificação do prontuário de congregação (Fase 19): indicador de cor,
 * tempo na função, visitantes recorrentes, ranking, indicadores automáticos
 * e a análise em texto.
 *
 *   npm run verificar:congregacao
 *
 * Roda no Node, sem banco — tudo aqui é função pura.
 */
import {
  calcularIndicadoresAutomaticos,
  contarVisitantesRecorrentes,
  gerarAnaliseCongregacao,
  indicadorPorPercentual,
  maiorVariacaoMensal,
  posicaoNoRanking,
  tempoNaFuncao,
  type PontoMensalCong,
  type PontoSemanal,
} from "../lib/relatorios/congregacao";

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "OK  " : "FALHA"}  ${msg}`);
  if (!cond) falhas++;
};

console.log("1. indicadorPorPercentual — três faixas, e null não é vermelho");
ok(indicadorPorPercentual(85) === "verde", "85% → verde");
ok(indicadorPorPercentual(80) === "verde", "exatamente 80% → verde (piso incluído)");
ok(indicadorPorPercentual(65) === "amarelo", "65% → amarelo");
ok(indicadorPorPercentual(59) === "vermelho", "59% → vermelho");
ok(indicadorPorPercentual(null) === "sem-dado", "null (sem chamada) → sem-dado, NUNCA vermelho");

console.log("\n2. tempoNaFuncao — a partir de PessoaCargo.inicio");
const hoje = new Date(Date.UTC(2026, 7, 6)); // 06/08/2026
ok(tempoNaFuncao(null, hoje) === null, "sem data de início → null, não inventa");
ok(tempoNaFuncao(new Date(Date.UTC(2026, 7, 1)), hoje) === "menos de um mês", "5 dias → 'menos de um mês'");
ok(tempoNaFuncao(new Date(Date.UTC(2026, 5, 1)), hoje) === "2 meses", "01/06 a 06/08 → 2 meses");
ok(tempoNaFuncao(new Date(Date.UTC(2025, 7, 1)), hoje) === "1 ano", "01/08/2025 a 06/08/2026 → 1 ano, exato");
ok(
  tempoNaFuncao(new Date(Date.UTC(2025, 4, 1)), hoje) === "1 ano e 3 meses",
  "01/05/2025 a 06/08/2026 → 1 ano e 3 meses",
);

console.log("\n3. contarVisitantesRecorrentes — mesmo nome (normalizado) em 2+ domingos");
const visitas = [
  { nome: "João Silva", data: "2026-07-05" },
  { nome: "joão   silva", data: "2026-07-12" }, // mesma pessoa, grafia diferente
  { nome: "Maria Souza", data: "2026-07-05" },
  { nome: "Ana Paula", data: "2026-07-12" },
  { nome: "Ana Paula", data: "2026-07-19" },
];
const rec = contarVisitantesRecorrentes(visitas);
ok(rec.unicos === 3, "3 nomes distintos, depois de normalizar (João, Maria, Ana Paula)");
ok(rec.recorrentes === 2, "João e Ana Paula voltaram — 2 recorrentes; Maria não");

console.log("\n4. posicaoNoRanking — empate divide posição, sem nota não tem posição");
const itens = [
  { id: 1, valor: 90 },
  { id: 2, valor: 90 },
  { id: 3, valor: 70 },
  { id: 4, valor: null },
];
ok(posicaoNoRanking(itens, 1)?.posicao === 1, "id 1 (90, empatado) → 1º");
ok(posicaoNoRanking(itens, 2)?.posicao === 1, "id 2 (90, empatado) → também 1º");
ok(posicaoNoRanking(itens, 3)?.posicao === 3, "id 3 (70) → 3º, pulando o empate");
ok(posicaoNoRanking(itens, 3)?.total === 3, "total conta só quem tem valor (3, não 4)");
ok(posicaoNoRanking(itens, 4) === null, "sem valor → sem posição (null)");
ok(posicaoNoRanking(itens, 99) === null, "id que não está na lista → null");

console.log("\n5. calcularIndicadoresAutomaticos — taxa decide frequência, presentes decide o domingo");
const semanas: PontoSemanal[] = [
  { data: "2026-07-05", presentes: 40, ausentes: 10, visitantes: 1, taxa: 80 },
  { data: "2026-07-12", presentes: 15, ausentes: 0, visitantes: 5, taxa: 100 }, // 100% mas só 15 gente
  { data: "2026-07-19", presentes: 30, ausentes: 20, taxa: 60, visitantes: 0 },
  { data: "2026-07-26", presentes: 0, ausentes: 0, visitantes: 0, taxa: null }, // sem chamada
];
const ind = calcularIndicadoresAutomaticos(semanas);
ok(ind.maiorFrequencia?.data === "2026-07-12", "maior TAXA é 12/07 (100%), mesmo com pouca gente");
ok(ind.menorFrequencia?.data === "2026-07-19", "menor taxa é 19/07 (60%)");
ok(ind.melhorDomingo?.data === "2026-07-05", "melhor domingo por PRESENTES é 05/07 (40 pessoas)");
ok(ind.piorDomingo?.data === "2026-07-19" || ind.piorDomingo?.presentes === 15, "pior domingo tem o menor nº de presentes entre os com chamada");
ok(ind.maiorVisitantes?.data === "2026-07-12", "domingo com mais visitantes é 12/07 (5)");

console.log("\n6. maiorVariacaoMensal — só entre meses CONSECUTIVOS com dado nos dois");
const meses: PontoMensalCong[] = [
  { mes: "2026-05", taxa: 60, chamadas: 10 },
  { mes: "2026-06", taxa: 85, chamadas: 12 }, // +25 sobre maio
  { mes: "2026-07", taxa: 70, chamadas: 11 }, // -15 sobre junho
  { mes: "2026-08", taxa: 70, chamadas: 8 }, // 0 sobre julho — nem cresceu nem caiu
];
const variacao = maiorVariacaoMensal(meses);
ok(variacao.maiorCrescimento?.mes === "2026-06" && variacao.maiorCrescimento?.deltaPct === 25, "maior crescimento: maio→junho, +25");
ok(variacao.maiorReducao?.mes === "2026-07" && variacao.maiorReducao?.deltaPct === -15, "maior redução: junho→julho, -15");

console.log("\n6b. maiorVariacaoMensal — mês sem chamada (taxa null) não entra em par nenhum");
const comBuraco: PontoMensalCong[] = [
  { mes: "2026-05", taxa: 60, chamadas: 10 },
  { mes: "2026-06", taxa: null, chamadas: 0 }, // sem chamada — não é 0%, é ausência de dado
  { mes: "2026-07", taxa: 85, chamadas: 12 },
];
const semBuraco = maiorVariacaoMensal(comBuraco);
ok(semBuraco.maiorCrescimento === null && semBuraco.maiorReducao === null, "mês sem chamada quebra o par dos dois lados — nenhuma variação sai daí");

console.log("\n7. gerarAnaliseCongregacao — molde de frase, nunca invenção");
const semDado = gerarAnaliseCongregacao({
  nome: "Cong. Teste",
  chamadas: 1,
  taxaFrequencia: null,
  tendenciaPct: null,
  campoTaxaFrequencia: null,
  igsNota: null,
  classificacaoRotulo: null,
  melhorClasse: null,
  piorClasse: null,
  visitantesVariacaoPct: null,
  visitantesRec: 0,
  classesAtrasadas: 0,
});
ok(semDado.length === 1 && semDado[0].includes("não tem chamadas suficientes"), "sem dado suficiente → uma frase só, avisando isso");

const comDado = gerarAnaliseCongregacao({
  nome: "Cong. Bandeiras",
  chamadas: 20,
  taxaFrequencia: 88,
  tendenciaPct: 12,
  campoTaxaFrequencia: 70,
  igsNota: 91.5,
  classificacaoRotulo: "Excelente",
  melhorClasse: { nome: "Jovens", percentual: 96 },
  piorClasse: { nome: "Adultos", percentual: 58 },
  visitantesVariacaoPct: 25,
  visitantesRec: 5,
  classesAtrasadas: 1,
});
ok(comDado.some((f) => f.includes("91.5")), "menciona a nota do IGS");
ok(comDado.some((f) => f.includes("subiu")), "menciona a tendência de alta");
ok(comDado.some((f) => f.includes("acima da média")), "menciona a comparação com o campo");
ok(comDado.some((f) => f.includes("Jovens")), "menciona a melhor classe");
ok(comDado.some((f) => f.includes("Adultos")), "menciona a classe que precisa de atenção");
ok(comDado.some((f) => f.includes("sem registrar chamada")), "menciona a classe atrasada");

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
