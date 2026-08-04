/**
 * Papéis e permissões (RBAC).
 *
 * ============================================================================
 * O PAPEL NÃO É UM CAMPO NOVO — É O CARGO QUE A PESSOA JÁ OCUPA
 *
 * A Fase 05 modelou `Pessoa ──< PessoaCargo >── Cargo`, e `PessoaCargo` já
 * guarda EM QUAL congregação o cargo é exercido. Isso é exatamente o recorte
 * que as permissões precisam: "o Dirigente da Cong. Bandeiras vê a Cong.
 * Bandeiras".
 *
 * Criar aqui uma segunda lista de "perfis", paralela aos cargos, produziria o
 * defeito clássico: alguém deixa de ser Dirigente no organograma e continua
 * enxergando a congregação, porque ninguém lembrou de mexer no outro lugar.
 * Trocar o Dirigente é alteração de DADO — não de arquivo, e não em dois
 * lugares.
 * ============================================================================
 *
 * As definições abaixo (quem vê o quê) são código de propósito: elas são a
 * regra da igreja, não um cadastro. Um erro de digitação num cadastro de
 * permissões abriria a folha de pagamento inteira para um professor sem que
 * nada acusasse.
 */

/* ------------------------------------------------------------------ *
 * Os papéis
 * ------------------------------------------------------------------ */

export type Papel =
  // ── Grupo A — enxergam o campo inteiro ──
  | "pastor-presidente"
  | "gestor-local"
  | "supervisor"
  | "secretario-geral"
  // ── Grupo B — enxergam apenas a própria congregação ──
  | "dirigente"
  | "vice-dirigente"
  | "secretario-local"
  | "professor"
  // ── Conta técnica herdada da planilha ──
  | "administrador";

/** Até onde a visão alcança. */
export type Escopo = "campo" | "congregacao";

export interface DefinicaoPapel {
  papel: Papel;
  rotulo: string;
  /** Menor é mais alto — a mesma convenção de `Cargos.ordem`. */
  ordem: number;
  escopo: Escopo;
  descricao: string;
  /** Chaves do menu que este papel enxerga. `"*"` significa todas. */
  modulos: readonly string[];
  /** Onde ele pode GRAVAR. Subconjunto de `modulos`; `"*"` significa todos. */
  gravar: readonly string[];
}

/** Tudo o que existe no menu. Usado pelos papéis de acesso total. */
const TUDO = ["*"] as const;

/**
 * O que o grupo B enxerga — sempre restrito à própria congregação pelo escopo.
 *
 * A lista é a mesma para os quatro papéis do grupo; o que muda entre eles é o
 * que podem GRAVAR. Um Professor consulta a ficha do aluno e a frequência da
 * classe dele tanto quanto o Dirigente — esconder isso não protege ninguém e
 * só o obriga a pedir por WhatsApp o que já é trabalho dele saber.
 */
const VE_A_CONGREGACAO = [
  "dashboard",
  "congregacoes",
  "chamada",
  "alunos",
  "classes",
  "professores",
  "visitantes",
  "aniversariantes",
  "licoes",
  "revistas",
  "rel-frequencia",
  "rel-ranking",
  "rel-faltas",
  "rel-ficha",
  "rel-certificados",
  "agenda-calendario",
  "agenda-eventos",
  "agenda-avisos",
  "agenda-reunioes",
  "cfg-sincronizacao",
  "cfg-offline",
] as const;

export const PAPEIS: readonly DefinicaoPapel[] = [
  {
    papel: "pastor-presidente",
    rotulo: "Pastor Presidente",
    ordem: 10,
    escopo: "campo",
    descricao: "Autoridade máxima do campo. Enxerga tudo, em todas as congregações.",
    modulos: TUDO,
    gravar: TUDO,
  },
  {
    papel: "gestor-local",
    rotulo: "Gestor Local",
    ordem: 20,
    escopo: "campo",
    descricao: "Administra o campo inteiro no lugar do Pastor Presidente.",
    modulos: TUDO,
    gravar: TUDO,
  },
  {
    papel: "supervisor",
    rotulo: "Supervisor da EBD",
    ordem: 30,
    escopo: "campo",
    descricao:
      "Responde pela Escola Bíblica em todas as congregações. Não mexe em contas nem em permissões.",
    modulos: TUDO,
    // Fica de fora o que é da administração do sistema, e não da EBD: contas de
    // acesso, permissões e backup. Supervisionar a Escola Bíblica não é a mesma
    // coisa que poder criar um usuário com acesso ao campo inteiro.
    gravar: [
      "congregacoes",
      "chamada",
      "alunos",
      "classes",
      "professores",
      "visitantes",
      "aniversariantes",
      "licoes",
      "revistas",
      "lideranca",
      "hierarquia",
      "escalas",
      "rel-certificados",
      "agenda-calendario",
      "agenda-eventos",
      "agenda-avisos",
      "agenda-reunioes",
    ],
  },
  {
    papel: "secretario-geral",
    rotulo: "Secretário Geral do Campo",
    ordem: 40,
    escopo: "campo",
    descricao:
      "Consolida números e documentos de todas as congregações. Vê tudo; grava o que é da secretaria.",
    modulos: TUDO,
    gravar: [
      "chamada",
      "alunos",
      "classes",
      "visitantes",
      "aniversariantes",
      "licoes",
      "revistas",
      "escalas",
      "rel-certificados",
      "agenda-calendario",
      "agenda-eventos",
      "agenda-avisos",
      "agenda-reunioes",
    ],
  },

  /* ---------------- Grupo B — só a própria congregação ---------------- */

  {
    papel: "dirigente",
    rotulo: "Dirigente",
    ordem: 70,
    escopo: "congregacao",
    descricao: "Responde pela EBD da sua congregação.",
    modulos: VE_A_CONGREGACAO,
    gravar: [
      "chamada",
      "alunos",
      "classes",
      "professores",
      "visitantes",
      "licoes",
      "revistas",
      "agenda-eventos",
      "agenda-avisos",
      "agenda-reunioes",
    ],
  },
  {
    papel: "vice-dirigente",
    rotulo: "Vice-Dirigente",
    ordem: 75,
    escopo: "congregacao",
    descricao: "Substitui o Dirigente na sua congregação.",
    modulos: VE_A_CONGREGACAO,
    gravar: [
      "chamada",
      "alunos",
      "classes",
      "professores",
      "visitantes",
      "licoes",
      "revistas",
      "agenda-eventos",
      "agenda-avisos",
      "agenda-reunioes",
    ],
  },
  {
    papel: "secretario-local",
    rotulo: "Secretário Local",
    ordem: 80,
    escopo: "congregacao",
    descricao: "Cuida dos registros da sua congregação: chamada, cadastro e pedidos.",
    modulos: VE_A_CONGREGACAO,
    gravar: ["chamada", "alunos", "visitantes", "licoes", "revistas"],
  },
  {
    papel: "professor",
    rotulo: "Professor",
    ordem: 90,
    escopo: "congregacao",
    descricao: "Faz a chamada da sua classe e acompanha os alunos dela.",
    modulos: VE_A_CONGREGACAO,
    // Um professor marca presença e recebe visitante — não mexe em matrícula
    // nem em cadastro de classe, que é decisão da secretaria.
    gravar: ["chamada", "visitantes"],
  },

  /* ---------------- A conta herdada da planilha ---------------- */

  {
    papel: "administrador",
    rotulo: "Administrador do sistema",
    ordem: 5,
    escopo: "campo",
    descricao:
      "Conta técnica herdada do sistema antigo (perfil `master`). Não é um cargo da igreja — " +
      "existe para não trancar ninguém do lado de fora enquanto os cargos não estiverem atribuídos.",
    modulos: TUDO,
    gravar: TUDO,
  },
];

const POR_CHAVE = new Map(PAPEIS.map((p) => [p.papel, p]));

export function definicaoDoPapel(papel: Papel): DefinicaoPapel | undefined {
  return POR_CHAVE.get(papel);
}

export function rotuloDoPapel(papel: Papel): string {
  return POR_CHAVE.get(papel)?.rotulo ?? papel;
}

/* ------------------------------------------------------------------ *
 * Do cargo ao papel
 * ------------------------------------------------------------------ */

/**
 * Tradução `Cargos.nome` → papel de acesso.
 *
 * A tabela `Cargos` é dado editável pela secretaria; os papéis são regra. Este
 * mapa é a fronteira entre os dois, e ele é EXPLÍCITO de propósito: um cargo
 * novo cadastrado amanhã ("Auxiliar de Secretaria") não ganha acesso nenhum por
 * acidente só porque o nome parece importante. Sem correspondência aqui, o
 * cargo existe no organograma e não abre porta alguma — que é o padrão seguro.
 */
const CARGO_PARA_PAPEL: Readonly<Record<string, Papel>> = {
  "Pastor Presidente": "pastor-presidente",
  "Gestor Local": "gestor-local",
  "Supervisor da EBD": "supervisor",
  Secretário: "secretario-geral",
  "Secretário Auxiliar": "secretario-geral",
  "Coordenador de Congregação": "dirigente",
  Dirigente: "dirigente",
  "Vice-Dirigente": "vice-dirigente",
  "Secretário Local": "secretario-local",
  "Secretário de Classe": "secretario-local",
  Professor: "professor",
  Auxiliar: "professor",
};

export function papelDoCargo(nomeDoCargo: string): Papel | null {
  return CARGO_PARA_PAPEL[nomeDoCargo] ?? null;
}

/**
 * Tradução do perfil herdado da planilha, para quem ainda não tem cargo ligado.
 *
 * As 19 contas do sistema antigo têm apenas dois perfis: `master` (2) e `coord`
 * (17). Elas não são pessoas — são contas de congregação ("Cong. Pinheiro",
 * "T. Matriz"). Nada disso é reescrito: o campo `perfil` continua exatamente
 * como veio, e esta função apenas o INTERPRETA na hora de decidir o acesso.
 *
 * `master` vira "administrador", e não "Pastor Presidente": a conta `admin` é
 * técnica, não é o pastor, e dar a ela o nome de um cargo da igreja faria o
 * organograma mentir. Quem é o quê se resolve atribuindo cargos — e a tela de
 * Usuários mostra, conta por conta, qual acesso é presumido e qual é de fato.
 */
export function papelHerdado(perfil: string): Papel {
  return perfil === "master" ? "administrador" : "dirigente";
}

/* ------------------------------------------------------------------ *
 * As perguntas que o resto do sistema faz
 * ------------------------------------------------------------------ */

/** O papel mais alto de uma lista — é ele que dá o nome ao acesso na tela. */
export function papelPrincipal(papeis: readonly Papel[]): Papel | null {
  let melhor: DefinicaoPapel | null = null;
  for (const p of papeis) {
    const def = POR_CHAVE.get(p);
    if (def && (!melhor || def.ordem < melhor.ordem)) melhor = def;
  }
  return melhor?.papel ?? null;
}

/**
 * O escopo de quem acumula papéis.
 *
 * Basta UM papel de campo para enxergar o campo: o Supervisor da EBD que também
 * é Professor numa classe não deixa de supervisionar o campo por causa disso.
 */
export function escopoDe(papeis: readonly Papel[]): Escopo {
  return papeis.some((p) => POR_CHAVE.get(p)?.escopo === "campo") ? "campo" : "congregacao";
}

function algumPapelPermite(
  papeis: readonly Papel[],
  chave: string,
  campo: "modulos" | "gravar",
): boolean {
  for (const p of papeis) {
    const def = POR_CHAVE.get(p);
    if (!def) continue;
    const lista = def[campo];
    if (lista.includes("*") || lista.includes(chave)) return true;
  }
  return false;
}

/** Este acesso enxerga o módulo? */
export function podeVer(papeis: readonly Papel[], chave: string): boolean {
  return algumPapelPermite(papeis, chave, "modulos");
}

/**
 * Este acesso pode gravar no módulo?
 *
 * Gravar exige ver: sem esta linha, uma lista de gravação escrita com um item a
 * mais abriria escrita num módulo que a pessoa nem enxerga — e o defeito
 * apareceria como uma tela em branco que mesmo assim salva.
 */
export function podeGravar(papeis: readonly Papel[], chave: string): boolean {
  return podeVer(papeis, chave) && algumPapelPermite(papeis, chave, "gravar");
}
