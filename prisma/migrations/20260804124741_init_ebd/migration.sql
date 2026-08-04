-- CreateTable
CREATE TABLE "Congregacoes" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Congregacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuarios" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "nome" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "perfil" TEXT NOT NULL,
    "congId" INTEGER,
    "classeId" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classes" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "nome" TEXT NOT NULL,
    "faixa" TEXT NOT NULL,
    "prof" TEXT,
    "tipoClasse" TEXT NOT NULL,
    "congId" INTEGER,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alunos" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "nome" TEXT NOT NULL,
    "nasc" DATE,
    "tel" TEXT,
    "resp" TEXT,
    "congId" INTEGER,
    "classeId" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Alunos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Frequencias" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "alunoId" INTEGER NOT NULL,
    "classeId" INTEGER,
    "congId" INTEGER,
    "data" DATE NOT NULL,
    "presente" BOOLEAN NOT NULL,

    CONSTRAINT "Frequencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Freq_Licao" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "classeId" INTEGER,
    "congId" INTEGER,
    "data" DATE NOT NULL,
    "licaoId" INTEGER NOT NULL,
    "licaoTitulo" TEXT NOT NULL,

    CONSTRAINT "Freq_Licao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Licoes" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "ano" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "escopo" TEXT NOT NULL,
    "tipoClasse" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "trim" TEXT NOT NULL,
    "classeId" INTEGER,
    "congId" INTEGER,

    CONSTRAINT "Licoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ofertas" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "classeId" INTEGER,
    "congId" INTEGER,
    "data" DATE NOT NULL,
    "obs" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Ofertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visitantes" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "nome" TEXT NOT NULL,
    "idade" INTEGER,
    "tel" TEXT,
    "obs" TEXT,
    "classeId" INTEGER,
    "congId" INTEGER,
    "data" DATE NOT NULL,

    CONSTRAINT "Visitantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Precos_Revistas" (
    "key" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Precos_Revistas_pkey" PRIMARY KEY ("key","categoria")
);

-- CreateTable
CREATE TABLE "Parametros" (
    "parametro" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Parametros_pkey" PRIMARY KEY ("parametro")
);

-- CreateTable
CREATE TABLE "Reunioes" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "local" TEXT,
    "obs" TEXT,
    "autor" TEXT NOT NULL,
    "participantes" JSONB NOT NULL,
    "presentes" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reunioes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escala_Cultos" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "titulo" TEXT NOT NULL,
    "mesAno" DATE NOT NULL,
    "dataUpload" DATE NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlPreview" TEXT NOT NULL,
    "obs" TEXT,
    "autor" TEXT NOT NULL,
    "congId" INTEGER,

    CONSTRAINT "Escala_Cultos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Eventos" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "local" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "obs" TEXT,
    "congId" INTEGER,

    CONSTRAINT "Eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avisos" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "prioridade" INTEGER NOT NULL,
    "dataPublicacao" DATE NOT NULL,
    "dataExpiracao" DATE NOT NULL,
    "autor" TEXT NOT NULL,
    "congId" INTEGER,

    CONSTRAINT "Avisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "when" TIMESTAMP(3) NOT NULL,
    "who" TEXT NOT NULL,
    "whoLogin" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "desc" TEXT NOT NULL,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Versiculos" (
    "id" INTEGER NOT NULL,
    "legacyId" INTEGER,
    "ref" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Versiculos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuarios_login_key" ON "Usuarios"("login");

-- CreateIndex
CREATE INDEX "Usuarios_congId_idx" ON "Usuarios"("congId");

-- CreateIndex
CREATE INDEX "Usuarios_classeId_idx" ON "Usuarios"("classeId");

-- CreateIndex
CREATE INDEX "Classes_congId_idx" ON "Classes"("congId");

-- CreateIndex
CREATE INDEX "Alunos_congId_idx" ON "Alunos"("congId");

-- CreateIndex
CREATE INDEX "Alunos_classeId_idx" ON "Alunos"("classeId");

-- CreateIndex
CREATE INDEX "Frequencias_alunoId_idx" ON "Frequencias"("alunoId");

-- CreateIndex
CREATE INDEX "Frequencias_classeId_idx" ON "Frequencias"("classeId");

-- CreateIndex
CREATE INDEX "Frequencias_congId_idx" ON "Frequencias"("congId");

-- CreateIndex
CREATE INDEX "Frequencias_data_idx" ON "Frequencias"("data");

-- CreateIndex
CREATE INDEX "Freq_Licao_classeId_idx" ON "Freq_Licao"("classeId");

-- CreateIndex
CREATE INDEX "Freq_Licao_congId_idx" ON "Freq_Licao"("congId");

-- CreateIndex
CREATE INDEX "Freq_Licao_licaoId_idx" ON "Freq_Licao"("licaoId");

-- CreateIndex
CREATE INDEX "Licoes_congId_idx" ON "Licoes"("congId");

-- CreateIndex
CREATE INDEX "Ofertas_classeId_idx" ON "Ofertas"("classeId");

-- CreateIndex
CREATE INDEX "Ofertas_congId_idx" ON "Ofertas"("congId");

-- CreateIndex
CREATE INDEX "Visitantes_classeId_idx" ON "Visitantes"("classeId");

-- CreateIndex
CREATE INDEX "Visitantes_congId_idx" ON "Visitantes"("congId");

-- CreateIndex
CREATE INDEX "Escala_Cultos_congId_idx" ON "Escala_Cultos"("congId");

-- CreateIndex
CREATE INDEX "Eventos_congId_idx" ON "Eventos"("congId");

-- CreateIndex
CREATE INDEX "Avisos_congId_idx" ON "Avisos"("congId");

-- CreateIndex
CREATE INDEX "Auditoria_when_idx" ON "Auditoria"("when");

-- CreateIndex
CREATE INDEX "Auditoria_whoLogin_idx" ON "Auditoria"("whoLogin");

-- AddForeignKey
ALTER TABLE "Usuarios" ADD CONSTRAINT "Usuarios_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuarios" ADD CONSTRAINT "Usuarios_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classes" ADD CONSTRAINT "Classes_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alunos" ADD CONSTRAINT "Alunos_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alunos" ADD CONSTRAINT "Alunos_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frequencias" ADD CONSTRAINT "Frequencias_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Alunos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frequencias" ADD CONSTRAINT "Frequencias_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frequencias" ADD CONSTRAINT "Frequencias_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Freq_Licao" ADD CONSTRAINT "Freq_Licao_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Freq_Licao" ADD CONSTRAINT "Freq_Licao_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Freq_Licao" ADD CONSTRAINT "Freq_Licao_licaoId_fkey" FOREIGN KEY ("licaoId") REFERENCES "Licoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licoes" ADD CONSTRAINT "Licoes_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ofertas" ADD CONSTRAINT "Ofertas_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ofertas" ADD CONSTRAINT "Ofertas_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visitantes" ADD CONSTRAINT "Visitantes_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visitantes" ADD CONSTRAINT "Visitantes_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escala_Cultos" ADD CONSTRAINT "Escala_Cultos_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Eventos" ADD CONSTRAINT "Eventos_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avisos" ADD CONSTRAINT "Avisos_congId_fkey" FOREIGN KEY ("congId") REFERENCES "Congregacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
