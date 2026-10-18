const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const rateLimit = require('../utils/rateLimit');
const { cleanString } = require('../utils/validate');

const router = express.Router();

const TARGET_TYPES = new Set(['user', 'entry', 'comment', 'message']);
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

module.exports = router;
