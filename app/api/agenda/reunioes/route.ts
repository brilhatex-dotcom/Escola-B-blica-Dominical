import { prisma } from "@/lib/prisma";
import { lerPaginacao, pagina, responder } from "@/lib/api";
import { exigirLeitura } from "@/lib/auth/guarda";
import { dataCivil, erro, lerCorpo, texto, textoOpcional } from "@/lib/api";
import { escopoDeEscrita } from "@/lib/auth/escopo";
import { autorDa, criarComIdHerdado, nomesDaLista } from "@/lib/api/legado";

/**
 * Reuniões, com a lista de presença de cada uma.
 *
 * `participantes` vem como JSON no cadastro antigo: `[{nome, presente}]`. Ele é
 * devolvido inteiro porque é o que dá valor à tela — "9 de 18 presentes" diz
 * pouco; QUEM faltou é o que a secretaria precisa para cobrar.
 *
 * A tabela `Reunioes` NÃO tem congregação — é do campo. Por isso não há recorte
 * a aplicar: ou a pessoa pode ver reuniões, ou não pode.
 */
export const dynamic = "force-dynamic";

interface Participante {
  nome?: string;
  presente?: boolean;
}

export async function GET(req: Request) {
  const { recusa } = await exigirLeitura("agenda-reunioes");
  if (recusa) return recusa;

  return responder(async () => {
    const url = new URL(req.url);
    const { pagina: p, porPagina, pular } = lerPaginacao(url);
    const tipo = url.searchParams.get("tipo")?.trim() ?? "";

    const where = tipo ? { tipo } : {};

    const [total, linhas, tipos] = await Promise.all([
      prisma.reuniao.count({ where }),
      prisma.reuniao.findMany({ where, orderBy: { data: "desc" }, skip: pular, take: porPagina }),
      prisma.reuniao.findMany({ distinct: ["tipo"], select: { tipo: true }, orderBy: { tipo: "asc" } }),
    ]);

    return {
      ...pagina(
        linhas.map((r) => {
          /*
           * O JSON vem do sistema antigo e pode não ser o que se espera.
           * Um `.map` direto sobre algo que não é array derrubaria a rota
           * inteira por causa de UMA linha malformada — e a tela não abriria
           * mais, sem dizer por quê.
           */
          const brutos = Array.isArray(r.participantes) ? (r.participantes as Participante[]) : [];
          const participantes = brutos
            .filter((x) => x && typeof x === "object" && typeof x.nome === "string")
            .map((x) => ({ nome: x.nome as string, presente: x.presente === true }));

          return {
            id: r.id,
            titulo: r.titulo,
            tipo: r.tipo,
            data: r.data.toISOString().slice(0, 10),
            local: r.local || null,
            obs: r.obs || null,
            autor: r.autor,
            presentes: r.presentes,
            totalConvocados: r.total,
            // `null` quando o JSON não trouxe a lista: a tela mostra só o
            // número, em vez de fingir uma lista vazia de participantes.
            participantes: participantes.length > 0 ? participantes : null,
            registradoEm: r.registradoEm.toISOString(),
          };
        }),
        total,
        p,
        porPagina,
      ),
      tipos: tipos.map((t) => t.tipo).filter(Boolean),
    };
  });
}

/**
 * Registrar uma reunião.
 *
 * ============================================================================
 * PRESENTES E AUSENTES SÃO DUAS LISTAS, E NÃO UMA COM MARCAÇÃO
 *
 * `Reunioes.participantes` é um JSON `[{nome, presente}]` do sistema antigo.
 * A tela poderia pedir uma lista só e marcar quem veio — e aí quem esquecesse
 * de marcar alguém o transformaria em ausente sem perceber, exatamente o
 * problema que a Chamada resolve com três estados.
 *
 * Duas caixas de texto resolvem isso sem inventar estado nenhum: quem está na
 * primeira veio, quem está na segunda faltou, e quem não está em nenhuma
 * simplesmente não foi convocado. `presentes` e `total` são CALCULADOS daí — se
 * viessem do cliente, um erro de digitação faria a ata dizer "12 de 9".
 * ============================================================================
 */
export async function POST(req: Request) {
  const { recusa, sessao } = await escopoDeEscrita("agenda-reunioes");
  if (recusa) return recusa;

  const corpo = await lerCorpo(req);
  if (!corpo) return erro("Corpo da requisição inválido.", 400);

  const titulo = texto(corpo.titulo, 160);
  if (!titulo) return erro("Informe o título da reunião.", 400);

  const data = dataCivil(corpo.data);
  if (!data) return erro("Informe a data da reunião (YYYY-MM-DD).", 400);

  const presentes = nomesDaLista(corpo.presentes).map((nome) => ({ nome, presente: true }));
  const ausentes = nomesDaLista(corpo.ausentes).map((nome) => ({ nome, presente: false }));
  const participantes = [...presentes, ...ausentes];

  return responder(async () =>
    criarComIdHerdado(
      (tx) => tx.reuniao,
      (tx, id) =>
        tx.reuniao.create({
          data: {
            id,
            titulo,
            tipo: texto(corpo.tipo, 60) ?? "Reunião",
            data,
            local: textoOpcional(corpo.local, 160),
            obs: textoOpcional(corpo.obs, 1000),
            autor: autorDa(sessao),
            participantes,
            presentes: presentes.length,
            total: participantes.length,
            registradoEm: new Date(),
          },
          select: { id: true, titulo: true },
        }),
    ),
  );
}
