const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { serializeUser, serializePublicUser, parseGenres, findUserByUsername: findUser, PUBLIC_COLUMNS } = require('../utils/serialize');
const { createNotification } = require('../utils/notify');
const { cleanString, isValidDataImage, escapeLike, cleanItemSnapshot } = require('../utils/validate');
const { sendDataImage } = require('../utils/image');
const { cookieOpts } = require('../utils/cookies');
const { isBlockedEither, notBlockedSql } = require('../utils/blocks');

const router = express.Router();

const AVATAR_MAX_CHARS = 400 * 1024; // ~300KB de imagem (o front já reduz pra 320px)

function cleanGenres(genres){
  return [...new Set(genres.filter(g => typeof g === 'string' && g.trim()).map(g => g.trim().slice(0, 40)))].slice(0, 30);
}

// lista/busca pessoas reais cadastradas (aba "Pessoas"), sem incluir
// a própria pessoa logada na lista
router.get('/', requireAuth, (req, res) => {
  const search = String(req.query.search || '').trim().slice(0, 50);
  const rows = search
    ? db.prepare(
        `SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.username LIKE @q ESCAPE '\\' AND u.id != @me AND ${notBlockedSql('u.id')} ORDER BY u.username LIMIT 50`
      ).all({ q: `%${escapeLike(search)}%`, me: req.user.id })
    : db.prepare(
        `SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.id != @me AND ${notBlockedSql('u.id')} ORDER BY u.created_at DESC LIMIT 50`
      ).all({ me: req.user.id });
  res.json({ users: rows.map(serializePublicUser) });
});

// precisa vir antes de "/:username" pra "me" não ser tratado como nome de usuário
router.patch('/me', requireAuth, (req, res) => {
  const { avatar, nationality, genres, bio, favorites } = req.body || {};
  const fields = [];
  const values = [];

  if(avatar !== undefined){
    if(avatar !== null && !isValidDataImage(avatar, AVATAR_MAX_CHARS)){
      return res.status(400).json({ error: 'foto inválida ou grande demais.' });
    }
    fields.push('avatar = ?', 'avatar_v = avatar_v + 1'); values.push(avatar);
  }
  if(nationality !== undefined){
    const n = cleanString(nationality, 60);
    if(!n) return res.status(400).json({ error: 'nacionalidade inválida.' });
    fields.push('nationality = ?'); values.push(n);
  }
  if(bio !== undefined){
    // vazio apaga a bio
    fields.push('bio = ?'); values.push(cleanString(bio, 160));
  }
  if(favorites !== undefined){
    if(!Array.isArray(favorites)) return res.status(400).json({ error: 'favoritos inválidos.' });
    const list = favorites.map(cleanItemSnapshot).filter(Boolean);
    const unique = list.filter((f, i) => list.findIndex(x => x.itemId === f.itemId) === i).slice(0, 4);
    fields.push('favorites = ?'); values.push(JSON.stringify(unique));
  }
  if(genres !== undefined){
    if(!Array.isArray(genres)) return res.status(400).json({ error: 'estilos inválidos.' });
    const list = cleanGenres(genres);
    if(!list.length) return res.status(400).json({ error: 'escolha pelo menos um estilo musical.' });
    fields.push('genres = ?'); values.push(JSON.stringify(list));
  }

  if(fields.length){
    values.push(req.user.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: serializeUser(row) });
});

// apagar a própria conta (pede a senha de novo). O ON DELETE CASCADE do banco
// leva junto diário, comentários, mensagens, seguidores e notificações.
router.delete('/me', requireAuth, async (req, res, next) => {
  try{
    const { password } = req.body || {};
    if(typeof password !== 'string' || !password){
      return res.status(400).json({ error: 'digite sua senha pra confirmar.' });
    }
    const ok = await bcrypt.compare(password, req.user.password_hash);
    if(!ok) return res.status(401).json({ error: 'senha incorreta.' });

    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    res.clearCookie(requireAuth.COOKIE_NAME, cookieOpts(req));
    res.status(204).end();
  }catch(e){
    next(e);
  }
});

// lista "quero ouvir" da pessoa logada
function serializeLater(r){
  return {
    itemId: r.item_id, type: r.item_type, title: r.item_title, artist: r.item_artist,
    genre: r.item_genre, year: r.item_year, previewUrl: r.item_preview_url,
    addedAt: r.created_at ? r.created_at.replace(' ', 'T') + 'Z' : null,
  };
}

router.get('/me/listen-later', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM listen_later WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 300').all(req.user.id);
  res.json({ items: rows.map(serializeLater) });
});

router.post('/me/listen-later', requireAuth, (req, res) => {
  const it = cleanItemSnapshot(req.body);
  if(!it) return res.status(400).json({ error: 'faltam dados desse disco.' });
  const count = db.prepare('SELECT COUNT(*) n FROM listen_later WHERE user_id = ?').get(req.user.id).n;
  if(count >= 300) return res.status(400).json({ error: 'sua lista "quero ouvir" está cheia (300).' });
  db.prepare(`
    INSERT OR IGNORE INTO listen_later (user_id, item_id, item_type, item_title, item_artist, item_genre, item_year, item_preview_url)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(req.user.id, it.itemId, it.type, it.title, it.artist, it.genre, it.year, it.previewUrl);
  const row = db.prepare('SELECT * FROM listen_later WHERE user_id = ? AND item_id = ?').get(req.user.id, it.itemId);
  res.status(201).json({ item: serializeLater(row) });
});

router.delete('/me/listen-later/:itemId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM listen_later WHERE user_id = ? AND item_id = ?').run(req.user.id, String(req.params.itemId));
  res.status(204).end();
});

// quem a pessoa logada bloqueou
router.get('/me/blocked', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT ${PUBLIC_COLUMNS} FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ? ORDER BY b.created_at DESC`
  ).all(req.user.id);
  res.json({ users: rows.map(serializePublicUser) });
});

router.get('/:username/avatar', (req, res) => {
  const row = db.prepare('SELECT avatar FROM users WHERE username = ? COLLATE NOCASE').get(String(req.params.username));
  if(!row || !row.avatar) return res.status(404).json({ error: 'sem foto.' });
  sendDataImage(res, row.avatar, { immutable: !!req.query.v });
});

router.get('/:username', (req, res) => {
  const row = findUser(req.params.username);
  if(!row) return res.status(404).json({ error: 'pessoa não encontrada.' });
  res.json({ user: serializePublicUser(row) });
});

router.post('/:username/follow', requireAuth, (req, res) => {
  const target = findUser(req.params.username);
  if(!target) return res.status(404).json({ error: 'pessoa não encontrada.' });
  if(target.id === req.user.id) return res.status(400).json({ error: 'você não pode seguir a si mesmo.' });
  if(isBlockedEither(req.user.id, target.id)) return res.status(403).json({ error: 'não dá pra seguir essa pessoa.' });

  const info = db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?,?)').run(req.user.id, target.id);
  if(info.changes > 0){
    createNotification({ userId: target.id, actorId: req.user.id, type: 'follow' });
  }
  res.json({ user: serializePublicUser(target) });
});

router.delete('/:username/follow', requireAuth, (req, res) => {
  const target = findUser(req.params.username);
  if(!target) return res.status(404).json({ error: 'pessoa não encontrada.' });

  db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(req.user.id, target.id);
  res.json({ user: serializePublicUser(target) });
});

// bloquear desfaz o follow nos dois sentidos e impede mensagens e novos follows
router.post('/:username/block', requireAuth, (req, res) => {
  const target = findUser(req.params.username);
  if(!target) return res.status(404).json({ error: 'pessoa não encontrada.' });
  if(target.id === req.user.id) return res.status(400).json({ error: 'você não pode bloquear a si mesmo.' });

  db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?,?)').run(req.user.id, target.id);
    db.prepare('DELETE FROM follows WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)')
      .run(req.user.id, target.id, target.id, req.user.id);
  })();
  res.status(204).end();
});

router.delete('/:username/block', requireAuth, (req, res) => {
  const target = findUser(req.params.username);
  if(!target) return res.status(404).json({ error: 'pessoa não encontrada.' });
  db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(req.user.id, target.id);
  res.status(204).end();
});

// compatibilidade musical entre a pessoa logada e outra pessoa. Combina
// os estilos favoritos escolhidos no cadastro (índice de Jaccard) com os
// artistas que as duas já registraram no diário — quem ouve os mesmos
// artistas é mais compatível do que só "gostar de Rock" em comum.
router.get('/:username/compatibility', requireAuth, (req, res) => {
  const target = findUser(req.params.username);
  if(!target) return res.status(404).json({ error: 'pessoa não encontrada.' });
  if(target.id === req.user.id) return res.status(400).json({ error: 'escolha outra pessoa pra comparar.' });

  const mine = parseGenres(req.user.genres);
  const theirs = parseGenres(target.genres);
  const theirsSet = new Set(theirs);
  const mineSet = new Set(mine);

  const shared = mine.filter(g => theirsSet.has(g));
  const union = new Set([...mine, ...theirs]);
  const genreScore = union.size ? shared.length / union.size : 0;

  const artistsOf = (userId) => new Set(
    db.prepare("SELECT DISTINCT lower(item_artist) a FROM diary_entries WHERE user_id = ? AND item_artist IS NOT NULL AND item_artist != ''")
      .all(userId).map(r => r.a)
  );
  const myArtists = artistsOf(req.user.id);
  const theirArtists = artistsOf(target.id);
  const sharedArtistKeys = [...myArtists].filter(a => theirArtists.has(a));
  const artistUnion = new Set([...myArtists, ...theirArtists]).size;

  // sem diário dos dois lados, vale só o gosto declarado
  let score = genreScore;
  if(artistUnion > 0 && myArtists.size && theirArtists.size){
    const artistScore = sharedArtistKeys.length / artistUnion;
    score = genreScore * 0.6 + Math.min(1, artistScore * 2) * 0.4;
  }

  // devolve os nomes de artista com a grafia original (a de quem está vendo)
  const sharedArtists = sharedArtistKeys.length
    ? db.prepare(`SELECT item_artist FROM diary_entries WHERE user_id = ? AND lower(item_artist) IN (${sharedArtistKeys.map(() => '?').join(',')}) GROUP BY lower(item_artist) LIMIT 10`)
        .all(req.user.id, ...sharedArtistKeys).map(r => r.item_artist)
    : [];

  res.json({
    score: Math.round(score * 100),
    shared,
    sharedArtists,
    onlyMine: mine.filter(g => !theirsSet.has(g)),
    onlyTheirs: theirs.filter(g => !mineSet.has(g)),
  });
});

module.exports = router;
