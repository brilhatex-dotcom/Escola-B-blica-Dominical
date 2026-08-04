import { prisma } from "@/lib/prisma";
import {
  escopoDe,
  papelDoCargo,
  papelHerdado,
  type Escopo,
  type Papel,
} from "./papeis";

/**
 * De QUEM É a conta para O QUE ELA PODE.
 *
 * Esta é a única função que consulta o banco para decidir acesso, e ela roda
 * uma vez por login — o resultado viaja dentro do JWT da sessão. Consultar a
 * cada navegação seria uma ida ao Postgres por clique, de todo aparelho da
 * igreja, num domingo de manhã.
 *
 * O preço é que a mudança de cargo só vale na próxima entrada da pessoa. É o
 * mesmo preço já pago pela sessão de 8 horas, e é o certo aqui: promover
 * alguém no meio do domingo não deve derrubar a chamada que ele está fazendo.
 */

export interface Acesso {
  papeis: Papel[];
  /** Congregações que este acesso enxerga. Vazio quando o escopo é o campo. */
  congIds: number[];
  escopo: Escopo;
  /**
   * `true` quando o acesso foi DEDUZIDO do perfil herdado da planilha, e não
   * dos cargos que a pessoa ocupa.
   *
   * A distinção não é decorativa — ela aparece na tela de Usuários. As 19
   * contas do sistema antigo não são pessoas: são contas de congregação
   * ("Cong. Pinheiro", "T. Matriz"). Enquanto ninguém disser quem de fato
   * responde por cada uma, o portal usa um palpite conservador e DIZ que é um
   * palpite, em vez de apresentá-lo como fato.
   */
  presumido: boolean;
}

interface DadosDaConta {
  id: number;
  perfil: string;
  congId: number | null;
  pessoaId: number | null;
}

/**
 * Os papéis de uma conta.
 *
 * Caminho 1 — a conta está ligada a uma PESSOA: os papéis vêm dos cargos que
 * ela ocupa, e as congregações, de onde ela os exerce. É o caminho certo, e o
 * único que se mantém correto sozinho: quem deixa o cargo perde o acesso no
 * mesmo ato, sem ninguém precisar lembrar de mexer numa segunda tela.
 *
 * Caminho 2 — a conta é uma das herdadas, sem pessoa: o `perfil` da planilha é
 * interpretado (`master` → administrador; o resto → dirigente da própria
 * congregação). NADA é reescrito no registro antigo, conforme a regra da
 * igreja: o campo `perfil` continua exatamente como veio, e o palpite fica
 * marcado como palpite.
 */
export async function acessoDaConta(conta: DadosDaConta): Promise<Acesso> {
  const vinculos = conta.pessoaId
    ? await prisma.pessoaCargo.findMany({
        where: { pessoaId: conta.pessoaId, ativo: true, fim: null },
        select: { congId: true, cargo: { select: { nome: true } } },
      })
    : [];

  return montarAcesso(conta, vinculos);
}

/** Um vínculo de cargo, reduzido ao que decide acesso. */
export interface VinculoDeCargo {
  congId: number | null;
  cargo: { nome: string };
}

/**
 * A mesma decisão, sem tocar no banco.
 *
 * Existe separada porque a tela de Usuários precisa do acesso de DEZENOVE
 * contas de uma vez. Com `acessoDaConta`, seriam dezenove idas ao Postgres para
 * desenhar uma lista — o clássico N+1, que numa tela pequena passa despercebido
 * e numa lista de duzentos usuários derruba a página.
 */
export function montarAcesso(
  conta: DadosDaConta,
  vinculos: readonly VinculoDeCargo[],
): Acesso {
  if (conta.pessoaId) {
    const papeis = new Set<Papel>();
    const congIds = new Set<number>();

    for (const v of vinculos) {
      const papel = papelDoCargo(v.cargo.nome);
      if (!papel) continue; // cargo sem correspondência não abre porta nenhuma
      papeis.add(papel);
      if (v.congId !== null) congIds.add(v.congId);
    }

    if (papeis.size > 0) {
      const escopo = escopoDe([...papeis]);
      return {
        papeis: [...papeis],
        // Um acesso de campo não lista congregações: ele as vê todas, e uma
        // lista parcial aqui viraria um filtro silencioso na consulta.
        congIds: escopo === "campo" ? [] : [...congIds],
        escopo,
        presumido: false,
      };
    }

    /*
     * A pessoa existe, mas nenhum cargo dela abre acesso — por exemplo, alguém
     * cadastrado como "Auxiliar" de uma classe que foi desativada. Cair no
     * perfil herdado aqui é melhor do que devolver acesso zero: zero significa
     * uma pessoa real trancada do lado de fora sem explicação nenhuma.
     */
  }

  const papel = papelHerdado(conta.perfil);
  const escopo = escopoDe([papel]);
  return {
    papeis: [papel],
    congIds: escopo === "campo" || conta.congId === null ? [] : [conta.congId],
    escopo,
    presumido: true,
  };
}

/**
 * O recorte de congregações a aplicar numa consulta.
 *
 * Devolve `undefined` para quem enxerga o campo — e `undefined` é a peça
 * importante: passado a um `where` do Prisma, ele simplesmente não filtra.
 * A alternativa (devolver a lista de TODAS as congregações) daria o mesmo
 * resultado hoje e um resultado errado no dia em que uma congregação nova for
 * cadastrada e ninguém lembrar de atualizar a lista.
 */
export function filtroDeCongregacao(
  acesso: Pick<Acesso, "escopo" | "congIds"> | null,
): { in: number[] } | undefined {
  if (!acesso || acesso.escopo === "campo") return undefined;
  return { in: acesso.congIds };
}
