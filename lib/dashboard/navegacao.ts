import {
  Award,
  BadgeCheck,
  Bell,
  BookMarked,
  BookOpen,
  Building2,
  CakeSlice,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Cloud,
  CloudOff,
  Database,
  FileText,
  GraduationCap,
  Home,
  KeyRound,
  Network,
  PartyPopper,
  School,
  ScrollText,
  Settings,
  ShieldCheck,
  Sliders,
  TriangleAlert,
  Trophy,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { podeVer, type Papel } from "@/lib/auth/papeis";

/**
 * O menu do sistema, declarado em um lugar só.
 *
 * A Sidebar, a gaveta do celular, a busca global e a tela de "em construção"
 * leem TODOS desta lista. Se cada um tivesse a sua cópia, um módulo novo
 * entraria em dois lugares e faltaria no terceiro — que é sempre o que ninguém
 * testa.
 *
 * ============================================================================
 * A CHAVE DO ITEM É TAMBÉM A CHAVE DA PERMISSÃO
 *
 * `lib/auth/papeis.ts` diz quais chaves cada papel enxerga, e são exatamente
 * estas. Não existe uma segunda lista de "módulos permitidos" para manter em
 * dia: um módulo novo aparece aqui e, no mesmo instante, já existe o lugar onde
 * dizer quem pode vê-lo. Duas listas separadas divergem — e divergem calando,
 * liberando ou escondendo sem que ninguém perceba.
 * ============================================================================
 */

export interface ItemMenu {
  /** Identificador estável e chave da permissão; não muda quando o rótulo muda. */
  chave: string;
  rotulo: string;
  href: string;
  icone: LucideIcon;
  /** Texto curto usado na busca global e no `title` do link recolhido. */
  descricao: string;
  /**
   * Módulo ainda não construído.
   *
   * O link continua existindo e navegável — a tela responde "em construção" em
   * vez de dar 404. Esconder o item seria pior: o usuário não faz ideia do que
   * o sistema vai ter, e cada fase entregue parece um produto diferente.
   */
  emBreve?: boolean;
}

export interface GrupoMenu {
  chave: string;
  rotulo: string;
  icone: LucideIcon;
  itens: readonly ItemMenu[];
  /**
   * Grupo de um item só, mostrado sem cabeçalho de seção.
   * O Dashboard é isso: uma categoria com um destino, e escrever "DASHBOARD"
   * acima de um item chamado "Dashboard" é ruído.
   */
  solo?: boolean;
}

export const MENU_GRUPOS: readonly GrupoMenu[] = [
  {
    chave: "principal",
    rotulo: "Dashboard",
    icone: Home,
    solo: true,
    itens: [
      {
        chave: "dashboard",
        rotulo: "Dashboard",
        href: "/dashboard",
        icone: Home,
        descricao: "Visão geral da Escola Bíblica",
      },
    ],
  },

  {
    chave: "ebd",
    rotulo: "Escola Bíblica",
    icone: BookOpen,
    itens: [
      {
        chave: "congregacoes",
        rotulo: "Congregações",
        href: "/dashboard/congregacoes",
        icone: Building2,
        descricao: "Cada congregação com o seu dirigente e vice-dirigente",
      },
      {
        chave: "chamada",
        rotulo: "Chamada",
        href: "/dashboard/chamada",
        icone: ClipboardList,
        descricao: "Marcar presença das classes",
      },
      {
        chave: "alunos",
        rotulo: "Alunos",
        href: "/dashboard/alunos",
        icone: GraduationCap,
        descricao: "Matrículas e cadastro de alunos",
      },
      /*
       * Classes NÃO estava na lista de categorias pedida, e mesmo assim está
       * aqui: são 53 classes cadastradas, e a Chamada, os Alunos e todos os
       * relatórios dependem delas. Tirar do menu não apagaria os dados, mas
       * deixaria a secretaria sem como corrigir uma classe — um módulo que
       * funciona hoje ficaria invisível de um dia para o outro.
       */
      {
        chave: "classes",
        rotulo: "Classes",
        href: "/dashboard/classes",
        icone: School,
        descricao: "Classes por faixa etária e congregação",
      },
      {
        chave: "professores",
        rotulo: "Professores",
        href: "/dashboard/professores",
        icone: UserRound,
        descricao: "Pessoas e cargos — cadastro único",
      },
      {
        chave: "visitantes",
        rotulo: "Visitantes",
        href: "/dashboard/visitantes",
        icone: Users,
        descricao: "Visitantes recebidos nas classes",
      },
      {
        chave: "aniversariantes",
        rotulo: "Aniversariantes",
        href: "/dashboard/aniversariantes",
        icone: CakeSlice,
        descricao: "Aniversários do mês, por congregação e classe",
      },
      {
        chave: "licoes",
        rotulo: "Lições",
        href: "/dashboard/licoes",
        icone: BookMarked,
        descricao: "Lições do trimestre e o que cada classe ministrou",
      },
      {
        chave: "revistas",
        rotulo: "Pedido de Revistas",
        href: "/dashboard/revistas",
        icone: ScrollText,
        descricao: "Pedidos de revistas por classe, com os preços do campo",
      },
    ],
  },

  {
    chave: "administracao",
    rotulo: "Administração",
    icone: ShieldCheck,
    itens: [
      {
        chave: "admin-congregacoes",
        rotulo: "Congregações",
        href: "/dashboard/admin/congregacoes",
        icone: Building2,
        descricao: "Cadastro das congregações do campo",
        emBreve: true,
      },
      /*
       * Liderança aponta para a tela que JÁ existe e já faz exatamente isto
       * (trocar quem ocupa cada cargo). Criar um endereço novo e abandonar o
       * antigo quebraria os atalhos que a secretaria já salvou, sem entregar
       * nada em troca.
       */
      {
        chave: "lideranca",
        rotulo: "Liderança",
        href: "/dashboard/configuracoes",
        icone: BadgeCheck,
        descricao: "Quem ocupa cada cargo do campo",
      },
      {
        chave: "hierarquia",
        rotulo: "Hierarquia",
        href: "/dashboard/hierarquia",
        icone: Network,
        descricao: "O organograma do campo, do Pastor às classes",
        emBreve: true,
      },
      {
        chave: "usuarios",
        rotulo: "Usuários",
        href: "/dashboard/usuarios",
        icone: UsersRound,
        descricao: "Contas de acesso e o papel de cada uma",
      },
      {
        chave: "permissoes",
        rotulo: "Permissões",
        href: "/dashboard/permissoes",
        icone: KeyRound,
        descricao: "O que cada papel enxerga e pode gravar",
      },
      {
        chave: "escalas",
        rotulo: "Escalas",
        href: "/dashboard/escalas",
        icone: CalendarRange,
        descricao: "Escalas de culto do mês",
        emBreve: true,
      },
    ],
  },

  {
    chave: "relatorios",
    rotulo: "Relatórios",
    icone: FileText,
    itens: [
      {
        chave: "rel-frequencia",
        rotulo: "Frequência",
        href: "/dashboard/relatorios",
        icone: FileText,
        descricao: "Frequência por classe e ofertas do período",
      },
      {
        chave: "rel-ranking",
        rotulo: "Ranking",
        href: "/dashboard/relatorios/ranking",
        icone: Trophy,
        descricao: "Ranking por congregação, por classe e por frequência",
        emBreve: true,
      },
      {
        chave: "rel-faltas",
        rotulo: "Alerta de Faltas",
        href: "/dashboard/relatorios/faltas",
        icone: TriangleAlert,
        descricao: "Alunos faltando há domingos seguidos",
        emBreve: true,
      },
      {
        chave: "rel-ficha",
        rotulo: "Ficha do Aluno",
        href: "/dashboard/relatorios/ficha",
        icone: ClipboardList,
        descricao: "Histórico completo de um aluno",
        emBreve: true,
      },
      {
        chave: "rel-certificados",
        rotulo: "Certificados",
        href: "/dashboard/relatorios/certificados",
        icone: Award,
        descricao: "Certificados de frequência e conclusão",
        emBreve: true,
      },
      {
        chave: "rel-auditoria",
        rotulo: "Auditoria",
        href: "/dashboard/relatorios/auditoria",
        icone: ScrollText,
        descricao: "O que foi criado, alterado e apagado no sistema",
        emBreve: true,
      },
    ],
  },

  {
    chave: "agenda",
    rotulo: "Agenda",
    icone: CalendarDays,
    itens: [
      {
        chave: "agenda-calendario",
        rotulo: "Calendário",
        href: "/dashboard/agenda",
        icone: CalendarDays,
        descricao: "Cultos, EBD e eventos numa linha do tempo",
      },
      {
        chave: "agenda-eventos",
        rotulo: "Eventos",
        href: "/dashboard/agenda/eventos",
        icone: PartyPopper,
        descricao: "Eventos do campo e das congregações",
        emBreve: true,
      },
      {
        chave: "agenda-avisos",
        rotulo: "Avisos",
        href: "/dashboard/agenda/avisos",
        icone: Bell,
        descricao: "Avisos publicados, com prioridade e validade",
        emBreve: true,
      },
      {
        chave: "agenda-reunioes",
        rotulo: "Reuniões",
        href: "/dashboard/agenda/reunioes",
        icone: UsersRound,
        descricao: "Reuniões com lista de presença",
        emBreve: true,
      },
    ],
  },

  {
    chave: "configuracoes",
    rotulo: "Configurações",
    icone: Settings,
    itens: [
      {
        chave: "cfg-sistema",
        rotulo: "Sistema",
        href: "/dashboard/configuracoes/sistema",
        icone: Sliders,
        descricao: "Parâmetros do portal e do campo",
        emBreve: true,
      },
      {
        chave: "cfg-backup",
        rotulo: "Backup",
        href: "/dashboard/configuracoes/backup",
        icone: Database,
        descricao: "Cópia de segurança dos dados",
        emBreve: true,
      },
      {
        chave: "cfg-sincronizacao",
        rotulo: "Sincronização",
        href: "/dashboard/configuracoes/sincronizacao",
        icone: Cloud,
        descricao: "Fila de envio e estado da sincronização",
        emBreve: true,
      },
      {
        chave: "cfg-offline",
        rotulo: "Offline",
        href: "/dashboard/configuracoes/offline",
        icone: CloudOff,
        descricao: "O que está guardado neste aparelho",
        emBreve: true,
      },
      {
        chave: "cfg-logs",
        rotulo: "Logs",
        href: "/dashboard/configuracoes/logs",
        icone: ScrollText,
        descricao: "Quem entrou e o que fez, com data e hora",
        emBreve: true,
      },
    ],
  },
];

/** Todos os itens, achatados. Para a busca global e a tela de "em construção". */
export const MENU: readonly ItemMenu[] = MENU_GRUPOS.flatMap((g) => g.itens);

/**
 * O menu visível para um acesso.
 *
 * Grupo que ficou sem nenhum item some inteiro — um cabeçalho "Administração"
 * sozinho, sem nada embaixo, anuncia à pessoa exatamente o que ela não pode
 * ver e faz o menu parecer quebrado.
 *
 * Sem papéis (autenticação desligada no servidor) o menu aparece inteiro. É
 * coerente com o resto do portal: sem `AUTH_SECRET` não há sessão para
 * consultar, e esconder telas daria impressão de proteção onde não há nenhuma —
 * a tarja vermelha do painel é que diz a verdade.
 */
export function menuVisivel(papeis: readonly Papel[] | null): readonly GrupoMenu[] {
  if (!papeis || papeis.length === 0) return MENU_GRUPOS;

  return MENU_GRUPOS.map((g) => ({
    ...g,
    itens: g.itens.filter((i) => podeVer(papeis, i.chave)),
  })).filter((g) => g.itens.length > 0);
}

/**
 * Qual item está ativo para um dado caminho.
 *
 * Vence o href MAIS LONGO que casa. Sem isso, `/dashboard/relatorios/ranking`
 * acenderia "Frequência" (cujo href `/dashboard/relatorios` também é prefixo) e
 * o menu apontaria para a tela errada justamente nas subtelas.
 */
export function itemAtivo(caminho: string): string {
  if (caminho === "/dashboard") return "dashboard";

  let melhor: ItemMenu | null = null;
  for (const item of MENU) {
    if (item.href === "/dashboard") continue;
    if (caminho === item.href || caminho.startsWith(`${item.href}/`)) {
      if (!melhor || item.href.length > melhor.href.length) melhor = item;
    }
  }
  return melhor?.chave ?? "dashboard";
}

/** O grupo a que um item pertence — a Sidebar usa para abrir a seção certa. */
export function grupoDoItem(chave: string): string | null {
  return MENU_GRUPOS.find((g) => g.itens.some((i) => i.chave === chave))?.chave ?? null;
}
