const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { notBlockedSql } = require('../utils/blocks');
const { nearbyUserIds } = require('./connect');

const router = express.Router();

/* ============================================================
   PRA VOCÊ — de onde vem cada recomendação
   Junta três círculos de pessoas e o seu próprio gosto:
   1) sua rede: quem você segue, quem te segue (mútuos pesam mais) e
      amigos dos seus amigos;
   2) gosto parecido: quem deu notas parecidas com as suas nos mesmos discos;
   3) perto de você: quem está a até 60 km (localização aproximada) ou na
      sua cidade; sem isso, gente do seu país (com peso menor).
   Contatos do celular que estão no MyK7 contam como laço forte.
   Cada escuta dessas pessoas vira pontos pro disco: nota alta soma, nota
   baixa tira, e o peso cai pela metade a cada 3 semanas (o que é recente
   conta mais). O seu gosto (notas, favoritos, "quero ouvir", momentos,
   curtidas, reações) vira afinidade por artista e por gênero, que o app usa
   pra ordenar e pra decidir o que mais buscar.
   ============================================================ */

const HALF_LIFE_DAYS = 21;    // escutas da rede
const MY_HALF_LIFE_DAYS = 120; // o seu gosto muda mais devagar
const NETWORK_WINDOW_DAYS = 180;
const NEARBY_WINDOW_DAYS = 30;

const norm = s => String(s || '').trim().toLowerCase();
const ageDays = s => {
  const t = Date.parse(String(s).replace(' ', 'T') + 'Z');
  return isNaN(t) ? 0 : Math.max(0, (Date.now() - t) / 864e5);
};
const decay = (s, half) => Math.pow(0.5, ageDays(s) / half);
// nota 1..5 vira -1..+1 (3 é neutro, levemente positivo: a pessoa ouviu)
const ratingSignal = r => (Number(r) - 2.5) / 2.5;

function addTie(ties, id, w, kind){
  const t = ties.get(id) || { w: 0, kinds: new Set() };
  t.w = Math.max(t.w, w) + (t.w > 0 ? 0.15 : 0); // mais de um laço reforça um pouco
  t.kinds.add(kind);
  ties.set(id, t);
}

router.get('/', requireAuth, (req, res) => {
  const me = req.user.id;
  const meRow = db.prepare('SELECT nationality, genres, favorites FROM users WHERE id = ?').get(me) || {};
  const blocked = new Set(db.prepare(`
    SELECT blocked_id AS id FROM blocks WHERE blocker_id = @me
    UNION SELECT blocker_id FROM blocks WHERE blocked_id = @me`).all({ me }).map(r => r.id));

  // ---------- 1) os laços ----------
  const ties = new Map();
  const following = new Set(db.prepare('SELECT followee_id id FROM follows WHERE follower_id = ?').all(me).map(r => r.id));
  const followers = new Set(db.prepare('SELECT follower_id id FROM follows WHERE followee_id = ?').all(me).map(r => r.id));
  following.forEach(id => addTie(ties, id, followers.has(id) ? 1.5 : 1.0, followers.has(id) ? 'mutual' : 'following'));
  followers.forEach(id => { if(!following.has(id)) addTie(ties, id, 0.6, 'follower'); });
  // contatos do celular: você tem a pessoa salva (e, se ela também tiver você, mais ainda)
  const myContacts = new Set(db.prepare('SELECT contact_user_id id FROM contact_links WHERE user_id = ?').all(me).map(r => r.id));
  const hasMe = new Set(db.prepare('SELECT user_id id FROM contact_links WHERE contact_user_id = ?').all(me).map(r => r.id));
  myContacts.forEach(id => addTie(ties, id, hasMe.has(id) ? 1.4 : 1.2, 'contact'));
  hasMe.forEach(id => { if(!myContacts.has(id)) addTie(ties, id, 0.5, 'contact'); });

  db.prepare(`
    SELECT f2.followee_id id, COUNT(*) c FROM follows f1
    JOIN follows f2 ON f2.follower_id = f1.followee_id
    WHERE f1.follower_id = ? AND f2.followee_id != ?
    GROUP BY f2.followee_id ORDER BY c DESC LIMIT 200
  `).all(me, me).forEach(r => { if(!ties.has(r.id)) addTie(ties, r.id, Math.min(0.6, 0.2 + 0.1 * r.c), 'fof'); });

  // gosto parecido: concordância nas notas dos mesmos discos
  db.prepare(`
    SELECT o.user_id id, COUNT(*) overlap, SUM(4 - ABS(o.rating - m.rating)) agree
    FROM diary_entries m JOIN diary_entries o ON o.item_id = m.item_id AND o.user_id != m.user_id
    WHERE m.user_id = ?
    GROUP BY o.user_id ORDER BY agree DESC LIMIT 150
  `).all(me).forEach(r => {
    const sim = (r.agree / (4 * r.overlap)) * Math.min(1, r.overlap / 3);
    if(sim >= 0.35) addTie(ties, r.id, 0.4 + 0.8 * sim, 'taste');
  });
  blocked.forEach(id => ties.delete(id));
  ties.delete(me);

  const tieIds = [...ties.keys()];
  const names = new Map();
  if(tieIds.length){
    db.prepare(`SELECT id, username FROM users WHERE id IN (${tieIds.map(() => '?').join(',')})`)
      .all(...tieIds).forEach(r => names.set(r.id, r.username));
  }

  // ---------- 2) o que essas pessoas ouviram ----------
  const items = new Map();
  const networkArtists = new Map();
  const itemFor = (row) => {
    let it = items.get(row.item_id);
    if(!it){
      it = {
        itemId: row.item_id, type: row.item_type, title: row.item_title, artist: row.item_artist,
        genre: row.item_genre, year: row.item_year, previewUrl: row.item_preview_url,
        social: 0, nearby: 0, friends: new Set(), tasteCount: new Set(), fofCount: new Set(), nearbyCount: 0, localCount: 0,
      };
      items.set(row.item_id, it);
    }
    if(!it.previewUrl && row.item_preview_url) it.previewUrl = row.item_preview_url;
    return it;
  };
  const credit = (row, signal, when) => {
    const tie = ties.get(row.user_id);
    if(!tie || !row.item_title) return;
    const pts = tie.w * signal * decay(when, HALF_LIFE_DAYS);
    const it = itemFor(row);
    it.social += pts;
    if(signal > 0){
      const k = tie.kinds;
      if(k.has('mutual') || k.has('following') || k.has('follower') || k.has('contact')) it.friends.add(names.get(row.user_id));
      else if(k.has('taste')) it.tasteCount.add(row.user_id);
      else if(k.has('fof')) it.fofCount.add(row.user_id);
    }
    if(row.item_artist) networkArtists.set(row.item_artist, (networkArtists.get(row.item_artist) || 0) + pts);
  };

  if(tieIds.length){
    const ph = tieIds.map(() => '?').join(',');
    db.prepare(`
      SELECT user_id, item_id, item_type, item_title, item_artist, item_genre, item_year, item_preview_url,
             rating, note, created_at
      FROM diary_entries WHERE user_id IN (${ph}) AND created_at >= datetime('now', '-${NETWORK_WINDOW_DAYS} days')
      ORDER BY id DESC LIMIT 4000
    `).all(...tieIds).forEach(r => {
      const commented = r.note && r.note.trim() ? 1.25 : 1; // escrever sobre o disco é sinal mais forte
      credit(r, ratingSignal(r.rating) * commented, r.created_at);
    });
    // momento postado = "eu estava ouvindo isso" (sinal positivo forte)
    db.prepare(`
      SELECT user_id, item_id, item_type, item_title, item_artist, item_genre, item_year, item_preview_url, created_at
      FROM posts WHERE user_id IN (${ph}) AND created_at >= datetime('now', '-90 days')
      ORDER BY id DESC LIMIT 1000
    `).all(...tieIds).forEach(r => credit(r, 0.9, r.created_at));
  }

  // ---------- 3) perto de você ----------
  const nearbyAgg = (whereSql, params, weight, field) => {
    db.prepare(`
      SELECT e.item_id, MAX(e.item_type) item_type, MAX(e.item_title) item_title, MAX(e.item_artist) item_artist,
             MAX(e.item_genre) item_genre, MAX(e.item_year) item_year, MAX(e.item_preview_url) item_preview_url,
             COUNT(DISTINCT e.user_id) n, AVG(e.rating) avg
      FROM diary_entries e JOIN users u ON u.id = e.user_id
      WHERE ${whereSql} AND e.user_id != @me
        AND e.created_at >= datetime('now', '-${NEARBY_WINDOW_DAYS} days')
        AND ${notBlockedSql('e.user_id')}
      GROUP BY e.item_id HAVING avg >= 3
      ORDER BY n DESC, avg DESC LIMIT 80
    `).all({ ...params, me }).forEach(r => {
      if(!r.item_title) return;
      const it = itemFor(r);
      it.nearby += weight * Math.log2(1 + r.n) * ratingSignal(r.avg);
      it[field] = Math.max(it[field], r.n);
    });
  };
  // 3a) a até 60 km ou na mesma cidade
  const near = nearbyUserIds(me, { limit: 500 });
  const localIds = near.ids.map(([id]) => id).filter(id => !blocked.has(id));
  if(localIds.length){
    const named = {};
    localIds.forEach((id, i) => { named['l' + i] = id; });
    nearbyAgg(`e.user_id IN (${localIds.map((_, i) => '@l' + i).join(',')})`, named, 1.0, 'localCount');
  }
  // 3b) mesmo país (mais fraco), sem contar de novo quem já está perto
  if(meRow.nationality){
    nearbyAgg(`u.nationality = @nat${localIds.length ? ` AND e.user_id NOT IN (${localIds.join(',')})` : ''}`,
      { nat: meRow.nationality }, localIds.length ? 0.4 : 0.7, 'nearbyCount');
  }

  // ---------- 4) o seu gosto ----------
  const artist = new Map();
  const genre = new Map();
  const bump = (map, key, v) => { if(key) map.set(key, (map.get(key) || 0) + v); };
  const mine = db.prepare('SELECT item_id, item_artist, item_genre, rating, note, created_at FROM diary_entries WHERE user_id = ?').all(me);
  const logged = new Set(mine.map(r => r.item_id));
  mine.forEach(r => {
    const d = decay(r.created_at, MY_HALF_LIFE_DAYS);
    const commented = r.note && r.note.trim() ? 1.3 : 1;
    bump(artist, r.item_artist, (r.rating - 2.5) * 2 * commented * d);
    bump(genre, r.item_genre, (r.rating - 2.5) * d);
  });
  try{
    JSON.parse(meRow.favorites || '[]').forEach(f => { bump(artist, f.artist, 6); bump(genre, f.genre, 2); });
  }catch(e){ /* favoritos corrompidos — ignora */ }
  db.prepare('SELECT item_artist, item_genre FROM listen_later WHERE user_id = ?').all(me)
    .forEach(r => { bump(artist, r.item_artist, 2); bump(genre, r.item_genre, 1); });
  db.prepare("SELECT item_artist, item_genre FROM posts WHERE user_id = ? AND created_at >= datetime('now', '-180 days')").all(me)
    .forEach(r => { bump(artist, r.item_artist, 3); bump(genre, r.item_genre, 1); });
  db.prepare(`SELECT p.item_artist, p.item_genre FROM post_likes l JOIN posts p ON p.id = l.post_id
              WHERE l.user_id = ? AND p.user_id != ?`).all(me, me)
    .forEach(r => { bump(artist, r.item_artist, 1.5); bump(genre, r.item_genre, 0.5); });
  db.prepare(`SELECT e.item_artist, e.item_genre FROM entry_reactions x JOIN diary_entries e ON e.id = x.entry_id
              WHERE x.user_id = ? AND e.user_id != ?`).all(me, me)
    .forEach(r => { bump(artist, r.item_artist, 1.5); bump(genre, r.item_genre, 0.5); });

  const top = (map, n, filter = v => v > 0) => [...map.entries()]
    .filter(([, v]) => filter(v)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, n)
    .map(([name, score]) => ({ name, score: Math.round(score * 100) / 100 }));

  const out = [...items.values()]
    .filter(it => !logged.has(it.itemId) && (it.social > 0 || it.nearby > 0))
    .map(it => ({
      itemId: it.itemId, type: it.type, title: it.title, artist: it.artist, genre: it.genre,
      year: it.year, previewUrl: it.previewUrl,
      social: Math.round(it.social * 1000) / 1000,
      nearby: Math.round(it.nearby * 1000) / 1000,
      why: {
        friends: [...it.friends].filter(Boolean).slice(0, 3),
        friendCount: it.friends.size,
        tasteCount: it.tasteCount.size,
        fofCount: it.fofCount.size,
        nearbyCount: it.nearbyCount,
        localCount: it.localCount,
      },
    }))
    .sort((a, b) => (b.social + b.nearby) - (a.social + a.nearby))
    .slice(0, 80);

  let declaredGenres = [];
  try{ declaredGenres = JSON.parse(meRow.genres || '[]'); }catch(e){ /* ignora */ }

  res.json({
    items: out,
    myArtists: top(artist, 12),
    dislikedArtists: top(artist, 20, v => v <= -3).map(a => a.name),
    myGenres: top(genre, 8),
    declaredGenres,
    networkArtists: top(networkArtists, 8).filter(a => !artist.has(a.name) || artist.get(a.name) > -3),
    nationality: meRow.nationality || null,
    city: near.city,
    hasGeo: near.hasGeo,
    networkSize: tieIds.length,
  });
});

module.exports = router;
