# Continuação — Fase 15c: Central de Revistas CPAD (cards e gráficos financeiros)

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
| 13 | Pesquisa Global (com busca offline) sobre os registros |
| 14a | **Central de Relatórios (BI) — o cérebro: IGS, IGE, alertas, análise automática** |
| 14b | **Central de Relatórios (BI) — gráficos avançados: evolução, radar e comparativo** |
| 15a | **Central de Revistas CPAD — painel do trimestre e alertas** |
| 15b | **Central de Revistas CPAD — o pedido é digitado e confirmado (tela "Fazer Pedido")** |

## A Fase 15 — Central de Revistas CPAD — e o corte combinado com o usuário

O pedido original ("FASE XX — Central de Gestão de Revistas CPAD") reconstrói
o módulo de Revistas inteiro: dashboard financeiro com gráficos, cards por
congregação com ícones, categorias novas (Discipulado, Apoio, Visuais,
Material Complementar), comprovante de pagamento anexado, impressão
profissional, histórico com comparativos entre trimestres, exportação
PDF/Excel/CSV. Equivale a 5–6 fases somadas — do mesmo tamanho do pedido de BI
que já foi cortado em 14a/14b.

Perguntei ao usuário três coisas antes de começar (ver `AskUserQuestion` no
histórico da sessão):

1. **Por onde começar?** → **"Painel e alertas primeiro"** — a peça que não
   depende de infraestrutura nova nem de preço que ainda não existe.
2. **Discipulado/Apoio/Visuais/Material Complementar não têm preço
   cadastrado — como seguir?** → **"Me diga os valores agora"** — ainda
   aguardando o usuário informar os valores; nenhuma dessas categorias entrou
   no cálculo até lá.
3. **Comprovante de pagamento (upload de arquivo) — configurar agora?** →
   **"Não por agora"** — continua como campo de observação em texto.

### O corte de sub-fases (proposto e ainda não aprovado item a item)

| Sub-fase | Entrega |
|---|---|
| **15a** | ✅ Entregue — painel do trimestre (tema, situação, prazos), alertas automáticos, cards de resumo, e a Revista do Professor somada ao cálculo |
| **15b** | ✅ Entregue — **não estava no corte original**, foi pedida pelo usuário ao testar a 15a. Tela "Fazer Pedido": quantidade digitada por categoria, rascunho salvo, confirmação que trava quantidade e preço. Ver detalhe abaixo. |
| 15c | Cards por congregação redesenhados (ícones de pagar/imprimir/editar/histórico) + gráficos financeiros (barra, pizza, evolução semanal) |
| 15d | Categorias extras (Discipulado, Apoio, Visuais, Material Complementar) — **bloqueado até o usuário informar os preços** |
| 15e | Impressão profissional (pedido individual com timbre e assinaturas) + impressão geral (todas/pendentes/pagas/por categoria) |
| 15f | Histórico multi-trimestre + comparativos automáticos (trimestre anterior, mesmo trimestre do ano passado) + estatísticas |
| 15g | Exportação PDF/Excel/CSV |
| — | Comprovante de pagamento (upload) — recusado por enquanto; exigiria configurar um serviço de armazenamento de arquivo novo |

**Antes de começar 15c, confirme com o usuário se a ordem continua essa** — a
aprovação foi dada para 15a, e 15b entrou fora de ordem por pedido direto do
usuário. O resto é a sequência que pareceu mais lógica, não uma decisão
fechada.

**A Fase 14c/14d (BI: rankings expandidos e exportação) segue proposta e não
aprovada** — o usuário abriu a Fase 15 antes de decidir sobre elas. Não
presumir qual delas vem depois; perguntar.

## O que a Fase 15b entregou (para não refazer)

O usuário testou a 15a e resumiu o problema: *"parece que só visualizo"*, e
foi direto sobre os números já calculados: *"zere todos, pois elas vão
colocar o novo pedido do IV trimestre"*. O pedido virou um registro real —
digitado, salvo em rascunho, confirmado com trava — em vez de uma conta em
memória.

- **Duas tabelas novas**: `Pedidos_Revistas` (cabeçalho — confirmado ou
  rascunho, quem/quando confirmou) e `Pedidos_Revistas_Itens` (uma linha por
  categoria × tipo aluno/professor, com quantidade e **preço travado no
  momento em que foi salva**).
- **Tela nova `/dashboard/revistas/pedido/[congId]`** ("Fazer Pedido", link
  em cada card de congregação da tela principal): quantidade começa em
  branco (não pré-preenchida com o cálculo — o "zere todos" do usuário), a
  sugestão calculada aparece do lado só como referência. "Salvar rascunho" e
  "Confirmar Pedido" — confirmar TRAVA a quantidade e o preço.
- **Reabrir um pedido confirmado é só do campo** (`podeReabrir`), mesma regra
  de quem define tema e prazos — evita que uma secretária local desfaça
  sozinha um pedido que já foi pra CPAD.
- **O total que conta para pagamento agora vem do pedido CONFIRMADO — sem
  confirmação, é zero.** `/api/revistas` (a tela principal) mudou: cada
  congregação tem `pedido` (o confirmado, ou `null`) e `sugestao` (o cálculo
  automático, só informativo). `situacaoDaCongregacao`/`gerarAlertasRevistas`
  continuam iguais — só o que alimenta `totalDevido` mudou.
- **Abre no PRÓXIMO trimestre por padrão**, não no atual — a CPAD recebe
  pedido com antecedência. `lib/revistas/trimestre.ts` (novo): `trimestreDe`
  (atual), `proximoTrimestre`, `resolverTrimestre("atual"|"proximo")`.
  `/api/revistas` (painel financeiro) olha o atual por padrão;
  `/api/revistas/pedido` (Fazer Pedido) olha o próximo por padrão — mesma
  chave de trimestre, defaults diferentes.
- **Corrigido de brinde**: Berçário só tem preço de "Manual do Mestre"
  (`manual-mestre`, R$ 18) — chave diferente de `mestre-comum`. A 15a não
  reconhecia essa chave; `lib/revistas/precos.ts` (extraído, compartilhado
  entre as duas rotas) agora entende as duas formas.
- **Alerta "sem-pedido" sobe para crítico** quando `dataLimitePedido` já
  passou sem confirmação.
- `npm run verificar:revistas` — **56 asserções** (27 da 15a + 29 novas).
- **Precisa aplicar no banco:** `prisma/aplicar-fase-15b.sql` — cria as duas
  tabelas novas, vazias, sem tocar em nada existente.

## O que a Fase 15a entregou (para não refazer)

- **`lib/revistas/situacao.ts`** — funções puras, sem banco:
  `situacaoDoTrimestre`, `situacaoDaCongregacao`, `nivelDoPrazo`,
  `diasRestantes`, `gerarAlertasRevistas`. "Fechado" é redefinido
  honestamente: não existe passo de "enviar" o pedido (ele nasce calculado),
  então "Fechado" significa "prazo de AJUSTE passou, prazo de PAGAMENTO
  ainda não" — e só acontece se a administração definir um prazo de pedido.
- **`/api/revistas` GET** ganhou: `trimestre.tema`, `dataLimitePedido`,
  `prazos` (dias restantes + nível de cada prazo), `situacao` do trimestre,
  `situacao` por congregação, e `alertas`. **PUT** agora aceita `tema`,
  `dataLimitePedido` e `dataLimite` juntos ou separados — só muda o que vier
  no corpo.
- **Revista do Professor somada ao cálculo**: a tabela de preços sempre teve
  as linhas `mestre-*` e o cálculo só usava `aluno-*`. Agora cada classe soma
  `professores ativos × preço do professor`, com a contagem vinda de
  `PessoaCargos` (mesma fonte que a tela de Classes já usa). Muda os totais
  que a Fase 09 tinha documentado (290 revistas, R$ 3.062,00).
- **Tela `/dashboard/revistas`**: painel do trimestre (tema editável,
  situação, os dois prazos com cor), 3 cards de resumo financeiro + 3 cards de
  contagem de congregações (em dia/pendentes/atrasadas), painel de alertas
  clicável (abre a congregação certa), badge de situação em cada card de
  congregação, e a linha da Revista do Professor visível dentro do
  detalhamento de cada classe.
- **Não entrou**: Discipulado/Apoio/Visuais/Material Complementar (sem
  preço), comprovante de pagamento (upload — recusado por enquanto), forma de
  pagamento e "quem recebeu" no registro de baixa (não foi pedido nesta
  sub-fase; fica para quando o "Controle de Pagamento" completo entrar).
- `npm run verificar:revistas` — **27 asserções**.
- **Precisa aplicar no banco:** `prisma/aplicar-fase-15a.sql` — duas colunas
  novas em `Trimestres_Revistas` (`tema`, `dataLimitePedido`), nulas em todo
  trimestre já cadastrado, seguro rodar com o sistema no ar.

## A Fase 14 — Central de Relatórios (BI) — e o corte combinado com o usuário

O pedido original ("FASE 08 — Central de Relatórios e BI") equivalia a 5-6
fases somadas: índices, uma dúzia de tipos de gráfico, rankings cruzados,
comparativos, exportação em PDF/Excel/CSV com timbre institucional, relatório
executivo. Perguntei ao usuário por onde começar (ver `AskUserQuestion` no
histórico da sessão) e a resposta foi **"o cérebro primeiro"**: os índices e
os cálculos, porque tudo o resto (gráficos, rankings, exportação) vai consumir
esse motor — construí-lo depois seria refazer.

Também perguntei sobre dois dados que o pedido cita e não existem no cadastro
— **sexo do aluno** e **desempenho individual do professor** (não há chamada
de professor, só de aluno). Resposta: **não adicionar nenhum dos dois por
enquanto**. Nenhum gráfico, filtro, ranking ou alerta desta fase (nem das
seguintes, até nova decisão) deve fingir medir isso.

### O corte de sub-fases (proposto e ainda não aprovado item a item)

| Sub-fase | Entrega |
|---|---|
| **14a** | ✅ Entregue — Índice de Saúde (IGS) por congregação, Índice Geral da EBD (IGE), Painel com indicadores, alertas automáticos, análise em texto |
| **14b** | ✅ Entregue — evolução de 12 meses no Painel, tela Comparativo (radar + linha, 2 a 4 congregações) |
| 14c | Rankings expandidos (top crescimento, top recuperação) + comparativos adicionais (mês × mês, ano × ano) |
| 14d | Exportação: impressão profissional, Excel (.xlsx), CSV, Relatório Executivo de 2 páginas, com timbre institucional |

**Antes de começar 14c, confirme com o usuário se a ordem continua essa** — a
aprovação foi dada explicitamente para 14a e depois para 14b; 14c/14d são a
sequência que pareceu mais lógica, não uma decisão fechada.

## O que a Fase 14b entregou (para não refazer)

- **Evolução — últimos 12 meses**, nova seção do Painel (`/dashboard/relatorios`):
  área com a frequência do campo mês a mês, vinda de uma série mensal
  calculada em `/api/relatorios/painel` (`evolucaoMensal`, com `generate_series`
  para não pular mês sem chamada). Mês sem chamada aparece como vão na área,
  nunca como "0%".
- **Tela nova `/dashboard/relatorios/comparativo`** (item de menu "Comparativo",
  ícone radar): escolhe de 2 a 4 congregações (`COMPARATIVO_MINIMO`/
  `COMPARATIVO_MAXIMO` em `lib/relatorios/indices.ts`) e mostra:
  - **Radar** dos 5 componentes do IGS sobrepostos (uma cor por congregação).
  - **Linha** com a evolução de 6 meses de cada uma, lado a lado.
  - Tabela compacta com índice/faixa, frequência, tendência e visitantes.
- **`/api/relatorios/comparativo`** (nova rota): intersecta os ids pedidos com
  o recorte da sessão, valida a seleção, calcula os mesmos componentes do IGS
  por congregação e a série mensal de 6 meses de cada uma.
- **`lib/relatorios/indices.ts`** ganhou `paraRadar` (monta os 5 eixos, sempre
  na mesma ordem, rótulo positivo) e `validarSelecaoComparativo`.
- **Componentes de gráfico novos**, todos `next/dynamic({ssr:false})`:
  `GraficoEvolucao` (área), `GraficoLinhaComparativa` (linha multi-série),
  `GraficoRadar` (radar multi-série).
- **Corrigido de brinde**: `tsconfig.json` não incluía `**/*.mts` no
  `include` — os scripts `scripts/verificar-*.mts` nunca eram checados por
  `npm run typecheck`. Corrigido; agora participam do typecheck normal.
- `npm run verificar:bi` — **56 asserções** (47 da 14a + 9 novas de
  `paraRadar`/`validarSelecaoComparativo`).
- **Não entrou nesta sub-fase** (ficou para 14c, se aprovado): pizza, rosca,
  heatmap, timeline — só os tipos de gráfico que o usuário pediu
  explicitamente ("linha, área, radar, comparativos").

## O que a Fase 14a entregou (para não refazer)

- **`/dashboard/relatorios` virou o Painel** (IGE + Saúde da EBD + alertas +
  análise). A tela antiga de frequência (linha do tempo, comparativo por
  classe/congregação) **mudou para `/dashboard/relatorios/frequencia`** — nada
  nela foi alterado, só o endereço. Chave de permissão nova: `rel-painel`
  (grupo B enxerga, igual às demais telas de relatório).
- **`lib/relatorios/indices.ts`** — `calcularIGS`, `classificarIGS`,
  `scoreDeVariacao`, `tendenciaDe`, `variacaoPct`. Funções puras, sem banco.
  Componente ausente **redistribui peso, não vira zero**; sem nenhum
  componente calculável, a nota é `null` (não inventa 0).
- **`lib/relatorios/analise.ts`** — `gerarAlertas` e `gerarAnalise`. Texto por
  REGRA, não por IA de verdade — está dito também na tela, num rodapé
  discreto. Arquitetura pronta para trocar por uma chamada de IA real (mesma
  assinatura, sem acesso a banco), mas isso não foi feito.
- **`/api/relatorios/painel`** — tudo numa chamada: IGS de cada congregação,
  IGE do campo (mesma fórmula sobre a SOMA, não a média das médias — evita
  paradoxo de Simpson), classes sem chamada há 21+ dias, contagem de
  professores/dirigentes (só CONTAGEM, nenhum desempenho individual).
- **Sem SQL para aplicar** — nenhuma tabela nova, nenhuma coluna nova. Tudo
  calculado em cima de `Frequencias`, `Visitantes`, `Alunos`, `Classes`,
  `PessoaCargo` que já existiam.
- Gráfico (barra horizontal do IGS) em `components/relatorios/GraficoIGS.tsx`,
  carregado com `next/dynamic({ssr:false})` — mesma regra do `ChartCard` do
  Dashboard principal; sem isso o Recharts inflava o bundle da página de 7 kB
  para 119 kB.
- `npm run verificar:bi` — **47 asserções**, cobrindo os cálculos, as faixas
  de classificação e a geração de alertas/análise, tudo sem banco.

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
   **E `prisma/aplicar-fase-15a.sql`** — sem ele o tema e o prazo de pedido do
   trimestre não salvam (o resto do painel funciona igual).
   **E `prisma/aplicar-fase-15b.sql` — URGENTE, diferente dos outros três:**
   sem ele a tela inteira de Revistas para de funcionar (`/dashboard/revistas`
   e `/dashboard/revistas/pedido/...`), porque as tabelas `Pedidos_Revistas` e
   `Pedidos_Revistas_Itens` ainda não existem no banco e a rota consulta as
   duas em toda carga da página.
3. **Reunião da liderança para trocar as senhas.** Depois dela, virar
   `EXIGIR_SENHA_PROPRIA_PARA_GRAVAR` para `true` em `lib/config.ts`.
4. **Trocar a senha do banco no Neon** — ela apareceu num print compartilhado.
5. **Apagar o projeto Neon vazio** (`sa-east-1`, `ep-cold-leaf-…`) — o correto é
   o `ebd-betania` (`us-east-1`, `ep-muddy-snow-…`). O usuário é leigo e não
   conseguiu; precisa de passo a passo. **Não temos acesso à conta Neon.**
6. **Preços de Discipulado, Revistas de Apoio, Revistas Visuais e Material
   Complementar** — o usuário disse que ia informar os valores; nenhuma
   dessas categorias entra no pedido até chegar o preço.

## Variáveis de ambiente

| Nome | Para quê |
|---|---|
| `EBD_DATABASE_URL` | conexão do banco certo; tem prioridade sobre o que a integração criar |
| `AUTH_SECRET` | assina a sessão; mínimo 32 caracteres |

`/api/diagnostico` mostra com qual banco o app está falando, sem expor senha.
