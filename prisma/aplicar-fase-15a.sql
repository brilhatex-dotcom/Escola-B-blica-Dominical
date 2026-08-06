-- ===========================================================================
-- FASE 15a — Central de Revistas CPAD: painel do trimestre e alertas
--
-- Cole tudo no SQL Editor do Neon e clique em Run.
--
-- É seguro rodar com o sistema no ar e é seguro rodar duas vezes: os dois
-- comandos usam IF NOT EXISTS.
--
-- O QUE ESTE ARQUIVO FAZ, E POR QUÊ
--
-- `Trimestres_Revistas` ganha duas colunas novas, as duas opcionais:
--
-- `tema`             — o tema do trimestre (ex.: "A Grandeza da Graça de
--                       Deus"), só para exibição no painel.
-- `dataLimitePedido` — um prazo separado do prazo de pagamento que já
--                       existia (`dataLimite`). Fica NULO até a administração
--                       do campo decidir usar — sem padrão automático, porque
--                       o pedido em si não tem um passo de "enviar": ele nasce
--                       pronto, calculado a partir dos alunos ativos.
--
-- Nenhuma linha existente é alterada — as duas colunas nascem nulas em todo
-- trimestre já cadastrado.
-- ===========================================================================

ALTER TABLE "Trimestres_Revistas" ADD COLUMN IF NOT EXISTS "tema" TEXT;
ALTER TABLE "Trimestres_Revistas" ADD COLUMN IF NOT EXISTS "dataLimitePedido" DATE;

-- Conferência — cole junto, o resultado mostra as colunas novas
SELECT "trimestre", "tema", "dataLimitePedido", "dataLimite"
FROM "Trimestres_Revistas"
ORDER BY "trimestre" DESC;
