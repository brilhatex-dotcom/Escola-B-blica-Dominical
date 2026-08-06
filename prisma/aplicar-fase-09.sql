-- ════════════════════════════════════════════════════════════════════════════
-- FASE 09 — Pedidos de Revistas
--
-- COMO APLICAR (sem linha de comando):
--   1. Abra o projeto ebd-betania no Neon (console.neon.tech)
--   2. Menu da esquerda → SQL Editor
--   3. Cole este arquivo inteiro e clique em Run
--   4. Confira o resultado impresso no fim
--
-- É SEGURO RODAR COM O SISTEMA NO AR e é seguro rodar mais de uma vez.
--
-- ────────────────────────────────────────────────────────────────────────────
-- O QUE ISTO FAZ, E O QUE NÃO FAZ
--
-- FAZ: cria DUAS tabelas novas — o pedido e as linhas dele.
--
-- NÃO FAZ: não altera, não renomeia e não apaga nada do sistema antigo.
-- `Precos_Revistas` (35 preços) e `Parametros` continuam exatamente como estão
-- e seguem sendo a fonte dos valores.
--
-- Por que tabelas novas e não importação: a aba `Pedidos_Revistas` existe no
-- export da planilha e está VAZIA — zero linhas. Não há como inferir os campos
-- de uma planilha sem dados, então o desenho é novo.
--
-- Os módulos anteriores continuam funcionando sem estas tabelas: se o SQL não
-- for aplicado, apenas a tela de Pedido de Revistas avisa que falta aplicá-lo.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Visitantes: data de nascimento e onde mora
--
-- Duas colunas NOVAS e OPCIONAIS. Elas nascem nulas nas 89 linhas herdadas e
-- nenhuma delas é alterada — é o mesmo caminho da Fase 05, que acrescentou
-- `pessoaId` a `Usuarios` sem tocar em nada.
--
-- A coluna `idade` continua existindo e continua valendo para os visitantes
-- antigos: a planilha guardava só a idade, e calcular uma data de nascimento a
-- partir dela seria inventar dia e mês. Nos visitantes novos quem manda é
-- `nasc`, e a idade passa a ser calculada.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Visitantes" ADD COLUMN IF NOT EXISTS "nasc"  DATE;
ALTER TABLE "Visitantes" ADD COLUMN IF NOT EXISTS "local" TEXT;


-- ────────────────────────────────────────────────────────────────────────────
-- 1. O pedido
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Pedidos_Revistas" (
  "id"          SERIAL PRIMARY KEY,
  "congId"      INTEGER,
  "classeId"    INTEGER,
  "ano"         INTEGER NOT NULL,
  -- 1 a 4. Número, e não "2T": trimestre é ordenável e comparável; texto não é.
  "trimestre"   INTEGER NOT NULL,
  -- "rascunho" | "enviado" | "atendido"
  "situacao"    TEXT NOT NULL DEFAULT 'rascunho',
  "observacao"  TEXT,
  "autor"       TEXT,
  "criadoEm"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enviadoEm"   TIMESTAMP(3)
);

-- Um pedido por classe por trimestre.
--
-- Sem esta restrição, dois professores da mesma classe abrem dois pedidos no
-- mesmo trimestre e a secretaria recebe o dobro das revistas — sem ninguém
-- perceber até a entrega chegar. A regra fica no BANCO, e não só na tela:
-- duas pessoas clicando no mesmo segundo passam por qualquer conferência feita
-- em JavaScript.
CREATE UNIQUE INDEX IF NOT EXISTS "Pedidos_Revistas_classeId_ano_trimestre_key"
  ON "Pedidos_Revistas" ("classeId", "ano", "trimestre");

CREATE INDEX IF NOT EXISTS "Pedidos_Revistas_congId_idx"
  ON "Pedidos_Revistas" ("congId");
CREATE INDEX IF NOT EXISTS "Pedidos_Revistas_ano_trimestre_idx"
  ON "Pedidos_Revistas" ("ano", "trimestre");


-- ────────────────────────────────────────────────────────────────────────────
-- 2. As linhas do pedido
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Pedidos_Revistas_Itens" (
  "id"            SERIAL PRIMARY KEY,
  "pedidoId"      INTEGER NOT NULL,
  -- Apontam para Precos_Revistas (key, categoria). SEM chave estrangeira de
  -- propósito: aquela tabela é do sistema antigo, e uma FK daqui para lá
  -- impediria a secretaria de corrigir um preço sem antes mexer nos pedidos.
  "categoria"     TEXT NOT NULL,
  "chave"         TEXT NOT NULL,
  "label"         TEXT NOT NULL,
  "quantidade"    INTEGER NOT NULL,
  -- O preço CONGELADO no momento do pedido.
  --
  -- Ler o preço atual na hora de exibir faria o pedido de abril mudar de valor
  -- sozinho quando a tabela fosse atualizada em julho, e a prestação de contas
  -- de um trimestre fechado deixaria de bater com o que foi pago. Um pedido é
  -- um documento: guarda o que valia quando foi feito.
  "precoUnitario" DECIMAL(10,2) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Pedidos_Revistas_Itens_pedidoId_categoria_chave_key"
  ON "Pedidos_Revistas_Itens" ("pedidoId", "categoria", "chave");
CREATE INDEX IF NOT EXISTS "Pedidos_Revistas_Itens_pedidoId_idx"
  ON "Pedidos_Revistas_Itens" ("pedidoId");


-- ────────────────────────────────────────────────────────────────────────────
-- 3. As ligações
--
-- Vêm em blocos com EXCEPTION porque `ADD CONSTRAINT` não aceita
-- `IF NOT EXISTS` no Postgres: sem o bloco, a segunda execução quebraria no
-- meio e deixaria o banco pela metade.
--
-- Apagar um pedido apaga as linhas dele (CASCADE) — uma linha de pedido não
-- existe sozinha. Apagar uma classe apenas solta o pedido (SET NULL): o
-- histórico do trimestre continua valendo mesmo que a classe seja extinta.
-- ────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "Pedidos_Revistas_Itens"
    ADD CONSTRAINT "Pedidos_Revistas_Itens_pedidoId_fkey"
    FOREIGN KEY ("pedidoId") REFERENCES "Pedidos_Revistas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Pedidos_Revistas"
    ADD CONSTRAINT "Pedidos_Revistas_congId_fkey"
    FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Pedidos_Revistas"
    ADD CONSTRAINT "Pedidos_Revistas_classeId_fkey"
    FOREIGN KEY ("classeId") REFERENCES "Classes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- Conferência
--
-- Deve imprimir as duas tabelas novas com 0 pedidos, e confirmar que os 35
-- preços do sistema antigo continuam lá, intactos.
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM "Pedidos_Revistas")        AS "pedidos (esperado 0)",
  (SELECT count(*) FROM "Pedidos_Revistas_Itens")  AS "itens (esperado 0)",
  (SELECT count(*) FROM "Precos_Revistas")         AS "precos intactos (esperado 35)",
  (SELECT count(*) FROM "Licoes")                  AS "licoes intactas (esperado 228)",
  (SELECT count(*) FROM "Visitantes")              AS "visitantes intactos (esperado 89)",
  (SELECT count(*) FROM "Visitantes" WHERE "idade" IS NOT NULL)
                                                   AS "idades antigas preservadas",
  (SELECT count(*) FROM "Alunos")                  AS "alunos intactos";
