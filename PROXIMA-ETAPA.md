# Continuação — Fase 09: Escola Bíblica completa

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
| 08 | **Menu em 6 categorias, permissões por papel (RBAC), Usuários, Permissões** |

## O plano das próximas fases (aprovado)

| Fase | Entrega |
|---|---|
| **09** | **Escola Bíblica: Congregações (com dirigente e vice), Aniversariantes, Lições, Pedido de Revistas** |
| 10 | Relatórios: Frequência, Ranking, Alerta de Faltas, Ficha do Aluno, Certificados, Auditoria |
| 11 | Agenda: Calendário, Eventos, Avisos, Reuniões |
| 12 | Administração e Configurações: Hierarquia, Escalas, Sistema, Backup, Sincronização, Offline, Logs |
| 13 | Pesquisa Global sobre registros (alunos, professores, classes…) + Offline First nos módulos novos |

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
  `Auditoria` é tabela do sistema antigo e não tem coluna de congregação.
  Resolve-se quando a auditoria nova (Fase 12) passar a gravá-la.

## Pendências do usuário (não são código)

1. **`AUTH_SECRET` na Vercel** — enquanto não existir, o portal fica aberto e
   mostra tarja vermelha "Portal sem proteção". Valor já gerado e entregue.
2. **Aplicar `prisma/aplicar-fase-08.sql`** no SQL Editor do Neon.
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
