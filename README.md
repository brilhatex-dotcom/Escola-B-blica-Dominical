# Portal Oficial — Escola Bíblica Dominical

**IEADPE — Campo de Betânia, Pernambuco**

> Ensinando a Palavra. Transformando vidas.

Next.js 15 · React 19 · TypeScript · TailwindCSS 4 · Framer Motion · GSAP · Prisma

---

## O que já existe

| Entrega | Estado |
|---|---|
| Splash cinematográfica de 15s | pronta |
| Tela de login premium | pronta |
| Schema Prisma + importador do sistema antigo | pronto (ver [README-IMPORT.md](./README-IMPORT.md)) |
| Demais telas do sistema | **fora do escopo atual** |

O login **não autentica de verdade ainda** — a chamada está simulada, com o
ponto exato de troca marcado em `components/login/LoginCard.tsx`.

---

## Rodando

```bash
npm install
npm run dev          # http://localhost:3000
```

Outros comandos:

```bash
npm run build        # build de produção
npm run typecheck    # tsc --noEmit
```

Os comandos de banco estão em [README-IMPORT.md](./README-IMPORT.md).

---

## A logomarca oficial

A arte oficial da IEADPE (`IEADPE.png`, 2000×1597, fundo transparente) é o
elemento principal das duas telas. Ela é usada **como bitmap, sem nenhuma
alteração** — não é recolorida, redesenhada, recortada, espelhada nem esticada.
O único ajuste é escala proporcional.

| Arquivo | O quê |
|---|---|
| `public/brand/ieadpe-logo.png` | master web, 1000×798 (reduzido proporcionalmente do oficial) |
| `public/brand/ieadpe-mask.png` | máscara de alfa, 260px, ~18 KB |
| `app/icon.png` | favicon, a partir do ícone oficial |

Todos os efeitos acontecem **atrás ou em volta** da marca: sombra projetada,
halo, selo, partículas, brilho horizontal e inclinação 3D. Nenhum toca nos
pixels da arte.

A máscara de alfa existe para que o campo de partículas e o brilho horizontal
conheçam o *contorno* da marca sem baixar o master de 442 KB.

### Por que a marca aparece sobre um selo claro

O texto arqueado "ASSEMBLEIA DE DEUS" e o "PERNAMBUCO" da arte oficial são
azuis (#1060A0). Medindo o contraste contra os fundos deste portal:

| Fundo | Contraste |
|---|---|
| Preto da splash | 3,20:1 |
| Azul do card (#0B1F45) | 2,47:1 |
| Versão ícone oficial sobre o próprio fundo | 1,15:1 |

Ou seja: **a logomarca foi desenhada para fundo claro.** Sobre fundo escuro o
letreiro some e a marca perde leitura.

Como a arte não pode ser alterada — nem recolorir o texto, nem trocar por uma
versão "para fundo escuro" —, a saída correta de manual de marca é apoiá-la
sobre a superfície clara para a qual foi feita. É o que o selo circular faz:
branco → #F5F7FA, fio dourado discreto, sombra suave. Desenhado **atrás**; a
arte segue intacta.

Se quiser a marca sem selo, é a prop `plate` do `<BrandMark />`.

## Os vídeos de ambiente

Nenhum vídeo foi versionado. As duas telas funcionam sem eles: há um fundo
"catedral" em CSS que sustenta a atmosfera sozinho.

Para ativar, coloque os arquivos em `public/media/` (nomes e specs em
[`public/media/README.md`](./public/media/README.md)) e vire
`HAS_AMBIENT_VIDEO = true` em `lib/config.ts`.

## Paleta

Toda a interface segue as cores da própria logomarca. Predominância do azul
institucional; o vermelho só em pequenos detalhes (erros de formulário) e o
dourado só em brilhos e destaques.

| Cor | Hex | Token | Uso |
|---|---|---|---|
| Azul institucional | `#163A70` | `brand-600` | predominante |
| Azul escuro | `#0B1F45` | `brand-800` | superfícies e profundidade |
| Branco | `#FFFFFF` | `white` | selo da marca, textos |
| Cinza claro | `#F5F7FA` | `brand-50` | base do selo, texto corrido |
| Dourado | `#D4AF37` | `gold-400` | brilhos e destaques |
| Vermelho da chama | `#D62828` | `flame-500` | apenas pequenos detalhes |

---

## A abertura, segundo a segundo

Toda a coreografia é uma única `gsap.timeline` em
`components/splash/SplashScreen.tsx` — ler o `useEffect` é ler o roteiro.

| Tempo | Acontece |
|---:|---|
| 0,0s | preto absoluto |
| 0,5s | ponto de luz dourada, pulsando |
| 1,0s | a luz solta partículas; elas giram |
| 2,0s | as partículas começam a formar a logomarca |
| 4,0s | logomarca nítida; brilho varre da esquerda para a direita |
| 5,0s | "ASSEMBLEIA DE DEUS EM PERNAMBUCO" |
| 7,0s | "Campo de Betânia" |
| 9,0s | leve zoom de câmera + vídeo desfocado ao fundo |
| 11,0s | "Ensinando a Palavra. / Transformando vidas." |
| 13,0s | brilho dourado toma a tela; partículas se desfazem |
| 15,0s | fade para preto → login (800ms) |

### Como a formação de partículas funciona

A máscara de alfa da logomarca é rasterizada num canvas fora de tela; os pixels
opacos viram a nuvem de destinos; cada partícula recebe um destino, um atraso
próprio e uma curva levemente diferente. Por isso a figura **cristaliza em
ondas** em vez de estalar de uma vez. As partículas são douradas (#D4AF37) — a
marca em si nunca muda de cor.

O campo é ancorado no `rect` real do elemento da marca (`anchorRef`), não num
palpite de porcentagem — é isso que faz as partículas assentarem exatamente
sobre o bitmap que aparece depois, em qualquer tamanho de tela.

### O parallax 3D

Rotação rígida de no máximo **±5°** em cada eixo, com perspectiva, seguindo o
ponteiro. É inclinação, não deformação: a marca nunca gira por completo, nunca
estica e nunca sai de foco. Em telas de toque, onde não há ponteiro, um respiro
lento assume o mesmo papel.

### A geometria do selo

O selo é um círculo de 137% da largura da marca, posicionado de forma absoluta —
ou seja, transborda a caixa da logo e não ocupa espaço no fluxo. Em vez de
compensar isso com margens ajustadas à mão (que precisariam de um número
diferente para cada altura de tela), o wrapper usa `aspect-[100/137]` e reserva
o quadrado do selo. A partir daí margens normais funcionam em qualquer viewport.

### Ajustes rápidos

Tudo em **`lib/config.ts`**:

| Constante | Para quê |
|---|---|
| `SPLASH_DURATION` | duração total (15s) |
| `SPLASH_TO_LOGIN_MS` | transição para o login (800ms) |
| `REPLAY_SPLASH_EVERY_VISIT` | `false` roda a abertura uma vez por sessão |
| `ALLOW_SKIP_SPLASH` | botão discreto "Pular" |
| `HAS_AMBIENT_VIDEO` | liga o `<video>` de fundo |

> **Sobre os 15 segundos:** é o que a especificação pediu e é o que está
> implementado. Mas quem usa o portal toda semana vai ver essa abertura toda vez.
> Se ela começar a incomodar, `REPLAY_SPLASH_EVERY_VISIT = false` resolve sem
> tirar a abertura de quem chega pela primeira vez.

---

## Estrutura

```
app/
  layout.tsx              fontes (Cinzel, Playfair, Inter) + metadata
  page.tsx                orquestra splash → login na mesma rota
  globals.css             tokens do design system
components/
  brand/                  BrandMark — a logomarca oficial
  splash/                 SplashScreen (timeline GSAP), ParticleField (canvas)
  login/                  LoginScreen, LoginCard, FormField, VerseOfTheDay,
                          AuthSuccessOverlay
  media/                  AmbientVideo (vídeo + fallback catedral em CSS)
  ui/                     Button, Checkbox
lib/
  config.ts               ajustes da abertura
  brand.ts                caminhos e regras de uso da logomarca
  verses.ts               os 51 versículos, vindos do export da igreja
prisma/                   schema + importador
```

A troca splash → login acontece **dentro da mesma rota**, de propósito: navegar
para `/login` no meio causaria flash branco e remount justo durante o fade de
800ms.

---

## Responsividade

Verificado sem overflow horizontal em: 1440×900, 390×844 (iPhone), 820×1180
(iPad), 2560×1080 (ultrawide) e 844×390 (celular deitado).

Em telas muito baixas o container do login rola sozinho, para o botão Entrar
nunca ficar inalcançável. `prefers-reduced-motion` é respeitado — a abertura
mantém a narrativa, mas em velocidade acelerada.

---

## Deploy na Vercel

O projeto é estático nessas duas telas (`○ prerendered`), então não há
configuração especial. Basta:

1. importar o repositório na Vercel;
2. definir `DATABASE_URL` e `DIRECT_URL` nas variáveis de ambiente (necessárias
   quando as rotas de API entrarem — `postinstall` já roda `prisma generate`).

---

## Próximos passos sugeridos

1. Ligar a autenticação real (`/api/auth/login`), conferindo o SHA-256 herdado
   da planilha e re-gravando em bcrypt/argon2 no primeiro login correto — assim
   a base migra sozinha, sem forçar ninguém a trocar de senha.
2. Ler os versículos do banco em vez do arquivo estático.
3. Construir o Dashboard e apontar o `onDone` do `AuthSuccessOverlay` para ele.
