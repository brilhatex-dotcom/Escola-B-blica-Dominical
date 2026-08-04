-- ============================================================================
-- PESSOAS E CARGOS
--
-- Migration ADITIVA: nao apaga, nao renomeia e nao altera nenhuma tabela do
-- sistema antigo. As 323 linhas de Alunos, as 2.599 de Frequencias e as demais
-- continuam exatamente como estao. A unica mudanca em tabela existente e uma
-- coluna NOVA e opcional em Usuarios (pessoaId), que nasce nula em todas as
-- linhas e portanto nao pode quebrar nada.
--
-- Da para rodar esta migration com o sistema no ar.
-- ============================================================================


-- AlterTable
ALTER TABLE "Usuarios" ADD COLUMN     "pessoaId" INTEGER;

-- CreateTable
CREATE TABLE "Pessoas" (
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
CREATE TABLE "Cargos" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "escopo" TEXT NOT NULL,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PessoaCargos" (
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
CREATE UNIQUE INDEX "Pessoas_chave_key" ON "Pessoas"("chave");

-- CreateIndex
CREATE INDEX "Pessoas_nome_idx" ON "Pessoas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Cargos_nome_key" ON "Cargos"("nome");

-- CreateIndex
CREATE INDEX "Cargos_ordem_idx" ON "Cargos"("ordem");

-- CreateIndex
CREATE INDEX "PessoaCargos_pessoaId_idx" ON "PessoaCargos"("pessoaId");

-- CreateIndex
CREATE INDEX "PessoaCargos_cargoId_idx" ON "PessoaCargos"("cargoId");

-- CreateIndex
CREATE INDEX "PessoaCargos_congId_idx" ON "PessoaCargos"("congId");

-- CreateIndex
CREATE INDEX "PessoaCargos_classeId_idx" ON "PessoaCargos"("classeId");

-- CreateIndex
CREATE UNIQUE INDEX "PessoaCargos_pessoaId_cargoId_congId_classeId_key" ON "PessoaCargos"("pessoaId", "cargoId", "congId", "classeId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_pessoaId_key" ON "Usuarios"("pessoaId");

-- AddForeignKey
ALTER TABLE "Usuarios" ADD CONSTRAINT "Usuarios_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessoaCargos" ADD CONSTRAINT "PessoaCargos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessoaCargos" ADD CONSTRAINT "PessoaCargos_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessoaCargos" ADD CONSTRAINT "PessoaCargos_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessoaCargos" ADD CONSTRAINT "PessoaCargos_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;


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

CREATE UNIQUE INDEX "PessoaCargos_vinculo_unico"
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
