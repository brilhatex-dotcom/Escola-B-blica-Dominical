-- ===========================================================================
-- REDEFINIR A SENHA DA CONTA "admin"
--
-- Para quando o administrador ficou sem acesso e ninguém mais consegue entrar
-- para redefinir pela tela. Cole tudo no SQL Editor do Neon e clique em Run.
--
-- DEPOIS DE RODAR, entre com:
--     usuário: admin
--     senha:   Betania2026
--
-- TROQUE ESSA SENHA assim que entrar (menu do seu nome → trocar senha). Ela
-- está escrita aqui, neste arquivo, que fica no repositório — então serve para
-- destravar, não para ficar.
--
-- O QUE ESTE ARQUIVO FAZ, E POR QUÊ
--
-- Grava um hash bcrypt (não o SHA-256 antigo) só na conta `admin`. As outras 18
-- contas não são tocadas: a regra da igreja é não alterar registro do sistema
-- antigo por conta própria, e aqui a alteração é uma só, pedida, e na conta de
-- quem pediu.
--
-- O hash abaixo corresponde EXATAMENTE à senha Betania2026. Ele foi gerado com
-- bcrypt fator 12 — o mesmo que o portal usa quando alguém troca a senha pela
-- tela —, então a conta já entra no formato novo e seguro, sem passar de novo
-- pela senha compartilhada.
-- ===========================================================================

UPDATE "Usuarios"
SET "senha" = '$2b$12$DMV1oZ.32dLY46ee7SuOfun4NbcqnAVOt3Ig06cCiEydy30aapCBm',
    "ativo" = true
WHERE "login" = 'admin';

-- Conferência — deve devolver 1 linha, com a conta admin ativa
SELECT "id", "login", "nome", "ativo",
       left("senha", 4) AS formato_do_hash   -- '$2b$' = bcrypt (novo e seguro)
FROM "Usuarios"
WHERE "login" = 'admin';
