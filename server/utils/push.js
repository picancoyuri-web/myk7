const jwt = require('jsonwebtoken');
const db = require('../db');

// Notificação no celular pelo Firebase Cloud Messaging (API HTTP v1).
// Precisa da variável FIREBASE_SERVICE_ACCOUNT com o JSON da conta de serviço
// do projeto Firebase (Configurações do projeto → Contas de serviço → Gerar
// nova chave privada). Sem ela, nada é enviado e o app segue normal.

let account = null;
try{
  if(process.env.FIREBASE_SERVICE_ACCOUNT) account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
}catch(e){
  console.warn('[push] FIREBASE_SERVICE_ACCOUNT inválida:', e.message);
}

let cachedToken = null;
let cachedUntil = 0;

async function accessToken(){
  if(cachedToken && Date.now() < cachedUntil) return cachedToken;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }, account.private_key, { algorithm: 'RS256' });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if(!res.ok) throw new Error(`token do Google: ${res.status}`);
  const body = await res.json();
  cachedToken = body.access_token;
  cachedUntil = Date.now() + (body.expires_in - 120) * 1000;
  return cachedToken;
}

async function sendToToken(token, { title, body, data }){
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await accessToken()}` },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: data || {},
        android: { priority: 'high', notification: { channel_id: 'myk7', color: '#D6B26E' } },
        apns: { payload: { aps: { sound: 'default' } } },
      },
    }),
  });
  if(res.ok) return;
  // aparelho desinstalou o app ou o token expirou: esquece o token
  if(res.status === 404 || res.status === 400){
    const err = await res.json().catch(() => null);
    const code = err && err.error && err.error.details && err.error.details.map(d => d.errorCode).join(',');
    if(res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(code || '')){
      db.prepare('DELETE FROM push_tokens WHERE token = ?').run(token);
      return;
    }
  }
  console.warn('[push] envio falhou:', res.status);
}

// envia pra todos os aparelhos da pessoa, sem travar a resposta da rota
function sendPush(userId, payload){
  if(!account || !userId) return;
  const tokens = db.prepare('SELECT token FROM push_tokens WHERE user_id = ?').all(userId);
  tokens.forEach(t => sendToToken(t.token, payload).catch(e => console.warn('[push]', e.message)));
}

const TEXTS = {
  follow: 'começou a seguir você',
  comment: 'comentou numa escuta sua',
  like: 'curtiu seu comentário',
  listen: 'registrou uma escuta nova',
  reaction: 'reagiu a uma escuta sua',
  mention: 'mencionou você num comentário',
  post: 'postou um momento novo',
  post_like: 'curtiu seu momento',
  post_comment: 'comentou no seu momento',
};

function pushForNotification({ userId, actorId, type }){
  if(!account || type === 'listen') return; // escuta de quem você segue: só dentro do app, senão vira spam
  if(type === 'memory'){
    sendPush(userId, { title: 'MyK7', body: 'uma lembrança musical de 1 ano atrás te espera', data: { view: 'notifications' } });
    return;
  }
  const actor = db.prepare('SELECT username FROM users WHERE id = ?').get(actorId);
  const who = actor ? actor.username : 'alguém';
  sendPush(userId, { title: 'MyK7', body: `${who} ${TEXTS[type] || 'interagiu com você'}`, data: { view: 'notifications' } });
}

// diagnóstico sem expor nada: a chave carregou? o Google aceita a chave?
// o FCM responde ao envio com token falso (prova que projeto e permissão batem)
async function pushStatus(){
  if(!process.env.FIREBASE_SERVICE_ACCOUNT) return { push: 'sem variável FIREBASE_SERVICE_ACCOUNT' };
  if(!account || !account.private_key || !account.client_email || !account.project_id) return { push: 'variável com JSON inválido' };
  try{ await accessToken(); }catch(e){ return { push: 'Google recusou a chave', detail: e.message }; }
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await accessToken()}` },
    body: JSON.stringify({ validate_only: true, message: { token: 'teste-invalido', notification: { title: 't', body: 't' } } }),
  });
  if(res.status === 403) return { push: 'chave sem permissão no FCM (API do Cloud Messaging desligada?)' };
  if(res.status === 404 && !(await res.text()).includes('UNREGISTERED')) return { push: 'projeto não encontrado no FCM' };
  const devices = db.prepare('SELECT COUNT(*) AS n FROM push_tokens').get().n;
  return { push: 'ok', project: account.project_id, devices };
}

module.exports = { sendPush, pushForNotification, pushStatus };
