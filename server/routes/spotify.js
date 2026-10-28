const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { findUserByUsername } = require('../utils/serialize');

// "ouvindo agora" via Spotify. Precisa de um app criado em
// https://developer.spotify.com/dashboard com estas variáveis:
//   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
//   SPOTIFY_REDIRECT_URI (opcional) — padrão: <este servidor>/api/spotify/callback
// A Redirect URI precisa estar cadastrada igualzinha no painel do Spotify.
// Sem as variáveis, o app só mostra que o Spotify não está disponível.

const router = express.Router();

const SCOPES = 'user-read-currently-playing user-read-playback-state';
const NOW_PLAYING_CACHE_MS = 15 * 1000;
const nowPlayingCache = new Map(); // user_id -> { at, data }

function configured(){
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

function redirectUri(req){
  return process.env.SPOTIFY_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/spotify/callback`;
}

// pra onde a pessoa volta depois de autorizar (o site, não a API)
function frontendUrl(){
  const first = (process.env.FRONTEND_ORIGIN || 'https://myk7.netlify.app').split(',')[0].trim();
  return first.replace(/\/$/, '');
}

function basicAuth(){
  return 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
}

async function tokenRequest(params){
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  if(!res.ok) throw new Error(`spotify token ${res.status}`);
  return res.json();
}

// devolve um access token válido (renovando se precisar), ou null se a
// pessoa revogou o acesso no Spotify
async function accessTokenFor(userId){
  const row = db.prepare('SELECT * FROM spotify_tokens WHERE user_id = ?').get(userId);
  if(!row) return null;
  if(row.expires_at > Date.now() + 30 * 1000) return row.access_token;
  try{
    const data = await tokenRequest({ grant_type: 'refresh_token', refresh_token: row.refresh_token });
    db.prepare('UPDATE spotify_tokens SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ?')
      .run(data.access_token, data.refresh_token || row.refresh_token, Date.now() + data.expires_in * 1000, userId);
    return data.access_token;
  }catch(e){
    if(/ 400$/.test(e.message)) db.prepare('DELETE FROM spotify_tokens WHERE user_id = ?').run(userId); // acesso revogado
    return null;
  }
}

router.get('/login', requireAuth, (req, res) => {
  if(!configured()) return res.status(503).json({ error: 'a conexão com o Spotify ainda não está disponível.' });
  const state = jwt.sign({ uid: req.user.id, p: 'spotify' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: redirectUri(req),
    state,
  });
  res.json({ url });
});

router.get('/callback', async (req, res) => {
  const back = (status) => res.redirect(`${frontendUrl()}/?spotify=${status}`);
  if(!configured() || req.query.error || !req.query.code) return back('error');

  let payload;
  try{
    payload = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET);
    if(payload.p !== 'spotify') throw new Error('state');
  }catch(e){
    return back('expired');
  }

  try{
    const data = await tokenRequest({ grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: redirectUri(req) });
    db.prepare(`
      INSERT INTO spotify_tokens (user_id, access_token, refresh_token, expires_at) VALUES (?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET access_token = excluded.access_token, refresh_token = excluded.refresh_token, expires_at = excluded.expires_at
    `).run(payload.uid, data.access_token, data.refresh_token, Date.now() + data.expires_in * 1000);
    nowPlayingCache.delete(payload.uid);
    back('connected');
  }catch(e){
    console.error('spotify callback:', e.message);
    back('error');
  }
});

router.post('/disconnect', requireAuth, (req, res) => {
  db.prepare('DELETE FROM spotify_tokens WHERE user_id = ?').run(req.user.id);
  nowPlayingCache.delete(req.user.id);
  res.status(204).end();
});

router.get('/now-playing/:username', async (req, res) => {
  const user = findUserByUsername(req.params.username);
  if(!user || !configured()) return res.json({ connected: false });

  const cached = nowPlayingCache.get(user.id);
  if(cached && Date.now() - cached.at < NOW_PLAYING_CACHE_MS) return res.json(cached.data);

  const token = await accessTokenFor(user.id);
  let data = { connected: false };
  if(token){
    data = { connected: true, playing: null };
    try{
      const r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if(r.status === 200){
        const np = await r.json();
        if(np && np.item && np.currently_playing_type === 'track'){
          data.playing = {
            isPlaying: !!np.is_playing,
            title: np.item.name,
            artist: (np.item.artists || []).map(a => a.name).join(', '),
          };
        }
      }
    }catch(e){ /* Spotify fora do ar — mostra como "nada tocando" */ }
  }
  nowPlayingCache.set(user.id, { at: Date.now(), data });
  res.json(data);
});

module.exports = router;
