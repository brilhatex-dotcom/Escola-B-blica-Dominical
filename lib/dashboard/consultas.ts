import { Prisma } from "@prisma/client";
import { prisma, temBanco } from "@/lib/prisma";
import { calcularDestaque, inicioDoMes, inicioDoTrimestre } from "./destaque";
import type {
  Aniversariante,
  Atividade,
  Compromisso,
  DadosPainel,
  Destaque,
  Destaques,
  Estrutura,
  Indicador,
  Lider,
  PontoFrequencia,
  TipoAtividade,
  TipoCompromisso,
} from "./tipos";

/**
 * As consultas de verdade do Dashboard.
 *
 * Roda SO NO SERVIDOR (chamado pela rota /api/painel). O Prisma nao existe no
 * navegador, e a string de conexao nunca deve chegar la.
 *
 * ============================================================================
 * A CONTAGEM DE PESSOAS E O MOTIVO DESTE ARQUIVO EXISTIR
 *
 * O sistema antigo nao sabia quantas pessoas serviam na EBD. Ele tinha 19
 * "usuarios" — dos quais a maioria e conta de congregacao, nao gente — e 50
 * classes com o nome do professor digitado a mao, produzindo 47 textos
 * diferentes para 54 pessoas (porque "Jéssica e Elisângela" e um texto e duas
 * pessoas).
 *
 * Aqui as duas perguntas sao respondidas separadamente, porque sao perguntas
 * diferentes:
 *
 *   pessoas   = COUNT(*) em Pessoas         -> quantas gentes
 *   cargos    = COUNT(*) em PessoaCargos    -> quantas funcoes exercidas
 *
 * Quem e dirigente e professor conta UMA vez em pessoas e DUAS em cargos. A
 * diferenca entre os dois numeros e a informacao: ela diz quanto a equipe esta
 * acumulando funcao.
 * ============================================================================
 */

/** Domingo mais recente (ou hoje, se hoje for domingo), como data civil. */
function domingoDaSemana(hoje: Date): Date {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function soData(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/* ------------------------------------------------------------------ *
 * O recorte por congregação
 * ------------------------------------------------------------------ */

/**
 * As congregações que este painel pode mostrar.
 *
 * ============================================================================
 * `undefined` SIGNIFICA "NÃO FILTRE" — E ISSO É A PEÇA CENTRAL
 *
 * Passado a um `where` do Prisma, `congId: undefined` simplesmente não entra na
 * consulta. Quem enxerga o campo inteiro recebe `undefined` e vê tudo, sem que
 * exista em lugar nenhum uma lista de "todas as congregações" para alguém
 * esquecer de atualizar no dia em que uma congregação nova for cadastrada.
 *
 * O contrário — montar a lista completa para quem vê tudo — daria o mesmo
 * resultado hoje e o resultado ERRADO amanhã, escondendo a congregação nova de
 * quem justamente precisa vê-la.
 * ============================================================================
 */
export type Recorte = { in: number[] } | undefined;

/**
 * O mesmo recorte, em SQL, para as duas consultas que não passam pelo Prisma.
 *
 * `Prisma.empty` é a tradução exata de "não filtre": some da consulta sem
 * deixar um `AND true` para trás. E a lista entra como PARÂMETRO (`Prisma.join`),
 * nunca interpolada como texto — número vindo de fora concatenado numa consulta
 * é a definição de injeção de SQL, mesmo quando hoje ele vem de um lugar
 * confiável.
 */
function recorteSql(coluna: Prisma.Sql, recorte: Recorte): Prisma.Sql {
  if (!recorte) return Prisma.empty;
  if (recorte.in.length === 0) return Prisma.sql` AND false`;
  return Prisma.sql` AND ${coluna} IN (${Prisma.join(recorte.in)})`;
}

/* ------------------------------------------------------------------ *
 * Indicadores
 * ------------------------------------------------------------------ */

async function lerIndicadores(domingo: Date, recorte: Recorte): Promise<Indicador[]> {
  const inicio = soData(domingo);

  const [alunos, classes, presentes, visitantes, domingoAnterior] = await Promise.all([
    prisma.aluno.count({ where: { ativo: true, congId: recorte } }),
    prisma.classe.count({ where: { ativa: true, congId: recorte } }),
    prisma.frequencia.count({ where: { data: inicio, presente: true, congId: recorte } }),
    prisma.visitante.count({ where: { data: inicio, congId: recorte } }),
    (async () => {
      const anterior = new Date(inicio);
      anterior.setUTCDate(anterior.getUTCDate() - 7);
      const [p, v] = await Promise.all([
        prisma.frequencia.count({ where: { data: anterior, presente: true, congId: recorte } }),
        prisma.visitante.count({ where: { data: anterior, congId: recorte } }),
      ]);
      return { presentes: p, visitantes: v };
    })(),
  ]);

  /**
   * Variacao percentual.
   *
   * Devolve `null` quando nao ha base de comparacao — e `null` NAO e zero.
   * Sem domingo anterior registrado, "0%" seria uma afirmacao que ninguem
   * apurou; o cartao sabe mostrar "sem base de comparacao ainda".
   */
  const variar = (agora: number, antes: number, referencia: string) =>
    antes === 0 ? null : { percentual: Math.round(((agora - antes) / antes) * 1000) / 10, referencia };

  const taxa = alunos > 0 ? Math.round((presentes / alunos) * 100) : 0;

  return [
    {
      chave: "alunos",
      titulo: "Total de Alunos",
      valor: alunos,
      descricao: "matriculados e ativos",
      variacao: null,
      destino: "/dashboard/alunos",
    },
    {
      chave: "classes",
      titulo: "Total de Classes",
      valor: classes,
      descricao: "em atividade",
      variacao: null,
      destino: "/dashboard/classes",
    },
    {
      chave: "presentes",
      titulo: "Presentes Hoje",
      valor: presentes,
      descricao: `${taxa}% dos matriculados`,
      variacao: variar(presentes, domingoAnterior.presentes, "vs. domingo passado"),
      destino: "/dashboard/chamada",
    },
    {
      chave: "visitantes",
      titulo: "Visitantes",
      valor: visitantes,
      descricao: "recebidos no domingo",
      variacao: variar(visitantes, domingoAnterior.visitantes, "vs. domingo passado"),
      destino: "/dashboard/visitantes",
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Estrutura: pessoas, cargos, classes, congregacoes
 * ------------------------------------------------------------------ */

async function lerEstrutura(recorte: Recorte): Promise<Estrutura> {
  /*
   * Pessoa não tem congregação — o CARGO é que tem.
   *
   * Uma pessoa pode ser Professora numa congregação e Secretária noutra, e
   * continua sendo uma pessoa só. Por isso o recorte entra pelos vínculos: são
   * as pessoas que exercem ALGUMA função nas congregações permitidas.
   */
  const daCongregacao = recorte ? { cargos: { some: { congId: recorte, ativo: true } } } : {};

  const [pessoas, cargosOcupados, acumulam, classes, congregacoes, revisar] = await Promise.all([
    prisma.pessoa.count({ where: { ativo: true, ...daCongregacao } }),
    prisma.pessoaCargo.count({ where: { ativo: true, congId: recorte } }),
    // Quantas pessoas exercem mais de uma funcao. E este numero que explica por
    // que "pessoas" e "cargos" nao batem — sem ele, a diferenca parece erro.
    prisma.pessoaCargo
      .groupBy({
        by: ["pessoaId"],
        where: { ativo: true, congId: recorte },
        _count: { _all: true },
      })
      .then((linhas) => linhas.filter((l) => l._count._all > 1).length),
    prisma.classe.count({ where: { ativa: true, congId: recorte } }),
    // So congregacoes que de fato tem alguma coisa: o model foi DERIVADO dos
    // congId encontrados no export, e duas delas (11 e 14) nao tem classe nem
    // aluno nenhum. Conta-las infla o numero com congregacao vazia.
    prisma.congregacao.count({
      where: {
        id: recorte,
        OR: [{ classes: { some: {} } }, { alunos: { some: {} } }],
      },
    }),
    // "A conferir" é sempre do campo: uma possível duplicata entre duas pessoas
    // de congregações diferentes é justamente o caso que o recorte esconderia
    // de todo mundo, ficando sem ninguém para resolver.
    prisma.pessoa.count({ where: { revisar: true } }),
  ]);

  return { pessoas, cargosOcupados, acumulam, classes, congregacoes, revisar };
}

/* ------------------------------------------------------------------ *
 * Lideranca do campo
 * ------------------------------------------------------------------ */

/**
 * Hierarquia oficial, lida do banco.
 *
 * Nenhum nome aparece no codigo. A ordem vem de `Cargos.ordem` e a lista, de
 * quais cargos estao marcados como `destaque`. Trocar o Supervisor da EBD e uma
 * alteracao de dado — o painel administrativo faz, sem tocar em arquivo nenhum,
 * que e o que a especificacao pede.
 *
 * Cargo vago aparece assim mesmo, com o lugar reservado: some-lo esconderia da
 * igreja que a funcao existe e esta sem ninguem.
 */
async function lerLideranca(): Promise<Lider[]> {
  const cargos = await prisma.cargo.findMany({
    where: { destaque: true, ativo: true },
    orderBy: { ordem: "asc" },
    select: {
      id: true,
      nome: true,
      ordem: true,
      vinculos: {
        where: { ativo: true, fim: null },
        take: 1,
        orderBy: { criadoEm: "asc" },
        select: {
          pessoa: { select: { id: true, nome: true, tratamento: true, foto: true } },
        },
      },
    },
  });

  return cargos.map((c) => {
    const pessoa = c.vinculos[0]?.pessoa ?? null;
    return {
      cargoId: c.id,
      cargo: c.nome,
      ordem: c.ordem,
      pessoaId: pessoa?.id ?? null,
      nome: pessoa?.nome ?? null,
      tratamento: pessoa?.tratamento ?? null,
      foto: pessoa?.foto ?? null,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Frequencia mensal
 * ------------------------------------------------------------------ */

async function lerFrequencia(hoje: Date, recorte: Recorte): Promise<PontoFrequencia[]> {
  const inicio = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - 11, 1));
  const soFrequencias = recorteSql(Prisma.sql`f."congId"`, recorte);
  const soVisitantes = recorteSql(Prisma.sql`v."congId"`, recorte);

  /*
   * MEDIA POR DOMINGO, e nao soma do mes.
   *
   * A soma parece o numero obvio e esta errada para este grafico. Junho tem
   * 585 presencas registradas — mas em quatro ou cinco domingos. Colocada ao
   * lado dos 291 matriculados, a soma sugere que compareceu o dobro da igreja,
   * quando na verdade foram ~146 pessoas por domingo.
   *
   * Dividindo pelo numero de domingos que tiveram chamada, a serie passa a
   * responder "quantos vem num domingo tipico", que e comparavel com o total de
   * matriculados e e a pergunta que a secretaria realmente faz.
   *
   * `NULLIF(...,0)` evita divisao por zero em mes sem chamada nenhuma;
   * `COALESCE` transforma o NULL resultante em 0.
   *
   * Uma consulta agregada, e nao doze: a tabela cresce ~2.600 linhas por ano, e
   * um laco de doze consultas viraria doze varreduras. O `date_trunc` resolve no
   * banco, que e onde os indices estao.
   */
  const linhas = await prisma.$queryRaw<Array<{ mes: Date; presentes: bigint; visitantes: bigint }>>`
    WITH meses AS (
      SELECT generate_series(${inicio}::date, date_trunc('month', now())::date, '1 month') AS mes
    )
    SELECT
      m.mes,
      COALESCE((
        SELECT round(
          count(*) FILTER (WHERE f.presente)::numeric
          / NULLIF(count(DISTINCT f.data), 0)
        )
        FROM "Frequencias" f
        WHERE date_trunc('month', f.data) = m.mes${soFrequencias}
      ), 0) AS presentes,
      COALESCE((
        SELECT round(
          count(*)::numeric / NULLIF(count(DISTINCT v.data), 0)
        )
        FROM "Visitantes" v
        WHERE date_trunc('month', v.data) = m.mes${soVisitantes}
      ), 0) AS visitantes
    FROM meses m
    ORDER BY m.mes
  `;

  const matriculados = await prisma.aluno.count({ where: { ativo: true, congId: recorte } });

  return linhas.map((l) => ({
    mes: MESES[new Date(l.mes).getUTCMonth()],
    presentes: Number(l.presentes),
    visitantes: Number(l.visitantes),
    // O cadastro nao guarda historico de matricula: nao da para saber quantos
    // alunos existiam em marco. O total atual e a unica referencia honesta, e
    // por isso a serie e uma linha reta tracejada — um "teto", nao uma medicao.
    matriculados,
  }));
}

/* ------------------------------------------------------------------ *
 * Resto do painel
 * ------------------------------------------------------------------ */

/**
 * Arruma a licao para exibicao.
 *
 * O titulo vem do sistema antigo ja com o numero embutido — "Lição 05: Cristo
 * entre os Filósofos". Como a tela mostra o numero num campo proprio, deixar o
 * titulo intacto produziria "Lição 5 — Lição 05: Cristo entre…".
 *
 * O numero sai do TITULO, e nao do campo `trim`: `trim` guarda o trimestre
 * ("3T"), e le-lo como numero da 3 em toda licao do trimestre — a lição 5, a 6
 * e a 7 apareceriam todas como "Lição 3".
 */
function separarLicao(licao: { titulo: string; trim: string; tipoClasse: string } | null) {
  if (!licao) {
    return { numero: 0, titulo: "Sem lição cadastrada para este domingo", revista: "—" };
  }

  const achado = /li[çc][ãa]o\s*0*(\d+)\s*[:\-–]?\s*/i.exec(licao.titulo);
  const numero = achado ? Number(achado[1]) : 0;
  const titulo = achado ? licao.titulo.slice(achado.index + achado[0].length).trim() : licao.titulo;

  const trimestre = /^(\d)T$/i.exec(licao.trim);
  const categoria = licao.tipoClasse
    ? licao.tipoClasse[0].toUpperCase() + licao.tipoClasse.slice(1)
    : "";

  return {
    numero,
    titulo: titulo || licao.titulo,
    revista: [categoria, trimestre ? `${trimestre[1]}º Trimestre` : licao.trim]
      .filter(Boolean)
      .join(" — "),
  };
}

async function lerResumo(hoje: Date, domingo: Date, recorte: Recorte) {
  const inicio = soData(domingo);
  const hojeCivil = soData(hoje);

  const [licao, licaoFallback, classesTotal, iniciadas, presentes, visitantes, professores] = await Promise.all([
    /*
     * A PRÓXIMA lição de ADULTOS — a que vem, não a que passou.
     *
     * O painel abre no meio da semana, e mostrar a lição do domingo que já
     * passou não ajuda ninguém a se preparar. Então a busca é para a frente
     * (`data >= hoje`) e fica na classe de adultos, que é a referência do campo.
     * No domingo, `data >= hoje` já inclui a lição do próprio dia.
     *
     * A lição é a mesma em todo o campo — não se recorta por congregação.
     */
    prisma.licao.findFirst({
      where: { data: { gte: hojeCivil }, tipoClasse: "adultos" },
      orderBy: [{ data: "asc" }, { id: "asc" }],
    }),
    // Reserva: se o trimestre acabou e não há lição futura cadastrada, mostra a
    // última de adultos em vez de deixar o card vazio.
    prisma.licao.findFirst({
      where: { tipoClasse: "adultos" },
      orderBy: [{ data: "desc" }, { id: "desc" }],
    }),
    prisma.classe.count({ where: { ativa: true, congId: recorte } }),
    prisma.frequencia
      .groupBy({ by: ["classeId"], where: { data: inicio, congId: recorte } })
      .then((l) => l.length),
    prisma.frequencia.count({ where: { data: inicio, presente: true, congId: recorte } }),
    prisma.visitante.count({ where: { data: inicio, congId: recorte } }),
    // Professores DISTINTOS, e nao classes com professor: a mesma pessoa em
    // duas classes e uma pessoa.
    prisma.pessoaCargo
      .findMany({
        where: { ativo: true, cargo: { nome: "Professor" }, congId: recorte },
        select: { pessoaId: true },
        distinct: ["pessoaId"],
      })
      .then((l) => l.length),
  ]);

  return {
    licao: separarLicao(licao ?? licaoFallback),
    classesIniciadas: iniciadas,
    classesTotal,
    presentes,
    visitantes,
    professores,
    ultimaSincronizacao: null,
  };
}

const ACAO_PARA_TIPO: Record<string, TipoAtividade> = {
  presenca: "presenca",
  frequencia: "presenca",
  visitante: "visitante",
  classe: "classe",
  relatorio: "relatorio",
  aluno: "cadastro",
};

/**
 * As últimas ações registradas.
 *
 * ============================================================================
 * PARA QUEM VÊ SÓ UMA CONGREGAÇÃO, ESTA LISTA VEM VAZIA — DE PROPÓSITO
 *
 * `Auditoria` é a tabela do sistema antigo e NÃO tem coluna de congregação: as
 * 1.679 linhas guardam quem, quando, o quê e sobre qual entidade, e nada mais.
 * Não há como recortá-la sem inventar o dado que falta.
 *
 * Restavam três saídas, e duas são piores. Mostrar tudo entregaria ao Dirigente
 * de uma congregação o que a secretaria de outra andou alterando. Adivinhar a
 * congregação pelo texto de `desc` seria decidir por conta própria sobre
 * registro do sistema antigo, que é exatamente o que a regra da igreja proíbe.
 *
 * Fica a terceira: quem enxerga o campo vê a lista; quem enxerga uma
 * congregação não vê nenhuma. Quando a auditoria nova (Fase 12) passar a
 * gravar a congregação, o recorte deixa de ser impossível e esta função muda
 * numa linha.
 * ============================================================================
 */
async function lerAtividades(recorte: Recorte): Promise<Atividade[]> {
  if (recorte) return [];

  const linhas = await prisma.auditoria.findMany({ orderBy: { when: "desc" }, take: 8 });

  return linhas.map((a) => ({
    id: String(a.id),
    tipo: ACAO_PARA_TIPO[a.entidade.toLowerCase()] ?? "cadastro",
    autor: a.who || a.whoLogin,
    descricao: a.desc || a.action,
    quando: a.when.getTime(),
  }));
}

/**
 * Aniversariantes NÃO se recortam por congregação — a mesma exceção
 * deliberada de `lerLideranca()`, agora por pedido explícito da liderança
 * (Fase 18): aniversário é celebração da igreja toda, não de uma
 * congregação só, então todo mundo vê os do campo inteiro aqui — inclusive
 * quem só enxerga a própria congregação no resto do portal. Ver
 * `/api/aniversariantes` para a mesma regra na tela dedicada.
 */
async function lerAniversariantes(hoje: Date): Promise<Aniversariante[]> {
  /*
   * Aniversario nao tem ano, entao a comparacao e por mes e dia. A janela de 15
   * dias atravessa a virada do mes — daí o OR: em 28 de agosto, quem faz
   * aniversario em 3 de setembro precisa aparecer.
   */
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + 15);

  const linhas = await prisma.$queryRaw<
    Array<{ id: number; nome: string; nasc: Date; classe: string | null }>
  >`
    SELECT a.id, a.nome, a.nasc, c.nome AS classe
    FROM "Alunos" a
    LEFT JOIN "Classes" c ON c.id = a."classeId"
    WHERE a.ativo AND a.nasc IS NOT NULL
      AND (
        to_char(a.nasc, 'MM-DD') BETWEEN to_char(${hoje}::date, 'MM-DD') AND to_char(${limite}::date, 'MM-DD')
        OR (
          to_char(${hoje}::date, 'MM-DD') > to_char(${limite}::date, 'MM-DD')
          AND (to_char(a.nasc, 'MM-DD') >= to_char(${hoje}::date, 'MM-DD')
               OR to_char(a.nasc, 'MM-DD') <= to_char(${limite}::date, 'MM-DD'))
        )
      )
    ORDER BY to_char(a.nasc, 'MM-DD')
    LIMIT 6
  `;

  return linhas.map((a) => {
    const nasc = new Date(a.nasc);
    const mes = String(nasc.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(nasc.getUTCDate()).padStart(2, "0");
    return {
      id: String(a.id),
      nome: a.nome,
      classe: a.classe ?? "Sem classe",
      diaMes: `${mes}-${dia}`,
      idade: hoje.getFullYear() - nasc.getUTCFullYear(),
      foto: null,
    };
  });
}

const TIPO_EVENTO: Record<string, TipoCompromisso> = {
  culto: "culto",
  ebd: "ebd",
};

async function lerAgenda(hoje: Date, recorte: Recorte): Promise<Compromisso[]> {
  const eventos = await prisma.evento.findMany({
    where: {
      data: { gte: soData(hoje) },
      /*
       * Evento SEM congregação é do campo — e o campo inteiro precisa vê-lo.
       *
       * Recortar só por `congId in (...)` esconderia a Assembleia Geral e o
       * Congresso do Campo de todas as congregações, que são justamente os
       * compromissos que ninguém pode perder. Por isso o `OR` com `congId:
       * null`, e não uma lista simples.
       */
      ...(recorte ? { OR: [{ congId: recorte }, { congId: null }] } : {}),
    },
    orderBy: { data: "asc" },
    take: 4,
    include: { congregacao: { select: { nome: true } } },
  });

  return eventos.map((e) => ({
    id: String(e.id),
    tipo: TIPO_EVENTO[e.tipo?.toLowerCase() ?? ""] ?? "evento",
    titulo: e.titulo,
    local: e.local || e.congregacao?.nome || "Campo de Betânia",
    quando: e.data.toISOString(),
  }));
}

/* ------------------------------------------------------------------ *
 * Destaque — assiduidade + visitantes, mensal e trimestral (Fase 18)
 *
 * A conta (as duas taxas, o piso mínimo, o empate) é pura e mora em
 * `lib/dashboard/destaque.ts`, testada sem banco em
 * `scripts/verificar-destaque.mts`. Aqui só busca as linhas.
 * ------------------------------------------------------------------ */

interface LinhaBrutaDestaque {
  chave: number;
  nome: string | null;
  domingos: number;
  chamados: number;
  presentes: number;
  domingosComVisitante: number;
}

/**
 * Exportada (e não só usada por `lerDestaques` abaixo) porque `/api/dashboard/destaque`
 * (Fase 20) a chama direto, com um período ESCOLHIDO NA TELA — não apenas o
 * mês ou o trimestre corrente. É a mesma conta, com `de`/`ate` livres.
 */
export async function lerDestaquesDoAgrupamento(
  coluna: "congId" | "classeId",
  de: Date,
  ate: Date,
  recorte: Recorte,
): Promise<Destaque | null> {
  const colunaSql = coluna === "congId" ? Prisma.sql`"congId"` : Prisma.sql`"classeId"`;
  const nomeTabela = coluna === "congId" ? Prisma.sql`"Congregacoes"` : Prisma.sql`"Classes"`;
  const colunaRecorte = coluna === "congId" ? Prisma.sql`f."congId"` : Prisma.sql`c."congId"`;

  const linhas = await prisma.$queryRaw<LinhaBrutaDestaque[]>`
    WITH chamadas AS (
      SELECT f.${colunaSql} AS chave, f.data,
             COUNT(*) AS chamados,
             COUNT(*) FILTER (WHERE f.presente) AS presentes
      FROM "Frequencias" f
      WHERE f.data >= ${de} AND f.data <= ${ate} AND f.${colunaSql} IS NOT NULL
        ${recorteSql(colunaRecorte, recorte)}
      GROUP BY f.${colunaSql}, f.data
    ),
    visitas AS (
      SELECT v.${colunaSql} AS chave, v.data
      FROM "Visitantes" v
      WHERE v.data >= ${de} AND v.data <= ${ate} AND v.${colunaSql} IS NOT NULL
      GROUP BY v.${colunaSql}, v.data
    )
    SELECT
      c.chave,
      n.nome,
      COUNT(DISTINCT c.data)::int AS domingos,
      SUM(c.chamados)::int AS chamados,
      SUM(c.presentes)::int AS presentes,
      COUNT(DISTINCT vv.data)::int AS "domingosComVisitante"
    FROM chamadas c
    LEFT JOIN visitas vv ON vv.chave = c.chave AND vv.data = c.data
    LEFT JOIN ${nomeTabela} n ON n.id = c.chave
    GROUP BY c.chave, n.nome
  `;

  return calcularDestaque(
    linhas.map((l) => ({ ...l, nome: l.nome?.trim() || `#${l.chave}` })),
  );
}

async function lerDestaques(hoje: Date, recorte: Recorte): Promise<Destaques> {
  const inicioMes = inicioDoMes(hoje);
  const inicioTri = inicioDoTrimestre(hoje);

  const [congMensal, congTrimestral, classeMensal, classeTrimestral] = await Promise.all([
    // Congregação Destaque NÃO se recorta — a mesma exceção de aniversariantes
    // e liderança (Fase 18): é uma comparação do campo inteiro, e a liderança
    // pediu que todo mundo visse quem se destacou, não só quem enxerga tudo.
    lerDestaquesDoAgrupamento("congId", inicioMes, hoje, undefined),
    lerDestaquesDoAgrupamento("congId", inicioTri, hoje, undefined),
    // Classe Destaque SE recorta: comparar a classe de uma congregação de 80
    // pessoas com a de uma de 15 mistura populações diferentes, e quem só
    // enxerga a própria congregação não tem o que fazer com o resultado de
    // outra. Aqui o recorte de acesso continua valendo.
    lerDestaquesDoAgrupamento("classeId", inicioMes, hoje, recorte),
    lerDestaquesDoAgrupamento("classeId", inicioTri, hoje, recorte),
  ]);

  const paraISO = (d: Date) => soData(d).toISOString().slice(0, 10);
  return {
    periodo: {
      mensal: { de: paraISO(inicioMes), ate: paraISO(hoje) },
      trimestral: { de: paraISO(inicioTri), ate: paraISO(hoje) },
    },
    congregacao: { mensal: congMensal, trimestral: congTrimestral },
    classe: { mensal: classeMensal, trimestral: classeTrimestral },
  };
}

/* ------------------------------------------------------------------ *
 * Entrada
 * ------------------------------------------------------------------ */

/** Quem está olhando o painel. `null` quando não há autenticação configurada. */
export interface QuemOlha {
  nome: string;
  cargo: string;
  /** Congregações que este acesso enxerga. Vazio = o campo inteiro. */
  congIds: number[];
  escopo: "campo" | "congregacao";
}

export async function lerPainel(
  hoje = new Date(),
  quem: QuemOlha | null = null,
): Promise<DadosPainel> {
  if (!temBanco()) throw new Error("DATABASE_URL não configurada");

  const domingo = domingoDaSemana(hoje);

  /*
   * O recorte é aplicado no SERVIDOR, dentro das consultas.
   *
   * A alternativa preguiçosa — buscar tudo e filtrar na tela — enviaria ao
   * navegador de um professor os números de todas as congregações do campo.
   * Bastaria abrir as ferramentas do navegador para ler o que a tela decidiu
   * não desenhar. Dado que não pode ser visto não é enviado.
   */
  const recorte: Recorte =
    quem && quem.escopo === "congregacao" ? { in: quem.congIds } : undefined;

  const [indicadores, estrutura, lideranca, frequencia, resumo, atividades, aniversariantes, agenda, destaques] =
    await Promise.all([
      lerIndicadores(domingo, recorte),
      lerEstrutura(recorte),
      // A liderança do campo NÃO se recorta: é institucional, e saber quem é o
      // Pastor Presidente é de toda a igreja, não de uma congregação.
      lerLideranca(),
      lerFrequencia(hoje, recorte),
      lerResumo(hoje, domingo, recorte),
      lerAtividades(recorte),
      lerAniversariantes(hoje),
      lerAgenda(hoje, recorte),
      lerDestaques(hoje, recorte),
    ]);

  const congregacaoDoTitulo =
    recorte && recorte.in.length === 1
      ? ((await prisma.congregacao.findUnique({
          where: { id: recorte.in[0] },
          select: { nome: true },
        }))?.nome ?? "Campo de Betânia")
      : recorte
        ? `${recorte.in.length} congregações`
        : "Campo de Betânia";

  return {
    origem: "banco",
    usuario: {
      nome: quem?.nome ?? "Secretaria da EBD",
      cargo: quem?.cargo ?? "Secretário Geral",
      congregacao: congregacaoDoTitulo,
      foto: null,
    },
    versiculo: await lerVersiculo(hoje),
    indicadores,
    estrutura,
    lideranca,
    frequencia,
    resumo,
    atividades,
    aniversariantes,
    agenda,
    destaques,
  };
}

async function lerVersiculo(hoje: Date) {
  const total = await prisma.versiculo.count({ where: { ativo: true } });
  if (total === 0) return { texto: "", referencia: "" };

  // Pela DATA, e nao por sorteio: sorteando, cada aparelho da igreja mostraria
  // um versiculo diferente na mesma manha.
  const inicio = Date.UTC(hoje.getFullYear(), 0, 1);
  const atual = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diaDoAno = Math.floor((atual - inicio) / 86_400_000);

  const [v] = await prisma.versiculo.findMany({
    where: { ativo: true },
    orderBy: { id: "asc" },
    skip: diaDoAno % total,
    take: 1,
  });
  return { texto: v?.texto ?? "", referencia: v?.ref ?? "" };
}
