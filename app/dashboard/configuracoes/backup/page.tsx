"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Database, Download, ShieldAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo, EsqueletoLista, EstadoErro,
} from "@/components/dashboard/PaginaModulo";

/**
 * Cópia de segurança.
 *
 * ============================================================================
 * O AVISO VEM ANTES DO BOTÃO, E NÃO DEPOIS
 *
 * O arquivo traz nome, telefone e data de nascimento de 323 alunos, muitos
 * deles crianças. Quem clica precisa saber disso ENQUANTO decide, não numa
 * caixa de confirmação que se aprende a fechar sem ler.
 *
 * A tela também não esconde o botão de quem não pode baixar: ela diz que o
 * download exige permissão de administração. Sumir com o botão faria a pessoa
 * procurar o backup em outro lugar — e a resposta útil é "peça a quem
 * administra o campo", não o vazio.
 * ============================================================================
 */

interface Resumo {
  linhas: Record<string, number>;
  total: number;
  tabelas: number;
  podeBaixar: boolean;
}

const num = new Intl.NumberFormat("pt-BR");

const NOMES: Record<string, string> = {
  congregacoes: "Congregações", pessoas: "Pessoas", cargos: "Cargos",
  pessoaCargos: "Vínculos de cargo", classes: "Classes", alunos: "Alunos",
  frequencias: "Frequências", licoes: "Lições", ofertas: "Ofertas",
  visitantes: "Visitantes", reunioes: "Reuniões", eventos: "Eventos",
  avisos: "Avisos", escalas: "Escalas", usuarios: "Usuários",
};

export default function BackupPage() {
  const [dados, setDados] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/configuracoes/backup", { cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        setDados(await res.json());
      } catch (e) {
        const status = (e as { status?: number }).status;
        setErro(
          status === 403
            ? "O seu acesso não permite ver esta tela."
            : "Não foi possível carregar o resumo do backup.",
        );
      }
    })();
  }, []);

  /*
   * O download passa por `fetch` + Blob em vez de um <a href> direto por um
   * motivo prático: assim um 403 aparece como mensagem na tela, e não como uma
   * página de erro em JSON cru no lugar do portal.
   */
  async function baixar() {
    setBaixando(true);
    try {
      const res = await fetch("/api/configuracoes/backup?baixar=1", { cache: "no-store" });
      if (!res.ok) {
        setErro(
          res.status === 403
            ? "Baixar o backup exige permissão de administração do campo."
            : "Não foi possível gerar o arquivo.",
        );
        return;
      }
      const nome =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "EBD_BACKUP.json";

      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <>
      <CabecalhoModulo
        icone={Database}
        titulo="Backup"
        descricao="Cópia de segurança dos dados"
      />

      {erro ? <EstadoErro mensagem={erro} />
      : !dados ? <EsqueletoLista linhas={5} />
      : (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4"
        >
          <Alert tipo="alerta" titulo="O arquivo contém dados pessoais de crianças">
            São {num.format(dados.linhas.alunos ?? 0)} alunos com nome, telefone e data
            de nascimento. Depois de baixado, o arquivo sai do portal e não há como
            recolhê-lo. Guarde-o com o mesmo cuidado que se guarda a secretaria da
            igreja — e não o mande por aplicativo de mensagem.
            <br />
            <br />
            As <strong>senhas ficam de fora</strong> de propósito: um backup com elas
            dentro seria uma lista pronta para quem abrisse o arquivo.
          </Alert>

          <section className="glass-panel rounded-2xl p-4">
            <h2 className="font-display text-[0.78rem] uppercase tracking-[0.16em] text-gold-300">
              O que entra no arquivo
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
              {Object.entries(dados.linhas).map(([chave, n]) => (
                <div
                  key={chave}
                  className="flex items-baseline justify-between gap-2 border-b border-white/6 py-2"
                >
                  <span className="truncate text-[0.78rem] text-brand-200/65">
                    {NOMES[chave] ?? chave}
                  </span>
                  <span className="shrink-0 text-[0.82rem] tabular-nums text-brand-50">
                    {num.format(n)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[0.8rem] text-brand-100/80">
              <strong className="tabular-nums">{num.format(dados.total)}</strong> linhas em{" "}
              {dados.tabelas} tabelas.
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void baixar()} disabled={baixando || !dados.podeBaixar}>
              <Download className="h-4 w-4" />
              {baixando ? "Gerando o arquivo…" : "Baixar o backup"}
            </Button>

            {!dados.podeBaixar && (
              <p className="flex items-center gap-2 text-[0.78rem] text-brand-200/60">
                <ShieldAlert className="h-4 w-4 shrink-0 text-gold-300" />
                Baixar exige permissão de administração do campo. Você pode ver o resumo.
              </p>
            )}
          </div>

          <p className="text-[0.76rem] leading-relaxed text-brand-300/45">
            Cada geração de arquivo fica registrada em Configurações → Logs, com quem
            gerou e quando. É a única pista que sobra depois que o arquivo sai daqui.
          </p>
        </motion.div>
      )}
    </>
  );
}
