import { prisma } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";
import { justificadasDisponiveis } from "@/lib/ebd/justificadas";
import { alvoDaConsulta } from "@/lib/relatorios/comum";
import { diasPorClasse, diasPorCongregacao, domingosEntre, resumir } from "@/lib/relatorios/estatisticas";

/**
 * O ranking da área de Estatísticas: presentes ÷ matriculados no período.
 *
 *   ?de=2026-08-01&ate=2026-08-31
 *
 * A régua e o porquê estão em lib/relatorios/estatisticas.ts. O ranking de
 * CONGREGAÇÕES é do campo inteiro, para todo mundo — "em que lugar a minha
 * está?" só tem resposta vendo as outras (a mesma decisão do Ranking e do
 * Encarte). O de CLASSES respeita o recorte de quem vê.
 */
export const dynamic = "force-dynamic";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const { sessao, recusa } = await exigirLeitura("estatisticas");
  if (recusa) return recusa;

  const url = new URL(req.url);
  const deStr = url.searchParams.get("de") ?? "";
  const ateStr = url.searchParams.get("ate") ?? "";
  if (!DIA.test(deStr) || !DIA.test(ateStr)) return erro("Informe o período (de e até).", 400);
  const de = new Date(`${deStr}T00:00:00Z`);
  const ate = new Date(`${ateStr}T00:00:00Z`);
  if (de > ate) return erro("A data inicial é depois da final.", 400);
  if (ate.getTime() - de.getTime() > 3 * 366 * 86_400_000) return erro("Escolha um período de até três anos.", 400);

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);
    const alvo = alvoDaConsulta(recorte, null);

    const [congregacoes, classes, matriculadosCong, dias, diasClasse, comJustificada] = await Promise.all([
      prisma.congregacao.findMany({ select: { id: true, nome: true } }),
      prisma.classe.findMany({
        where: { ativa: true, ...(alvo ? { congId: { in: alvo } } : {}) },
        select: { id: true, nome: true, congregacao: { select: { nome: true } } },
      }),
      prisma.aluno.groupBy({ by: ["congId"], where: { ativo: true }, _count: { _all: true } }),
      diasPorCongregacao(de, ate),
      diasPorClasse(de, ate, alvo),
      justificadasDisponiveis(),
    ]);

    const hoje = new Date();
    const domingos = domingosEntre(de, ate < hoje ? ate : hoje).length;
    const metade = Math.ceil(domingos / 2);
    const matPor = new Map(matriculadosCong.map((m) => [m.congId, m._count._all]));

    const porCong = new Map<number, typeof dias>();
    for (const d of dias) {
      if (!porCong.has(d.congId)) porCong.set(d.congId, []);
      porCong.get(d.congId)!.push(d);
    }

    const ordenar = <T extends { taxa: number | null; mediaPresentes: number; nome: string }>(a: T, b: T) =>
      (b.taxa ?? -1) - (a.taxa ?? -1) || b.mediaPresentes - a.mediaPresentes || a.nome.localeCompare(b.nome, "pt-BR");

    const linhas = congregacoes.map((c) => {
      const r = resumir(porCong.get(c.id) ?? []);
      return {
        congId: c.id,
        nome: c.nome?.trim() || `Congregação ${c.id}`,
        matriculados: matPor.get(c.id) ?? 0,
        ...r,
        regular: r.domingosComChamada >= metade,
      };
    });

    const classificadas = linhas.filter((l) => l.taxa !== null && l.regular).sort(ordenar);
    const poucasChamadas = linhas.filter((l) => l.taxa !== null && !l.regular).sort(ordenar);
    const semChamada = linhas
      .filter((l) => l.taxa === null)
      .map((l) => ({ congId: l.congId, nome: l.nome, matriculados: l.matriculados }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const porClasse = new Map<number, typeof diasClasse>();
    for (const d of diasClasse) {
      if (!porClasse.has(d.classeId)) porClasse.set(d.classeId, []);
      porClasse.get(d.classeId)!.push(d);
    }
    const rankingClasses = classes
      .map((c) => {
        const lista = porClasse.get(c.id) ?? [];
        return {
          classeId: c.id,
          nome: c.nome,
          congregacao: c.congregacao?.nome?.trim() ?? null,
          ...resumir(lista),
          matriculados: lista.length ? lista[lista.length - 1].matriculados : 0,
        };
      })
      .filter((c) => c.taxa !== null && c.domingosComChamada >= metade)
      .sort(ordenar);

    // O campo como um todo: cada domingo somando as congregações que chamaram.
    const porData = new Map<string, { presentes: number; matriculados: number; justificadas: number }>();
    for (const d of dias) {
      const t = porData.get(d.data) ?? { presentes: 0, matriculados: 0, justificadas: 0 };
      t.presentes += d.presentes;
      t.matriculados += d.matriculados;
      t.justificadas += d.justificadas;
      porData.set(d.data, t);
    }
    const campo = resumir([...porData.values()]);

    return {
      periodo: { de: deStr, ate: ateStr, domingos },
      justificadaDisponivel: comJustificada,
      campo: { ...campo, matriculados: [...matPor.values()].reduce((s, n) => s + n, 0) },
      congregacoes: classificadas.map((l, i) => ({ ...l, posicao: i + 1 })),
      poucasChamadas,
      semChamada,
      classes: rankingClasses.map((c, i) => ({ ...c, posicao: i + 1 })),
    };
  });
}
