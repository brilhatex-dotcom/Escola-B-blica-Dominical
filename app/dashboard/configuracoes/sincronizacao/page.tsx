"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cloud, Loader2, RefreshCw, Unlock } from "lucide-react";
import { db, temBancoLocal } from "@/lib/db/local";
import type { ItemFila } from "@/lib/db/schema";
import { aoMudar, liberarBloqueios, sincronizar, type EstadoMotor } from "@/lib/sync/motor";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CabecalhoModulo, EsqueletoLista, EstadoVazio } from "@/components/dashboard/PaginaModulo";

/**
 * A fila de envio.
 *
 * ============================================================================
 * ESTA TELA MOSTRA A FILA — E NÃO OFERECE APAGÁ-LA
 *
 * A fila do domingo de manhã é a chamada de uma classe inteira que ainda não
 * subiu. "Limpar a fila" seria o botão mais tentador desta tela para quem viu
 * um número vermelho e quer que ele suma — e apagaria a chamada, sem cópia
 * nenhuma, sem ninguém perceber até o relatório do mês.
 *
 * O que existe aqui é: mandar de novo, e destravar o que o servidor recusou.
 * Item nenhum sai daqui a não ser pela porta da frente, que é chegar ao
 * servidor.
 * ============================================================================
 *
 * Roda inteiramente no navegador. Não há rota: a fila mora no IndexedDB deste
 * aparelho, e o servidor genuinamente não sabe o que há nela.
 */

interface Visao {
  itens: ItemFila[];
  pendentes: number;
  bloqueados: number;
  comErro: number;
}

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

const ROTULO_TABELA: Record<string, string> = {
  congregacoes: "Congregação", classes: "Classe", alunos: "Aluno",
  frequencias: "Frequência", visitantes: "Visitante", chamadas: "Chamada",
};

const ROTULO_ESTADO: Record<EstadoMotor, { texto: string; variante: "sucesso" | "info" | "alerta" | "erro" }> = {
  ocioso: { texto: "em dia", variante: "sucesso" },
  sincronizando: { texto: "enviando…", variante: "info" },
  offline: { texto: "sem internet", variante: "alerta" },
  erro: { texto: "falhou o último envio", variante: "erro" },
  bloqueado: { texto: "travado pelo servidor", variante: "erro" },
};

export default function SincronizacaoPage() {
  /*
   * `null` = ainda não se sabe.
   *
   * Inicializar com `temBancoLocal()` parecia mais direto e quebrava a
   * hidratação: no servidor não existe IndexedDB, então o HTML vinha com "este
   * navegador não guarda dados" e o React trocava tudo no primeiro instante —
   * o React reclama (erro #418) e a tela pisca a mensagem errada.
   *
   * A pergunta só pode ser feita no navegador, então ela espera o efeito.
   */
  const [temBanco, setTemBanco] = useState<boolean | null>(null);
  useEffect(() => setTemBanco(temBancoLocal()), []);
  const [visao, setVisao] = useState<Visao | null>(null);
  const [estado, setEstado] = useState<EstadoMotor>("ocioso");
  const [motivo, setMotivo] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  const ler = useCallback(async () => {
    if (!temBanco) return;
    const itens = await db().fila.orderBy("criadoEm").toArray();
    setVisao({
      itens,
      pendentes: itens.length,
      bloqueados: itens.filter((i) => i.bloqueado).length,
      comErro: itens.filter((i) => i.ultimoErro && !i.bloqueado).length,
    });
  }, [temBanco]);

  useEffect(() => {
    void ler();
    // O motor avisa quando algo sobe; sem isso a tela mostraria a fila de
    // quando ela foi aberta e o número nunca desceria sozinho.
    return aoMudar((e, _pendentes, m) => {
      setEstado(e);
      setMotivo(m);
      void ler();
    });
  }, [ler]);

  async function enviarAgora() {
    setOcupado(true);
    setRecado(null);
    try {
      const r = await sincronizar();
      setRecado(
        r.enviados > 0
          ? `${r.enviados} envio(s) concluído(s). ${r.restantes} na fila.`
          : r.restantes === 0
            ? "A fila já estava vazia."
            : `Nada subiu agora — ${r.motivo ?? "sem conexão com o servidor"}.`,
      );
    } finally {
      setOcupado(false);
      void ler();
    }
  }

  async function destravar() {
    setOcupado(true);
    const n = await liberarBloqueios();
    setRecado(n === 0 ? "Não havia item travado." : `${n} item(ns) liberado(s) para tentar de novo.`);
    setOcupado(false);
    void ler();
    void sincronizar();
  }

  if (temBanco === null) {
    return (
      <>
        <CabecalhoModulo icone={Cloud} titulo="Sincronização" descricao="Fila de envio e estado da sincronização" />
        <EsqueletoLista linhas={4} />
      </>
    );
  }

  if (!temBanco) {
    return (
      <>
        <CabecalhoModulo icone={Cloud} titulo="Sincronização" descricao="Fila de envio e estado da sincronização" />
        <Alert tipo="alerta" titulo="Este navegador não guarda dados offline">
          Sem IndexedDB não há fila: tudo é gravado direto no servidor, e uma queda de
          internet no meio da chamada perde o que foi marcado. Acontece em janela
          anônima e em navegadores muito antigos.
        </Alert>
      </>
    );
  }

  const info = ROTULO_ESTADO[estado];

  return (
    <>
      <CabecalhoModulo
        icone={Cloud}
        titulo="Sincronização"
        descricao="Fila de envio e estado da sincronização"
        total={visao?.pendentes ?? null}
      >
        <Badge variant={info.variante}>{info.texto}</Badge>
      </CabecalhoModulo>

      {motivo && estado !== "ocioso" && (
        <Alert tipo={estado === "bloqueado" ? "erro" : "alerta"} titulo="O servidor respondeu">
          {motivo}
        </Alert>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={() => void enviarAgora()} disabled={ocupado}>
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Enviar agora
        </Button>

        {(visao?.bloqueados ?? 0) > 0 && (
          <Button variant="ghost" onClick={() => void destravar()} disabled={ocupado}>
            <Unlock className="h-4 w-4" />
            Destravar {visao!.bloqueados} item(ns)
          </Button>
        )}

        {recado && <p className="text-[0.8rem] text-brand-100/80">{recado}</p>}
      </div>

      <div className="mt-4">
        {!visao ? null : visao.itens.length === 0 ? (
          <EstadoVazio
            mensagem="Nada esperando para subir."
            dica="Tudo o que foi gravado neste aparelho já chegou ao servidor."
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel divide-y divide-white/6 rounded-2xl"
          >
            {visao.itens.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.86rem] text-white">
                    {ROTULO_TABELA[i.tabela] ?? i.tabela}
                    <span className="ml-2 text-[0.76rem] text-brand-200/55">{i.operacao}</span>
                  </p>
                  <p className="mt-0.5 text-[0.72rem] tabular-nums text-brand-300/45">
                    na fila desde {fmtHora.format(new Date(i.criadoEm))}
                    {i.tentativas > 0 && ` · ${i.tentativas} tentativa(s)`}
                  </p>
                  {i.ultimoErro && (
                    <p className="mt-1 text-[0.74rem] text-flame-400/80">{i.ultimoErro}</p>
                  )}
                </div>
                <Badge variant={i.bloqueado ? "erro" : i.ultimoErro ? "alerta" : "neutro"}>
                  {i.bloqueado ? "travado" : i.ultimoErro ? "tentando" : "aguardando"}
                </Badge>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      <p className="mt-4 text-[0.76rem] leading-relaxed text-brand-300/45">
        A fila sobe sozinha: quando a internet volta, quando o app volta ao primeiro
        plano e a cada 30 segundos. Os botões acima existem para quem não quer esperar
        — não para consertar nada.
      </p>
    </>
  );
}
