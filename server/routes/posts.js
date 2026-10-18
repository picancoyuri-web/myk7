const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const optionalAuth = require('../middleware/optionalAuth');
const { createNotification } = require('../utils/notify');
const { toIso } = require('../utils/time');
const { findUserByUsername, avatarUrl } = require('../utils/serialize');
const { sendDataImage } = require('../utils/image');
const rateLimit = require('../utils/rateLimit');
const { cleanString, isValidDataImage, isHttpsUrl, parseId } = require('../utils/validate');
const { notBlockedSql, isBlockedEither } = require('../utils/blocks');

// MOMENTOS — a pessoa posta uma foto junto com a música que estava ouvindo.
// Mesma receita das resenhas: a foto fica no banco em base64 e sai por URL
// com cache; a lista vem com as contagens numa consulta só.
const router = express.Router();

const CAPTION_MAX = 600;
const COMMENT_MAX = 500;
const PHOTO_MAX_CHARS = 2.6 * 1024 * 1024; // ~1,9 MB de imagem (o front reduz pra 1080px)

const postLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 12, message: 'muitos momentos seguidos — espere uns minutos pra postar de novo.' });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, message: 'calma aí — muitas ações em pouco tempo. Tente de novo em um minuto.' });

// tudo do post menos a foto (que vai por URL)
const POST_COLUMNS = `
  p.id, p.user_id, p.photo_w, p.photo_h, p.caption, p.item_id, p.item_type, p.item_title,
  p.item_artist, p.item_genre, p.item_year, p.item_preview_url, p.created_at,
  u.username, u.avatar_v, (u.avatar IS NOT NULL) AS has_avatar,
  (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS like_count,
  (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count
`;

function serializePost(row, viewerId, likedSet){
  return {
    id: row.id,
    username: row.username,
    avatar: row.has_avatar ? avatarUrl({ username: row.username, avatar: true, avatar_v: row.avatar_v }) : null,
    photo: `/api/posts/${row.id}/photo`,
    w: row.photo_w || null,
    h: row.photo_h || null,
    caption: row.caption || '',
    item: {
      itemId: row.item_id,
      type: row.item_type || 'single',
      title: row.item_title,
      artist: row.item_artist || '',
      genre: row.item_genre || '',
      year: row.item_year || '',
      previewUrl: row.item_preview_url || null,
    },
    likes: row.like_count || 0,
    liked: likedSet ? likedSet.has(row.id) : false,
    commentCount: row.comment_count || 0,
    mine: viewerId === row.user_id,
    createdAt: toIso(row.created_at),
  };
}

function serializePosts(rows, viewerId){
  if(!rows.length) return [];
  const liked = new Set();
  if(viewerId){
    const ids = rows.map(r => r.id);
    db.prepare(`SELECT post_id FROM post_likes WHERE user_id = ? AND post_id IN (${ids.map(() => '?').join(',')})`)
      .all(viewerId, ...ids).forEach(r => liked.add(r.post_id));
  }
  return rows.map(r => serializePost(r, viewerId, liked));
}

function parsePagination(req, defaultLimit, maxLimit = 30){
  const limit = Math.min(Math.max(Number(req.query.limit) || defaultLimit, 1), maxLimit);
  const before = req.query.before ? Number(req.query.before) : null;
  return { limit, before: Number.isInteger(before) ? before : null };
}

function findPost(id){
  const postId = parseId(id);
  return postId ? db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(postId) : null;
}

function getPostRow(id){
  return db.prepare(`SELECT ${POST_COLUMNS} FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`).get(id);
}

function clampDim(v){
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 8000) : null;
}

// feed de momentos: ?scope=following só de quem eu sigo (e os meus), senão de todo mundo
router.get('/', requireAuth, (req, res) => {
  const { limit, before } = parsePagination(req, 12);
  const following = req.query.scope === 'following';
  const rows = db.prepare(`
    SELECT ${POST_COLUMNS} FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE ${notBlockedSql('p.user_id')}
      ${following ? 'AND (p.user_id = @me OR p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = @me))' : ''}
      ${before ? 'AND p.id < @before' : ''}
    ORDER BY p.id DESC
    LIMIT @limit
  `).all({ me: req.user.id, before, limit });
  res.json({ posts: serializePosts(rows, req.user.id), nextCursor: rows.length === limit ? rows[rows.length - 1].id : null });
});

router.get('/user/:username', optionalAuth, (req, res) => {
  const user = findUserByUsername(req.params.username);
  if(!user) return res.status(404).json({ error: 'pessoa não encontrada.' });
  const viewerId = req.user ? req.user.id : null;
  if(viewerId && isBlockedEither(viewerId, user.id)) return res.json({ posts: [], nextCursor: null });

  const { limit, before } = parsePagination(req, 24, 60);
  const rows = db.prepare(`
    SELECT ${POST_COLUMNS} FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ? ${before ? 'AND p.id < ?' : ''}
    ORDER BY p.id DESC LIMIT ?
  `).all(...[user.id, ...(before ? [before] : []), limit]);
  res.json({ posts: serializePosts(rows, viewerId), nextCursor: rows.length === limit ? rows[rows.length - 1].id : null });
});

router.get('/:postId/photo', (req, res) => {
  const postId = parseId(req.params.postId);
  const row = postId ? db.prepare('SELECT photo FROM posts WHERE id = ?').get(postId) : null;
  if(!row) return res.status(404).json({ error: 'sem foto.' });
  sendDataImage(res, row.photo, { immutable: true });
});

router.get('/:postId', optionalAuth, (req, res) => {
  const post = findPost(req.params.postId);
  if(!post) return res.status(404).json({ error: 'momento não encontrado.' });
  const viewerId = req.user ? req.user.id : null;
  if(viewerId && isBlockedEither(viewerId, post.user_id)) return res.status(404).json({ error: 'momento não encontrado.' });
  res.json({ post: serializePosts([getPostRow(post.id)], viewerId)[0] });
});

router.post('/', requireAuth, postLimiter, (req, res) => {
  const { photo, caption, item, w, h } = req.body || {};
  if(!isValidDataImage(photo, PHOTO_MAX_CHARS)) return res.status(400).json({ error: 'foto inválida ou grande demais.' });
  const it = item && typeof item === 'object' ? item : {};
  const itemId = cleanString(it.itemId, 100);
  const title = cleanString(it.title, 300);
  if(!itemId || !title) return res.status(400).json({ error: 'escolha a música que estava tocando.' });

  const info = db.prepare(`
    INSERT INTO posts (user_id, photo, photo_w, photo_h, caption, item_id, item_type, item_title, item_artist, item_genre, item_year, item_preview_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.user.id, photo, clampDim(w), clampDim(h), cleanString(caption, CAPTION_MAX),
    itemId, cleanString(it.type, 20), title, cleanString(it.artist, 300), cleanString(it.genre, 80),
    cleanString(it.year, 10), isHttpsUrl(it.previewUrl) ? it.previewUrl : null
  );
  const postId = info.lastInsertRowid;

  // quem segue a pessoa fica sabendo do momento novo
  const followers = db.prepare('SELECT follower_id FROM follows WHERE followee_id = ?').all(req.user.id);
  db.transaction(() => {
    followers.forEach(f => createNotification({ userId: f.follower_id, actorId: req.user.id, type: 'post', postId }));
  })();

  res.status(201).json({ post: serializePosts([getPostRow(postId)], req.user.id)[0] });
});

router.patch('/:postId', requireAuth, (req, res) => {
  const post = findPost(req.params.postId);
  if(!post) return res.status(404).json({ error: 'momento não encontrado.' });
  if(post.user_id !== req.user.id) return res.status(403).json({ error: 'você só pode editar seus próprios momentos.' });
  db.prepare('UPDATE posts SET caption = ? WHERE id = ?').run(cleanString((req.body || {}).caption, CAPTION_MAX), post.id);
  res.json({ post: serializePosts([getPostRow(post.id)], req.user.id)[0] });
});

router.delete('/:postId', requireAuth, (req, res) => {
  const post = findPost(req.params.postId);
  if(!post) return res.status(404).json({ error: 'momento não encontrado.' });
  if(post.user_id !== req.user.id) return res.status(403).json({ error: 'você só pode apagar seus próprios momentos.' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  res.status(204).end();
});

router.post('/:postId/like', requireAuth, writeLimiter, (req, res) => {
  const post = findPost(req.params.postId);
  if(!post) return res.status(404).json({ error: 'momento não encontrado.' });
  if(isBlockedEither(req.user.id, post.user_id)) return res.status(403).json({ error: 'não dá pra interagir com essa pessoa.' });

  const already = db.prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?').get(post.id, req.user.id);
  if(already){
    db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(post.id, req.user.id);
  } else {
    db.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?,?)').run(post.id, req.user.id);
    // uma notificação por pessoa por momento (curtir/descurtir não gera spam)
    const notified = db.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'post_like' AND post_id = ?")
      .get(post.user_id, req.user.id, post.id);
    if(!notified) createNotification({ userId: post.user_id, actorId: req.user.id, type: 'post_like', postId: post.id });
  }
  const likes = db.prepare('SELECT COUNT(*) c FROM post_likes WHERE post_id = ?').get(post.id).c;
  res.json({ liked: !already, likes });
});

function serializeComment(row, viewerId, postOwnerId){
  return {
    id: row.id,
    name: row.username,
    avatar: row.has_avatar ? avatarUrl({ username: row.username, avatar: true, avatar_v: row.avatar_v }) : null,
    text: row.text,
    mine: viewerId === row.user_id,
    canDelete: viewerId === row.user_id || viewerId === postOwnerId,
    createdAt: toIso(row.created_at),
  };
}

const COMMENT_SELECT = `
  SELECT c.id, c.user_id, c.text, c.created_at, u.username, u.avatar_v, (u.avatar IS NOT NULL) AS has_avatar
  FROM post_comments c JOIN users u ON u.id = c.user_id
`;

router.get('/:postId/comments', optionalAuth, (req, res) => {
  const post = findPost(req.params.postId);
  if(!post) return res.status(404).json({ error: 'momento não encontrado.' });
  const viewerId = req.user ? req.user.id : null;
  const rows = db.prepare(`${COMMENT_SELECT} WHERE c.post_id = ? ORDER BY c.id ASC LIMIT 300`).all(post.id);
  res.json({ comments: rows.map(r => serializeComment(r, viewerId, post.user_id)) });
});

router.post('/:postId/comments', requireAuth, writeLimiter, (req, res) => {
  const post = findPost(req.params.postId);
  if(!post) return res.status(404).json({ error: 'momento não encontrado.' });
  if(isBlockedEither(req.user.id, post.user_id)) return res.status(403).json({ error: 'não dá pra interagir com essa pessoa.' });
  const text = cleanString((req.body || {}).text, COMMENT_MAX);
  if(!text) return res.status(400).json({ error: 'escreva alguma coisa.' });

  const info = db.prepare('INSERT INTO post_comments (post_id, user_id, text) VALUES (?,?,?)').run(post.id, req.user.id, text);
  createNotification({ userId: post.user_id, actorId: req.user.id, type: 'post_comment', postId: post.id });
  const row = db.prepare(`${COMMENT_SELECT} WHERE c.id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ comment: serializeComment(row, req.user.id, post.user_id) });
});

router.delete('/comments/:commentId', requireAuth, (req, res) => {
  const commentId = parseId(req.params.commentId);
  const comment = commentId ? db.prepare('SELECT c.id, c.user_id, p.user_id AS owner_id FROM post_comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ?').get(commentId) : null;
  if(!comment) return res.status(404).json({ error: 'comentário não encontrado.' });
  if(comment.user_id !== req.user.id && comment.owner_id !== req.user.id) return res.status(403).json({ error: 'você não pode apagar esse comentário.' });
  db.prepare('DELETE FROM post_comments WHERE id = ?').run(comment.id);
  res.status(204).end();
});

module.exports = router;
