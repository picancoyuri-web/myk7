const { userFromRequest } = require('./requireAuth');

// não bloqueia quem não está logado — só preenche req.user quando o
// cookie de sessão é válido, pra rotas públicas que se comportam um
// pouco diferente pra quem está logado (ex: saber se "eu" curti um
// comentário ao ver o perfil de outra pessoa)
function optionalAuth(req, res, next){
  const user = userFromRequest(req);
  if(user) req.user = user;
  next();
}

module.exports = optionalAuth;
