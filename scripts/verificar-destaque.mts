/**
 * Verificação do Destaque do Dashboard (Fase 18): a congregação e a classe
 * mais assíduas e que mais trouxeram visitante, no mês e no trimestre.
 *
 *   npm run verificar:destaque
 *
 * Roda no Node, sem banco — `calcularDestaque` é função pura, os números são
 * inventados mas plausíveis, para conferir a REGRA antes de confiar nela com
 * o dado real das 14 congregações.
 */
import {
  calcularDestaque,
  DESTAQUE_MINIMO_DOMINGOS,
  inicioDoMes,
  inicioDoTrimestre,
  type LinhaDestaque,
} from "../lib/dashboard/destaque";

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "OK  " : "FALHA"}  ${msg}`);
  if (!cond) falhas++;
};

const linha = (parcial: Partial<LinhaDestaque> & { nome: string }): LinhaDestaque => ({
  domingos: 4,
  chamados: 40,
  presentes: 32,
  domingosComVisitante: 2,
  ...parcial,
});

console.log("1. calcularDestaque — a nota é a MÉDIA de duas taxas, nunca um total bruto");
const bandeiras = linha({ nome: "Bandeiras", domingos: 4, chamados: 40, presentes: 36, domingosComVisitante: 4 });
// 90% de presença, 100% dos domingos com visitante -> média 95
const resultado = calcularDestaque([bandeiras]);
ok(resultado !== null, "com dado suficiente, devolve um resultado");
ok(resultado?.taxaFrequencia === 90, "taxa de frequência = presentes ÷ chamados (36/40 = 90%)");
ok(resultado?.taxaVisitantes === 100, "taxa de visitantes = domingos com visitante ÷ domingos (4/4 = 100%)");
ok(resultado?.score === 95, "score = média das duas taxas ((90+100)/2 = 95)");
ok(resultado?.nomes[0] === "Bandeiras", "o nome vem certo");

console.log("\n2. o total bruto de visitantes NÃO decide — só a taxa");
const grande = linha({ nome: "Grande", domingos: 4, chamados: 100, presentes: 80, domingosComVisitante: 2 }); // taxa 50%
const pequena = linha({ nome: "Pequena", domingos: 4, chamados: 20, presentes: 16, domingosComVisitante: 3 }); // taxa 75%
const vencedor = calcularDestaque([grande, pequena]);
ok(vencedor?.nomes[0] === "Pequena",
  "a congregação PEQUENA vence por ter taxa maior, mesmo trazendo menos visitantes brutos que a grande");

console.log(`\n3. piso mínimo de ${DESTAQUE_MINIMO_DOMINGOS} domingos — sem ele, ninguém entra na disputa`);
const poucosDomingos = linha({ nome: "Só Um Domingo", domingos: 1, chamados: 10, presentes: 10, domingosComVisitante: 1 });
ok(calcularDestaque([poucosDomingos]) === null,
  "1 domingo com 100% de presença NÃO vence — não alcança o piso, mesmo sendo perfeito");
const noPiso = linha({ nome: "No Piso", domingos: DESTAQUE_MINIMO_DOMINGOS });
ok(calcularDestaque([noPiso]) !== null, `exatamente ${DESTAQUE_MINIMO_DOMINGOS} domingos já basta`);

console.log("\n4. sem candidata nenhuma, devolve null — não inventa um vencedor");
ok(calcularDestaque([]) === null, "lista vazia → null");
ok(calcularDestaque([linha({ nome: "Sem Chamada", chamados: 0, domingos: 5 })]) === null,
  "domingos suficientes mas zero chamados de verdade → null (não dividir por zero, não inventar 0%)");

console.log("\n5. empate exato — todos entram, ninguém escolhido à força");
const empateA = linha({ nome: "A", domingos: 4, chamados: 40, presentes: 32, domingosComVisitante: 2 }); // 80% + 50% = 65
const empateB = linha({ nome: "B", domingos: 4, chamados: 40, presentes: 32, domingosComVisitante: 2 });
const empatado = calcularDestaque([empateA, empateB]);
ok(empatado?.nomes.length === 2, "as duas empatadas aparecem juntas");
ok(!!empatado?.nomes.includes("A") && !!empatado?.nomes.includes("B"), "com os dois nomes certos");

console.log("\n6. inicioDoMes / inicioDoTrimestre");
const meioDeAgosto = new Date(Date.UTC(2026, 7, 15)); // 15 de agosto de 2026
ok(inicioDoMes(meioDeAgosto).toISOString().slice(0, 10) === "2026-08-01", "início do mês de agosto é 01/08");
ok(inicioDoTrimestre(meioDeAgosto).toISOString().slice(0, 10) === "2026-07-01",
  "agosto está no 3º trimestre (jul-set) — início em 01/07");
const janeiro = new Date(Date.UTC(2026, 0, 10));
ok(inicioDoTrimestre(janeiro).toISOString().slice(0, 10) === "2026-01-01", "janeiro abre o 1º trimestre");
const dezembro = new Date(Date.UTC(2026, 11, 20));
ok(inicioDoTrimestre(dezembro).toISOString().slice(0, 10) === "2026-10-01", "dezembro está no 4º trimestre (out-dez)");

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
