-- ════════════════════════════════════════════════════════════════════════════
-- Visitantes: data de nascimento e onde mora
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
-- FAZ: acrescenta DUAS colunas novas e OPCIONAIS a `Visitantes`, para o
-- cadastro feito de dentro da Chamada — a data de nascimento e o lugar onde a
-- pessoa mora.
--
-- NÃO FAZ: não altera nenhuma das 89 linhas herdadas. Elas nascem com as duas
-- colunas vazias, e é assim que devem ficar.
--
-- Sobre a coluna `idade`, que continua existindo: a planilha antiga guardava
-- só a idade, um número solto. Calcular uma data de nascimento a partir dele
-- exigiria inventar dia e mês, e a regra da igreja é não decidir por conta
-- própria sobre registro do sistema antigo. Então os dois campos convivem:
-- visitante novo grava a data e a idade passa a ser calculada; visitante
-- antigo mantém o número que veio da planilha. A tela mostra os dois do mesmo
-- jeito e não precisa saber de qual época o registro é.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE "Visitantes" ADD COLUMN IF NOT EXISTS "nasc"  DATE;
ALTER TABLE "Visitantes" ADD COLUMN IF NOT EXISTS "local" TEXT;


-- ────────────────────────────────────────────────────────────────────────────
-- Conferência
--
-- As duas colunas novas devem aparecer, e a contagem de visitantes e de idades
-- preenchidas tem de continuar exatamente a mesma de antes.
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM "Visitantes")                              AS "visitantes (esperado 89)",
  (SELECT count(*) FROM "Visitantes" WHERE "idade" IS NOT NULL)    AS "idades antigas preservadas",
  (SELECT count(*) FROM "Visitantes" WHERE "nasc"  IS NOT NULL)    AS "com data de nascimento",
  (SELECT count(*) FROM "Visitantes" WHERE "local" IS NOT NULL)    AS "com local informado";
