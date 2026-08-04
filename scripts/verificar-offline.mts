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
import { db, novoUid, pendencias, limparBancoLocal } from "../lib/db/local";
import { salvar, remover, receberDoServidor, confirmarEnvio } from "../lib/db/repositorio";
import type { Aluno, Frequencia } from "../lib/db/schema";

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

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
