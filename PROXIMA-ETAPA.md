# Continuação — Fase 08: otimização e acessibilidade

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

## O que já está pronto

| Fase | Entrega |
|---|---|
| 01 | PWA instalável, Service Worker, camada offline (Dexie), Design System |
| 02 | Splash de 15s com o vídeo oficial, congelamento e login |
| 03 | Schema Prisma + importação do sistema antigo (323 alunos, 2.599 frequências) |
| 04 | Dashboard completo |
| 05 | Pessoas e cargos normalizados, API sobre o Postgres, 9 módulos |
| 06 | Autenticação real (bcrypt, JWT em cookie httpOnly, rotas protegidas) |
| 07 | **Fila offline ligada na Chamada** — grava no aparelho, enfileira e reenvia sozinha |

## O que a Fase 07 entregou (para não refazer)

O botão "Gravar chamada" não fala mais com o servidor: escreve no IndexedDB e
enfileira. Quem envia é o motor (`lib/sync/motor.ts`), pelo transporte novo
(`lib/sync/transporte.ts`), ligado no navegador pelo
`components/sync/SincronizacaoProvider.tsx` (montado no layout do painel).

- A chamada vai **inteira, num pacote** (tabela local `chamadas`,
  `salvarPacote` no repositório) — nunca uma requisição por aluno.
- Os **três estados** por aluno atravessam a fila: quem não foi marcado
  simplesmente não entra no pacote.
- `403` da senha herdada é **erro que não adianta repetir**: o item fica parado
  e visível em vez de martelar o servidor, e sobe quando a pessoa troca a senha
  (`liberarBloqueios`).
- `npm run verificar:offline` — **54 asserções**, todas passando.

### O que ficou conhecido e não foi feito

- Abrir uma classe pela **primeira vez** ainda precisa de servidor (a lista de
  alunos vem da API). Depois disso a tela abre sem sinal.
- Desmarcar aluno **já gravado no servidor** não apaga o registro de lá — a rota
  não tem remoção, e criar uma mexeria em dado do sistema antigo.

## A PRÓXIMA ETAPA — o que fazer

**Fase 08 — otimização e acessibilidade.** Imagens, revalidação, `loading.tsx`
por rota e uma revisão de acessibilidade em todas as telas.

## Pendências do usuário (não são código)

1. **`AUTH_SECRET` na Vercel** — enquanto não existir, o portal fica aberto e
   mostra tarja vermelha "Portal sem proteção". Valor já gerado e entregue.
2. **Trocar a senha do banco no Neon** — ela apareceu num print compartilhado.
3. **Apagar o projeto Neon vazio** (`sa-east-1`, `ep-cold-leaf-…`) — o correto é
   o `ebd-betania` (`us-east-1`, `ep-muddy-snow-…`). O usuário é leigo e não
   conseguiu; precisa de passo a passo. **Não temos acesso à conta Neon.**

## Variáveis de ambiente

| Nome | Para quê |
|---|---|
| `EBD_DATABASE_URL` | conexão do banco certo; tem prioridade sobre o que a integração criar |
| `AUTH_SECRET` | assina a sessão; mínimo 32 caracteres |

`/api/diagnostico` mostra com qual banco o app está falando, sem expor senha.
