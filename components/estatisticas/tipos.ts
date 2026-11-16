/** As respostas de app/api/estatisticas/* — usadas pela tela e pelo Modo Data Show. */

export interface LinhaRanking {
  congId: number;
  nome: string;
  matriculados: number;
  domingosComChamada: number;
  taxa: number | null;
  mediaPresentes: number;
  mediaBase: number;
  justificadasTotal: number;
  posicao?: number;
}
export interface LinhaClasse {
  classeId: number;
  nome: string;
  congregacao: string | null;
  domingosComChamada: number;
  taxa: number | null;
  mediaPresentes: number;
  mediaBase: number;
  posicao: number;
}
export interface RespRanking {
  periodo: { de: string; ate: string; domingos: number };
  justificadaDisponivel: boolean;
  campo: { taxa: number | null; mediaPresentes: number; mediaBase: number; matriculados: number; domingosComChamada: number; justificadasTotal: number };
  congregacoes: LinhaRanking[];
  poucasChamadas: LinhaRanking[];
  semChamada: Array<{ congId: number; nome: string; matriculados: number }>;
  classes: LinhaClasse[];
}

export interface RespPedidos {
  trimestre: { chave: string; rotulo: string };
  disponiveis: string[];
  trimestres: Array<{
    chave: string; rotulo: string; congregacoesComPedido: number; confirmados: number;
    revistas: number; revistasAluno: number; revistasProfessor: number; valor: number; pago: number; saldo: number;
  }>;
  congregacoes: Array<{
    congId: number; nome: string; matriculados: number; revistasAluno: number; revistasProfessor: number;
    outras: number; revistas: number; cobertura: number | null; valor: number; pago: number; saldo: number | null;
    situacao: "sem-pedido" | "confirmado" | "rascunho";
  }>;
  categorias: Array<{ categoria: string; rotulo: string; quantidade: number }>;
}

export interface RespPanorama {
  janela: { de: string; ate: string; semanas: number };
  serie: Array<{ data: string; presentes: number; base: number; taxa: number }>;
  projecao: Array<{ data: string; taxa: number; presentes: number }>;
  tendenciaSemanal: number | null;
  tendencias: Array<{
    congId: number; nome: string; atual: number | null; anterior: number | null; variacao: number | null;
    projecao: number | null; direcao: "subindo" | "caindo" | "estavel" | "sem-base";
  }>;
  matriculas: { atuais: number; meses: Array<{ mes: string; novas: number }>; mediaMensal: number; projetadosNoProximoTrimestre: number };
  revistas: {
    trimestre: { chave: string; rotulo: string };
    estimativaAluno: number; ultimoTrimestre: string | null; ultimoPedidoAluno: number | null; valorEstimado: number | null;
  };
}
