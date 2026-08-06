-- ===========================================================================
-- FASE 15b — Central de Revistas CPAD: a tela de FAZER o pedido
--
-- Cole tudo no SQL Editor do Neon e clique em Run.
--
-- É seguro rodar com o sistema no ar e é seguro rodar duas vezes: tudo usa
-- IF NOT EXISTS.
--
-- O QUE ESTE ARQUIVO FAZ, E POR QUÊ
--
-- A Fase 15a calculava o pedido sozinha (alunos ativos × preço) e só permitia
-- REGISTRAR PAGAMENTO. Não existia o momento de "a congregação decidiu e
-- mandou o pedido de verdade" — e sem esse passo, um aluno saindo da classe
-- em novembro reduziria silenciosamente o pedido de agosto, que já foi
-- impresso e enviado pela CPAD.
--
-- Duas tabelas novas guardam o pedido de verdade, digitado e depois
-- CONFIRMADO (o que trava a quantidade e o preço daquele momento):
--
-- "Pedidos_Revistas"       — uma linha por congregação × trimestre, com o
--                             status (confirmado ou rascunho) e quem/quando
--                             confirmou.
-- "Pedidos_Revistas_Itens" — uma linha por categoria × tipo (aluno/professor)
--                             dentro de um pedido, com a quantidade e o preço
--                             daquele momento.
--
-- Nenhuma tabela existente é alterada.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "Pedidos_Revistas" (
  "id"            SERIAL PRIMARY KEY,
  "congId"        INTEGER NOT NULL REFERENCES "Congregacoes"("id"),
  "trimestre"     TEXT NOT NULL,
  "confirmado"    BOOLEAN NOT NULL DEFAULT false,
  "confirmadoEm"  TIMESTAMP(3),
  "confirmadoPor" TEXT,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT now(),
  "atualizado"    TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "Pedidos_Revistas_congId_trimestre_key" UNIQUE ("congId", "trimestre")
);

CREATE TABLE IF NOT EXISTS "Pedidos_Revistas_Itens" (
  "id"            SERIAL PRIMARY KEY,
  "pedidoId"      INTEGER NOT NULL REFERENCES "Pedidos_Revistas"("id") ON DELETE CASCADE,
  "categoria"     TEXT NOT NULL,
  "tipo"          TEXT NOT NULL,
  "quantidade"    INTEGER NOT NULL,
  "precoUnitario" DECIMAL(10, 2) NOT NULL,
  CONSTRAINT "Pedidos_Revistas_Itens_pedidoId_categoria_tipo_key" UNIQUE ("pedidoId", "categoria", "tipo")
);

CREATE INDEX IF NOT EXISTS "Pedidos_Revistas_congId_idx" ON "Pedidos_Revistas" ("congId");
CREATE INDEX IF NOT EXISTS "Pedidos_Revistas_Itens_pedidoId_idx" ON "Pedidos_Revistas_Itens" ("pedidoId");

-- Conferência — cole junto, o resultado mostra as tabelas vazias e prontas
SELECT
  (SELECT COUNT(*) FROM "Pedidos_Revistas")       AS pedidos,
  (SELECT COUNT(*) FROM "Pedidos_Revistas_Itens")  AS itens;
