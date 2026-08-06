-- ===========================================================================
-- INCLUIR VISITANTE — data de nascimento e local que mora
--
-- Cole tudo no SQL Editor do Neon e clique em Run.
-- É seguro rodar com o sistema no ar e é seguro rodar duas vezes.
--
-- Acrescenta duas colunas a "Visitantes":
--   • nascimento — data de nascimento do visitante
--   • endereco   — onde mora ("local que mora"), em texto livre
--
-- Nenhuma coluna antiga é tocada nem apagada. "idade" e "tel" continuam
-- existindo, exatamente como vieram da importação — a tela de "incluir
-- visitante" passa a usar nascimento e endereço, e não mais idade solta.
-- ===========================================================================

ALTER TABLE "Visitantes" ADD COLUMN IF NOT EXISTS "nascimento" DATE;
ALTER TABLE "Visitantes" ADD COLUMN IF NOT EXISTS "endereco" TEXT;

-- Conferência — as duas colunas devem aparecer
SELECT column_name FROM information_schema.columns
WHERE table_name = 'Visitantes' AND column_name IN ('nascimento', 'endereco');
