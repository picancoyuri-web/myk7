const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const rateLimit = require('../utils/rateLimit');
const { cleanString } = require('../utils/validate');
const { serializePublicUser, PUBLIC_COLUMNS } = require('../utils/serialize');
const { notBlockedSql } = require('../utils/blocks');

const router = express.Router();

/* ============================================================
   CONEXÕES — cidade, localização aproximada e contatos do celular
   Tudo opcional e removível. A agenda do celular nunca chega aqui em
   texto: o app transforma cada telefone/e-mail num hash SHA-256 no próprio
   aparelho, o servidor compara com os hashes de quem já está no MyK7 (e
   deixou ser encontrado) e guarda só os pares que deram match.
   ============================================================ */

const matchLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: 'muitas buscas de contatos — tente de novo mais tarde.' });
const HASH_RE = /^[a-f0-9]{64}$/;
const NEARBY_KM = 60;

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const emailHash = email => sha256('mail:' + String(email || '').trim().toLowerCase());

// quem se cadastrou antes dessa coluna existir (ou acabou de se cadastrar)
function ensureEmailHashes(){
  const rows = db.prepare('SELECT id, email FROM users WHERE email_hash IS NULL').all();
  if(!rows.length) return;
  const upd = db.prepare('UPDATE users SET email_hash = ? WHERE id = ?');
  db.transaction(() => rows.forEach(r => upd.run(emailHash(r.email), r.id)))();
}

const round1 = v => Math.round(v * 10) / 10;
function distanceKm(aLat, aLng, bLat, bLng){
  const R = 6371, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const normCity = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// ids de quem está perto: pela localização aproximada (até 60 km) ou, sem
// ela, pela mesma cidade. Usado aqui e no Pra Você.
function nearbyUserIds(me, { limit = 500 } = {}){
  const row = db.prepare('SELECT city, geo_lat, geo_lng FROM users WHERE id = ?').get(me) || {};
  const ids = new Map(); // id -> distância em km (ou null se for só pela cidade)
  if(row.geo_lat != null && row.geo_lng != null){
    const dLat = NEARBY_KM / 111;
    const dLng = NEARBY_KM / (111 * Math.max(0.2, Math.cos(row.geo_lat * Math.PI / 180)));
    db.prepare(`
      SELECT u.id, u.geo_lat, u.geo_lng FROM users u
      WHERE u.id != @me AND u.geo_lat BETWEEN @la1 AND @la2 AND u.geo_lng BETWEEN @lo1 AND @lo2
        AND ${notBlockedSql('u.id')}
      LIMIT ${limit * 2}
    `).all({ me, la1: row.geo_lat - dLat, la2: row.geo_lat + dLat, lo1: row.geo_lng - dLng, lo2: row.geo_lng + dLng })
      .forEach(u => {
        const km = distanceKm(row.geo_lat, row.geo_lng, u.geo_lat, u.geo_lng);
        if(km <= NEARBY_KM) ids.set(u.id, km);
      });
  }
  if(row.city){
    const target = normCity(row.city);
    db.prepare(`SELECT u.id, u.city FROM users u WHERE u.id != @me AND u.city IS NOT NULL AND ${notBlockedSql('u.id')}`)
      .all({ me })
      .forEach(u => { if(!ids.has(u.id) && normCity(u.city) === target) ids.set(u.id, null); });
  }
  return { ids: [...ids.entries()].slice(0, limit), city: row.city || null, hasGeo: row.geo_lat != null };
}

router.get('/settings', requireAuth, (req, res) => {
  const row = db.prepare('SELECT city, geo_lat, phone_hash, discoverable FROM users WHERE id = ?').get(req.user.id);
  const contacts = db.prepare('SELECT COUNT(*) n FROM contact_links WHERE user_id = ?').get(req.user.id).n;
  res.json({
    city: row.city || '', hasLocation: row.geo_lat != null, hasPhone: !!row.phone_hash,
    discoverable: !!row.discoverable, contactsMatched: contacts,
  });
});

// cidade digitada e/ou posição aproximada (o app já manda arredondado; aqui arredonda de novo)
router.put('/location', requireAuth, (req, res) => {
  const body = req.body || {};
  const city = body.city === undefined ? undefined : (cleanString(body.city, 80) || null);
  let lat = body.lat, lng = body.lng;
  const fields = [], values = [];
  if(city !== undefined){ fields.push('city = ?'); values.push(city); }
  if(lat !== undefined || lng !== undefined){
    if(lat === null || lng === null){ fields.push('geo_lat = NULL', 'geo_lng = NULL'); }
    else{
      lat = Number(lat); lng = Number(lng);
      if(!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ error: 'localização inválida.' });
      fields.push('geo_lat = ?', 'geo_lng = ?'); values.push(round1(lat), round1(lng));
    }
  }
  if(!fields.length) return res.status(400).json({ error: 'nada pra atualizar.' });
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values, req.user.id);
  res.json({ ok: true });
});

router.delete('/location', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET city = NULL, geo_lat = NULL, geo_lng = NULL WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

// o próprio telefone, já em hash (pra quem tem você nos contatos te achar)
router.put('/phone', requireAuth, (req, res) => {
  const h = (req.body || {}).phoneHash;
  if(h !== null && !HASH_RE.test(String(h))) return res.status(400).json({ error: 'telefone inválido.' });
  db.prepare('UPDATE users SET phone_hash = ? WHERE id = ?').run(h, req.user.id);
  res.json({ ok: true });
});

router.put('/discoverable', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET discoverable = ? WHERE id = ?').run((req.body || {}).value ? 1 : 0, req.user.id);
  res.json({ ok: true });
});

// recebe só hashes, devolve quem já está no MyK7 e guarda o vínculo
router.post('/contacts/match', requireAuth, matchLimiter, (req, res) => {
  const list = Array.isArray((req.body || {}).hashes) ? req.body.hashes : null;
  if(!list) return res.status(400).json({ error: 'faltou a lista de contatos.' });
  const hashes = [...new Set(list.map(String).filter(h => HASH_RE.test(h)))].slice(0, 5000);
  ensureEmailHashes();
  const me = req.user.id;
  const found = new Map();
  for(let i = 0; i < hashes.length; i += 400){
    const chunk = hashes.slice(i, i + 400);
    const ph = chunk.map(() => '?').join(',');
    db.prepare(`
      SELECT ${PUBLIC_COLUMNS} FROM users u
      WHERE u.discoverable = 1 AND u.id != ? AND (u.phone_hash IN (${ph}) OR u.email_hash IN (${ph}))
    `).all(me, ...chunk, ...chunk).forEach(r => found.set(r.id, r));
  }
  const blocked = new Set(db.prepare(`
    SELECT blocked_id id FROM blocks WHERE blocker_id = @me UNION SELECT blocker_id FROM blocks WHERE blocked_id = @me
  `).all({ me }).map(r => r.id));
  const rows = [...found.values()].filter(r => !blocked.has(r.id));
  const ins = db.prepare('INSERT OR IGNORE INTO contact_links (user_id, contact_user_id) VALUES (?, ?)');
  db.transaction(() => rows.forEach(r => ins.run(me, r.id)))();
  res.json({ users: withFollowing(me, rows.map(r => ({ row: r }))) });
});

router.delete('/contacts', requireAuth, (req, res) => {
  db.prepare('DELETE FROM contact_links WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

function withFollowing(me, list){
  const following = new Set(db.prepare('SELECT followee_id id FROM follows WHERE follower_id = ?').all(me).map(r => r.id));
  return list.map(({ row, extra }) => ({ ...serializePublicUser(row), isFollowing: following.has(row.id), ...(extra || {}) }));
}

// sugestões pra aba Pessoas: seus contatos que você ainda não segue + gente perto
router.get('/suggestions', requireAuth, (req, res) => {
  const me = req.user.id;
  const following = new Set(db.prepare('SELECT followee_id id FROM follows WHERE follower_id = ?').all(me).map(r => r.id));
  const contacts = db.prepare(`
    SELECT ${PUBLIC_COLUMNS} FROM contact_links c JOIN users u ON u.id = c.contact_user_id
    WHERE c.user_id = @me AND ${notBlockedSql('u.id')} LIMIT 60
  `).all({ me }).filter(r => !following.has(r.id));

  const near = nearbyUserIds(me, { limit: 200 });
  const nearIds = near.ids.filter(([id]) => !following.has(id) && !contacts.some(c => c.id === id)).slice(0, 30);
  let nearbyRows = [];
  if(nearIds.length){
    const byId = new Map(db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.id IN (${nearIds.map(() => '?').join(',')})`)
      .all(...nearIds.map(([id]) => id)).map(r => [r.id, r]));
    nearbyRows = nearIds.filter(([id]) => byId.has(id)).map(([id, km]) => ({
      row: byId.get(id),
      // distância só em faixas, nunca exata
      extra: { distance: km == null ? 'na sua cidade' : km < 15 ? 'bem perto de você' : `a menos de ${Math.ceil(km / 10) * 10} km` },
    }));
  }
  res.json({
    contacts: withFollowing(me, contacts.map(row => ({ row }))),
    nearby: withFollowing(me, nearbyRows),
    city: near.city, hasGeo: near.hasGeo,
  });
});

module.exports = router;
module.exports.nearbyUserIds = nearbyUserIds;
