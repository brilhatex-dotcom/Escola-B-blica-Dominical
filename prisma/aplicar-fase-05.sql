-- ============================================================================
-- FASE 05 — PESSOAS E CARGOS
-- Portal da Escola Bíblica Dominical · IEADPE Campo de Betânia
--
-- COMO USAR: cole este arquivo INTEIRO no SQL Editor do Neon e clique em Run.
--
-- É SEGURO RODAR COM O SISTEMA NO AR:
--   · não apaga nada;
--   · não renomeia nada;
--   · não altera nenhuma tabela existente, exceto acrescentar uma coluna nova
--     e opcional em "Usuarios" (pessoaId), que nasce vazia em todas as linhas.
--
-- É SEGURO RODAR DUAS VEZES: cada comando tem guarda própria, então executar de
-- novo não duplica nada nem dá erro.
--
-- Os alunos, as frequências e todo o resto continuam intactos.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- PARTE 1 de 2 — as tabelas novas
-- ────────────────────────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS "pessoaId" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Pessoas" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tratamento" TEXT,
    "chave" TEXT NOT NULL,
    "tel" TEXT,
    "email" TEXT,
    "foto" TEXT,
    "nasc" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "revisar" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pessoas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Cargos" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "escopo" TEXT NOT NULL,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PessoaCargos" (
    "id" SERIAL NOT NULL,
    "pessoaId" INTEGER NOT NULL,
    "cargoId" INTEGER NOT NULL,
    "congId" INTEGER,
    "classeId" INTEGER,
    "inicio" DATE,
    "fim" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "origem" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PessoaCargos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Pessoas_chave_key" ON "Pessoas"("chave");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Pessoas_nome_idx" ON "Pessoas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Cargos_nome_key" ON "Cargos"("nome");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cargos_ordem_idx" ON "Cargos"("ordem");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PessoaCargos_pessoaId_idx" ON "PessoaCargos"("pessoaId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PessoaCargos_cargoId_idx" ON "PessoaCargos"("cargoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PessoaCargos_congId_idx" ON "PessoaCargos"("congId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PessoaCargos_classeId_idx" ON "PessoaCargos"("classeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PessoaCargos_pessoaId_cargoId_congId_classeId_key" ON "PessoaCargos"("pessoaId", "cargoId", "congId", "classeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Usuarios_pessoaId_key" ON "Usuarios"("pessoaId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Usuarios" ADD CONSTRAINT "Usuarios_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PessoaCargos" ADD CONSTRAINT "PessoaCargos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PessoaCargos" ADD CONSTRAINT "PessoaCargos_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PessoaCargos" ADD CONSTRAINT "PessoaCargos_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PessoaCargos" ADD CONSTRAINT "PessoaCargos_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- O buraco do UNIQUE com colunas nulas
--
-- O indice que o Prisma gerou acima nao impede duplicata em cargo de CAMPO.
-- Motivo: em Postgres, NULL nao e igual a NULL, entao duas linhas
-- (pessoa 1, cargo 1, NULL, NULL) sao consideradas diferentes e as duas entram.
-- Na pratica, o Pastor Presidente poderia ser cadastrado duas vezes e o
-- Dashboard passaria a contar dois cargos ocupados onde ha um.
--
-- `NULLS NOT DISTINCT` (Postgres 15+) faz o banco tratar dois nulos como
-- iguais, que e o que a regra de negocio quer dizer. Neon roda 16/17.
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS "PessoaCargos_pessoaId_cargoId_congId_classeId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "PessoaCargos_vinculo_unico"
  ON "PessoaCargos" ("pessoaId", "cargoId", "congId", "classeId")
  NULLS NOT DISTINCT;

-- ----------------------------------------------------------------------------
-- Cargos oficiais do campo.
--
-- Entram na migration, e nao no seed, porque sao ESTRUTURA: o card
-- "Liderança do Campo" ordena por `ordem`, e sem estas linhas ele nao tem o que
-- ordenar. `ON CONFLICT DO NOTHING` deixa a migration repetivel.
--
-- A numeracao pula de 10 em 10 para caber um cargo novo no meio — entre
-- Supervisor e Secretario, por exemplo — sem renumerar os outros.
-- ----------------------------------------------------------------------------
INSERT INTO "Cargos" ("nome", "ordem", "escopo", "destaque", "ativo") VALUES
  ('Pastor Presidente',          10, 'campo',        true,  true),
  ('Gestor Local',               20, 'campo',        true,  true),
  ('Supervisor da EBD',          30, 'campo',        true,  true),
  ('Secretário',                 40, 'campo',        true,  true),
  ('Secretário Auxiliar',        50, 'campo',        true,  true),
  ('Coordenador de Congregação', 60, 'congregacao',  false, true),
  ('Dirigente',                  70, 'congregacao',  false, true),
  ('Professor',                  80, 'classe',       false, true),
  ('Secretário de Classe',       90, 'classe',       false, true),
  ('Auxiliar',                  100, 'classe',       false, true)
ON CONFLICT ("nome") DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────
-- PARTE 2 de 2 — as pessoas apuradas do cadastro antigo
--
-- 59 pessoas e 68 cargos, extraídos do campo "prof" das classes
-- (texto livre) e da liderança do campo.
--
-- 5 ficam marcadas com revisar = true: são possíveis duplicatas que o sistema
-- NÃO fundiu por conta própria — quem decide é a secretaria. Elas aparecem num
-- aviso no Dashboard, que leva à lista.
-- ────────────────────────────────────────────────────────────────────────────

-- 59 pessoas
INSERT INTO "Pessoas" (nome, tratamento, chave, revisar, observacao, "atualizado") VALUES
  ('Aílton José Alves', 'Pr.', 'ailton jose alves', false, NULL, now()),
  ('Alexandra', NULL, 'alexandra', false, NULL, now()),
  ('Ana costa', NULL, 'ana costa', true, 'pode ser a mesma pessoa que: "Ana maria da costa" · pode ser a mesma pessoa que: "Ana Maria costa"', now()),
  ('Ana Maria costa', NULL, 'ana maria costa', true, 'pode ser a mesma pessoa que: "Ana costa" · pode ser a mesma pessoa que: "Ana maria da costa"', now()),
  ('Ana maria da costa', NULL, 'ana maria da costa', true, 'pode ser a mesma pessoa que: "Ana costa" · pode ser a mesma pessoa que: "Ana Maria costa"', now()),
  ('Andreyna Magalhaes', NULL, 'andreyna magalhaes', true, 'grafia muito parecida com: "Andreyna Magslhaes"', now()),
  ('Andreyna Magslhaes', NULL, 'andreyna magslhaes', true, 'grafia muito parecida com: "Andreyna Magalhaes"', now()),
  ('Auzenir', NULL, 'auzenir', false, NULL, now()),
  ('Beto', 'Dc.', 'beto', false, NULL, now()),
  ('CÍCERO PEIXOTO', NULL, 'cicero peixoto', false, NULL, now()),
  ('Cida Souza', 'Ir.ª', 'cida souza', false, NULL, now()),
  ('Cláudia', 'Ir.ª', 'claudia', false, NULL, now()),
  ('Daniela', 'Ir.ª', 'daniela', false, NULL, now()),
  ('Danilo', 'Aux.', 'danilo', false, NULL, now()),
  ('Dayan Cristian', 'Aux.', 'dayan cristian', false, NULL, now()),
  ('Dida', 'Ir.ª', 'dida', false, NULL, now()),
  ('Edvaldo', 'Dc.', 'edvaldo', false, NULL, now()),
  ('Eliane Santos', NULL, 'eliane santos', false, NULL, now()),
  ('Elielma', 'Ir.ª', 'elielma', false, NULL, now()),
  ('elisangela', NULL, 'elisangela', false, NULL, now()),
  ('Elvys Danilo', 'Aux.', 'elvys danilo', false, NULL, now()),
  ('Elyne', NULL, 'elyne', false, NULL, now()),
  ('Enoque Carlos do Nascimento', 'Pr.', 'enoque carlos do nascimento', false, NULL, now()),
  ('Erika', NULL, 'erika', false, NULL, now()),
  ('Espedito', NULL, 'espedito', false, NULL, now()),
  ('Gislayne Martins', NULL, 'gislayne martins', false, NULL, now()),
  ('Irenilda', NULL, 'irenilda', false, NULL, now()),
  ('Jessica', NULL, 'jessica', false, NULL, now()),
  ('José Raimundo', 'Pb.', 'jose raimundo', false, NULL, now()),
  ('Josinaldo', NULL, 'josinaldo', false, NULL, now()),
  ('Josival', 'Dc.', 'josival', false, NULL, now()),
  ('Jucelino', 'Pb.', 'jucelino', false, NULL, now()),
  ('Juclenio raimundo dos santod', NULL, 'juclenio raimundo dos santod', false, NULL, now()),
  ('Laudeceia', 'Ir.ª', 'laudeceia', false, NULL, now()),
  ('Lourival', 'Pb.', 'lourival', false, NULL, now()),
  ('Luiz Jose', NULL, 'luiz jose', false, NULL, now()),
  ('Luiz Neto', 'Aux.', 'luiz neto', false, NULL, now()),
  ('Luzinete', NULL, 'luzinete', false, NULL, now()),
  ('Marcos', 'Ir.', 'marcos', false, NULL, now()),
  ('Maria Ildenir', NULL, 'maria ildenir', false, NULL, now()),
  ('Maria José', NULL, 'maria jose', false, NULL, now()),
  ('Mathias', 'Pb.', 'mathias', false, NULL, now()),
  ('Maurício Silva', 'Ir.', 'mauricio silva', false, NULL, now()),
  ('Miguel', NULL, 'miguel', false, NULL, now()),
  ('Miguel jose fos santos', NULL, 'miguel jose fos santos', false, NULL, now()),
  ('Nalda', 'Ir.ª', 'nalda', false, NULL, now()),
  ('Nelson', 'Aux.', 'nelson', false, NULL, now()),
  ('NEUZA', NULL, 'neuza', false, NULL, now()),
  ('Oseias', NULL, 'oseias', false, NULL, now()),
  ('Raila', NULL, 'raila', false, NULL, now()),
  ('Reginaldo', 'Pb.', 'reginaldo', false, NULL, now()),
  ('Renata Dione da Silva', NULL, 'renata dione da silva', false, NULL, now()),
  ('Rosimere', NULL, 'rosimere', false, NULL, now()),
  ('Rosimere Araújo', 'Ir.ª', 'rosimere araujo', false, NULL, now()),
  ('Shirly', NULL, 'shirly', false, NULL, now()),
  ('Silva', 'Ir.ª', 'silva', false, NULL, now()),
  ('Silverio', 'Aux.', 'silverio', false, NULL, now()),
  ('Sônia', NULL, 'sonia', false, NULL, now()),
  ('Vanessa', NULL, 'vanessa', false, NULL, now())
ON CONFLICT (chave) DO NOTHING;

-- 68 vínculos pessoa-cargo
--
-- Ligados por NOME do cargo e CHAVE da pessoa, e não por id: os ids são
-- gerados pelo banco na Parte 1 e não dá para saber quais serão de antemão.
INSERT INTO "PessoaCargos" ("pessoaId", "cargoId", "congId", "classeId", origem)
SELECT p.id, c.id, d."congId", d."classeId", d.origem
FROM (VALUES
  ('ailton jose alves', 'Pastor Presidente', NULL::int, NULL::int, NULL),
  ('alexandra', 'Professor', 4, 39, 'Alexandra'),
  ('alexandra', 'Professor', 4, 16, 'Alexandra'),
  ('ana costa', 'Professor', 7, 33, 'Ana costa'),
  ('ana costa', 'Professor', 7, 35, 'Ana costa'),
  ('ana maria costa', 'Professor', 7, 47, 'Ana Maria costa'),
  ('ana maria da costa', 'Professor', 7, 45, 'Ana maria da costa'),
  ('andreyna magalhaes', 'Professor', 7, 48, 'Andreyna Magalhaes'),
  ('andreyna magslhaes', 'Professor', 7, 46, 'Andreyna Magslhaes'),
  ('auzenir', 'Professor', 8, 25, 'Auzenir'),
  ('beto', 'Professor', 5, 24, 'Pb. Reginaldo e Dc. Beto'),
  ('cicero peixoto', 'Professor', 13, 18, 'CÍCERO PEIXOTO E NEUZA'),
  ('cida souza', 'Professor', 1, 37, 'Irmã Cida Souza e Irmã Cláudia'),
  ('claudia', 'Professor', 1, 37, 'Irmã Cida Souza e Irmã Cláudia'),
  ('daniela', 'Professor', 1, 49, 'Irmã Laudeceia e Irmã Daniela'),
  ('danilo', 'Professor', 1, 1, 'Pb. Lourival e Aux. Danilo'),
  ('danilo', 'Professor', 1, 15, 'Pb.Lourival e Aux. Danilo'),
  ('dayan cristian', 'Professor', 6, 8, 'Aux. Dayan Cristian'),
  ('dida', 'Professor', 1, 26, 'Irmã Dida e Irmã Nalda'),
  ('edvaldo', 'Professor', 6, 7, 'Dc. Edvaldo'),
  ('eliane santos', 'Professor', 3, 51, 'Eliane Santos'),
  ('elielma', 'Professor', 1, 50, 'Irmã Elielma e Elyne'),
  ('elisangela', 'Professor', 7, 10, 'Jessica e elisangela'),
  ('elisangela', 'Professor', 7, 13, 'Jéssica e Elisângela'),
  ('elvys danilo', 'Secretário Auxiliar', NULL::int, NULL::int, NULL),
  ('elyne', 'Professor', 1, 50, 'Irmã Elielma e Elyne'),
  ('enoque carlos do nascimento', 'Gestor Local', NULL::int, NULL::int, NULL),
  ('erika', 'Professor', 4, 19, 'Erika'),
  ('espedito', 'Professor', 2, 12, 'Josinaldo e Espedito'),
  ('gislayne martins', 'Professor', 3, 52, 'Gislayne Martins'),
  ('gislayne martins', 'Professor', 3, 56, 'Gislayne Martins'),
  ('irenilda', 'Professor', 5, 11, 'Irenilda'),
  ('jessica', 'Professor', 7, 10, 'Jessica e elisangela'),
  ('jessica', 'Professor', 7, 13, 'Jéssica e Elisângela'),
  ('jose raimundo', 'Supervisor da EBD', NULL::int, NULL::int, NULL),
  ('josinaldo', 'Professor', 2, 12, 'Josinaldo e Espedito'),
  ('josival', 'Professor', 1, 20, 'Dc.Josival e Aux. Nelson'),
  ('jucelino', 'Professor', 7, 21, 'Pb. Jucelino e Miguel'),
  ('juclenio raimundo dos santod', 'Professor', 7, 44, 'Juclenio raimundo dos santod'),
  ('laudeceia', 'Professor', 1, 49, 'Irmã Laudeceia e Irmã Daniela'),
  ('lourival', 'Professor', 1, 1, 'Pb. Lourival e Aux. Danilo'),
  ('lourival', 'Professor', 1, 15, 'Pb.Lourival e Aux. Danilo'),
  ('luiz jose', 'Professor', 4, 22, 'Luiz Jose'),
  ('luiz neto', 'Secretário', NULL::int, NULL::int, NULL),
  ('luzinete', 'Professor', 4, 14, 'Luzinete'),
  ('marcos', 'Professor', 10, 17, 'irmão Marcos'),
  ('marcos', 'Professor', 10, 31, 'Irmãos Marcos'),
  ('maria ildenir', 'Professor', 3, 53, 'Maria Ildenir'),
  ('maria jose', 'Professor', 8, 29, 'Maria José'),
  ('mathias', 'Professor', 9, 9, 'Pb. Mathias'),
  ('mauricio silva', 'Professor', 1, 38, 'Irmão Maurício Silva'),
  ('miguel', 'Professor', 7, 21, 'Pb. Jucelino e Miguel'),
  ('miguel jose fos santos', 'Professor', 7, 43, 'Miguel jose fos santos'),
  ('nalda', 'Professor', 1, 26, 'Irmã Dida e Irmã Nalda'),
  ('nelson', 'Professor', 1, 20, 'Dc.Josival e Aux. Nelson'),
  ('neuza', 'Professor', 13, 18, 'CÍCERO PEIXOTO E NEUZA'),
  ('oseias', 'Professor', 8, 30, 'Dirigente Oseias'),
  ('raila', 'Professor', 5, 28, 'Raila'),
  ('reginaldo', 'Professor', 5, 24, 'Pb. Reginaldo e Dc. Beto'),
  ('renata dione da silva', 'Professor', 13, 40, 'Renata Dione da Silva'),
  ('rosimere', 'Professor', 6, 6, 'Rosimere'),
  ('rosimere araujo', 'Professor', 1, 36, 'Irmã Rosimere Araújo'),
  ('shirly', 'Professor', 10, 41, 'Shirly'),
  ('silva', 'Professor', 2, 3, 'Ir.ª Silva'),
  ('silverio', 'Professor', 12, 4, 'Aux. Silverio'),
  ('silverio', 'Professor', 12, 55, 'Silvério'),
  ('sonia', 'Professor', 8, 27, 'Sônia,Vanessa'),
  ('vanessa', 'Professor', 8, 27, 'Sônia,Vanessa')
) AS d(chave, cargo, "congId", "classeId", origem)
JOIN "Pessoas" p ON p.chave = d.chave
JOIN "Cargos"  c ON c.nome  = d.cargo
-- Sem a classe cadastrada não há vínculo possível: pular em vez de falhar.
WHERE d."classeId" IS NULL OR EXISTS (SELECT 1 FROM "Classes" cl WHERE cl.id = d."classeId")
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA — o resultado tem de ser exatamente este:
--
--   pessoas_unicas    59
--   cargos_ocupados   68
--   acumulam_funcao   9
--   a_conferir        5
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM "Pessoas")                  AS pessoas_unicas,
  (SELECT count(*) FROM "PessoaCargos")             AS cargos_ocupados,
  (SELECT count(*) FROM (
     SELECT "pessoaId" FROM "PessoaCargos" GROUP BY 1 HAVING count(*) > 1
   ) x)                                             AS acumulam_funcao,
  (SELECT count(*) FROM "Pessoas" WHERE revisar)    AS a_conferir;
