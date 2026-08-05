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
| 05 | Relatórios, Agenda, Configurações | pronto |
| 06 | Autenticação real (login, sessão, proteção das rotas) | pronto |
| 07 | Sincronização offline ligada na Chamada | pronto |
| 08 | Menu em 6 categorias, permissões por papel (RBAC), Usuários | pronto |
| 09 | Congregações, Aniversariantes, Lições, Pedido de Revistas | pronto |

---

## Autenticação

### O que herdamos, e por que é grave

As 19 contas do sistema antigo têm **o mesmo hash SHA-256** — ou seja, **a mesma
senha**. E SHA-256 puro, sem sal, é fraco por construção: foi feito para ser
*rápido*, e é essa velocidade que permite testar bilhões de palpites por segundo
numa placa de vídeo comum.

### A migração acontece sozinha, sem ninguém perder acesso

A regra da igreja é não alterar registro do sistema antigo, e ela é respeitada:
nada é reescrito por conta própria. Quem troca é **a pessoa** — ao entrar com a
senha herdada, o portal pede uma nova, e é a nova que é gravada em **bcrypt**
(fator 12, ~250 ms por tentativa, com sal próprio em cada hash).

O bloqueio de gravação para quem ainda usa a senha herdada existe e está
**desligado hoje**, por decisão da liderança, até a reunião em que as senhas
serão trocadas — ver *A senha herdada, até a reunião da liderança*, mais abaixo.
O interruptor é `EXIGIR_SENHA_PROPRIA_PARA_GRAVAR`, em `lib/config.ts`.

### Decisões que valem explicar

| Decisão | Por quê |
|---|---|
| Mesma mensagem para "usuário não existe" e "senha errada" | Distinguir entrega a lista de logins válidos a quem estiver testando |
| Verifica senha mesmo quando o login não existe | Sem isso, a resposta instantânea denuncia "este login não existe" apesar da mensagem idêntica |
| `timingSafeEqual` na comparação | `a === b` para no primeiro caractere diferente, e a diferença de tempo é mensurável pela rede |
| Cookie `httpOnly` em vez de `localStorage` | JavaScript não lê cookie `httpOnly`; um script de terceiro não leva a sessão embora |
| JWT em vez de sessão no banco | Cada navegação seria uma ida ao Postgres, de todo aparelho, num domingo de manhã |
| Validade de 8 horas | JWT não dá para revogar antes de expirar — 8h é um domingo, não os 30 dias comuns |
| `sameSite: lax` | O cookie não viaja numa requisição disparada por outro site (defesa contra CSRF) |
| Sair é `POST`, não `GET` | Um `GET` pode ser disparado por um `<img>` de qualquer site, deslogando alguém no meio da chamada |
| A senha atual é pedida na troca, mesmo com sessão aberta | Sem isso, um celular desbloqueado em cima do banco permite tomar a conta |

### Sem `AUTH_SECRET`, o portal continua aberto — e diz isso

Não há valor padrão no código: um padrão seria idêntico a não ter segredo, com a
agravante de parecer seguro. Enquanto a variável não existir no servidor, as
rotas de escrita continuam liberadas (o mesmo grau de abertura de antes desta
fase) e o painel exibe uma **tarja vermelha** de "Portal sem proteção".

Trancar tudo seria pior: a igreja ficaria sem sistema, sem ninguém entender por
quê e sem caminho de volta.

```
AUTH_SECRET   (mínimo 32 caracteres, aleatório)
```

Verificado com servidor de verdade, 13 cenários: senha errada, usuário
inexistente, senha herdada, gravação bloqueada, troca recusada para a senha
antiga e para só-números, troca aceita, hash virando `$2b$12$…`, gravação
liberada, login com a senha nova, senha antiga deixando de funcionar, logout,
gravação após logout e cookie forjado.

### Sobre a Landing Page

A lista de abertura do briefing cita três entregas (Splash, Landing Page,
Login), mas o bloco **IMPORTANTE** no fim enumera a entrega como três itens que
não incluem landing page — splash, congelamento e login — e fecha com "Não criar
páginas extras".

Segui o bloco final, que é o mais específico. **Não há landing page.** Se ela era
para existir mesmo, é um acréscimo direto: a arquitetura já suporta, porque o
vídeo de fundo é um componente independente das telas.

---

## Escola Bíblica (Fase 09)

### Dirigente e vice vêm de `PessoaCargos`, não de colunas em `Congregacoes`

Guardar `dirigenteId` e `viceId` direto na congregação parece mais simples e cria
duas fontes de verdade para o mesmo fato. No dia em que alguém trocasse o
Dirigente pela tela de Hierarquia, a coluna aqui continuaria apontando para a
pessoa anterior — e as duas telas mostrariam nomes diferentes, ambas "corretas".

Como o vínculo já mora em `PessoaCargos` desde a Fase 05, **com a congregação
dentro**, a congregação apenas o consulta. Trocar o Dirigente continua sendo
alteração em um lugar só.

**Cargo vago aparece como vago**, com o lugar reservado. Omitir a linha faria a
tela parecer completa — e é justamente essa ausência que alguém precisa ver.

### Aniversário não tem ano

Filtrar por intervalo de datas não acha ninguém: quem nasceu em 12/08/1974 está
fora de qualquer intervalo de 2026. A comparação é por **mês e dia**
(`EXTRACT(MONTH)`), ignorando o ano.

Um índice sobre `nasc` não ajuda nessa forma, e tudo bem — são 323 alunos e a
varredura é instantânea. Criar um índice de expressão aqui resolveria um problema
que não existe.

A idade mostrada é a que a pessoa **completa** naquele mês, não a de hoje: numa
lista de aniversariantes, "faz 15 anos" é a informação.

### O filtro da tela nunca amplia o recorte do acesso

Em Aniversariantes, `?cong=1` na barra de endereço é interceptado: o alvo é a
**interseção** entre o que a tela pediu e o que o acesso permite. Sem isso, um
Dirigente veria os aniversariantes de outra congregação digitando um número.

### Lições: o que foi dado vem da chamada, não do calendário

Marcar como ministrada toda lição cuja data já passou seria fácil e mentiria — o
número viria do relógio, não da igreja, e um trimestre inteiro sem chamada
apareceria como um trimestre em dia. `classesQueDeram` vem de `Freq_Licao`.

`null` (nenhum registro) é distinto de `0`. Uma lição do próximo mês com "0
classes" parece atraso; sem registro nenhum ela apenas ainda não chegou — e
chamar de "pendente" o que não venceu treina a secretaria a ignorar o aviso.

### Revistas: o pedido é calculado, não cadastrado

A aba `Pedidos_Revistas` do sistema antigo veio **vazia** — nunca foi usada. Não
há como importar o que não existe, e um cadastro em branco daria uma tela que só
funciona depois de alguém digitar tudo de novo.

O que existe são os alunos por classe e a tabela de preços (35 linhas, reais).
Com as duas, o pedido nasce pronto: uma revista por aluno ativo. Resultado real:
**290 revistas, R$ 3.062,00**.

O `tipoClasse` é texto livre e a tabela de preços usa as próprias chaves; o
casamento é por normalização. **O que não casa fica de fora do valor**, e a tela
diz quantas classes são — tratar categoria ausente como zero produziria um total
menor que o real, com aparência de conferido.

O ajuste de quantidade é **rascunho e some ao sair**, e a tela avisa. Um número
que a pessoa digita e o sistema esquece sem avisar é pior do que um rascunho
assumido.

---

## Permissões (RBAC)

### O papel vem do CARGO — não de um cadastro à parte

A Fase 05 já modelava `Pessoa ──< PessoaCargo >── Cargo`, e `PessoaCargo` já
guardava **em qual congregação** o cargo é exercido. É exatamente o recorte que
as permissões precisam: *"o Dirigente da Cong. Bandeiras vê a Cong. Bandeiras"*.

Por isso não existe coluna "perfil de acesso" em lugar nenhum. Criar uma
produziria o defeito clássico: alguém deixa de ser Dirigente no organograma e
continua enxergando a congregação, porque ninguém lembrou de mexer na outra
tela. **Trocar o Dirigente é alteração de dado — em um lugar só.**

Dos oito papéis pedidos, seis já eram cargos existentes. Faltavam dois, e é só
isso que `prisma/aplicar-fase-08.sql` acrescenta:

```
Secretário Local  (ordem 65, escopo congregação)
Vice-Dirigente    (ordem 75, escopo congregação)
```

### Os nove papéis

| Papel | Alcance | Grava |
|---|---|---|
| Pastor Presidente | campo | tudo |
| Gestor Local | campo | tudo |
| Supervisor da EBD | campo | tudo da EBD — **não** contas nem permissões |
| Secretário Geral do Campo | campo | o que é da secretaria |
| Dirigente | própria congregação | chamada, cadastro, agenda local |
| Vice-Dirigente | própria congregação | igual ao Dirigente |
| Secretário Local | própria congregação | chamada, alunos, visitantes, revistas |
| Professor | própria congregação | **só** chamada e visitantes |
| Administrador do sistema | campo | tudo (conta técnica herdada) |

O nono não é cargo da igreja: é o que as duas contas `master` da planilha viram.
Chamá-lo de "Pastor Presidente" faria o organograma mentir — a conta `admin` não
é o pastor.

### A chave do menu é a chave da permissão

`lib/dashboard/navegacao.ts` declara os módulos; `lib/auth/papeis.ts` diz quais
chaves cada papel enxerga — **as mesmas chaves**. Não há uma segunda lista de
"módulos protegidos" para manter em dia. Duas listas divergem, e divergem
calando: liberando ou escondendo sem que ninguém perceba.

O script de verificação confere justamente isso: toda chave citada numa
permissão precisa existir no menu. Sem essa conferência, um `rel-frequencias`
escrito no plural liberaria nada e pareceria liberar tudo.

### Esconder botão não é proteger

Quem protege é a guarda no servidor (`lib/auth/guarda.ts`), conferida em toda
gravação — `exigirLeitura(chave)` e `exigirEscrita(chave)`.

O que o navegador faz é diferente e igualmente necessário: **não oferecer ao
professor um botão que vai recusá-lo.** Uma tela que mostra o que a pessoa não
pode fazer transforma cada clique numa mensagem de erro e ensina a desconfiar do
sistema.

Por isso, também, digitar o endereço de um módulo fora do alcance responde
**"Sem acesso"**, e não "em construção". Dizer "em construção" ali seria uma
inverdade cortês: a pessoa esperaria a próxima versão de um módulo que já existe
e nunca será dela.

### O recorte é aplicado no banco, não na tela

`/api/painel` filtra por congregação **dentro da consulta**. A alternativa
preguiçosa — buscar tudo e esconder na tela — enviaria ao navegador de um
professor os números de todo o campo; bastaria abrir as ferramentas do navegador
para ler o que a tela decidiu não desenhar.

`undefined` no `where` do Prisma significa "não filtre", e é assim que quem
enxerga o campo vê tudo. O contrário — montar a lista de todas as congregações —
daria o mesmo resultado hoje e o resultado errado no dia em que uma congregação
nova for cadastrada.

Três recortes têm exceção explicada no código:

| O quê | Por quê |
|---|---|
| **Liderança do campo** não se recorta | Saber quem é o Pastor Presidente é de toda a igreja |
| **Eventos sem congregação** aparecem para todos | Senão o Congresso do Campo sumiria de todas as congregações |
| **Atividades recentes** vêm vazias para o grupo B | `Auditoria` é tabela do sistema antigo e **não tem coluna de congregação** — recortá-la exigiria adivinhar pelo texto, que é decidir por conta própria sobre registro herdado |

### A sessão carrega o acesso

O papel é apurado **uma vez, no login**, e viaja dentro do JWT assinado. Decidir
permissão consultando o banco significaria uma ida ao Postgres por clique, de
todo aparelho da igreja, num domingo de manhã. Como o JWT é assinado, um cookie
adulterado para dizer "pastor-presidente" não passa na verificação.

O preço é que mudança de cargo vale na próxima entrada da pessoa — e isso é o
certo: promover alguém no meio do domingo não deve derrubar a chamada que ele
está fazendo.

Sessões emitidas **antes** desta fase continuam válidas: sem papéis no cookie, o
acesso cai no perfil herdado. Recusá-las deslogaria metade da igreja no instante
da publicação, possivelmente no meio de uma chamada.

### As 19 contas herdadas, e o palpite marcado como palpite

As contas do sistema antigo não são pessoas — são contas de congregação
("Cong. Pinheiro", "T. Matriz") — e têm só dois perfis: `master` (2) e `coord`
(17). Nada disso é reescrito. O campo `perfil` continua exatamente como veio, e
o portal apenas o **interpreta**: `master` → administrador do sistema; `coord` →
dirigente da própria congregação.

Cada conta nessa situação aparece em **Administração → Usuários** com a marca
**presumido**, e o topo da tela diz quantas são. Confirmar é ligar a conta a uma
pessoa e dar a ela o cargo que exerce — a partir daí o acesso passa a vir do
organograma.

### A senha herdada, até a reunião da liderança

`EXIGIR_SENHA_PROPRIA_PARA_GRAVAR`, em `lib/config.ts`. Hoje está **`false`** a
pedido da liderança: as senhas ficam exatamente como estão e a gravação segue
liberada, com uma tarja dizendo, sem rodeio, que a senha é compartilhada e que a
auditoria registrará o nome de quem ela pertence.

Com `true`, no dia em que `AUTH_SECRET` fosse definida, ninguém que ainda usa a
senha antiga conseguiria registrar chamada — a EBD inteira pararia num domingo
de manhã. Depois da reunião, virar para `true` liga a proteção sem mais nada a
fazer.

### O menu

Seis categorias, mais de trinta destinos, **uma seção aberta por vez**. Numa
lista corrida, "Chamada" — o item usado toda semana — ficaria a meio metro de
rolagem num celular. A seção da tela atual já abre sozinha: ninguém precisa
procurar onde está.

**Classes não estava na lista pedida e ficou no menu assim mesmo.** São 53
classes cadastradas, e a Chamada, os Alunos e todos os relatórios dependem
delas; tirá-la deixaria a secretaria sem como corrigir uma classe.

**Congregações aparece duas vezes**, como pedido, com leituras diferentes: em
Escola Bíblica é a visão pastoral (quem é o dirigente e o vice de cada uma); em
Administração é o cadastro. As duas entram na Fase 09.

Verificado com `npm run verificar:permissoes`: **97 asserções**, todas passando.

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
npm run verificar:offline     # camada offline, no Node (fake-indexeddb)
npm run verificar:permissoes  # a matriz de papéis e o menu, no Node
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
| `lib/db/repositorio.ts` | `salvar` · `salvarPacote` · `remover` · `receberDoServidor` · `confirmarEnvio` |
| `lib/db/chamadas.ts` | a chamada no aparelho: guardar, ler, saber se subiu |
| `lib/sync/motor.ts` | esvazia a fila contra o servidor |
| `lib/sync/transporte.ts` | quem de fato fala com `/api/chamada` |
| `lib/sync/erros.ts` | a diferença entre "tente de novo" e "não adianta" |
| `components/sync/SincronizacaoProvider.tsx` | apresenta o motor ao transporte, no navegador |

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

O **transporte** é injetado de fora (`configurarTransporte`) em vez de estar
escrito dentro do motor. É por isso que o motor pode ser exercitado no Node, sem
rede nenhuma, com um servidor de mentira que recusa, aceita ou some no meio.

### A Chamada, ligada na fila

O botão "Gravar chamada" **não fala com o servidor**. Ele escreve no IndexedDB e
enfileira; quem fala com o servidor é o motor, que insiste sozinho até
conseguir.

A ordem é o ponto. Enviando primeiro, existe uma janela — do toque no botão até
a resposta chegar — em que a chamada só existe na memória da aba. É ali que ela
se perdia: sinal que cai no meio, tela que bloqueia e o sistema descarta a
página, alguém que fecha a aba sem esperar. Escrevendo primeiro, essa janela não
existe; no pior caso a chamada está guardada e ainda não subiu, que é uma
situação com conserto.

### A chamada é UM pacote na fila, não trinta

O resto do banco local enfileira **intenções** ("mudei o nome", depois "mudei o
telefone") e todas precisam subir, na ordem. A chamada não é assim: cada
gravação é a lista inteira da classe naquele domingo — o estado completo. Uma
gravação nova torna a anterior irrelevante.

Por isso existe `salvarPacote`, ao lado de `salvar`: o pacote novo **substitui**
o antigo na fila, na mesma transação. Sem isso, marcar dez alunos, gravar sem
sinal, marcar mais cinco e gravar de novo mandaria a versão velha e logo em
seguida a nova, à toa.

A rota `POST /api/chamada` grava a classe toda numa transação e é idempotente,
então reenviar o mesmo pacote atualiza em vez de duplicar. É o que permite ao
motor insistir sem medo de dobrar a presença de ninguém.

**Os três estados atravessam a fila.** `marcas` só carrega quem foi marcado;
quem não está na lista continua sem registro nenhum no banco, que é o terceiro
estado. Mandar `presente: false` para eles transformaria chamada inacabada em
faltas — e faltas inventadas entram no relatório do mês como se fossem reais.

### Erro que não adianta repetir

O motor foi feito para insistir, e insistir é o certo para rede que cai. Mas há
recusas que não passam sozinhas — a principal é o `403` de quem ainda usa a
senha herdada: o servidor vai recusar hoje, daqui a uma hora e amanhã, até a
pessoa trocar a senha. Insistir aí é uma requisição a cada 30 segundos, a manhã
inteira, sem uma única chance de sucesso.

`ErroPermanente` marca esses casos (401, 403, 400, 422). O item **não é
descartado** — apagar a chamada de domingo por causa de uma senha seria o pior
resultado possível. Ele fica parado, contado no indicador do painel, e o motor
nem chega a tentar enviá-lo. Quando a pessoa troca a senha,
`liberarBloqueios()` destrava a fila e a chamada sobe.

O reconhecimento é por uma marca no próprio objeto, e não por `instanceof`: o
mesmo arquivo pode ser carregado duas vezes num processo (aconteceu ao rodar o
motor no Node, onde o script de verificação é ESM e o portal é CommonJS), e duas
classes de mesmo nome fariam o motor tratar "troque a senha" como falha de rede.

### O indicador deixou de chamar fila cheia de "falha"

Antes, qualquer coisa na fila pintava o `SystemStatus` de vermelho com "Falha ao
enviar" — inclusive um item que estava apenas esperando o próximo intervalo.
Agora são três coisas diferentes: **Reenviando…** (dourado, passa sozinho),
**Envio bloqueado** (vermelho, alguém precisa agir, e a tela diz o quê) e
**Trabalhando offline**. Vermelho para tudo ensina a ignorar o vermelho.

### O que ainda depende de conexão

Abrir a Chamada numa classe pela **primeira vez** precisa de servidor: a lista de
alunos vem de `/api/chamada`. Depois disso, a classe fica guardada no aparelho e
a tela abre sem sinal, com a última lista carregada.

Desmarcar um aluno **já gravado no servidor** não apaga o registro de lá — a rota
não tem remoção, e inventar uma aqui mexeria em dado do sistema antigo sem
autorização. Marcar como ausente funciona normalmente.

Verificado com `npm run verificar:offline`: **54 asserções**, todas passando,
inclusive o domingo inteiro — sinal cai, chamada é feita, aplicativo é fechado,
sinal volta e a chamada sobe sozinha, numa requisição só.

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

### Como aplicar no banco

**Caminho simples — sem linha de comando.** Abra o SQL Editor do Neon, cole
`prisma/aplicar-fase-05.sql` inteiro e clique em Run. Ele traz as tabelas novas
e as 59 pessoas já apuradas, e termina imprimindo a conferência:

```
pessoas_unicas  cargos_ocupados  acumulam_funcao  a_conferir
      59              68                9              5
```

**Caminho da linha de comando**, para quem tiver o projeto na máquina:

```bash
npm run db:deploy             # aplica a migration
npm run db:pessoas            # apura as pessoas a partir do texto livre
npm run db:pessoas -- --dry   # só mostra o que faria
```

### A migration é aditiva, e repetível

Não apaga, não renomeia e não altera nenhuma tabela do sistema antigo. A única
mudança em tabela existente é uma coluna nova e opcional em `Usuarios`
(`pessoaId`), que nasce nula. **Dá para rodar com o sistema no ar.**

O arquivo de colar leva guardas que a migration não precisa: `prisma migrate
deploy` registra o que já aplicou e nunca repete, mas colar à mão não registra
nada — sem `IF NOT EXISTS` em tudo e blocos `EXCEPTION WHEN duplicate_object`
nas chaves estrangeiras, a segunda colagem quebraria no meio e deixaria o banco
pela metade.

Verificado: três aplicações seguidas, mesmo resultado, com os 319 alunos e as
2.592 frequências intactos.

### Quando há dois projetos Neon

A integração Neon+Vercel pode **criar um projeto Neon novo e vazio** ao ser
instalada. O resultado é silencioso e confuso: o SQL é aplicado no projeto que
você criou, o app fala com o projeto que a integração criou, e os dois lados
parecem certos.

Foi o que aconteceu aqui — o app lia um banco vazio em `sa-east-1` enquanto os
dados estavam em `us-east-1`.

**Como resolver:** crie na Vercel a variável `EBD_DATABASE_URL` com a string de
conexão do projeto certo. Ela tem prioridade sobre tudo o que a integração
criar, e sobrevive às atualizações dela — disputar o nome com a integração é
perder, porque ela reescreve as variáveis dela.

`/api/diagnostico` mostra qual host, qual banco e quais tabelas o app está
enxergando, sem expor usuário nem senha.

### A variável de conexão pode ter outro nome

A integração Neon+Vercel nomeia a variável conforme o tipo de conexão
(`POSTGRES_PRISMA_URL` ou `DATABASE_URL`) e ainda aceita um **prefixo** escolhido
na instalação — ela pode chegar como `STORAGE_DATABASE_URL`.

Exigir o nome exato transformaria um detalhe de instalação num defeito
silencioso: o portal publicaria sem erro nenhum e mostraria dados de
demonstração para sempre, porque não achou uma variável que estava ali com outro
nome. Por isso `lib/prisma.ts` procura por **sufixo**, aceitando prefixo.

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
| `/api/relatorios` | frequência por classe e ofertas do período |
| `/api/agenda` | eventos e reuniões numa lista só, mais as escalas |
| `/api/lideranca` | GET a hierarquia, POST troca quem ocupa um cargo |
| `/api/diagnostico` | com qual banco o app está falando |

### A liderança é editada, não recompilada

`/dashboard/configuracoes` troca quem ocupa cada cargo. Os candidatos são as
**pessoas já cadastradas**, e não um campo de texto — digitar o nome à mão foi
exatamente o que produziu "Ana costa", "Ana maria da costa" e "Ana Maria costa".

O vínculo anterior é **encerrado, não apagado**: `fim` recebe a data em que a
pessoa deixou a função e a linha permanece. Apagar destruiria o histórico — daqui
a dois anos ninguém responderia quem era o Supervisor da EBD em 2026, que é
exatamente a pergunta que uma ata faz. Quem volta a um cargo reaproveita o
vínculo antigo em vez de criar outro.

### Relatórios comparam por MÉDIA, não por soma

Uma classe que fez chamada em 3 domingos e outra que fez em 12 não são
comparáveis pelo total de presenças — a segunda pareceria quatro vezes melhor só
por ter registrado mais vezes. A média divide pelos domingos que **tiveram**
chamada, e a coluna "domingos" fica visível porque é o denominador: uma média de
40 apurada em 1 domingo não vale o mesmo que 38 apurada em 12.

O que o relatório **não** faz é dividir presenças pelo número de alunos de hoje
para achar a taxa de um domingo de março. O cadastro não guarda histórico de
matrícula; uma classe que dobrou desde então apareceria com metade da frequência
real, e o número pareceria confiável.

### A escala de culto não é um compromisso

Apesar do nome, `Escala_Cultos` guarda `mesAno`, `nomeArquivo` e `url`: é o
**arquivo** da escala do mês, uma folha digitalizada. Colocá-la na linha do tempo
da agenda inventaria um evento que nunca existiu, então ela sai numa lista
própria, de documentos.

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
  db/                     banco local (Dexie/IndexedDB), fila e a chamada
  sync/                   motor, transporte e os erros da sincronização
  dashboard/              tipos, dados, formatação pt-BR e o menu
public/
  sw.js                   Service Worker
  icons/                  ícones do aplicativo instalado
scripts/
  verificar-offline.mts   54 asserções da camada offline
  verificar-permissoes.mts 97 asserções do controle de acesso
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
