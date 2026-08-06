import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/**
 * O organograma do campo, do Pastor às classes.
 *
 * ============================================================================
 * O ORGANOGRAMA É UMA LEITURA — ELE NÃO TEM DADOS PRÓPRIOS
 *
 * Nada aqui é cadastrado nesta tela. Cada caixa do desenho é uma linha de
 * `PessoaCargos`, e o nível em que ela aparece vem de `Cargos.escopo`
 * ("campo" | "congregacao" | "classe") somado a onde o vínculo é exercido.
 *
 * Uma tabela "organograma" à parte pareceria mais simples e seria pior: quem
 * trocasse o Dirigente na tela de Liderança veria o desenho continuar mostrando
 * o antigo, e não haveria como saber qual dos dois está certo. Aqui não há dois
 * lugares para divergir — trocar o cargo redesenha o organograma.
 * ============================================================================
 *
 * Uma pessoa com dois cargos aparece nas DUAS caixas, de propósito: é o
 * organograma dizendo que ela acumula funções. O que não se repete é a
 * CONTAGEM de pessoas, que sai por `id` distinto (a regra da Fase 05).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { sessao, recusa } = await exigirLeitura("hierarquia");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);

    const vinculos = await prisma.pessoaCargo.findMany({
      where: {
        ativo: true,
        fim: null,
        /*
         * O recorte não pode cortar os cargos de campo.
         *
         * Um Dirigente que enxerga só a sua congregação continua precisando ver
         * quem é o Pastor Presidente — é a cabeça do organograma dele. Filtrar
         * por `congId IN (...)` sem o `null` decapitaria o desenho e faria a
         * congregação parecer solta no ar.
         */
        ...(recorte ? { OR: [{ congId: null }, { congId: recorte }] } : {}),
      },
      select: {
        id: true,
        congId: true,
        classeId: true,
        pessoa: { select: { id: true, nome: true, tratamento: true, foto: true } },
        cargo: { select: { id: true, nome: true, ordem: true, escopo: true } },
        congregacao: { select: { id: true, nome: true } },
        classe: { select: { id: true, nome: true, faixa: true, congId: true } },
      },
      orderBy: [{ cargo: { ordem: "asc" } }, { pessoa: { nome: "asc" } }],
    });

    interface Ocupante {
      vinculoId: number;
      pessoaId: number;
      nome: string;
      tratamento: string | null;
      foto: string | null;
      cargo: string;
      cargoId: number;
      ordem: number;
    }
    const paraOcupante = (v: (typeof vinculos)[number]): Ocupante => ({
      vinculoId: v.id,
      pessoaId: v.pessoa.id,
      nome: v.pessoa.nome,
      tratamento: v.pessoa.tratamento,
      foto: v.pessoa.foto,
      cargo: v.cargo.nome,
      cargoId: v.cargo.id,
      ordem: v.cargo.ordem,
    });

    /* Nível 1 — o campo. Cargo sem congregação. */
    const campo = vinculos.filter((v) => v.congId === null && v.classeId === null).map(paraOcupante);

    /* Nível 2 — as congregações, com quem responde por cada uma. */
    const porCong = new Map<number, { id: number; nome: string; ocupantes: Ocupante[]; classes: Map<number, { id: number; nome: string; faixa: string; ocupantes: Ocupante[] }> }>();

    const garantirCong = (id: number, nome: string) => {
      let c = porCong.get(id);
      if (!c) {
        c = { id, nome, ocupantes: [], classes: new Map() };
        porCong.set(id, c);
      }
      return c;
    };

    for (const v of vinculos) {
      if (v.congId === null) continue;
      const cong = garantirCong(v.congId, v.congregacao?.nome ?? `Congregação ${v.congId}`);

      /* Nível 3 — as classes. */
      if (v.classeId !== null && v.classe) {
        let cl = cong.classes.get(v.classeId);
        if (!cl) {
          cl = { id: v.classeId, nome: v.classe.nome, faixa: v.classe.faixa, ocupantes: [] };
          cong.classes.set(v.classeId, cl);
        }
        cl.ocupantes.push(paraOcupante(v));
      } else {
        cong.ocupantes.push(paraOcupante(v));
      }
    }

    /*
     * As congregações sem NINGUÉM com cargo também entram no desenho.
     *
     * Sumir com elas faria o organograma parecer completo estando incompleto —
     * e é justamente a congregação sem dirigente cadastrado que precisa
     * aparecer, porque é ela que alguém tem de resolver.
     */
    const todasAsCongs = await prisma.congregacao.findMany({
      where: recorte ? { id: recorte } : {},
      orderBy: { id: "asc" },
      select: { id: true, nome: true },
    });
    for (const c of todasAsCongs) garantirCong(c.id, c.nome);

    const congregacoes = todasAsCongs.map((c) => {
      const dados = porCong.get(c.id)!;
      return {
        id: c.id,
        nome: c.nome,
        ocupantes: dados.ocupantes.sort((a, b) => a.ordem - b.ordem),
        classes: [...dados.classes.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      };
    });

    /* Pessoas ÚNICAS — a regra da Fase 05: quem acumula cargo conta uma vez. */
    const pessoasUnicas = new Set(vinculos.map((v) => v.pessoa.id)).size;

    return {
      campo: campo.sort((a, b) => a.ordem - b.ordem),
      congregacoes,
      resumo: {
        pessoasUnicas,
        cargosOcupados: vinculos.length,
        congregacoes: congregacoes.length,
        classesComProfessor: congregacoes.reduce((s, c) => s + c.classes.length, 0),
        acumulam: vinculos.length - pessoasUnicas,
      },
    };
  });
}
