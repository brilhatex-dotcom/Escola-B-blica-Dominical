-- ===========================================================================
-- ESCALA MENSAL — montar a escala de culto pelo portal
--
-- Cole tudo no SQL Editor do Neon e clique em Run.
-- É seguro rodar com o sistema no ar e é seguro rodar duas vezes (todo
-- comando usa IF NOT EXISTS).
--
-- Cria DUAS tabelas novas:
--   • Escalas_Mensais — uma linha por mês (título, mês, avisos, autor).
--   • Escala_Itens    — os cultos daquele mês (dia, tipo, congregação, quem prega).
--
-- NÃO MEXE em "Escala_Cultos" (a tabela antiga, de link do Drive) — as
-- escalas já publicadas antes desta troca continuam ali, para não sumir do
-- histórico. Só não recebem mais registro novo: dali para frente, a escala
-- oficial é montada pelas duas tabelas novas.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "Escalas_Mensais" (
  "id"         SERIAL PRIMARY KEY,
  "mesAno"     DATE NOT NULL,
  "titulo"     TEXT NOT NULL,
  "avisos"     TEXT,
  "autor"      TEXT NOT NULL,
  "criadoEm"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  "atualizado" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "Escalas_Mensais_mesAno_key" ON "Escalas_Mensais" ("mesAno");

CREATE TABLE IF NOT EXISTS "Escala_Itens" (
  "id"         SERIAL PRIMARY KEY,
  "escalaId"   INTEGER NOT NULL REFERENCES "Escalas_Mensais" ("id") ON DELETE CASCADE,
  "data"       DATE NOT NULL,
  "tipoCodigo" INTEGER NOT NULL,
  "congId"     INTEGER REFERENCES "Congregacoes" ("id"),
  "local"      TEXT NOT NULL,
  "pregadores" TEXT NOT NULL,
  "destaque"   TEXT,
  "ordem"      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "Escala_Itens_escalaId_idx" ON "Escala_Itens" ("escalaId");
CREATE INDEX IF NOT EXISTS "Escala_Itens_congId_idx" ON "Escala_Itens" ("congId");

-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------

SELECT table_name FROM information_schema.tables
WHERE table_name IN ('Escalas_Mensais', 'Escala_Itens');
