"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CampoDeNomes } from "@/components/crud/CampoDeNomes";

/**
 * Formulário de cadastro em modal.
 *
 * ============================================================================
 * OS CAMPOS SÃO DECLARADOS, E NÃO DESENHADOS UM A UM
 *
 * São seis telas de cadastro no portal — aluno, classe, visitante, professor,
 * evento, pedido. Escritas à mão, cada uma acaba com o seu próprio jeito de
 * marcar campo obrigatório, o seu espaçamento e o seu botão de gravar; a quinta
 * já não parece do mesmo sistema que a primeira.
 *
 * Declarando os campos, todas se comportam igual — e uma melhoria de
 * acessibilidade feita aqui vale para as seis de uma vez.
 * ============================================================================
 *
 * O erro do servidor aparece DENTRO do modal, junto do botão. Fechar o modal
 * para mostrar o erro atrás faria o usuário perder tudo o que digitou, que é o
 * pior momento possível para perder um formulário.
 */

export type TipoCampo = "texto" | "data" | "telefone" | "numero" | "lista" | "area" | "nomes";

export interface CampoForm {
  chave: string;
  rotulo: string;
  tipo?: TipoCampo;
  obrigatorio?: boolean;
  /** Texto de ajuda embaixo do campo — o "por quê", quando não é óbvio. */
  ajuda?: string;
  opcoes?: Array<{ valor: string; rotulo: string }>;
  /** Ocupa a linha inteira na grade de duas colunas. */
  largo?: boolean;
  placeholder?: string;
}

export interface FormularioModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  campos: readonly CampoForm[];
  /** Valores iniciais. Trocá-los reabre o formulário preenchido para edição. */
  valores: Record<string, string>;
  /** Devolve mensagem de erro, ou nada quando gravou. */
  aoGravar: (valores: Record<string, string>) => Promise<string | void>;
  rotuloGravar?: string;
}

export function FormularioModal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  campos,
  valores,
  aoGravar,
  rotuloGravar = "Salvar",
}: FormularioModalProps) {
  const [estado, setEstado] = useState<Record<string, string>>(valores);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /*
   * Quantos campos "nomes" estão com a busca aberta agora.
   *
   * O Radix fecha o Dialog no Esc através de um listener de CAPTURA no
   * `document` — ele dispara antes de qualquer handler dentro do formulário,
   * então nenhum `stopPropagation` no campo de busca chega a tempo. Só o
   * próprio `onEscapeKeyDown` do Dialog (abaixo) consegue interceptar a
   * tempo. Sem isto, apertar Esc para só cancelar a busca de um nome fechava
   * a reunião inteira, derrubando os nomes já adicionados.
   */
  const buscasDeNomesAbertas = useRef(0);

  /*
   * Os valores são recarregados a cada abertura.
   *
   * Sem isto, editar o aluno A, fechar e abrir o aluno B mostraria os dados do
   * A — e gravar por cima renomearia a pessoa errada, com a tela dizendo o
   * nome certo o tempo todo.
   */
  useEffect(() => {
    if (aberto) {
      setEstado(valores);
      setErro(null);
      buscasDeNomesAbertas.current = 0;
    }
    // `valores` é recriado a cada render pelo chamador; depender dele aqui
    // apagaria o que está sendo digitado a cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (gravando) return;

    const faltando = campos.find((c) => c.obrigatorio && !estado[c.chave]?.trim());
    if (faltando) {
      setErro(`Preencha o campo "${faltando.rotulo}".`);
      return;
    }

    setGravando(true);
    setErro(null);
    try {
      const problema = await aoGravar(estado);
      if (problema) setErro(problema);
      else aoFechar();
    } finally {
      setGravando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !gravando && !v && aoFechar()}>
      <DialogContent
        className="max-w-xl"
        onEscapeKeyDown={(e) => {
          if (buscasDeNomesAbertas.current > 0) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao && <DialogDescription>{descricao}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={enviar} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {campos.map((campo) => {
              /*
               * `<label>` só é seguro em volta de UM controle. O navegador
               * encaminha o clique dentro do `<label>` para "o controle
               * associado" — é o que faz clicar no texto de um checkbox
               * marcá-lo, e é inofensivo quando dentro só existe um campo.
               *
               * "nomes" tem VÁRIOS botões dentro (resultado da busca, pílula,
               * remover). O mesmo encaminhamento então mira o botão errado —
               * depois de adicionar um nome, o navegador reenvia o clique
               * para quem estiver na mesma posição, que passa a ser o "x" de
               * remover: o nome some sozinho, ~20ms depois de ser
               * adicionado, sem nenhum segundo clique da pessoa. Por isso
               * este campo usa `<div>`, sem o encaminhamento implícito.
               */
              const Rotulo = campo.tipo === "nomes" ? "div" : "label";
              return (
              <Rotulo
                key={campo.chave}
                className={cn(
                  "block",
                  (campo.largo || campo.tipo === "area" || campo.tipo === "nomes") && "sm:col-span-2",
                )}
              >
                <span className="mb-1.5 block text-[0.76rem] text-brand-200/70">
                  {campo.rotulo}
                  {campo.obrigatorio && <span className="ml-1 text-gold-300">*</span>}
                </span>

                {campo.tipo === "lista" ? (
                  <select
                    value={estado[campo.chave] ?? ""}
                    onChange={(e) => {
                      setEstado((a) => ({ ...a, [campo.chave]: e.target.value }));
                      setErro(null);
                    }}
                    disabled={gravando}
                    /*
                      `bg-brand-900` no <option>: o menu suspenso é desenhado
                      pelo sistema operacional, não pelo CSS da página. Sem cor
                      explícita, o Chrome no Windows abre uma lista de fundo
                      branco com texto branco — ilegível.
                    */
                    className={cn(campoBase, "[&>option]:bg-brand-900")}
                  >
                    <option value="">Selecione…</option>
                    {campo.opcoes?.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                ) : campo.tipo === "nomes" ? (
                  <CampoDeNomes
                    value={estado[campo.chave] ?? ""}
                    onChange={(v) => {
                      setEstado((a) => ({ ...a, [campo.chave]: v }));
                      setErro(null);
                    }}
                    disabled={gravando}
                    placeholder={campo.placeholder}
                    aoAlternarBusca={(ativa) => {
                      buscasDeNomesAbertas.current += ativa ? 1 : -1;
                    }}
                  />
                ) : campo.tipo === "area" ? (
                  <textarea
                    rows={3}
                    value={estado[campo.chave] ?? ""}
                    placeholder={campo.placeholder}
                    onChange={(e) => {
                      setEstado((a) => ({ ...a, [campo.chave]: e.target.value }));
                      setErro(null);
                    }}
                    disabled={gravando}
                    className={cn(campoBase, "h-auto py-2.5 leading-relaxed")}
                  />
                ) : (
                  <input
                    type={
                      campo.tipo === "data" ? "date" : campo.tipo === "telefone" ? "tel" : "text"
                    }
                    inputMode={campo.tipo === "numero" ? "numeric" : undefined}
                    value={estado[campo.chave] ?? ""}
                    placeholder={campo.placeholder}
                    onChange={(e) => {
                      setEstado((a) => ({ ...a, [campo.chave]: e.target.value }));
                      setErro(null);
                    }}
                    disabled={gravando}
                    className={cn(campoBase, campo.tipo === "data" && "[color-scheme:dark]")}
                  />
                )}

                {campo.ajuda && (
                  <span className="mt-1 block text-[0.68rem] leading-relaxed text-brand-200/45">
                    {campo.ajuda}
                  </span>
                )}
              </Rotulo>
              );
            })}
          </div>

          {erro && (
            <p
              role="alert"
              className="rounded-lg border border-flame-500/35 bg-flame-500/10 px-3 py-2 text-[0.8rem] text-flame-400"
            >
              {erro}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar} disabled={gravando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={gravando}>
              {gravando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {gravando ? "Salvando…" : rotuloGravar}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const campoBase = cn(
  "h-11 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3",
  "text-[0.86rem] text-brand-50 placeholder:text-brand-200/35",
  "transition-colors duration-300 focus:border-gold-400/35 focus:outline-none",
  "disabled:opacity-50",
);
