const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { serializeUser, serializePublicUser, parseGenres, findUserByUsername: findUser, PUBLIC_COLUMNS } = require('../utils/serialize');
const { createNotification } = require('../utils/notify');
const { cleanString, isValidDataImage, escapeLike } = require('../utils/validate');
const { sendDataImage } = require('../utils/image');
const { cookieOpts } = require('../utils/cookies');

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
        `SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.username LIKE ? ESCAPE '\\' AND u.id != ? ORDER BY u.username LIMIT 50`
      ).all(`%${escapeLike(search)}%`, req.user.id)
    : db.prepare(
        `SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.id != ? ORDER BY u.created_at DESC LIMIT 50`
      ).all(req.user.id);
  res.json({ users: rows.map(serializePublicUser) });
});

// precisa vir antes de "/:username" pra "me" não ser tratado como nome de usuário
router.patch('/me', requireAuth, (req, res) => {
  const { avatar, nationality, genres } = req.body || {};
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
