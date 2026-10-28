const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const rateLimit = require('../utils/rateLimit');
const { serializeUser } = require('../utils/serialize');
const { USERNAME_RE, EMAIL_RE, cleanString } = require('../utils/validate');

let nodemailer = null;
try{ nodemailer = require('nodemailer'); }catch(e){ /* opcional — sem nodemailer instalado, o link só vai pro log */ }

const router = express.Router();
const { COOKIE_NAME } = requireAuth;

const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 dias
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // o bcrypt ignora o que passar de 72 bytes

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'muitas tentativas de login — espere uns minutos e tente de novo.' });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'muitos cadastros a partir daqui — tente de novo mais tarde.' });
const emailLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'muitos pedidos de e-mail — espere um pouco antes de pedir de novo.' });

const { cookieOpts } = require('../utils/cookies');

function startSession(req, res, user){
  const token = jwt.sign(
    { uid: user.id, sv: user.session_version || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.cookie(COOKIE_NAME, token, { ...cookieOpts(req), maxAge: SESSION_MAX_AGE });
}

function hashToken(token){
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function passwordError(password){
  if(typeof password !== 'string' || password.length < PASSWORD_MIN) return `a senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if(Buffer.byteLength(password) > PASSWORD_MAX) return `a senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  return null;
}

function frontendUrl(){
  // FRONTEND_ORIGIN pode ter várias origens separadas por vírgula — o link
  // dos e-mails usa a primeira
  const first = (process.env.FRONTEND_ORIGIN || '').split(',')[0].trim();
  return (first || 'http://localhost:3001').replace(/\/$/, '');
}

router.post('/signup', signupLimiter, async (req, res, next) => {
  try{
    const body = req.body || {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const { password } = body;
    const nationality = cleanString(body.nationality, 60);
    const genres = Array.isArray(body.genres)
      ? [...new Set(body.genres.filter(g => typeof g === 'string' && g.trim()).map(g => g.trim().slice(0, 40)))].slice(0, 30)
      : [];

    if(!username || !email || !password) return res.status(400).json({ error: 'preencha usuário, e-mail e senha.' });
    if(!USERNAME_RE.test(username)) return res.status(400).json({ error: 'o nome de usuário precisa ter de 3 a 30 caracteres, só letras, números, ponto ou _ (sem espaço nem acento).' });
    if(!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'e-mail inválido.' });
    const pwErr = passwordError(password);
    if(pwErr) return res.status(400).json({ error: pwErr });
    if(!nationality) return res.status(400).json({ error: 'escolha sua nacionalidade.' });
    if(genres.length === 0) return res.status(400).json({ error: 'escolha pelo menos um estilo musical.' });
    if(body.acceptedTerms !== true) return res.status(400).json({ error: 'pra criar a conta, aceite os Termos de Uso e a Política de Privacidade.' });

    const existing = db.prepare(
      'SELECT id FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE'
    ).get(username, email);
    if(existing) return res.status(409).json({ error: 'usuário ou e-mail já cadastrado.' });

    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare(
      "INSERT INTO users (username, email, password_hash, nationality, genres, terms_accepted_at) VALUES (?,?,?,?,?,datetime('now'))"
    ).run(username, email, hash, nationality, JSON.stringify(genres));

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    startSession(req, res, user);
    sendVerificationEmail(user).catch(e => console.error('não deu pra mandar e-mail de verificação:', e.message));
    res.status(201).json({ user: serializeUser(user) });
  }catch(e){
    next(e);
  }
});

// hash fixo pra comparar quando o usuário não existe — assim a resposta
// demora o mesmo tanto e não dá pra descobrir quais contas existem pelo tempo
const DUMMY_HASH = bcrypt.hashSync('cassete-dummy-password', 10);

router.post('/login', loginLimiter, async (req, res, next) => {
  try{
    const { identifier, password } = req.body || {};
    if(typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password){
      return res.status(400).json({ error: 'preencha usuário/e-mail e senha.' });
    }
    const id = identifier.trim();

    const row = db.prepare(
      'SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE'
    ).get(id, id);
    const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
    if(!row || !ok){
      return res.status(401).json({ error: 'usuário/e-mail ou senha incorretos.' });
    }

    startSession(req, res, row);
    res.json({ user: serializeUser(row) });
  }catch(e){
    next(e);
  }
});

router.post('/logout', (req, res) => {
  // sem maxAge aqui: no Express 4, passar maxAge pro clearCookie recria o
  // cookie com validade nova em vez de apagar
  res.clearCookie(COOKIE_NAME, cookieOpts(req));
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

// trocar a senha estando logado (pede a atual). Derruba as outras sessões
// e renova a desta, pra quem trocou não ser deslogado.
router.post('/change-password', requireAuth, loginLimiter, async (req, res, next) => {
  try{
    const { currentPassword, newPassword } = req.body || {};
    if(typeof currentPassword !== 'string' || !currentPassword) return res.status(400).json({ error: 'digite sua senha atual.' });
    const pwErr = passwordError(newPassword);
    if(pwErr) return res.status(400).json({ error: pwErr });

    const ok = await bcrypt.compare(currentPassword, req.user.password_hash);
    if(!ok) return res.status(401).json({ error: 'a senha atual está incorreta.' });

    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?').run(hash, req.user.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    startSession(req, res, user);
    res.json({ ok: true, message: 'senha alterada.' });
  }catch(e){
    next(e);
  }
});

function getMailTransport(){
  if(!nodemailer || !process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

async function sendVerificationEmail(user){
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // válido por 24h

  db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(user.id);
  db.prepare('INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES (?,?,?)')
    .run(user.id, hashToken(token), expiresAt);

  const verifyUrl = `${frontendUrl()}/?verify=${token}`;
  const transport = getMailTransport();

  if(transport){
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: 'Confirme seu e-mail no Cassete',
      text:
        `Oi, ${user.username}! Só falta confirmar seu e-mail pra sua conta no Cassete.\n\n` +
        `Clique no link abaixo (válido por 24 horas):\n${verifyUrl}\n\n` +
        'Se você não criou essa conta, pode ignorar esse e-mail.',
    });
  } else {
    // sem SMTP configurado — o link vai só pro log do servidor, útil em desenvolvimento
    console.log('[verificação de e-mail] SMTP não configurado — link pra', user.email, ':', verifyUrl);
  }
}

router.post('/verify-email', (req, res) => {
  const { token } = req.body || {};
  if(typeof token !== 'string' || !token) return res.status(400).json({ error: 'link inválido.' });

  const row = db.prepare('SELECT * FROM email_verifications WHERE token_hash = ?').get(hashToken(token));
  if(!row || new Date(row.expires_at).getTime() < Date.now()){
    return res.status(400).json({ error: 'link inválido ou expirado — peça um novo.' });
  }

  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(row.user_id);
  db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(row.user_id);

  res.json({ ok: true, message: 'e-mail confirmado!' });
});

router.post('/resend-verification', requireAuth, emailLimiter, async (req, res) => {
  if(req.user.email_verified){
    return res.json({ ok: true, message: 'seu e-mail já tá confirmado.' });
  }
  try{
    await sendVerificationEmail(req.user);
  }catch(e){
    console.error('não deu pra reenviar o e-mail de verificação:', e.message);
  }
  res.json({ ok: true, message: 'se o envio de e-mail estiver configurado, um novo link foi mandado.' });
});

router.post('/forgot-password', emailLimiter, async (req, res, next) => {
  try{
    const email = typeof (req.body || {}).email === 'string' ? req.body.email.trim() : '';
    // resposta sempre genérica — não revela se o e-mail existe na base ou não
    const genericReply = () => res.json({
      ok: true,
      message: 'se esse e-mail existir na nossa base, você vai receber um link em instantes.',
    });
    if(!email) return genericReply();

    const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
    if(!user) return genericReply();

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // válido por 1 hora

    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
    db.prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?,?,?)')
      .run(user.id, hashToken(token), expiresAt);

    const resetUrl = `${frontendUrl()}/?reset=${token}`;
    const transport = getMailTransport();

    if(transport){
      try{
        await transport.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: user.email,
          subject: 'Redefinir sua senha no Cassete',
          text:
            'Alguém (esperamos que você) pediu pra redefinir a senha da sua conta no Cassete.\n\n' +
            `Clique no link abaixo pra escolher uma senha nova (válido por 1 hora):\n${resetUrl}\n\n` +
            'Se não foi você, pode ignorar esse e-mail — sua senha continua a mesma.',
        });
      }catch(e){
        console.error('não deu pra enviar o e-mail de redefinição:', e.message);
      }
    } else {
      // sem SMTP configurado (ex: ainda em desenvolvimento) — o link vai só
      // pro log do servidor, pra dar pra testar sem precisar mandar e-mail de verdade
      console.log('[reset de senha] SMTP não configurado — link pra', user.email, ':', resetUrl);
    }

    genericReply();
  }catch(e){
    next(e);
  }
});

router.post('/reset-password', loginLimiter, async (req, res, next) => {
  try{
    const { token, password } = req.body || {};
    if(typeof token !== 'string' || !token || !password) return res.status(400).json({ error: 'preencha os dados pra redefinir a senha.' });
    const pwErr = passwordError(password);
    if(pwErr) return res.status(400).json({ error: pwErr });

    const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(hashToken(token));
    if(!row || new Date(row.expires_at).getTime() < Date.now()){
      return res.status(400).json({ error: 'link inválido ou expirado — peça um novo.' });
    }

    const hash = await bcrypt.hash(password, 10);
    // troca a senha e derruba todas as sessões antigas dessa conta. Quem
    // chegou aqui abriu o link do e-mail, então o e-mail também fica confirmado.
    db.prepare('UPDATE users SET password_hash = ?, session_version = session_version + 1, email_verified = 1 WHERE id = ?').run(hash, row.user_id);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.user_id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
    startSession(req, res, user);
    res.json({ user: serializeUser(user) });
  }catch(e){
    next(e);
  }
});

module.exports = router;
