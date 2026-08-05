# Continuação — roadmap concluído (pós Fase 13)

> Este arquivo existe para que o trabalho continue numa sessão nova sem perder
> contexto. Cole o bloco abaixo como primeira mensagem.

---

## Contexto do projeto

**Portal da Escola Bíblica Dominical** — IEADPE, Campo de Betânia (PE).
Substitui um sistema antigo em Google Apps Script.

- Repositório: `brilhatex-dotcom/Escola-B-blica-Dominical`
- Branch de trabalho: `claude/ebd-schema-import-wwhi8a` (é a branch padrão; `main` recebe os mesmos pushes)
- Publicado em: `escola-b-blica-dominical.vercel.app`
- Banco: Neon Postgres, projeto **ebd-betania** (`us-east-1`)
- Leia o `README.md` primeiro — ele documenta as decisões de todas as fases

## Regras que não mudam

1. **A logomarca da IEADPE não pode ser alterada** — nem cores, proporções,
   formato ou tipografia. Efeitos só atrás ou em volta da arte.
2. **O vídeo oficial do drone não pode ser substituído.**
3. **Nunca alterar por conta própria um registro do sistema antigo.** Onde
   houver dúvida, marcar para revisão humana em vez de decidir.
4. **Uma fase por vez:** explicar brevemente o que será feito, desenvolver
   somente aquilo, e aguardar aprovação antes de seguir.
5. O usuário **não é programador** — instruções precisam ser passo a passo.
6. **As senhas ficam exatamente como estão** até a reunião da liderança.

## O que já está pronto

| Fase | Entrega |
|---|---|
| 01 | PWA instalável, Service Worker, camada offline (Dexie), Design System |
| 02 | Splash de 15s com o vídeo oficial, congelamento e login |
| 03 | Schema Prisma + importação do sistema antigo (323 alunos, 2.599 frequências) |
| 04 | Dashboard completo |
| 05 | Pessoas e cargos normalizados, API sobre o Postgres, 9 módulos |
| 06 | Autenticação real (bcrypt, JWT em cookie httpOnly, rotas protegidas) |
| 07 | Fila offline ligada na Chamada — grava no aparelho e reenvia sozinha |
| 08 | Menu em 6 categorias, permissões por papel (RBAC), Usuários, Permissões |
| 09 | Congregações, Aniversariantes, Lições, Pedido de Revistas |
| 10 | Relatórios: Ranking, Faltas, Ficha, Certificados, Auditoria |
| 11 | Agenda: Calendário, Eventos, Avisos, Reuniões |
| 12 | Administração e Configurações + auditoria gravando de verdade |
| 13 | **Pesquisa Global (com busca offline) sobre os registros** |

## O plano das próximas fases (aprovado)

As 13 fases planejadas estão entregues. O que vier a partir daqui é manutenção
e pedidos novos — não há mais fase pendente no roadmap aprovado.

## O que a Fase 13 entregou (para não refazer)

- **Busca global (Ctrl+K) em três fontes**: módulos (instantâneo), registros
  online (`/api/busca`) e registros offline (o espelho do aparelho). As três
  devolvem o mesmo formato.
- **A busca respeita permissão e recorte** — online e na descida do espelho.
  Cada categoria só entra se o acesso a enxerga; nada de porta dos fundos do
  RBAC.
- **Acento**: professores via `Pessoas.chave` normalizada; congregações
  filtradas em memória (14 linhas) para "betania" achar "Betânia"; a busca
  offline ignora acento em tudo. Alunos/visitantes online resolvem caixa, não
  acento (limitação já conhecida de `/api/alunos`).
- **A descida (`/api/sincronizar` + `lib/db/hidratar.ts`)** é o par da fila:
  espelha congregações, classes, alunos (com telefone) e visitantes no
  IndexedDB, recortado pelo acesso, com `uid` determinístico. Buscar sem
  internet devolve o telefone do aluno.
- **Professores não descem** (a tabela `Pessoas` não está no schema local); a
  busca offline cobre alunos, classes, congregações e visitantes.

## O que a Fase 12 entregou (para não refazer)

Oito telas — **o menu não tem mais nenhum "em breve"**.

- **A auditoria passou a ser GRAVADA.** Chamada, liderança, congregação, preços,
  login e backup. `lib/auditoria.ts` — `registrar()` **não lança e não entra na
  transação**: uma falha no log custa uma linha de auditoria, nunca a chamada da
  classe. Login RECUSADO não é registrado (a senha errada acabaria em claro).
- **Precisa do SQL:** `prisma/aplicar-fase-12.sql` cria a sequência do
  `Auditoria.id` apontando para `MAX(id)+1` e a coluna `congId`. Sem ele o
  portal funciona igual e a auditoria simplesmente não enche — a tela de Logs
  diz isso, com o caminho.
- **Congregações (cadastro) corrige o NOME e só.** O id é a chave de 9 tabelas;
  apagar deixaria órfão o histórico inteiro de uma congregação.
- **Hierarquia é leitura pura de `PessoaCargos`.** Quem acumula aparece duas
  vezes (é o que o organograma existe para mostrar); a CONTAGEM é de pessoas
  únicas. O recorte não corta cargo de campo. As 14 congregações aparecem
  marcadas como **sem dirigente** — só existem 5 cargos de campo e 63 de
  professor cadastrados.
- **Sistema separa o que salva (preços) do que é regra (só leitura).** O banco
  aparece pelo NOME da variável, nunca pela string de conexão.
- **Backup exige permissão de GRAVAÇÃO, não de leitura** — é o cadastro de 319
  crianças saindo do sistema. Senhas ficam de fora do arquivo. Toda geração é
  auditada.
- **Sincronização não oferece "limpar a fila"** e **Offline bloqueia a limpeza**
  enquanto houver pendência: os dois botões apagariam a chamada do domingo.
- **Escalas continua sendo um arquivo** (PDF no Drive), e a tela avisa quando o
  mês corrente não tem escala publicada.

## O que a Fase 11 entregou (para não refazer)

- **O calendário deduz os domingos** (`diaSemana === 0`) em vez de guardá-los numa
  tabela. Do banco vem só o que ele sabe: se houve chamada e qual lição.
- **"Domingo sem chamada" só conta domingo que já passou.** Sem isso, todo dia 5
  do mês o portal acusaria a igreja de três chamadas atrasadas que ainda nem
  tinham data.
- **Evento de vários dias continua acontecendo.** O calendário casa o mês por
  interseção (`data <= fim AND dataFim >= início`) e a lista de "próximos" filtra
  por `dataFim`, não por `data`.
- **Avisos vencidos ficam separados dos vigentes** — um aviso expirado pode estar
  errado e mandar a igreja para o lugar errado. Ficam acessíveis, não apagados.
- **`Reunioes.participantes` é JSON do sistema antigo**: a leitura confere
  `Array.isArray` antes de usar, e lista vazia vira `null` (sem lista), que não é
  a mesma coisa que "0 participantes".
- **CORRIGIDO:** `/api/agenda` estava **sem guarda de permissão** desde a Fase 05,
  mesmo defeito das quatro rotas achadas na Fase 10.

O menu **não tem mais nenhum "em breve" em Agenda**.

## O que a Fase 10 entregou (para não refazer)

- **"Faltou" não é "não foi marcado"** — o denominador de toda taxa é o número
  de chamadas existentes, nunca os domingos do calendário. Regra em
  `lib/relatorios/comum.ts`, vale nas cinco telas.
- **Ranking por taxa, com piso de 3 domingos.** Quem fica abaixo aparece com o
  motivo, não some.
- **Certificados listam aptos** — não emitem nem gravam nada.
- **Alerta de Faltas** com telefone na linha (link `tel:`); sequência resolvida
  no banco com `ROW_NUMBER()`.
- **Auditoria** avisa que o registro termina na migração. Sem coluna de
  congregação, é restrita a quem vê o campo inteiro.
- **CORRIGIDO:** `/api/alunos`, `/api/classes`, `/api/visitantes` e
  `/api/relatorios` estavam **sem guarda de permissão** desde a Fase 05 —
  bastava digitar o endereço para receber o campo inteiro. Agora exigem
  permissão e aplicam o recorte dentro da consulta.

## O que a Fase 09 entregou (para não refazer)

- **Congregações** — dirigente, vice e secretário lidos de `PessoaCargos`, nunca
  de colunas próprias. Cargo vago aparece como vago.
- **Aniversariantes** — comparação por mês e dia (`EXTRACT`), porque aniversário
  não tem ano. O filtro `?cong=` é interceptado pela interseção com o recorte do
  acesso.
- **Lições** — `classesQueDeram` vem de `Freq_Licao`, não do calendário. `null`
  (sem registro) é distinto de `0`.
- **Pedido de Revistas** — calculado (uma revista por aluno ativo × tabela de
  preços), porque a aba `Pedidos_Revistas` veio vazia do export. 290 revistas,
  R$ 3.062,00. Ajuste na tela é rascunho e a tela diz isso.

O menu **não tem mais nenhum "em breve" em Escola Bíblica**.

## O que a Fase 08 entregou (para não refazer)

- **Menu em 6 categorias**, sanfonado, em `lib/dashboard/navegacao.ts`. A
  **chave do item é a chave da permissão** — não existe segunda lista.
- **9 papéis** em `lib/auth/papeis.ts`. O papel vem do **cargo** que a pessoa
  ocupa (`PessoaCargos`), não de um campo novo.
- **Recorte por congregação** aplicado *dentro* das consultas do painel.
- **Guarda por permissão**: `exigirLeitura(chave)` / `exigirEscrita(chave)`.
- Telas novas: **Administração → Usuários** e **Administração → Permissões**.
- `npm run verificar:permissoes` — **97 asserções**, todas passando.

### Falta aplicar no banco

`prisma/aplicar-fase-08.sql` — dois cargos novos (Secretário Local e
Vice-Dirigente). Colar no SQL Editor do Neon e clicar em Run. Seguro rodar com
o sistema no ar e seguro rodar duas vezes.

### Decisões da Fase 08 que valem lembrar

- **Classes** ficou no menu apesar de não estar na lista pedida: 53 classes
  cadastradas, e Chamada, Alunos e relatórios dependem delas.
- **Congregações aparece duas vezes**, como pedido: em Escola Bíblica é a visão
  (dirigente e vice); em Administração é o cadastro. As duas entram na Fase 09.
- **Liderança** aponta para `/dashboard/configuracoes`, que já faz exatamente
  isso. Renomear a rota quebraria os atalhos já salvos.
- **Atividades recentes vêm vazias para quem vê só uma congregação**:
  `Auditoria` é tabela do sistema antigo e não tinha coluna de congregação. A
  Fase 12 acrescentou `congId` e passou a preenchê-la, mas **só no que o portal
  gravar daqui em diante** — as 1.671 linhas herdadas continuam sem
  congregação, porque deduzi-la seria inventar dado histórico. O painel
  encherá com o uso.

## Pendências do usuário (não são código)

1. **`AUTH_SECRET` na Vercel** — enquanto não existir, o portal fica aberto e
   mostra tarja vermelha "Portal sem proteção". Valor já gerado e entregue.
2. **Aplicar `prisma/aplicar-fase-08.sql`** no SQL Editor do Neon.
   **E `prisma/aplicar-fase-12.sql`** — sem ele a auditoria nova não grava.
3. **Reunião da liderança para trocar as senhas.** Depois dela, virar
   `EXIGIR_SENHA_PROPRIA_PARA_GRAVAR` para `true` em `lib/config.ts`.
4. **Trocar a senha do banco no Neon** — ela apareceu num print compartilhado.
5. **Apagar o projeto Neon vazio** (`sa-east-1`, `ep-cold-leaf-…`) — o correto é
   o `ebd-betania` (`us-east-1`, `ep-muddy-snow-…`). O usuário é leigo e não
   conseguiu; precisa de passo a passo. **Não temos acesso à conta Neon.**

## Variáveis de ambiente

| Nome | Para quê |
|---|---|
| `EBD_DATABASE_URL` | conexão do banco certo; tem prioridade sobre o que a integração criar |
| `AUTH_SECRET` | assina a sessão; mínimo 32 caracteres |

`/api/diagnostico` mostra com qual banco o app está falando, sem expor senha.
