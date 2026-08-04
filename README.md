# Portal da Escola Bíblica Dominical

**IEADPE — Campo de Betânia, Pernambuco**

> Ensinando a Palavra. Formando discípulos. Transformando vidas.

Next.js 15 · React 19 · TypeScript · TailwindCSS 4 · Framer Motion · GSAP · Prisma

---

## O que já existe

| Entrega | Estado |
|---|---|
| Splash cinematográfica de 15s com o vídeo oficial | pronta |
| Congelamento no melhor quadro da fachada | pronto |
| Tela de login premium sobre o quadro congelado | pronta |
| Schema Prisma + importador do sistema antigo | pronto (ver [README-IMPORT.md](./README-IMPORT.md)) |
| Dashboard, módulos, API, autenticação | **fora do escopo desta etapa** |

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
  layout.tsx              fontes + metadata
  page.tsx                orquestra splash → login e hospeda o vídeo
  globals.css             tokens do design system
components/
  brand/BrandMark         a logomarca oficial (+ selo claro)
  media/DroneBackdrop     o vídeo persistente: start / decelerate / freeze
  splash/SplashScreen     a timeline GSAP de 15s
  splash/ParticleField    campo de partículas em canvas
  login/                  LoginScreen, LoginCard, FormField, VerseOfTheDay,
                          AuthSuccessOverlay
  ui/                     Button, Checkbox
lib/
  config.ts               ajustes da abertura
  media.ts                o vídeo: recorte, tempos e a conta da desaceleração
  brand.ts                caminhos e regras de uso da logomarca
  verses.ts               os 51 versículos, vindos do export da igreja
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

## Próximos passos sugeridos

1. Ligar a autenticação real (`/api/auth/login`), conferindo o SHA-256 herdado
   da planilha e re-gravando em bcrypt/argon2 no primeiro login correto — assim
   a base migra sozinha, sem forçar ninguém a trocar de senha.
2. Ler os versículos do banco em vez do arquivo estático.
3. Construir o Dashboard e apontar o `onDone` do `AuthSuccessOverlay` para ele.
