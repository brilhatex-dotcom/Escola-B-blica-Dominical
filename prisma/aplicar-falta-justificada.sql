-- ===========================================================================
-- CHAMADA — FALTA JUSTIFICADA
--
-- Cole tudo no SQL Editor do Neon e clique em Run.
-- É seguro rodar com o sistema no ar e é seguro rodar duas vezes.
--
-- Cria UMA tabela nova, "Faltas_Justificadas". Nenhuma tabela antiga é
-- tocada: as chamadas, alunos e relatórios que já existem continuam iguais.
--
-- Enquanto este SQL não for rodado, a Chamada funciona normalmente — só o
-- botão "Justificada" fica escondido. Depois de rodar, ele aparece sozinho
-- em até um minuto, sem precisar publicar nada.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "Faltas_Justificadas" (
  "id"       SERIAL PRIMARY KEY,
  "alunoId"  INTEGER NOT NULL REFERENCES "Alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "classeId" INTEGER,
  "congId"   INTEGER,
  "data"     DATE NOT NULL,
  "motivo"   TEXT,
  "autor"    TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Faltas_Justificadas_alunoId_data_key"
  ON "Faltas_Justificadas" ("alunoId", "data");
CREATE INDEX IF NOT EXISTS "Faltas_Justificadas_congId_data_idx"
  ON "Faltas_Justificadas" ("congId", "data");
CREATE INDEX IF NOT EXISTS "Faltas_Justificadas_classeId_data_idx"
  ON "Faltas_Justificadas" ("classeId", "data");

-- Conferência — deve mostrar a tabela com 0 linhas
SELECT 'Faltas_Justificadas' AS tabela, count(*) AS linhas FROM "Faltas_Justificadas";
