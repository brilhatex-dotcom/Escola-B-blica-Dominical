/**
 * Os tipos compartilhados entre as etapas do assistente de Novo Pedido — o
 * mesmo formato que `/api/revistas` e `/api/revistas/pedido` já devolvem,
 * sem reinventar nada.
 */

export type SituacaoCongregacao = "sem-pedido" | "quitado" | "pendente" | "parcial" | "atraso";

export interface ClasseItem {
  classeId: number;
  classe: string;
  faixa: string;
  categoriaRotulo: string;
  categoriaEncontrada: boolean;
  alunos: number;
  precoUnitario: number | null;
  subtotal: number;
  professores: number;
  precoProfessor: number | null;
  subtotalProfessor: number;
}

export interface PedidoResumo {
  confirmado: boolean;
  confirmadoEm: string | null;
  confirmadoPor: string | null;
  total: number;
  revistas: number;
}

export interface CongDoPainel {
  congId: number;
  nome: string;
  revistas: number;
  totalDevido: number;
  pago: number;
  saldo: number;
  situacao: SituacaoCongregacao;
  pedido: PedidoResumo | null;
  sugestao: { revistas: number; total: number };
  semPreco: number;
  classes: ClasseItem[];
}

export interface Prazo {
  dias: number;
  nivel: "tranquilo" | "atencao" | "urgente" | "vencido";
}

export interface PainelDados {
  trimestre: { chave: string; rotulo: string; tema: string | null };
  dataLimitePagamento: string;
  prazos: { pagamento: Prazo; pedido: Prazo | null };
  congregacoes: CongDoPainel[];
}

export interface LinhaPedido {
  categoria: string;
  categoriaRotulo: string;
  /** A modalidade — a `key` de `PrecoRevista` ("aluno-comum", "visual", "ensinador-cristao"...). */
  tipo: string;
  /** Texto curto pronto pra tela — "Aluno — Letra Ampliada", "Revista Ensinador Cristão". */
  rotulo: string;
  /** Só para casar com a quantidade sugerida (matriculados/professores). `null` quando a modalidade não tem grupo (Visual, itens de apoio). */
  grupo: "aluno" | "professor" | null;
  precoUnitario: number | null;
  quantidade: number;
  sugestao: number;
}

export interface DadosPedido {
  id: number | null;
  congId: number;
  congNome: string;
  trimestre: { chave: string; rotulo: string };
  confirmado: boolean;
  confirmadoEm: string | null;
  confirmadoPor: string | null;
  podeReabrir: boolean;
  linhas: LinhaPedido[];
  total: number;
  revistas: number;
}

export type Etapa = "congregacao" | "trimestre" | "quantidades" | "revisao" | "sucesso";

export function chaveItem(categoria: string, tipo: string): string {
  return `${categoria}|${tipo}`;
}
