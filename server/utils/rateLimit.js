const clientIp = require('./clientIp');

// limitador simples em memória (sem dependência extra) pra frear tentativa
// de senha por força bruta e spam de cadastro/e-mail. Por padrão conta por
// IP + rota; `key` troca isso (ex: por conta, pra quem troca de IP).
function rateLimit({ windowMs, max, message, key }){
  const hits = new Map();

  // limpeza periódica pra o Map não crescer pra sempre
  setInterval(() => {
    const now = Date.now();
    for(const [k, entry] of hits){
      if(entry.resetAt <= now) hits.delete(k);
    }
  }, windowMs).unref();

  return function(req, res, next){
    const custom = key ? key(req) : null;
    if(key && !custom) return next(); // sem chave (ex: corpo vazio): a validação da rota responde
    const k = (custom || clientIp(req)) + ':' + req.baseUrl + req.path;
    const now = Date.now();
    let entry = hits.get(k);
    if(!entry || entry.resetAt <= now){
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
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
