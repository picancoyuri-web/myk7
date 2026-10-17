const express = require('express');
const { hasToken, discogsGet, firstImage, artistPhoto } = require('../utils/discogs');

const router = express.Router();

// busca dados de um artista/banda no Discogs: foto, e se for uma banda,
// os integrantes (com foto de cada um, quando existir).
// GET /api/artist-info?name=...
router.get('/', async (req, res) => {
  if(!hasToken()){
    return res.status(503).json({ error: 'busca de artistas não configurada no servidor (falta DISCOGS_TOKEN).' });
  }

  const name = String(req.query.name || '').trim().slice(0, 200);
  if(!name){
    return res.status(400).json({ error: 'faltou o nome do artista.' });
  }

  try{
    const search = await discogsGet('/database/search?' + new URLSearchParams({ q: name, type: 'artist' }));
    const best = (search.results || [])[0];
    if(!best){
      return res.json({ found: false });
    }

    const artist = await discogsGet(`/artists/${best.id}`);

    // "members" só vem preenchido quando o artista é uma banda/grupo;
    // as fotos dos integrantes são buscadas em paralelo
    const rawMembers = (artist.members || []).slice(0, 3);
    const photos = await Promise.all(rawMembers.map(m => artistPhoto(m.id)));
    const members = rawMembers.map((m, i) => ({ name: m.name, photo: photos[i] }));

    res.json({
      found: true,
      name: artist.name,
      isGroup: (artist.members || []).length > 0,
      photo: firstImage(artist),
      members,
      discogsUrl: artist.uri || null,
    });
  }catch(e){
    console.error('busca de artista no Discogs falhou:', e.message);
    res.status(502).json({ error: 'não deu pra buscar informações desse artista agora.' });
  }
});

module.exports = router;
