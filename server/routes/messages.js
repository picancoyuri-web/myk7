const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const rateLimit = require('../utils/rateLimit');
const { toIso } = require('../utils/time');
const { cleanString, parseId } = require('../utils/validate');
const { findUserByUsername, avatarUrl } = require('../utils/serialize');

const router = express.Router();

const MESSAGE_MAX = 2000;
const THREAD_LIMIT = 500;

const sendLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, message: 'muitas mensagens seguidas — espere um pouco.' });

function serializeMessage(m, meId){
  return {
    id: m.id,
    text: m.text,
    fromMe: m.from_id === meId,
    createdAt: toIso(m.created_at),
    read: !!m.read_at,
  };
}

// lista de conversas da pessoa logada, uma linha por interlocutor,
// com a última mensagem trocada e quantas ainda não foram lidas
router.get('/', requireAuth, (req, res) => {
  const me = req.user.id;
  const rows = db.prepare(`
    SELECT
      u.username, u.avatar_v, (u.avatar IS NOT NULL) AS has_avatar,
      m.text AS lastText, m.created_at AS lastAt, (m.from_id = @me) AS lastFromMe,
      (SELECT COUNT(*) FROM messages x WHERE x.to_id = @me AND x.from_id = u.id AND x.read_at IS NULL) AS unread
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.from_id = @me THEN m.to_id ELSE m.from_id END
    WHERE m.id IN (
      SELECT MAX(id) FROM messages
      WHERE from_id = @me OR to_id = @me
      GROUP BY CASE WHEN from_id = @me THEN to_id ELSE from_id END
    )
    ORDER BY m.id DESC
  `).all({ me });

  res.json({
    conversations: rows.map(r => ({
      username: r.username,
      avatar: r.has_avatar ? avatarUrl({ username: r.username, avatar: true, avatar_v: r.avatar_v }) : null,
      lastText: r.lastText,
      lastAt: toIso(r.lastAt),
      lastFromMe: !!r.lastFromMe,
      unread: r.unread,
    })),
  });
});

// histórico de mensagens entre a pessoa logada e outra pessoa (as últimas
// THREAD_LIMIT, em ordem cronológica). Com ?after=<id> devolve só as novas —
// é o que a conversa aberta usa pra se atualizar sozinha. Abrir a conversa
// marca como lidas as mensagens recebidas.
router.get('/:username', requireAuth, (req, res) => {
  const other = findUserByUsername(req.params.username);
  if(!other) return res.status(404).json({ error: 'pessoa não encontrada.' });
  const me = req.user.id;
  const after = parseId(req.query.after);

  const rows = after
    ? db.prepare(`
        SELECT * FROM messages
        WHERE id > ? AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))
        ORDER BY id ASC LIMIT ?
      `).all(after, me, other.id, other.id, me, THREAD_LIMIT)
    : db.prepare(`
        SELECT * FROM (
          SELECT * FROM messages
          WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
          ORDER BY id DESC
          LIMIT ?
        ) ORDER BY id ASC
      `).all(me, other.id, other.id, me, THREAD_LIMIT);

  db.prepare("UPDATE messages SET read_at = datetime('now') WHERE to_id = ? AND from_id = ? AND read_at IS NULL")
    .run(me, other.id);

  res.json({ messages: rows.map(m => serializeMessage(m, me)) });
});

// enviar uma mensagem pra outra pessoa
router.post('/:username', requireAuth, sendLimiter, (req, res) => {
  const other = findUserByUsername(req.params.username);
  if(!other) return res.status(404).json({ error: 'pessoa não encontrada.' });
  if(other.id === req.user.id) return res.status(400).json({ error: 'você não pode mandar mensagem pra si mesmo.' });

  const text = cleanString((req.body || {}).text, MESSAGE_MAX);
  if(!text) return res.status(400).json({ error: 'escreva uma mensagem.' });

  const info = db.prepare('INSERT INTO messages (from_id, to_id, text) VALUES (?,?,?)')
    .run(req.user.id, other.id, text);
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);

  res.status(201).json({ message: serializeMessage(row, req.user.id) });
});

module.exports = router;
