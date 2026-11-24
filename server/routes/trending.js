const express = require('express');
const db = require('../db');

const router = express.Router();

// "Em alta" de verdade: o top 100 das músicas mais tocadas no Apple Music de
// cada país (charts públicos da Apple, sem chave). Atualiza sozinho uma vez
// por semana (vira na segunda-feira) e fica guardado no banco — se a Apple
// estiver fora do ar, o app continua recebendo a lista da semana anterior.

const STOREFRONTS = new Set(['br', 'us', 'pt', 'gb', 'es', 'fr', 'de', 'it', 'ar', 'mx', 'co', 'jp', 'kr', 'in', 'ca', 'au']);

db.exec(`
CREATE TABLE IF NOT EXISTS trending_cache (
  country TEXT PRIMARY KEY,
  week TEXT NOT NULL,
  results TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// semana no formato 2026-11-23 (a segunda-feira dela, em UTC)
function weekKey(date = new Date()){
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

async function getJson(url, tries = 3){
  let last;
  for(let i = 0; i < tries; i++){
    try{
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if(r.ok) return await r.json();
      last = new Error(`${url} respondeu ${r.status}`);
    }catch(e){ last = e; }
    await new Promise(ok => setTimeout(ok, 800 * (i + 1)));
  }
  throw last;
}

// baixa o chart do país e completa cada música com a prévia de 30 s e o gênero
async function fetchChart(country){
  const chart = await getJson(`https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/100/songs.json`);
  const entries = (chart.feed && chart.feed.results) || [];
  const chartGenres = new Map(entries.map(e => [String(e.id), (e.genres || []).map(g => g.name)]));
  const ids = entries.map(e => String(e.id));
  const looked = new Map();
  for(let i = 0; i < ids.length; i += 50){
    const part = ids.slice(i, i + 50);
    try{
      const data = await getJson('https://itunes.apple.com/lookup?' + new URLSearchParams({ id: part.join(','), country }));
      (data.results || []).forEach(r => { if(r.trackId) looked.set(String(r.trackId), r); });
    }catch(e){ /* segue com o que veio do chart */ }
  }
  return ids.map((id, rank) => {
    const e = entries[rank];
    const r = looked.get(id) || {};
    return {
      wrapperType: 'track', kind: 'song', trackId: Number(id),
      trackName: r.trackName || e.name, artistName: r.artistName || e.artistName,
      releaseDate: r.releaseDate || e.releaseDate || null,
      primaryGenreName: r.primaryGenreName || null,
      previewUrl: r.previewUrl || null,
      chartGenres: chartGenres.get(id) || [],
      rank: rank + 1,
    };
  });
}

const refreshing = new Map();
async function chartFor(country){
  const week = weekKey();
  const row = db.prepare('SELECT week, results FROM trending_cache WHERE country = ?').get(country);
  if(row && row.week === week) return { week, results: JSON.parse(row.results) };
  // semana nova: busca de novo (várias pessoas ao mesmo tempo esperam a mesma busca)
  let pending = refreshing.get(country);
  if(!pending){
    pending = fetchChart(country).then(results => {
      if(results.length){
        db.prepare(`
          INSERT INTO trending_cache (country, week, results) VALUES (?,?,?)
          ON CONFLICT(country) DO UPDATE SET week = excluded.week, results = excluded.results, fetched_at = datetime('now')
        `).run(country, week, JSON.stringify(results));
      }
      return results;
    }).finally(() => refreshing.delete(country));
    refreshing.set(country, pending);
  }
  try{
    const results = await pending;
    if(results.length) return { week, results };
  }catch(e){
    console.warn('[em alta] chart indisponível:', country, e.message);
  }
  // Apple fora do ar: serve a semana anterior
  if(row) return { week: row.week, results: JSON.parse(row.results), stale: true };
  return { week, results: [] };
}

router.get('/', async (req, res) => {
  const country = String(req.query.country || 'br').toLowerCase();
  if(!STOREFRONTS.has(country)) return res.status(400).json({ error: 'país sem chart.' });
  try{
    const data = await chartFor(country);
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ country, ...data });
  }catch(e){
    res.status(502).json({ error: 'não deu pra buscar o que está em alta agora.' });
  }
});

// mantém os países mais usados prontos: confere a cada 6 h se a semana virou
function startWeeklyRefresh(){
  const warm = () => ['br', 'us', 'pt'].forEach(c => chartFor(c).catch(() => {}));
  setTimeout(warm, 30 * 1000);
  setInterval(warm, 6 * 60 * 60 * 1000).unref();
}

module.exports = router;
module.exports.startWeeklyRefresh = startWeeklyRefresh;
module.exports.weekKey = weekKey;
