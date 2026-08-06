/**
 * Verificacao do nome de usuario e da senha.
 *
 *   npm run verificar:login
 *
 * Roda no Node, sem banco: sao funcoes puras.
 *
 * ============================================================================
 * ESTE ARQUIVO NASCEU DE UM DEFEITO REAL
 *
 * A tela de Usuarios gravava o login normalizado ("Maria Bandeiras" ->
 * "mariabandeiras") e a rota de login procurava o texto exato. A conta era
 * criada com sucesso e nao entrava nunca — e a mensagem, propositalmente igual
 * para login inexistente e senha errada, mandava procurar o problema na senha.
 *
 * Duas regras para a mesma coisa, em dois arquivos. As assercoes abaixo existem
 * para que a proxima divergencia falhe aqui, e nao no domingo de manha.
 * ============================================================================
 */
import { formasDoLogin, normalizarLogin } from "../lib/auth/login";
import { criticarSenhaNova, ehFormatoAntigo, gerarHash, verificarSenha } from "../lib/auth/senha";

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "OK  " : "FALHA"}  ${msg}`);
  if (!cond) falhas++;
};

console.log("\n1. como o login e gravado");
ok(normalizarLogin("Maria Bandeiras") === "mariabandeiras", '"Maria Bandeiras" -> "mariabandeiras"');
ok(normalizarLogin("  ebdsede  ") === "ebdsede", "espacos das pontas somem");
ok(normalizarLogin("EBD Sede") === "ebdsede", "caixa e espacos do meio somem");

console.log("\n2. a conta criada como 'Maria Bandeiras' entra de tres jeitos");
const gravado = normalizarLogin("Maria Bandeiras");
for (const digitado of ["Maria Bandeiras", "maria bandeiras", "mariabandeiras", "  MARIA BANDEIRAS "]) {
  ok(formasDoLogin(digitado).includes(gravado), `digitando "${digitado.trim()}"`);
}

console.log("\n3. as contas herdadas continuam entrando como sempre entraram");
// Uma das 19 contas da planilha e `Graça` — maiuscula e cedilha. Baixar a caixa
// na entrada consertaria as contas novas quebrando as antigas.
ok(formasDoLogin("Graça")[0] === "Graça", '"Graça" e procurado EXATO primeiro');
ok(formasDoLogin("Graça").length === 2, "e a forma normalizada fica como reserva");
ok(formasDoLogin("admin").length === 1, '"admin" ja e a forma final: uma busca so');
ok(formasDoLogin("ebdbandeiras")[0] === "ebdbandeiras", "logins herdados em caixa baixa: exato");

console.log("\n4. a senha da conta nova e bcrypt, e confere");
const hashNovo = await gerarHash("betania2026");
ok(!ehFormatoAntigo(hashNovo), "nao e SHA-256 herdado");
ok(hashNovo.startsWith("$2"), `formato bcrypt (${hashNovo.slice(0, 7)}…)`);

const certa = await verificarSenha("betania2026", hashNovo);
ok(certa.ok, "a senha certa entra");
ok(!certa.precisaTrocar, "e NAO cai na tela de trocar senha — ja e formato novo");

const errada = await verificarSenha("betania2027", hashNovo);
ok(!errada.ok, "a senha errada nao entra");

console.log("\n5. senha vazia nunca entra");
ok(!(await verificarSenha("", hashNovo)).ok, "senha vazia recusada");
ok(!(await verificarSenha("betania2026", "")).ok, "conta sem hash recusada");

console.log("\n6. as regras da senha inicial");
ok(criticarSenhaNova("12345", "") !== null, "menos de 6 caracteres: recusada");
ok(criticarSenhaNova("123456", "") !== null, "so numeros: recusada");
ok(criticarSenhaNova("betania2026", "") === null, "6+ caracteres e nao so numeros: aceita");

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
