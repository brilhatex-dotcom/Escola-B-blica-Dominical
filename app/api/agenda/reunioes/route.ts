import { prisma } from "@/lib/prisma";
import { lerPaginacao, pagina, responder } from "@/lib/api";
import { exigirLeitura } from "@/lib/auth/guarda";
import { dataCivil, erro, lerCorpo, texto, textoOpcional } from "@/lib/api";
import { escopoDeEscrita } from "@/lib/auth/escopo";
import { autorDa, criarComIdHerdado, participantesDaLista } from "@/lib/api/legado";

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
  congId?: number;
  congNome?: string;
  papel?: string;
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
            .map((x) => ({
              nome: x.nome as string,
              presente: x.presente === true,
              congId: typeof x.congId === "number" ? x.congId : null,
              congNome: typeof x.congNome === "string" ? x.congNome : null,
              papel: typeof x.papel === "string" ? x.papel : null,
            }));

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
 * A LISTA CHEGA PRONTA — COM TODO MUNDO JÁ EM FALTA
 *
 * `participantes` chega da tela (`ModalReuniao`) como um array com um
 * convocado por linha, cada um já com `presente: true|false` — não mais duas
 * caixas de texto separadas. A lista em si normalmente nasce da Hierarquia
 * (Dirigente e Secretário Local de cada congregação, ver
 * `/api/agenda/reunioes/convocados`), com todos em falta por padrão: quem bate
 * o olho na reunião só precisa RISCAR quem esteve, em vez de digitar nome por
 * nome. `participantesDaLista` (lib/api/legado.ts) valida e tira repetido;
 * `presentes` e `total` continuam CALCULADOS daqui, nunca aceitos do cliente —
 * um valor errado vindo de fora faria a ata dizer "12 de 9".
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

  const participantes = participantesDaLista(corpo.participantes);

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
            participantes: participantes as never,
            presentes: participantes.filter((p) => p.presente).length,
            total: participantes.length,
            registradoEm: new Date(),
          },
          select: { id: true, titulo: true },
        }),
    ),
  );
}
