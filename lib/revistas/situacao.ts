/**
 * Situação e alertas do módulo de Revistas — o painel do trimestre.
 *
 * ============================================================================
 * O PEDIDO NÃO TEM UM PASSO DE "ENVIAR" — SÓ O PAGAMENTO TEM PRAZO DE VERDADE
 *
 * O pedido original descreve uma situação de quatro estados (Aberto, Fechado,
 * Pago, Em atraso) como se o pedido fosse algo que a congregação SUBMETE até
 * uma data. No sistema real ele não é: nasce pronto, calculado a partir dos
 * alunos ativos, e muda sozinho se um aluno entra ou sai da classe. Não existe
 * botão "enviar pedido", então "Fechado" não pode significar "a congregação
 * mandou e não pode mais mudar" — isso exigiria uma trava que hoje não existe.
 *
 * Por isso "Fechado" aqui significa uma coisa mais honesta e ainda útil: o
 * prazo de AJUSTE do pedido (`dataLimitePedido`, quando a administração do
 * campo define um) passou, mas o prazo de PAGAMENTO ainda não — a fase em que
 * a quantidade já deveria estar decidida e falta só pagar. Se
 * `dataLimitePedido` nunca foi definido, esse estado simplesmente nunca
 * acontece, e a situação pula direto de "Aberto" para "Pago"/"Em atraso".
 * ============================================================================
 */

export type SituacaoTrimestre = "aberto" | "fechado" | "pago" | "atraso";

export interface RotuloSituacao {
  situacao: SituacaoTrimestre;
  rotulo: string;
}

const ROTULOS: Record<SituacaoTrimestre, string> = {
  aberto: "Aberto",
  fechado: "Fechado — aguardando pagamento",
  pago: "Pago",
  atraso: "Em atraso",
};

export function situacaoDoTrimestre(params: {
  hoje: Date;
  totalDevido: number;
  saldo: number;
  dataLimitePedido: Date | null;
  dataLimitePagamento: Date;
}): RotuloSituacao {
  const { hoje, totalDevido, saldo, dataLimitePedido, dataLimitePagamento } = params;

  // Sem nenhum pedido no campo inteiro (nenhuma classe ativa em lugar
  // nenhum), a pergunta "pago ou em atraso" não se aplica.
  if (totalDevido <= 0) return { situacao: "aberto", rotulo: ROTULOS.aberto };

  if (saldo <= 0) return { situacao: "pago", rotulo: ROTULOS.pago };
  if (hoje > dataLimitePagamento) return { situacao: "atraso", rotulo: ROTULOS.atraso };
  if (dataLimitePedido && hoje > dataLimitePedido) return { situacao: "fechado", rotulo: ROTULOS.fechado };
  return { situacao: "aberto", rotulo: ROTULOS.aberto };
}

/* ------------------------------------------------------------------ *
 * Prazo em destaque — dias restantes e o nível de urgência (a cor)
 * ------------------------------------------------------------------ */

export type NivelPrazo = "tranquilo" | "atencao" | "urgente" | "vencido";

/** A partir de quantos dias restantes o prazo vira amarelo, e depois vermelho. */
export const DIAS_ATENCAO_PRAZO = 14;
export const DIAS_URGENTE_PRAZO = 3;

/** Dias corridos até o limite. Negativo quando já passou. */
export function diasRestantes(hoje: Date, limite: Date): number {
  const umDia = 24 * 60 * 60 * 1000;
  const h = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  const l = Date.UTC(limite.getUTCFullYear(), limite.getUTCMonth(), limite.getUTCDate());
  return Math.round((l - h) / umDia);
}

export function nivelDoPrazo(dias: number): NivelPrazo {
  if (dias < 0) return "vencido";
  if (dias <= DIAS_URGENTE_PRAZO) return "urgente";
  if (dias <= DIAS_ATENCAO_PRAZO) return "atencao";
  return "tranquilo";
}

/* ------------------------------------------------------------------ *
 * Situação de UMA congregação — o que colore o card e alimenta os alertas
 * ------------------------------------------------------------------ */

export type SituacaoCongregacao = "sem-pedido" | "quitado" | "pendente" | "parcial" | "atraso";

export function situacaoDaCongregacao(params: {
  hoje: Date;
  totalDevido: number;
  pago: number;
  dataLimitePagamento: Date;
}): SituacaoCongregacao {
  const { hoje, totalDevido, pago, dataLimitePagamento } = params;
  if (totalDevido <= 0) return "sem-pedido";
  if (pago >= totalDevido) return "quitado";
  if (hoje > dataLimitePagamento) return "atraso";
  return pago > 0 ? "parcial" : "pendente";
}

/* ------------------------------------------------------------------ *
 * Alertas automáticos — um por congregação, no máximo, do mais urgente
 * ------------------------------------------------------------------ */

export type TipoAlertaRevista = "pagamento-vencido" | "prazo-encerrando" | "sem-pagamento" | "sem-pedido";

export interface AlertaRevista {
  nivel: "critico" | "atencao";
  tipo: TipoAlertaRevista;
  congId: number;
  congNome: string;
  titulo: string;
  descricao: string;
}

interface CongParaAlerta {
  congId: number;
  nome: string;
  totalDevido: number;
  pago: number;
  saldo: number;
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Um alerta por congregação, no máximo — nunca dois competindo pela mesma
 * linha. A prioridade é: já venceu > prazo acabando > nunca pagou nada > sem
 * pedido nenhum no trimestre. Uma congregação "pendente" mas com o prazo
 * ainda longe não gera alerta — isso é o estado normal do início do
 * trimestre, não um aviso.
 */
export function gerarAlertasRevistas(
  congregacoes: CongParaAlerta[],
  params: { hoje: Date; dataLimitePagamento: Date },
): AlertaRevista[] {
  const { hoje, dataLimitePagamento } = params;
  const dias = diasRestantes(hoje, dataLimitePagamento);
  const alertas: AlertaRevista[] = [];

  for (const c of congregacoes) {
    if (c.totalDevido <= 0) {
      alertas.push({
        nivel: "atencao",
        tipo: "sem-pedido",
        congId: c.congId,
        congNome: c.nome,
        titulo: `${c.nome} — sem pedido neste trimestre`,
        descricao: "Nenhuma classe ativa com aluno gerou pedido de revista.",
      });
      continue;
    }
    if (c.saldo <= 0) continue; // quitado — nada a alertar

    if (hoje > dataLimitePagamento) {
      alertas.push({
        nivel: "critico",
        tipo: "pagamento-vencido",
        congId: c.congId,
        congNome: c.nome,
        titulo: `${c.nome} — pagamento vencido`,
        descricao: `Saldo de ${moeda.format(c.saldo)} em aberto, prazo já passou.`,
      });
    } else if (dias <= DIAS_ATENCAO_PRAZO) {
      alertas.push({
        nivel: dias <= DIAS_URGENTE_PRAZO ? "critico" : "atencao",
        tipo: "prazo-encerrando",
        congId: c.congId,
        congNome: c.nome,
        titulo: `${c.nome} — prazo encerrando`,
        descricao:
          `${dias} dia(s) para o prazo, saldo de ${moeda.format(c.saldo)} em aberto` +
          (c.pago > 0 ? ` (já pagou ${moeda.format(c.pago)}).` : "."),
      });
    } else if (c.pago <= 0) {
      alertas.push({
        nivel: "atencao",
        tipo: "sem-pagamento",
        congId: c.congId,
        congNome: c.nome,
        titulo: `${c.nome} — ainda sem pagamento`,
        descricao: `Pedido de ${moeda.format(c.totalDevido)}, nenhuma baixa registrada até agora.`,
      });
    }
  }

  // Crítico primeiro — a mesma regra do Painel de Relatórios.
  const peso = { critico: 0, atencao: 1 } as const;
  return alertas.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}
