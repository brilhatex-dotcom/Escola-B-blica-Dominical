"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sliders } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CabecalhoModulo, EsqueletoLista, EstadoErro,
} from "@/components/dashboard/PaginaModulo";

/**
 * Parâmetros do portal.
 *
 * ============================================================================
 * O QUE SALVA E O QUE NÃO SALVA FICAM VISIVELMENTE SEPARADOS
 *
 * Em cima, os valores editáveis: preço da revista e afins, que são decisão da
 * secretaria e mudam todo ano.
 *
 * Embaixo, o estado do servidor — só leitura. Um campo editável para "ligar a
 * autenticação" ou "exigir senha própria" seria um interruptor que tranca a EBD
 * inteira num domingo de manhã, e a tela não tem como desfazer isso.
 *
 * A alternativa — misturar tudo num formulário e ignorar em silêncio o que não
 * salva — faria a secretaria descobrir por tentativa quais campos são de
 * mentira. Aqui a diferença está escrita.
 * ============================================================================
 */

interface Parametro { parametro: string; rotulo: string; valor: number }
interface Preco { key: string; categoria: string; grupo: string; rotulo: string; preco: number }
interface Servidor {
  versao: string; campo: string; congregacoes: number;
  bancoConfigurado: boolean; variavelDoBanco: string | null;
  autenticacaoLigada: boolean; exigeSenhaPropriaParaGravar: boolean;
  gravandoAuditoria: boolean;
}


function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 py-2.5 last:border-0">
      <span className="text-[0.8rem] text-brand-200/65">{rotulo}</span>
      <span className="text-[0.82rem] text-brand-50">{valor}</span>
    </div>
  );
}

function CampoDeValor({
  rotulo,
  chave,
  rascunho,
  setRascunho,
}: {
  rotulo: string;
  chave: string;
  rascunho: Record<string, string>;
  setRascunho: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1 truncate text-[0.8rem] text-brand-100/80">{rotulo}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-[0.76rem] text-brand-300/50">R$</span>
        <input
          inputMode="decimal"
          value={rascunho[chave] ?? ""}
          onChange={(e) => setRascunho((r) => ({ ...r, [chave]: e.target.value }))}
          className="w-24 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-right text-[0.84rem] tabular-nums text-white focus:border-gold-400/35 focus:outline-none"
        />
      </span>
    </label>
  );
}

export default function SistemaPage() {
  const [dados, setDados] = useState<{ parametros: Parametro[]; precos: Preco[]; servidor: Servidor } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/configuracoes/sistema", { cache: "no-store" });
        if (!res.ok) throw Object.assign(new Error(), { status: res.status });
        const corpo = await res.json();
        setDados(corpo);
        setRascunho({
          ...Object.fromEntries(corpo.parametros.map((p: Parametro) => [`p:${p.parametro}`, String(p.valor)])),
          ...Object.fromEntries(corpo.precos.map((p: Preco) => [`r:${p.key}|${p.categoria}`, String(p.preco)])),
        });
      } catch (e) {
        const status = (e as { status?: number }).status;
        setErro(
          status === 403
            ? "O seu acesso não permite ver os parâmetros do sistema."
            : "Não foi possível carregar os parâmetros.",
        );
      }
    })();
  }, []);

  async function gravar() {
    if (!dados) return;
    setSalvando(true);
    setRecado(null);
    try {
      const res = await fetch("/api/configuracoes/sistema", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parametros: dados.parametros.map((p) => ({
            parametro: p.parametro,
            valor: Number(rascunho[`p:${p.parametro}`]?.replace(",", ".")),
          })),
          precos: dados.precos.map((p) => ({
            key: p.key,
            categoria: p.categoria,
            preco: Number(rascunho[`r:${p.key}|${p.categoria}`]?.replace(",", ".")),
          })),
        }),
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.erro ?? "Não foi possível gravar.");
      setRecado(
        corpo.alterados === 0
          ? "Nada mudou — os valores já eram esses."
          : `${corpo.alterados} valor(es) gravado(s).`,
      );
    } catch (e) {
      setRecado((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <CabecalhoModulo
        icone={Sliders}
        titulo="Sistema"
        descricao="Parâmetros do portal e do campo"
      />

      {erro ? <EstadoErro mensagem={erro} />
      : !dados ? <EsqueletoLista linhas={6} />
      : (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          {/* ---------- editável ---------- */}
          <section className="glass-panel rounded-2xl p-4">
            <h2 className="font-display text-[0.78rem] uppercase tracking-[0.16em] text-gold-300">
              Valores das revistas
            </h2>
            <p className="mt-1 text-[0.76rem] text-brand-300/50">
              É daqui que o Pedido de Revistas tira os preços.
            </p>

            {/*
              Agrupado por categoria, e não numa lista corrida de 35 linhas.
              A tabela de preços tem "Adultos — Aluno — Capa Comum" e "Adultos —
              Professor — Capa Comum" a sete linhas de distância; solta, a lista
              faz corrigir um e esquecer o outro.
            */}
            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                <h3 className="text-[0.7rem] uppercase tracking-[0.12em] text-brand-300/45">
                  Valores gerais
                </h3>
                {dados.parametros.map((p) => (
                  <CampoDeValor
                    key={p.parametro}
                    rotulo={p.rotulo}
                    chave={`p:${p.parametro}`}
                    rascunho={rascunho}
                    setRascunho={setRascunho}
                  />
                ))}
              </div>

              {[...new Set(dados.precos.map((p) => p.grupo))].map((grupo) => (
                <div key={grupo} className="space-y-2">
                  <h3 className="text-[0.7rem] uppercase tracking-[0.12em] text-brand-300/45">
                    {grupo}
                  </h3>
                  {dados.precos
                    .filter((p) => p.grupo === grupo)
                    .map((p) => (
                      <CampoDeValor
                        key={`${p.key}|${p.categoria}`}
                        rotulo={p.rotulo}
                        chave={`r:${p.key}|${p.categoria}`}
                        rascunho={rascunho}
                        setRascunho={setRascunho}
                      />
                    ))}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button onClick={() => void gravar()} disabled={salvando}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Gravar valores
              </Button>
              {recado && <p className="text-[0.78rem] text-brand-100/80">{recado}</p>}
            </div>
          </section>

          {/* ---------- só leitura ---------- */}
          <section className="glass-panel rounded-2xl p-4">
            <h2 className="font-display text-[0.78rem] uppercase tracking-[0.16em] text-gold-300">
              Estado do servidor
            </h2>
            <p className="mt-1 text-[0.76rem] text-brand-300/50">
              Só leitura — estes são ajustes do servidor, não do cadastro.
            </p>

            <div className="mt-3">
              <Linha rotulo="Versão do portal" valor={dados.servidor.versao} />
              <Linha rotulo="Campo" valor={dados.servidor.campo} />
              <Linha rotulo="Congregações" valor={dados.servidor.congregacoes} />
              <Linha
                rotulo="Banco de dados"
                valor={
                  dados.servidor.bancoConfigurado ? (
                    <Badge variant="sucesso">
                      ligado{dados.servidor.variavelDoBanco ? ` · ${dados.servidor.variavelDoBanco}` : ""}
                    </Badge>
                  ) : (
                    <Badge variant="erro">sem conexão</Badge>
                  )
                }
              />
              <Linha
                rotulo="Autenticação"
                valor={
                  dados.servidor.autenticacaoLigada
                    ? <Badge variant="sucesso">exigindo login</Badge>
                    : <Badge variant="erro">desligada</Badge>
                }
              />
              <Linha
                rotulo="Senha própria para gravar"
                valor={
                  dados.servidor.exigeSenhaPropriaParaGravar
                    ? <Badge variant="sucesso">exigida</Badge>
                    : <Badge variant="alerta">ainda não exigida</Badge>
                }
              />
              <Linha
                rotulo="Auditoria"
                valor={
                  dados.servidor.gravandoAuditoria
                    ? <Badge variant="sucesso">gravando</Badge>
                    : <Badge variant="alerta">só o histórico antigo</Badge>
                }
              />
            </div>

            {!dados.servidor.autenticacaoLigada && (
              <div className="mt-4">
                <Alert tipo="erro" titulo="O portal está aberto">
                  Sem a variável <code className="rounded bg-white/10 px-1">AUTH_SECRET</code> no
                  servidor não há sessão para verificar, e qualquer pessoa com o endereço
                  grava chamada. Isso se resolve nas variáveis de ambiente da Vercel, não
                  nesta tela.
                </Alert>
              </div>
            )}
          </section>
        </motion.div>
      )}
    </>
  );
}
