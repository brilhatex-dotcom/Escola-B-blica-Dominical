import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirLeitura, recorteDaSessao } from "@/lib/auth/guarda";

/**
 * Escalas de culto do mês.
 *
 * ============================================================================
 * A ESCALA É UM ARQUIVO, NÃO UMA TABELA DE TURNOS
 *
 * `Escala_Cultos` tem `nomeArquivo`, `url` e `urlPreview` — a escala do campo é
 * um PDF montado fora do sistema e guardado no Google Drive. O portal registra
 * qual arquivo vale para qual mês, e nada mais.
 *
 * Isto foi confundido uma vez, na Fase 11: a tabela parecia agenda e não é.
 * Modelar turnos aqui produziria um segundo lugar onde a escala existe, e o
 * campo continuaria distribuindo o PDF pelo WhatsApp — com os dois divergindo
 * sem que ninguém percebesse.
 *
 * O upload do arquivo em si não entra nesta fase: envolve armazenamento
 * (Drive ou blob), e o que o campo tem hoje é um link do Drive que funciona.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export async function GET() {
  const { sessao, recusa } = await exigirLeitura("escalas");
  if (recusa) return recusa;

  return responder(async () => {
    const recorte = recorteDaSessao(sessao);

    const escalas = await prisma.escalaCulto.findMany({
      where: recorte
        ? // Escala sem congregação é a do CAMPO — vale para todo mundo, e
          // recortá-la fora deixaria o Dirigente sem a escala que ele usa.
          { OR: [{ congId: null }, { congId: recorte }] }
        : {},
      orderBy: [{ mesAno: "desc" }, { dataUpload: "desc" }],
      select: {
        id: true, titulo: true, mesAno: true, dataUpload: true,
        nomeArquivo: true, url: true, urlPreview: true, obs: true, autor: true,
        congregacao: { select: { id: true, nome: true } },
      },
    });

    const hoje = new Date();
    const mesAtual = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}`;

    return {
      itens: escalas.map((e) => {
        const m = e.mesAno;
        const chave = `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`;
        return {
          id: e.id,
          titulo: e.titulo,
          mes: `${MESES[m.getUTCMonth()]} de ${m.getUTCFullYear()}`,
          chaveMes: chave,
          doMesAtual: chave === mesAtual,
          enviadaEm: e.dataUpload.toISOString().slice(0, 10),
          arquivo: e.nomeArquivo,
          url: e.url,
          urlPreview: e.urlPreview,
          obs: e.obs || null,
          autor: e.autor,
          congregacao: e.congregacao?.nome ?? null,
          doCampo: e.congregacao === null,
        };
      }),
      /** O mês corrente tem escala? A tela avisa quando não tem. */
      mesAtualTemEscala: escalas.some((e) => {
        const m = e.mesAno;
        return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}` === mesAtual;
      }),
    };
  });
}
