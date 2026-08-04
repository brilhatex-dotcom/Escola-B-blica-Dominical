# Migração EBD: Google Apps Script → Postgres/Prisma

Origem: `data/EBD_EXPORT_2026-08-03_1343.json`
(export da planilha `1mFRh_sPmc863fLuXe5zHqKa-TLLcZcwgDnQhxHXVboI`, gerado em 2026-08-03T16:43:49Z, 22 abas).

---

## 1. Comandos — Neon via Vercel

### 1.1 Criar o banco

Na Vercel, dentro do projeto: aba **Storage** → **Create Database** → **Neon** →
região **South America (São Paulo)**. A integração cria o banco e injeta as
variáveis no projeto sozinha. Não precisa copiar nada.

### 1.2 Trazer as credenciais para a sua máquina

```bash
npx vercel login
npx vercel link        # associa esta pasta ao projeto na Vercel
npm run env:pull       # monta o .env com os nomes certos
```

O `env:pull` existe por um motivo específico: a integração Neon injeta as
variáveis com os nomes **dela** (`DATABASE_URL_UNPOOLED`, `PGHOST_UNPOOLED`…),
que não são os que o `schema.prisma` lê. O script identifica qual é a conexão
com pooler e qual é a direta, garante o `pgbouncer=true` só na primeira, e
escreve o `.env`. Ele entende os três formatos que as integrações usam
(Neon nativa, Vercel Postgres legado e genérico) e avisa em português se
faltar alguma.

Trocar as duas de lugar na mão é o erro mais comum desse caminho — e o erro que
o Postgres devolve não explica o que houve.

### 1.3 Migrar e importar

```bash
npm install
npm run db:generate                      # prisma generate
npm run db:seed:dry                      # ensaio: NÃO grava nada
npm run db:deploy                        # cria as 17 tabelas
npm run db:seed                          # importa
npm run db:studio                        # confere no navegador
```

Use **`db:deploy`**, não `db:migrate`. O `migration.sql` já está versionado e
foi validado contra um PostgreSQL 16 real; o `deploy` aplica exatamente aquele
SQL. O `migrate dev` só é necessário quando você **muda** o schema.

Outro arquivo de export: `npm run db:seed -- --file data/OUTRO.json`.

O seed é **idempotente** (upsert por PK): pode rodar quantas vezes quiser sem
duplicar.

### 1.4 O deploy do site não precisa de banco (ainda)

As duas telas são estáticas — nenhuma delas importa o Prisma:

```
Route (app)                    Size  First Load JS
┌ ○ /                          99 kB        201 kB     ○ (Static)
```

Ou seja: **a migração e a importação são uma operação única, feita da sua
máquina contra o Neon.** O deploy na Vercel não precisa de nenhuma variável de
banco por enquanto, e não há risco de o build tentar migrar sozinho.

Isso muda quando entrarem as rotas de API (login de verdade). Aí:

1. em **Settings → Environment Variables**, garanta que `DATABASE_URL` tenha
   `&pgbouncer=true` no fim — a URL que a integração injeta costuma vir sem, e
   sem isso o Prisma falha em runtime com erro de prepared statement;
2. adicione `DIRECT_URL` com a conexão **sem** `-pooler` no host;
3. só então, se quiser migrations automáticas a cada deploy, troque o build para
   `prisma migrate deploy && next build`.

**Nunca coloque o seed no build.** Ele importa 4.700 linhas e é uma operação
única, não algo para repetir a cada deploy.

### 1.5 Já foi testado de ponta a ponta

Antes de qualquer banco de produção, a rodada completa foi executada contra um
PostgreSQL 16 real:

| Verificação | Resultado |
|---|---|
| `prisma migrate` aplica | 17 tabelas, 19 FKs, 23 índices |
| `db:seed` | 7,8s |
| Contagens conferidas no SQL puro | 319 / 2592 / 1671 — batem |
| Congregações | chegam nomeadas |
| Colisão de id | id 64 ficou com "Adão", como decidido |
| Aluno 164 | `classeId` nulo, como definido |
| FK é real | `INSERT` com classe inexistente **recusado** pelo banco |
| Rodar 2× | contagens idênticas, zero duplicata |

### 1.6 Se der errado

| Erro | Causa |
|---|---|
| `prepared statement "s0" already exists` | `DIRECT_URL` está apontando para a URL com `-pooler`. Rode `npm run env:pull` de novo |
| `Can't reach database server` | o banco Neon suspende após inatividade; a primeira conexão acorda e pode demorar alguns segundos — tente de novo |
| `P3005: The database schema is not empty` | o banco já tem tabelas. Use um banco novo ou `npm run db:reset` (**apaga tudo**) |
| `Environment variable not found: DIRECT_URL` | o `.env` não foi gerado. Rode `npm run env:pull` |

> O `db:seed` carrega o `.env` por conta própria (`process.loadEnvFile`). Isso
> não é automático: o CLI do Prisma lê o arquivo sozinho, mas um script em Node
> puro não — e sem esse cuidado o `db:deploy` funcionava e o `db:seed` falhava
> dizendo que a variável não existe, com o arquivo correto ali do lado.

### O que o dry-run mostra hoje

```
Alunos              319  OK  (323 no export − 4 por id repetido)
Frequencias        2592  OK  (2599 no export − 7 por id repetido)
Auditoria          1671  OK  (1679 no export − 8 por id repetido)
Classes / Usuarios / Freq_Licao ....... OK
```

---

## 2. O que o export contém

22 abas. Com dados:

| Aba | Linhas | Aba | Linhas |
|---|---:|---|---:|
| Usuarios | 19 | Licoes | 228 |
| Classes | 53 | Ofertas | 20 |
| Alunos | 323 | Visitantes | 89 |
| Frequencias | 2599 | Precos_Revistas | 35 |
| Freq_Licao | 65 | Parametros | 2 |
| Reunioes | 13 | Auditoria | 1679 |
| Escala_Cultos | 1 | Versiculos | 50 |
| Eventos | 1 | Avisos | 1 |

**Vazias (0 linhas)** — sem model, porque não há como inferir os campos:
`Pedidos_Revistas`, `Obs_Alunos`, `Visitas_Pastorais`, `Reunioes_Presenca`,
`EBD_Animada`, `Subsidios`.

---

## 3. Decisões tomadas

### 3.1 Colisão de id → **sobrescrever** (decisão do responsável)

A planilha reaproveitou números de matrícula, e alguns ids pertencem a **dois
registros diferentes**. Como num banco o id é único, alguma coisa tem de ceder.

Modo escolhido: **`ON_ID_COLLISION = "sobrescrever"`** em `prisma/seed.ts`. O id
da planilha é mantido sem exceção e a segunda ocorrência sobrescreve a primeira.
**19 registros do export não entram** — 4 alunos, 7 frequências, 8 auditorias.

Os 4 alunos perdidos, nomeados no log a cada execução:

| id | Sai | Fica |
|---|---|---|
| 64 | Cecília (Quixabeira) | Adão (Boqueirão) |
| 66 | Sofia (Quixabeira) | Henrique da Silva Barbosa (Carnaubinha) |
| 73 | EdnaCacielia (Bandeiras) | Irmã Sônia (Templo Sede) |
| 83 | Irmã Helena (Templo Sede) | Lucas Emanuel (Bandeiras) |

**Efeito colateral:** as frequências seguem o id, não a pessoa. **37 frequências
mudam de dono** (11 da Cecília → Adão, 11 da Sofia → Henrique, 9 da EdnaCacielia
→ Irmã Sônia, 6 da Irmã Helena → Lucas Emanuel). Não há como evitar mantendo o
id original: é a mesma matrícula apontando para duas pessoas.

> **Para não perder nada:** troque `ON_ID_COLLISION` para `"remapear"`. A
> primeira ocorrência mantém o id e a segunda ganha um id novo acima do máximo,
> guardando o antigo em `legacyId`. Nesse modo as contagens voltam a 323 / 2599
> / 1679, e as 81 frequências ambíguas são desempatadas por (congregação,
> classe) — todas as 81 resolvem para exatamente uma pessoa.

### 3.2 Congregações — derivadas e **nomeadas automaticamente**

Não existe aba `Congregacoes`, mas os nomes estavam no export o tempo todo: cada
`congId` tem um usuário coordenador cuja conta é a própria congregação
(`ebdbetania` → "Cong. Betânia"). O filtro por login iniciado em `ebd` separa as
contas institucionais das contas de pessoas.

| id | Nome | id | Nome |
|---:|---|---:|---|
| 1 | Templo Sede | 8 | Cong. Bredos Altos |
| 2 | Cong. Bandeiras | 9 | Cong. Carnaubinha |
| 3 | Cong. Betânia | 10 | Cong. Marianos |
| 4 | Cong. Pinheiro | 11 | Cong. Esperança |
| 5 | Cong. B.D. Quixabeira | 12 | Cong. Riacho do Saco |
| 6 | Cong. Riacho Fundo | 13 | Cong. M.D. Boqueirão |
| 7 | Cong. Bredos Baixo | 14 | Cong. Carnauba |

Duas observações:

- A congregação 1 tem duas contas ("Templo Sede" e "T. Matriz"); usei a primeira.
- As congregações **11 e 14 não têm nenhuma classe nem aluno** — só a conta do
  coordenador. Entram normalmente, prontas para receber cadastro.

O upsert usa `update: {}`, então **um nome corrigido no banco sobrevive** a novas
execuções do seed.

### 3.3 Aluno sem classe

**Luiz Simplício dos Santos** (id 164, 76 anos, Cong. Bredos Baixo) está na
classe 23, removida da planilha (junto das classes 5 e 42). Nenhuma frequência
dele existe.

Decisão: entra **sem classe**, com aviso no log. Basta colocá-lo na turma certa
pelo próprio sistema depois.

Se preferir resolver na importação, preencha `CLASSE_MANUAL` em `prisma/seed.ts`:

```ts
const CLASSE_MANUAL: Record<number, number> = {
  164: 21,  // Luiz Simplicio dos Santos -> Senhores
};
```

---

## 4. Limpezas pendentes (importar não resolve)

### 4.1 Classes duplicadas — 6 grupos, 14 classes

Mesma congregação, mesmo nome, mesma faixa. Confirmado como **duplicatas para
limpar depois**; a importação traz todas como estão.

Os professores denunciam a origem: são erros de digitação e recadastros.

| Congregação | Classe | Manter | Candidatas a remover |
|---|---|---|---|
| Templo Sede | Obreiros | **1** (10 alunos, 89 freq) | 15 (4 alunos, 3 freq) — "Pb.Lourival" sem espaço |
| Bandeiras | Classe única | **12** (8 alunos, 72 freq) | 32 (vazia) |
| Bredos Baixo | Classe juniores | **33** (11 alunos, 154 freq) | 35 (vazia) |
| Bredos Baixo | Juniores | — | 45, 46, 47, 48 (**todas vazias**) — "Ana maria da costa" / "Ana Maria costa", "Andreyna Magslhaes" / "Andreyna Magalhaes" |
| Bredos Baixo | Senhoras | **10** (7 alunos, 84 freq) | 13 (2 alunos, 0 freq) — "Jessica e elisangela" vs "Jéssica e Elisângela" |
| Bredos Baixo | Senhores | **21** (3 alunos, 30 freq) | 44 (vazia) |

**8 dessas classes estão completamente vazias** (0 alunos, 0 frequências) e podem
ser removidas sem consequência. Duas têm conteúdo e pedem cuidado: a **15** (4
alunos e 3 frequências) e a **13** (2 alunos) — antes de apagar, mova os alunos
para a classe que fica.

Para reproduzir a lista depois de importar:

```sql
SELECT c."congId", c.nome, c.faixa, c.id, c.prof,
       (SELECT count(*) FROM "Alunos" a WHERE a."classeId" = c.id)      AS alunos,
       (SELECT count(*) FROM "Frequencias" f WHERE f."classeId" = c.id) AS frequencias
FROM "Classes" c
WHERE (c."congId", c.nome, c.faixa) IN (
  SELECT "congId", nome, faixa FROM "Classes"
  GROUP BY "congId", nome, faixa HAVING count(*) > 1
)
ORDER BY c."congId", c.nome, alunos DESC;
```

### 4.2 Frequências repetidas no mesmo dia

`(alunoId, data)` se repete em **380 grupos** — 546 linhas além da primeira de
cada grupo. Desses, **43 grupos se contradizem** (`presente` true numa linha e
false na outra) e 14 divergem na classe.

Não foi feita deduplicação: as linhas entram como estão. Para listar:

```sql
SELECT "alunoId", data, count(*), array_agg(presente), array_agg("classeId")
FROM "Frequencias"
GROUP BY "alunoId", data HAVING count(*) > 1
ORDER BY 3 DESC;
```

### 4.3 Senhas

São SHA-256 sem salt, herdados da planilha, e o seed **não re-hasheia**. O
caminho sem atrito: no primeiro login correto, o servidor confere o SHA-256 e
re-grava em bcrypt/argon2 — a base migra sozinha, sem forçar ninguém a trocar de
senha.

---

## 5. Decisões de tipagem (inferidas dos dados reais)

- **`senha`**: `String`. Hash SHA-256 herdado, sem re-hash.
- **`ativo` / `ativa` / `presente`**: `Boolean`.
- **`congId` / `classeId`**: `Int?` em todas as tabelas — vêm ora como número,
  ora como `""`, e a importação converte `""` em `null`.
- **`tel`**: `String?`, não `Int`. No JSON vem como número (ex.: `87981418516`),
  que **estoura Int32** — e telefone não é aritmética.
- **Datas `YYYY-MM-DD`**: `DateTime @db.Date`, em UTC meia-noite (imune a fuso).
- **Timestamps ISO** (`registradoEm`, `when`): `DateTime`.
- **Dinheiro** (`Ofertas.valor`, `Precos_Revistas.preco`, `Parametros.valor`):
  `Decimal @db.Decimal(10,2)`, não `Float`.
- **`Reunioes.participantes`**: no JSON é uma **string** com JSON serializado.
  As 13 linhas foram validadas e são parseadas para `Json` (jsonb).
- **`Precos_Revistas`** não tem coluna `id`; PK composta `@@id([key, categoria])`
  (única nas 35 linhas). **`Parametros`** usa `parametro` como `@id`.

---

## 6. Scripts

| Script | Faz |
|---|---|
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` (produção) |
| `npm run db:seed` | importa o JSON para o banco |
| `npm run db:seed:dry` | valida e conta, sem gravar |
| `npm run db:reset` | `prisma migrate reset` (apaga tudo e re-semeia) |
| `npm run db:studio` | abre o Prisma Studio |
