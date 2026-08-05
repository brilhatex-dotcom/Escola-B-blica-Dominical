"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CloudOff, HardDrive, Loader2, Trash2 } from "lucide-react";
import { db, temBancoLocal } from "@/lib/db/local";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CabecalhoModulo, EsqueletoLista } from "@/components/dashboard/PaginaModulo";

/**
 * O que está guardado NESTE aparelho.
 *
 * ============================================================================
 * "LIMPAR" AQUI SÓ APAGA O QUE JÁ SUBIU — E A TELA SE RECUSA A IR ALÉM
 *
 * O botão de limpar é o que a pessoa procura quando o celular reclama de
 * espaço. Se ele apagasse a fila junto, apagaria a chamada do domingo que ainda
 * não chegou ao servidor — sem cópia, e sem ninguém perceber.
 *
 * Por isso a limpeza é BLOQUEADA enquanto houver item pendente, com a fila
 * apontada e um caminho: Configurações → Sincronização. Um aviso "tem certeza?"
 * não resolveria: quem chegou até aqui já decidiu que quer limpar, e é
 * exatamente nesse estado que se clica em "sim" sem ler.
 * ============================================================================
 *
 * Tudo roda no navegador. O servidor não sabe — e não pode saber — o que está
 * guardado no aparelho de cada professor.
 */

interface Contagem { rotulo: string; linhas: number }

const num = new Intl.NumberFormat("pt-BR");

function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export default function OfflinePage() {
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
  const [contagens, setContagens] = useState<Contagem[] | null>(null);
  const [naFila, setNaFila] = useState(0);
  const [espaco, setEspaco] = useState<{ usado: number; total: number } | null>(null);
  const [caches, setCaches] = useState<{ nome: string; itens: number }[]>([]);
  const [limpando, setLimpando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  const ler = useCallback(async () => {
    if (!temBanco) return;
    const banco = db();
    const [congregacoes, classes, alunos, frequencias, visitantes, chamadas, fila] =
      await Promise.all([
        banco.congregacoes.count(), banco.classes.count(), banco.alunos.count(),
        banco.frequencias.count(), banco.visitantes.count(), banco.chamadas.count(),
        banco.fila.count(),
      ]);

    setContagens([
      { rotulo: "Congregações", linhas: congregacoes },
      { rotulo: "Classes", linhas: classes },
      { rotulo: "Alunos", linhas: alunos },
      { rotulo: "Frequências", linhas: frequencias },
      { rotulo: "Visitantes", linhas: visitantes },
      { rotulo: "Chamadas guardadas", linhas: chamadas },
    ]);
    setNaFila(fila);

    /*
     * `estimate()` é uma ESTIMATIVA do navegador, e ele arredonda de propósito
     * para não virar impressão digital do aparelho. A tela diz "aproximado" em
     * vez de fingir precisão que o número não tem.
     */
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      if (e.usage != null && e.quota != null) setEspaco({ usado: e.usage, total: e.quota });
    }

    /*
     * `window.caches` e não `caches`: o estado desta tela também se chama
     * `caches` e sombreia o global dentro deste componente. Sem o `window.`, o
     * código leria o próprio array de resultados e nunca acharia cache nenhum.
     */
    if (window.caches) {
      const nomes = await window.caches.keys();
      const detalhes = await Promise.all(
        nomes.map(async (nome) => ({
          nome,
          itens: (await (await window.caches.open(nome)).keys()).length,
        })),
      );
      setCaches(detalhes);
    }
  }, [temBanco]);

  useEffect(() => { void ler(); }, [ler]);

  async function limpar() {
    if (naFila > 0) return;
    setLimpando(true);
    try {
      const banco = db();
      /*
       * A FILA e a CONFIG ficam. `limparBancoLocal()` existe para o logout e
       * apaga tudo, inclusive a fila — o que é certo lá e errado aqui: quem
       * limpa espaço não está saindo do sistema.
       */
      await Promise.all([
        banco.congregacoes.clear(), banco.classes.clear(), banco.alunos.clear(),
        banco.frequencias.clear(), banco.visitantes.clear(), banco.chamadas.clear(),
      ]);
      setRecado(
        "Cópia local apagada. Ela volta sozinha na próxima vez que cada tela for aberta com internet.",
      );
    } finally {
      setLimpando(false);
      void ler();
    }
  }

  if (temBanco === null) {
    return (
      <>
        <CabecalhoModulo icone={CloudOff} titulo="Offline" descricao="O que está guardado neste aparelho" />
        <EsqueletoLista linhas={4} />
      </>
    );
  }

  if (!temBanco) {
    return (
      <>
        <CabecalhoModulo icone={CloudOff} titulo="Offline" descricao="O que está guardado neste aparelho" />
        <Alert tipo="alerta" titulo="Este navegador não guarda nada offline">
          Sem IndexedDB o portal só funciona com internet — a chamada precisa chegar ao
          servidor no instante em que é marcada. Costuma acontecer em janela anônima e
          em navegadores muito antigos.
        </Alert>
      </>
    );
  }

  const total = contagens?.reduce((s, c) => s + c.linhas, 0) ?? 0;

  return (
    <>
      <CabecalhoModulo
        icone={CloudOff}
        titulo="Offline"
        descricao="O que está guardado neste aparelho"
        total={contagens ? total : null}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <section className="glass-panel rounded-2xl p-4">
          <h2 className="font-display text-[0.78rem] uppercase tracking-[0.16em] text-gold-300">
            Cópia local dos dados
          </h2>
          <p className="mt-1 text-[0.76rem] text-brand-300/50">
            É o que permite abrir a Chamada sem sinal na igreja.
          </p>
          <div className="mt-3">
            {contagens?.map((c) => (
              <div
                key={c.rotulo}
                className="flex items-baseline justify-between gap-2 border-b border-white/6 py-2 last:border-0"
              >
                <span className="text-[0.8rem] text-brand-200/65">{c.rotulo}</span>
                <span className="text-[0.84rem] tabular-nums text-brand-50">
                  {num.format(c.linhas)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-4">
          <h2 className="font-display text-[0.78rem] uppercase tracking-[0.16em] text-gold-300">
            Espaço e arquivos
          </h2>
          <p className="mt-1 text-[0.76rem] text-brand-300/50">
            Inclui o vídeo da abertura, que o portal guarda para funcionar sem internet.
          </p>

          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2 border-b border-white/6 py-2">
              <span className="text-[0.8rem] text-brand-200/65">Espaço usado (aproximado)</span>
              <span className="text-[0.84rem] tabular-nums text-brand-50">
                {espaco ? tamanho(espaco.usado) : "—"}
              </span>
            </div>
            {caches.map((c) => (
              <div
                key={c.nome}
                className="flex items-baseline justify-between gap-2 border-b border-white/6 py-2 last:border-0"
              >
                <span className="min-w-0 flex-1 truncate text-[0.8rem] text-brand-200/65">
                  <HardDrive className="mr-1.5 inline h-3.5 w-3.5 text-brand-300/50" />
                  {c.nome}
                </span>
                <span className="shrink-0 text-[0.84rem] tabular-nums text-brand-50">
                  {c.itens} arquivo{c.itens === 1 ? "" : "s"}
                </span>
              </div>
            ))}
            {caches.length === 0 && (
              <p className="py-2 text-[0.78rem] text-brand-300/45">
                Nenhum arquivo guardado ainda — abra o portal uma vez com internet.
              </p>
            )}
          </div>
        </section>
      </motion.div>

      <div className="mt-4">
        {naFila > 0 ? (
          <Alert tipo="alerta" titulo={`${naFila} registro(s) ainda não subiram`}>
            A limpeza fica bloqueada enquanto houver coisa na fila — apagar agora
            perderia o que foi gravado neste aparelho e ainda não chegou ao servidor.
            Vá em <strong>Configurações → Sincronização</strong>, envie a fila, e volte
            aqui.
          </Alert>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => void limpar()} disabled={limpando}>
              {limpando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Limpar a cópia local
            </Button>
            <Badge variant="sucesso">fila vazia</Badge>
            {recado && <p className="text-[0.8rem] text-brand-100/80">{recado}</p>}
          </div>
        )}
      </div>

      <p className="mt-4 text-[0.76rem] leading-relaxed text-brand-300/45">
        Limpar não apaga nada do servidor: a cópia local é só um espelho, e ela se
        refaz sozinha na próxima abertura com internet.
      </p>
    </>
  );
}
