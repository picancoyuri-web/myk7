// registro de "fitas" (álbuns, músicas e playlists) conhecidas pelo app:
// o catálogo fixo + o que veio de buscas no iTunes + o que veio do diário.
import { catalog, singles, playlists } from './data.js';
import { normalizeText, hashHue } from './dom.js';

const registry = new Map();
[...catalog, ...singles, ...playlists].forEach(item => registry.set(item.id, item));

export function parseItemId(v){
  return /^-?\d+$/.test(String(v)) ? Number(v) : String(v);
}

export function getItem(id){
  return registry.get(parseItemId(id)) || null;
}

// itens registrados que não estão mais no catálogo carregado (ex: uma busca
// antiga) — nunca quebra a tela, vira uma "fita indisponível"
export function getItemSafe(id){
  return getItem(id) || {
    id: parseItemId(id), type: 'single', title: 'fita indisponível', artist: '—',
    genre: 'Música', year: '', sp: null, previewUrl: null, missing: true,
  };
}

export function registerItem(item){
  if(item && !registry.has(item.id)) registry.set(item.id, item);
  return registry.get(item.id);
}

// entradas do diário trazem uma "foto" do item (título, artista...) — isso
// garante que itens vindos do iTunes continuem existindo depois de recarregar
export function mergeSnapshot(e){
  if(!e || !e.title) return;
  const id = parseItemId(e.itemId);
  if(registry.has(id)) return;
  registry.set(id, {
    id, type: e.itemType || 'single', title: e.title, artist: e.artist || '',
    genre: e.genre || 'Música', year: e.year || '', sp: e.sp || null, previewUrl: e.previewUrl || null,
  });
}

export function allItems(){
  return [...registry.values()];
}

export function mapItunesResult(r){
  const isAlbum = r.wrapperType === 'collection' || r.kind === 'album' || r.collectionType === 'Album';
  if(isAlbum && !r.collectionId) return null;
  if(!isAlbum && !r.trackId) return null;
  return {
    id: 'it' + (isAlbum ? r.collectionId : r.trackId),
    title: isAlbum ? r.collectionName : r.trackName,
    artist: r.artistName,
    year: r.releaseDate ? String(new Date(r.releaseDate).getFullYear()) : '',
    genre: r.primaryGenreName || 'Música',
    type: isAlbum ? 'album' : 'single',
    previewUrl: r.previewUrl || null,
    external: true,
  };
}

export function mapItunesArtist(r){
  if(!r.artistId) return null;
  return { id: 'ita' + r.artistId, name: r.artistName, genre: r.primaryGenreName || 'Música' };
}

export function typeLabel(item){
  if(item.type === 'album') return 'Álbum';
  if(item.type === 'playlist') return 'Playlist';
  return 'Música';
}

export function isPlayable(item){
  return !!(item && (item.previewUrl || item.sp));
}

export function itemHue(item){
  return hashHue(String(item.id || '') + (item.title || '') + (item.artist || ''));
}

// busca no que já está carregado (catálogo + buscas anteriores)
export function localSearch(title, artist, type = 'all'){
  const q = normalizeText(title.trim());
  const qa = normalizeText(artist.trim());
  let items = allItems();
  if(type !== 'all') items = items.filter(a => a.type === type);
  if(!q && !qa) return [];
  return items.filter(a =>
    (!q || normalizeText(a.title).includes(q) || normalizeText(a.artist).includes(q)) &&
    (!qa || normalizeText(a.artist).includes(qa))
  ).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
}

export function shuffle(list){
  const a = list.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function spotifyUrl(item){
  return item && item.sp ? `https://open.spotify.com/${item.sp.t}/${item.sp.id}` : null;
}
