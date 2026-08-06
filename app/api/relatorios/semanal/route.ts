import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { escopoDaRota } from "@/lib/auth/escopo";

/**
 * Relatório Semanal — o mesmo formulário de papel da Superintendência das
 * Escolas Dominicais (Assembleia de Deus em Pernambuco), calculado em vez de
 * preenchido à mão.
 *
 * ============================================================================
 * O QUE É REAL E O QUE FICA EM BRANCO DE PROPÓSITO
 *
 * Matriculados, presentes, visitantes e o número de professores por classe
 * vêm de dado de verdade (`Alunos`, `Frequencias`, `Visitantes`,
 * `PessoaCargos`). "Bíblias" e "Ofertas" saíram — o pedido foi explícito, e
 * de qualquer forma não existe coluna nenhuma pra eles desde que a oferta
 * saiu dos relatórios (ver README).
 *
 * "Visita Ministerial" e "Nº de Conversões" NÃO têm tabela nenhuma no
 * sistema — nenhuma fase, nem a antiga nem esta, guarda isso em lugar
 * algum. A tela deixa os dois em branco, para a secretaria preencher à mão
 * depois de imprimir, em vez de inventar um zero que pareceria apurado.
 *
 * "Presentes" vem `null` (não `0`) numa classe que não fez chamada naquele
 * domingo — a mesma regra de sempre: falta ≠ não marcado.
 * ============================================================================
 *
 *   ?cong=4&data=2026-08-09
 */
export const dynamic = "force-dynamic";

const CARGOS_LIDERANCA = ["Dirigente", "Vice-Dirigente", "Secretário Local", "Coordenador de Congregação"] as const;

export async function GET(req: Request) {
  const { recusa, congId: doAcesso } = await escopoDaRota("rel-semanal");
  if (recusa) return recusa;

  const url = new URL(req.url);
  const congId = Number(url.searchParams.get("cong"));
  const dataStr = url.searchParams.get("data") ?? "";
  if (!Number.isInteger(congId) || congId <= 0) return erro("Informe a congregação.", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return erro("Informe a data (o domingo do relatório).", 400);
  if (doAcesso && !doAcesso.in.includes(congId)) {
    return erro("Esta congregação está fora do seu alcance.", 403);
  }

  return responder(async () => {
    const congregacao = await prisma.congregacao.findUnique({
      where: { id: congId },
      select: { id: true, nome: true },
    });
    if (!congregacao) throw new Error("Congregação não encontrada.");

    const dia = new Date(`${dataStr}T00:00:00Z`);

    const classes = await prisma.classe.findMany({
      where: { congId, ativa: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        _count: { select: { alunos: { where: { ativo: true } } } },
        pessoaCargos: { where: { ativo: true, cargo: { nome: "Professor" } }, select: { id: true } },
      },
    });
    const classeIds = classes.map((c) => c.id);

    const [marcacoes, presencas, visitantes, lideranca, professoresDaCong] = await Promise.all([
      // TODAS as marcações do dia — é o que diferencia "0 presentes" de
      // "chamada não feita".
      prisma.frequencia.groupBy({
        by: ["classeId"],
        where: { classeId: { in: classeIds }, data: dia },
        _count: { _all: true },
      }),
      prisma.frequencia.groupBy({
        by: ["classeId"],
        where: { classeId: { in: classeIds }, data: dia, presente: true },
        _count: { _all: true },
      }),
      prisma.visitante.groupBy({
        by: ["classeId"],
        where: { classeId: { in: classeIds }, data: dia },
        _count: { _all: true },
      }),
      prisma.pessoaCargo.findMany({
        where: { congId, ativo: true, fim: null, cargo: { nome: { in: [...CARGOS_LIDERANCA] } } },
        select: { cargo: { select: { nome: true } }, pessoa: { select: { nome: true, tratamento: true } } },
      }),
      // Professores da congregação SEM repetir quem dá aula em duas classes —
      // a mesma ressalva do organograma (Fase 12): contar por vínculo dobraria
      // essa pessoa.
      prisma.pessoaCargo.findMany({
        where: { congId, ativo: true, fim: null, cargo: { nome: "Professor" } },
        select: { pessoaId: true },
        distinct: ["pessoaId"],
      }),
    ]);

    const marcadosPorClasse = new Map(marcacoes.map((m) => [m.classeId, m._count._all]));
    const presentesPorClasse = new Map(presencas.map((p) => [p.classeId, p._count._all]));
    const visitantesPorClasse = new Map(visitantes.map((v) => [v.classeId, v._count._all]));

    const linhas = classes.map((c) => {
      const chamadaFeita = (marcadosPorClasse.get(c.id) ?? 0) > 0;
      const presentes = chamadaFeita ? (presentesPorClasse.get(c.id) ?? 0) : null;
      const visit = visitantesPorClasse.get(c.id) ?? 0;
      return {
        classeId: c.id,
        nome: c.nome,
        matriculados: c._count.alunos,
        presentes,
        visitantes: visit,
        professores: c.pessoaCargos.length,
        total: presentes !== null ? presentes + visit : null,
      };
    });

    const totais = {
      matriculados: linhas.reduce((s, l) => s + l.matriculados, 0),
      // `null` só quando NENHUMA classe fez chamada — soma parcial ainda soma
      // o que existe, porque "algumas classes não chamaram" não invalida as
      // que chamaram.
      presentes: linhas.some((l) => l.presentes !== null)
        ? linhas.reduce((s, l) => s + (l.presentes ?? 0), 0)
        : null,
      visitantes: linhas.reduce((s, l) => s + l.visitantes, 0),
      professores: linhas.reduce((s, l) => s + l.professores, 0),
    };

    // 1º lugar — a mesma pergunta que a secretaria faz de cabeça comparando as
    // linhas da folha: quem trouxe mais gente, não a taxa (essa conta já
    // existe no Painel/Ranking, com outro propósito).
    function primeiroLugar(
      valor: (l: (typeof linhas)[number]) => number | null,
    ): { nomes: string[]; valor: number } | null {
      const candidatas = linhas
        .map((l) => ({ nome: l.nome, v: valor(l) }))
        .filter((x): x is { nome: string; v: number } => typeof x.v === "number" && x.v > 0);
      if (candidatas.length === 0) return null;
      const maior = Math.max(...candidatas.map((c) => c.v));
      return { nomes: candidatas.filter((c) => c.v === maior).map((c) => c.nome), valor: maior };
    }

    const porCargo = new Map<string, string>();
    for (const v of lideranca) {
      const nome = [v.pessoa.tratamento, v.pessoa.nome].filter(Boolean).join(" ");
      // Se dois vínculos ativos do mesmo cargo (não deveria acontecer), o
      // primeiro encontrado fica — não é o foco desta tela decidir qual está
      // certo, só refletir o que existe.
      if (!porCargo.has(v.cargo.nome)) porCargo.set(v.cargo.nome, nome);
    }

    return {
      congId: congregacao.id,
      congNome: congregacao.nome?.trim() || `Congregação ${congregacao.id}`,
      data: dataStr,
      linhas,
      totais,
      primeiroLugar: {
        frequencia: primeiroLugar((l) => l.presentes),
        visitantes: primeiroLugar((l) => l.visitantes),
      },
      lideranca: {
        dirigente: porCargo.get("Dirigente") ?? null,
        viceDirigente: porCargo.get("Vice-Dirigente") ?? null,
        secretarioLocal: porCargo.get("Secretário Local") ?? null,
        coordenador: porCargo.get("Coordenador de Congregação") ?? null,
        totalProfessores: professoresDaCong.length,
      },
    };
  });
}
