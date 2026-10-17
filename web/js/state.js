// estado compartilhado do app + eventos simples (on/emit)
import { api, ApiError } from './api.js';
import { storage, toast } from './dom.js';
import { mergeSnapshot, parseItemId, getItem } from './items.js';
import { reviewers, communityReviews } from './data.js';

export const state = {
  me: null,            // pessoa logada (ou null)
  diary: [],           // escutas da pessoa logada, mais recentes primeiro
  unread: 0,           // notificações não lidas
  unreadMessages: 0,   // mensagens não lidas
  people: new Map(),   // perfis públicos já carregados, por username
};

// ---------- eventos ----------
const listeners = new Map();
export function on(evt, fn){
  if(!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
}
export function emit(evt, data){
  (listeners.get(evt) || []).forEach(fn => { try{ fn(data); }catch(e){ console.error(e); } });
}

// ---------- sessão ----------
let sessionGen = 0; // muda a cada login/logout — resposta atrasada não sobrescreve sessão nova

export async function loadSession(){
  const gen = ++sessionGen;
  try{
    const { user } = await api('/auth/me');
    if(gen === sessionGen) state.me = user;
  }catch(e){
    // só desloga em 401 de verdade — numa queda de rede mantém quem estava logado
    if(e instanceof ApiError && e.status === 401 && gen === sessionGen) state.me = null;
  }
  return state.me;
}

export function setMe(user){
  sessionGen++;
  state.me = user;
  emit('me', user);
}

export async function logout(){
  try{ await api('/auth/logout', { method: 'POST' }); }catch(e){ /* limpa localmente de qualquer jeito */ }
  sessionGen++;
  state.me = null;
  state.diary = [];
  state.unread = 0;
  state.unreadMessages = 0;
  state.people.clear();
  stopPolling();
  emit('me', null);
  emit('counts');
}

export async function updateMe(fields){
  const { user } = await api('/users/me', { method: 'PATCH', body: fields });
  setMe(user);
  return user;
}

// ---------- diário ----------
export function toDiaryEntry(e){
  mergeSnapshot(e);
  return {
    id: e.id,
    itemId: parseItemId(e.itemId),
    itemType: e.itemType,
    rating: e.rating,
    note: e.note || '',
    date: new Date(e.createdAt).getTime(),
    comments: e.comments || [],
    reactions: e.reactions || { counts: {}, mine: null },
  };
}

export async function loadDiary(){
  if(!state.me){ state.diary = []; return; }
  try{
    const { entries } = await api('/diary/me?limit=500');
    state.diary = entries.map(toDiaryEntry);
  }catch(e){
    state.diary = [];
  }
  emit('diary');
}

export async function addEntry(item, rating, note){
  const { entry } = await api('/diary', {
    method: 'POST',
    body: {
      itemId: String(item.id), itemType: item.type, rating, note,
      title: item.title, artist: item.artist, genre: item.genre, year: item.year ? String(item.year) : null,
      sp: item.sp || null, previewUrl: item.previewUrl || null,
    },
  });
  const e = toDiaryEntry(entry);
  state.diary.unshift(e);
  emit('diary');
  return e;
}

export async function editEntry(id, rating, note){
  const { entry } = await api(`/diary/${id}`, { method: 'PATCH', body: { rating, note: note || null } });
  const local = state.diary.find(e => e.id === id);
  if(local){ local.rating = entry.rating; local.note = entry.note || ''; }
  emit('diary');
  return entry;
}

export async function deleteEntry(id){
  await api(`/diary/${id}`, { method: 'DELETE' });
  state.diary = state.diary.filter(e => e.id !== id);
  emit('diary');
}

// afinidade: nota conta como sinal base; escrever sobre reforça bem mais
export function affinity(){
  const genre = {}, artist = {};
  state.diary.forEach(e => {
    const item = getItem(e.itemId);
    if(!item) return;
    const wrote = !!(e.note && e.note.trim());
    genre[item.genre] = (genre[item.genre] || 0) + e.rating + (wrote ? 3 : 0);
    artist[item.artist] = (artist[item.artist] || 0) + e.rating * 2 + (wrote ? 5 : 0);
  });
  return { genre, artist };
}

// ---------- comunidade Cassete (perfis de exemplo, só neste navegador) ----------
const COMMUNITY_FOLLOWS = 'cassete_community_follows';
export const isCommunity = (id) => String(id).startsWith('community:');

export function communityPerson(id){
  const idx = Number(String(id).split(':')[1]);
  const r = reviewers[idx];
  if(!r) return null;
  return {
    id, username: r.name, avatar: null, community: true, nationality: null, genres: [],
    reviews: communityReviews.filter(cr => cr.user === idx),
  };
}

export function isFollowing(id){
  if(isCommunity(id)) return new Set(storage.get(COMMUNITY_FOLLOWS, [])).has(id);
  return !!(state.me && (state.me.following || []).includes(id));
}

export async function toggleFollow(id){
  const now = !isFollowing(id);
  if(isCommunity(id)){
    const set = new Set(storage.get(COMMUNITY_FOLLOWS, []));
    now ? set.add(id) : set.delete(id);
    storage.set(COMMUNITY_FOLLOWS, [...set]);
  }else{
    const { user } = await api(`/users/${encodeURIComponent(id)}/follow`, { method: now ? 'POST' : 'DELETE' });
    cachePerson(user);
    const following = new Set(state.me.following || []);
    now ? following.add(id) : following.delete(id);
    state.me = { ...state.me, following: [...following] };
  }
  emit('follow', { id, following: now });
  return now;
}

export function cachePerson(u){
  if(u && u.username) state.people.set(u.username, u);
  return u;
}

export async function getPerson(username){
  if(state.people.has(username)) return state.people.get(username);
  try{
    const { user } = await api(`/users/${encodeURIComponent(username)}`);
    return cachePerson(user);
  }catch(e){
    return null;
  }
}

// ---------- notificações (checagem leve periódica) ----------
let pollTimer = null;
let latestNotifId = null;

export async function poll(){
  if(!state.me) return;
  try{
    const res = await api('/notifications/poll' + (latestNotifId ? `?after=${latestNotifId}` : ''));
    const firstRun = latestNotifId === null;
    latestNotifId = Math.max(latestNotifId || 0, res.latestId || 0, ...res.fresh.map(n => n.id));
    const changed = res.unread !== state.unread || res.unreadMessages !== state.unreadMessages;
    state.unread = res.unread;
    state.unreadMessages = res.unreadMessages;
    if(changed) emit('counts');
    if(!firstRun) res.fresh.forEach(n => emit('notification', n));
  }catch(e){ /* não é crítico — tenta de novo na próxima */ }
}

export function startPolling(ms){
  stopPolling();
  latestNotifId = null;
  poll();
  pollTimer = setInterval(() => { if(document.visibilityState === 'visible') poll(); }, ms);
}
export function stopPolling(){
  if(pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

export function reportError(e, prefix = ''){
  if(e && e.name === 'AbortError') return;
  toast((prefix ? prefix + ': ' : '') + (e && e.message ? e.message : 'algo deu errado.'), { error: true });
}
