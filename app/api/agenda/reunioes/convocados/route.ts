import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { PAPEIS_LIDERANCA, PAPEL_PROFESSOR, ordemDoPapel, porPapelENome } from "@/lib/agenda/convocacao";

/**
 * Quem convocar para um estudo ou reunião, congregação por congregação, na
 * ordem que a liderança usa: Dirigente, Vice-Dirigente (quando houver),
 * Secretário Local e — se pedido — os Professores.
 *
 *   ?quem=lideranca    Dirigente, Vice e Secretário (padrão)
 *   ?quem=professores  só os Professores
 *   ?quem=todos        liderança e Professores
 *
 * ============================================================================
 * A LISTA VEM DA HIERARQUIA, NÃO É DIGITADA DE NOVO AQUI
 *
 * São os cargos de `PessoaCargos` (Fase 08), os mesmos que a tela de
 * Congregações usa. Buscar aqui evita digitar dezenas de nomes a cada
 * reunião e evita dois lugares divergindo sobre quem é o Dirigente.
 *
 * Uma congregação sem ninguém nos cargos ainda entra na lista, vazia — sumir
 * com ela faria parecer que não precisa ser chamada, quando na verdade é ela
 * que está sem liderança cadastrada.
 *
 * A MESMA PESSOA EM DOIS CARGOS APARECE UMA VEZ SÓ, no cargo mais alto, com
 * o outro junto ("Dirigente · Professor") — duas linhas dela na folha de
 * assinatura pediriam duas assinaturas da mesma pessoa.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

function nomeComTratamento(nome: string, tratamento: string | null): string {
  return tratamento ? `${tratamento} ${nome}` : nome;
}

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("agenda-reunioes");
  if (recusa) return recusa;

  const quem = new URL(req.url).searchParams.get("quem");
  const cargos =
    quem === "professores"
      ? [PAPEL_PROFESSOR]
      : quem === "todos"
        ? [...PAPEIS_LIDERANCA, PAPEL_PROFESSOR]
        : [...PAPEIS_LIDERANCA];

  return responder(async () => {
    // Quem cuida de uma congregação só monta a lista da sua.
    const recorte = recorteDaSessao(sessao);
    const [congregacoes, vinculos] = await Promise.all([
      prisma.congregacao.findMany({
        where: recorte ? { id: { in: recorte.in } } : {},
        orderBy: { nome: "asc" },
        select: { id: true, nome: true },
      }),
      prisma.pessoaCargo.findMany({
        where: {
          ativo: true,
          fim: null,
          congId: recorte ? { in: recorte.in } : { not: null },
          cargo: { nome: { in: cargos } },
        },
        select: {
          congId: true,
          pessoaId: true,
          pessoa: { select: { nome: true, tratamento: true } },
          cargo: { select: { nome: true } },
          classe: { select: { nome: true } },
        },
      }),
    ]);

    // Uma entrada por pessoa em cada congregação, com os cargos dela em ordem.
    const porCong = new Map<number, Map<number, { nome: string; papeis: string[]; classes: string[] }>>();
    for (const v of vinculos) {
      const pessoas = porCong.get(v.congId!) ?? new Map();
      const atual = pessoas.get(v.pessoaId) ?? {
        nome: nomeComTratamento(v.pessoa.nome, v.pessoa.tratamento),
        papeis: [],
        classes: [],
      };
      if (!atual.papeis.includes(v.cargo.nome)) atual.papeis.push(v.cargo.nome);
      if (v.classe?.nome && !atual.classes.includes(v.classe.nome)) atual.classes.push(v.classe.nome);
      pessoas.set(v.pessoaId, atual);
      porCong.set(v.congId!, pessoas);
    }

    return {
      congregacoes: congregacoes.map((c) => ({
        congId: c.id,
        congNome: c.nome?.trim() || `Congregação ${c.id}`,
        pessoas: [...(porCong.get(c.id)?.values() ?? [])]
          .map((p) => ({
            nome: p.nome,
            papel: p.papeis.sort((a, b) => ordemDoPapel(a) - ordemDoPapel(b)).join(" · "),
            // A classe ajuda a reconhecer o professor na folha ("Prof. da classe Juniores").
            classes: p.classes.sort((a, b) => a.localeCompare(b, "pt-BR")),
          }))
          // Pelo nome sem o tratamento: "Ir.ª Silva" fica no S, não no I.
          .sort(porPapelENome),
      })),
    };
  });
}
