import type { ChamadaLocal, ItemFila } from "@/lib/db/schema";
import { ErroPermanente } from "./erros";
import type { Transporte } from "./motor";

/**
 * O transporte: quem de fato leva a fila ao servidor.
 *
 * O motor (lib/sync/motor.ts) sabe ordenar, insistir, recuar e parar. Ele nao
 * sabe — e nao deve saber — qual e o endereco de cada rota nem o formato do
 * corpo. Isso mora aqui, e e por isso que o motor pode ser exercitado no Node,
 * sem rede nenhuma, com um transporte de mentira.
 */

/**
 * Quando uma recusa nao adianta repetir.
 *
 * `401` — a sessao acabou. Enquanto a pessoa nao entrar de novo, a resposta
 *         sera a mesma. Nao ha o que insistir.
 * `403` — senha herdada da planilha ainda em uso: ler e liberado, gravar nao
 *         (ver lib/auth/guarda.ts). So a troca de senha resolve.
 * `400` e `422` — o pacote esta malformado. Um pacote malformado nao se
 *         conserta sozinho; reenvia-lo mil vezes so gasta bateria.
 *
 * Todo o resto — 500, 502, tempo esgotado, `fetch` que nem saiu do aparelho —
 * e falha passageira, e passageira e o caso comum na rede da igreja.
 */
async function recusaDoServidor(res: Response, oQue: string): Promise<Error> {
  const corpo = (await res.json().catch(() => ({}))) as {
    erro?: string;
    precisaTrocar?: boolean;
  };

  if (res.status === 403 && corpo.precisaTrocar) {
    return new ErroPermanente(
      "É preciso trocar a senha herdada antes de gravar.",
      "Abra “Trocar senha” no menu do usuário e escolha uma senha só sua.",
    );
  }

  if (res.status === 401) {
    return new ErroPermanente(
      "A sessão expirou.",
      "Entre no portal de novo — o que está guardado aqui sobe sozinho depois.",
    );
  }

  if (res.status === 403 || res.status === 400 || res.status === 422) {
    return new ErroPermanente(
      corpo.erro ?? `O servidor recusou ${oQue}.`,
      "Fale com a secretaria: o portal não conseguirá enviar isto sozinho.",
    );
  }

  return new Error(corpo.erro ?? `Falha ao enviar ${oQue} (HTTP ${res.status}).`);
}

/**
 * A chamada sobe INTEIRA, num pacote.
 *
 * O item da fila ja carrega o instantaneo completo (ver lib/db/schema.ts), e a
 * rota `POST /api/chamada` grava a classe toda numa transacao — ou tudo ou
 * nada. Reenviar o mesmo pacote atualiza em vez de duplicar, e e por isso que
 * o motor pode insistir sem medo de dobrar as presencas de ninguem.
 *
 * `marcas` traz SO quem foi marcado. Quem nao esta na lista continua sem
 * registro nenhum no banco, que e o terceiro estado — "nao marcado". Mandar
 * `presente: false` para eles seria transformar chamada inacabada em faltas.
 */
async function enviarChamada(item: ItemFila): Promise<{ idRemoto?: number }> {
  const pacote = item.dados as ChamadaLocal;

  const res = await fetch("/api/chamada", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      classeId: pacote.classeId,
      data: pacote.data,
      presencas: pacote.marcas.map((m) => ({ alunoId: m.alunoId, presente: m.presente })),
    }),
  });

  if (!res.ok) throw await recusaDoServidor(res, "a chamada");

  // A rota devolve quantas linhas criou e atualizou, e nao um id: a chamada e
  // um conjunto de frequencias, nao um registro unico. Nao ha `idRemoto`.
  return {};
}

/**
 * O transporte de verdade.
 *
 * Hoje so a Chamada esta ligada. As demais tabelas do banco local existem
 * desde a Fase 01 mas nada as enfileira ainda — e uma tabela que aparecesse
 * aqui sem rota correspondente ficaria repetindo uma requisicao para um
 * endereco que nao existe. Por isso o padrao e recusa PERMANENTE: o item fica
 * parado e visivel, em vez de sumir ou martelar o servidor.
 */
export const transporteHttp: Transporte = async (item) => {
  switch (item.tabela) {
    case "chamadas":
      return enviarChamada(item);
    default:
      throw new ErroPermanente(
        `Ainda não há envio automático para "${item.tabela}".`,
        "Nada foi perdido: o registro continua guardado no aparelho.",
      );
  }
};
