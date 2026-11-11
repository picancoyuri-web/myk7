const jwt = require('jsonwebtoken');

// IP de quem fez a requisição. Pelo site, tudo chega via proxy do Netlify,
// então o req.ip é o IP do Netlify (igual pra muita gente ao mesmo tempo).
// Com NETLIFY_PROXY_SECRET configurado (o mesmo valor do "signed" no
// netlify.toml), o Netlify assina a requisição no cabeçalho x-nf-sign e aí
// dá pra confiar no IP real que ele manda em x-nf-client-connection-ip.
// Sem assinatura válida o cabeçalho é ignorado — senão bastaria inventá-lo
// chamando o Render direto pra fugir do limite de tentativas.
function clientIp(req){
  const secret = process.env.NETLIFY_PROXY_SECRET;
  const sign = req.get('x-nf-sign');
  const forwarded = req.get('x-nf-client-connection-ip');
  if(secret && sign && forwarded){
    try{
      jwt.verify(sign, secret, { algorithms: ['HS256'] });
      logOnce('ok', '[proxy] requisições do Netlify chegando assinadas — limites contam pelo IP real');
      return forwarded.trim();
    }catch(e){
      logOnce('bad', '[proxy] assinatura do Netlify não confere — confira NETLIFY_PROXY_SECRET nos dois lados');
    }
  }
  return req.ip || 'unknown';
}

// avisa no log só na primeira vez (pra dar pra conferir a configuração)
const logged = new Set();
function logOnce(key, msg){
  if(logged.has(key)) return;
  logged.add(key);
  console.log(msg);
}

module.exports = clientIp;
