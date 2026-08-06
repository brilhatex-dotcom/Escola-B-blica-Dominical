import { prisma, nomeDaVariavel, temBanco } from "@/lib/prisma";
import { erro, responder } from "@/lib/api";
import { exigirEscrita, exigirLeitura } from "@/lib/auth/guarda";
import { temSegredo } from "@/lib/auth/sessao";
import { registrar, jaGravaAuditoria } from "@/lib/auditoria";
import { APP_VERSION, ORG_NAME, EXIGIR_SENHA_PROPRIA_PARA_GRAVAR } from "@/lib/config";

/**
 * Parâmetros do portal e do campo.
 *
 * ============================================================================
 * O QUE É DADO FICA NO BANCO; O QUE É REGRA FICA NO CÓDIGO — E A TELA MOSTRA OS DOIS
 *
 * O preço da revista muda todo ano e é decisão da secretaria: é DADO, mora em
 * `Parametros` e `Precos_Revistas`, e esta rota grava.
 *
 * Se a senha herdada bloqueia a gravação, quem enxerga o quê, quantos segundos
 * dura a abertura — isso é REGRA. Um campo editável para "exigir senha própria"
 * significaria que um clique errado tranca a EBD inteira num domingo de manhã,
 * sem ninguém entender por quê. Aparece aqui em modo de leitura, com o estado
 * atual visível e o caminho escrito.
 *
 * Misturar os dois num formulário só faria a secretaria descobrir, por
 * tentativa, que metade dos campos não salva.
 * ============================================================================
 *
 * GET — parâmetros, preços e o estado do servidor
 * PUT { parametros?: [{parametro, valor}], precos?: [{key, categoria, preco}] }
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { recusa } = await exigirLeitura("cfg-sistema");
  if (recusa) return recusa;

  return responder(async () => {
    const [parametros, precos, congs, gravandoAuditoria] = await Promise.all([
      prisma.parametro.findMany({ orderBy: { parametro: "asc" } }),
      prisma.precoRevista.findMany({ orderBy: [{ categoria: "asc" }, { key: "asc" }] }),
      prisma.congregacao.count(),
      jaGravaAuditoria(),
    ]);

    return {
      parametros: parametros.map((p) => ({
        parametro: p.parametro,
        rotulo: p.parametro.replace(/_/g, " "),
        valor: Number(p.valor),
      })),
      /*
       * `categoria` é a chave interna ("adolesc", "jovenadult", "preadolesc") e
       * não serve de título na tela — "PREADOLESC" não é palavra nenhuma. O
       * nome legível já existe dentro de `label` ("Pré-Adolescentes — Revista do
       * Aluno"), então o grupo sai dali, e não de um segundo mapa de tradução
       * que teria de ser atualizado toda vez que a secretaria criar categoria.
       */
      precos: precos.map((p) => {
        const [grupo, ...resto] = p.label.split(" — ");
        return {
          key: p.key,
          categoria: p.categoria,
          grupo: resto.length > 0 ? grupo : p.categoria,
          rotulo: resto.length > 0 ? resto.join(" — ") : p.label,
          preco: Number(p.preco),
        };
      }),
      /*
       * O estado do servidor, sem nenhum segredo dentro.
       *
       * `nomeDaVariavel` devolve o NOME da variável de ambiente em uso, nunca o
       * valor — a mesma regra de /api/diagnostico. Uma tela de configuração que
       * mostra a string de conexão entrega o banco a quem tirar um print dela,
       * e prints deste portal já circularam por WhatsApp.
       */
      servidor: {
        versao: APP_VERSION,
        campo: ORG_NAME,
        congregacoes: congs,
        bancoConfigurado: temBanco(),
        variavelDoBanco: nomeDaVariavel(),
        autenticacaoLigada: temSegredo(),
        exigeSenhaPropriaParaGravar: EXIGIR_SENHA_PROPRIA_PARA_GRAVAR,
        gravandoAuditoria,
      },
    };
  });
}

export async function PUT(req: Request) {
  const { sessao, recusa } = await exigirEscrita("cfg-sistema");
  if (recusa) return recusa;

  let corpo: {
    parametros?: Array<{ parametro: string; valor: number }>;
    precos?: Array<{ key: string; categoria: string; preco: number }>;
  };
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }

  const parametros = corpo?.parametros ?? [];
  const precos = corpo?.precos ?? [];
  if (parametros.length === 0 && precos.length === 0) {
    return erro("Nada para gravar.", 400);
  }

  /*
   * Um preço negativo ou absurdo passaria direto e só apareceria como um pedido
   * de revistas de R$ -3.000,00 na frente da tesouraria. A conferência é aqui,
   * antes de gravar, e não na tela: a tela pode ser contornada.
   */
  for (const p of [...parametros.map((x) => x.valor), ...precos.map((x) => x.preco)]) {
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 100000) {
      return erro("Valor inválido — informe um número entre 0 e 100.000.", 400);
    }
  }

  return responder(async () => {
    const mudancas: string[] = [];

    for (const p of parametros) {
      const antes = await prisma.parametro.findUnique({ where: { parametro: p.parametro } });
      if (!antes || Number(antes.valor) === p.valor) continue;
      await prisma.parametro.update({
        where: { parametro: p.parametro },
        data: { valor: p.valor },
      });
      mudancas.push(`${p.parametro}: ${Number(antes.valor).toFixed(2)} → ${p.valor.toFixed(2)}`);
    }

    for (const p of precos) {
      const onde = { key_categoria: { key: p.key, categoria: p.categoria } };
      const antes = await prisma.precoRevista.findUnique({ where: onde });
      if (!antes || Number(antes.preco) === p.preco) continue;
      await prisma.precoRevista.update({ where: onde, data: { preco: p.preco } });
      mudancas.push(
        `${antes.label}: ${Number(antes.preco).toFixed(2)} → ${p.preco.toFixed(2)}`,
      );
    }

    if (mudancas.length > 0) {
      registrar({
        sessao,
        acao: "UPDATE",
        entidade: "Parametros",
        descricao: mudancas.join(" · "),
      });
    }

    return { ok: true, alterados: mudancas.length, mudancas };
  });
}
