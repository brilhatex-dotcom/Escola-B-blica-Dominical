import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirSessao, recorteDaSessao } from "@/lib/auth/guarda";
import { podeVer } from "@/lib/auth/papeis";

/**
 * A DESCIDA: o que o aparelho guarda para funcionar sem internet.
 *
 * ============================================================================
 * O ESPELHO É RECORTADO IGUAL À TELA — SENÃO O OFFLINE VAZA O QUE O ONLINE PROTEGE
 *
 * A fila de sincronização (lib/sync) é a SUBIDA: leva ao servidor o que foi
 * gravado no domingo sem sinal. Esta rota é a DESCIDA: traz para o aparelho os
 * cadastros que a busca e a chamada precisam quando a rede cai.
 *
 * O recorte por congregação vale aqui com o mesmo rigor das telas. Guardar no
 * celular do professor de uma congregação a lista do campo inteiro seria driblar
 * o RBAC pela porta do cache: o dado sairia do servidor recortado em toda tela,
 * menos nesta, e ficaria gravado no aparelho ao alcance de quem o pegasse.
 *
 * Só descem as categorias que o acesso ENXERGA. Um Professor que não vê
 * Visitantes não os leva para o bolso.
 * ============================================================================
 *
 * Traz nome, telefone e nascimento dos alunos de propósito: é o que permite,
 * sem sinal, achar o telefone de um responsável ou o aniversário de uma criança
 * — exatamente o que a Chamada já cacheava por classe, agora para o campo que o
 * acesso enxerga.
 */
export const dynamic = "force-dynamic";

/** Data civil "YYYY-MM-DD" a partir de um DateTime, sem fuso. */
function dataCivil(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export async function GET() {
  const { sessao, recusa } = await exigirSessao();
  if (recusa) return recusa;

  return responder(async () => {
    const papeis = sessao?.papeis ?? [];
    const recorte = recorteDaSessao(sessao);
    const ver = (chave: string) => (papeis.length === 0 ? true : podeVer(papeis, chave));
    const congFiltro = recorte ? { congId: { in: recorte.in } } : {};

    /*
     * `uid = "srv-<tabela>-<id>"` — determinístico.
     *
     * Sem um uid estável, cada descida criaria uma cópia nova do mesmo aluno no
     * IndexedDB. Com ele, `receberDoServidor` ATUALIZA a linha existente — e
     * preserva qualquer registro que ainda não subiu (estado != sincronizado),
     * então a descida nunca atropela a chamada de hoje que ainda está na fila.
     */
    const congregacoes = ver("congregacoes")
      ? (
          await prisma.congregacao.findMany({
            where: recorte ? { id: { in: recorte.in } } : {},
            orderBy: { id: "asc" },
            select: { id: true, nome: true },
          })
        ).map((c) => ({ uid: `srv-cong-${c.id}`, idRemoto: c.id, nome: c.nome }))
      : [];

    const classes = ver("classes")
      ? (
          await prisma.classe.findMany({
            where: congFiltro,
            orderBy: { nome: "asc" },
            select: {
              id: true, nome: true, faixa: true, prof: true,
              tipoClasse: true, congId: true, ativa: true,
            },
          })
        ).map((c) => ({
          uid: `srv-classe-${c.id}`, idRemoto: c.id, nome: c.nome, faixa: c.faixa,
          prof: c.prof, tipoClasse: c.tipoClasse, congId: c.congId, ativa: c.ativa,
        }))
      : [];

    const alunos = ver("alunos")
      ? (
          await prisma.aluno.findMany({
            where: { ativo: true, ...congFiltro },
            orderBy: { nome: "asc" },
            select: {
              id: true, nome: true, nasc: true, tel: true, resp: true,
              congId: true, classeId: true, ativo: true,
            },
          })
        ).map((a) => ({
          uid: `srv-aluno-${a.id}`, idRemoto: a.id, nome: a.nome,
          nasc: dataCivil(a.nasc), tel: a.tel, resp: a.resp,
          congId: a.congId, classeId: a.classeId, ativo: a.ativo,
        }))
      : [];

    const visitantes = ver("visitantes")
      ? (
          await prisma.visitante.findMany({
            where: congFiltro,
            orderBy: { data: "desc" },
            take: 500,
            select: {
              id: true, nome: true, idade: true, tel: true, obs: true,
              classeId: true, congId: true, data: true,
            },
          })
        ).map((v) => ({
          uid: `srv-visitante-${v.id}`, idRemoto: v.id, nome: v.nome, idade: v.idade,
          tel: v.tel, obs: v.obs, classeId: v.classeId, congId: v.congId,
          data: dataCivil(v.data) ?? "",
        }))
      : [];

    return {
      congregacoes,
      classes,
      alunos,
      visitantes,
      geradoEm: new Date().toISOString(),
    };
  });
}
