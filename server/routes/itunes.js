const express = require('express');
const router = express.Router();

const VALID_ENTITIES = new Set(['song', 'album', 'musicArtist']);
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
const CACHE_MAX = 500;
const cache = new Map();

// o navegador não pode chamar itunes.apple.com direto por causa de CORS,
// então esse endpoint só repassa a busca pro iTunes e devolve o resultado
router.get('/search', async (req, res) => {
  const term = String(req.query.term || '').trim().slice(0, 200);
  const entity = VALID_ENTITIES.has(req.query.entity) ? req.query.entity : 'album';
  if(!term) return res.status(400).json({ error: 'faltou o termo de busca.' });

  const url = 'https://itunes.apple.com/search?' + new URLSearchParams({
    term, media: 'music', entity, limit: '25',
  });

  const cached = cache.get(url);
  if(cached && cached.expiresAt > Date.now()) return res.json({ results: cached.results });

  try{
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if(!r.ok) throw new Error('iTunes respondeu ' + r.status);
    const data = await r.json();
    const results = data.results || [];

    if(cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(url, { results, expiresAt: Date.now() + CACHE_TTL_MS });

    res.json({ results });
  }catch(e){
    console.error('busca iTunes falhou:', e.message);
    res.status(502).json({ error: 'não deu pra buscar no iTunes agora.' });
  }
});

module.exports = router;
