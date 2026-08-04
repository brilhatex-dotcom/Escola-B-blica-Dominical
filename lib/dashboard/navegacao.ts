import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  GraduationCap,
  Home,
  School,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * O menu do sistema, declarado em um lugar so.
 *
 * A Sidebar, o menu do celular e a busca global leem TODOS desta lista. Se cada
 * um tivesse a sua copia, um modulo novo entraria em dois lugares e faltaria no
 * terceiro — que e sempre o que ninguem testa.
 */

export interface ItemMenu {
  /** Identificador estavel; nao muda quando o rotulo muda. */
  chave: string;
  rotulo: string;
  href: string;
  icone: LucideIcon;
  /** Texto curto usado na busca global e no `title` do link recolhido. */
  descricao: string;
  /**
   * Modulo ainda nao construido.
   *
   * O link continua existindo e navegavel — a tela responde "em construção" em
   * vez de dar 404. Esconder o item seria pior: o usuario nao faz ideia do que
   * o sistema vai ter, e cada fase entregue parece um produto diferente.
   */
  emBreve?: boolean;
}

export const MENU: readonly ItemMenu[] = [
  { chave: "dashboard", rotulo: "Dashboard", href: "/dashboard", icone: Home, descricao: "Visão geral da Escola Bíblica" },
  { chave: "chamada", rotulo: "Chamada", href: "/dashboard/chamada", icone: BookOpen, descricao: "Marcar presença das classes" },
  { chave: "alunos", rotulo: "Alunos", href: "/dashboard/alunos", icone: GraduationCap, descricao: "Matrículas e cadastro de alunos" },
  { chave: "professores", rotulo: "Professores", href: "/dashboard/professores", icone: UserRound, descricao: "Pessoas e cargos — cadastro único" },
  { chave: "classes", rotulo: "Classes", href: "/dashboard/classes", icone: School, descricao: "Classes por faixa e congregação" },
  { chave: "visitantes", rotulo: "Visitantes", href: "/dashboard/visitantes", icone: Users, descricao: "Visitantes recebidos" },
  { chave: "relatorios", rotulo: "Relatórios", href: "/dashboard/relatorios", icone: ChartColumn, descricao: "Frequência, ofertas e estatísticas", emBreve: true },
  { chave: "agenda", rotulo: "Agenda", href: "/dashboard/agenda", icone: CalendarDays, descricao: "Cultos, EBD e eventos", emBreve: true },
  { chave: "configuracoes", rotulo: "Configurações", href: "/dashboard/configuracoes", icone: Settings, descricao: "Parâmetros, usuários e permissões", emBreve: true },
];

/**
 * Qual item esta ativo para um dado caminho.
 *
 * O prefixo importa: `/dashboard/alunos/12` tem de acender "Alunos". A excecao
 * e a propria raiz, que so acende em igualdade exata — senao ela ficaria acesa
 * em todas as telas do sistema.
 */
export function itemAtivo(caminho: string): string {
  if (caminho === "/dashboard") return "dashboard";
  const achado = MENU.find(
    (i) => i.href !== "/dashboard" && caminho.startsWith(i.href),
  );
  return achado?.chave ?? "dashboard";
}
