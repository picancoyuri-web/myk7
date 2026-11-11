# MyK7 — visual premium "Noite dourada" (claro e escuro) + logo com nome

Data: 10/11/2026 · Pedido do dono do app (NTECH)

## Por quê

O dono acha que o MyK7 "não parece um app de alto padrão". Referências que ele citou:
**Spotify, Apple Music e Instagram** — "quero algo bem premium". O app ainda não foi
publicado (vai para a Play Store em breve), então não há usuários a preservar: é a hora
de acertar a primeira impressão.

Hoje o visual é "hi-fi vintage": papel creme, fonte de máquina de escrever (JetBrains Mono,
134 usos), Anton em caixa alta (41), Fraunces (13), manuscrita Caveat (2), foto real de
cassete. Parece enfeitado/artesanal, não um produto caro e bem acabado.

## Objetivo

Fazer o MyK7 inteiro parecer um app premium no padrão Apple Music/Spotify, com **a fita
cassete como protagonista**, nos modos escuro e claro.

### Decisões do dono (não mudar)

1. **Direção "Noite dourada"** (escolhida entre 3 mockups): preto quente, texto marfim,
   detalhes em ouro.
2. **Precisa ter os dois modos, escuro e claro.** No claro, a variante escolhida foi
   **"fita marfim"**: fundo marfim, tudo suave; o ouro fica mais escuro para ter contraste.
3. **As fitas que já existem NÃO são substituídas.** Continua a foto de cassete
   (`img/cassette.jpg`, `--cassette-photo`), a variação de cor por disco (`--hue`), os
   carretéis que giram, a fita grossa (`--k7-edge`) e a inclinação (`.k7-tilt`). Pode
   **adaptar** a fita ao novo visual (bordas, lateral, sombra, moldura), não trocá-la por
   um desenho.
4. **Logo com o nome MyK7** + **versão MyK7+ para assinantes**, entregues em **PDF**.
5. O MyK7+ continua sendo só "sem anúncios + extras que já existem" — nenhuma função nova.

### Paleta de referência (dos mockups aprovados)

| Token | Escuro | Claro (marfim) |
|---|---|---|
| fundo | `#0D0B09` | `#F7F1E6` |
| texto | `#F6EFE3` | `#1A140D` |
| texto secundário | `rgba(246,239,227,.55)` | `rgba(26,20,13,.55)` |
| superfície/chip | `rgba(246,239,227,.07)` | `rgba(26,20,13,.06)` |
| linha/borda | `rgba(214,178,110,.18)` | `rgba(156,122,60,.25)` |
| ouro (destaque) | `#D6B26E` | `#9C7A3C` |
| botão principal | marfim sobre preto | `#1A140D` com texto marfim |
| barra de navegação | vidro `rgba(26,22,18,.75)` | vidro `rgba(255,251,244,.8)` |

Mockups aprovados: `.superpowers/brainstorm/824-1794339568/content/direcao-visual.html`
(opção C) e `modos-claro-escuro.html` (Escuro + "Claro · fita marfim").

## Escopo

### 1. Sistema visual do app (`web/index.html`)
- Trocar a paleta atual (`--ink`, `--paper`, `--mustard`, `--rust`, `--teal`…) pelos
  tokens acima, nos dois temas. Cores de acento antigas (ferrugem, verde-azulado, mostarda)
  saem; o único acento é o ouro. Vermelho só para ações destrutivas/erros.
- **Tipografia:** uma família sans moderna para toda a interface (minha escolha: **Inter**),
  com hierarquia forte: títulos grandes, peso 700–800, tracking negativo; corpo 400–500.
  Fim dos rótulos em monoespaçada/caixa alta como padrão de interface. A manuscrita
  (Caveat) fica **só no nome escrito na fita** (`.tape-name`), porque faz parte do cassete.
- **Layout e componentes** no padrão Apple Music/Spotify: mais respiro, cantos
  arredondados consistentes, botões/chips em pílula, barra inferior flutuante em vidro
  fosco (já existe; ajustar ao novo visual), gavetas (drawers) limpas, listas com
  separadores sutis, estados de toque discretos. Vale para **todas as telas**: Pra Você,
  Momentos, Resenhas, busca, diário, perfil, pessoas, mensagens, Retrospectiva, cards de
  compartilhar, cadastro/login, tutorial, gavetas.
- **Brilho da cor do disco** (minha escolha, o dono não vetou): atrás da fita em destaque
  (feed, Disco do Dia, detalhe do item) um brilho desfocado e suave na cor daquele disco,
  como o Apple Music. Discreto no modo claro.
- **Fitas adaptadas** (sem trocar a foto): moldura/borda fina dourada; no modo claro a
  lateral grossa (`--k7-edge`) usa tons marfim/dourado em vez do plástico escuro; sombras
  combinando com cada fundo.
- **Tema:** continua o botão de tema que já existe (`localStorage` + `data-theme`). Novo:
  se a pessoa nunca escolheu, segue o tema do celular (`prefers-color-scheme`). Hoje o
  padrão é sempre escuro.
- Manter o que já funciona: acessibilidade (`prefers-reduced-motion`,
  `prefers-reduced-transparency`, `prefers-contrast`), as gavetas com física, a inclinação
  das fitas, anúncios/assinatura, todas as funções. **Isto é só visual: nenhuma
  funcionalidade muda.**

### 2. Logo com nome + MyK7+
- **Lockup "MyK7":** o ícone atual (fita prateada, `Downloads/MyK7-nova-logo/myk7-logo.svg`)
  + o nome "MyK7" na nova fonte, ao lado.
- **Lockup "MyK7+":** mesmo lockup, com o "+" e acentos em ouro — a versão de assinante.
- Cada um em **fundo escuro (Noite dourada) e claro (marfim)** → 4 combinações.
- Entregas: **um PDF vetorial** com as 4, mais **SVG e PNG** de cada, numa pasta
  `Desktop/MyK7-logo/` (o dono abre a pasta e manda o PDF adiante).
- No app: a tela de assinatura (paywall), o card do MyK7+ no feed e o selo `.plus-badge`
  do perfil passam a usar o visual MyK7+ dourado.
- O ícone do app (o que aparece no celular) **não muda**.
- **MyK7+ = edição dourada completa** (resposta do dono, 10/11: "pode ser o mais"): o nome, o "+" **e** os detalhes da fita do ícone ficam em ouro no lugar da prata.

### 3. Publicação
- Depois de pronto: `npx cap sync`, novo `.aab` (continua versão 1.0 build 1, ainda não foi
  enviado), copiar para `Desktop/MyK7-lojas/`, subir o cache do service worker,
  preparar a pasta para o Netlify (o deploy no Netlify é manual, arrastando a pasta), commit
  e push.
- Refazer a **imagem de destaque da Play Store** (`play-destaque-1024x500.png`) no visual
  novo. Capturas de tela da loja ficam com o dono.

## Decisões do executor (Claude) após revisão — o dono pode vetar
- **Contraste no claro:** os valores do mockup claro não passam AA em texto pequeno
  (secundário 3,9:1, ouro 3,5:1). Mantém o visual, mas escurece os tokens até passar
  (ex.: secundário ≈ `rgba(26,20,13,.66)`, ouro de texto ≈ `#86672F`); o ouro do mockup
  fica para elementos grandes/decorativos. Texto sobre fundo dourado usa `#1A140D`.
- **Ponto de parada:** primeiro o sistema (tokens, fonte, componentes) + Pra Você + uma
  gaveta, nos dois modos → o dono aprova → depois o resto das telas.
- **Imagens para compartilhar e Retrospectiva (canvas):** visual fixo "Noite dourada",
  independente do tema de quem compartilha; esperar a fonte carregar
  (`document.fonts.ready`) antes de desenhar.
- **Splash nativa do Android** e cor das barras do sistema entram no escopo (são a
  primeira coisa que se vê); refazer o `.aab` no fim.
- **`termos.html` e `privacidade.html`** (com `legal.css`) entram no visual novo.
- `web/css/app.css` e `web/js/*.js` não são carregados pelo `index.html` → código morto,
  não mexer.

## Fora do escopo
- Funções novas, mudanças no backend, mudança de textos/fluxos (exceto rótulos que ficam
  em caixa alta só por estilo).
- Trocar o ícone do app, a foto da fita ou o nome escrito à mão na fita.
- iOS (o build é feito depois, num Mac); o mesmo `web/` serve para os dois.

## O que seria fracasso (mesmo funcionando)
- Ficar com cara de "tema escuro genérico": a fita perder o protagonismo.
- Modo claro com ouro claro ilegível, ou contraste ruim em qualquer modo (mirar WCAG AA
  em texto).
- Uma tela que ficou para trás no visual antigo (creme/monoespaçada) no meio das novas.
- Quebrar qualquer função existente (feed, prévias, gavetas, anúncios, assinatura).

## Restrições
- App em um arquivo único, sem framework: `web/index.html` (~500 KB, um `<style>` e
  vários `<script>`), JS puro. O mesmo arquivo vira o app Android/iOS via Capacitor 8.
- Fontes hoje vêm do Google Fonts. Se a nova fonte também vier de lá, o app precisa de
  internet para carregá-la (já é assim hoje); embutir é decisão do executor.
- O dono valida visualmente; verificar no Chrome (desktop e largura de celular, ~390 px),
  nos dois temas, antes de dizer que está pronto.

## Deixado para o executor
- Organização do CSS (reescrever do zero ou substituir por partes), nomes de tokens,
  medidas exatas de espaçamento/raio, ícones da barra, como o brilho da capa pega a cor
  (pode usar o `--hue`/gradiente que a fita já tem, ou a cor da capa).
- O desenho exato do lockup (espaçamento, tamanho relativo do nome) e a ferramenta para
  gerar o PDF.
