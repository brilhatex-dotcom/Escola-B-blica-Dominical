import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura } from "@/lib/auth/guarda";
import { registrar } from "@/lib/auditoria";
import { APP_VERSION, ORG_NAME } from "@/lib/config";

/**
 * Cópia de segurança dos dados.
 *
 * ============================================================================
 * BAIXAR O BACKUP É MAIS GRAVE DO QUE VER QUALQUER TELA — E POR ISSO EXIGE MAIS
 *
 * O arquivo traz o campo inteiro em texto: nome, telefone e data de nascimento
 * de 323 alunos, muitos deles crianças. Uma tela mostra trinta linhas de cada
 * vez, num aparelho, para quem está logado; o arquivo sai do sistema, vai para
 * a pasta de downloads e de lá para onde quiserem levá-lo.
 *
 * Por isso o GET com `?baixar=1` exige permissão de GRAVAÇÃO em `cfg-backup`,
 * e não de leitura. Na prática: Pastor Presidente, Gestor Local e a conta de
 * administração. O Supervisor da EBD enxerga a tela e o resumo — ele
 * supervisiona a Escola Bíblica, o que não é a mesma coisa que levar embora o
 * cadastro do campo.
 *
 * Toda geração de arquivo é registrada na auditoria, com quem e quando. É a
 * única defesa que resta depois que o arquivo sai daqui.
 * ============================================================================
 *
 * GET            — o resumo: o que entraria no arquivo
 * GET ?baixar=1  — o arquivo JSON
 *
 * As SENHAS ficam de fora do arquivo. Um backup com os hashes na mão de quem
 * abrir o .json é um ataque offline pronto — e as 19 contas ainda dividem o
 * mesmo hash SHA-256 sem sal, que quebra em minutos.
 */
export const dynamic = "force-dynamic";

/** As tabelas do backup, na ordem em que precisariam ser restauradas. */
const TABELAS = [
  "congregacoes", "cargos", "pessoas", "pessoaCargos", "classes", "alunos",
  "frequencias", "freqLicoes", "licoes", "ofertas", "visitantes", "reunioes",
  "eventos", "avisos", "escalaCultos", "precosRevistas", "parametros", "usuarios",
] as const;

export async function GET(req: Request) {
  const baixar = new URL(req.url).searchParams.get("baixar") === "1";

  const { sessao, recusa } = baixar
    ? await exigirEscrita("cfg-backup")
    : await exigirLeitura("cfg-backup");
  if (recusa) return recusa;

  if (!baixar) {
    return responder(async () => {
      const [
        congregacoes, pessoas, cargos, pessoaCargos, classes, alunos, frequencias,
        licoes, ofertas, visitantes, reunioes, eventos, avisos, escalas, usuarios,
      ] = await Promise.all([
        prisma.congregacao.count(), prisma.pessoa.count(), prisma.cargo.count(),
        prisma.pessoaCargo.count(), prisma.classe.count(), prisma.aluno.count(),
        prisma.frequencia.count(), prisma.licao.count(), prisma.oferta.count(),
        prisma.visitante.count(), prisma.reuniao.count(), prisma.evento.count(),
        prisma.aviso.count(), prisma.escalaCulto.count(), prisma.usuario.count(),
      ]);

      const linhas = {
        congregacoes, pessoas, cargos, pessoaCargos, classes, alunos, frequencias,
        licoes, ofertas, visitantes, reunioes, eventos, avisos, escalas, usuarios,
      };

      return {
        linhas,
        total: Object.values(linhas).reduce((s, n) => s + n, 0),
        tabelas: TABELAS.length,
        /** Quem está vendo isto pode de fato baixar? A tela pergunta antes de oferecer. */
        podeBaixar: (await exigirEscrita("cfg-backup")).recusa === null,
      };
    });
  }

  /* ---------------- o arquivo ---------------- */

  const [
    congregacoes, cargos, pessoas, pessoaCargos, classes, alunos, frequencias,
    freqLicoes, licoes, ofertas, visitantes, reunioes, eventos, avisos,
    escalaCultos, precosRevistas, parametros, usuarios,
  ] = await Promise.all([
    prisma.congregacao.findMany(), prisma.cargo.findMany(), prisma.pessoa.findMany(),
    prisma.pessoaCargo.findMany(), prisma.classe.findMany(), prisma.aluno.findMany(),
    prisma.frequencia.findMany(), prisma.freqLicao.findMany(), prisma.licao.findMany(),
    prisma.oferta.findMany(), prisma.visitante.findMany(), prisma.reuniao.findMany(),
    prisma.evento.findMany(), prisma.aviso.findMany(), prisma.escalaCulto.findMany(),
    prisma.precoRevista.findMany(), prisma.parametro.findMany(),
    // `senha` fora, explicitamente. Ver o cabeçalho.
    prisma.usuario.findMany({
      select: {
        id: true, login: true, nome: true, perfil: true, congId: true,
        ativo: true, pessoaId: true,
      },
    }),
  ]);

  const agora = new Date();
  const arquivo = {
    portal: "Escola Bíblica Dominical",
    campo: ORG_NAME,
    versao: APP_VERSION,
    geradoEm: agora.toISOString(),
    geradoPor: sessao ? `${sessao.nome} (${sessao.login})` : "sem identificação",
    aviso:
      "Este arquivo contém dados pessoais de alunos, inclusive menores de idade. " +
      "As senhas foram deliberadamente omitidas. Guarde-o com o mesmo cuidado " +
      "que se guarda a secretaria da igreja.",
    dados: {
      congregacoes, cargos, pessoas, pessoaCargos, classes, alunos, frequencias,
      freqLicoes, licoes, ofertas, visitantes, reunioes, eventos, avisos,
      escalaCultos, precosRevistas, parametros, usuarios,
    },
  };

  registrar({
    sessao,
    acao: "CREATE",
    entidade: "Backup",
    descricao: `Backup completo gerado (${Object.values(arquivo.dados).reduce((s, v) => s + v.length, 0)} linhas).`,
  });

  const nome = `EBD_BACKUP_${agora.toISOString().slice(0, 10)}_${String(agora.getHours()).padStart(2, "0")}${String(agora.getMinutes()).padStart(2, "0")}.json`;

  return new NextResponse(JSON.stringify(arquivo, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      // Um backup em cache de CDN é um backup público. Nunca.
      "Cache-Control": "no-store, private",
    },
  });
}
