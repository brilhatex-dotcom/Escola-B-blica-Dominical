import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirLeitura } from "@/lib/auth/guarda";

/**
 * A lista de convocados de uma reunião de campo: o Dirigente e o Secretário
 * Local de CADA congregação — quem já responde pela EBD lá, então é quem a
 * reunião de dirigentes/secretários precisa chamar.
 *
 * ============================================================================
 * A LISTA VEM DA HIERARQUIA, NÃO É DIGITADA DE NOVO AQUI
 *
 * `Dirigente` e `Secretário Local` já são cargos de `PessoaCargos` (Fase 08),
 * os mesmos que a tela de Congregações usa para dizer quem dirige cada uma.
 * Buscar os dois aqui evita o trabalho de digitar os ~28 nomes toda vez que
 * uma reunião de campo é marcada — e evita dois lugares podendo divergir
 * sobre quem é o Dirigente de tal congregação.
 *
 * Uma congregação sem ninguém nos dois cargos ainda entra na lista, vazia —
 * sumir com ela faria parecer que a reunião não precisa chamar essa
 * congregação, quando na verdade é ela que está sem dirigente cadastrado.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const CARGOS_CONVOCADOS = ["Dirigente", "Secretário Local"];
const ORDEM_PAPEL: Record<string, number> = { Dirigente: 0, "Secretário Local": 1 };

function nomeComTratamento(nome: string, tratamento: string | null): string {
  return tratamento ? `${tratamento} ${nome}` : nome;
}

export async function GET() {
  const { recusa } = await exigirLeitura("agenda-reunioes");
  if (recusa) return recusa;

  return responder(async () => {
    const [congregacoes, vinculos] = await Promise.all([
      prisma.congregacao.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
      prisma.pessoaCargo.findMany({
        where: { ativo: true, fim: null, congId: { not: null }, cargo: { nome: { in: CARGOS_CONVOCADOS } } },
        select: {
          congId: true,
          pessoa: { select: { nome: true, tratamento: true } },
          cargo: { select: { nome: true } },
        },
      }),
    ]);

    const porCong = new Map<number, Array<{ nome: string; papel: string }>>();
    for (const v of vinculos) {
      const lista = porCong.get(v.congId!) ?? [];
      lista.push({ nome: nomeComTratamento(v.pessoa.nome, v.pessoa.tratamento), papel: v.cargo.nome });
      porCong.set(v.congId!, lista);
    }

    return {
      congregacoes: congregacoes.map((c) => ({
        congId: c.id,
        congNome: c.nome?.trim() || `Congregação ${c.id}`,
        pessoas: (porCong.get(c.id) ?? []).sort(
          (a, b) => (ORDEM_PAPEL[a.papel] ?? 9) - (ORDEM_PAPEL[b.papel] ?? 9),
        ),
      })),
    };
  });
}
