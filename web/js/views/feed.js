// "Pra Você": fitas recomendadas (álbuns, músicas ou artistas) + o que está
// em alta no país da pessoa
import { html, render, $, normalizeText } from '../dom.js';
import { api, q, mediaUrl } from '../api.js';
import { DEMO } from '../config.js';
import { icon } from '../icons.js';
import { cassette } from '../cassette.js';
import { playButton } from '../player.js';
import { state, affinity } from '../state.js';
import { stars, empty } from '../components.js';
import { famousGenres, trendingByCountry, communityReviews, catalog, singles } from '../data.js';
import { mapItunesResult, mapItunesArtist, registerItem, shuffle, typeLabel } from '../items.js';
import { presetSearch } from './search.js';

const feed = { mode: 'album', genre: 'all', items: [], artists: [], loading: false, seq: 0, trendGenre: null, loadedFor: null };

function genreMatches(itemGenre, wanted){
  const a = normalizeText(itemGenre), b = normalizeText(wanted);
  const head = (s) => s.split('/')[0].trim();
  return a.includes(head(b)) || b.includes(head(a));
}

function communityStats(id){
  const rv = communityReviews.filter(r => r.itemId === id);
  if(!rv.length) return null;
  return { avg: (rv.reduce((t, r) => t + r.rating, 0) / rv.length).toFixed(1), count: rv.length };
}

function pickGenres(n){
  return shuffle(famousGenres).slice(0, n);
}

function localPool(){
  const type = feed.mode === 'album' ? 'album' : 'single';
  let pool = [...catalog, ...singles].filter(i => i.type === type);
  if(feed.genre !== 'all') pool = pool.filter(i => genreMatches(i.genre, feed.genre));
  return shuffle(pool);
}

async function fetchItems(){
  const seq = ++feed.seq;
  feed.loading = true;
  paintFeed();
  const terms = (feed.genre === 'all' ? pickGenres(feed.mode === 'artist' ? 2 : 4) : [feed.genre]).map(t => t.replace(/\//g, ' '));

  if(feed.mode === 'artist'){
    let artists = [];
    if(!DEMO){
      const groups = await Promise.all(terms.map(t => api('/itunes/search' + q({ term: t, entity: 'musicArtist' })).then(r => r.results).catch(() => [])));
      const seen = new Set();
      artists = shuffle(groups.flat().map(mapItunesArtist).filter(Boolean)).filter(a => !seen.has(a.name) && seen.add(a.name)).slice(0, 6);
      // foto (e integrantes, se for banda) vêm do Discogs, em paralelo
      artists = await Promise.all(artists.map(async a => {
        try{
          const info = await api('/artist-info' + q({ name: a.name }));
          return { ...a, photo: info.found ? info.photo : null, members: info.found && info.isGroup ? info.members : [] };
        }catch(e){ return { ...a, photo: null, members: [] }; }
      }));
    }
    if(!artists.length){
      const seen = new Set();
      artists = localPool().concat(shuffle([...catalog, ...singles]))
        .filter(i => feed.genre === 'all' || genreMatches(i.genre, feed.genre))
        .filter(i => !seen.has(i.artist) && seen.add(i.artist))
        .slice(0, 10).map(i => ({ name: i.artist, genre: i.genre, photo: null, members: [] }));
    }
    if(seq !== feed.seq) return;
    feed.artists = artists;
  }else{
    let found = [];
    if(!DEMO){
      const entity = feed.mode === 'album' ? 'album' : 'song';
      const wanted = feed.mode === 'album' ? 'album' : 'single';
      const groups = await Promise.all(terms.map(t => api('/itunes/search' + q({ term: t, entity })).then(r => r.results).catch(() => [])));
      const seen = new Set();
      found = shuffle(groups.flat().map(mapItunesResult).filter(i => i && i.type === wanted)).filter(i => !seen.has(i.id) && seen.add(i.id));
      found = found.map(registerItem);
    }
    // sem internet/iTunes (ou na demonstração) o feed nunca fica vazio: usa o catálogo
    if(found.length < 6) found = found.concat(localPool());
    if(seq !== feed.seq) return;
    feed.items = found.slice(0, 24);
  }
  feed.loading = false;
  feed.loadedFor = state.me && state.me.username;
  paintFeed();
}

function rank(items){
  const aff = affinity();
  const fav = (state.me ? state.me.genres : []).map(normalizeText);
  const score = (a) => {
    const gs = aff.genre[a.genre] || 0;
    const as = aff.artist[a.artist] || 0;
    const fb = fav.some(f => genreMatches(a.genre, f)) ? 4 : 0;
    const st = communityStats(a.id);
    return { total: gs + as + fb + (st ? st.avg * st.count : 0), gs, as, fb, trending: st ? st.avg * st.count : 0 };
  };
  const scored = items.map(a => ({ a, s: score(a) }));
  const hot = new Set(scored.filter(x => x.s.trending > 0).sort((x, y) => y.s.trending - x.s.trending).slice(0, 3).map(x => x.a.id));
  return scored.sort((x, y) => y.s.total - x.s.total).map(({ a, s }) => {
    let tag = null;
    if(hot.has(a.id)) tag = { text: 'em alta na comunidade', why: false };
    else if(s.as > 0) tag = { text: `porque você curte ${a.artist}`, why: true };
    else if(s.gs > 0) tag = { text: `porque você curte ${a.genre}`, why: true };
    else if(s.fb > 0) tag = { text: 'no seu estilo favorito', why: true };
    return { a, tag };
  });
}

function feedCard({ a, tag }){
  const st = communityStats(a.id);
  const mine = state.diary.find(e => e.itemId === a.id);
  return html`
    <article class="feed-card">
      <div class="fc-top">
        <span class="eyebrow">${typeLabel(a)} · ${a.genre}</span>
        ${tag ? html`<span class="fc-tag ${tag.why ? 'why' : ''}">${tag.text}</span>` : ''}
      </div>
      <button class="fc-cassette" type="button" data-act="detail" data-id="${a.id}" aria-label="Ficha de ${a.title}">${cassette(a)}</button>
      <div>
        <h2 class="fc-title">${a.title}</h2>
        <div class="fc-sub"><b>${a.artist}</b>${a.year ? html`<span class="num">· ${a.year}</span>` : ''}</div>
      </div>
      <div class="fc-stats">
        ${mine ? html`você deu ${stars(mine.rating)}` : st ? `★ ${st.avg} · ${st.count} resenha${st.count > 1 ? 's' : ''} na comunidade` : 'ninguém resenhou ainda — seja a primeira pessoa'}
      </div>
      <div class="fc-actions">
        ${playButton(a, { cls: 'btn', label: 'Ouvir' })}
        <button class="btn btn-primary grow" type="button" data-act="log" data-id="${a.id}">${icon('star')}<span>${mine ? 'Registrar de novo' : 'Registrar escuta'}</span></button>
        <button class="btn btn-icon" type="button" data-act="detail" data-id="${a.id}" aria-label="Ficha técnica">${icon('info')}</button>
      </div>
    </article>
  `;
}

function artistCard(ar){
  const photo = mediaUrl(ar.photo);
  return html`
    <button class="artist-card" type="button" data-feed="artist" data-name="${ar.name}">
      <span class="artist-photo">${photo ? html`<img src="${photo}" alt="" loading="lazy">` : ar.name[0].toUpperCase()}</span>
      <span style="min-width:0">
        <span class="eyebrow">${ar.genre}</span>
        <span class="artist-name" style="display:block">${ar.name}</span>
        <span class="muted" style="font-size:14px">${ar.members && ar.members.length ? 'banda com ' + ar.members.map(m => m.name).join(', ') : 'ver músicas e álbuns →'}</span>
      </span>
    </button>
  `;
}

let rootEl = null;

function paintFeed(){
  const box = rootEl && $('#feedList', rootEl);
  if(!box) return;
  const refresh = $('#feedRefresh', rootEl);
  if(refresh) refresh.disabled = feed.loading;
  if(feed.loading){
    render(box, html`<div class="skeleton" style="height:520px;border-radius:28px"></div><div class="skeleton" style="height:520px;border-radius:28px"></div>`);
    return;
  }
  if(feed.mode === 'artist'){
    render(box, feed.artists.length ? feed.artists.map(artistCard) : empty('nada por aqui', 'tente outro estilo ou busque novas fitas.'));
    return;
  }
  render(box, feed.items.length ? rank(feed.items).map(feedCard) : empty('nada por aqui', 'tente outro estilo ou busque novas fitas.'));
}

function trendBox(){
  if(!state.me) return '';
  const country = state.me.nationality && trendingByCountry[state.me.nationality] ? state.me.nationality : 'Global';
  const genres = Object.keys(trendingByCountry[country]);
  if(!feed.trendGenre || !genres.includes(feed.trendGenre)) feed.trendGenre = genres[0];
  const list = trendingByCountry[country][feed.trendGenre] || trendingByCountry.Global[feed.trendGenre] || [];
  return html`
    <section class="trend" aria-labelledby="trendTitle">
      <div class="trend-head">
        <h2 class="h-section" id="trendTitle">Em alta ${country === 'Global' ? 'no mundo' : 'no seu país'}</h2>
        <span class="eyebrow">${country}</span>
      </div>
      <div class="chip-scroll" role="tablist" aria-label="Estilo">
        ${genres.map(g => html`<button class="chip ${g === feed.trendGenre ? 'on' : ''}" type="button" role="tab" aria-selected="${g === feed.trendGenre}" data-feed="trend-genre" data-genre="${g}">${g}</button>`)}
      </div>
      <div class="trend-list">
        ${list.map(it => html`
          <div class="trend-item">
            <div style="min-width:0"><div class="t">${it.t}</div><div class="a">${it.a}</div></div>
            <button class="btn btn-sm btn-icon" type="button" data-feed="trend-find" data-title="${it.t}" data-artist="${it.a}" aria-label="Buscar ${it.t}">${icon('search')}</button>
          </div>
        `)}
      </div>
      <div class="trend-source">com base em paradas recentes (Billboard Hot 100, Spotify Weekly) — atualizado à mão de tempos em tempos.</div>
    </section>
  `;
}

export function mount(root){
  rootEl = root;
  render(root, html`
    <header class="page-head">
      <span class="eyebrow">lado A · ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      <h1 class="h-display">Pra você</h1>
      <p>fitas escolhidas pelo que você registra e pelos estilos que você curte.</p>
    </header>
    <div id="trendBox">${trendBox()}</div>
    <div class="feed-controls">
      <div class="row">
        <div class="seg" role="tablist" aria-label="Tipo">
          ${[['album', 'Álbuns'], ['single', 'Músicas'], ['artist', 'Artistas']].map(([m, l]) => html`<button type="button" role="tab" aria-selected="${feed.mode === m}" class="${feed.mode === m ? 'on' : ''}" data-feed="mode" data-mode="${m}">${l}</button>`)}
        </div>
        <button class="btn btn-sm" type="button" id="feedRefresh" data-feed="refresh">${icon('refresh')} Novas fitas</button>
      </div>
      <div class="chip-scroll" aria-label="Estilos">
        ${['all', ...famousGenres].map(g => html`<button class="chip ${feed.genre === g ? 'on' : ''}" type="button" data-feed="genre" data-genre="${g}">${g === 'all' ? 'Todos' : g}</button>`)}
      </div>
    </div>
    <div class="feed" id="feedList"></div>
  `);

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-feed]');
    if(!b) return;
    const act = b.dataset.feed;
    if(act === 'mode' && feed.mode !== b.dataset.mode){
      feed.mode = b.dataset.mode;
      root.querySelectorAll('[data-feed="mode"]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      fetchItems();
    }
    if(act === 'genre'){
      feed.genre = b.dataset.genre;
      root.querySelectorAll('[data-feed="genre"]').forEach(x => x.classList.toggle('on', x === b));
      fetchItems();
    }
    if(act === 'refresh') fetchItems();
    if(act === 'trend-genre'){ feed.trendGenre = b.dataset.genre; render($('#trendBox', root), trendBox()); }
    if(act === 'trend-find') presetSearch({ title: b.dataset.title, artist: b.dataset.artist });
    if(act === 'artist') presetSearch({ title: '', artist: b.dataset.name });
  });

  const stale = feed.loadedFor !== (state.me && state.me.username);
  if(stale || (!feed.items.length && !feed.artists.length)) fetchItems();
  else paintFeed();
}

// quando o diário muda (nova escuta), as tags "porque você curte" mudam
export function refresh(){ paintFeed(); }
