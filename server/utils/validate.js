// validações compartilhadas entre as rotas — tudo que vem do cliente passa
// por aqui antes de ir pro banco ou voltar pra outro usuário no HTML.

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// só aceitamos imagem embutida em base64 (é o que o front gera com <canvas>),
// nunca URL arbitrária — evita injeção em style="background-image:url(...)"
const DATA_IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
const SPOTIFY_TYPES = new Set(['album', 'track', 'playlist']);

function isNonEmptyString(v){
  return typeof v === 'string' && v.trim().length > 0;
}

// devolve a string aparada e cortada no tamanho máximo, ou null
function cleanString(v, max){
  if(v === undefined || v === null) return null;
  const s = String(v).trim();
  if(!s) return null;
  return s.slice(0, max);
}

function isValidDataImage(v, maxBytes){
  return typeof v === 'string' && v.length <= maxBytes && DATA_IMAGE_RE.test(v);
}

function isHttpsUrl(v){
  if(typeof v !== 'string' || v.length > 1000) return false;
  try{ return new URL(v).protocol === 'https:'; }catch(e){ return false; }
}

function cleanSpotifyRef(sp){
  if(!sp || typeof sp !== 'object') return null;
  if(!SPOTIFY_TYPES.has(sp.t)) return null;
  if(typeof sp.id !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(sp.id)) return null;
  return { t: sp.t, id: sp.id };
}

function parseId(v){
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// escapa % e _ pra busca com LIKE tratar o termo como texto literal
function escapeLike(s){
  return s.replace(/[\\%_]/g, ch => '\\' + ch);
}

module.exports = {
  USERNAME_RE,
  EMAIL_RE,
  isNonEmptyString,
  cleanString,
  isValidDataImage,
  isHttpsUrl,
  cleanSpotifyRef,
  parseId,
  escapeLike,
};
