// limitador simples em memória (sem dependência extra) pra frear tentativa
// de senha por força bruta e spam de cadastro/e-mail. Por IP + rota.
function rateLimit({ windowMs, max, message }){
  const hits = new Map();

  // limpeza periódica pra o Map não crescer pra sempre
  setInterval(() => {
    const now = Date.now();
    for(const [key, entry] of hits){
      if(entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs).unref();

  return function(req, res, next){
    const key = (req.ip || 'unknown') + ':' + req.baseUrl + req.path;
    const now = Date.now();
    let entry = hits.get(key);
    if(!entry || entry.resetAt <= now){
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if(entry.count > max){
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message || 'muitas tentativas — espere um pouco e tente de novo.' });
    }
    next();
  };
}

module.exports = rateLimit;
