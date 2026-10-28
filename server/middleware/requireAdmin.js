// só quem está em ADMIN_USERNAMES (nomes separados por vírgula) passa.
// Usar depois do requireAuth.
function requireAdmin(req, res, next){
  const admins = (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if(!req.user || !admins.includes(String(req.user.username).toLowerCase())){
    return res.status(403).json({ error: 'só pra moderação.' });
  }
  next();
}

module.exports = requireAdmin;
