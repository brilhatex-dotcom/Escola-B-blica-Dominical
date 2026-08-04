-- ════════════════════════════════════════════════════════════════════════════
-- FASE 08 — os dois cargos que faltavam para os papéis pedidos
--
-- COMO APLICAR (sem linha de comando):
--   1. Abra o projeto ebd-betania no Neon (console.neon.tech)
--   2. Menu da esquerda → SQL Editor
--   3. Cole este arquivo inteiro e clique em Run
--   4. Confira o resultado impresso no fim
--
-- É SEGURO RODAR COM O SISTEMA NO AR e é seguro rodar mais de uma vez: o
-- `ON CONFLICT DO NOTHING` faz a segunda execução não alterar nada.
--
-- ────────────────────────────────────────────────────────────────────────────
-- POR QUE SÓ DOIS CARGOS
--
-- Os oito perfis pedidos já existiam quase todos na tabela `Cargos`, criada na
-- Fase 05:
--
--   Pastor Presidente · Gestor Local · Supervisor da EBD · Secretário ·
--   Coordenador de Congregação · Dirigente · Professor · Secretário de Classe
--
-- Faltavam Vice-Dirigente e Secretário Local. Eles entram com `escopo` de
-- CONGREGAÇÃO, que é o que faz o portal restringir a visão de quem os ocupa à
-- própria congregação.
--
-- A numeração pula de 5 em 5 aqui para caber entre os cargos já existentes sem
-- renumerar nenhum: Coordenador (60) · Secretário Local (65) · Dirigente (70) ·
-- Vice-Dirigente (75) · Professor (80).
--
-- NENHUMA LINHA DO SISTEMA ANTIGO É ALTERADA. Isto acrescenta duas funções à
-- lista de cargos; não toca em pessoa, em vínculo, em usuário nem em senha.
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO "Cargos" ("nome", "ordem", "escopo", "destaque", "ativo") VALUES
  ('Secretário Local', 65, 'congregacao', false, true),
  ('Vice-Dirigente',   75, 'congregacao', false, true)
ON CONFLICT ("nome") DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────
-- Conferência
--
-- Deve listar os 12 cargos, em ordem de hierarquia, com os dois novos no meio.
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  "ordem",
  "nome"        AS cargo,
  "escopo"      AS "alcance do cargo",
  CASE WHEN "destaque" THEN 'sim' ELSE '—' END AS "aparece no painel"
FROM "Cargos"
WHERE "ativo"
ORDER BY "ordem";
