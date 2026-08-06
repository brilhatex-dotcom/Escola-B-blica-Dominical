-- ===========================================================================
-- PEDIDO DE LIÇÃO — pagamentos parciais e data-limite
--
-- Cole tudo no SQL Editor do Neon e clique em Run.
-- É seguro rodar com o sistema no ar e é seguro rodar duas vezes.
--
-- Cria duas tabelas novas:
--   • Pagamentos_Revistas  — cada baixa (pagamento parcial) de uma congregação
--   • Trimestres_Revistas  — a data-limite de cada trimestre
--
-- Nenhum dado antigo é tocado. O pedido continua sendo CALCULADO (alunos
-- ativos × preço); o que estas tabelas guardam é o quanto já foi pago e até
-- quando pagar.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "Pagamentos_Revistas" (
  "id"         SERIAL PRIMARY KEY,
  "congId"     INTEGER NOT NULL REFERENCES "Congregacoes" ("id"),
  "trimestre"  TEXT NOT NULL,
  "valor"      NUMERIC(10, 2) NOT NULL,
  "observacao" TEXT,
  "autor"      TEXT,
  "criadoEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Pagamentos_Revistas_congId_trimestre_idx"
  ON "Pagamentos_Revistas" ("congId", "trimestre");

CREATE TABLE IF NOT EXISTS "Trimestres_Revistas" (
  "trimestre"  TEXT PRIMARY KEY,
  "dataLimite" DATE,
  "atualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Conferência — devem existir as duas tabelas
SELECT
  to_regclass('"Pagamentos_Revistas"') AS pagamentos,
  to_regclass('"Trimestres_Revistas"') AS trimestres;
