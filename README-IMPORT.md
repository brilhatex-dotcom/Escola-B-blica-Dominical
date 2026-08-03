# Migracao EBD: Google Apps Script -> Postgres/Prisma

Origem: `data/EBD_EXPORT_2026-08-03_1343.json`
(export da planilha `1mFRh_sPmc863fLuXe5zHqKa-TLLcZcwgDnQhxHXVboI`, gerado em 2026-08-03T16:43:49Z, 22 abas).

---

## 1. O que o export realmente contem

Inspecionadas as 22 abas. Com dados:

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

**Vazias (0 linhas)** — sem model no schema, porque nao ha como inferir os campos:
`Pedidos_Revistas`, `Obs_Alunos`, `Visitas_Pastorais`, `Reunioes_Presenca`,
`EBD_Animada`, `Subsidios`. Quando existir pelo menos uma linha (ou o cabecalho da
planilha), da para modelar.

---

## 2. Problemas encontrados nos dados (leia antes de migrar)

### 2.1 Nao existe aba `Congregacoes`

`congId` aparece em 11 abas com valores **1..14**, mas nao ha tabela de origem com
nome/dados das congregacoes.

**Decisao aplicada:** o model `Congregacao` e **derivado** — a importacao cria as 14
linhas a partir dos `congId` distintos, com `nome` vazio para voce preencher depois.
Isso permite FKs reais. O upsert usa `update: {}`, entao **os nomes que voce digitar
nao sao sobrescritos** em re-execucoes.

> Se preferir seguir a regra "onde nao houver tabela alvo, deixe so o campo Int?",
> basta remover o model `Congregacao` e as relacoes `congregacao` — os campos `congId`
> ja sao `Int?` e continuam funcionando sozinhos.

### 2.2 IDs repetidos — linhas DISTINTAS com o mesmo id

A planilha reaproveitou ids. Nao sao linhas duplicadas: sao registros diferentes.

| Tabela | ids colididos | linhas afetadas |
|---|---|---:|
| Alunos | 64, 66, 73, 83 | 8 |
| Frequencias | 864, 865, 866, 2355, 2356, 2357, 2358 | 14 |
| Auditoria | 225, 227, 237, 326, 332, 344, 359 | 16 |

Exemplo real — o id 64 e duas pessoas diferentes:

```json
{"id":64,"congId":5, "classeId":11,"nome":"Cecília","ativo":true}
{"id":64,"congId":13,"classeId":18,"nome":"Adão",   "ativo":true}
```

**Isto torna os requisitos originais incompativeis entre si:** usar o `id` da planilha
como `@id` + upsert por id faria a segunda linha sobrescrever a primeira, e as
contagens finais seriam **319 / 2592 / 1671** — nunca 323 / 2599 / 1679.

**Decisao aplicada (preserva as duas coisas):**
- `id` continua sendo `@id`, **sem autoincrement**.
- A **primeira** ocorrencia de cada id mantem o id original — ou seja, ~99% dos ids
  ficam intactos e **todos os relacionamentos existentes continuam validos**.
- As ocorrencias seguintes recebem um id novo acima do maximo (Alunos a partir de 320,
  Frequencias de 2593, Auditoria de 1672) e guardam o id da planilha em **`legacyId`**.
- Nenhuma linha e perdida: as contagens batem exatamente com as esperadas.

### 2.3 FKs das frequencias para alunos colididos

81 linhas de `Frequencias` apontam para os ids 64/66/73/83, que ficaram ambiguos.
A importacao desempata pelo par **(congId, classeId)** da propria frequencia:
**81 de 81 resolvem para exatamente 1 aluno**, sem ambiguidade e sem sobra.

### 2.4 Classe orfa

O aluno **164 (Luiz Simplício dos Santos)** aponta para a **classe 23, que nao existe**
(as classes 5, 23 e 42 foram removidas da planilha). Nenhuma frequencia referencia esse
aluno. A importacao grava `classeId = null` para ele e avisa no log.

### 2.5 Frequencias repetidas para o mesmo aluno no mesmo dia

`(alunoId, data)` se repete em **380 grupos** (546 linhas alem da primeira de cada grupo).
Desses, **43 grupos se contradizem** (`presente` true numa linha e false na outra) e
14 divergem na `classeId`.

**Nao foi feita deduplicacao** — as 2599 linhas sao importadas como estao, para bater com
o numero esperado. Mas isso e sujeira real da planilha e vale uma limpeza depois; para
listar os casos:

```sql
SELECT "alunoId", data, count(*), array_agg(presente)
FROM "Frequencias" GROUP BY "alunoId", data HAVING count(*) > 1 ORDER BY 3 DESC;
```

---

## 3. Decisoes de tipagem (inferidas dos dados reais)

- **`senha`**: `String`. Hash SHA-256 herdado, **nao e re-hasheado** na importacao.
- **`ativo` / `ativa` / `presente`**: `Boolean` (ja vem boolean real no JSON).
- **`congId` / `classeId`**: `Int?` em todas as tabelas, conforme pedido — vem ora como
  numero, ora como `""`, e a importacao converte `""` em `null`.
  (Na pratica `Classes.congId`, `Alunos.congId/classeId` e os das frequencias estao 100%
  preenchidos; da para apertar para obrigatorio depois se quiser.)
- **`tel`**: `String?`, nao `Int`. No JSON vem como numero (ex.: `87981418516`), que
  **estoura Int32** — e telefone nao e aritmetica.
- **Datas `YYYY-MM-DD`**: `DateTime @db.Date`, convertidas em UTC meia-noite (imune a fuso).
- **Timestamps ISO** (`registradoEm`, `when`): `DateTime` normal.
- **Dinheiro** (`Ofertas.valor`, `Precos_Revistas.preco`, `Parametros.valor`):
  `Decimal @db.Decimal(10,2)`, nao `Float`.
- **`Reunioes.participantes`**: no JSON e uma **string** com JSON serializado. As 13
  linhas foram validadas e sao parseadas para `Json` (jsonb).
- **`Precos_Revistas`** nao tem coluna `id`; PK composta **`@@id([key, categoria])`**
  (unica nas 35 linhas). **`Parametros`** usa `parametro` como `@id`.

---

## 4. Comandos

### 4.1 Configurar o banco

```bash
cp .env.example .env
# edite .env com as credenciais reais
```

`DATABASE_URL` = conexao com pooler (Supabase: porta 6543, `?pgbouncer=true`).
`DIRECT_URL` = conexao direta (porta 5432) — **migrations nao funcionam pelo pgbouncer**.

### 4.2 Instalar e gerar o client

```bash
npm install
npm run db:generate          # prisma generate
```

### 4.3 Conferir os numeros ANTES de tocar no banco

```bash
npm run db:seed:dry          # roda todas as conversoes, nao grava nada
```

Ja executado — saida atual:

```
Classes              53  OK (esperado 53)
Usuarios             19  OK (esperado 19)
Alunos              323  OK (esperado 323)
Frequencias        2599  OK (esperado 2599)
Freq_Licao           65  OK (esperado 65)
```

### 4.4 Criar a migration (so depois de revisar o schema)

```bash
npm run db:migrate -- --name init_ebd     # prisma migrate dev --name init_ebd
```

Em producao/CI, use `npm run db:deploy` (`prisma migrate deploy`).

### 4.5 Importar os dados

```bash
npm run db:seed
```

Outro arquivo de export:

```bash
npm run db:seed -- --file data/EBD_EXPORT_2026-08-03_1340.json
```

O seed e **idempotente** (upsert por PK): pode rodar quantas vezes quiser sem duplicar.
Ao final imprime a contagem de cada tabela e compara com os numeros esperados, saindo
com codigo 1 se algum divergir.

### 4.6 Inspecionar

```bash
npm run db:studio
```

---

## 5. Scripts disponiveis

| Script | Faz |
|---|---|
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` (producao) |
| `npm run db:seed` | importa o JSON para o banco |
| `npm run db:seed:dry` | valida e conta, sem gravar |
| `npm run db:reset` | `prisma migrate reset` (apaga tudo e re-semeia) |
| `npm run db:studio` | abre o Prisma Studio |

---

## 6. Pendencias para voce decidir

1. Preencher os `nome` das 14 congregacoes derivadas.
2. Decidir se quer deduplicar as 380 frequencias repetidas (43 contraditorias).
3. Confirmar se manter a `Congregacao` derivada ou deixar `congId` como inteiro solto.
4. Rehash das senhas para bcrypt/argon2 num proximo passo (hoje sao SHA-256 sem salt).
5. Modelar as 6 abas vazias quando houver dados ou o cabecalho da planilha.
