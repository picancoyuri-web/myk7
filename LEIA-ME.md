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

**Render (backend):** Root Directory `server` · Build `npm install` · Start `npm start`.
Variáveis: `JWT_SECRET`, `FRONTEND_ORIGIN=https://cassete.netlify.app`, `DISCOGS_TOKEN`,
`SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` (opcional) e SMTP (opcional) — todas explicadas em `server/.env.example`.
O banco antigo funciona sem perder nada: as mudanças no banco só acrescentam colunas e tabelas.
Use um *Persistent Disk* e aponte `DB_PATH` pra ele, senão o banco é apagado a cada deploy.

**Netlify (frontend):** Base directory `web` · Publish directory `web` · sem build command.
O `_redirects` (proxy da API) e o `_headers` (cache) já estão dentro dela — confira se a URL
do backend no `_redirects` é a do seu serviço no Render.

## Atualização de outubro/2026 (3) — MyK7

- **Nova identidade MyK7:** logo desenhada em SVG (fita + "My" escrito à mão + "K7"), que segue a
  cor do tema — clara no escuro, escura e cor de ferrugem no claro. Os carretéis da logo giram
  enquanto alguma música toca. Ícones do app, favicon, manifest e cards de Story com a marca nova.
- **Momentos (aba nova):** poste uma foto junto com a música que estava tocando. Filtros (Fita,
  Desbotado, P&B, Noite), busca da música ou sugestão do que acabou de tocar / do seu diário, legenda.
  No feed, um toque na foto toca a música, dois toques curtem; "som automático" toca cada momento
  ao aparecer na tela. Curtidas, comentários, notificações, grade de momentos no perfil e card de
  Story em polaroid. Rotas novas em `/api/posts` (tabelas `posts`, `post_likes`, `post_comments`
  — só acrescentam, o banco antigo continua valendo).
- **Música começa bem mais rápido:** um toca-fitas único reaproveita os `<audio>` do app, já baixa
  as próximas fitas do feed antes delas aparecerem (~50 ms pra começar, antes 0,3–1,7 s) e destrava
  o autoplay do iPhone no primeiro toque. O feed de **álbuns agora toca** (antes nunca tocava: o
  iTunes não manda prévia de álbum — o app busca a faixa mais ouvida dele). O feed começa a buscar
  junto com o login (antes esperava a sessão), as buscas ficam em cache (navegador 30 min,
  servidor 6 h) e o servidor do Render é "acordado" logo no primeiro byte da página.
- **Mais leve:** o `index.html` caiu de 687 KB pra ~400 KB (as imagens em base64 viraram arquivos
  em cache). O service worker antigo nunca funcionava (era criado via `blob:`); agora é o `sw.js`.
- Correções: botão de play invisível no tema claro, botões claros sobre fundo claro, sino de
  notificações caindo de linha no celular, ✕ dos modais fora do lugar.

## Atualização de outubro/2026 (2)

- **Disco do Dia:** todo mundo recebe o mesmo disco no mesmo dia (66 discos curados, ordem fixa).
  A nota da comunidade (média + distribuição) só aparece depois que você dá a sua; tem contagem
  regressiva pro próximo, sequência de dias seguidos e trecho pra ouvir (buscado no iTunes).
- **Conquistas:** 20 metas com barra de progresso (escutas, resenhas, estilos, sequências, disco do
  dia, coruja/madrugador...). Ao desbloquear, aparece um aviso comemorando.
- **Retrospectiva:** stories em tela cheia com o seu mês (fitas, artista e estilo nº 1, nota média,
  a fita do período) terminando na sua personalidade musical — com card pra postar.
- **Imagens pro Instagram refeitas:** formato Story (1080×1920), com a foto real da fita na cor da
  faixa e o nome escrito à mão no rótulo, @usuário, resenha e estrelas. Novo card **recibo** das
  escutas do período (botão 🧾 na playlist). As fontes agora carregam antes de desenhar.

## Atualização de outubro/2026

### Novidades
- **Quero ouvir:** botão "＋ quero ouvir" na ficha de qualquer disco; a lista fica no topo do Diário,
  com ★ pra registrar e ✕ pra tirar. Registrar a escuta tira o disco da lista sozinho.
- **4 favoritos no perfil:** escolha seus 4 discos/músicas (do seu diário ou pelo "♡ favoritar" na
  ficha). Aparecem também no seu perfil pra quem te visita.
- **Seus números:** resenhas, artistas, dias ouvindo, escutas por mês, artistas mais registrados e
  distribuição das suas notas.
- **Resenhas de todo mundo:** quando acaba o feed de quem você segue, a aba Resenhas continua com as
  resenhas recentes da comunidade real (antes só apareciam as de exemplo).
- **Bloquear, denunciar e Spotify funcionando:** os botões já existiam no app, mas as rotas não
  existiam no servidor. Bloquear desfaz o follow, impede mensagens e esconde a pessoa das listas.
- **Bio do perfil** agora é salva de verdade (antes o servidor ignorava).
- No perfil, as configurações da conta foram pro fim, depois do conteúdo.

### Correções
- Escutas achadas pela busca/feed (iTunes) quebravam o Diário e o Perfil depois de reabrir o app,
  e a ficha desses discos não abria.
- Registrar uma escuta com o servidor fora do ar fingia que tinha salvo; agora mostra o erro.
- Nomes ilegíveis (texto preto no fundo escuro) em Pessoas e Mensagens; vários textos com pouco
  contraste no tema claro.
- Títulos, artistas e estilos de outras pessoas agora são escapados no HTML (antes dava pra injetar
  código num perfil ou resenha).

## O que mudou na v2

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
