const express = require('express');
const router = express.Router();

const VALID_ENTITIES = new Set(['song', 'album', 'musicArtist']);
// o catálogo do iTunes quase não muda de uma hora pra outra, e o feed e o
// "em alta" repetem as mesmas buscas o dia todo — guardar por 6h tira a
// espera da Apple (~0,5–2 s) de quase todo play
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 2000;
const cache = new Map();
// buscas iguais chegando ao mesmo tempo (várias pessoas abrindo o feed)
// esperam a mesma resposta em vez de cada uma ir até a Apple
const inflight = new Map();

function remember(url, results){
  if(cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(url, { results, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function fetchFromItunes(url){
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if(!r.ok) throw new Error('iTunes respondeu ' + r.status);
  const data = await r.json();
  return data.results || [];
}

// o navegador não pode chamar itunes.apple.com direto por causa de CORS,
// então esse endpoint só repassa a busca pro iTunes e devolve o resultado
router.get('/search', async (req, res) => {
  const term = String(req.query.term || '').trim().slice(0, 200);
  const entity = VALID_ENTITIES.has(req.query.entity) ? req.query.entity : 'album';
  if(!term) return res.status(400).json({ error: 'faltou o termo de busca.' });

  const url = 'https://itunes.apple.com/search?' + new URLSearchParams({
    term, media: 'music', entity, limit: '25',
  });

  // o navegador pode reaproveitar a resposta por 30 min sem perguntar de novo
  res.set('Cache-Control', 'public, max-age=1800');

  const cached = cache.get(url);
  if(cached && cached.expiresAt > Date.now()){
    // renova o lugar na fila (as buscas mais usadas não saem do cache)
    cache.delete(url);
    cache.set(url, cached);
    return res.json({ results: cached.results });
  }

  try{
    let pending = inflight.get(url);
    if(!pending){
      pending = fetchFromItunes(url).finally(() => inflight.delete(url));
      inflight.set(url, pending);
    }
    const results = await pending;
    remember(url, results);
    res.json({ results });
  }catch(e){
    console.error('busca iTunes falhou:', e.message);
    // sem resposta da Apple: serve a versão velha se tiver, melhor que nada
    if(cached) return res.json({ results: cached.results });
    res.set('Cache-Control', 'no-store');
    res.status(502).json({ error: 'não deu pra buscar no iTunes agora.' });
  }
});

module.exports = router;
