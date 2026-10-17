# Cassete v2

Um diário de escuta, não de streams. Esta é a versão reconstruída do app.

```
cassete-v2/
├── server/   ← BACKEND (Node + Express + SQLite) — vai pro Render
└── web/      ← FRONTEND (HTML + CSS + módulos JS, sem build) — vai pro Netlify
```

## Rodar no seu PC

```bash
cd server
npm install        # se o better-sqlite3 não compilar, copie a pasta node_modules do backend antigo
npm start
```

Abra **http://localhost:3001**. O servidor entrega o site e a API juntos.
Na primeira vez, se não existir `server/.env`, copie `.env.example` para `.env` e preencha o `JWT_SECRET`.

**Modo demonstração:** abra `http://localhost:3001/?demo`. O app roda inteiro no navegador,
com pessoas e escutas de exemplo (login: `voce.ouve` / `cassete123`).

## Deploy

**Render (backend):** Root Directory `cassete-v2/server` · Build `npm install` · Start `npm start`.
Variáveis: `JWT_SECRET`, `FRONTEND_ORIGIN=https://cassete.netlify.app`, `DISCOGS_TOKEN`, SMTP (opcional).
O banco antigo funciona sem perder nada: as mudanças no banco só acrescentam colunas.
Use um *Persistent Disk* e aponte `DB_PATH` pra ele, senão o banco é apagado a cada deploy.

**Netlify (frontend):** publique a pasta `cassete-v2/web/`. O `_redirects` (proxy da API) e o
`_headers` (cache) já estão dentro dela.

## O que mudou

### Frontend
- **De 1 arquivo de 563 KB para módulos pequenos.** As imagens em base64 saíram do HTML.
  A foto da fita (131 KB) virou uma fita desenhada em SVG: cada música ganha uma cor
  própria e tem o título escrito à mão na etiqueta.
- **Os rolos da fita giram quando ela toca.** Um player único fica fixo acima da navegação,
  com barra de progresso e controles na tela de bloqueio. Ele substitui as 6 funções de
  prévia duplicadas do original.
- **Botão voltar funciona.** Cada tela tem endereço próprio (`#/diario`, `#/u/marina`...).
- **Segurança:** todo texto de usuário passa por um template que escapa HTML
  automaticamente, então não existe mais a chance de esquecer um `escapeHtml`.
- **Desempenho:** uma busca no registro de fitas leva tempo constante (antes percorria uma
  lista a cada chamada). Os cards fora da tela não são desenhados (`content-visibility`).
  As notificações são checadas por uma rota leve a cada 20 s, e só com a aba visível
  (antes baixava a lista inteira a cada 30 s).
- **Visual:** tema escuro e claro (segue o aparelho, ou escolha no Perfil). Barra lateral no
  desktop. Folhas que sobem de baixo no lugar de `confirm()`. Esqueletos enquanto carrega.
  Animações respeitam "reduzir movimento".
- **Novidades:**
  - Resenhas com abas "Quem eu sigo" e "Todo mundo".
  - Diário agrupado por mês, com distribuição das suas notas e uma lembrança de 1 ano atrás.
  - Anel de compatibilidade no perfil de outra pessoa.
  - Mensagens não lidas, e a conversa aberta se atualiza sozinha.
  - Editar país e estilos, trocar senha, apagar conta e escolher o tema.
  - Cadastro em 2 passos.
  - Feed que nunca fica vazio: sem iTunes, ele usa o catálogo do app.

### Backend
- **Fotos por URL com cache** (`/api/users/:nome/avatar`, `/api/diary/comments/:id/photo`).
  Antes, cada lista de pessoas ou resenhas carregava todas as fotos em base64 dentro do JSON.
- **Lista de pessoas em 1 consulta** (antes eram 2 consultas extras por pessoa).
- **gzip** em todas as respostas e cache certo para os arquivos do site.
- **Rotas novas:**
  - `GET /api/notifications/poll` (contagens e novidades)
  - `GET /api/diary/recent` (resenhas de todo mundo)
  - `GET /api/messages/:nome?after=id` (mensagens novas da conversa)
  - `POST /api/auth/change-password`
  - `DELETE /api/users/me` (apaga a conta e tudo dela)
- **Mensagens lidas e não lidas** (coluna `read_at`). Limite de envio contra spam em
  comentários, escutas e mensagens.

### O que não mudou
- A "comunidade Cassete" (8 perfis de exemplo com resenhas) continua. Agora ela aparece
  marcada como **exemplo**, e não dá mais para mandar mensagem para esses perfis. Antes
  eles respondiam sozinhos como se fossem pessoas reais.
