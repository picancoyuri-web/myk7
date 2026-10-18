const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { toIso } = require('../utils/time');
const { parseId } = require('../utils/validate');
const { avatarUrl } = require('../utils/serialize');

const router = express.Router();

const SELECT = `
  SELECT n.*, u.username AS actor_username, u.avatar_v AS actor_avatar_v,
         (u.avatar IS NOT NULL) AS actor_has_avatar,
         COALESCE(e.item_title, p.item_title) AS entry_title,
         COALESCE(e.item_artist, p.item_artist) AS entry_artist
  FROM notifications n
  LEFT JOIN users u ON u.id = n.actor_id
  LEFT JOIN diary_entries e ON e.id = n.entry_id
  LEFT JOIN posts p ON p.id = n.post_id
`;

function serializeNotification(row){
  return {
    id: row.id,
    type: row.type,
    actor: row.actor_username ? {
      username: row.actor_username,
      avatar: row.actor_has_avatar ? avatarUrl({ username: row.actor_username, avatar: true, avatar_v: row.actor_avatar_v }) : null,
    } : null,
    entryId: row.entry_id || null,
    entry: row.entry_title ? { title: row.entry_title, artist: row.entry_artist } : null,
    commentId: row.comment_id || null,
    postId: row.post_id || null,
    read: !!row.read,
    createdAt: toIso(row.created_at),
  };
}

function counts(userId){
  return {
    unread: db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0').get(userId).c,
    unreadMessages: db.prepare('SELECT COUNT(*) c FROM messages WHERE to_id = ? AND read_at IS NULL').get(userId).c,
  };
}

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`${SELECT} WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 100`).all(req.user.id);
  res.json({ notifications: rows.map(serializeNotification) });
});

// checagem leve feita a cada poucos segundos pelo app: contagens de não
// lidas + só as notificações mais novas que ?after=<id> (sem ?after devolve
// só o id mais recente, pra o app saber de onde começar)
router.get('/poll', requireAuth, (req, res) => {
  const after = parseId(req.query.after);
  const latest = db.prepare('SELECT MAX(id) m FROM notifications WHERE user_id = ?').get(req.user.id).m || 0;
  const fresh = after
    ? db.prepare(`${SELECT} WHERE n.user_id = ? AND n.id > ? ORDER BY n.id ASC LIMIT 20`).all(req.user.id, after).map(serializeNotification)
    : [];
  res.json({ ...counts(req.user.id), latestId: latest, fresh });
});

router.get('/unread-count', requireAuth, (req, res) => {
  res.json({ count: counts(req.user.id).unread });
});

router.post('/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(req.user.id);
  res.status(204).end();
});

module.exports = router;
