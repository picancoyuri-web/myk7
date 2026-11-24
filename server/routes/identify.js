const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { isPremium } = require('../utils/serialize');

const router = express.Router();

// "Que música é essa?": o app grava ~10 s pelo microfone e manda pra cá; o
// AudD reconhece a música. Cada reconhecimento custa (AUDD_API_TOKEN no
// Render), então quem não é MyK7+ tem um limite por dia.
const FREE_PER_DAY = 3;
const MAX_AUDIO_BYTES = 1.5 * 1024 * 1024;

db.exec(`
CREATE TABLE IF NOT EXISTS identify_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
`);

function today(){ return new Date().toISOString().slice(0, 10); }
function usedToday(userId){
  const row = db.prepare('SELECT count FROM identify_usage WHERE user_id = ? AND day = ?').get(userId, today());
  return row ? row.count : 0;
}
function remainingFor(user){
  return isPremium(user) ? null : Math.max(0, FREE_PER_DAY - usedToday(user.id));
}

router.get('/status', requireAuth, (req, res) => {
  res.json({ enabled: !!process.env.AUDD_API_TOKEN, remaining: remainingFor(req.user), perDay: FREE_PER_DAY });
});

router.post('/', requireAuth, async (req, res) => {
  const token = process.env.AUDD_API_TOKEN;
  if(!token) return res.status(503).json({ error: 'identificação de música ainda não está disponível.' });

  const remaining = remainingFor(req.user);
  if(remaining === 0){
    return res.status(429).json({ error: `você já usou as ${FREE_PER_DAY} identificações de hoje. assine o MyK7+ pra identificar sem limite.`, limit: true });
  }

  const { audio, mime } = req.body || {};
  if(typeof audio !== 'string' || !audio) return res.status(400).json({ error: 'faltou o áudio.' });
  const bytes = Buffer.from(audio, 'base64');
  if(bytes.length < 2000 || bytes.length > MAX_AUDIO_BYTES) return res.status(400).json({ error: 'áudio muito curto ou muito longo.' });
  const type = /^audio\/[\w.+-]+$/.test(mime || '') ? mime.split(';')[0] : 'audio/webm';

  try{
    const form = new FormData();
    form.append('api_token', token);
    form.append('return', 'apple_music');
    form.append('file', new Blob([bytes], { type }), 'trecho.' + (type.split('/')[1] || 'webm'));
    const r = await fetch('https://api.audd.io/', { method: 'POST', body: form, signal: AbortSignal.timeout(25000) });
    const data = await r.json().catch(() => null);
    if(!data || data.status !== 'success'){
      const why = data && data.error ? `${data.error.error_code}: ${data.error.error_message}` : `HTTP ${r.status}`;
      console.warn('[identificar] AudD:', why);
      return res.status(502).json({ error: 'não deu pra identificar agora — tenta de novo.', detail: why });
    }
    // conta só o que chegou ao AudD (é o que custa)
    db.prepare(`
      INSERT INTO identify_usage (user_id, day, count) VALUES (?,?,1)
      ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1
    `).run(req.user.id, today());

    const m = data.result;
    const left = remainingFor(req.user);
    if(!m) return res.json({ match: null, remaining: left });
    const am = m.apple_music || {};
    const idFromUrl = /[?&]i=(\d+)/.exec(am.url || '') || /\/(\d+)(?:\?|$)/.exec(am.url || '');
    res.json({
      match: {
        title: m.title, artist: m.artist, album: m.album || null,
        year: m.release_date ? String(m.release_date).slice(0, 4) : null,
        itunesId: idFromUrl ? idFromUrl[1] : null,
        previewUrl: am.previews && am.previews[0] ? am.previews[0].url : null,
      },
      remaining: left,
    });
  }catch(e){
    console.warn('[identificar] falhou:', e.message);
    res.status(502).json({ error: 'não deu pra identificar agora — tenta de novo.', detail: e.message });
  }
});

module.exports = router;
