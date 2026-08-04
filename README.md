# Portal da Escola Bíblica Dominical

**IEADPE — Campo de Betânia, Pernambuco**

> Ensinando a Palavra. Formando discípulos. Transformando vidas.

Next.js 15 · React 19 · TypeScript · TailwindCSS 4 · Framer Motion · GSAP · Prisma

---

## O que já existe

| Fase | Entrega | Estado |
|---|---|---|
| 02 | Splash cinematográfica de 15s com o vídeo oficial | pronta |
| 02 | Congelamento no melhor quadro da fachada | pronto |
| 02 | Tela de login premium sobre o quadro congelado | pronta |
| 03 | Schema Prisma + importador do sistema antigo | pronto (ver [README-IMPORT.md](./README-IMPORT.md)) |
| 01 | PWA instalável (manifesto, ícones, Service Worker) | pronta |
| 01 | Camada offline (Dexie/IndexedDB + fila de sincronização) | pronta |
| 01 | Design System base (`components/ui`) | pronto |
| 04 | Dashboard Principal | pronto |
| 05 | Pessoas e cargos (modelagem normalizada) | pronto |
| 05 | Rotas de API sobre o Postgres | pronto |
| 05 | Chamada, Alunos, Professores, Classes, Visitantes | pronto |
| 05 | Relatórios, Agenda, Configurações | **próxima etapa** |
| 06 | Autenticação real e sincronização offline ligada | próxima etapa |

O login **não autentica de verdade ainda** — a chamada está simulada, com o
ponto exato de troca marcado em `components/login/LoginCard.tsx`.

### Sobre a Landing Page

A lista de abertura do briefing cita três entregas (Splash, Landing Page,
Login), mas o bloco **IMPORTANTE** no fim enumera a entrega como três itens que
não incluem landing page — splash, congelamento e login — e fecha com "Não criar
páginas extras".

Segui o bloco final, que é o mais específico. **Não há landing page.** Se ela era
para existir mesmo, é um acréscimo direto: a arquitetura já suporta, porque o
vídeo de fundo é um componente independente das telas.

---

## Rodando

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run build        # build de produção
npm run typecheck    # tsc --noEmit
```

Os comandos de banco estão em [README-IMPORT.md](./README-IMPORT.md).

### Verificações

```bash
npm run verificar:offline    # camada offline, no Node (fake-indexeddb)
```

```bash
npm run build && npm start   # num terminal
npm run verificar:pwa        # noutro — precisa de Chromium
npm run verificar:dashboard  # idem; salva capturas em ./capturas
```

O `verificar:pwa` abre um navegador de verdade e confere manifesto, Service
Worker, o que foi para o cache e se a página abre sem internet. O `playwright`
**não** está nas dependências de propósito — são mais de 100 MB que a Vercel
baixaria em todo build sem serventia em produção. Instale só na hora:

```bash
npm i --no-save playwright && npx playwright install chromium
```

---

## A abertura, segundo a segundo

Toda a coreografia é uma única `gsap.timeline` em
`components/splash/SplashScreen.tsx` — ler o `useEffect` é ler o roteiro.

| Tempo | Acontece |
|---:|---|
| 0,0s | preto absoluto |
| 0,6s | pequena luz dourada, pulsando devagar |
| 2,0s | a luz emite partículas |
| 3,0s | as partículas somem em fade; começa o vídeo do drone |
| 4,0s | o vídeo ocupa a tela inteira — escurecimento, vinheta e contraste, só |
| 5,0s | "PORTAL DA / ESCOLA BÍBLICA / DOMINICAL" |
| 7,0s | "IEADPE — Campo de Betânia, Pernambuco" |
| 9,0s | o lema, em três linhas |
| 11,0s | a logomarca entra discretamente, com brilho dourado |
| 13,2s | a câmera se aproxima e o vídeo começa a desacelerar |
| 15,0s | congela no melhor enquadramento da fachada → login (900ms) |

---

## O vídeo oficial

`public/media/igreja-drone.{webm,mp4}` — recorte do vídeo oficial gravado por
drone. **Não substituir.**

### Como o trecho foi escolhido

O arquivo original tem 35,4s a 1024×576 e contém **dois planos**, com um corte
seco entre 19,8s e 20,0s:

| Plano | Trecho | O que mostra |
|---|---|---|
| 1 | 0s – 19,9s | começa colado na fachada e afasta até ver a cidade |
| 2 | 19,9s – 35,4s | volta para perto e **desce em direção à fachada** |

A abertura precisa de ~12s contínuos terminando numa aproximação, então só o
plano 2 serve — atravessar o corte deixaria um salto no meio da splash.

O melhor enquadramento da fachada está em **32,0s**: portas azuis iluminadas,
torre com o medalhão e as pessoas na entrada, com a igreja ocupando a metade
superior do quadro. É ali que o clipe termina — por isso "pausar no fim" e
"congelar no quadro certo" são a mesma coisa.

Recorte: `ffmpeg -ss 21.0 -i <original> -t 11.1 -an ...`
Sem áudio: autoplay exige mudo, e a faixa é de um culto com vozes reconhecíveis.

### Por que o clipe tem 11,1s e não 12s

O vídeo roda de 3s a 15s da abertura — 12s de relógio. Mas os últimos 1,8s são
de desaceleração, quando o vídeo consome menos conteúdo que tempo real. A conta
está em `lib/media.ts`.

### Por que o congelamento é invisível

O `<video>` vive em `app/page.tsx`, **acima** da splash e do login, e não
desmonta na troca entre as duas. Não existe substituição: é literalmente o mesmo
elemento, pausado no último quadro, ganhando blur.

Se ele fosse remontado no login — ou trocado por um `<img>` do poster — haveria
um piscar no ponto exato para onde o usuário está olhando.

### A desaceleração é adaptativa

A versão ingênua (rampa fixa de 1,0 → 0,1) assume que o vídeo começou no
milissegundo previsto. Ele nunca começa: `play()` tem latência de decodificação
— medi **~1s** em headless — e ela varia com aparelho e rede. O sintoma aparece
na tela: o clipe acaba antes da hora e a imagem fica parada alguns instantes
antes do congelamento "oficial", justo o contrário do que a spec pede.

Duas correções:

1. **Aquecimento do decodificador.** Nos 3 primeiros segundos a tela está preta;
   é ali que se paga o custo do primeiro quadro, com um `play()` seguido de
   `pause()` imediato. Isso derrubou a latência de ~1s para ~0,25s.
2. **Rampa calculada na hora.** Com rampa linear de `r0` a `r1` durante `T`, o
   consumo é `T·(r0+r1)/2`. Daí `r0 = 2·restante/T − r1`. Se o vídeo está
   adiantado, `r0` sai menor e ele desacelera mais; se está atrasado, recupera.
   Em qualquer caso chega ao fim junto com a janela.

Medido: primeiro quadro em movimento aos 3,25s, rampa de 0,83 → 0,14, pausa no
último quadro com `currentTime == duration`.

### `object-cover` é obrigatório

A spec pede tela cheia, sem barras e sem margens. Como o clipe é 16:9 e as telas
não são, alguma sobra precisa sair — cortar as bordas é o único caminho que não
deixa tarja preta.

---

## A logomarca oficial

A arte oficial da IEADPE (`IEADPE.png`, 2000×1597, fundo transparente) é usada
**como bitmap, sem nenhuma alteração** — não é recolorida, redesenhada,
recortada, espelhada nem esticada. O único ajuste é escala proporcional.

| Arquivo | O quê |
|---|---|
| `public/brand/ieadpe-logo.png` | master web, 1000×798 |
| `public/brand/ieadpe-mask.png` | máscara de alfa, 260px, ~18 KB |
| `app/icon.png` | favicon, a partir do ícone oficial |

Todos os efeitos acontecem **atrás ou em volta** da marca: sombra projetada,
halo, selo, partículas e brilho. Nenhum toca nos pixels da arte.

### Por que a marca aparece sobre um selo claro

O texto arqueado "ASSEMBLEIA DE DEUS" e o "PERNAMBUCO" da arte são azuis
(#1060A0). Medindo o contraste:

| Fundo | Contraste |
|---|---|
| Preto da splash | 3,20:1 |
| Azul do card (#0B1F45) | 2,47:1 |
| Versão ícone oficial sobre o próprio fundo | 1,15:1 |

**A logomarca foi desenhada para fundo claro.** Sobre fundo escuro o letreiro
some. Como a arte não pode ser alterada, a saída de manual de marca é apoiá-la
sobre a superfície clara para a qual foi feita: um selo circular branco →
#F5F7FA com fio dourado, desenhado atrás. A arte segue intacta.

O selo é um círculo de 137% da largura da marca, posicionado de forma absoluta —
transborda a caixa e não ocupa espaço no fluxo. Em vez de compensar com margens
ajustadas à mão (que precisariam de um número diferente para cada altura de
tela), o wrapper usa `aspect-[100/137]` e reserva o quadrado do selo.

No card, a marca fica entre **90 e 120px**: 96px no celular, 116px no desktop.

---

## Aplicativo instalável (PWA)

O portal instala como aplicativo no Android, iPhone, iPad, Windows, macOS e
Chromebook, abrindo **sem barra de navegador** (`display: "standalone"`).

| Arquivo | O quê |
|---|---|
| `app/manifest.ts` | manifesto gerado pelo Next em `/manifest.webmanifest` |
| `public/icons/` | 192 e 512, `any` e `maskable`, + `apple-touch-icon` |
| `public/sw.js` | Service Worker, escrito à mão |
| `components/pwa/ServiceWorkerProvider.tsx` | registro e troca de versão |

### Por que os ícones `maskable` são arquivos separados

O sistema recorta o ícone na forma dele — círculo no Android, squircle no iOS.
Sem uma versão com zona segura, o letreiro "ASSEMBLEIA DE DEUS" é a primeira
coisa a ser cortada. Nos arquivos `maskable-*` a marca entra menor. **A arte
continua sem alteração**: só muda a escala dentro da moldura.

### Por que o Service Worker é escrito à mão

Por causa do vídeo. Ao reproduzir, o navegador pede **pedaços** do arquivo com o
cabeçalho `Range` e recebe status **206**; a Cache API **recusa** guardar
respostas 206 — `cache.put` lança erro. Com uma receita genérica de PWA o vídeo
nunca entra em cache e é rebaixado da internet a cada abertura, mesmo com o
Service Worker instalado.

A saída, em `responderMidia()`: ignorar o `Range` na ida (busca o arquivo
inteiro, 200, e guarda) e tratar na volta (recorta o pedaço pedido do que está
em cache e monta o 206 na mão).

### O aperto de mão página → Service Worker

Só o item acima não bastava, e a medição mostrou por quê:

| Visita | O que aconteceu com o vídeo |
|---|---|
| 1ª | o SW ainda não controlava a página quando o vídeo foi pedido |
| 2ª | o navegador serviu do cache HTTP dele próprio — **nenhuma requisição** |

Ou seja, o Service Worker nunca via o arquivo. A correção: `DroneBackdrop`
manda `{ tipo: "GUARDAR_MIDIA", url: video.currentSrc }` e o SW busca e guarda
**esse** arquivo. `currentSrc` é a peça-chave — só a página sabe se o navegador
escolheu o `.webm` ou o `.mp4`, então guarda-se **um** formato, não os dois.

### Estratégias de cache

| Recurso | Estratégia | Motivo |
|---|---|---|
| navegação | rede primeiro, cache como rede de segurança | garante que o app **abre** sem internet |
| `/_next/static` | cache primeiro | os nomes têm hash: se está em cache, está correto |
| imagens | cache primeiro | — |
| `/media` (vídeo) | cache primeiro, com tratamento de `Range` | ver acima |
| resto | rede primeiro | — |

O `activate` chama `aquecerAppShell()`, que lê o próprio HTML de `/` e extrai os
`/_next/static/…` referenciados. Sem isso o sintoma é cruel: na primeira visita
o navegador já baixou todo o JS antes de o SW assumir, então o usuário instala o
app, fica sem sinal, abre e vê **tela branca** — o HTML estava em cache, o
JavaScript que o preenche não.

### A atualização não recarrega sozinha

O download da versão nova é automático, em segundo plano. O **instante da troca**
não é, e isso é proposital: recarregar sozinho é destrutivo num sistema de
chamada — o professor está marcando presença de trinta alunos, o app recarrega e
a manhã inteira vai embora. A versão fica pronta esperando e o usuário escolhe a
hora, ou ela entra na próxima abertura do zero.

Dois guardas em `ServiceWorkerProvider`: `jaTinhaControlador` (sem ele, o
`clients.claim()` da primeira visita recarregava a página **no meio dos 15
segundos da abertura**) e `jaRecarregou` (laço clássico com várias abas).

Medido com `npm run verificar:pwa`: 15 verificações, todas passando — vídeo em
cache (`ebd-midia-v1`, só o `.webm`) e tocando offline com `readyState = 4`.

---

## Offline First

O sistema é usado numa igreja, aos domingos, onde o sinal cai. A regra é: **a
gravação nunca falha por falta de internet.** Escreve-se no aparelho e sincroniza
quando der.

| Arquivo | O quê |
|---|---|
| `lib/db/schema.ts` | tipos das tabelas locais e da fila |
| `lib/db/local.ts` | banco Dexie/IndexedDB e índices |
| `lib/db/repositorio.ts` | `salvar` · `remover` · `receberDoServidor` · `confirmarEnvio` |
| `lib/sync/motor.ts` | esvazia a fila contra o servidor |

### `uid` local e `idRemoto`

Todo registro nasce com um `uid` gerado no aparelho, **imutável**, e é por ele
que os outros registros apontam. O `idRemoto` só aparece quando o servidor
confirma. Sem essa separação, uma presença marcada offline para um aluno criado
offline não teria a que se referir — o aluno ainda não tem id.

### Gravação e fila na mesma transação

`salvar` escreve na tabela **e** enfileira dentro de **uma** transação Dexie. Se
fossem duas operações, uma falha no meio deixaria o dado gravado e não
enfileirado: some para sempre, em silêncio, sem ninguém perceber até a chamada
não bater.

### A carga do servidor não atropela alteração pendente

`receberDoServidor` preserva o que está `pendente` localmente. O contrário
significaria: o professor corrige um nome offline, o app sincroniza, a carga do
servidor sobrescreve a correção com o valor antigo.

### O motor para no primeiro erro

A fila sobe em ordem de criação, sequencialmente, e **para** no primeiro erro em
vez de pular para o próximo. Continuar enviaria alterações que dependem da que
acabou de falhar — "marcar presença" antes de "criar aluno". A espera entre
tentativas cresce (2s, 4s, 8s… até 5 min): sem isso, um servidor fora do ar vira
um martelo que só gasta bateria e dados de quem está na igreja.

O **transporte** é injetado de fora (`configurarTransporte`), porque as rotas de
API só existem na Fase 05. Sem transporte o motor fica parado em vez de dar
erro: a fila enche normalmente e sobe inteira quando as rotas existirem.

Verificado com `npm run verificar:offline`: 20 asserções, todas passando.

---

## Dashboard

`/dashboard` — cabeçalho fixo, menu lateral recolhível e área principal. O
`AuthSuccessOverlay` do login finalmente aponta para uma tela de verdade.

| Componente | O quê |
|---|---|
| `Header` | identidade, busca global, estado do sistema, menu do usuário |
| `Sidebar` | menu — o mesmo componente serve à barra fixa e à gaveta do celular |
| `SearchBar` | busca com `Ctrl/Cmd + K`, teclado e navegação |
| `UserMenu` | nome, cargo, congregação e sair |
| `SystemStatus` | online / offline / sincronizando |
| `DashboardCard` | os quatro números do topo |
| `ChartCard` | frequência mensal (Recharts) |
| `SummaryCard` | resumo do domingo |
| `RecentActivity` | linha do tempo das últimas ações |
| `BirthdayCard` | aniversariantes |
| `AgendaCard` | próximos culto, EBD e evento |

### Uma porta só para os dados

Nenhum componente tem número escrito dentro. Todos recebem os tipos de
`lib/dashboard/tipos.ts`, e tudo entra por `carregarPainel()`, em
`lib/dashboard/dados.ts`. Quando as rotas existirem, essa função passa a chamar
`fetch("/api/painel")` e **nada mais muda** — um "323" digitado no meio do JSX
parece inofensivo e vira caça ao tesouro na hora de ligar o banco.

Os números de cadastro são os **reais** da igreja (323 alunos, 53 classes, 19
usuários, vindos do export). O que é inventado são os números do dia — presentes,
visitantes, atividades —, que só a chamada de domingo produz.

### O estado do sistema não é demonstração

Enquanto o resto do painel mostra exemplo, o `SystemStatus` é real: lê o
`navigator.onLine` e o motor de sincronização da Fase 01, com a fila do
IndexedDB de verdade. É o único indicador em que uma informação errada tem
consequência — se ele disser "tudo enviado" com trinta presenças presas no
celular, a secretaria fecha o relatório sem elas.

Ele aparece duas vezes de propósito: em miniatura no cabeçalho, sempre visível
("estou online?"), e por extenso no painel ("o que está acontecendo com os meus
dados?"). São perguntas diferentes.

### Tudo o que depende da hora é calculado no navegador

Saudação, data por extenso, "hoje"/"amanhã" na agenda e o aniversariante do dia.
O servidor roda em UTC, num data center; o usuário está em Pernambuco (UTC−3).
Às 22h de um sábado em Recife o servidor já está no domingo — o painel diria
"Bom dia, Domingo" para quem ainda está na noite de sábado. Renderizar isso no
servidor também produziria divergência de hidratação, com o React descartando a
árvore e a tela saltando no primeiro quadro.

Por isso esses valores entram depois da montagem, sempre com o espaço
**reservado** nas mesmas medidas — senão o título aparece do nada e empurra os
quatro cartões para baixo justo quando a mão já está indo clicar.

### Três séries, três formas

No gráfico de frequência: **presentes** é área preenchida (a série principal),
**matriculados** é linha tracejada (é o teto, um cadastro e não uma medição do
domingo) e **visitantes** é linha fina (números uma ordem de grandeza menores;
como área, sumiriam rente ao eixo).

Empilhadas, a única conta que interessa à secretaria — "218 de 323" — teria de
ser feita de cabeça, somando faixas coloridas.

O Recharts entra por `dynamic(..., { ssr: false })`: pesa mais que todo o resto
do painel somado e nada nele é necessário para a primeira leitura da tela.

### Módulos que ainda não existem continuam navegáveis

`app/dashboard/[...modulo]` responde "em construção" em vez de 404. Esconder os
itens do menu deixaria o usuário sem ideia do que o sistema vai ter, e cada
entrega pareceria um produto diferente; o 404 do Next, num sistema recém-instalado,
é lido como defeito. A rota curinga sai sozinha — assim que
`app/dashboard/alunos/page.tsx` existir, a rota específica vence.

### No celular

A barra lateral vira gaveta, os cartões passam a uma coluna e a busca ganha uma
linha própria abaixo do cabeçalho. Espremer campo de busca, logo, sino e avatar
em 360px produz alvos de toque menores que o mínimo utilizável, e o campo vira
decorativo.

Verificado com `npm run verificar:dashboard`: 46 checagens em 1920×1080,
1366×768, 820×1180 e 390×844 — sem rolagem horizontal, sem erro de console, com
o gráfico desenhado em todas.

---

## Pessoas e cargos

O sistema antigo **não sabia contar gente**, e isso não é uma opinião — é o que
os dados mostram:

| Onde | O que havia |
|---|---|
| `Usuarios` | 19 linhas, mas a maioria não é pessoa: são contas de congregação ("Cong. Pinheiro", "T. Matriz", "Templo Sede") |
| `Classes.prof` | texto livre digitado à mão — 50 preenchidos, 47 textos distintos |

Entre esses 47 textos estão **"Ana costa", "Ana maria da costa" e "Ana Maria
costa"** (provavelmente a mesma pessoa), **"Jéssica e Elisângela"** (um texto,
duas pessoas), **"Silvério" e "Aux. Silverio"** (a mesma, com e sem tratamento)
e **"Classe Juniores"** — que não é pessoa nenhuma.

Quem dava aula em duas classes virava duas pessoas. Quem era dirigente e
professor virava duas de novo.

### A modelagem

```
Pessoa ──< PessoaCargo >── Cargo
               │
               ├── Congregacao   (cargo de congregação)
               └── Classe        (cargo de classe)
```

Uma pessoa acumula quantos cargos exercer e continua sendo **uma linha** em
`Pessoas`. O resultado da importação:

| | |
|---|---:|
| Pessoas únicas | **59** |
| Cargos ocupados | **68** |
| Pessoas acumulando função | **9** |
| Marcadas para conferência humana | **5** |
| Descartadas por não serem pessoa | **1** |

### O que o script NÃO faz

`npm run db:pessoas` cria linhas em `Pessoas` e `PessoaCargos`. Ele **não apaga
nem reescreve `Classes.prof`** — o texto original continua lá, e
`PessoaCargos.origem` guarda de qual texto cada vínculo nasceu.

Onde há dúvida, ele não decide: marca `revisar = true` e escreve o porquê.
Fundir "Ana costa" com "Ana Maria costa" pode estar certo — e pode ser mãe e
filha. Quem sabe é a secretaria, não o programa. O Dashboard mostra esses 5
cadastros num aviso que leva direto à lista.

### Dois detalhes de banco que custam caro se ignorados

**`NULLS NOT DISTINCT`.** Em Postgres, `NULL` não é igual a `NULL` — então o
índice único gerado pelo Prisma **não** impediria o Pastor Presidente de ser
cadastrado duas vezes (cargo de campo tem `congId` e `classeId` nulos). A
migration acrescenta o índice com `NULLS NOT DISTINCT`, e isso está testado:
a segunda inserção idêntica é recusada pelo banco.

**O mesmo problema no cliente.** `prisma.upsert` recusa `null` num `where`
composto ("Argument `congId` must not be null") — pela mesma razão. O backfill
usa `findFirst` com `equals: null` (que vira `IS NULL`) e deixa o índice como
rede de segurança.

### A migration é aditiva

Não apaga, não renomeia e não altera nenhuma tabela do sistema antigo. A única
mudança em tabela existente é uma coluna nova e opcional em `Usuarios`
(`pessoaId`), que nasce nula. **Dá para rodar com o sistema no ar.**

```bash
npm run db:deploy      # aplica a migration
npm run db:pessoas     # popula pessoas e cargos (repetível)
npm run db:pessoas -- --dry   # só mostra o que faria
```

---

## Liderança do Campo

Card institucional no Dashboard, em ordem hierárquica. **Nenhum nome aparece no
código**: a lista vem de `Cargos.destaque` e a ordem, de `Cargos.ordem`. Trocar
o Supervisor da EBD é alteração de dado, não de arquivo.

Cargo vago aparece assim mesmo, com o lugar reservado — escondê-lo esconderia da
igreja que a função existe e está sem ninguém.

O tratamento ("Pr.", "Pb.", "Aux.") fica **separado do nome** no banco. Junto,
"Pb. José Raimundo" e "José Raimundo" viravam duas pessoas — exatamente como
"Silvério" e "Aux. Silverio" viraram no sistema antigo. Os dois se reencontram
só na hora de exibir.

---

## Módulos e API

| Rota | O quê |
|---|---|
| `/api/painel` | tudo do Dashboard, numa chamada |
| `/api/pessoas` | **uma linha por pessoa**, com os cargos dentro |
| `/api/alunos` | matriculados, com filtro por classe |
| `/api/classes` | classes com professores de verdade e o texto original |
| `/api/visitantes` | recebidos, do mais recente ao mais antigo |
| `/api/chamada` | GET a chamada do dia, POST grava a classe inteira |

### A chamada tem TRÊS estados por aluno

`presente` · `ausente` · **`não marcado`**

A diferença entre "faltou" e "ninguém marcou" é a diferença entre um dado e a
ausência dele. Com dois estados, todo aluno nasce ausente e uma chamada
esquecida no meio vira trinta faltas — que entram no relatório do mês como se
fossem reais.

### O POST grava a chamada inteira, não uma presença por vez

Uma requisição por aluno são trinta requisições numa classe de trinta — e, na
rede da igreja, algumas chegam e outras não. A chamada fica pela metade e
ninguém sabe quais faltaram.

Tudo junto, numa transação, só há dois resultados possíveis: gravou tudo ou não
gravou nada. Reenviar o mesmo pacote atualiza em vez de duplicar (verificado:
`criadas: 3` na primeira vez, `atualizadas: 3` na segunda).

Os ids de `Frequencia` não são autoincrement — são a chave original da planilha
—, então o próximo id é calculado **dentro** da transação: dois professores
marcando presença ao mesmo tempo pegariam o mesmo número e um perderia a
chamada.

### O gráfico mostra média por domingo, não soma do mês

Junho tem 585 presenças registradas — em quatro ou cinco domingos. Ao lado dos
291 matriculados, a soma sugere que compareceu o dobro da igreja; a média (117)
responde "quantos vêm num domingo típico", que é o que se quer saber.

### Sem banco, o painel abre — e avisa

Se `/api/painel` não alcança o Postgres, a tela cai no conjunto de exemplo
**marcado como tal**, com um aviso visível. Um painel que exibe números
inventados sem avisar é pior do que um painel fora do ar: a secretaria fecha o
relatório do domingo com dados que não existem.

---

## Design System

`components/ui/` — Button, Checkbox, Input, Badge, Alert, Skeleton, Card, Table,
Dialog. Importação por um ponto único:

```ts
import { Button, Card, Input } from "@/components/ui";
```

**Sidebar e Menu não estão aqui**, e sim em `components/dashboard/`. O critério
é o que separa os dois diretórios: em `ui/` ficam peças que não sabem nada sobre
o sistema (um `Button` serve a qualquer tela), enquanto a Sidebar conhece o menu,
as rotas e a rota ativa. Trazê-la para cá amarraria o Design System à navegação
do portal.

O `Card` tem dois tons: `glass` (vidro fosco sobre foto ou vídeo, como o card de
login) e `solido` (fundo chapado, onde o vidro não tem o que refratar e só
deixaria o texto menos legível).

---

## Paleta

Predominância do azul institucional; o dourado só em brilhos e destaques; o
vermelho só em pequenos detalhes.

| Cor | Hex | Token | Uso |
|---|---|---|---|
| Azul institucional | `#163A70` | `brand-600` | predominante |
| Azul escuro | `#0B1F45` | `brand-800` | superfícies e profundidade |
| Branco | `#FFFFFF` | `white` | selo da marca, títulos |
| Cinza muito claro | `#F5F7FA` | `brand-50` | base do selo, texto corrido |
| Dourado | `#D4AF37` | `gold-400` | brilhos e destaques |
| Vermelho da chama | `#D62828` | `flame-500` | apenas erros de formulário |

Fontes: **Cinzel** (títulos), **Playfair Display** (subtítulos), **Inter**
(textos), via `next/font/google`.

---

## Ajustes rápidos

`lib/config.ts`:

| Constante | Para quê |
|---|---|
| `SPLASH_DURATION` | duração total (15s) |
| `SPLASH_TO_LOGIN_MS` | transição para o login (900ms) |
| `REPLAY_SPLASH_EVERY_VISIT` | `false` roda a abertura uma vez por sessão |
| `ALLOW_SKIP_SPLASH` | botão discreto "Pular" |

`lib/media.ts`: momentos do vídeo (entrada, desaceleração, velocidade final).

> **Sobre os 15 segundos:** é o que a especificação pede e é o que está
> implementado. Mas quem usa o portal toda semana vai ver essa abertura toda
> vez. Se incomodar, `REPLAY_SPLASH_EVERY_VISIT = false` resolve sem tirar a
> abertura de quem chega pela primeira vez.

---

## Estrutura

```
app/
  layout.tsx              fontes + metadata + Service Worker
  page.tsx                orquestra splash → login e hospeda o vídeo
  manifest.ts             manifesto do PWA
  globals.css             tokens do design system
  dashboard/
    layout.tsx            header + sidebar + gaveta (não remonta ao navegar)
    page.tsx              o painel
    [...modulo]/          "em construção" para o que ainda não existe
components/
  brand/BrandMark         a logomarca oficial (+ selo claro)
  media/DroneBackdrop     o vídeo persistente: start / decelerate / freeze
  splash/SplashScreen     a timeline GSAP de 15s
  splash/ParticleField    campo de partículas em canvas
  login/                  LoginScreen, LoginCard, FormField, VerseOfTheDay,
                          AuthSuccessOverlay
  pwa/                    registro do Service Worker e troca de versão
  dashboard/              os 11 componentes do painel
  system/                 TravaDeRolagem (a abertura não rola; o painel sim)
  ui/                     Design System (Button, Card, Input, Table, Dialog…)
lib/
  config.ts               ajustes da abertura
  media.ts                o vídeo: recorte, tempos e a conta da desaceleração
  brand.ts                caminhos e regras de uso da logomarca
  verses.ts               os 51 versículos, vindos do export da igreja
  db/                     banco local (Dexie/IndexedDB) e fila
  sync/                   motor de sincronização
  dashboard/              tipos, dados, formatação pt-BR e o menu
public/
  sw.js                   Service Worker
  icons/                  ícones do aplicativo instalado
scripts/
  verificar-offline.mts   20 asserções da camada offline
  verificar-pwa.mjs       15 verificações num navegador de verdade
  verificar-dashboard.mjs 46 checagens em 4 tamanhos de tela
prisma/                   schema + importador
```

A troca splash → login acontece **dentro da mesma rota**: navegar para `/login`
no meio causaria flash branco e remount justo durante o fade de 900ms — e
desmontaria o vídeo, matando o congelamento.

---

## Responsividade

Verificado sem overflow horizontal, com o vídeo congelado no último quadro, em:
1440×900, 390×844 (iPhone), 820×1180 (iPad) e 2560×1080 (ultrawide).

`prefers-reduced-motion` é respeitado: a abertura mantém a narrativa em
velocidade acelerada e o vídeo vai direto ao quadro final.

---

## Deploy na Vercel

Páginas estáticas (`○ prerendered`), sem configuração especial. Defina
`DATABASE_URL` e `DIRECT_URL` nas variáveis de ambiente para quando as rotas de
API entrarem — `postinstall` já roda `prisma generate`.

---

## Próximos passos

**Fase 05 — módulos internos e API.** Chamada, Alunos, Professores, Classes,
Visitantes, Relatórios, Agenda e Configurações. Cada `page.tsx` criado substitui
automaticamente a tela de "em construção".

Junto com eles:

1. As rotas de API e, com elas, o transporte do motor de sincronização
   (`configurarTransporte`) — o motor já está pronto esperando.
2. `carregarPainel()` passa a buscar do servidor em vez de devolver o exemplo.
3. Ligar a autenticação real (`/api/auth/login`), conferindo o SHA-256 herdado
   da planilha e re-gravando em bcrypt/argon2 no primeiro login correto — assim
   a base migra sozinha, sem forçar ninguém a trocar de senha.
4. Ler os versículos do banco em vez do arquivo estático.
