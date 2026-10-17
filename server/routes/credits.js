const express = require('express');
const { hasToken, discogsGet, artistPhoto } = require('../utils/discogs');

const router = express.Router();

// busca créditos (quem toca o quê) e fotos de uma música/álbum no Discogs.
// GET /api/credits?artist=...&title=...
router.get('/', async (req, res) => {
  if(!hasToken()){
    return res.status(503).json({ error: 'busca de créditos não configurada no servidor (falta DISCOGS_TOKEN).' });
  }

  const artist = String(req.query.artist || '').trim().slice(0, 200);
  const title = String(req.query.title || '').trim().slice(0, 200);
  if(!artist || !title){
    return res.status(400).json({ error: 'faltam artista e título pra buscar os créditos.' });
  }

  try{
    const search = await discogsGet('/database/search?' + new URLSearchParams({
      artist,
      release_title: title,
      type: 'release',
    }));
    const best = (search.results || [])[0];
    if(!best){
      return res.json({ found: false });
    }

    const release = await discogsGet(`/releases/${best.id}`);

    // créditos do lançamento inteiro (produtor, engenheiro, banda de apoio etc)
    const credits = (release.extraartists || []).map(a => ({ name: a.name, role: a.role }));

    // créditos específicos de uma faixa (útil quando um músico convidado
    // só participa daquela música, não do álbum inteiro)
    const trackCredits = [];
    (release.tracklist || []).forEach(t => {
      (t.extraartists || []).forEach(a => {
        trackCredits.push({ track: t.title, name: a.name, role: a.role });
      });
    });

    const images = (release.images || [])
      .slice(0, 6)
      .map(img => img.resource_url || img.uri)
      .filter(Boolean);

    // foto do artista principal (quando existe no Discogs — nem todo
    // artista tem, principalmente músicos de sessão)
    const mainArtist = (release.artists || [])[0];
    const mainArtistPhoto = mainArtist && mainArtist.id ? await artistPhoto(mainArtist.id) : null;

    res.json({
      found: true,
      releaseTitle: release.title,
      year: release.year || null,
      label: (release.labels && release.labels[0] && release.labels[0].name) || null,
      genres: release.genres || [],
      styles: release.styles || [],
      mainArtist: mainArtist ? mainArtist.name : artist,
      artistPhoto: mainArtistPhoto,
      credits,
      trackCredits,
      images,
      discogsUrl: release.uri || null,
    });
  }catch(e){
    console.error('busca de créditos no Discogs falhou:', e.message);
    res.status(502).json({ error: 'não deu pra buscar os créditos agora.' });
  }
});

module.exports = router;
