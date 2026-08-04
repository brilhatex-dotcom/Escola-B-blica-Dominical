import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirLeitura } from "@/lib/auth/guarda";
import { montarAcesso } from "@/lib/auth/acesso";
import { papelPrincipal, rotuloDoPapel } from "@/lib/auth/papeis";

/**
 * As contas de acesso e o papel de cada uma.
 *
 * ============================================================================
 * A TELA MOSTRA O ACESSO CALCULADO, NÃO UM CAMPO GRAVADO
 *
 * Não existe coluna "papel" em `Usuarios` — e não existe de propósito. O papel
 * vem dos CARGOS que a pessoa ocupa (`PessoaCargos`), que é onde a igreja já
 * registra quem faz o quê. Uma coluna paralela significaria manter a mesma
 * informação em dois lugares: alguém deixa o cargo, ninguém lembra da outra
 * tela, e o acesso continua aberto.
 *
 * Por isso esta rota devolve o resultado do cálculo, com a marca `presumido`
 * dizendo quando ele foi DEDUZIDO do perfil herdado em vez de lido de um cargo.
 * ============================================================================
 *
 * A senha nunca sai daqui — nem o hash. Ele não serve para nada na tela e, uma
 * vez numa resposta HTTP, fica no cache do navegador e no log de qualquer
 * intermediário.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { recusa } = await exigirLeitura("usuarios");
  if (recusa) return recusa;

  return responder(async () => {
    const [usuarios, congregacoes] = await Promise.all([
      prisma.usuario.findMany({
        orderBy: [{ ativo: "desc" }, { nome: "asc" }],
        select: {
          id: true,
          nome: true,
          login: true,
          perfil: true,
          congId: true,
          ativo: true,
          pessoaId: true,
          pessoa: {
            select: {
              id: true,
              nome: true,
              tratamento: true,
              cargos: {
                where: { ativo: true, fim: null },
                select: { congId: true, cargo: { select: { nome: true } } },
              },
            },
          },
        },
      }),
      prisma.congregacao.findMany({ select: { id: true, nome: true } }),
    ]);

    const nomeDaCong = new Map(congregacoes.map((c) => [c.id, c.nome]));

    const itens = usuarios.map((u) => {
      const acesso = montarAcesso(
        { id: u.id, perfil: u.perfil, congId: u.congId, pessoaId: u.pessoaId },
        u.pessoa?.cargos ?? [],
      );
      const papel = papelPrincipal(acesso.papeis);

      return {
        id: u.id,
        nome: u.nome,
        login: u.login,
        ativo: u.ativo,
        /** O valor original da planilha, mostrado como veio. Nada é reescrito. */
        perfilHerdado: u.perfil,
        congregacao:
          u.congId === null
            ? null
            : { id: u.congId, nome: nomeDaCong.get(u.congId) || `Congregação ${u.congId}` },
        pessoa: u.pessoa
          ? { id: u.pessoa.id, nome: u.pessoa.nome, tratamento: u.pessoa.tratamento }
          : null,
        papel,
        papelRotulo: papel ? rotuloDoPapel(papel) : "Sem acesso",
        papeis: acesso.papeis,
        escopo: acesso.escopo,
        presumido: acesso.presumido,
        congregacoesDoAcesso: acesso.congIds.map((id) => ({
          id,
          nome: nomeDaCong.get(id) || `Congregação ${id}`,
        })),
      };
    });

    return {
      itens,
      total: itens.length,
      /*
       * Quantas contas ainda estão com acesso PRESUMIDO.
       *
       * É o número que interessa à administração: cada uma dessas é uma conta
       * cujo alcance o portal chutou a partir da planilha, e que só um humano
       * pode confirmar ligando-a a uma pessoa e a um cargo.
       */
      presumidos: itens.filter((i) => i.presumido).length,
    };
  });
}
