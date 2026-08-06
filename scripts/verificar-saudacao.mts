/**
 * Verificação da saudação do Dashboard (Fase 16): separar o tratamento do
 * nome, e trocá-lo pela forma por extenso.
 *
 *   npm run verificar:saudacao
 *
 * Roda no Node, sem banco — funções puras de `lib/pessoas/nome.ts`. O bug
 * real era "Bom dia, Ir.ª." (sem nome nenhum, porque a primeira palavra do
 * texto livre era o próprio tratamento); estas asserções travam essa regressão.
 */
import { separarTratamento, tratamentoPorExtenso } from "../lib/pessoas/nome";

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "OK  " : "FALHA"}  ${msg}`);
  if (!cond) falhas++;
};

console.log("1. separarTratamento — a base de tudo");
ok(separarTratamento("Ir.ª Jéssica Sousa").tratamento === "Ir.ª", "reconhece 'Ir.ª'");
ok(separarTratamento("Ir.ª Jéssica Sousa").nome === "Jéssica Sousa", "o nome fica sem o tratamento");
ok(separarTratamento("Maria José").tratamento === null, "sem tratamento reconhecido, fica null");
ok(separarTratamento("Aux. Bartolomeu").tratamento === "Aux.", "'Aux.' também é reconhecido");
ok(separarTratamento("Secretaria da EBD").tratamento === null, "nome de conta técnica não tem tratamento");

console.log("\n2. tratamentoPorExtenso — a forma que se diz em voz alta");
ok(tratamentoPorExtenso("Ir.ª") === "Irmã", "'Ir.ª' → 'Irmã'");
ok(tratamentoPorExtenso("Ir.") === "Irmão", "'Ir.' → 'Irmão'");
ok(tratamentoPorExtenso("Pr.") === "Pastor", "'Pr.' → 'Pastor'");
ok(tratamentoPorExtenso("Pra.") === "Pastora", "'Pra.' → 'Pastora'");
ok(tratamentoPorExtenso("Pb.") === "Presbítero", "'Pb.' → 'Presbítero'");
ok(tratamentoPorExtenso("Aux.") === "Auxiliar", "'Aux.' → 'Auxiliar'");
ok(tratamentoPorExtenso(null) === null, "sem tratamento, sem forma por extenso");
ok(tratamentoPorExtenso("Xyz.") === "Xyz.", "tratamento desconhecido devolve como veio, não some");

console.log("\n3. o cenário real que estava quebrado: 'Bom dia, Ir.ª.' vira 'Bom dia, Irmã Jéssica.'");
function saudacaoDoNome(nomeCompleto: string): string {
  const { tratamento, nome } = separarTratamento(nomeCompleto);
  const primeiro = nome.trim().split(/\s+/)[0] ?? nome;
  const extenso = tratamentoPorExtenso(tratamento);
  return extenso ? `${extenso} ${primeiro}` : primeiro;
}
ok(saudacaoDoNome("Ir.ª Jéssica Sousa") === "Irmã Jéssica", "o caso real reportado");
ok(saudacaoDoNome("Maria José da Silva") === "Maria", "sem tratamento, só o primeiro nome — comportamento antigo preservado");
ok(saudacaoDoNome("Pr. João") === "Pastor João", "um nome de uma palavra só depois do tratamento");

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
