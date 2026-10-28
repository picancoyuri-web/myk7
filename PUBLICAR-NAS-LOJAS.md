# MyK7 — publicar na Play Store e na App Store

O app das lojas é a pasta `web/` empacotada com **Capacitor 8**. Os projetos nativos
já estão prontos em `android/` e `ios/`. Toda mudança em `web/` vai pros dois com:

```bash
npm install          # uma vez
npx cap sync         # depois de mexer em web/
```

| | |
|---|---|
| ID do app (não muda nunca depois de publicar) | `br.com.ntech.myk7` |
| Nome | MyK7 |
| Versão | 1.0 (build 1) |
| Backend usado pelo app | `https://myk7.onrender.com/api` |

---

## 0. Antes de publicar (obrigatório)

1. **Banco de dados persistente no Render.** No plano grátis o banco SQLite é apagado a cada
   deploy — com o app nas lojas, isso apagaria a conta de todo mundo. Use o `render.yaml`
   (plano Starter + disco de 1 GB em `/var/data`) ou adicione um *Persistent Disk* no serviço
   atual e defina `DB_PATH=/var/data/cassete.db`.
2. Defina no Render `ADMIN_USERNAMES` (seu usuário) — é quem modera as denúncias.
3. Faça o deploy do backend **e** do site (Netlify) desta versão: o cadastro agora exige o
   aceite dos Termos.
4. Confira que `https://myk7.netlify.app/privacidade.html` e `/termos.html` abrem — as duas lojas
   pedem esses links.

## 1. Android (Play Store) — dá pra fazer neste PC

Requisitos: Android Studio (já instalado) e a conta Google Play Console (US$ 25, uma vez).

1. **Gerar a chave de assinatura (só uma vez — guarde o arquivo e as senhas para sempre):**
   ```bash
   cd android
   keytool -genkeypair -v -keystore myk7-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias myk7
   ```
   Copie `keystore.properties.example` para `keystore.properties` e preencha as senhas.
   O `.jks` e o `keystore.properties` **não** vão pro GitHub (já estão no `.gitignore`).
2. **Gerar o pacote:** `npm run android:release` → sai em
   `android/app/build/outputs/bundle/release/app-release.aab`.
   (Se o Gradle reclamar de Java, use o JDK 21: `JAVA_HOME=C:\Users\MULTI\.jdks\jbr-21.0.11`.)
3. Para cada nova versão, aumente `versionCode` e `versionName` em `android/app/build.gradle`.
4. No Play Console: criar app → enviar o `.aab` em **Teste interno** → depois **Produção**.
   Contas novas de pessoa física precisam de um teste fechado com 12 testadores por 14 dias
   antes de liberar a produção.

## 2. iOS (App Store) — precisa de um Mac

Requisitos: Mac com Xcode 16+, conta Apple Developer (US$ 99/ano).

1. Copie o projeto pro Mac, rode `npm install && npx cap sync ios && npx cap open ios`.
2. No Xcode: *Signing & Capabilities* → escolha o Team, confira o Bundle ID `br.com.ntech.myk7`.
3. *Product → Archive* → *Distribute App* → App Store Connect.
4. No App Store Connect preencha a ficha (textos abaixo) e envie para revisão.

Alternativa sem Mac: serviços de build na nuvem (Ionic Appflow, Codemagic) compilam o `ios/`.

O `Info.plist` já tem: textos de permissão de fotos/câmera (sem eles o app fecha ao postar um
Momento), só retrato no iPhone, idioma pt-BR e `ITSAppUsesNonExemptEncryption = false`.

---

## 3. Requisitos de revisão que o app já cumpre

- **Excluir conta dentro do app** (Apple 5.1.1(v) / Google): Perfil → “excluir minha conta permanentemente”.
- **Conteúdo gerado por usuários** (Apple 1.2): aceite de Termos com tolerância zero no cadastro,
  denunciar pessoa/resenha/comentário/momento/mensagem, bloquear, e moderação pelo
  `GET /api/reports` + `POST /api/reports/:id/resolve` (`{"action":"remove"}` ou `"dismiss"`).
- **Política de Privacidade e Termos** dentro do app (cadastro e Perfil) e no site.
- **Login próprio** (usuário/e-mail + senha): não exige “Entrar com a Apple”.
- **Anúncios:** pedido de rastreamento do iPhone (ATT) com texto explicativo, tela de consentimento do
  Google (LGPD/GDPR) e botão "privacidade dos anúncios" no Perfil. Classificação de anúncios: Teen.
- **Assinatura** (Apple 3.1.1 / 3.1.2): compra só pela loja, botão "restaurar compras", preço e
  período vindos da loja, texto de renovação automática e links de Termos/Privacidade na tela.
- No app das lojas o botão “conectar Spotify” fica escondido (o retorno do login do Spotify
  cai no site, não no app). Dá pra ligar depois com deep link.

### Conta de teste para os revisores
As duas lojas pedem um login que funcione. Crie no app publicado uma conta tipo
`revisao.myk7` com algumas escutas, momentos e pessoas seguidas, e informe usuário e senha
no formulário de revisão. Dê MyK7+ a ela se quiser que vejam o app sem anúncios:
`POST /api/billing/grant` com `{"username":"revisao.myk7","days":-1}` (logado como admin).

---

## 4. Textos da ficha da loja

**Nome:** MyK7 — Diário Musical
**Subtítulo (Apple, 30):** Seu diário de escuta
**Descrição curta (Google, 80):** Registre o que você ouve, dê notas, poste momentos e descubra música nova.

**Descrição completa:**

> Um diário de escuta, não de streams.
>
> O MyK7 é o lugar pra guardar a sua relação com a música. Cada disco ou música que você
> ouve vira uma fita no seu diário — com nota, resenha e a data em que ela marcou você.
>
> • **Diário de escuta** — registre álbuns e músicas, dê sua nota em estrelas e escreva o que sentiu.
> • **Momentos** — poste uma foto junto com a música que estava tocando, com filtros de fita.
> • **Disco do Dia** — todo mundo recebe o mesmo disco; dê sua nota e veja a da comunidade.
> • **Feed que toca** — prévias de 30 segundos começam na hora, enquanto você rola.
> • **Resenhas e pessoas** — siga amigos, veja o que estão ouvindo, comente e reaja.
> • **Retrospectiva e conquistas** — seu mês em stories, sua personalidade musical e 20 metas.
> • **Cards pro Instagram** — compartilhe sua fita, sua resenha ou o recibo das suas escutas.
> • **Quero ouvir** — a lista dos discos que você ainda vai descobrir.
>
> **MyK7+** — assine pra ouvir sem anúncios, ter a Retrospectiva sempre liberada e o selo no perfil.
>
> Sem algoritmo escondido. Sem vender seus dados. Só você e o que você ouve.
>
> Assinatura com renovação automática, cancelável a qualquer momento nas configurações da loja.
> Termos: https://myk7.netlify.app/termos.html · Privacidade: https://myk7.netlify.app/privacidade.html

**Palavras-chave (Apple, 100):** diario,musica,album,resenha,playlist,disco,escuta,lp,nota,vinil,fita,cassete
**Categoria:** Música (secundária: Redes Sociais)
**Classificação etária:** 12+ (Apple — conteúdo gerado por usuários / mensagens) · Google: questionário IARC → “Interação entre usuários”.
**URL de privacidade:** https://myk7.netlify.app/privacidade.html
**URL de suporte / marketing:** https://myk7.netlify.app
**E-mail de suporte:** ntechcontato.administrativo@gmail.com

### Segurança dos dados (Google) / Privacidade do app (Apple)
| Dado | Coletado | Vinculado à pessoa | Finalidade |
|---|---|---|---|
| E-mail, nome de usuário | sim | sim | funcionalidade do app, conta |
| Fotos (momentos, perfil) | sim | sim | funcionalidade do app |
| Mensagens | sim | sim | funcionalidade do app |
| Outro conteúdo (resenhas, notas) | sim | sim | funcionalidade do app |
| ID de publicidade do aparelho | sim (AdMob) | não | publicidade |
| Localização aproximada (pelo IP) | sim (AdMob) | não | publicidade |
| Interações com o app / anúncios | sim (AdMob) | não | publicidade, análise |
| Histórico de compras | sim | sim | funcionalidade do app (MyK7+) |
| Diagnóstico de falhas | sim (AdMob) | não | publicidade |
| Localização precisa, contatos, dados de cartão | **não** | — | — |

Dados criptografados em trânsito (HTTPS): **sim**. A pessoa pode pedir a exclusão: **sim** (no app).
**Contém anúncios: sim** (marque no Play Console). **Rastreamento (Apple): sim** — dados usados
para publicidade de terceiros, só com permissão no ATT. Play Console → *Conteúdo do app* →
*ID de publicidade*: **sim, usa**, finalidade "Publicidade ou marketing".

### Imagens exigidas
- **Ícone:** `assets/icon-only.png` (1024×1024, já gerado).
- **Google — imagem de destaque:** 1024×500.
- **Capturas de tela:** iPhone 6,9" (1320×2868) e Android (1080×1920 ou maior), 3 a 8 cada.
  Os cards de Story em `Desktop/myk7-previews` servem de base para as artes de divulgação.

---

## 5. Monetização: anúncios (AdMob) e assinatura MyK7+ (RevenueCat)

Como está hoje: **anúncios de TESTE do Google** (aparecem com o selo "Test Ad", seguros pra demo) e a
assinatura mostrando "as assinaturas abrem em breve" até as chaves da RevenueCat serem colocadas.
Tudo fica em `MONETIZATION` no `web/index.html` (procure por `const MONETIZATION`).
No **site** (navegador) não aparece anúncio nem assinatura — só no app.

**O que quem não assina vê:** banner adaptativo fixo acima da navegação, um card do MyK7+ a cada
8 fitas no feed, e a Retrospectiva liberada por 24 h assistindo um vídeo recompensado.
**O que o MyK7+ dá:** sem anúncios, Retrospectiva sempre liberada, selo "MyK7+" no perfil (visível
pra todo mundo).

### Ligar os anúncios de verdade (AdMob)
1. Crie a conta em https://admob.google.com e adicione **dois apps** (Android e iOS), ligando cada
   um à loja depois de publicado.
2. Em cada app crie dois blocos: **Banner** (adaptativo) e **Premiado** (recompensado).
3. Troque os IDs:
   - App ID Android → `android/app/src/main/AndroidManifest.xml` (`com.google.android.gms.ads.APPLICATION_ID`)
   - App ID iOS → `ios/App/App/Info.plist` (`GADApplicationIdentifier`)
   - IDs dos blocos → `MONETIZATION.admob` no `web/index.html`, e `adsTestMode: false`
4. iOS: adicione a lista completa de `SKAdNetworkItems` do guia do Google ao `Info.plist`
   (hoje só tem a do próprio Google).
5. AdMob → *Privacidade e mensagens*: crie a mensagem de consentimento **GDPR/LGPD** e a de **IDFA
   (iOS)** — o app já chama as duas.
6. Publique `app-ads.txt` no site (`web/app-ads.txt`, com a linha que o AdMob mostra) e informe
   `https://myk7.netlify.app` como site do desenvolvedor nas duas lojas.
⚠️ Nunca clique nos seus próprios anúncios reais — o Google suspende a conta. Teste sempre com
`adsTestMode: true`.

### Ligar a assinatura (RevenueCat + lojas)
1. **Lojas:** crie a assinatura nas duas (ex.: `myk7_plus_mensal` R$ 9,90 e `myk7_plus_anual`
   R$ 79,90), num grupo "MyK7+". Apple: assine o *Paid Apps Agreement* e preencha dados bancários.
2. **RevenueCat** (grátis até US$ 2.500/mês de receita): crie o projeto, ligue os dois apps,
   importe os produtos, crie o entitlement **`premium`** e uma *Offering* padrão com os pacotes
   *Monthly* e *Annual*.
3. Copie as chaves **públicas** (`appl_...`, `goog_...`) para `MONETIZATION.revenuecat` no
   `web/index.html` e rode `npx cap sync`.
4. No Render: `REVENUECAT_SECRET_KEY` (chave secreta v1, `sk_...`) e `REVENUECAT_WEBHOOK_AUTH`
   (um texto aleatório). Na RevenueCat → *Integrations → Webhooks*: URL
   `https://myk7.onrender.com/api/billing/webhook` e o mesmo texto no campo *Authorization*.
5. Teste com conta *Sandbox* (Apple) e *testadores de licença* (Google) — não cobra de verdade.

O servidor nunca confia no app: o MyK7+ só vale depois que ele confirma com a RevenueCat
(`POST /api/billing/refresh`) ou recebe o webhook. Pra dar MyK7+ manualmente (parceiros,
revisores, demo): `POST /api/billing/grant` `{"username":"...","days":30}` (-1 = sem prazo, 0 = tirar).

---

## 6. Comandos úteis

```bash
npm run assets           # refaz ícones e splash a partir de assets/
npm run android          # sincroniza e abre no Android Studio
npm run ios              # sincroniza e abre no Xcode (Mac)
npm run android:release  # gera o .aab assinado da Play Store
```
