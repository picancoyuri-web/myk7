const jwt = require('jsonwebtoken');
const db = require('../db');

const COOKIE_NAME = 'cassete_token';

// lê o cookie de sessão e devolve a pessoa logada, ou null. A sessão só
// vale se a versão dela bater com a do banco (que muda quando a senha é
// redefinida, derrubando sessões antigas).
function userFromRequest(req){
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if(!token) return null;
  try{
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if(!user) return null;
    if((payload.sv || 0) !== (user.session_version || 0)) return null;
    return user;
  }catch(e){
    return null; // token inválido ou expirado
  }
}

function requireAuth(req, res, next){
  const user = userFromRequest(req);
  if(!user) return res.status(401).json({ error: 'sessão inválida ou expirada — entre de novo.' });
  req.user = user;
  next();
}

module.exports = requireAuth;
module.exports.COOKIE_NAME = COOKIE_NAME;
module.exports.userFromRequest = userFromRequest;
