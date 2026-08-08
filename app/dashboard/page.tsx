"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { GraduationCap, School, UserRoundCheck, Users } from "lucide-react";
import { AgendaCard } from "@/components/dashboard/AgendaCard";
import { BirthdayCard } from "@/components/dashboard/BirthdayCard";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DestaqueCard } from "@/components/dashboard/DestaqueCard";
import { LeadershipCard } from "@/components/dashboard/LeadershipCard";
import { StructureStrip } from "@/components/dashboard/StructureStrip";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { Saudacao } from "@/components/dashboard/Saudacao";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { SystemStatus } from "@/components/dashboard/SystemStatus";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcesso } from "@/components/acesso/AcessoProvider";
import { carregarPainel } from "@/lib/dashboard/dados";
import type { ChaveIndicador, DadosPainel } from "@/lib/dashboard/tipos";

/**
 * Dashboard — o centro de comando da Escola Biblica Dominical.
 *
 * A ORDEM DOS BLOCOS RESPONDE, NESTA SEQUENCIA, AS QUATRO PERGUNTAS DE QUEM
 * ACABOU DE ENTRAR:
 *
 *   1. Que dia e hoje, e o que se estuda?   -> saudacao, versiculo, licao
 *   2. Como esta a EBD?                     -> os quatro numeros
 *   3. Como esta HOJE?                      -> resumo do domingo (a direita)
 *   4. O que aconteceu agora ha pouco?      -> atividades, aniversarios, agenda
 *
 * Em telas grandes o resumo do domingo fica na coluna da direita, ao lado do
 * grafico — e a informacao mais perecivel do painel e nao pode exigir rolagem
 * num domingo de manha.
 */

/*
 * O grafico entra sob demanda, fora do pacote inicial.
 *
 * O Recharts pesa mais que todo o resto do painel somado, e nada nele e
 * necessario para a primeira leitura da tela. Carregando junto, a igreja
 * esperaria o download completo para ver quatro numeros que ja estao prontos.
 * `ssr: false` porque o grafico mede o container: sem largura no servidor, ele
 * renderiza vazio e o cliente teria de refazer tudo na hidratacao.
 */
const ChartCard = dynamic(
  () => import("@/components/dashboard/ChartCard").then((m) => m.ChartCard),
  {
    ssr: false,
    loading: () => (
      <div className="glass-panel rounded-2xl p-5 sm:p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-64" />
        <Skeleton className="mt-5 h-[17rem] w-full sm:h-[19rem]" />
      </div>
    ),
  },
);

const ICONES: Record<ChaveIndicador, typeof Users> = {
  alunos: GraduationCap,
  classes: School,
  presentes: UserRoundCheck,
  visitantes: Users,
};

export default function DashboardPage() {
  const [dados, setDados] = useState<DadosPainel | null>(null);
  const [hoje, setHoje] = useState<Date | undefined>(undefined);
  const { sessao } = useAcesso();
  // Equipe e Estrutura, e Atividades Recentes, são informação de quem
  // administra o campo — uma secretária de congregação não precisa saber
  // quantos professores o campo inteiro tem, nem o que mudou em cadastros que
  // não são o dela. Pedido explícito da liderança: os dois cartões ficam só
  // para quem enxerga o campo inteiro (`escopo === "campo"`).
  const ehAdministracaoDoCampo = sessao?.escopo === "campo";

  useEffect(() => {
    // `hoje` so no cliente: o servidor esta em UTC e marcaria o aniversariante
    // errado para quem esta em Pernambuco depois das 21h.
    setHoje(new Date());
    void carregarPainel().then(setDados);
  }, []);

  if (!dados) return <EsqueletoDoPainel />;

  return (
    <>
      <Saudacao
        nome={dados.usuario.nome}
        versiculo={dados.versiculo}
        licao={dados.resumo.licao}
      />

      {/*
        AVISO DE DEMONSTRACAO.

        Aparece quando `/api/painel` nao conseguiu falar com o Postgres e a tela
        caiu no conjunto de exemplo. Sem ele, o painel mostraria numeros
        inventados com a mesma cara dos numeros reais — e alguem fecharia o
        relatorio do domingo com eles.
      */}
      {dados.origem === "exemplo" && (
        <Alert tipo="alerta" titulo="Dados de demonstração" className="mb-4">
          <p>
            Estes números são de exemplo — <strong>não são a chamada de hoje</strong>.
          </p>
          {/*
            O QUE FAZER, e nao so o que aconteceu.

            "O banco não respondeu" e verdadeiro e inutil: as duas causas
            possiveis se resolvem em lugares diferentes — uma no painel da
            Vercel, outra no SQL Editor do Neon. Sem distinguir, so resta
            tentar as duas as cegas.
          */}
          {dados.causa === "sem-variavel" && (
            <p className="mt-1.5">
              O endereço do banco não foi encontrado. Confira, nas variáveis de
              ambiente da Vercel, se existe alguma terminando em{" "}
              <code className="rounded bg-white/8 px-1">DATABASE_URL</code> ou{" "}
              <code className="rounded bg-white/8 px-1">POSTGRES_PRISMA_URL</code>.
            </p>
          )}
          {dados.causa === "sem-tabelas" && (
            <p className="mt-1.5">
              O banco respondeu, mas as tabelas de pessoas e cargos ainda não
              existem. Aplique{" "}
              <code className="rounded bg-white/8 px-1">prisma/aplicar-fase-05.sql</code>{" "}
              no SQL Editor do Neon — leva um minuto e pode ser feito com o
              sistema no ar.
            </p>
          )}
          {(dados.causa === "outro" || dados.causa === undefined) && (
            <p className="mt-1.5">
              A conexão com o banco falhou. Assim que ela voltar, o painel passa
              a mostrar os dados reais sozinho.
            </p>
          )}
        </Alert>
      )}

      {/* ---------------- Os quatro numeros ---------------- */}
      <section aria-label="Indicadores da Escola Bíblica" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dados.indicadores.map((ind, i) => (
          <DashboardCard
            key={ind.chave}
            indicador={ind}
            icone={ICONES[ind.chave]}
            indice={i}
          />
        ))}
      </section>

      {/* ---------------- Equipe e estrutura (só administração do campo) ---------------- */}
      {ehAdministracaoDoCampo && <StructureStrip estrutura={dados.estrutura} className="mt-4" />}

      {/* ----------------------------------------------------------------
        Grafico + coluna da direita.

        A quebra e em `xl` (1280px), e nao `lg`: num notebook de 1366px com o
        menu aberto sobram ~1090px, e dividir isso em duas colunas deixaria o
        grafico com menos de 700px — estreito demais para sete meses de dados
        sem os rotulos do eixo se atropelarem.
        ---------------------------------------------------------------- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <ChartCard dados={dados.frequencia} />
        <SummaryCard resumo={dados.resumo} />
      </div>

      {/* ---------------- Atividades, aniversarios e agenda ---------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/*
          A lideranca vem ANTES das atividades: e informacao institucional,
          estavel, que responde "quem responde por isto aqui" — pergunta que
          alguem faz uma vez e nao volta a fazer. As atividades recentes mudam o
          tempo todo e sao consultadas de relance.
        */}
        <LeadershipCard lideranca={dados.lideranca} />
        <DestaqueCard destaques={dados.destaques} />
        {ehAdministracaoDoCampo && <RecentActivity atividades={dados.atividades} />}
        <BirthdayCard aniversariantes={dados.aniversariantes} hoje={hoje} />
        <AgendaCard agenda={dados.agenda} />

        {/*
          O estado do sistema aparece duas vezes de proposito: em miniatura no
          cabecalho, sempre visivel, e por extenso aqui. A versao compacta
          responde "estou online?"; esta responde "o que esta acontecendo com
          os meus dados?", que e outra pergunta e precisa de espaco.
        */}
        <SystemStatus variante="detalhado" className="lg:col-span-2 xl:col-span-2" />
      </div>
    </>
  );
}

/**
 * Espera do primeiro carregamento.
 *
 * As medidas acompanham o conteudo real — 4 cartoes, grafico, coluna lateral.
 * Um esqueleto de tamanho diferente do que vai entrar empurra a tela quando os
 * dados chegam, e a pessoa clica no lugar errado; nesse caso e melhor nao ter
 * esqueleto nenhum.
 */
function EsqueletoDoPainel() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando o painel…</span>

      <Skeleton className="h-8 w-72" />
      <Skeleton className="mt-2 h-4 w-56" />

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-[6.5rem] rounded-2xl" />
        <Skeleton className="h-[6.5rem] rounded-2xl" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[12.5rem] rounded-2xl" />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Skeleton className="h-[26rem] rounded-2xl" />
        <Skeleton className="h-[26rem] rounded-2xl" />
      </div>
    </div>
  );
}
