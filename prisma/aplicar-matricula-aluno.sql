-- ===========================================================================
-- ALUNO — data de matrícula, para a Chamada não voltar no tempo
--
-- Cole tudo no SQL Editor do Neon e clique em Run.
-- É seguro rodar com o sistema no ar e é seguro rodar duas vezes.
--
-- Acrescenta UMA coluna a "Alunos":
--   • matriculadoEm — quando a matrícula nasceu NESTE portal
--
-- NÃO FAZ: não preenche nada nas 323 linhas herdadas — elas nascem com
-- "matriculadoEm" vazio, e é assim que devem ficar. Vazio aqui significa
-- "matrícula antiga, sem restrição de data": a pessoa já estava na EBD desde
-- antes do sistema existir, então a Chamada não tem por que recusar nenhum
-- domingo em nome dela.
--
-- A partir de agora, quem for matriculado PELO PORTAL (aba Alunos, aba
-- Classes ou aba Congregações → Nova classe → Matricular) ganha esta data
-- sozinho, sem precisar digitar nada — e a Chamada passa a recusar marcar
-- presença ou falta dessa pessoa em qualquer domingo ANTERIOR a ela.
-- ===========================================================================

ALTER TABLE "Alunos" ADD COLUMN IF NOT EXISTS "matriculadoEm" DATE;

-- Conferência — a coluna deve aparecer, vazia em todo mundo por enquanto
SELECT
  count(*)                                        AS "alunos (esperado 323 ou mais)",
  count(*) FILTER (WHERE "matriculadoEm" IS NULL)  AS "sem restrição de data (deve ser todo mundo, por ora)"
FROM "Alunos";
