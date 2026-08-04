import { VERSICULOS } from "@/lib/verses";
import type {
  Aniversariante,
  Atividade,
  Compromisso,
  DadosPainel,
  Estrutura,
  Indicador,
  Lider,
  PontoFrequencia,
  ResumoDomingo,
  Usuario,
} from "./tipos";

/**
 * A UNICA porta de entrada de dados do Dashboard.
 *
 * `carregarPainel()` busca de `/api/painel`, que le o Postgres. Este arquivo
 * guarda tambem o conjunto de EXEMPLO, usado quando o banco nao responde — e
 * marcado como tal, para a tela poder avisar.
 *
 * Nenhum componente conhece a origem dos dados: todos recebem os tipos de
 * `tipos.ts`. Foi por isso que nenhum deles tem numero escrito dentro; um "323"
 * digitado no meio do JSX parece inofensivo e vira caca ao tesouro na hora de
 * ligar o banco.
 */

const usuario: Usuario = {
  nome: "Secretaria da EBD",
  cargo: "Secretário Geral",
  congregacao: "Campo de Betânia",
  foto: null,
};

const indicadores: Indicador[] = [
  {
    chave: "alunos",
    titulo: "Total de Alunos",
    valor: 323,
    descricao: "matriculados e ativos",
    variacao: { percentual: 4.2, referencia: "vs. mês passado" },
    destino: "/dashboard/alunos",
  },
  {
    chave: "classes",
    titulo: "Total de Classes",
    valor: 53,
    descricao: "em 12 congregações",
    variacao: { percentual: 0, referencia: "sem mudança no mês" },
    destino: "/dashboard/classes",
  },
  {
    chave: "presentes",
    titulo: "Presentes Hoje",
    valor: 218,
    descricao: "67% dos matriculados",
    variacao: { percentual: 6.8, referencia: "vs. domingo passado" },
    destino: "/dashboard/chamada",
  },
  {
    chave: "visitantes",
    titulo: "Visitantes",
    valor: 14,
    descricao: "recebidos hoje",
    variacao: { percentual: -12.5, referencia: "vs. domingo passado" },
    destino: "/dashboard/visitantes",
  },
];

const frequencia: PontoFrequencia[] = [
  { mes: "Fev", presentes: 176, matriculados: 298, visitantes: 9 },
  { mes: "Mar", presentes: 189, matriculados: 305, visitantes: 12 },
  { mes: "Abr", presentes: 201, matriculados: 309, visitantes: 15 },
  { mes: "Mai", presentes: 194, matriculados: 312, visitantes: 11 },
  { mes: "Jun", presentes: 207, matriculados: 316, visitantes: 18 },
  { mes: "Jul", presentes: 213, matriculados: 320, visitantes: 16 },
  { mes: "Ago", presentes: 218, matriculados: 323, visitantes: 14 },
];

const resumo: ResumoDomingo = {
  licao: {
    numero: 6,
    titulo: "A fidelidade de Deus em meio às provações",
    revista: "Lições Bíblicas — 3º Trimestre",
  },
  classesIniciadas: 41,
  classesTotal: 53,
  presentes: 218,
  visitantes: 14,
  professores: 19,
  ultimaSincronizacao: null, // preenchido em tempo de execucao; ver `carregarPainel`
};

/**
 * Momentos relativos a AGORA, e nao datas fixas.
 *
 * Com timestamps escritos a mao, a lista envelhece: em duas semanas o painel de
 * demonstracao anuncia "há 14 dias" em tudo e passa a impressao de sistema
 * abandonado — justo o contrario do que ele deve transmitir.
 */
const minutos = (n: number) => Date.now() - n * 60_000;

const atividades: Atividade[] = [
  {
    id: "a1",
    tipo: "presenca",
    autor: "João Batista",
    descricao: "marcou presença na classe Jovens",
    quando: minutos(4),
  },
  {
    id: "a2",
    tipo: "visitante",
    autor: "Maria Aparecida",
    descricao: "cadastrou uma visitante na classe Senhoras",
    quando: minutos(11),
  },
  {
    id: "a3",
    tipo: "classe",
    autor: "Classe Jovens",
    descricao: "iniciou a chamada da lição 6",
    quando: minutos(23),
  },
  {
    id: "a4",
    tipo: "cadastro",
    autor: "Pr. Josué Lima",
    descricao: "matriculou 2 alunos na classe Adolescentes",
    quando: minutos(48),
  },
  {
    id: "a5",
    tipo: "relatorio",
    autor: "Secretaria da EBD",
    descricao: "gerou o relatório do domingo anterior",
    quando: minutos(96),
  },
  {
    id: "a6",
    tipo: "presenca",
    autor: "Classe Crianças",
    descricao: "encerrou a chamada com 27 presentes",
    quando: minutos(140),
  },
];

const aniversariantes: Aniversariante[] = [
  { id: "n1", nome: "Ana Beatriz Ferreira", classe: "Adolescentes", diaMes: "08-04", idade: 14, foto: null },
  { id: "n2", nome: "Josué Lima da Silva", classe: "Jovens", diaMes: "08-06", idade: 21, foto: null },
  { id: "n3", nome: "Marta Souza", classe: "Senhoras", diaMes: "08-09", idade: null, foto: null },
  { id: "n4", nome: "Pedro Henrique Alves", classe: "Crianças", diaMes: "08-11", idade: 9, foto: null },
];

const agenda: Compromisso[] = [
  { id: "c1", tipo: "ebd", titulo: "Escola Bíblica Dominical", local: "Templo — Campo de Betânia", quando: "2026-08-09T08:00:00" },
  { id: "c2", tipo: "culto", titulo: "Culto da Família", local: "Templo — Campo de Betânia", quando: "2026-08-09T18:00:00" },
  { id: "c3", tipo: "evento", titulo: "Encontro de Professores", local: "Salão anexo", quando: "2026-08-15T19:30:00" },
];

/**
 * Escolhe o versiculo do dia.
 *
 * Pela DATA, e nao por sorteio: sorteando, cada aparelho da igreja mostraria um
 * versiculo diferente na mesma manha, e quem comparasse duas telas acharia que
 * uma delas esta errada. Por data, todo mundo ve o mesmo — e ele muda sozinho
 * a cada dia.
 */
function versiculoDoDia(hoje: Date) {
  const inicio = Date.UTC(hoje.getFullYear(), 0, 1);
  const atual = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diaDoAno = Math.floor((atual - inicio) / 86_400_000);
  const v = VERSICULOS[diaDoAno % VERSICULOS.length];
  return { texto: v.texto, referencia: v.ref };
}

/** O painel de demonstracao. Usado quando o banco nao responde. */
export async function painelDeExemplo(hoje = new Date()): Promise<DadosPainel> {
  return {
    origem: "exemplo",
    usuario,
    versiculo: versiculoDoDia(hoje),
    indicadores,
    estrutura,
    lideranca,
    frequencia,
    resumo: {
      ...resumo,
      // A ultima sincronizacao e a UNICA informacao real aqui — vem do motor
      // da Fase 01, nao deste arquivo. Ver `SystemStatus`.
      ultimaSincronizacao: resumo.ultimaSincronizacao,
    },
    atividades,
    aniversariantes,
    agenda,
  };
}

/* ------------------------------------------------------------------ *
 * Estrutura e lideranca de exemplo
 * ------------------------------------------------------------------ */

/**
 * Estes numeros SAO os reais, apurados do export: 47 textos distintos no campo
 * `prof` das classes viraram 54 pessoas (porque "Jéssica e Elisângela" e um
 * texto e duas pessoas), mais os 5 da lideranca. Nove delas acumulam funcao.
 */
const estrutura: Estrutura = {
  pessoas: 59,
  cargosOcupados: 68,
  acumulam: 9,
  classes: 53,
  congregacoes: 12,
  revisar: 5,
};

/**
 * A hierarquia oficial do campo.
 *
 * No caminho normal ela vem do banco — `Cargos.destaque` diz quais entram e
 * `Cargos.ordem` diz em que ordem. Esta copia so existe para a tela de
 * demonstracao nao ficar vazia; editar a lideranca de verdade e trabalho do
 * painel administrativo, nao deste arquivo.
 */
const lideranca: Lider[] = [
  { cargoId: 1, cargo: "Pastor Presidente", ordem: 10, pessoaId: 1, nome: "Aílton José Alves", tratamento: "Pr.", foto: null },
  { cargoId: 2, cargo: "Gestor Local", ordem: 20, pessoaId: 2, nome: "Enoque Carlos do Nascimento", tratamento: "Pr.", foto: null },
  { cargoId: 3, cargo: "Supervisor da EBD", ordem: 30, pessoaId: 3, nome: "José Raimundo", tratamento: "Pb.", foto: null },
  { cargoId: 4, cargo: "Secretário", ordem: 40, pessoaId: 4, nome: "Luiz Neto", tratamento: "Aux.", foto: null },
  { cargoId: 5, cargo: "Secretário Auxiliar", ordem: 50, pessoaId: 5, nome: "Elvys Danilo", tratamento: "Aux.", foto: null },
];

/**
 * Busca os dados do painel.
 *
 * Roda no navegador e fala com `/api/painel`, que e quem enxerga o Postgres.
 * Se a rede falhar, cai no conjunto de exemplo — sempre marcado como tal, para
 * a tela poder avisar em vez de apresentar numero inventado como se fosse a
 * chamada de domingo.
 */
export async function carregarPainel(): Promise<DadosPainel> {
  try {
    const res = await fetch("/api/painel", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as DadosPainel;
  } catch {
    return painelDeExemplo();
  }
}
