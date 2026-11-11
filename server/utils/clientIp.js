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
      return forwarded.trim();
    }catch(e){ /* assinatura inválida — usa o IP da conexão */ }
  }
  return req.ip || 'unknown';
}

module.exports = clientIp;
