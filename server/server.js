require('dotenv').config();
if(!process.env.JWT_SECRET){
  console.error(
    '❌  Faltando JWT_SECRET no .env — copie .env.example para .env e configure antes de rodar.'
  );
  process.exit(1);
}
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const db = require('./db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const diaryRoutes = require('./routes/diary');
const messageRoutes = require('./routes/messages');
const itunesRoutes = require('./routes/itunes');
const notificationRoutes = require('./routes/notifications');
const creditsRoutes = require('./routes/credits');
const artistInfoRoutes = require('./routes/artistinfo');
const reportRoutes = require('./routes/reports');
const spotifyRoutes = require('./routes/spotify');
const { checkMemories } = require('./utils/reminders');
const app = express();

// o Render (e o proxy do Netlify) ficam na frente do servidor — sem isso o
// Express acha que toda requisição é http e o req.ip é sempre o do proxy
app.set('trust proxy', 1);
app.disable('x-powered-by');

// origens que podem chamar a API com cookies: o site (Netlify) e, dentro do
// app empacotado com Capacitor, o "domínio" interno que o iOS/Android usam
// pra servir o conteúdo local do app. FRONTEND_ORIGIN aceita mais de uma
// origem separada por vírgula.
const allowedOrigins = new Set([
  ...(process.env.FRONTEND_ORIGIN || 'http://localhost:5500').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean),
  'https://cassete.netlify.app', // site em produção (Netlify)
  'capacitor://localhost', // iOS (Capacitor)
  'https://localhost',     // Android (Capacitor)
  'http://localhost',
  'http://localhost:5500', 'http://127.0.0.1:5500', // Live Server do VS Code
  'http://localhost:3001', 'http://127.0.0.1:3001', // frontend servido por este mesmo servidor
]);

app.use(
  cors({
    origin(origin, callback){
      // requisições sem "origin" (ex: apps mobile em alguns casos, curl, health checks)
      if(!origin || allowedOrigins.has(origin)) return callback(null, true);
      // origem desconhecida: só não manda os cabeçalhos de CORS (o navegador
      // bloqueia sozinho) — antes isso virava um erro 500 no servidor
      callback(null, false);
    },
    credentials: true, // necessário para os cookies de sessão irem e voltarem
  })
);

// cabeçalhos básicos de segurança (sem precisar do pacote helmet)
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// gzip nas respostas (JSON e arquivos do site) — fica bem menor no 4G
app.use(compression());

app.use(express.json({ limit: '3mb' })); // cabe avatar/foto de comentário em base64
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  try{
    db.prepare('SELECT 1').get();
    res.json({ ok: true });
  }catch(e){
    res.status(503).json({ ok: false });
  }
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/itunes', itunesRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/artist-info', artistInfoRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/spotify', spotifyRoutes);

// rota de API que não existe: responde JSON (e não a página HTML do front)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'rota não encontrada.' });
});

// se a pasta do frontend estiver do lado (rodando local), serve ela também —
// aí é só abrir http://localhost:3001 e tudo funciona num lugar só.
// Em produção (Render) a pasta não existe e isso é simplesmente ignorado.
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '..', 'web');
if(fs.existsSync(path.join(FRONTEND_DIR, 'index.html'))){
  app.use(express.static(FRONTEND_DIR, {
    extensions: ['html'],
    // HTML, JS, CSS e o service worker sempre revalidam (ETag → 304 barato),
    // senão uma atualização demoraria a chegar; imagens ficam 1 semana
    setHeaders(res, filePath){
      if(/\.(png|jpe?g|webp|svg|ico)$/.test(filePath)) res.set('Cache-Control', 'public, max-age=604800');
      else res.set('Cache-Control', 'no-cache');
    },
  }));
  console.log('servindo o frontend de', FRONTEND_DIR);
}

// tratador de erro genérico, pra nunca vazar stack trace pro cliente
app.use((err, req, res, next) => {
  if(err.type === 'entity.too.large'){
    return res.status(413).json({ error: 'arquivo grande demais — tente uma imagem menor.' });
  }
  if(err.type === 'entity.parse.failed'){
    return res.status(400).json({ error: 'requisição inválida.' });
  }
  console.error(err);
  res.status(500).json({ error: 'erro interno do servidor.' });
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Cassete backend rodando em http://localhost:${PORT}`);

  // roda uma vez ao subir o servidor e depois a cada 24h, criando
  // notificações de "memória" pra entradas de diário de 1 ano atrás
  checkMemories();
  setInterval(checkMemories, 24 * 60 * 60 * 1000).unref();
});

// desliga com calma (o Render manda SIGTERM a cada deploy): para de aceitar
// conexões, termina as que estão em andamento e fecha o banco direito
function shutdown(signal){
  console.log(`${signal} recebido — desligando...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
