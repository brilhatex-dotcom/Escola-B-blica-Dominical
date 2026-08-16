/**
 * O catálogo de produtos da CPAD — a ponte entre a modalidade interna
 * (`categoria` + `tipo`, como já existe em `PrecoRevista`/`PedidoRevistaItem`)
 * e o código de produto que a CPAD Megastore Recife usa no formulário oficial
 * de pedido. Nenhuma dessas colunas existe no banco — o código, o texto de
 * "classe" e a faixa etária impressos no pedido consolidado são os mesmos do
 * formulário em branco que a CPAD fornece, então ficam fixos aqui, na ordem
 * exata da planilha oficial (para o pedido sair na mesma sequência que quem
 * recebe já está acostumado a conferir).
 */

export interface ItemCpad {
  categoria: string;
  tipo: string;
  codigo: number;
  classe: string;
  idade: string;
}

export const CATALOGO_CPAD: ItemCpad[] = [
  { categoria: "adultos", tipo: "aluno-comum", codigo: 9500, classe: "Adultos Aluno", idade: "A partir dos 18 anos" },
  { categoria: "adultos", tipo: "mestre-comum", codigo: 9550, classe: "Adultos Mestre", idade: "A partir dos 18 anos" },
  { categoria: "adultos", tipo: "aluno-ampliada", codigo: 140554, classe: "Adultos Aluno Ampliada", idade: "A partir dos 18 anos" },
  { categoria: "adultos", tipo: "mestre-ampliada", codigo: 140573, classe: "Adultos Mestre Ampliada", idade: "A partir dos 18 anos" },
  { categoria: "adultos", tipo: "mestre-capa-dura", codigo: 190744, classe: "Adultos Mestre Capa Dura", idade: "A partir dos 18 anos" },
  { categoria: "jovens", tipo: "aluno-comum", codigo: 9800, classe: "Jovens Aluno", idade: "A partir dos 18 anos" },
  { categoria: "jovens", tipo: "mestre-comum", codigo: 9850, classe: "Jovens Professor", idade: "A partir dos 18 anos" },
  { categoria: "juvenis", tipo: "aluno-comum", codigo: 9400, classe: "Juvenis Aluno", idade: "15 a 17 anos" },
  { categoria: "juvenis", tipo: "mestre-comum", codigo: 9450, classe: "Juvenis Mestre", idade: "15 a 17 anos" },
  { categoria: "adolesc", tipo: "aluno-comum", codigo: 9200, classe: "Adolescentes Aluno", idade: "13 a 14 anos" },
  { categoria: "adolesc", tipo: "mestre-comum", codigo: 9250, classe: "Adolescentes Mestre", idade: "13 a 14 anos" },
  { categoria: "preadolesc", tipo: "aluno-comum", codigo: 133733, classe: "Pré-Adolescentes Aluno", idade: "11 a 12 anos" },
  { categoria: "preadolesc", tipo: "mestre-comum", codigo: 133753, classe: "Pré-Adolescentes Mestre", idade: "11 a 12 anos" },
  { categoria: "juniores", tipo: "aluno-comum", codigo: 9100, classe: "Juniores Aluno", idade: "9 a 10 anos" },
  { categoria: "juniores", tipo: "mestre-comum", codigo: 9150, classe: "Juniores Mestre", idade: "9 a 10 anos" },
  { categoria: "juniores", tipo: "visual", codigo: 122234, classe: "Juniores Visual", idade: "9 a 10 anos" },
  { categoria: "primarios", tipo: "aluno-comum", codigo: 9000, classe: "Primários Aluno", idade: "7 a 8 anos" },
  { categoria: "primarios", tipo: "mestre-comum", codigo: 9050, classe: "Primários Mestre", idade: "7 a 8 anos" },
  { categoria: "primarios", tipo: "visual", codigo: 122233, classe: "Primários Visual", idade: "7 a 8 anos" },
  { categoria: "jardim", tipo: "aluno-comum", codigo: 9300, classe: "Jardim de Infância Aluno", idade: "5 a 6 anos" },
  { categoria: "jardim", tipo: "mestre-comum", codigo: 9350, classe: "Jardim de Infância Mestre", idade: "5 a 6 anos" },
  { categoria: "jardim", tipo: "visual", codigo: 122228, classe: "Jardim de Infância Visual", idade: "5 a 6 anos" },
  { categoria: "maternal", tipo: "aluno-comum", codigo: 9700, classe: "Maternal Aluno", idade: "3 a 4 anos" },
  { categoria: "maternal", tipo: "mestre-comum", codigo: 9750, classe: "Maternal Mestre", idade: "3 a 4 anos" },
  { categoria: "maternal", tipo: "visual", codigo: 122227, classe: "Maternal Visual", idade: "3 a 4 anos" },
  { categoria: "bercario", tipo: "manual-mestre", codigo: 133713, classe: "Berçário Mestre", idade: "0 a 2 anos" },
  { categoria: "bercario", tipo: "visual", codigo: 122235, classe: "Berçário Visual", idade: "0 a 2 anos" },
  { categoria: "apoio", tipo: "ensinador-cristao", codigo: 6400, classe: "Revista Ensinador Cristão", idade: "Trimestral" },
  { categoria: "apoio", tipo: "obreiro-aprovado", codigo: 9950, classe: "Revista Obreiro Aprovado", idade: "Trimestral" },
  { categoria: "apoio", tipo: "livro-apoio", codigo: 374897, classe: "Livro de Apoio da Lição", idade: "Adultos" },
  { categoria: "apoio", tipo: "devocional", codigo: 991001, classe: "Devocional de Leitura Diária", idade: "Adultos" },
];

/** O desconto padrão da CPAD sobre o valor bruto — o mesmo `× 0.7` do formulário oficial. */
export const FATOR_LIQUIDO_CPAD = 0.7;
