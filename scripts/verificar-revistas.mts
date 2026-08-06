/**
 * Verificação do módulo de Revistas: Fase 15a (situação do trimestre,
 * situação por congregação, nível do prazo e alertas automáticos) e Fase 15b
 * (preços por categoria, incluindo o Berçário, e as contas do pedido
 * digitado).
 *
 *   npm run verificar:revistas
 *
 * Roda no Node, sem banco: são funções puras — nenhuma delas consulta o
 * Postgres. Os números são inventados mas plausíveis, para conferir a REGRA
 * antes de confiar nela com o pedido real das 14 congregações.
 */
import {
  DIAS_ATENCAO_PRAZO,
  DIAS_URGENTE_PRAZO,
  diasRestantes,
  gerarAlertasRevistas,
  nivelDoPrazo,
  situacaoDaCongregacao,
  situacaoDoTrimestre,
} from "../lib/revistas/situacao";
import {
  agruparPrecos,
  normalizarCategoria,
  precoAlunoDeLista,
  precoProfessorDeLista,
} from "../lib/revistas/precos";
import {
  calcularTotalPedido,
  calcularTotalRevistas,
  tipoValido,
  validarQuantidade,
} from "../lib/revistas/pedidoCalculo";
import { dataLimitePadrao, proximoTrimestre, resolverTrimestre, trimestreDe } from "../lib/revistas/trimestre";

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "OK  " : "FALHA"}  ${msg}`);
  if (!cond) falhas++;
};

const dia = (s: string) => new Date(`${s}T00:00:00Z`);

/* ------------------------------------------------------------------ */
console.log("1. diasRestantes — dias corridos, negativo quando já passou");
ok(diasRestantes(dia("2026-08-06"), dia("2026-08-20")) === 14, "14 dias no futuro");
ok(diasRestantes(dia("2026-08-06"), dia("2026-08-06")) === 0, "o próprio dia é 0");
ok(diasRestantes(dia("2026-08-06"), dia("2026-07-30")) === -7, "no passado, é negativo");

/* ------------------------------------------------------------------ */
console.log("\n2. nivelDoPrazo — as quatro cores, nos limites exatos");
ok(nivelDoPrazo(30) === "tranquilo", "30 dias: tranquilo");
ok(nivelDoPrazo(DIAS_ATENCAO_PRAZO) === "atencao", `${DIAS_ATENCAO_PRAZO} dias (limite de cima): atenção`);
ok(nivelDoPrazo(DIAS_ATENCAO_PRAZO + 1) === "tranquilo", "um dia acima do limite: ainda tranquilo");
ok(nivelDoPrazo(DIAS_URGENTE_PRAZO) === "urgente", `${DIAS_URGENTE_PRAZO} dias (limite de cima): urgente`);
ok(nivelDoPrazo(0) === "urgente", "0 dias (vence hoje): urgente");
ok(nivelDoPrazo(-1) === "vencido", "-1 dia: vencido");

/* ------------------------------------------------------------------ */
console.log("\n3. situacaoDaCongregacao — as cinco situações");
const limite = dia("2026-08-20");
ok(situacaoDaCongregacao({ hoje: dia("2026-08-06"), totalDevido: 0, pago: 0, dataLimitePagamento: limite }) === "sem-pedido",
  "sem classe/aluno ativo → sem-pedido, mesmo sem nada pago");
ok(situacaoDaCongregacao({ hoje: dia("2026-08-06"), totalDevido: 100, pago: 100, dataLimitePagamento: limite }) === "quitado",
  "pago cobre o total → quitado");
ok(situacaoDaCongregacao({ hoje: dia("2026-08-06"), totalDevido: 100, pago: 120, dataLimitePagamento: limite }) === "quitado",
  "pago MAIS que o total (troco/erro de baixa) ainda conta como quitado");
ok(situacaoDaCongregacao({ hoje: dia("2026-08-06"), totalDevido: 100, pago: 0, dataLimitePagamento: limite }) === "pendente",
  "nada pago, dentro do prazo → pendente");
ok(situacaoDaCongregacao({ hoje: dia("2026-08-06"), totalDevido: 100, pago: 40, dataLimitePagamento: limite }) === "parcial",
  "pagou uma parte, dentro do prazo → parcial");
ok(situacaoDaCongregacao({ hoje: dia("2026-08-25"), totalDevido: 100, pago: 40, dataLimitePagamento: limite }) === "atraso",
  "passou do prazo com saldo → atraso, mesmo tendo pago uma parte");
ok(situacaoDaCongregacao({ hoje: dia("2026-08-20"), totalDevido: 100, pago: 0, dataLimitePagamento: limite }) === "pendente",
  "o PRÓPRIO dia do prazo ainda não é atraso");

/* ------------------------------------------------------------------ */
console.log("\n4. situacaoDoTrimestre — Aberto, Fechado, Pago, Em atraso");
const semPedido = situacaoDoTrimestre({
  hoje: dia("2026-08-06"), totalDevido: 0, saldo: 0, dataLimitePedido: null, dataLimitePagamento: limite,
});
ok(semPedido.situacao === "aberto", "campo inteiro sem pedido nenhum → aberto (não é 'pago' por não ter o que pagar)");

const pago = situacaoDoTrimestre({
  hoje: dia("2026-08-06"), totalDevido: 5000, saldo: 0, dataLimitePedido: null, dataLimitePagamento: limite,
});
ok(pago.situacao === "pago", "saldo zerado com pedido real → pago");

const atraso = situacaoDoTrimestre({
  hoje: dia("2026-08-25"), totalDevido: 5000, saldo: 800, dataLimitePedido: null, dataLimitePagamento: limite,
});
ok(atraso.situacao === "atraso", "passou do prazo de pagamento com saldo → em atraso");

const abertoSemPrazoPedido = situacaoDoTrimestre({
  hoje: dia("2026-08-06"), totalDevido: 5000, saldo: 800, dataLimitePedido: null, dataLimitePagamento: limite,
});
ok(abertoSemPrazoPedido.situacao === "aberto",
  "sem dataLimitePedido definida, nunca passa por 'fechado' — pula direto para pago/atraso");

const fechado = situacaoDoTrimestre({
  hoje: dia("2026-08-15"), totalDevido: 5000, saldo: 800, dataLimitePedido: dia("2026-08-10"), dataLimitePagamento: limite,
});
ok(fechado.situacao === "fechado",
  "prazo de PEDIDO passou, prazo de PAGAMENTO ainda não, saldo em aberto → fechado");

const abertoAntesDoPrazoPedido = situacaoDoTrimestre({
  hoje: dia("2026-08-05"), totalDevido: 5000, saldo: 800, dataLimitePedido: dia("2026-08-10"), dataLimitePagamento: limite,
});
ok(abertoAntesDoPrazoPedido.situacao === "aberto", "antes do prazo de pedido → ainda aberto");

/* ------------------------------------------------------------------ */
console.log("\n5. gerarAlertasRevistas — no máximo um alerta por congregação, o mais urgente vence");
const hoje = dia("2026-08-06");
const prazo = dia("2026-08-20"); // 14 dias à frente

const alertas = gerarAlertasRevistas(
  [
    { congId: 1, nome: "Quitada", totalDevido: 500, pago: 500, saldo: 0 },
    { congId: 2, nome: "Sem Pedido", totalDevido: 0, pago: 0, saldo: 0 },
    { congId: 3, nome: "Vencida", totalDevido: 500, pago: 100, saldo: 400 },
    { congId: 4, nome: "No Limite", totalDevido: 500, pago: 0, saldo: 500 },
    { congId: 5, nome: "Tranquila Sem Pagar", totalDevido: 500, pago: 0, saldo: 500 },
  ],
  { hoje, dataLimitePagamento: prazo },
);
// "Vencida" pagaria em 06/08, mas o prazo era antes de hoje — vamos simular
// via outra chamada com prazo já passado, para não confundir os cenários:
const vencida = gerarAlertasRevistas(
  [{ congId: 3, nome: "Vencida", totalDevido: 500, pago: 100, saldo: 400 }],
  { hoje, dataLimitePagamento: dia("2026-07-20") },
);

ok(alertas.every((a) => a.congId !== 1), "congregação quitada não gera alerta nenhum");
ok(alertas.some((a) => a.congId === 2 && a.tipo === "sem-pedido"), "sem classe/aluno ativo → alerta 'sem-pedido'");
ok(vencida.length === 1 && vencida[0].tipo === "pagamento-vencido" && vencida[0].nivel === "critico",
  "prazo já passou com saldo → 'pagamento-vencido', nível crítico");
ok(alertas.some((a) => a.congId === 4 && a.tipo === "prazo-encerrando"),
  "14 dias restantes (dentro do limite de atenção) → 'prazo-encerrando', mesmo sem ter pago nada");
// A congregação 5 é idêntica à 4 no cenário acima (mesmo prazo de 14 dias);
// para testar "sem-pagamento" de verdade, precisa de um prazo bem mais longe.
const semPressa = gerarAlertasRevistas(
  [{ congId: 6, nome: "Longe do Prazo", totalDevido: 500, pago: 0, saldo: 500 }],
  { hoje, dataLimitePagamento: dia("2026-11-01") },
);
ok(semPressa.length === 1 && semPressa[0].tipo === "sem-pagamento" && semPressa[0].nivel === "atencao",
  "prazo longe (não é 14 dias nem vencido) mas zero pago → 'sem-pagamento', nível atenção");

const semPressaComParcial = gerarAlertasRevistas(
  [{ congId: 7, nome: "Longe do Prazo, Pagou Parte", totalDevido: 500, pago: 200, saldo: 300 }],
  { hoje, dataLimitePagamento: dia("2026-11-01") },
);
ok(semPressaComParcial.length === 0,
  "prazo longe e já pagou uma parte → sem alerta (é o andamento normal do trimestre)");

const urgente = gerarAlertasRevistas(
  [{ congId: 8, nome: "Faltam Dois Dias", totalDevido: 500, pago: 0, saldo: 500 }],
  { hoje, dataLimitePagamento: dia("2026-08-08") }, // 2 dias
);
ok(urgente[0].nivel === "critico", `${DIAS_URGENTE_PRAZO} dias ou menos vira crítico, não só atenção`);

ok(alertas[0].nivel === "critico" || alertas.every((a) => a.nivel !== "critico"),
  "os alertas críticos vêm primeiro na lista, quando existem");

/* ------------------------------------------------------------------ */
console.log("\n6. gerarAlertasRevistas — 'sem-pedido' sobe para crítico quando o prazo do PEDIDO venceu");
const semPedidoDentroDoPrazo = gerarAlertasRevistas(
  [{ congId: 9, nome: "Ainda no Prazo", totalDevido: 0, pago: 0, saldo: 0 }],
  { hoje, dataLimitePagamento: prazo, dataLimitePedido: dia("2026-09-01") },
);
ok(semPedidoDentroDoPrazo[0].nivel === "atencao", "prazo do pedido ainda não passou → atenção");

const semPedidoVencido = gerarAlertasRevistas(
  [{ congId: 10, nome: "Prazo do Pedido Vencido", totalDevido: 0, pago: 0, saldo: 0 }],
  { hoje, dataLimitePagamento: prazo, dataLimitePedido: dia("2026-08-01") },
);
ok(semPedidoVencido[0].nivel === "critico", "prazo do pedido já passou sem confirmar → crítico");

const semPedidoSemPrazoDefinido = gerarAlertasRevistas(
  [{ congId: 11, nome: "Sem Prazo de Pedido", totalDevido: 0, pago: 0, saldo: 0 }],
  { hoje, dataLimitePagamento: prazo },
);
ok(semPedidoSemPrazoDefinido[0].nivel === "atencao", "sem dataLimitePedido definida, nunca escala para crítico");

/* ------------------------------------------------------------------ */
console.log("\n7. lib/revistas/precos — o Berçário tem preço de professor, só com outra chave");
const precosBrutos = [
  { key: "manual-mestre", categoria: "bercario", label: "Berçário — Manual do Mestre", preco: 18 },
  { key: "mestre-comum", categoria: "adultos", label: "Adultos — Revista do Professor", preco: 15 },
  { key: "aluno-comum", categoria: "adultos", label: "Adultos — Revista do Aluno", preco: 10 },
  { key: "aluno-capa-dura", categoria: "adultos", label: "Adultos — Aluno Capa Dura", preco: 17 },
];
const agrupado = agruparPrecos(precosBrutos);
ok(precoProfessorDeLista(agrupado.get("bercario") ?? []) === 18,
  "Berçário: 'manual-mestre' é reconhecido como preço de professor — antes ficava sem preço nenhum");
ok(precoAlunoDeLista(agrupado.get("bercario") ?? []) === null,
  "Berçário genuinamente não tem preço de aluno cadastrado — não inventa um");
ok(precoProfessorDeLista(agrupado.get("adultos") ?? []) === 15, "Adultos: pega 'mestre-comum'");
ok(precoAlunoDeLista(agrupado.get("adultos") ?? []) === 10, "Adultos: pega 'aluno-comum', não a capa dura mais cara");
ok(normalizarCategoria("Pré-Adolescentes") === "pre-adolescentes", "normalização tira acento e caixa, mantém o hífen");

/* ------------------------------------------------------------------ */
console.log("\n8. lib/revistas/pedidoCalculo — a conta do pedido digitado");
ok(calcularTotalPedido([{ quantidade: 10, precoUnitario: 12 }, { quantidade: 2, precoUnitario: 18 }]) === 156,
  "10×12 + 2×18 = 156");
ok(calcularTotalPedido([]) === 0, "pedido vazio soma zero, não erro");
ok(calcularTotalRevistas([{ quantidade: 10 }, { quantidade: 2 }] as never) === 12, "conta as revistas, não o valor");
ok(validarQuantidade(5) === 5, "número inteiro válido passa direto");
ok(validarQuantidade("7") === 7, "string numérica é aceita (vem de input HTML)");
ok(validarQuantidade(null) === 0, "campo vazio (null) vira 0 — não pedir nada nessa linha, não erro");
ok(validarQuantidade("") === 0, "string vazia também vira 0");
ok(validarQuantidade(-1) === null, "quantidade negativa é rejeitada");
ok(validarQuantidade(2.5) === null, "quantidade fracionária é rejeitada — revista não parte ao meio");
ok(validarQuantidade("abc") === null, "texto não numérico é rejeitado");
ok(tipoValido("aluno") && tipoValido("professor"), "os dois tipos válidos");
ok(!tipoValido("obreiro"), "qualquer outra coisa é inválida");

/* ------------------------------------------------------------------ */
console.log("\n9. lib/revistas/trimestre — o pedido abre no PRÓXIMO trimestre, o painel financeiro no ATUAL");
const emAgosto = dia("2026-08-06");
ok(trimestreDe(emAgosto).chave === "3T-2026", "6 de agosto de 2026 está no 3º trimestre");
ok(proximoTrimestre(emAgosto).chave === "4T-2026", "o próximo trimestre é o 4º — o que a CPAD está recebendo pedido agora");
ok(resolverTrimestre(emAgosto, null).chave === "4T-2026", "sem parâmetro, resolverTrimestre (usado no pedido) escolhe o PRÓXIMO");
ok(resolverTrimestre(emAgosto, "atual").chave === "3T-2026", "'atual' explícito escolhe o em andamento");
ok(resolverTrimestre(emAgosto, "proximo").chave === "4T-2026", "'proximo' explícito confirma a mesma escolha do padrão");
const limitePadraoAgosto = dataLimitePadrao(emAgosto);
ok(limitePadraoAgosto.getUTCMonth() === 9, "o prazo padrão de pagamento cai em outubro (2º domingo do 4º trimestre)");

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
