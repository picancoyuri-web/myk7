// Buscar: músicas, álbuns, playlists e artistas (catálogo + iTunes ao vivo)
import { html, render, $, debounce } from '../dom.js';
import { api, q } from '../api.js';
import { DEMO } from '../config.js';
import { icon } from '../icons.js';
import { tapeRow, empty, skeletonList } from '../components.js';
import { localSearch, mapItunesResult, mapItunesArtist, registerItem, allItems } from '../items.js';
import { communityReviews } from '../data.js';

const s = { title: '', artist: '', type: 'all', live: [], artists: [], loading: false, seq: 0 };
let rootEl = null;

// abre a busca já preenchida (usado pelo feed e pelas tendências)
export function presetSearch({ title = '', artist = '', type = 'all' }){
  s.title = title; s.artist = artist; s.type = type;
  s.live = []; s.artists = [];
  if(location.hash === '#/buscar' && rootEl && rootEl.isConnected){
    $('#searchTitle', rootEl).value = title;
    $('#searchArtist', rootEl).value = artist;
    rootEl.querySelectorAll('[data-search="type"]').forEach(x => x.classList.toggle('on', x.dataset.type === type));
    results();
    live();
    window.scrollTo({ top: 0 });
  }else{
    location.hash = '#/buscar';
  }
}

const TYPES = [['all', 'Tudo'], ['album', 'Álbuns'], ['single', 'Músicas'], ['playlist', 'Playlists'], ['artist', 'Artistas']];

function results(){
  const box = $('#searchResults', rootEl);
  if(!box) return;
  const hasQuery = s.title.trim() || s.artist.trim();

  if(s.type === 'artist'){
    if(!hasQuery) return render(box, empty('quem você quer achar?', 'digite o nome de um artista ou banda.'));
    let list = s.artists;
    if(!list.length && !s.loading){
      const seen = new Set();
      list = localSearch('', s.title || s.artist).filter(i => !seen.has(i.artist) && seen.add(i.artist)).map(i => ({ name: i.artist, genre: i.genre }));
    }
    render(box, html`
      ${list.length ? html`<div class="people">${list.map(ar => html`
        <div class="person">
          <span class="avatar" style="--size:46px">${ar.name[0].toUpperCase()}</span>
          <button class="who" type="button" data-search="artist" data-name="${ar.name}"><span class="n">${ar.name}</span><span class="s">${ar.genre} · artista/banda</span></button>
          <div class="acts"><button class="btn btn-sm" type="button" data-search="artist" data-name="${ar.name}">Ver fitas</button></div>
        </div>`)}</div>` : s.loading ? '' : empty('ninguém com esse nome', 'confira a grafia ou tente só o sobrenome.')}
      ${s.loading ? html`<div class="tape-list" style="margin-top:8px">${skeletonList(3, 72)}</div>` : ''}
    `);
    return;
  }

  if(!hasQuery){
    // sem termo: sugestões mais bem avaliadas da comunidade + playlists
    const scored = new Map();
    communityReviews.forEach(r => scored.set(r.itemId, (scored.get(r.itemId) || 0) + r.rating));
    let sugg = allItems().filter(i => s.type === 'all' || i.type === s.type);
    sugg = sugg.sort((a, b) => (scored.get(b.id) || 0) - (scored.get(a.id) || 0)).slice(0, 12);
    return render(box, html`<div class="divider-label"><span class="eyebrow">sugestões</span></div><div class="tape-list">${sugg.map(i => tapeRow(i))}</div>`);
  }

  const local = localSearch(s.title, s.artist, s.type);
  const seen = new Set(local.map(i => i.id));
  const list = local.concat(s.live.filter(i => !seen.has(i.id) && (s.type === 'all' || i.type === s.type)));
  render(box, html`
    ${list.length ? html`<div class="tape-list">${list.slice(0, 60).map(i => tapeRow(i))}</div>` : s.loading ? '' : empty('nada encontrado', DEMO ? 'na demonstração a busca olha só o catálogo de exemplo. No app real ela procura no catálogo inteiro do iTunes.' : 'tente outro termo ou outro filtro.')}
    ${s.loading ? html`<div class="tape-list" style="margin-top:8px">${skeletonList(3, 92)}</div>` : ''}
  `);
}

async function live(){
  const term = [s.title.trim(), s.artist.trim()].filter(Boolean).join(' ');
  if(!term || DEMO){ s.loading = false; results(); return; }
  const seq = ++s.seq;
  s.loading = true;
  results();
  try{
    if(s.type === 'artist'){
      const { results: raw } = await api('/itunes/search' + q({ term, entity: 'musicArtist' }));
      if(seq !== s.seq) return;
      s.artists = raw.map(mapItunesArtist).filter(Boolean);
    }else if(s.type !== 'playlist'){
      const entities = s.type === 'single' ? ['song'] : s.type === 'album' ? ['album'] : ['album', 'song'];
      const groups = await Promise.all(entities.map(en => api('/itunes/search' + q({ term, entity: en })).then(r => r.results).catch(() => [])));
      if(seq !== s.seq) return;
      s.live = groups.flat().map(mapItunesResult).filter(Boolean).map(registerItem);
    }
  }catch(e){ /* fica só com o resultado local */ }
  if(seq !== s.seq) return;
  s.loading = false;
  results();
}
const liveDebounced = debounce(live, 350);

export function mount(root){
  rootEl = root;
  render(root, html`
    <header class="page-head">
      <span class="eyebrow">catálogo</span>
      <h1 class="h-display">Buscar</h1>
      <p>músicas, álbuns, playlists e artistas — achou, registra.</p>
    </header>
    <form class="form" style="gap:10px;margin-bottom:14px" role="search" id="searchForm">
      <div class="input-icon">
        ${icon('search')}
        <label class="sr-only" for="searchTitle">Nome da música ou álbum</label>
        <input class="input" id="searchTitle" type="search" placeholder="nome da música ou álbum" value="${s.title}" autocomplete="off">
      </div>
      <div class="input-icon">
        ${icon('user')}
        <label class="sr-only" for="searchArtist">Artista ou banda</label>
        <input class="input" id="searchArtist" type="search" placeholder="artista ou banda (opcional)" value="${s.artist}" autocomplete="off">
      </div>
      <div class="chip-row" role="tablist" aria-label="Tipo">
        ${TYPES.map(([t, l]) => html`<button class="chip ${s.type === t ? 'on' : ''}" type="button" role="tab" aria-selected="${s.type === t}" data-search="type" data-type="${t}">${l}</button>`)}
      </div>
    </form>
    <div id="searchResults"></div>
  `);

  $('#searchForm', root).addEventListener('submit', (e) => { e.preventDefault(); live(); });
  $('#searchTitle', root).addEventListener('input', (e) => { s.title = e.target.value; s.live = []; results(); liveDebounced(); });
  $('#searchArtist', root).addEventListener('input', (e) => { s.artist = e.target.value; s.live = []; results(); liveDebounced(); });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-search]');
    if(!b) return;
    if(b.dataset.search === 'type'){
      s.type = b.dataset.type;
      root.querySelectorAll('[data-search="type"]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      results();
      live();
    }
    if(b.dataset.search === 'artist') presetSearch({ title: '', artist: b.dataset.name });
  });

  results();
  if((s.title || s.artist) && !s.live.length && !s.artists.length) live();
  if(!s.title && !s.artist) setTimeout(() => { const i = $('#searchTitle', root); if(i && matchMedia('(min-width: 700px)').matches) i.focus(); }, 50);
}
