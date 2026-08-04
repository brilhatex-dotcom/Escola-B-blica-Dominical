# Continuação — Fase 07: ligar a fila offline na Chamada

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

## A PRÓXIMA ETAPA — o que fazer

**Ligar a fila de sincronização offline na Chamada.** A infraestrutura existe
desde a Fase 01 e nunca foi conectada.

Hoje, em `app/dashboard/chamada/page.tsx`, quando o `POST /api/chamada` falha, a
tela apenas mostra *"Não foi possível enviar agora"* e mantém as marcações em
memória — se a pessoa fechar a aba, a chamada se perde. Há um `TODO` marcando o
ponto exato.

Precisa passar a: gravar no IndexedDB, enfileirar, e deixar o motor reenviar
quando a internet voltar.

### Peças que já existem e devem ser usadas

| Arquivo | O que oferece |
|---|---|
| `lib/db/local.ts` | banco Dexie; índice composto `[classeId+data]` |
| `lib/db/repositorio.ts` | `salvar` · `remover` · `receberDoServidor` · `confirmarEnvio` — gravam tabela e fila na MESMA transação |
| `lib/db/schema.ts` | tipos locais; `uid` local imutável vs `idRemoto` |
| `lib/sync/motor.ts` | `configurarTransporte` · `sincronizar` · `iniciarSincronizacaoAutomatica` · `aoMudar` |
| `components/dashboard/SystemStatus.tsx` | já lê o motor e mostra online/offline/sincronizando |

O motor **para no primeiro erro** de propósito (a ordem importa: "criar aluno"
antes de "marcar presença desse aluno") e tem recuo progressivo de 2s até 5min.

### Pontos de atenção

- O transporte precisa mandar a chamada **inteira num pacote**, não uma
  requisição por aluno — a rota `POST /api/chamada` já é transacional e
  idempotente (reenviar atualiza em vez de duplicar).
- A chamada tem **três** estados por aluno: presente, ausente e **não marcado**.
  Não colapsar para dois.
- A rota exige sessão e recusa quem ainda usa a senha herdada (`403` com
  `precisaTrocar: true`). O motor precisa tratar isso como **erro que não
  adianta repetir** — reenviar em laço não resolve e só gasta bateria.
- `npm run verificar:offline` roda 20 asserções da camada offline no Node.

### Depois disso (não fazer sem aprovação)

Fase 07 — otimização: imagens, revalidação, `loading.tsx` por rota, e revisão
de acessibilidade.

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
