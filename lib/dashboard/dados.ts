import { VERSICULOS } from "@/lib/verses";
import type {
  Aniversariante,
  Atividade,
  Compromisso,
  DadosPainel,
  Indicador,
  PontoFrequencia,
  ResumoDomingo,
  Usuario,
} from "./tipos";

/**
 * A UNICA porta de entrada de dados do Dashboard.
 *
 * Hoje devolve numeros de exemplo. Amanha, quando as rotas de API existirem
 * (Fase 05), este arquivo passa a chamar `fetch("/api/painel")` e mais nada no
 * projeto muda: nenhum componente conhece a origem dos dados, todos recebem os
 * tipos de `tipos.ts`.
 *
 * Foi por isso que os componentes NAO tem numeros escritos dentro deles. Um
 * "323" digitado no meio do JSX parece inofensivo e vira caca ao tesouro na
 * hora de ligar o banco.
 *
 * OS NUMEROS SAO OS REAIS DA IGREJA — 323 alunos, 53 classes, 19 usuarios,
 * vindos do export do sistema antigo. O que e inventado sao os numeros do DIA
 * (presentes, visitantes, atividades), que so a chamada de domingo produz.
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

/**
 * Carrega tudo o que o Dashboard mostra.
 *
 * Ja e `async` de proposito, mesmo devolvendo dados prontos: quando virar uma
 * chamada de rede, as telas nao mudam de forma — nao aparece um `await` novo,
 * nem um estado de carregamento que ninguem tinha previsto.
 */
export async function carregarPainel(hoje = new Date()): Promise<DadosPainel> {
  return {
    usuario,
    versiculo: versiculoDoDia(hoje),
    indicadores,
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
