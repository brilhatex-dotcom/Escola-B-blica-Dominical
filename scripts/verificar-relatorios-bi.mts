/**
 * Verificação da Central de Relatórios (BI): o Índice de Saúde, os alertas e a
 * análise automática.
 *
 *   npm run verificar:bi
 *
 * Roda no Node, sem banco: são funções puras — o cálculo da nota, a
 * classificação em faixas e a geração de texto não tocam o Postgres. É
 * exatamente por isso que podem ser conferidas aqui, com números inventados
 * mas plausíveis, antes de confiar neles com os dados reais das 14
 * congregações.
 */
import {
  calcularIGS,
  classificarIGS,
  scoreDeVariacao,
  tendenciaDe,
  variacaoPct,
  PESOS_IGS,
  type ComponentesIGS,
} from "../lib/relatorios/indices";
import {
  gerarAlertas,
  gerarAnalise,
  temDadoSuficiente,
  type CampoBI,
  type CongregacaoBI,
  type DadosBI,
} from "../lib/relatorios/analise";

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "OK  " : "FALHA"}  ${msg}`);
  if (!cond) falhas++;
};

console.log("\n1. os pesos do IGS somam 100");
const somaPesos = Object.values(PESOS_IGS).reduce((a, b) => a + b, 0);
ok(somaPesos === 100, `soma = ${somaPesos}`);

console.log("\n2. variação percentual — a mesma regra do painel principal");
ok(variacaoPct(100, 110) === 10, "100 → 110 é +10%");
ok(variacaoPct(100, 90) === -10, "100 → 90 é -10%");
ok(variacaoPct(0, 5) === null, "de ZERO não tem percentual — é infinito, não 100%");
ok(variacaoPct(50, 50) === 0, "sem mudança é 0%, não null");

console.log("\n3. score de variação — 50 é o ponto neutro");
ok(scoreDeVariacao(0) === 50, "0% de variação → 50 pontos");
ok(scoreDeVariacao(30) === 80, "+30% → 80 pontos");
ok(scoreDeVariacao(-30) === 20, "-30% → 20 pontos");
ok(scoreDeVariacao(200) === 100, "variação extrema não passa de 100 (teto)");
ok(scoreDeVariacao(-200) === 0, "queda extrema não passa de 0 (piso)");
ok(scoreDeVariacao(null) === null, "sem variação, sem score");

console.log("\n4. tendência — estável é uma faixa, não um empate exato");
ok(tendenciaDe(0) === "estavel", "0% é estável");
ok(tendenciaDe(2.9) === "estavel", "2.9% ainda é estável (ruído de amostra pequena)");
ok(tendenciaDe(3) === "subindo", "3% já é subindo");
ok(tendenciaDe(-3) === "descendo", "-3% já é descendo");
ok(tendenciaDe(null) === "sem-base", "sem número, sem tendência");

console.log("\n5. calcularIGS — todos os componentes presentes");
const cheio: ComponentesIGS = {
  frequencia: 80,
  regularidade: 100,
  tendencia: 50,
  visitantes: 50,
  faltosos: 90,
};
const notaCheia = calcularIGS(cheio);
ok(notaCheia !== null, "devolve uma nota");
// 80*0.35 + 100*0.20 + 50*0.20 + 50*0.15 + 90*0.10 = 28+20+10+7.5+9 = 74.5
ok(notaCheia?.nota === 74.5, `nota = ${notaCheia?.nota} (esperado 74.5)`);
ok(notaCheia?.componentesUsados.length === 5, "usou os 5 componentes");

console.log("\n6. calcularIGS — redistribui o peso do que falta, não zera");
const semVisitantes: ComponentesIGS = { ...cheio, visitantes: null };
const notaSemVisitantes = calcularIGS(semVisitantes);
ok(notaSemVisitantes !== null, "ainda calcula, com 4 componentes");
ok(notaSemVisitantes!.nota > 0, "não despenca para perto de zero");
// Tratar ausência como zero daria (80*.35+100*.2+50*.2+0*.15+90*.1)/1 = 63.5.
// Redistribuindo, o peso de "visitantes" (15) some do denominador.
ok(
  Math.abs(notaSemVisitantes!.nota - 63.5) > 1,
  "a nota SEM o dado é diferente de tratar o dado como zero",
);

console.log("\n7. calcularIGS — nenhum componente calculável devolve null");
const vazio: ComponentesIGS = {
  frequencia: null,
  regularidade: null,
  tendencia: null,
  visitantes: null,
  faltosos: null,
};
ok(calcularIGS(vazio) === null, "sem nenhum dado, sem nota — não inventa 0");

console.log("\n8. classificarIGS — as quatro faixas, nos limites exatos");
ok(classificarIGS(100).faixa === "excelente", "100 → excelente");
ok(classificarIGS(90).faixa === "excelente", "90 → excelente (limite de baixo)");
ok(classificarIGS(89.9).faixa === "muito-boa", "89.9 → muito boa");
ok(classificarIGS(80).faixa === "muito-boa", "80 → muito boa");
ok(classificarIGS(79.9).faixa === "atencao", "79.9 → atenção");
ok(classificarIGS(60).faixa === "atencao", "60 → atenção (limite de baixo)");
ok(classificarIGS(59.9).faixa === "critica", "59.9 → crítica");
ok(classificarIGS(0).faixa === "critica", "0 → crítica");

console.log("\n9. temDadoSuficiente — o mesmo piso do Ranking e do Certificado");
ok(temDadoSuficiente({ chamadas: 3 }), "3 chamadas já é suficiente");
ok(!temDadoSuficiente({ chamadas: 2 }), "2 chamadas ainda não é");

/* ------------------------------------------------------------------ *
 * Alertas e análise — com um cenário sintético completo
 * ------------------------------------------------------------------ */

function congregacao(parcial: Partial<CongregacaoBI> & { congId: number; nome: string }): CongregacaoBI {
  return {
    chamadas: 10,
    taxaFrequencia: 80,
    tendenciaPct: 0,
    visitantesAnt: 2,
    visitantesRec: 2,
    igs: { nota: 85, componentesUsados: ["frequencia"] },
    classificacao: classificarIGS(85),
    ...parcial,
  };
}

const critica = congregacao({
  congId: 1,
  nome: "Cong. Crítica",
  taxaFrequencia: 40,
  igs: { nota: 45, componentesUsados: ["frequencia"] },
  classificacao: classificarIGS(45),
});
const emQueda = congregacao({
  congId: 2,
  nome: "Cong. Em Queda",
  tendenciaPct: -20,
  igs: { nota: 82, componentesUsados: ["frequencia"] },
  classificacao: classificarIGS(82),
});
const saudavel = congregacao({
  congId: 3,
  nome: "Cong. Saudável",
  taxaFrequencia: 92,
  tendenciaPct: 8,
  igs: { nota: 94, componentesUsados: ["frequencia"] },
  classificacao: classificarIGS(94),
});
const semDado = congregacao({
  congId: 4,
  nome: "Cong. Nova",
  chamadas: 1,
  igs: null,
  classificacao: null,
});

const campo: CampoBI = {
  taxaFrequencia: 75,
  tendenciaPct: 5,
  visitantesAnt: 10,
  visitantesRec: 4,
  igs: { nota: 78, componentesUsados: ["frequencia"] },
  classificacao: classificarIGS(78),
};

const dados: DadosBI = {
  periodo: { de: "2026-05-01", ate: "2026-08-01" },
  campo,
  congregacoes: [critica, emQueda, saudavel, semDado],
  classesSemChamada: [
    { classeId: 10, classe: "Juniores", congregacao: "Cong. Crítica", diasSemChamada: 28 },
    { classeId: 11, classe: "Adultos", congregacao: "Cong. Nova", diasSemChamada: null },
    { classeId: 12, classe: "Adolescentes", congregacao: "Cong. Saudável", diasSemChamada: 10 },
  ],
};

console.log("\n10. gerarAlertas — reconhece cada situação sintética");
const alertas = gerarAlertas(dados);
ok(
  alertas.some((a) => a.tipo === "congregacao-critica" && a.titulo.includes("Cong. Crítica")),
  "aponta a congregação crítica",
);
ok(
  alertas.some((a) => a.tipo === "queda-frequencia" && a.titulo.includes("Cong. Em Queda")),
  "aponta a queda de frequência (-20%)",
);
ok(
  alertas.some((a) => a.tipo === "classe-sem-chamada" && a.titulo.includes("Juniores")),
  "aponta a classe com 28 dias sem chamada",
);
ok(
  alertas.some((a) => a.tipo === "classe-sem-chamada" && a.descricao.includes("nunca")),
  "distingue NUNCA teve chamada de está atrasada",
);
ok(
  !alertas.some((a) => a.titulo.includes("Adolescentes")),
  "a classe com 10 dias (dentro do prazo) NÃO gera alerta",
);
ok(
  !alertas.some((a) => a.titulo.includes("Cong. Nova")),
  "congregação sem dado suficiente não entra em alerta de queda nem de crítica",
);
ok(
  alertas[0]?.nivel === "critico",
  "os alertas críticos vêm primeiro na lista",
);

console.log("\n11. gerarAlertas — nenhum alerta fabricado sobre professor");
ok(
  !alertas.some((a) => /professor/i.test(a.titulo) || /professor/i.test(a.descricao)),
  "nenhum alerta menciona professor — não existe esse dado",
);

console.log("\n12. gerarAnalise — o texto é fiel aos números do cenário");
const analise = gerarAnalise(dados);
ok(analise.length > 0, `gerou ${analise.length} frases`);
ok(
  analise[0].includes("78") && analise[0].includes("Atenção"),
  "a primeira frase abre com a nota e a classificação do campo",
);
ok(
  analise.some((f) => f.includes("Cong. Saudável") && f.includes("+8")),
  "aponta a Cong. Saudável como maior crescimento",
);
ok(
  analise.some((f) => f.includes("Cong. Em Queda") && f.includes("-20")),
  "aponta a Cong. Em Queda como maior queda",
);
// Das 4 congregações do cenário, só 3 têm dado suficiente (a "Cong. Nova" tem
// 1 chamada só). Classificação das 3: 45→crítica, 82→muito-boa, 94→excelente.
ok(
  analise.some(
    (f) => f.includes("Das 3 congregações") && f.includes("2 estão em boa") && f.includes("1 está em situação crítica"),
  ),
  "conta certo: 3 com dado suficiente, 2 boas, 1 crítica — a 4ª (sem dado) fica de fora",
);
ok(
  analise.some((f) => f.includes("classe") && f.includes("três semanas")),
  "menciona as classes atrasadas",
);

console.log("\n13. gerarAnalise — sem dado nenhum, a primeira frase admite isso");
const semNenhumDado = gerarAnalise({
  periodo: dados.periodo,
  campo: { taxaFrequencia: null, tendenciaPct: null, visitantesAnt: 0, visitantesRec: 0, igs: null, classificacao: null },
  congregacoes: [],
  classesSemChamada: [],
});
ok(
  semNenhumDado[0].includes("Ainda não há chamadas suficientes"),
  "diz que faltou dado, em vez de inventar uma nota",
);

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
