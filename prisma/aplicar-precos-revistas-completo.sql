-- ===========================================================================
-- REVISTAS — catálogo completo de modalidades + preços atualizados (2026)
--
-- Cole tudo no SQL Editor do Neon e clique em Run.
-- É seguro rodar com o sistema no ar e é seguro rodar duas vezes (todo passo
-- usa ON CONFLICT / é idempotente).
--
-- O QUE ESTE SCRIPT FAZ, NESTA ORDEM:
--
--   1. Atualiza o preço das modalidades que já existiam e mudaram, e
--      cadastra as que faltavam (Adultos — Professor — Letra Ampliada;
--      Visual em Berçário/Maternal/Jardim/Primários/Juniores; e os quatro
--      itens novos sem classe própria: Revista Ensinador Cristão, Revista
--      Obreiro Aprovado, Livro de Apoio da Lição, Devocional de Leitura
--      Diária — categoria nova "apoio").
--
--   2. Migra "Pedidos_Revistas_Itens".tipo do esquema antigo ('aluno' /
--      'professor', um valor só por categoria) para o novo (a MESMA chave
--      de "Precos_Revistas", ex. 'aluno-comum', 'mestre-comum',
--      'manual-mestre') — em TODOS os pedidos, de qualquer trimestre. Sem
--      isto, um pedido de trimestre passado não aparece mais na tela: o
--      sistema agora monta a lista de linhas a partir das chaves reais da
--      tabela de preços, e 'aluno'/'professor' deixaram de existir nela.
--
--   3. Recalcula "precoUnitario" dos itens do 4º trimestre de 2026
--      (confirmados ou não) com os preços novos — pedido explícito: quem já
--      tinha feito o pedido do 4T-2026 antes da tabela mudar paga o valor
--      novo, não o antigo. Nenhum outro trimestre é tocado — o preço
--      cobrado de um pedido já fechado de trimestres anteriores continua
--      travado, como sempre foi.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Catálogo de preços
-- ---------------------------------------------------------------------------

INSERT INTO "Precos_Revistas" (key, categoria, label, preco) VALUES
  -- Adultos
  ('aluno-comum',      'adultos',    'Adultos — Aluno — Capa Comum',            12.00),
  ('mestre-comum',     'adultos',    'Adultos — Professor — Capa Comum',        17.00),
  ('aluno-ampliada',   'adultos',    'Adultos — Aluno — Letra Ampliada',        20.00),
  ('mestre-ampliada',  'adultos',    'Adultos — Professor — Letra Ampliada',    22.00),
  ('mestre-capa-dura', 'adultos',    'Adultos — Professor — Capa Dura (Luxo)',  33.00),

  -- Jovens ("Lições Bíblicas Jovens", na tabela nova)
  ('aluno-comum',      'jovens',     'Jovens — Aluno — Capa Comum',             12.00),
  ('mestre-comum',      'jovens',    'Jovens — Professor — Capa Comum',         17.00),

  -- Juvenis
  ('aluno-comum',      'juvenis',    'Juvenis — Revista do Aluno',              12.00),
  ('mestre-comum',     'juvenis',    'Juvenis — Revista do Professor',          17.00),

  -- Adolescentes
  ('aluno-comum',      'adolesc',    'Adolescentes — Revista do Aluno',         12.00),
  ('mestre-comum',     'adolesc',    'Adolescentes — Revista do Professor',     17.00),

  -- Pré-Adolescentes
  ('aluno-comum',      'preadolesc', 'Pré-Adolescentes — Revista do Aluno',     12.00),
  ('mestre-comum',     'preadolesc', 'Pré-Adolescentes — Revista do Professor', 17.00),

  -- Juniores
  ('aluno-comum',      'juniores',   'Juniores — Revista do Aluno',             10.00),
  ('mestre-comum',     'juniores',   'Juniores — Revista do Professor',         15.00),
  ('visual',           'juniores',   'Juniores — Visual',                       38.00),

  -- Primários
  ('aluno-comum',      'primarios',  'Primários — Revista do Aluno',             9.00),
  ('mestre-comum',     'primarios',  'Primários — Revista do Professor',        15.00),
  ('visual',           'primarios',  'Primários — Visual',                      38.00),

  -- Jardim de Infância
  ('aluno-comum',      'jardim',     'Jardim de Infância — Revista do Aluno',    9.00),
  ('mestre-comum',     'jardim',     'Jardim de Infância — Revista do Professor', 15.00),
  ('visual',           'jardim',     'Jardim de Infância — Visual',              38.00),

  -- Maternal
  ('aluno-comum',      'maternal',   'Maternal — Revista do Aluno',              9.00),
  ('mestre-comum',     'maternal',   'Maternal — Revista do Professor',         15.00),
  ('visual',           'maternal',   'Maternal — Visual',                       38.00),

  -- Berçário (sem "aluno" — bebê não recebe revista própria)
  ('manual-mestre',    'bercario',   'Berçário — Manual do Mestre',             14.00),
  ('visual',           'bercario',   'Berçário — Visual',                       28.00),

  -- Material de apoio — sem classe própria, pedido à parte por qualquer congregação
  ('ensinador-cristao', 'apoio',     'Revista Ensinador Cristão',                17.00),
  ('obreiro-aprovado',  'apoio',     'Revista Obreiro Aprovado',                 20.00),
  ('livro-apoio',       'apoio',     'Livro de Apoio da Lição',                  20.00),
  ('devocional',        'apoio',     'Devocional de Leitura Diária',             15.00)

ON CONFLICT (key, categoria) DO UPDATE SET
  label = EXCLUDED.label,
  preco = EXCLUDED.preco;

-- ---------------------------------------------------------------------------
-- 2. Migra o "tipo" antigo para as chaves reais da tabela de preços
-- ---------------------------------------------------------------------------

UPDATE "Pedidos_Revistas_Itens"
SET tipo = 'manual-mestre'
WHERE tipo = 'professor' AND categoria = 'bercario';

UPDATE "Pedidos_Revistas_Itens"
SET tipo = 'mestre-comum'
WHERE tipo = 'professor' AND categoria <> 'bercario';

UPDATE "Pedidos_Revistas_Itens"
SET tipo = 'aluno-comum'
WHERE tipo = 'aluno';

-- ---------------------------------------------------------------------------
-- 3. Reprecifica só o 4º trimestre de 2026 com os valores novos
-- ---------------------------------------------------------------------------

UPDATE "Pedidos_Revistas_Itens" pri
SET "precoUnitario" = pr.preco
FROM "Pedidos_Revistas" p, "Precos_Revistas" pr
WHERE pri."pedidoId" = p.id
  AND p.trimestre = '4T-2026'
  AND pr.categoria = pri.categoria
  AND pr.key = pri.tipo;

-- ---------------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------------

SELECT categoria, key, label, preco
FROM "Precos_Revistas"
ORDER BY categoria, key;

SELECT
  count(*) FILTER (WHERE tipo IN ('aluno', 'professor')) AS "itens ainda no formato antigo (deve ser 0)",
  count(*)                                                AS "itens no total"
FROM "Pedidos_Revistas_Itens";

SELECT p.trimestre, pri.categoria, pri.tipo, pri.quantidade, pri."precoUnitario"
FROM "Pedidos_Revistas_Itens" pri
JOIN "Pedidos_Revistas" p ON p.id = pri."pedidoId"
WHERE p.trimestre = '4T-2026'
ORDER BY pri.categoria, pri.tipo;
