import { NextResponse } from "next/server";
import { lerDestaquesDoAgrupamento } from "@/lib/dashboard/consultas";
import { congregacaoDestaquePorIDI } from "@/lib/relatorios/metricasCongregacoes";
import { lerSessao } from "@/lib/auth/sessao";
import { recorteDaSessao } from "@/lib/auth/guarda";

/**
 * O cartão "Destaque" do Dashboard, com um período ESCOLHIDO NA TELA — não só
 * o mês ou o trimestre corrente que `/api/painel` já traz prontos (Fase 20).
 *
 *   ?de=YYYY-MM-DD&ate=YYYY-MM-DD   os dois obrigatórios
 *
 * ============================================================================
 * POR QUE UMA ROTA À PARTE, EM VEZ DE UM PARÂMETRO EM `/api/painel`
 *
 * `/api/painel` monta o Dashboard inteiro numa chamada só — de propósito,
 * para a tela não montar aos pedaços na abertura. Trocar a data do Destaque
 * não pode obrigar a recarregar os quatro números, o gráfico e as atividades
 * recentes de novo: seria pedir o bolo inteiro para trocar uma cobertura. Esta
 * rota devolve só o que o cartão precisa, e o resto do painel continua parado
 * na tela enquanto a pessoa escolhe as datas.
 *
 * A CONTA de Congregação Destaque é o IDI (`congregacaoDestaquePorIDI`,
 * `lib/relatorios/metricasCongregacoes.ts`) — a mesma usada por `lerDestaques`
 * para o mês e o trimestre, e por `/dashboard/relatorios/destaques`: as duas
 * telas nunca podem apontar congregações diferentes para o mesmo período.
 * Classe Destaque continua com a conta simples de sempre
 * (`lerDestaquesDoAgrupamento`), que já era igual nos dois lugares.
 * ============================================================================
 */
export const dynamic = "force-dynamic";

const LIMITE_DIAS = 366;

function dataValida(valor: string | null): Date | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const de = dataValida(url.searchParams.get("de"));
  const ate = dataValida(url.searchParams.get("ate"));

  if (!de || !ate) {
    return NextResponse.json({ erro: "Informe as duas datas, no formato AAAA-MM-DD." }, { status: 400 });
  }
  if (de > ate) {
    return NextResponse.json({ erro: "A data inicial não pode vir depois da data final." }, { status: 400 });
  }
  if ((ate.getTime() - de.getTime()) / 86_400_000 > LIMITE_DIAS) {
    return NextResponse.json({ erro: `Escolha um intervalo de até ${LIMITE_DIAS} dias.` }, { status: 400 });
  }

  try {
    const sessao = await lerSessao();
    const recorte = recorteDaSessao(sessao);

    const [congregacao, classe] = await Promise.all([
      // Congregação Destaque não se recorta — a mesma exceção de sempre
      // (Fase 18): é uma comparação do campo inteiro.
      congregacaoDestaquePorIDI(de, ate),
      lerDestaquesDoAgrupamento("classeId", de, ate, recorte),
    ]);

    return NextResponse.json({
      periodo: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) },
      congregacao,
      classe,
    });
  } catch (erro) {
    console.error("[dashboard/destaque] falhou:", erro);
    return NextResponse.json({ erro: "Não foi possível calcular o destaque deste período." }, { status: 500 });
  }
}
