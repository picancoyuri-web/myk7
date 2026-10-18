const db = require('../db');

// true se qualquer uma das duas pessoas bloqueou a outra
function isBlockedEither(a, b){
  return !!db.prepare(
    'SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)'
  ).get(a, b, b, a);
}

// trecho de SQL que exclui quem bloqueou ou foi bloqueado por @me
// (usa o parâmetro nomeado @me e a coluna informada)
function notBlockedSql(column){
  return `${column} NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = @me
    UNION SELECT blocker_id FROM blocks WHERE blocked_id = @me)`;
}

module.exports = { isBlockedEither, notBlockedSql };
