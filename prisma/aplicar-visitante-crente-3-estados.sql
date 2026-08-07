-- ===========================================================================
-- VISITANTE — crente vira TRÊS estados, não dois
--
-- Cole tudo no SQL Editor do Neon e clique em Run.
-- É seguro rodar com o sistema no ar e é seguro rodar duas vezes.
--
-- A pessoa que visita pode ser: já é crente DESTA igreja (visitou outro
-- culto ou outra congregação do campo), já é crente de OUTRA igreja, ou não
-- é evangélico. Antes só havia "crente" (sim/não); agora são três respostas
-- de texto:
--   • 'mesma-igreja'   — crente, membro desta própria igreja
--   • 'outra-igreja'   — crente, de outra denominação
--   • 'nao-evangelico' — não é evangélico
--   • vazio (NULL)     — não perguntado
--
-- O QUE ISTO FAZ COM QUEM JÁ RESPONDEU "sim" OU "não" (coluna antiga,
-- true/false): converte para texto SEM PERDER a resposta —
--   true  (era "crente", sem dizer de qual igreja) → 'outra-igreja'
--   false (era "não evangélico")                    → 'nao-evangelico'
--   vazio                                            → continua vazio
-- Quem quiser refinar para "mesma igreja" depois de convertido, edita o
-- cadastro do visitante normalmente — nada se perde, e nada precisa ser
-- refeito às pressas.
--
-- Se a coluna "crente" ainda não existir (primeira vez que este trecho
-- roda no banco), ela nasce direto como texto, vazia em todo mundo.
-- ===========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Visitantes' AND column_name = 'crente' AND data_type = 'boolean'
  ) THEN
    ALTER TABLE "Visitantes" ALTER COLUMN "crente" TYPE TEXT USING (
      CASE
        WHEN "crente" IS NULL THEN NULL
        WHEN "crente" THEN 'outra-igreja'
        ELSE 'nao-evangelico'
      END
    );
  END IF;
END $$;

ALTER TABLE "Visitantes" ADD COLUMN IF NOT EXISTS "crente" TEXT;

-- Conferência — a coluna deve ser texto, e a contagem de respostas antigas
-- convertidas deve bater com o que já existia
SELECT
  data_type                                                    AS "tipo da coluna (esperado: text)",
  count(*) FILTER (WHERE "crente" IS NOT NULL)                 AS "respostas guardadas",
  count(*) FILTER (WHERE "crente" = 'outra-igreja')            AS "convertidas de 'sim'",
  count(*) FILTER (WHERE "crente" = 'nao-evangelico')          AS "convertidas de 'não' / respondidas agora"
FROM "Visitantes", information_schema.columns
WHERE table_name = 'Visitantes' AND column_name = 'crente'
GROUP BY data_type;
