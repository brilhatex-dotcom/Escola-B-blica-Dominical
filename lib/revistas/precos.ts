/**
 * Categorias e preços das revistas CPAD — usado pelo cálculo automático
 * (sugestão) e pela tela de Fazer Pedido. Um lugar só, para as duas telas
 * nunca divergirem sobre "qual é o preço do professor de Adultos".
 */

export function normalizarCategoria(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

// "Obreiros" e "Jovens e Adultos" (a categoria juntada) ficam fora da lista
// principal: Jovens e Adultos são classes SEPARADAS, com preços próprios.
export const CATEGORIAS_OCULTAS = new Set(["obreiros", "jovenadult"]);

// Nome de exibição e ordem preferida — a lista que a secretaria usa.
export const NOME_CATEGORIA: Record<string, string> = {
  bercario: "Berçário",
  maternal: "Maternal",
  jardim: "Jardim de Infância",
  primarios: "Primários",
  juniores: "Juniores",
  preadolesc: "Pré-Adolescentes",
  adolesc: "Adolescentes",
  juvenis: "Juvenis",
  jovens: "Jovens",
  adultos: "Adultos",
};
export const ORDEM_CATEGORIAS = Object.keys(NOME_CATEGORIA);

export interface LinhaPreco {
  key: string;
  label: string;
  preco: number;
}

export function agruparPrecos(precos: { key: string; categoria: string; label: string; preco: number }[]) {
  const porCategoria = new Map<string, LinhaPreco[]>();
  for (const p of precos) {
    const cat = normalizarCategoria(p.categoria);
    const lista = porCategoria.get(cat) ?? [];
    lista.push({ key: p.key, label: p.label, preco: p.preco });
    porCategoria.set(cat, lista);
  }
  return porCategoria;
}

/** Revista do Aluno, capa comum — a referência de preço por categoria. */
export function precoAlunoDeLista(lista: LinhaPreco[]): number | null {
  const comum = lista.find((x) => x.key === "aluno-comum");
  if (comum) return comum.preco;
  const candidatos = lista.filter((x) => x.key.startsWith("aluno")).sort((a, b) => a.preco - b.preco);
  return candidatos[0]?.preco ?? null;
}

/**
 * Revista/Manual do Professor por categoria.
 *
 * Berçário é o caso especial: a tabela de preços real só tem uma linha para
 * ele, `manual-mestre` — "Berçário — Manual do Mestre", R$ 18 — e não uma
 * `mestre-comum` como as outras categorias. Usar `.includes("mestre")` em vez
 * de `.startsWith("mestre")` pega as duas formas sem inventar preço nenhum:
 * o valor já existia na tabela, só não era procurado do jeito certo.
 */
export function precoProfessorDeLista(lista: LinhaPreco[]): number | null {
  const comum = lista.find((x) => x.key === "mestre-comum" || x.key === "manual-mestre");
  if (comum) return comum.preco;
  const candidatos = lista.filter((x) => x.key.includes("mestre")).sort((a, b) => a.preco - b.preco);
  return candidatos[0]?.preco ?? null;
}
