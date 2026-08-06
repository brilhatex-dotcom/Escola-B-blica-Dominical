import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirLeituraDeAlguma, recorteDaSessao } from "@/lib/auth/guarda";
import { normalizarChave, separarTratamento, termoDeBusca } from "@/lib/pessoas/nome";

/**
 * Candidatos para receber um cargo — pessoas E alunos.
 *
 * ============================================================================
 * QUEM VAI SER DIRIGENTE PODE AINDA NÃO SER "PESSOA"
 *
 * O seletor de dirigente procurava só na tabela `Pessoas` (quem já tem cargo).
 * Mas "Aux. Bartolomeu" estava cadastrado apenas como ALUNO — e a busca dizia
 * "não encontrado", como se ele não existisse. Existe: só não tinha cargo
 * ainda.
 *
 * Então esta rota procura nos dois lugares e devolve uma lista unificada. Um
 * aluno que já virou pessoa (mesma chave) aparece uma vez só, como pessoa — a
 * regra de não duplicar gente, de novo. Quem escolher um aluno recebe
 * `tipo: "aluno"`, e é a rota de atribuição que cria a pessoa na hora.
 * ============================================================================
 *
 *   ?q=bartolomeu   (aceita "Aux. Bartolomeu" — o tratamento é ignorado)
 */
export const dynamic = "force-dynamic";

interface Candidato {
  tipo: "pessoa" | "aluno";
  id: number;
  nome: string;
  tratamento: string | null;
  subtitulo: string;
}

export async function GET(req: Request) {
  // "professores" serve a Hierarquia (campo); "congregacoes" e "classes"
  // servem o Grupo B escolhendo dirigente/vice/secretário ou professor da
  // PRÓPRIA congregação (Fase 16). Qualquer uma das três basta.
  const { sessao, recusa } = await exigirLeituraDeAlguma(["professores", "congregacoes", "classes"]);
  if (recusa) return recusa;

  return responder(async () => {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return { candidatos: [] as Candidato[] };

    const chaveTermo = termoDeBusca(q); // "Aux. Bartolomeu" → "bartolomeu"
    const recorte = recorteDaSessao(sessao);
    const congFiltro = recorte ? { congId: { in: recorte.in } } : {};

    const [pessoas, alunos] = await Promise.all([
      prisma.pessoa.findMany({
        where: { chave: { contains: chaveTermo } },
        orderBy: { nome: "asc" },
        take: 8,
        select: {
          id: true,
          nome: true,
          tratamento: true,
          cargos: {
            where: { ativo: true, fim: null },
            take: 1,
            orderBy: { cargo: { ordem: "asc" } },
            select: { cargo: { select: { nome: true } } },
          },
        },
      }),
      /*
       * Alunos: a busca é pelo `nome`, que nos alunos JÁ inclui o tratamento
       * ("Aux. Bartolomeu"), então `contains` casa com ou sem o prefixo. O
       * recorte vale aqui também — a secretária local só promove gente da sua
       * congregação.
       */
      prisma.aluno.findMany({
        where: {
          ativo: true,
          nome: { contains: q.replace(/^\s*\S+\.\s*/, "").trim() || q, mode: "insensitive" },
          ...congFiltro,
        },
        orderBy: { nome: "asc" },
        take: 8,
        select: {
          id: true,
          nome: true,
          classe: { select: { nome: true } },
          congregacao: { select: { nome: true } },
        },
      }),
    ]);

    // Chaves já presentes como Pessoa — para o mesmo nome não aparecer duas vezes.
    const chavesDePessoa = new Set(pessoas.map((p) => normalizarChave(p.nome)));

    const candidatos: Candidato[] = [
      ...pessoas.map((p) => ({
        tipo: "pessoa" as const,
        id: p.id,
        nome: p.nome,
        tratamento: p.tratamento,
        subtitulo: p.cargos[0]?.cargo.nome ?? "Sem cargo ativo",
      })),
      ...alunos
        .map((a) => {
          const { tratamento, nome } = separarTratamento(a.nome);
          return { a, tratamento, nome };
        })
        // Descarta o aluno que já existe como pessoa (mesma chave).
        .filter(({ nome }) => !chavesDePessoa.has(normalizarChave(nome)))
        .map(({ a, tratamento, nome }) => ({
          tipo: "aluno" as const,
          id: a.id,
          nome,
          tratamento,
          subtitulo: [a.classe?.nome, a.congregacao?.nome].filter(Boolean).join(" · ") || "Aluno",
        })),
    ];

    return { candidatos: candidatos.slice(0, 10) };
  });
}
