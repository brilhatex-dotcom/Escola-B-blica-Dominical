/**
 * Verificacao da camada offline (Dexie/IndexedDB + fila de sincronizacao).
 *
 *   npm run verificar:offline
 *
 * Roda no Node, sem navegador: `fake-indexeddb` implementa o IndexedDB em
 * memoria, entao o mesmo codigo que roda no celular do professor e exercitado
 * aqui — inclusive as transacoes, que sao a parte que nao pode falhar.
 */
import "fake-indexeddb/auto";
import { db, pendencias, limparBancoLocal } from "../lib/db/local";
import { salvar, remover, receberDoServidor, confirmarEnvio } from "../lib/db/repositorio";
import { guardarChamada, lerChamadaLocal, situacaoDoEnvio, uidDaChamada } from "../lib/db/chamadas";
import { ErroPermanente } from "../lib/sync/erros";
import {
  configurarTransporte,
  liberarBloqueios,
  sincronizar,
  type Transporte,
} from "../lib/sync/motor";
import type { Aluno, ChamadaLocal, Frequencia, ItemFila } from "../lib/db/schema";

/*
 * O motor consulta `navigator.onLine` antes de tentar qualquer envio.
 *
 * No Node 21 em diante existe um `navigator` global — mas sem `onLine`, que e
 * coisa de navegador. O motor entao leria `undefined`, concluiria "offline" e
 * nao enviaria nada, e os testes de sincronizacao passariam por engano sem
 * jamais exercitar o transporte. Aqui ele e declarado explicitamente, e a
 * funcao abaixo permite simular a queda do sinal.
 */
function fingirConexao(ligada: boolean) {
  const nav = (globalThis as { navigator?: unknown }).navigator ?? {};
  Object.defineProperty(nav, "onLine", { value: ligada, configurable: true });
  Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true });
}
fingirConexao(true);

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "OK  " : "FALHA"}  ${msg}`);
  if (!cond) falhas++;
};

const banco = db();

console.log("\n1. gravar um aluno offline");
const uid = await salvar<Aluno>("alunos", {
  nome: "Maria da Silva", congId: 3, classeId: 12, ativo: true,
});
const aluno = await banco.alunos.get(uid);
ok(aluno?.nome === "Maria da Silva", "aluno gravado na tabela local");
ok(aluno?.estado === "pendente", 'estado nasce "pendente"');
ok(aluno?.idRemoto === undefined, "sem id do servidor ainda");
ok((await banco.fila.count()) === 1, "1 item na fila de sincronizacao");
ok((await banco.fila.toArray())[0].operacao === "criar", 'operacao "criar"');

console.log("\n2. alterar o mesmo aluno");
await salvar<Aluno>("alunos", { uid, nome: "Maria da Silva Santos", ativo: true });
ok((await banco.alunos.get(uid))?.nome === "Maria da Silva Santos", "nome atualizado");
ok((await banco.fila.count()) === 2, "2 itens na fila");
ok((await banco.fila.toArray())[1].operacao === "atualizar", 'segunda e "atualizar"');

console.log("\n3. marcar presenca referenciando o aluno pelo uid");
await salvar<Frequencia>("frequencias", {
  alunoUid: uid, classeId: 12, congId: 3, data: "2026-08-09", presente: true,
});
const freqs = await banco.frequencias.where("[classeId+data]").equals([12, "2026-08-09"]).toArray();
ok(freqs.length === 1, "indice composto [classeId+data] encontra a chamada");
ok(freqs[0].alunoUid === uid, "presenca aponta para o uid, nao para um id remoto");

console.log("\n4. o servidor confirma o envio");
await confirmarEnvio("alunos", uid, 512);
const confirmado = await banco.alunos.get(uid);
ok(confirmado?.idRemoto === 512, "id do servidor guardado");
ok(confirmado?.estado === "sincronizado", 'estado vira "sincronizado"');

console.log("\n5. carga do servidor NAO atropela alteracao local pendente");
const uidPendente = await salvar<Aluno>("alunos", { nome: "Cadastrado no domingo", ativo: true });
const r = await receberDoServidor<Aluno>("alunos", [
  { uid, nome: "Maria (versao do servidor)", ativo: true, idRemoto: 512 } as never,
  { uid: uidPendente, nome: "Sobrescrito pelo servidor", ativo: true } as never,
]);
ok(r.gravados === 1 && r.preservados === 1, "1 gravado, 1 preservado");
ok((await banco.alunos.get(uid))?.nome === "Maria (versao do servidor)", "sincronizado foi atualizado");
ok((await banco.alunos.get(uidPendente))?.nome === "Cadastrado no domingo", "PENDENTE foi preservado");

console.log("\n6. remover algo que nunca subiu limpa a fila junto");
const antes = await banco.fila.count();
await remover("alunos", uidPendente);
ok((await banco.alunos.get(uidPendente)) === undefined, "registro removido");
ok((await banco.fila.count()) < antes, "itens orfaos saem da fila");
ok((await banco.fila.where("uid").equals(uidPendente).count()) === 0, "nada pendente para ele");

console.log("\n7. remover algo JA sincronizado enfileira a remocao");
await remover("alunos", uid);
const remocao = await banco.fila.where("uid").equals(uid).toArray();
ok(remocao.some((i) => i.operacao === "remover"), "remocao enfileirada para o servidor");

console.log("\n8. contagem de pendencias");
const p = await pendencias();
ok(typeof p.total === "number" && p.total > 0, `total de pendencias = ${p.total}`);

await limparBancoLocal();
ok((await banco.alunos.count()) === 0 && (await banco.fila.count()) === 0, "limpeza total");

/* ================================================================== *
 * A chamada como PACOTE, e o motor esvaziando a fila.
 *
 * Daqui para baixo o que esta sendo exercitado e o caminho do domingo:
 * o professor marca a chamada sem sinal, fecha o aplicativo, e ela sobe
 * sozinha quando a internet volta.
 * ================================================================== */

const CLASSE = 12;
const DIA = "2026-08-09";

console.log("\n9. gravar a chamada offline");
await guardarChamada({
  classeId: CLASSE,
  data: DIA,
  // Tres alunos na classe; o 33 fica SEM MARCAR de proposito.
  marcas: [
    { alunoId: 31, presente: true },
    { alunoId: 32, presente: false },
  ],
  cache: {
    classeNome: "Juniores",
    faixa: "9 a 11 anos",
    professores: ["Ana Maria da Costa"],
    alunos: [
      { id: 31, nome: "Pedro", nasc: null },
      { id: 32, nome: "Tiago", nasc: null },
      { id: 33, nome: "João", nasc: null },
    ],
  },
});

const guardada = await lerChamadaLocal(CLASSE, DIA);
ok(guardada?.uid === uidDaChamada(CLASSE, DIA), "uid calculado a partir de classe + data");
ok(guardada?.estado === "pendente", 'chamada nasce "pendente"');
ok((await banco.fila.count()) === 1, "UM item na fila para a classe inteira, nao um por aluno");
ok(guardada?.marcas.length === 2, "so os marcados entram no pacote");
ok(
  !guardada?.marcas.some((m) => m.alunoId === 33),
  'o aluno "nao marcado" NAO virou ausente',
);
ok(guardada?.cache?.alunos.length === 3, "o instantaneo guarda a classe inteira para a tela abrir offline");

console.log("\n10. gravar de novo SUBSTITUI o pacote, nao acumula");
await guardarChamada({
  classeId: CLASSE,
  data: DIA,
  marcas: [
    { alunoId: 31, presente: true },
    { alunoId: 32, presente: true },
    { alunoId: 33, presente: false },
  ],
});
ok((await banco.fila.count()) === 1, "continua UM item na fila");
ok((await banco.chamadas.count()) === 1, "continua UMA chamada guardada");
const regravada = await lerChamadaLocal(CLASSE, DIA);
ok(regravada?.marcas.find((m) => m.alunoId === 32)?.presente === true, "a marcacao nova venceu");
ok(regravada?.marcas.length === 3, "o pacote novo substituiu o antigo por inteiro");

console.log("\n11. o servidor recusa com 403 (senha herdada) — nao adianta repetir");
let tentativasNoServidor = 0;
const servidorRecusando: Transporte = async () => {
  tentativasNoServidor++;
  throw new ErroPermanente("Troque a senha antes de gravar.", "Abra “Trocar senha”.");
};
configurarTransporte(servidorRecusando);

const recusado = await sincronizar();
ok(recusado.estado === "bloqueado", 'motor entra em "bloqueado"');
ok(recusado.restantes === 1, "a chamada CONTINUA na fila — nada foi descartado");
ok(tentativasNoServidor === 1, "uma tentativa");

await sincronizar();
await sincronizar();
ok(tentativasNoServidor === 1, "as passadas seguintes nem chegam a bater no servidor");

const situacaoBloqueada = await situacaoDoEnvio(CLASSE, DIA);
ok(situacaoBloqueada.situacao === "bloqueada", "a tela consegue dizer que o envio foi recusado");
ok(
  situacaoBloqueada.situacao === "bloqueada" && situacaoBloqueada.motivo.includes("senha"),
  "e consegue dizer o porque",
);

console.log("\n12. trocada a senha, a chamada sobe — inteira, num pacote so");
const recebido: Array<{ classeId: number; data: string; presencas: number }> = [];
const servidorOk: Transporte = async (item: ItemFila) => {
  const pacote = item.dados as ChamadaLocal;
  recebido.push({
    classeId: pacote.classeId,
    data: pacote.data,
    presencas: pacote.marcas.length,
  });
  return {};
};
configurarTransporte(servidorOk);

const liberados = await liberarBloqueios();
ok(liberados === 1, "1 item liberado ao trocar a senha");

const subiu = await sincronizar();
ok(subiu.enviados === 1, "UMA requisicao levou a chamada inteira");
ok(subiu.restantes === 0, "fila vazia");
ok(subiu.estado === "ocioso", 'motor volta a "ocioso"');
ok(recebido.length === 1 && recebido[0].presencas === 3, "o servidor recebeu as 3 marcacoes juntas");
ok((await lerChamadaLocal(CLASSE, DIA))?.estado === "sincronizado", 'chamada vira "sincronizada"');
ok(
  (await situacaoDoEnvio(CLASSE, DIA)).situacao === "enviada",
  "a tela consegue dizer que subiu",
);

console.log("\n13. falha passageira de rede continua sendo para insistir");
await guardarChamada({ classeId: 99, data: DIA, marcas: [{ alunoId: 40, presente: true }] });
configurarTransporte(async () => {
  throw new Error("Failed to fetch");
});
const passageiro = await sincronizar();
ok(passageiro.estado === "erro", 'estado "erro", e nao "bloqueado"');
const naFila = await banco.fila.where("uid").equals(uidDaChamada(99, DIA)).first();
ok(naFila?.bloqueado !== true, "o item NAO foi bloqueado — rede que cai volta");
ok(naFila?.tentativas === 1, "a tentativa foi contada");
ok(typeof naFila?.ultimaTentativa === "number", "o recuo passa a contar da ultima tentativa");

console.log("\n14. o domingo inteiro: sinal cai, chamada e feita, sinal volta");
await limparBancoLocal();
let idasAoServidor = 0;
configurarTransporte(async () => {
  idasAoServidor++;
  return {};
});

fingirConexao(false);
await guardarChamada({
  classeId: 7,
  data: DIA,
  marcas: [{ alunoId: 71, presente: true }, { alunoId: 72, presente: true }],
});
const semSinal = await sincronizar();
ok(semSinal.estado === "offline", "sem sinal, o motor nem tenta");
ok(idasAoServidor === 0, "nenhuma requisicao gasta a bateria de quem esta na igreja");
ok((await banco.fila.count()) === 1, "a chamada esta guardada, esperando");

// O aplicativo e fechado e reaberto: nada disso mora na memoria da aba.
const sobreviveu = await lerChamadaLocal(7, DIA);
ok(sobreviveu?.marcas.length === 2, "a chamada sobrevive a aba fechada");

fingirConexao(true);
const voltou = await sincronizar();
ok(voltou.enviados === 1 && voltou.restantes === 0, "a internet volta e a chamada sobe sozinha");
ok(idasAoServidor === 1, "uma requisicao, com a classe inteira");

configurarTransporte(null);
await limparBancoLocal();

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
