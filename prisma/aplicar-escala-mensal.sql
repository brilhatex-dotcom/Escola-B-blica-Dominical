-- ===========================================================================
-- ESCALA MENSAL — montar a escala de culto pelo portal
--
-- Cole tudo no SQL Editor do Neon e clique em Run.
-- É seguro rodar com o sistema no ar e é seguro rodar duas vezes (todo
-- comando usa IF NOT EXISTS).
--
-- Cria QUATRO tabelas novas:
--   • Escalas_Mensais        — uma linha por mês (título, mês, status, autor).
--   • Escala_Itens           — os cultos daquele mês (dia, tipo, congregação).
--   • Escala_Item_Obreiros   — quem prega em cada culto, ligado à Pessoa (não
--                              texto solto — é o que permite contar quantas
--                              vezes cada obreiro serve no mês e avisar
--                              quando o mesmo obreiro cai duas vezes no
--                              mesmo dia).
--   • Escala_Avisos          — os avisos do rodapé da escala (ex.: "Grupos
--                              escalados para doutrina no Templo Matriz").
--
-- NÃO MEXE em "Escala_Cultos" (a tabela antiga, de link do Drive) — as
-- escalas já publicadas antes desta troca continuam ali, para não sumir do
-- histórico. Só não recebem mais registro novo: dali para frente, a escala
-- oficial é montada pelas quatro tabelas novas.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "Escalas_Mensais" (
  "id"           SERIAL PRIMARY KEY,
  "mesAno"       DATE NOT NULL,
  "titulo"       TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'rascunho',
  "publicadoEm"  TIMESTAMP(3),
  "publicadoPor" TEXT,
  "autor"        TEXT NOT NULL,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT now(),
  "atualizado"   TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "Escalas_Mensais_mesAno_key" ON "Escalas_Mensais" ("mesAno");

CREATE TABLE IF NOT EXISTS "Escala_Itens" (
  "id"         SERIAL PRIMARY KEY,
  "escalaId"   INTEGER NOT NULL REFERENCES "Escalas_Mensais" ("id") ON DELETE CASCADE,
  "data"       DATE NOT NULL,
  "tipoCodigo" INTEGER NOT NULL,
  "congId"     INTEGER REFERENCES "Congregacoes" ("id"),
  "local"      TEXT NOT NULL,
  "destaque"   TEXT,
  "ordem"      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "Escala_Itens_escalaId_idx" ON "Escala_Itens" ("escalaId");
CREATE INDEX IF NOT EXISTS "Escala_Itens_congId_idx" ON "Escala_Itens" ("congId");

CREATE TABLE IF NOT EXISTS "Escala_Item_Obreiros" (
  "id"       SERIAL PRIMARY KEY,
  "itemId"   INTEGER NOT NULL REFERENCES "Escala_Itens" ("id") ON DELETE CASCADE,
  "pessoaId" INTEGER NOT NULL REFERENCES "Pessoas" ("id"),
  "ordem"    INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "Escala_Item_Obreiros_itemId_pessoaId_key" ON "Escala_Item_Obreiros" ("itemId", "pessoaId");
CREATE INDEX IF NOT EXISTS "Escala_Item_Obreiros_itemId_idx" ON "Escala_Item_Obreiros" ("itemId");
CREATE INDEX IF NOT EXISTS "Escala_Item_Obreiros_pessoaId_idx" ON "Escala_Item_Obreiros" ("pessoaId");

CREATE TABLE IF NOT EXISTS "Escala_Avisos" (
  "id"        SERIAL PRIMARY KEY,
  "escalaId"  INTEGER NOT NULL REFERENCES "Escalas_Mensais" ("id") ON DELETE CASCADE,
  "data"      DATE,
  "titulo"    TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "ordem"     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "Escala_Avisos_escalaId_idx" ON "Escala_Avisos" ("escalaId");

-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------

SELECT table_name FROM information_schema.tables
WHERE table_name IN ('Escalas_Mensais', 'Escala_Itens', 'Escala_Item_Obreiros', 'Escala_Avisos');
