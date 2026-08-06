import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { escopoDaRota } from "@/lib/auth/escopo";

/**
 * As congregações do campo, cada uma com quem responde por ela.
 *
 * ============================================================================
 * O DIRIGENTE E O VICE NÃO SÃO COLUNAS — SÃO CARGOS
 *
 * `Congregacoes` tem duas colunas: `id` e `nome`. Quem dirige vem de
 * `PessoaCargos`, filtrando pelos cargos de escopo de congregação. É a mesma
 * fonte que decide o acesso ao portal (ver lib/auth/papeis.ts), e ser a mesma
 * fonte é o ponto: a tela nunca vai mostrar um dirigente diferente do que o
 * sistema usa para liberar telas.
 *
 * "Coordenador de Congregação" entra junto de "Dirigente" porque é o nome que o
 * cargo tem em parte do cadastro herdado. Ignorá-lo deixaria congregações
 * aparecendo como se não tivessem ninguém — o que seria falso.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const CARGOS_DE_DIRECAO = ["Dirigente", "Coordenador de Congregação"];
const CARGOS_DE_VICE = ["Vice-Dirigente"];
const CARGOS_DE_SECRETARIA = ["Secretário Local"];

/** Domingo mais recente, como data civil UTC. */
function domingoMaisRecente(hoje = new Date()): Date {
  const d = new Date(hoje);
  d.setDate(d.getDate() - d.getDay());
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export async function GET() {
  const { recusa, congId, recortado } = await escopoDaRota("congregacoes");
  if (recusa) return recusa;

  return responder(async () => {
    const domingo = domingoMaisRecente();

    const congregacoes = await prisma.congregacao.findMany({
      where: { id: congId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        nome: true,
        _count: { select: { classes: true, alunos: true } },
        pessoaCargos: {
          where: {
            ativo: true,
            fim: null,
            cargo: {
              nome: { in: [...CARGOS_DE_DIRECAO, ...CARGOS_DE_VICE, ...CARGOS_DE_SECRETARIA] },
            },
          },
          select: {
            cargo: { select: { nome: true, ordem: true } },
            pessoa: { select: { id: true, nome: true, tratamento: true, tel: true, foto: true } },
          },
          orderBy: { cargo: { ordem: "asc" } },
        },
      },
    });

    const ids = congregacoes.map((c) => c.id);

    /*
     * Presentes e professores saem de consultas AGRUPADAS, e não de uma
     * consulta por congregação dentro do laço.
     *
     * Com quatorze congregações, o laço seriam vinte e oito idas ao banco para
     * desenhar uma tela — o N+1 clássico, que numa lista pequena passa
     * despercebido e aparece como lentidão inexplicável quando o campo crescer.
     */
    const [presentes, professores, classesAtivas] = await Promise.all([
      prisma.frequencia.groupBy({
        by: ["congId"],
        where: { congId: { in: ids }, data: domingo, presente: true },
        _count: { _all: true },
      }),
      prisma.pessoaCargo.findMany({
        where: { congId: { in: ids }, ativo: true, cargo: { nome: "Professor" } },
        select: { congId: true, pessoaId: true },
        distinct: ["congId", "pessoaId"],
      }),
      prisma.classe.groupBy({
        by: ["congId"],
        where: { congId: { in: ids }, ativa: true },
        _count: { _all: true },
      }),
    ]);

    const presentesPor = new Map(presentes.map((p) => [p.congId, p._count._all]));
    const classesPor = new Map(classesAtivas.map((c) => [c.congId, c._count._all]));
    const professoresPor = new Map<number, number>();
    for (const p of professores) {
      if (p.congId === null) continue;
      professoresPor.set(p.congId, (professoresPor.get(p.congId) ?? 0) + 1);
    }

    const itens = congregacoes.map((c) => {
      const de = (nomes: string[]) =>
        c.pessoaCargos
          .filter((v) => nomes.includes(v.cargo.nome))
          .map((v) => ({ ...v.pessoa, cargo: v.cargo.nome }));

      return {
        id: c.id,
        // O nome foi derivado da conta de coordenador do sistema antigo; onde
        // ele não veio, mostrar o número é melhor do que mostrar vazio.
        nome: c.nome || `Congregação ${c.id}`,
        semNome: !c.nome,
        dirigentes: de(CARGOS_DE_DIRECAO),
        vices: de(CARGOS_DE_VICE),
        secretarios: de(CARGOS_DE_SECRETARIA),
        classes: classesPor.get(c.id) ?? 0,
        classesTotal: c._count.classes,
        alunos: c._count.alunos,
        professores: professoresPor.get(c.id) ?? 0,
        presentesNoDomingo: presentesPor.get(c.id) ?? 0,
      };
    });

    return {
      itens,
      total: itens.length,
      domingo: domingo.toISOString().slice(0, 10),
      recortado,
      /*
       * Quantas ainda estão sem dirigente registrado.
       *
       * É o número que a supervisão precisa: cada uma dessas é uma congregação
       * cujo responsável o sistema não sabe quem é — e não uma congregação sem
       * responsável. A diferença é que a primeira se resolve cadastrando o
       * cargo, e é isso que o aviso da tela pede.
       */
      semDirigente: itens.filter((c) => c.dirigentes.length === 0).length,
    };
  });
}
