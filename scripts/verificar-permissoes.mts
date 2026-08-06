/**
 * Verificacao do controle de acesso (RBAC).
 *
 *   npm run verificar:permissoes
 *
 * Roda no Node, sem banco e sem navegador: as regras de quem-ve-o-que sao
 * funcoes puras, e e exatamente por isso que elas podem ser conferidas assim.
 *
 * Uma matriz de permissoes e o tipo de coisa que parece obviamente certa
 * lendo e esta errada rodando — basta uma chave escrita "rel-frequencias" numa
 * lista e "rel-frequencia" noutra para um relatorio do campo inteiro ficar
 * aberto sem que nada acuse. Aqui cada afirmacao e checada uma a uma.
 */
import {
  PAPEIS,
  escopoDe,
  papelDoCargo,
  papelHerdado,
  papelPrincipal,
  podeGravar,
  podeVer,
  rotuloDoPapel,
  type Papel,
} from "../lib/auth/papeis";
import { MENU, MENU_GRUPOS, itemAtivo, menuVisivel } from "../lib/dashboard/navegacao";
import { montarAcesso } from "../lib/auth/acesso";

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "OK  " : "FALHA"}  ${msg}`);
  if (!cond) falhas++;
};

const CAMPO: Papel[] = ["pastor-presidente", "gestor-local", "supervisor", "secretario-geral"];
const CONGREGACAO: Papel[] = ["dirigente", "vice-dirigente", "secretario-local", "professor"];

console.log("\n1. o menu cobre as 6 categorias pedidas");
const rotulos = MENU_GRUPOS.map((g) => g.rotulo);
for (const esperado of [
  "Dashboard",
  "Escola Bíblica",
  "Administração",
  "Relatórios",
  "Agenda",
  "Configurações",
]) {
  ok(rotulos.includes(esperado), `categoria "${esperado}"`);
}

console.log("\n2. nenhuma chave de menu repetida");
const chaves = MENU.map((i) => i.chave);
ok(new Set(chaves).size === chaves.length, `${chaves.length} chaves, todas distintas`);
const hrefs = MENU.map((i) => i.href);
ok(new Set(hrefs).size === hrefs.length, `${hrefs.length} endereços, todos distintos`);

console.log("\n3. toda permissao aponta para um modulo que existe");
// Sem isto, uma lista com "rel-frequencias" (plural, errado) liberaria nada e
// pareceria liberar tudo — o defeito mais silencioso possivel numa matriz.
for (const p of PAPEIS) {
  const orfas = [...p.modulos, ...p.gravar].filter(
    (c) => c !== "*" && !chaves.includes(c),
  );
  ok(orfas.length === 0, `${p.rotulo}: sem chave órfã${orfas.length ? ` (${orfas.join(", ")})` : ""}`);
}

console.log("\n4. gravar nunca existe sem ver");
for (const p of PAPEIS) {
  const invalidas = MENU.filter(
    (i) => podeGravar([p.papel], i.chave) && !podeVer([p.papel], i.chave),
  );
  ok(invalidas.length === 0, `${p.rotulo}: nada gravável e invisível`);
}

console.log("\n5. o grupo A enxerga o campo; o grupo B, só a congregação");
for (const p of CAMPO) ok(escopoDe([p]) === "campo", `${rotuloDoPapel(p)} → campo`);
for (const p of CONGREGACAO)
  ok(escopoDe([p]) === "congregacao", `${rotuloDoPapel(p)} → congregação`);

console.log("\n6. o grupo B NAO alcança a administração do sistema");
for (const p of CONGREGACAO) {
  ok(!podeVer([p], "usuarios"), `${rotuloDoPapel(p)} não vê Usuários`);
  ok(!podeVer([p], "permissoes"), `${rotuloDoPapel(p)} não vê Permissões`);
  ok(!podeVer([p], "cfg-backup"), `${rotuloDoPapel(p)} não vê Backup`);
  ok(!podeVer([p], "cfg-logs"), `${rotuloDoPapel(p)} não vê Logs`);
  ok(!podeVer([p], "rel-auditoria"), `${rotuloDoPapel(p)} não vê Auditoria`);
}

console.log("\n7. os botões de CRUD existem em TODOS os níveis (decisão da liderança)");
// O recorte por congregação continua valendo: quem grava, grava na sua.
for (const p of CONGREGACAO) {
  for (const modulo of ["chamada", "alunos", "classes", "visitantes"]) {
    ok(podeGravar([p], modulo), `${rotuloDoPapel(p)} grava em ${modulo}`);
  }
}

console.log("\n8. e o que continua fora do alcance do grupo B");
for (const p of CONGREGACAO) {
  ok(!podeGravar([p], "lideranca"), `${rotuloDoPapel(p)} NÃO altera a liderança`);
  ok(!podeVer([p], "professores"), `${rotuloDoPapel(p)} NÃO vê a aba Professores`);
}

console.log("\n9. supervisão, gestão e secretaria geral têm a autonomia da administração");
for (const p of ["supervisor", "gestor-local", "secretario-geral"] as Papel[]) {
  ok(podeGravar([p], "usuarios"), `${rotuloDoPapel(p)} administra contas`);
  ok(podeGravar([p], "permissoes"), `${rotuloDoPapel(p)} alcança as permissões`);
  ok(podeGravar([p], "cfg-backup"), `${rotuloDoPapel(p)} alcança o backup`);
  ok(podeVer([p], "professores"), `${rotuloDoPapel(p)} vê a aba Professores`);
  ok(escopoDe([p]) === "campo", `${rotuloDoPapel(p)} enxerga o campo inteiro`);
}
// A autonomia é do CARGO, e o cargo é dado: nenhum nome de pessoa no código.
ok(
  !JSON.stringify(PAPEIS).toLowerCase().includes("luiz") &&
    !JSON.stringify(PAPEIS).toLowerCase().includes("danilo"),
  "nenhum nome de pessoa aparece na matriz de permissões",
);

console.log("\n10. quem acumula papéis soma acessos, e o mais alto vence");
const acumula: Papel[] = ["professor", "supervisor"];
ok(escopoDe(acumula) === "campo", "Professor + Supervisor enxerga o campo");
ok(podeGravar(acumula, "chamada"), "continua gravando chamada");
ok(podeVer(acumula, "rel-auditoria"), "ganha o que o Supervisor tem");
ok(papelPrincipal(acumula) === "supervisor", "o papel exibido é o mais alto");

console.log("\n11. do cargo ao papel");
ok(papelDoCargo("Supervisor da EBD") === "supervisor", "Supervisor da EBD");
ok(papelDoCargo("Dirigente") === "dirigente", "Dirigente");
ok(papelDoCargo("Vice-Dirigente") === "vice-dirigente", "Vice-Dirigente");
ok(papelDoCargo("Secretário Local") === "secretario-local", "Secretário Local");
ok(papelDoCargo("Professor") === "professor", "Professor");
// Cargo desconhecido NAO pode abrir porta nenhuma: e o padrao seguro.
ok(papelDoCargo("Auxiliar de Secretaria") === null, "cargo novo não ganha acesso sozinho");

console.log("\n12. as contas herdadas da planilha");
ok(papelHerdado("master") === "administrador", '"master" → administrador do sistema');
ok(papelHerdado("coord") === "dirigente", '"coord" → dirigente da própria congregação');
ok(
  papelHerdado("master") !== "pastor-presidente",
  "a conta técnica NÃO se apresenta como um cargo da igreja",
);

console.log("\n13. o acesso apurado a partir de uma conta");
const semPessoa = montarAcesso({ id: 6, perfil: "coord", congId: 4, pessoaId: null }, []);
ok(semPessoa.escopo === "congregacao", "conta de congregação → escopo de congregação");
ok(semPessoa.congIds.length === 1 && semPessoa.congIds[0] === 4, "só a congregação 4");
ok(semPessoa.presumido, "marcada como PRESUMIDA — o portal deduziu, não leu de um cargo");

const comCargo = montarAcesso({ id: 20, perfil: "coord", congId: 4, pessoaId: 7 }, [
  { congId: 4, cargo: { nome: "Dirigente" } },
  { congId: 9, cargo: { nome: "Professor" } },
]);
ok(!comCargo.presumido, "com cargo, o acesso NÃO é presumido");
ok(comCargo.escopo === "congregacao", "dois cargos de congregação → escopo de congregação");
ok(
  comCargo.congIds.length === 2 && comCargo.congIds.includes(4) && comCargo.congIds.includes(9),
  "enxerga as DUAS congregações onde exerce função",
);

const doCampo = montarAcesso({ id: 1, perfil: "coord", congId: 4, pessoaId: 3 }, [
  { congId: null, cargo: { nome: "Supervisor da EBD" } },
  { congId: 4, cargo: { nome: "Professor" } },
]);
ok(doCampo.escopo === "campo", "um cargo de campo basta para enxergar o campo");
ok(
  doCampo.congIds.length === 0,
  "quem vê o campo NÃO carrega lista de congregações — a lista viraria um filtro",
);

const cargoSemPapel = montarAcesso({ id: 30, perfil: "coord", congId: 5, pessoaId: 9 }, [
  { congId: 5, cargo: { nome: "Cargo Inventado" } },
]);
ok(
  cargoSemPapel.presumido && cargoSemPapel.congIds[0] === 5,
  "pessoa sem cargo reconhecido não fica trancada do lado de fora",
);

console.log("\n14. o menu some junto com a permissão");
const menuProfessor = menuVisivel(["professor"]);
ok(
  !menuProfessor.some((g) => g.rotulo === "Administração"),
  "o Professor não vê a seção Administração inteira",
);
ok(
  menuProfessor.some((g) => g.itens.some((i) => i.chave === "chamada")),
  "e continua vendo a Chamada",
);
ok(
  menuVisivel(["pastor-presidente"]).length === MENU_GRUPOS.length,
  "o Pastor Presidente vê as 6 categorias",
);
ok(menuVisivel(null).length === MENU_GRUPOS.length, "sem sessão, o menu aparece inteiro");
ok(
  menuVisivel([]).length === MENU_GRUPOS.length,
  "sem papéis, idem — nunca um menu vazio por acidente",
);

console.log("\n15. o item ativo é o endereço mais específico");
ok(itemAtivo("/dashboard") === "dashboard", "/dashboard");
ok(itemAtivo("/dashboard/chamada") === "chamada", "/dashboard/chamada");
ok(
  itemAtivo("/dashboard/relatorios/ranking") === "rel-ranking",
  "/dashboard/relatorios/ranking acende Ranking, e não Frequência",
);
ok(itemAtivo("/dashboard/relatorios") === "rel-frequencia", "/dashboard/relatorios");
ok(itemAtivo("/dashboard/alunos/12") === "alunos", "subtela de um aluno acende Alunos");

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
