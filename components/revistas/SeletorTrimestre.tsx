"use client";

import { cn } from "@/lib/utils";
import { proximoTrimestre, quatroTrimestres, trimestreDe } from "@/lib/revistas/trimestre";

/**
 * O seletor de trimestre do Pedido de Lição — quatro botões, um por
 * trimestre, em vez do antigo alternador "Trimestre atual / Próximo
 * trimestre".
 *
 * Os dois nomes escondiam a mesma pergunta que a secretaria sempre faz na
 * prática — "isso aqui é sobre qual trimestre?" — atrás de um rótulo que só
 * faz sentido relendo a tela. Mostrando os quatro trimestres com o nome
 * completo (1º, 2º, 3º, 4º), a pessoa escolhe direto o que quer ver, sem
 * precisar adivinhar qual dos dois botões é o de agora. O trimestre em
 * andamento continua marcado — "atual" — para quem quiser esse atalho.
 */
export function SeletorTrimestre({
  selecionado,
  aoSelecionar,
}: {
  selecionado: string;
  aoSelecionar: (chave: string) => void;
}) {
  const hoje = new Date();
  const trimestres = quatroTrimestres(hoje);
  const chaveAtual = trimestreDe(hoje).chave;
  const chaveProximo = proximoTrimestre(hoje).chave;

  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {trimestres.map((t) => (
        <button
          key={t.chave}
          type="button"
          onClick={() => aoSelecionar(t.chave)}
          title={
            t.chave === chaveAtual
              ? "Trimestre em andamento — o que está sendo pago agora"
              : t.chave === chaveProximo
                ? "Ainda não começou — faça o pedido aqui, com antecedência"
                : undefined
          }
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.78rem] transition-colors duration-300",
            selecionado === t.chave ? "bg-gold-400/15 text-gold-200" : "text-brand-200/60 hover:text-brand-100",
          )}
        >
          {t.q}º trimestre {t.ano}
          {t.chave === chaveAtual && <span className="text-[0.62rem] text-emerald-300/80">atual</span>}
        </button>
      ))}
    </div>
  );
}
