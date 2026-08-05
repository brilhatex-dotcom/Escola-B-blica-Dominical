-- ===========================================================================
-- FASE 12 — a auditoria passa a ser GRAVADA pelo portal
--
-- Cole tudo no SQL Editor do Neon e clique em Run.
--
-- É seguro rodar com o sistema no ar e é seguro rodar duas vezes: cada passo
-- confere antes de fazer.
--
-- O QUE ESTE ARQUIVO FAZ, E POR QUÊ
--
-- A tabela `Auditoria` veio do sistema antigo com 1.671 linhas e o `id`
-- preenchido à mão pela importação — sem sequência nenhuma. Um INSERT do
-- portal falharia na hora, porque não haveria de onde tirar o próximo número.
--
-- Aqui a sequência é criada e apontada para MAX(id) + 1. Começar do 1
-- colidiria com as linhas herdadas já existentes e o primeiro registro novo
-- seria recusado — ou, pior, sobrescreveria histórico.
--
-- E `congId` entra nula: nenhuma das linhas antigas tem congregação, porque o
-- sistema antigo não guardava essa informação. Preenchê-la por dedução seria
-- inventar dado histórico.
-- ===========================================================================

-- 1) A coluna de congregação (nula no que veio do sistema antigo)
ALTER TABLE "Auditoria" ADD COLUMN IF NOT EXISTS "congId" INTEGER;

CREATE INDEX IF NOT EXISTS "Auditoria_congId_idx" ON "Auditoria" ("congId");

DO $$
BEGIN
  ALTER TABLE "Auditoria"
    ADD CONSTRAINT "Auditoria_congId_fkey"
    FOREIGN KEY ("congId") REFERENCES "Congregacoes" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) A sequência do `id`, começando acima do maior id importado
DO $$
DECLARE
  proximo BIGINT;
BEGIN
  IF pg_get_serial_sequence('"Auditoria"', 'id') IS NULL THEN
    CREATE SEQUENCE IF NOT EXISTS "Auditoria_id_seq" OWNED BY "Auditoria"."id";
    ALTER TABLE "Auditoria" ALTER COLUMN "id" SET DEFAULT nextval('"Auditoria_id_seq"');
  END IF;

  SELECT COALESCE(MAX("id"), 0) + 1 INTO proximo FROM "Auditoria";
  PERFORM setval('"Auditoria_id_seq"', proximo, false);
END $$;

-- 3) Conferência — cole junto, o resultado diz se deu certo
SELECT
  (SELECT COUNT(*) FROM "Auditoria")                      AS linhas_no_total,
  (SELECT COUNT(*) FROM "Auditoria" WHERE "congId" IS NOT NULL) AS com_congregacao,
  (SELECT MAX("id") FROM "Auditoria")                     AS maior_id,
  last_value                                              AS proximo_id
FROM "Auditoria_id_seq";
