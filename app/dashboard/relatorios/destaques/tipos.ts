/**
 * Os tipos compartilhados entre o painel de Destaques e a tela de detalhe —
 * o formato exato que `/api/relatorios/destaques` devolve (Fase 21).
 */

export interface ComponentesIDI {
  frequencia: number | null;
  regularidade: number | null;
  crescimentoTrimestral: number | null;
  crescimentoAnual: number | null;
  visitantes: number | null;
  visitantesNaoCrentes: number | null;
  visitantesRetornaram: number | null;
  retencaoAlunos: number | null;
  participacaoProfessores: number | null;
  igs: number | null;
}

export interface DetalheCategoria {
  tipo: "congregacao" | "classe" | "professor";
  ids: number[];
  nomes: string[];
  nota: number | null;
  motivos: string;
  indicadores?: ComponentesIDI;
}

export interface Categorias {
  congregacaoDestaque: DetalheCategoria | null;
  maiorCrescimento: DetalheCategoria | null;
  melhorFrequencia: DetalheCategoria | null;
  destaqueEvangelismo: DetalheCategoria | null;
  melhorConsolidacao: DetalheCategoria | null;
  professorDestaque: DetalheCategoria | null;
  classeDestaque: DetalheCategoria | null;
  congregacaoRevelacao: DetalheCategoria | null;
  melhorEvolucaoTrimestral: DetalheCategoria | null;
  melhorEvolucaoAnual: DetalheCategoria | null;
}

export interface EntradaHall {
  nomes: string[];
  nota: number | null;
}

export interface HallDaFama {
  congregacaoDoMes: EntradaHall | null;
  congregacaoDoTrimestre: EntradaHall | null;
  congregacaoDoAno: EntradaHall | null;
  periodo: {
    mesPassado: { de: string; ate: string };
    trimestrePassado: { de: string; ate: string };
    anoPassado: { de: string; ate: string };
  };
}

export interface RespostaDestaques {
  periodo: { de: string; ate: string; modo: string };
  categorias: Categorias;
  hallDaFama: HallDaFama | null;
  vejoOCampoTodo: boolean;
}
