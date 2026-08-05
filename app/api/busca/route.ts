import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirSessao, recorteDaSessao } from "@/lib/auth/guarda";
import { podeVer } from "@/lib/auth/papeis";

/**
 * Busca global sobre os registros.
 *
 * ============================================================================
 * A BUSCA É UMA PORTA — E TODA PORTA DO SISTEMA TEM A MESMA FECHADURA
 *
 * Cada categoria só é procurada se o acesso ENXERGA o módulo dela, e o
 * resultado é recortado pela congregação exatamente como as telas. Sem isso, a
 * busca seria a porta dos fundos do RBAC: digitar um nome acharia gente de
 * congregações que o menu esconde com cuidado, e um Professor encontraria o
 * campo inteiro só trocando a tela pelo campo de busca.
 *
 * A guarda é `exigirSessao` (não `exigirLeitura` de um módulo): a busca cruza
 * várias categorias, e cada uma é filtrada por `podeVer` aqui dentro. Quem não
 * enxerga nenhuma recebe uma resposta vazia — nunca um 403 que sugere que havia
 * algo a esconder.
 * ============================================================================
 *
 *   ?q=joão   o termo; menos de 2 caracteres devolve vazio (não varrer o banco
 *             a cada tecla digitada).
 */
export const dynamic = "force-dynamic";

/** Quantos de cada categoria. Poucos: a busca é um atalho, não um relatório. */
const POR_CATEGORIA = 6;

interface Achado {
  id: number;
  titulo: string;
  subtitulo: string;
  href: string;
}
interface Grupo {
  chave: string;
  secao: string;
  itens: Achado[];
}

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirSessao();
  if (recusa) return recusa;

  return responder(async () => {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return { grupos: [] as Grupo[], termo: q };

    const papeis = sessao?.papeis ?? [];
    const recorte = recorteDaSessao(sessao);
    const ver = (chave: string) =>
      // Sem sessão (portal sem AUTH_SECRET) o menu inteiro aparece; a busca
      // segue a mesma regra, senão ela sozinha ficaria mais fechada que o resto.
      papeis.length === 0 ? true : podeVer(papeis, chave);

    // Recorte por congregação, reaproveitável nos `where`.
    const congFiltro = recorte ? { congId: { in: recorte.in } } : {};

    const grupos: Grupo[] = [];

    /* ---------------- Alunos ---------------- */
    if (ver("alunos")) {
      const alunos = await prisma.aluno.findMany({
        where: {
          ativo: true,
          nome: { contains: q, mode: "insensitive" },
          ...congFiltro,
        },
        orderBy: { nome: "asc" },
        take: POR_CATEGORIA,
        select: {
          id: true,
          nome: true,
          congregacao: { select: { nome: true } },
          classe: { select: { nome: true } },
        },
      });
      if (alunos.length > 0) {
        grupos.push({
          chave: "alunos",
          secao: "Alunos",
          itens: alunos.map((a) => ({
            id: a.id,
            titulo: a.nome,
            subtitulo: [a.classe?.nome, a.congregacao?.nome].filter(Boolean).join(" · ") || "Aluno",
            // A Ficha já é deep-link por ?aluno= — é o destino mais rico para um aluno.
            href: `/dashboard/relatorios/ficha?aluno=${a.id}`,
          })),
        });
      }
    }

    /* ---------------- Professores / pessoas ---------------- */
    if (ver("professores")) {
      /*
       * `Pessoas.chave` já é o nome normalizado (minúsculo, sem acento) — então
       * aqui a busca acha "José" digitando "jose", o que a busca de alunos não
       * consegue (Alunos não tem essa coluna). É a mesma normalização do campo
       * de busca no navegador.
       */
      const chaveNorm = q.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
      const pessoas = await prisma.pessoa.findMany({
        where: {
          OR: [
            { chave: { contains: chaveNorm } },
            { nome: { contains: q, mode: "insensitive" } },
          ],
          // Recorte: só pessoas com cargo numa congregação que o acesso enxerga.
          ...(recorte ? { cargos: { some: { congId: { in: recorte.in } } } } : {}),
        },
        orderBy: { nome: "asc" },
        take: POR_CATEGORIA,
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
      });
      if (pessoas.length > 0) {
        grupos.push({
          chave: "professores",
          secao: "Professores",
          itens: pessoas.map((p) => ({
            id: p.id,
            titulo: [p.tratamento, p.nome].filter(Boolean).join(" "),
            subtitulo: p.cargos[0]?.cargo.nome ?? "Sem cargo ativo",
            href: `/dashboard/professores?busca=${encodeURIComponent(p.nome)}`,
          })),
        });
      }
    }

    /* ---------------- Classes ---------------- */
    if (ver("classes")) {
      const classes = await prisma.classe.findMany({
        where: { nome: { contains: q, mode: "insensitive" }, ...congFiltro },
        orderBy: { nome: "asc" },
        take: POR_CATEGORIA,
        select: {
          id: true,
          nome: true,
          faixa: true,
          congregacao: { select: { nome: true } },
        },
      });
      if (classes.length > 0) {
        grupos.push({
          chave: "classes",
          secao: "Classes",
          itens: classes.map((c) => ({
            id: c.id,
            titulo: c.nome,
            subtitulo: [c.faixa, c.congregacao?.nome].filter(Boolean).join(" · ") || "Classe",
            href: `/dashboard/classes?busca=${encodeURIComponent(c.nome)}`,
          })),
        });
      }
    }

    /* ---------------- Congregações ---------------- */
    if (ver("congregacoes")) {
      /*
       * Filtrado em memória, sem acento — e não com `contains` no banco.
       *
       * O nome do próprio campo tem acento ("Betânia", "M.D. Boqueirão"), e a
       * busca `insensitive` do Postgres resolve a caixa mas NÃO o acento: quem
       * digita "betania" não acharia a sua congregação. Como são só 14 linhas,
       * puxá-las e filtrar com a mesma normalização do campo de busca é barato e
       * acerta o acento — o mesmo comportamento da busca offline.
       */
      const qNorm = q.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
      const todas = await prisma.congregacao.findMany({
        where: recorte ? { id: { in: recorte.in } } : {},
        orderBy: { id: "asc" },
        select: { id: true, nome: true, _count: { select: { alunos: true } } },
      });
      const congs = todas
        .filter((c) => c.nome.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").includes(qNorm))
        .slice(0, POR_CATEGORIA);
      if (congs.length > 0) {
        grupos.push({
          chave: "congregacoes",
          secao: "Congregações",
          itens: congs.map((c) => ({
            id: c.id,
            titulo: c.nome,
            subtitulo: `${c._count.alunos} aluno${c._count.alunos === 1 ? "" : "s"}`,
            href: `/dashboard/congregacoes`,
          })),
        });
      }
    }

    /* ---------------- Visitantes ---------------- */
    if (ver("visitantes")) {
      const visitantes = await prisma.visitante.findMany({
        where: { nome: { contains: q, mode: "insensitive" }, ...congFiltro },
        orderBy: { data: "desc" },
        take: POR_CATEGORIA,
        select: {
          id: true,
          nome: true,
          data: true,
          classe: { select: { nome: true } },
        },
      });
      if (visitantes.length > 0) {
        grupos.push({
          chave: "visitantes",
          secao: "Visitantes",
          itens: visitantes.map((v) => ({
            id: v.id,
            titulo: v.nome,
            subtitulo: v.classe?.nome ?? "Visitante",
            href: `/dashboard/visitantes`,
          })),
        });
      }
    }

    return { grupos, termo: q };
  });
}
