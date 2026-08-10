/**
 * Categorias e preços das revistas CPAD — usado pelo cálculo automático
 * (sugestão) e pela tela de Fazer Pedido. Um lugar só, para as duas telas
 * nunca divergirem sobre "qual é o preço do professor de Adultos".
 */

export function normalizarCategoria(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

// "Obreiros" e "Jovens e Adultos" (a categoria juntada) ficam fora da lista
// principal: Jovens e Adultos são classes SEPARADAS, com preços próprios. As
// duas nunca entraram em `NOME_CATEGORIA` (abaixo) — por isso nunca apareceram
// como categoria pedível no assistente; `CATEGORIAS_OCULTAS` só as tira da
// mini-tabela de preços do painel financeiro, que lê `PrecoRevista` direto.
export const CATEGORIAS_OCULTAS = new Set(["obreiros", "jovenadult"]);

// Nome de exibição e ordem preferida — a lista que a secretaria usa.
//
// "apoio" é diferente das outras dez: não é uma faixa etária, é material
// extra que qualquer congregação pode pedir sem ter uma classe própria para
// ele (Revista Ensinador Cristão, Obreiro Aprovado, Livro de Apoio da Lição,
// Devocional). Continua DENTRO desta lista (ao contrário de obreiros/
// jovenadult) para aparecer como categoria pedível no assistente — como
// nenhuma classe tem essa categoria, ele cai sozinho em "outras categorias".
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
  apoio: "Material de Apoio",
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

/**
 * Qual `key`, dentro do grupo (aluno ou professor), é a REFERÊNCIA — a
 * mesma escolha que `precoAlunoDeLista`/`precoProfessorDeLista` fazem, só
 * devolvendo a chave em vez do preço. É essa chave, e só ela, que recebe a
 * quantidade sugerida (matriculados/professores cadastrados): as outras
 * variantes (Ampliada, Capa Dura) são upgrade opcional, e repetir a mesma
 * sugestão nas três faria parecer que dá para pedir oito de cada.
 */
export function chaveDeReferencia(lista: LinhaPreco[], grupo: "aluno" | "professor"): string | null {
  if (grupo === "aluno") {
    if (lista.some((x) => x.key === "aluno-comum")) return "aluno-comum";
    const candidatos = lista.filter((x) => x.key.startsWith("aluno")).sort((a, b) => a.preco - b.preco);
    return candidatos[0]?.key ?? null;
  }
  if (lista.some((x) => x.key === "mestre-comum")) return "mestre-comum";
  if (lista.some((x) => x.key === "manual-mestre")) return "manual-mestre";
  const candidatos = lista.filter((x) => x.key.includes("mestre")).sort((a, b) => a.preco - b.preco);
  return candidatos[0]?.key ?? null;
}

/**
 * A que grupo uma modalidade pertence — usado só para casar com "quantos
 * alunos/professores estão cadastrados" (a quantidade sugerida). Uma
 * modalidade "extra" (Ampliada, Capa Dura, Visual) continua pedida do
 * Aluno ou do Professor — o cadastro não distingue quem prefere letra maior,
 * então a sugestão vale para as duas. Modalidades sem grupo (Visual, e os
 * itens de "apoio") não têm de onde vir uma sugestão automática — a pessoa
 * digita à mão, como sempre foi para tudo que não é revista de aluno/mestre.
 */
export function grupoDoTipo(key: string): "aluno" | "professor" | null {
  if (key.startsWith("aluno")) return "aluno";
  if (key.startsWith("mestre") || key === "manual-mestre") return "professor";
  return null;
}

/**
 * O texto curto de uma linha do pedido — "Aluno — Letra Ampliada", "Revista
 * Ensinador Cristão" — a partir do `label` completo da tabela de preços
 * ("Adultos — Aluno — Letra Ampliada"). Tira o prefixo da categoria, que o
 * card já mostra no cabeçalho; sem prefixo (os itens de apoio, que não
 * repetem a categoria no label), devolve o label inteiro.
 */
export function rotuloDaLinha(categoriaRotulo: string, label: string): string {
  const prefixo = `${categoriaRotulo} — `;
  return label.startsWith(prefixo) ? label.slice(prefixo.length) : label;
}
