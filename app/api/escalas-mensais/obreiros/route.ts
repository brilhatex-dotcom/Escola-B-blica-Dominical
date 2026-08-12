import { prisma } from "@/lib/prisma";
import { responder } from "@/lib/api";
import { exigirLeitura } from "@/lib/auth/guarda";

/**
 * O diretório de obreiros para o painel lateral do builder — toda Pessoa com
 * um tratamento eclesiástico (Pr., Pb., Dc., Aux. …), que é o que o pastor
 * reconhece como "obreiro" ao montar a escala. Quem não tem tratamento
 * cadastrado (a maioria dos alunos, por exemplo) não aparece aqui — mas
 * continua podendo ser adicionado a um culto pela busca, que cria a pessoa
 * na hora se for um nome novo.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { recusa } = await exigirLeitura("escalas");
  if (recusa) return recusa;

  return responder(async () => {
    const pessoas = await prisma.pessoa.findMany({
      where: { tratamento: { not: null }, ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, tratamento: true },
    });
    return { itens: pessoas.filter((p) => p.tratamento?.trim()) };
  });
}
