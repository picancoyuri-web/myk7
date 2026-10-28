const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const rateLimit = require('../utils/rateLimit');
const { cleanString } = require('../utils/validate');

const router = express.Router();

const TARGET_TYPES = new Set(['user', 'entry', 'comment', 'message', 'post', 'post_comment']);
const REASONS = new Set(['spam', 'assedio', 'discurso_de_odio', 'conteudo_impróprio', 'direitos_autorais', 'outro']);

const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, message: 'muitas denúncias seguidas — tente de novo mais tarde.' });

// denúncia de pessoa, resenha, comentário ou mensagem. Fica guardada no
// banco (tabela reports) e aparece no log do servidor pra quem modera.
router.post('/', requireAuth, reportLimiter, (req, res) => {
  const { targetType, targetId, reason } = req.body || {};
  if(!TARGET_TYPES.has(targetType)) return res.status(400).json({ error: 'tipo de denúncia inválido.' });
  if(!REASONS.has(reason)) return res.status(400).json({ error: 'escolha um motivo.' });
  const id = cleanString(targetId, 64);
  if(!id) return res.status(400).json({ error: 'denúncia sem alvo.' });

  db.prepare('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?,?,?,?)')
    .run(req.user.id, targetType, id, reason);
  console.log(`[denúncia] ${req.user.username} denunciou ${targetType} ${id} — ${reason}`);
  res.status(201).json({ ok: true });
});

// ---- moderação ----
// quem modera é definido na variável ADMIN_USERNAMES (separados por vírgula).
// A App Store exige que denúncias possam ser tratadas (prazo de 24 h).
function requireAdmin(req, res, next){
  const admins = (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if(!admins.includes(String(req.user.username).toLowerCase())) return res.status(403).json({ error: 'só pra moderação.' });
  next();
}

// tabela de cada tipo de conteúdo denunciável (a chave é o target_type)
const TARGET_TABLES = {
  entry: 'diary_entries', comment: 'diary_comments', message: 'messages',
  post: 'posts', post_comment: 'post_comments',
};

// GET /api/reports — denúncias em aberto, mais recentes primeiro
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT r.id, r.target_type AS targetType, r.target_id AS targetId, r.reason,
           r.created_at AS createdAt, u.username AS reporter
    FROM reports r LEFT JOIN users u ON u.id = r.reporter_id
    ORDER BY r.id DESC LIMIT 200
  `).all();
  res.json({ reports: rows });
});

// POST /api/reports/:id/resolve  { action: 'remove' | 'dismiss' }
// 'remove' apaga o conteúdo denunciado (ou a conta, se a denúncia for de pessoa)
router.post('/:id/resolve', requireAuth, requireAdmin, (req, res) => {
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if(!report) return res.status(404).json({ error: 'denúncia não encontrada.' });
  const action = (req.body || {}).action;
  if(action !== 'remove' && action !== 'dismiss') return res.status(400).json({ error: 'ação inválida.' });

  db.transaction(() => {
    if(action === 'remove'){
      if(report.target_type === 'user'){
        db.prepare('DELETE FROM users WHERE username = ? COLLATE NOCASE OR id = ?').run(report.target_id, report.target_id);
      }else if(TARGET_TABLES[report.target_type]){
        db.prepare(`DELETE FROM ${TARGET_TABLES[report.target_type]} WHERE id = ?`).run(report.target_id);
      }
    }
    // a mesma coisa pode ter sido denunciada por várias pessoas
    db.prepare('DELETE FROM reports WHERE target_type = ? AND target_id = ?').run(report.target_type, report.target_id);
  })();
  console.log(`[moderação] ${req.user.username}: ${action} ${report.target_type} ${report.target_id}`);
  res.json({ ok: true });
});

module.exports = router;
