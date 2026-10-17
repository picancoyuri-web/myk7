const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const optionalAuth = require('../middleware/optionalAuth');
const { createNotification } = require('../utils/notify');
const { toIso } = require('../utils/time');
const { findUserByUsername, avatarUrl, commentPhotoUrl } = require('../utils/serialize');
const { sendDataImage } = require('../utils/image');
const rateLimit = require('../utils/rateLimit');
const { cleanString, isValidDataImage, isHttpsUrl, cleanSpotifyRef, parseId } = require('../utils/validate');

const router = express.Router();

const ALLOWED_REACTIONS = new Set(['❤️', '🔥', '😢', '😂', '🤯', '👏']);
const NOTE_MAX = 5000;
const COMMENT_MAX = 2000;
const COMMENT_PHOTO_MAX_CHARS = 1.5 * 1024 * 1024; // ~1MB de imagem (o front reduz pra 960px)

// freia spam de comentários/escutas (por IP)
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: 'calma aí — muitas ações em pouco tempo. Tente de novo em um minuto.' });

// colunas leves do autor (sem a foto em base64, que vai por URL)
const AUTHOR_COLUMNS = 'u.username, u.avatar_v, (u.avatar IS NOT NULL) AS has_avatar';

function serializeComment(row, viewerId, likes = 0, liked = false){
  return {
    id: row.id,
    name: row.username,
    text: row.text || '',
    photo: row.has_photo ? commentPhotoUrl({ id: row.id, photo: true }) : null,
    likes,
    liked,
    mine: viewerId === row.user_id,
    createdAt: toIso(row.created_at),
  };
}

function placeholders(list){
  return list.map(() => '?').join(',');
}

// busca comentários, curtidas e reações de várias entradas de uma vez só
// (antes eram ~4 consultas por entrada; um feed de 20 fazia ~80 consultas)
function serializeEntries(rows, viewerId, { withUser = false } = {}){
  if(!rows.length) return [];
  const ids = rows.map(r => r.id);
  const ph = placeholders(ids);

  const comments = db.prepare(`
    SELECT c.id, c.entry_id, c.user_id, c.text, c.created_at, (c.photo IS NOT NULL) AS has_photo, u.username
    FROM diary_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.entry_id IN (${ph})
    ORDER BY c.created_at ASC, c.id ASC
  `).all(...ids);

  const commentIds = comments.map(c => c.id);
  const likeCounts = new Map();
  const likedByViewer = new Set();
  if(commentIds.length){
    const cph = placeholders(commentIds);
    db.prepare(`SELECT comment_id, COUNT(*) c FROM comment_likes WHERE comment_id IN (${cph}) GROUP BY comment_id`)
      .all(...commentIds).forEach(r => likeCounts.set(r.comment_id, r.c));
    if(viewerId){
      db.prepare(`SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${cph})`)
        .all(viewerId, ...commentIds).forEach(r => likedByViewer.add(r.comment_id));
    }
  }

  const commentsByEntry = new Map();
  comments.forEach(c => {
    if(!commentsByEntry.has(c.entry_id)) commentsByEntry.set(c.entry_id, []);
    commentsByEntry.get(c.entry_id).push(serializeComment(c, viewerId, likeCounts.get(c.id) || 0, likedByViewer.has(c.id)));
  });

  const reactionCounts = new Map();
  db.prepare(`SELECT entry_id, emoji, COUNT(*) c FROM entry_reactions WHERE entry_id IN (${ph}) GROUP BY entry_id, emoji`)
    .all(...ids).forEach(r => {
      if(!reactionCounts.has(r.entry_id)) reactionCounts.set(r.entry_id, {});
      reactionCounts.get(r.entry_id)[r.emoji] = r.c;
    });
  const myReactions = new Map();
  if(viewerId){
    db.prepare(`SELECT entry_id, emoji FROM entry_reactions WHERE user_id = ? AND entry_id IN (${ph})`)
      .all(viewerId, ...ids).forEach(r => myReactions.set(r.entry_id, r.emoji));
  }

  return rows.map(row => {
    let sp = null;
    try{ sp = row.item_sp ? JSON.parse(row.item_sp) : null; }catch(e){ sp = null; }
    const base = {
      id: row.id,
      itemId: row.item_id,
      itemType: row.item_type,
      rating: row.rating,
      note: row.note,
      createdAt: toIso(row.created_at),
      title: row.item_title,
      artist: row.item_artist,
      genre: row.item_genre,
      year: row.item_year,
      sp,
      previewUrl: row.item_preview_url || null,
      comments: commentsByEntry.get(row.id) || [],
      reactions: {
        counts: reactionCounts.get(row.id) || {},
        mine: myReactions.get(row.id) || null,
      },
    };
    if(withUser){
      base.username = row.username;
      base.avatar = row.has_avatar ? avatarUrl({ username: row.username, avatar: true, avatar_v: row.avatar_v }) : null;
    }
    return base;
  });
}

function serializeEntry(row, viewerId, opts){
  return serializeEntries([row], viewerId, opts)[0];
}

function reactionsForEntry(entryId, viewerId){
  return serializeEntry({ id: entryId }, viewerId).reactions;
}

function parsePagination(req, defaultLimit, maxLimit = 50){
  const limit = Math.min(Math.max(Number(req.query.limit) || defaultLimit, 1), maxLimit);
  const before = req.query.before ? Number(req.query.before) : null;
  return { limit, before: Number.isInteger(before) ? before : null };
}

function findEntry(id){
  const entryId = parseId(id);
  return entryId ? db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(entryId) : null;
}

function findComment(id){
  const commentId = parseId(id);
  return commentId ? db.prepare('SELECT * FROM diary_comments WHERE id = ?').get(commentId) : null;
}

function isValidRating(r){
  return Number.isInteger(r) && r >= 1 && r <= 5;
}

router.post('/', requireAuth, writeLimiter, (req, res) => {
  const { itemId, itemType, rating, note, title, artist, genre, year, sp, previewUrl } = req.body || {};

  const cleanItemId = cleanString(itemId, 100);
  if(!cleanItemId || rating === undefined) return res.status(400).json({ error: 'faltam dados pra registrar essa escuta.' });
  if(!isValidRating(rating)) return res.status(400).json({ error: 'nota inválida.' });

  const spRef = cleanSpotifyRef(sp);
  const info = db.prepare(`
    INSERT INTO diary_entries
      (user_id, item_id, item_type, item_title, item_artist, item_genre, item_year, item_sp, item_preview_url, rating, note)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.user.id,
    cleanItemId,
    cleanString(itemType, 20),
    cleanString(title, 300),
    cleanString(artist, 300),
    cleanString(genre, 80),
    cleanString(year, 10),
    spRef ? JSON.stringify(spRef) : null,
    isHttpsUrl(previewUrl) ? previewUrl : null,
    rating,
    cleanString(note, NOTE_MAX)
  );

  const row = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(info.lastInsertRowid);

  // avisa quem segue essa pessoa que ela registrou uma escuta nova
  const followers = db.prepare('SELECT follower_id FROM follows WHERE followee_id = ?').all(req.user.id);
  db.transaction(() => {
    followers.forEach(f => {
      createNotification({ userId: f.follower_id, actorId: req.user.id, type: 'listen', entryId: row.id });
    });
  })();

  res.status(201).json({ entry: serializeEntry(row, req.user.id) });
});

router.get('/me', requireAuth, (req, res) => {
  const { limit, before } = parsePagination(req, 200, 500);
  const rows = before
    ? db.prepare('SELECT * FROM diary_entries WHERE user_id = ? AND id < ? ORDER BY id DESC LIMIT ?').all(req.user.id, before, limit)
    : db.prepare('SELECT * FROM diary_entries WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(req.user.id, limit);
  const entries = serializeEntries(rows, req.user.id);
  res.json({ entries, nextCursor: rows.length === limit ? rows[rows.length - 1].id : null });
});

router.get('/feed', requireAuth, (req, res) => {
  const { limit, before } = parsePagination(req, 20);
  const rows = db.prepare(`
    SELECT e.*, ${AUTHOR_COLUMNS} FROM diary_entries e
    JOIN users u ON u.id = e.user_id
    JOIN follows f ON f.followee_id = e.user_id
    WHERE f.follower_id = ? AND e.note IS NOT NULL AND e.note != ''
      ${before ? 'AND e.id < ?' : ''}
    ORDER BY e.id DESC
    LIMIT ?
  `).all(...(before ? [req.user.id, before, limit] : [req.user.id, limit]));
  const entries = serializeEntries(rows, req.user.id, { withUser: true });
  res.json({ entries, nextCursor: rows.length === limit ? rows[rows.length - 1].id : null });
});

// resenhas recentes de todo mundo (não só de quem a pessoa segue) — pra aba
// "Resenhas" não ficar vazia pra quem acabou de chegar
router.get('/recent', requireAuth, (req, res) => {
  const { limit, before } = parsePagination(req, 20);
  const rows = db.prepare(`
    SELECT e.*, ${AUTHOR_COLUMNS} FROM diary_entries e
    JOIN users u ON u.id = e.user_id
    WHERE e.note IS NOT NULL AND e.note != ''
      ${before ? 'AND e.id < ?' : ''}
    ORDER BY e.id DESC
    LIMIT ?
  `).all(...(before ? [before, limit] : [limit]));
  const entries = serializeEntries(rows, req.user.id, { withUser: true });
  res.json({ entries, nextCursor: rows.length === limit ? rows[rows.length - 1].id : null });
});

router.get('/user/:username', optionalAuth, (req, res) => {
  const user = findUserByUsername(req.params.username);
  if(!user) return res.status(404).json({ error: 'pessoa não encontrada.' });

  const viewerId = req.user ? req.user.id : null;
  const rows = db.prepare('SELECT * FROM diary_entries WHERE user_id = ? ORDER BY id DESC LIMIT 200').all(user.id);
  res.json({ entries: serializeEntries(rows, viewerId) });
});

router.get('/comments/:commentId/photo', (req, res) => {
  const commentId = parseId(req.params.commentId);
  const row = commentId ? db.prepare('SELECT photo FROM diary_comments WHERE id = ?').get(commentId) : null;
  if(!row || !row.photo) return res.status(404).json({ error: 'sem foto.' });
  sendDataImage(res, row.photo, { immutable: true });
});

router.patch('/comments/:commentId', requireAuth, (req, res) => {
  const comment = findComment(req.params.commentId);
  if(!comment) return res.status(404).json({ error: 'comentário não encontrado.' });
  if(comment.user_id !== req.user.id) return res.status(403).json({ error: 'você só pode editar seus próprios comentários.' });

  const text = cleanString((req.body || {}).text, COMMENT_MAX);
  if(!text) return res.status(400).json({ error: 'o comentário não pode ficar vazio.' });

  db.prepare('UPDATE diary_comments SET text = ? WHERE id = ?').run(text, comment.id);

  const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(comment.entry_id);
  const updated = serializeEntry(entry, req.user.id).comments.find(c => c.id === comment.id);
  res.json({ comment: updated });
});

router.delete('/comments/:commentId', requireAuth, (req, res) => {
  const comment = findComment(req.params.commentId);
  if(!comment) return res.status(404).json({ error: 'comentário não encontrado.' });

  const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(comment.entry_id);
  const canDelete = comment.user_id === req.user.id || (entry && entry.user_id === req.user.id);
  if(!canDelete) return res.status(403).json({ error: 'você não pode apagar esse comentário.' });

  db.prepare('DELETE FROM diary_comments WHERE id = ?').run(comment.id);
  res.status(204).end();
});

router.post('/comments/:commentId/like', requireAuth, (req, res) => {
  const comment = findComment(req.params.commentId);
  if(!comment) return res.status(404).json({ error: 'comentário não encontrado.' });

  const already = db.prepare('SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?')
    .get(comment.id, req.user.id);

  if(already){
    db.prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?').run(comment.id, req.user.id);
  } else {
    db.prepare('INSERT INTO comment_likes (comment_id, user_id) VALUES (?,?)').run(comment.id, req.user.id);
    createNotification({ userId: comment.user_id, actorId: req.user.id, type: 'like', entryId: comment.entry_id, commentId: comment.id });
  }

  const likes = db.prepare('SELECT COUNT(*) c FROM comment_likes WHERE comment_id = ?').get(comment.id).c;
  res.json({ liked: !already, likes });
});

router.patch('/:entryId', requireAuth, (req, res) => {
  const entry = findEntry(req.params.entryId);
  if(!entry) return res.status(404).json({ error: 'escuta não encontrada.' });
  if(entry.user_id !== req.user.id) return res.status(403).json({ error: 'você só pode editar suas próprias escutas.' });

  const { rating, note } = req.body || {};
  const fields = [];
  const values = [];
  if(rating !== undefined){
    if(!isValidRating(rating)) return res.status(400).json({ error: 'nota inválida.' });
    fields.push('rating = ?'); values.push(rating);
  }
  if(note !== undefined){ fields.push('note = ?'); values.push(cleanString(note, NOTE_MAX)); }

  if(fields.length){
    values.push(entry.id);
    db.prepare(`UPDATE diary_entries SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  const row = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(entry.id);
  res.json({ entry: serializeEntry(row, req.user.id) });
});

router.delete('/:entryId', requireAuth, (req, res) => {
  const entry = findEntry(req.params.entryId);
  if(!entry) return res.status(404).json({ error: 'escuta não encontrada.' });
  if(entry.user_id !== req.user.id) return res.status(403).json({ error: 'você só pode apagar suas próprias escutas.' });

  db.prepare('DELETE FROM diary_entries WHERE id = ?').run(entry.id);
  res.status(204).end();
});

router.post('/:entryId/comments', requireAuth, writeLimiter, (req, res) => {
  const entry = findEntry(req.params.entryId);
  if(!entry) return res.status(404).json({ error: 'escuta não encontrada.' });

  const { photo } = req.body || {};
  const text = cleanString((req.body || {}).text, COMMENT_MAX);
  if(photo && !isValidDataImage(photo, COMMENT_PHOTO_MAX_CHARS)) return res.status(400).json({ error: 'foto inválida ou grande demais.' });
  if(!text && !photo) return res.status(400).json({ error: 'escreva algo ou anexe uma foto.' });

  const info = db.prepare('INSERT INTO diary_comments (entry_id, user_id, text, photo) VALUES (?,?,?,?)')
    .run(entry.id, req.user.id, text, photo || null);

  createNotification({ userId: entry.user_id, actorId: req.user.id, type: 'comment', entryId: entry.id, commentId: info.lastInsertRowid });

  const row = db.prepare(`
    SELECT c.id, c.entry_id, c.user_id, c.text, c.created_at, (c.photo IS NOT NULL) AS has_photo, u.username
    FROM diary_comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(info.lastInsertRowid);
  res.status(201).json({ comment: serializeComment(row, req.user.id) });
});

// reagir a uma entrada de diário com um emoji — clicar de novo no mesmo
// emoji remove a reação, clicar em outro emoji troca
router.post('/:entryId/react', requireAuth, (req, res) => {
  const entry = findEntry(req.params.entryId);
  if(!entry) return res.status(404).json({ error: 'escuta não encontrada.' });

  const { emoji } = req.body || {};
  if(!ALLOWED_REACTIONS.has(emoji)) return res.status(400).json({ error: 'reação inválida.' });

  const existing = db.prepare('SELECT emoji FROM entry_reactions WHERE entry_id = ? AND user_id = ?')
    .get(entry.id, req.user.id);

  if(existing && existing.emoji === emoji){
    db.prepare('DELETE FROM entry_reactions WHERE entry_id = ? AND user_id = ?').run(entry.id, req.user.id);
  } else {
    db.prepare(`
      INSERT INTO entry_reactions (entry_id, user_id, emoji) VALUES (?,?,?)
      ON CONFLICT(entry_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = datetime('now')
    `).run(entry.id, req.user.id, emoji);

    if(!existing){
      createNotification({ userId: entry.user_id, actorId: req.user.id, type: 'reaction', entryId: entry.id });
    }
  }

  res.json({ reactions: reactionsForEntry(entry.id, req.user.id) });
});

router.delete('/:entryId/react', requireAuth, (req, res) => {
  const entry = findEntry(req.params.entryId);
  if(!entry) return res.status(404).json({ error: 'escuta não encontrada.' });

  db.prepare('DELETE FROM entry_reactions WHERE entry_id = ? AND user_id = ?').run(entry.id, req.user.id);
  res.json({ reactions: reactionsForEntry(entry.id, req.user.id) });
});

module.exports = router;
