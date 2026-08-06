-- ===========================================================================
-- VISITANTE — marcar se já é crente ou se não é evangélico
--
-- Cole tudo no SQL Editor do Neon e clique em Run.
-- É seguro rodar com o sistema no ar e é seguro rodar duas vezes.
--
-- Acrescenta uma coluna a "Visitantes":
--   • crente — true (já é crente/evangélico de outra igreja), false (não é
--     evangélico) ou null (não perguntado)
--
-- Nenhuma coluna antiga é tocada. As 89 linhas herdadas nascem com "crente"
-- vazio, e continuam assim até alguém preencher.
-- ===========================================================================

ALTER TABLE "Visitantes" ADD COLUMN IF NOT EXISTS "crente" BOOLEAN;

-- Conferência — a coluna deve aparecer
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'Visitantes' AND column_name = 'crente';
