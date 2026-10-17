// cliente do Discogs compartilhado por /credits e /artist-info.
// - token vai no header Authorization (não na URL, que acaba em logs)
// - timeout pra uma resposta lenta não travar a requisição do usuário
// - cache em memória: o Discogs só permite 60 requisições/minuto, e o feed
//   de artistas pede várias de uma vez — sem cache estoura rapidinho.
const DISCOGS_BASE = 'https://api.discogs.com';
const USER_AGENT = 'CasseteApp/1.0 (+https://cassete.netlify.app)';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const CACHE_MAX = 2000;

const cache = new Map();

function hasToken(){
  return !!process.env.DISCOGS_TOKEN;
}

async function discogsGet(pathAndQuery){
  const url = DISCOGS_BASE + pathAndQuery;
  const cached = cache.get(url);
  if(cached && cached.expiresAt > Date.now()) return cached.data;

  const r = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Authorization': `Discogs token=${process.env.DISCOGS_TOKEN}`,
    },
    signal: AbortSignal.timeout(10000),
  });
  if(!r.ok){
    const err = new Error('discogs respondeu ' + r.status);
    err.status = r.status;
    throw err;
  }
  const data = await r.json();

  if(cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

function firstImage(obj){
  if(!obj || !obj.images || !obj.images.length) return null;
  return obj.images[0].resource_url || obj.images[0].uri || null;
}

// foto de um artista pelo id — sem foto não é erro, só devolve null
async function artistPhoto(id){
  try{
    return firstImage(await discogsGet(`/artists/${encodeURIComponent(id)}`));
  }catch(e){
    return null;
  }
}

module.exports = { hasToken, discogsGet, firstImage, artistPhoto };
