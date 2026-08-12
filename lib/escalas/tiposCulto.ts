/**
 * A legenda de tipos de culto — os mesmos códigos numéricos que a escala
 * oficial do campo já usa em papel ("02" = Pregação, "34" = Leitura no
 * C.O.A…). O código sai gravado em `EscalaItem.tipoCodigo`; o rótulo mora
 * só aqui, para poder corrigir um texto sem migrar dado nenhum.
 *
 * A numeração tem buracos (falta 11, 26, 38, 39, 45, 46, 49, 51-57, 60, 64) —
 * são os mesmos buracos da lista oficial em papel, não um erro de digitação
 * daqui. Um código que a lista em papel não usa também não precisa existir
 * nesta tabela.
 */
export interface TipoCulto {
  codigo: number;
  rotulo: string;
}

export const TIPOS_CULTO: readonly TipoCulto[] = [
  { codigo: 1, rotulo: "Oração" },
  { codigo: 2, rotulo: "Pregação" },
  { codigo: 3, rotulo: "Santa Ceia" },
  { codigo: 4, rotulo: "Doutrina" },
  { codigo: 5, rotulo: "Administrativo" },
  { codigo: 6, rotulo: "Estudo Bíblico" },
  { codigo: 7, rotulo: "Aniversário de Campanha" },
  { codigo: 8, rotulo: "Aviva Jovem" },
  { codigo: 9, rotulo: "Aniversário do Órgão de Louvor" },
  { codigo: 10, rotulo: "Culto para Mocidade" },
  { codigo: 12, rotulo: "Culto de Louvor" },
  { codigo: 13, rotulo: "Manhã Missionária" },
  { codigo: 14, rotulo: "Culto Evangelístico" },
  { codigo: 15, rotulo: "Aniversário do Círculo de Oração" },
  { codigo: 16, rotulo: "Aniversário do Templo" },
  { codigo: 17, rotulo: "Culto de Missões" },
  { codigo: 18, rotulo: "Estudo para Casais" },
  { codigo: 19, rotulo: "Festa da Mocidade" },
  { codigo: 20, rotulo: "Estudo para Adolescentes" },
  { codigo: 21, rotulo: "Encontro de Jovens" },
  { codigo: 22, rotulo: "Oração e Jejum" },
  { codigo: 23, rotulo: "Simpósio" },
  { codigo: 24, rotulo: "Culto de Reencontro" },
  { codigo: 25, rotulo: "Projeférias" },
  { codigo: 27, rotulo: "Consagração Geral" },
  { codigo: 28, rotulo: "Batismo em Águas" },
  { codigo: 29, rotulo: "Pré-Congresso" },
  { codigo: 30, rotulo: "Conferência Missionária" },
  { codigo: 31, rotulo: "Congresso Jovem" },
  { codigo: 32, rotulo: "Congresso de Adolescentes" },
  { codigo: 33, rotulo: "Congresso de Mulheres" },
  { codigo: 34, rotulo: "Leitura no C.O.A" },
  { codigo: 35, rotulo: "Culto de Ações de Graças" },
  { codigo: 36, rotulo: "Escola Animada" },
  { codigo: 37, rotulo: "Cruzada" },
  { codigo: 40, rotulo: "Evangelismo" },
  { codigo: 41, rotulo: "Formatura do Discipulado" },
  { codigo: 42, rotulo: "Vigília de Ano" },
  { codigo: 43, rotulo: "Festa do Conjunto Infantil" },
  { codigo: 44, rotulo: "Festa do Juvenil" },
  { codigo: 47, rotulo: "Culto Festivo" },
  { codigo: 48, rotulo: "Estudo para Professores" },
  { codigo: 50, rotulo: "Aniversário do Circulo Infantil" },
  { codigo: 58, rotulo: "Simpósio de Doutrina" },
  { codigo: 59, rotulo: "Culto do PROATI" },
  { codigo: 61, rotulo: "Seminário para Família" },
  { codigo: 62, rotulo: "Mini-Vigília" },
  { codigo: 63, rotulo: "Aniversário do PROATI" },
  { codigo: 65, rotulo: "Encontro do PROATI" },
  { codigo: 66, rotulo: "Estudo para Família" },
  { codigo: 67, rotulo: "Inauguração de Campanha Evangelística" },
  { codigo: 68, rotulo: "EBD Animada" },
  { codigo: 69, rotulo: "Reunião de Obreiros" },
  { codigo: 70, rotulo: "Reunião para Dirigentes do C.O.A" },
  { codigo: 71, rotulo: "Aniversário da Mocidade" },
];

const POR_CODIGO = new Map(TIPOS_CULTO.map((t) => [t.codigo, t]));

/** O rótulo do código, ou o próprio número quando a legenda ainda não o tem. */
export function rotuloDoTipo(codigo: number): string {
  return POR_CODIGO.get(codigo)?.rotulo ?? `Tipo ${codigo}`;
}

export function tipoCultoValido(codigo: unknown): codigo is number {
  return typeof codigo === "number" && Number.isInteger(codigo) && POR_CODIGO.has(codigo);
}
