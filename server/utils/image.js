// as fotos (perfil e comentários) ficam no banco como data URI em base64 —
// isso devolve uma delas como imagem de verdade, com cache no navegador
const DATA_URI_RE = /^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/;

function sendDataImage(res, dataUri, { immutable = false } = {}){
  const m = DATA_URI_RE.exec(dataUri || '');
  if(!m) return res.status(404).json({ error: 'imagem não encontrada.' });
  const buf = Buffer.from(m[2], 'base64');
  res.set('Content-Type', m[1]);
  res.set('Content-Length', String(buf.length));
  // a URL do avatar muda (?v=) quando a foto muda, então dá pra guardar por
  // bastante tempo; foto de comentário nunca muda depois de enviada
  res.set('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=86400');
  res.end(buf);
}

module.exports = { sendDataImage };
