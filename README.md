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

## Duas coisas para você trocar

### 1. A logomarca oficial

O emblema atual é **provisório** — um brasão autoral (anel, raios, cruz sobre a
Bíblia aberta, pomba), porque não tive acesso ao arquivo oficial da IEADPE.

Troque os paths em **`lib/brand-mark.ts`**. É a única fonte do desenho: o
componente React e a formação de partículas da splash leem os dois do mesmo
lugar, então uma edição atualiza tudo.

O selo secundário da EBD fica em `components/brand/EbdMark.tsx`.

### 2. Os vídeos de ambiente

Nenhum vídeo foi versionado. As duas telas funcionam sem eles: há um fundo
"catedral" em CSS que sustenta a atmosfera sozinho.

Para ativar, coloque os arquivos em `public/media/` (nomes e specs em
[`public/media/README.md`](./public/media/README.md)) e vire
`HAS_AMBIENT_VIDEO = true` em `lib/config.ts`.

---

## A abertura, segundo a segundo

Toda a coreografia é uma única `gsap.timeline` em
`components/splash/SplashScreen.tsx` — ler o `useEffect` é ler o roteiro.

| Tempo | Acontece |
|---:|---|
| 0,0s | preto absoluto |
| 0,5s | ponto de luz dourada, pulsando |
| 1,0s | a luz solta partículas; elas giram |
| 2,0s | as partículas começam a formar o emblema |
| 4,0s | emblema formado; brilho varre da esquerda para a direita |
| 5,0s | "ASSEMBLEIA DE DEUS EM PERNAMBUCO" |
| 7,0s | "Campo de Betânia" |
| 9,0s | leve zoom de câmera + vídeo desfocado ao fundo |
| 11,0s | "Ensinando a Palavra. / Transformando vidas." |
| 13,0s | brilho dourado toma a tela; partículas se desfazem |
| 15,0s | fade para preto → login (800ms) |

### Como a formação de partículas funciona

O emblema é rasterizado num canvas fora de tela; os pixels opacos viram a nuvem
de destinos; cada partícula recebe um destino, um atraso próprio e uma curva
levemente diferente. Por isso a figura **cristaliza em ondas** em vez de estalar
de uma vez.

O campo é ancorado no `rect` real do elemento do emblema (`anchorRef`), não num
palpite de porcentagem — é isso que faz as partículas assentarem exatamente
sobre o SVG que aparece depois, em qualquer tamanho de tela.

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
  brand/                  BrandMark (IEADPE), EbdMark
  splash/                 SplashScreen (timeline GSAP), ParticleField (canvas)
  login/                  LoginScreen, LoginCard, FormField, VerseOfTheDay,
                          AuthSuccessOverlay
  media/                  AmbientVideo (vídeo + fallback catedral em CSS)
  ui/                     Button, Checkbox
lib/
  config.ts               ajustes da abertura
  brand-mark.ts           o desenho do emblema (fonte única)
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

1. Trocar a logomarca provisória pela arte oficial.
2. Ligar a autenticação real (`/api/auth/login`), conferindo o SHA-256 herdado
   da planilha e re-gravando em bcrypt/argon2 no primeiro login correto — assim
   a base migra sozinha, sem forçar ninguém a trocar de senha.
3. Ler os versículos do banco em vez do arquivo estático.
4. Construir o Dashboard e apontar o `onDone` do `AuthSuccessOverlay` para ele.
