"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { dataPorExtenso, saudacao } from "@/lib/dashboard/formato";
import { separarTratamento, tratamentoPorExtenso } from "@/lib/pessoas/nome";
import type { DadosPainel } from "@/lib/dashboard/tipos";

/**
 * Abertura da area principal: saudacao, data, versiculo e licao da semana.
 *
 * A DATA E A SAUDACAO SO PODEM SER CALCULADAS NO NAVEGADOR. O servidor roda em
 * UTC, num data center; o usuario esta em Pernambuco (UTC-3). As 22h de um
 * sabado em Recife, o servidor ja esta no domingo — o painel diria "Bom dia,
 * Domingo" para quem ainda esta na noite de sabado.
 *
 * Por isso os dois entram depois da montagem. Enquanto nao chegam, o espaco
 * fica RESERVADO com as mesmas medidas: sem isso, o titulo aparece do nada e
 * empurra os quatro cartoes para baixo justo quando a mao ja esta indo clicar.
 */

export interface SaudacaoProps {
  nome: string;
  versiculo: DadosPainel["versiculo"];
  licao: DadosPainel["resumo"]["licao"];
  className?: string;
}

/**
 * A saudação completa: tratamento por extenso + primeiro nome.
 *
 * ============================================================================
 * "BOM DIA, IR.ª." ERA UM DEFEITO, NÃO SÓ UMA ABREVIAÇÃO
 *
 * `Usuario.nome` é texto livre, e quem cadastra a conta às vezes digita o
 * tratamento junto ("Ir.ª Jéssica Sousa"). O código antigo pegava a primeira
 * PALAVRA do texto pra soar como gente — e a primeira palavra era o próprio
 * tratamento. A saudação terminava em "Bom dia, Ir.ª.", sem nome nenhum.
 *
 * `separarTratamento` (a mesma função que já resolvia isso em Pessoas) tira o
 * tratamento antes de pegar o primeiro nome, e `tratamentoPorExtenso` troca a
 * abreviação de crachá ("Ir.ª") pela forma que alguém diria em voz alta
 * ("Irmã") — uma saudação não é uma etiqueta de lista.
 * ============================================================================
 */
function saudacaoDoNome(nomeCompleto: string): string {
  const { tratamento, nome } = separarTratamento(nomeCompleto);
  const primeiro = nome.trim().split(/\s+/)[0] ?? nome;
  const extenso = tratamentoPorExtenso(tratamento);
  return extenso ? `${extenso} ${primeiro}` : primeiro;
}

export function Saudacao({ nome, versiculo, licao, className }: SaudacaoProps) {
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    setAgora(new Date());

    /*
     * Reavalia na virada da hora, e nao a cada minuto.
     *
     * Quem deixa o painel aberto a manha inteira veria "Bom dia" as 13h — um
     * detalhe pequeno que denuncia que a tela nao esta viva. Um temporizador
     * por minuto resolveria tambem, ao custo de 60 renderizacoes por hora para
     * mudar uma palavra tres vezes por dia.
     */
    const proximaHora = new Date();
    proximaHora.setHours(proximaHora.getHours() + 1, 0, 5, 0);
    const t = window.setTimeout(() => setAgora(new Date()), +proximaHora - Date.now());
    return () => window.clearTimeout(t);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={cn("mb-6", className)}
    >
      {/* min-h reserva a linha do titulo antes de a hora ser conhecida */}
      <h1 className="min-h-[2.1rem] font-display text-[1.45rem] font-semibold leading-tight text-white sm:text-[1.75rem]">
        {agora ? (
          <>
            {saudacao(agora)},{" "}
            <span className="text-gold-gradient">{saudacaoDoNome(nome)}</span>.
          </>
        ) : (
          <span className="sr-only">Carregando a saudação</span>
        )}
      </h1>

      <p className="mt-1.5 min-h-[1.25rem] text-[0.85rem] text-brand-200/60">
        {agora ? <>Hoje é {dataPorExtenso(agora)}.</> : null}
      </p>

      {/* ---------------- Versiculo e licao ---------------- */}
      <div className="mt-5 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <div className="glass-panel relative overflow-hidden rounded-2xl px-5 py-4">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold-400/[0.07] blur-2xl"
          />
          <div className="flex gap-3">
            <Quote className="h-4 w-4 shrink-0 rotate-180 text-gold-400/60" aria-hidden="true" />
            <blockquote className="min-w-0">
              <p className="font-serif text-[0.94rem] italic leading-relaxed text-brand-50/90">
                {versiculo.texto}
              </p>
              <footer className="mt-2 text-[0.72rem] uppercase tracking-[0.18em] text-gold-300/80">
                {versiculo.referencia}
              </footer>
            </blockquote>
          </div>
        </div>

        <div className="glass-panel flex flex-col justify-center rounded-2xl px-5 py-4">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-brand-200/50">
            Próxima lição · Adultos
          </p>
          <p className="mt-1.5 font-serif text-[0.95rem] leading-snug text-white">
            {licao.numero}. {licao.titulo}
          </p>
          <p className="mt-1 text-[0.72rem] text-brand-200/50">{licao.revista}</p>
        </div>
      </div>
    </motion.header>
  );
}
