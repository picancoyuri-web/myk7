const db = require('../db');
const { isBlockedEither } = require('./blocks');

// registra uma notificação pra userId, causada pela ação de actorId.
// por padrão nunca notifica a própria pessoa sobre a própria ação —
// exceto quando allowSelf=true (usado pelos lembretes de memória).
// Quem está bloqueado (em qualquer sentido) não gera notificação.
function createNotification({ userId, actorId, type, entryId = null, commentId = null, postId = null, allowSelf = false }){
  if(!userId || !actorId) return;
  if(userId === actorId && !allowSelf) return;
  if(userId !== actorId && isBlockedEither(userId, actorId)) return;
  db.prepare(`
    INSERT INTO notifications (user_id, actor_id, type, entry_id, comment_id, post_id)
    VALUES (?,?,?,?,?,?)
  `).run(userId, actorId, type, entryId, commentId, postId);
}

module.exports = { createNotification };
