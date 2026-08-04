"use client";

import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Check, KeyRound, Minus, Pencil, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CabecalhoModulo } from "@/components/dashboard/PaginaModulo";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { PAPEIS, podeGravar, podeVer } from "@/lib/auth/papeis";
import { MENU_GRUPOS } from "@/lib/dashboard/navegacao";

/**
 * Permissões — o que cada papel enxerga e pode gravar.
 *
 * ============================================================================
 * ESTA TELA MOSTRA A REGRA. ELA NÃO EDITA A REGRA.
 *
 * Quem vê o quê está escrito em `lib/auth/papeis.ts`, em código, e isso é uma
 * escolha. Uma matriz de permissões editável pela tela parece mais flexível e
 * cobra caro: um toque errado numa célula abre a auditoria do campo inteiro
 * para um professor, sem que nada acuse, sem histórico e sem ninguém saber em
 * que momento aconteceu.
 *
 * A regra é da igreja e muda em reunião, não em terça-feira à tarde. O que muda
 * no dia a dia é QUEM ocupa cada cargo — e isso sim é editável, em
 * Administração → Liderança.
 *
 * O que esta tela resolve é a pergunta que ninguém conseguia responder antes:
 * "se eu der o cargo de Secretário Local a essa irmã, o que ela vai passar a
 * ver?" A resposta inteira, num quadro só, antes de fazer.
 * ============================================================================
 */

type Nivel = "gravar" | "ver" | "nao";

function nivelDe(papel: (typeof PAPEIS)[number], chave: string): Nivel {
  if (podeGravar([papel.papel], chave)) return "gravar";
  if (podeVer([papel.papel], chave)) return "ver";
  return "nao";
}

const LEGENDA: Record<Nivel, { rotulo: string; icone: typeof Check; classe: string }> = {
  gravar: { rotulo: "Vê e grava", icone: Pencil, classe: "text-emerald-300" },
  ver: { rotulo: "Só consulta", icone: Check, classe: "text-brand-200/70" },
  nao: { rotulo: "Não vê", icone: Minus, classe: "text-brand-200/20" },
};

export default function PermissoesPage() {
  const { papel: meuPapel } = useAcesso();
  const [destaque, setDestaque] = useState<string | null>(null);

  const papeis = [...PAPEIS].sort((a, b) => a.ordem - b.ordem);

  return (
    <>
      <CabecalhoModulo
        icone={KeyRound}
        titulo="Permissões"
        descricao="O que cada papel enxerga e o que pode gravar"
      />

      <Alert tipo="info" titulo="O papel vem do cargo — não de um cadastro à parte" className="mb-4">
        <p>
          Ninguém recebe um &quot;perfil de acesso&quot; nesta tela. O portal lê os{" "}
          <strong>cargos</strong> que a pessoa ocupa e daí decide o que ela vê. Para
          mudar o acesso de alguém, mude o cargo dela em{" "}
          <strong>Administração → Liderança</strong>.
        </p>
        <p className="mt-1.5">
          Assim o organograma da igreja e o sistema nunca discordam: quem deixa a
          função perde o acesso no mesmo ato.
        </p>
      </Alert>

      {/* ---------------- Os papéis ---------------- */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {papeis.map((p, i) => (
          <motion.button
            key={p.papel}
            type="button"
            onClick={() => setDestaque((a) => (a === p.papel ? null : p.papel))}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(i, 12) * 0.03 }}
            className={cn(
              "glass-panel rounded-2xl p-4 text-left transition-all duration-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60",
              destaque === p.papel
                ? "ring-1 ring-gold-400/40"
                : "hover:ring-1 hover:ring-white/12",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.92rem] text-white">{p.rotulo}</span>
              {meuPapel === p.papel && <Badge variant="alerta">o seu acesso</Badge>}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={p.escopo === "campo" ? "sucesso" : "neutro"}>
                {p.escopo === "campo" ? (
                  <>
                    <ShieldCheck className="h-3 w-3" />
                    Campo inteiro
                  </>
                ) : (
                  <>
                    <Building2 className="h-3 w-3" />
                    Só a própria congregação
                  </>
                )}
              </Badge>
            </div>

            <p className="mt-2 text-[0.76rem] leading-relaxed text-brand-200/60">
              {p.descricao}
            </p>
          </motion.button>
        ))}
      </div>

      {/* ---------------- Legenda ---------------- */}
      <div className="mb-3 flex flex-wrap items-center gap-4 px-1 text-[0.74rem] text-brand-200/60">
        {(Object.keys(LEGENDA) as Nivel[]).map((n) => {
          const { rotulo, icone: Icone, classe } = LEGENDA[n];
          return (
            <span key={n} className="inline-flex items-center gap-1.5">
              <Icone className={cn("h-3.5 w-3.5", classe)} />
              {rotulo}
            </span>
          );
        })}
      </div>

      {/*
        A tabela rola SOZINHA, dentro da própria caixa.
        Com nove papéis, ela é mais larga que um celular em qualquer arranjo — e
        deixar a página inteira rolar de lado faria o cabeçalho e o menu saírem
        de vista junto, que é como uma tabela grande estraga a tela toda.
      */}
      <div className="glass-panel overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[54rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-white/8">
              <th className="sticky left-0 z-10 bg-brand-950/80 px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-brand-200/60 backdrop-blur-xl">
                Módulo
              </th>
              {papeis.map((p) => (
                <th
                  key={p.papel}
                  className={cn(
                    "px-2 py-3 text-center text-[0.64rem] font-medium leading-tight text-brand-200/60 transition-colors duration-300",
                    destaque === p.papel && "bg-gold-400/[0.07] text-gold-200",
                  )}
                >
                  {p.rotulo}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {MENU_GRUPOS.map((grupo) => (
              <Fragment key={grupo.chave}>
                <tr className="border-b border-white/6 bg-white/[0.02]">
                  <td
                    colSpan={papeis.length + 1}
                    className="px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-brand-200/45"
                  >
                    {grupo.rotulo}
                  </td>
                </tr>

                {grupo.itens.map((item) => (
                  <tr
                    key={item.chave}
                    className="border-b border-white/5 transition-colors duration-300 last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="sticky left-0 z-10 bg-brand-950/80 px-4 py-2.5 text-[0.8rem] text-brand-50 backdrop-blur-xl">
                      {item.rotulo}
                      {item.emBreve && (
                        <span className="ml-2 rounded-full bg-white/6 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-wider text-brand-200/45">
                          em breve
                        </span>
                      )}
                    </td>

                    {papeis.map((p) => {
                      const nivel = nivelDe(p, item.chave);
                      const { rotulo, icone: Icone, classe } = LEGENDA[nivel];
                      return (
                        <td
                          key={p.papel}
                          className={cn(
                            "px-2 py-2.5 text-center transition-colors duration-300",
                            destaque === p.papel && "bg-gold-400/[0.07]",
                          )}
                        >
                          <Icone
                            aria-label={`${p.rotulo}: ${rotulo}`}
                            className={cn("mx-auto h-4 w-4", classe)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
