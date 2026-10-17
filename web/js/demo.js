// Modo demonstração: imita a API do Cassete inteira dentro do navegador, com
// pessoas e escutas de exemplo. Nada sai do aparelho; o estado fica no
// localStorage deste navegador (e some com "reiniciar demonstração").
import { ApiError } from './api.js';
import { storage } from './dom.js';
import { getItem } from './items.js';

const KEY = 'cassete_demo_v2';
const REACTIONS = new Set(['❤️', '🔥', '😢', '😂', '🤯', '👏']);
const DAY = 86400000;

const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

function snap(itemId){
  const it = getItem(itemId);
  return { item_id: String(itemId), item_type: it.type, title: it.title, artist: it.artist, genre: it.genre, year: String(it.year || ''), sp: it.sp || null, preview: null };
}

function seed(){
  const users = [
    { id: 1, username: 'voce.ouve', email: 'voce@exemplo.com', password: 'cassete123', nationality: 'Brasil', genres: ['MPB', 'Jazz', 'Indie/Alternativo', 'Soul'], avatar: null, verified: false, created: iso(200 * DAY) },
    { id: 2, username: 'marina.vinil', email: 'marina@exemplo.com', password: 'x', nationality: 'Brasil', genres: ['Jazz', 'Bossa Nova', 'MPB'], avatar: null, verified: true, created: iso(400 * DAY) },
    { id: 3, username: 'theo_lado_b', email: 'theo@exemplo.com', password: 'x', nationality: 'Portugal', genres: ['Hip-Hop/Rap', 'Soul', 'Funk'], avatar: null, verified: true, created: iso(300 * DAY) },
    { id: 4, username: 'duda.fm', email: 'duda@exemplo.com', password: 'x', nationality: 'Brasil', genres: ['Indie/Alternativo', 'Rock', 'Post-Punk'], avatar: null, verified: true, created: iso(150 * DAY) },
    { id: 5, username: 'rafa.k7', email: 'rafa@exemplo.com', password: 'x', nationality: 'Argentina', genres: ['Rock', 'Metal'], avatar: null, verified: true, created: iso(90 * DAY) },
    { id: 6, username: 'ana.lu', email: 'ana@exemplo.com', password: 'x', nationality: 'Estados Unidos', genres: ['R&B', 'Pop', 'Soul'], avatar: null, verified: true, created: iso(60 * DAY) },
  ];
  const follows = [[1, 2], [1, 3], [1, 4], [2, 1], [3, 1], [4, 2], [5, 1], [6, 3]];
  let eid = 0;
  const entry = (user, itemId, rating, note, ago) => ({ id: ++eid, user, ...snap(itemId), rating, note, created: iso(ago) });
  const entries = [
    entry(1, 7, 5, 'trilha de toda tarde de domingo aqui em casa. a voz do João parece que tá na sala.', 365 * DAY + 3600000),
    entry(1, 11, 5, 'Blue continua doendo do mesmo jeito. "A Case of You" no repeat.', 40 * DAY),
    entry(1, 135, 4, '', 21 * DAY),
    entry(1, 1, 5, 'So What às 7 da manhã muda o dia inteiro.', 9 * DAY),
    entry(1, 117, 4, 'a Olivia Dean tem uma calma que eu não sabia que precisava.', 3 * DAY),
    entry(1, 104, 4, '', 1 * DAY),
    entry(2, 7, 5, 'ouvi no vinil do meu avô. chorei na faixa 2, de novo.', 2 * 3600000),
    entry(3, 2, 5, 'Cada faixa é uma aula de arranjo. Revisitei três vezes essa semana.', 5 * 3600000),
    entry(4, 6, 4, 'Frio, seco, perfeito pra andar sozinho à noite.', 26 * 3600000),
    entry(2, 139, 5, 'compasso 5/4 e ainda assim dá vontade de dançar.', 2 * DAY),
    entry(3, 102, 4, 'impossível ficar parado, mesmo sem querer.', 3 * DAY),
    entry(4, 122, 4, 'a Olivia Rodrigo descobriu a guitarra e eu tô aqui pra isso.', 4 * DAY),
    entry(5, 22, 5, 'Battery abrindo o disco é covardia.', 5 * DAY),
    entry(6, 10, 5, 'Estrutura estranha, letras mais estranhas ainda — e funciona.', 6 * DAY),
  ];
  const comments = [
    { id: 1, entry: 2, user: 2, text: 'River também me pega toda vez.', photo: null, created: iso(39 * DAY) },
    { id: 2, entry: 4, user: 3, text: 'Freddie Freeloader é a minha favorita!', photo: null, created: iso(8 * DAY) },
    { id: 3, entry: 7, user: 1, text: 'que lindo isso do vinil do avô', photo: null, created: iso(3600000) },
  ];
  const likes = [[2, 1]];
  const reactions = [[2, 2, '❤️'], [2, 3, '😢'], [4, 4, '🔥'], [7, 1, '❤️'], [8, 4, '🔥'], [8, 1, '👏']];
  let mid = 0;
  const msg = (from, to, text, ago, read = true) => ({ id: ++mid, from, to, text, created: iso(ago), read });
  const messages = [
    msg(2, 1, 'oi! vi que você também curte Getz/Gilberto', 2 * DAY),
    msg(1, 2, 'demais! você já ouviu o Elis & Tom?', 2 * DAY - 600000),
    msg(2, 1, 'clássico. tô ouvindo agora por sua causa', 50 * 60000, false),
    msg(3, 1, 'manda uma recomendação de soul brasileiro?', 3 * DAY),
    msg(1, 3, 'Tim Maia Racional, vol. 1. confia.', 3 * DAY - 900000),
  ];
  let nid = 0;
  const notif = (user, actor, type, entryId, ago, read) => ({ id: ++nid, user, actor, type, entry: entryId, created: iso(ago), read });
  const notifications = [
    notif(1, 5, 'follow', null, 5 * DAY, true),
    notif(1, 2, 'comment', 2, 39 * DAY, true),
    notif(1, 3, 'comment', 4, 8 * DAY, true),
    notif(1, 4, 'reaction', 4, 7 * DAY, true),
    notif(1, 1, 'memory', 1, 3 * 3600000, false),
    notif(1, 2, 'listen', 7, 2 * 3600000, false),
  ];
  return { session: 1, users, follows, entries, comments, likes, reactions, messages, notifications, seq: { u: 6, e: eid, c: 3, m: mid, n: nid } };
}

let db = storage.get(KEY) || seed();
const save = () => storage.set(KEY, db);
export function resetDemo(){ db = seed(); save(); }

const fail = (status, msg) => { throw new ApiError(msg, status); };
const me = () => db.users.find(u => u.id === db.session) || null;
const needMe = () => me() || fail(401, 'sessão inválida ou expirada — entre de novo.');
const byName = (name) => db.users.find(u => u.username.toLowerCase() === String(name).toLowerCase()) || fail(404, 'pessoa não encontrada.');
const avatarOf = (u) => u.avatar || null;

function privateUser(u){
  return {
    username: u.username, email: u.email, emailVerified: u.verified, nationality: u.nationality,
    genres: u.genres, avatar: avatarOf(u), createdAt: u.created,
    followers: db.follows.filter(f => f[1] === u.id).map(f => db.users.find(x => x.id === f[0])).filter(Boolean).map(x => x.username),
    following: db.follows.filter(f => f[0] === u.id).map(f => db.users.find(x => x.id === f[1])).filter(Boolean).map(x => x.username),
  };
}
function publicUser(u){
  return {
    username: u.username, avatar: avatarOf(u), nationality: u.nationality, genres: u.genres,
    followerCount: db.follows.filter(f => f[1] === u.id).length,
    followingCount: db.follows.filter(f => f[0] === u.id).length,
    entryCount: db.entries.filter(e => e.user === u.id).length,
  };
}
function serializeEntry(e, viewer, withUser = false){
  const counts = {};
  db.reactions.filter(r => r[0] === e.id).forEach(r => { counts[r[2]] = (counts[r[2]] || 0) + 1; });
  const mine = viewer ? (db.reactions.find(r => r[0] === e.id && r[1] === viewer.id) || [])[2] || null : null;
  const out = {
    id: e.id, itemId: e.item_id, itemType: e.item_type, rating: e.rating, note: e.note || null, createdAt: e.created,
    title: e.title, artist: e.artist, genre: e.genre, year: e.year, sp: e.sp, previewUrl: e.preview,
    comments: db.comments.filter(c => c.entry === e.id).map(c => serializeComment(c, viewer)),
    reactions: { counts, mine },
  };
  if(withUser){ const u = db.users.find(x => x.id === e.user); out.username = u.username; out.avatar = avatarOf(u); }
  return out;
}
function serializeComment(c, viewer){
  const u = db.users.find(x => x.id === c.user);
  return {
    id: c.id, name: u ? u.username : '—', text: c.text || '', photo: c.photo, mine: !!viewer && viewer.id === c.user,
    likes: db.likes.filter(l => l[0] === c.id).length,
    liked: !!viewer && db.likes.some(l => l[0] === c.id && l[1] === viewer.id),
    createdAt: c.created,
  };
}
function notify(userId, actorId, type, entryId = null){
  if(userId === actorId && type !== 'memory') return;
  db.notifications.push({ id: ++db.seq.n, user: userId, actor: actorId, type, entry: entryId, created: new Date().toISOString(), read: false });
}
function page(list, query, limit = 20){
  const before = Number(query.get('before')) || null;
  const lim = Math.min(Number(query.get('limit')) || limit, 500);
  const rows = list.filter(e => !before || e.id < before).slice(0, lim);
  return { rows, nextCursor: rows.length === lim ? rows[rows.length - 1].id : null };
}
const entryById = (id) => db.entries.find(e => e.id === Number(id)) || fail(404, 'escuta não encontrada.');
const commentById = (id) => db.comments.find(c => c.id === Number(id)) || fail(404, 'comentário não encontrado.');
const newestFirst = (a, b) => b.id - a.id;

const REPLIES = ['boa! vou ouvir com calma hoje à noite', 'adorei a dica 🎧', 'nossa, faz tempo que não ouço isso', 'manda mais que eu tô sem nada novo', 'essa é das boas'];

const routes = [
  ['GET', /^\/auth\/me$/, () => ({ user: privateUser(needMe()) })],
  ['POST', /^\/auth\/login$/, ({ body }) => {
    const id = String(body.identifier || '').toLowerCase();
    const u = db.users.find(x => x.username.toLowerCase() === id || x.email.toLowerCase() === id);
    if(!u || u.password !== body.password) fail(401, 'usuário/e-mail ou senha incorretos. Na demonstração: voce.ouve / cassete123');
    db.session = u.id;
    return { user: privateUser(u) };
  }],
  ['POST', /^\/auth\/signup$/, ({ body }) => {
    if(!/^[a-zA-Z0-9_.]{3,30}$/.test(body.username || '')) fail(400, 'o nome de usuário precisa ter de 3 a 30 caracteres, só letras, números, ponto ou _.');
    if(db.users.some(u => u.username.toLowerCase() === body.username.toLowerCase() || u.email.toLowerCase() === String(body.email).toLowerCase())) fail(409, 'usuário ou e-mail já cadastrado.');
    if(String(body.password || '').length < 8) fail(400, 'a senha precisa ter pelo menos 8 caracteres.');
    const u = { id: ++db.seq.u, username: body.username, email: body.email, password: body.password, nationality: body.nationality, genres: body.genres || [], avatar: null, verified: false, created: new Date().toISOString() };
    db.users.push(u);
    db.session = u.id;
    return { user: privateUser(u) };
  }],
  ['POST', /^\/auth\/logout$/, () => { db.session = null; return null; }],
  ['POST', /^\/auth\/forgot-password$/, () => ({ ok: true, message: 'se esse e-mail existir na nossa base, você vai receber um link em instantes. (na demonstração nenhum e-mail é enviado)' })],
  ['POST', /^\/auth\/resend-verification$/, () => ({ ok: true, message: 'link reenviado (na demonstração, nenhum e-mail sai de verdade).' })],
  ['POST', /^\/auth\/verify-email$/, () => { const u = needMe(); u.verified = true; return { ok: true, message: 'e-mail confirmado!' }; }],
  ['POST', /^\/auth\/reset-password$/, () => fail(400, 'link inválido ou expirado — peça um novo.')],
  ['POST', /^\/auth\/change-password$/, ({ body }) => {
    const u = needMe();
    if(u.password !== body.currentPassword) fail(401, 'a senha atual está incorreta.');
    if(String(body.newPassword || '').length < 8) fail(400, 'a senha precisa ter pelo menos 8 caracteres.');
    u.password = body.newPassword;
    return { ok: true, message: 'senha alterada.' };
  }],

  ['GET', /^\/users$/, ({ query }) => {
    const m = needMe();
    const s = String(query.get('search') || '').toLowerCase();
    return { users: db.users.filter(u => u.id !== m.id && (!s || u.username.toLowerCase().includes(s))).map(publicUser) };
  }],
  ['PATCH', /^\/users\/me$/, ({ body }) => {
    const u = needMe();
    if(body.avatar !== undefined) u.avatar = body.avatar;
    if(body.nationality !== undefined) u.nationality = body.nationality;
    if(body.genres !== undefined){ if(!body.genres.length) fail(400, 'escolha pelo menos um estilo musical.'); u.genres = body.genres; }
    return { user: privateUser(u) };
  }],
  ['DELETE', /^\/users\/me$/, ({ body }) => {
    const u = needMe();
    if(u.password !== body.password) fail(401, 'senha incorreta.');
    resetDemo();
    db.session = null;
    return null;
  }],
  ['GET', /^\/users\/([^/]+)$/, ({ params }) => ({ user: publicUser(byName(params[0])) })],
  ['POST', /^\/users\/([^/]+)\/follow$/, ({ params }) => {
    const m = needMe(); const t = byName(params[0]);
    if(t.id === m.id) fail(400, 'você não pode seguir a si mesmo.');
    if(!db.follows.some(f => f[0] === m.id && f[1] === t.id)) db.follows.push([m.id, t.id]);
    return { user: publicUser(t) };
  }],
  ['DELETE', /^\/users\/([^/]+)\/follow$/, ({ params }) => {
    const m = needMe(); const t = byName(params[0]);
    db.follows = db.follows.filter(f => !(f[0] === m.id && f[1] === t.id));
    return { user: publicUser(t) };
  }],
  ['GET', /^\/users\/([^/]+)\/compatibility$/, ({ params }) => {
    const m = needMe(); const t = byName(params[0]);
    const shared = m.genres.filter(g => t.genres.includes(g));
    const union = new Set([...m.genres, ...t.genres]).size || 1;
    const arts = (id) => new Set(db.entries.filter(e => e.user === id).map(e => e.artist.toLowerCase()));
    const a1 = arts(m.id), a2 = arts(t.id);
    const sharedArtists = [...a1].filter(a => a2.has(a));
    let score = shared.length / union;
    if(a1.size && a2.size) score = score * 0.6 + Math.min(1, sharedArtists.length / new Set([...a1, ...a2]).size * 2) * 0.4;
    const names = sharedArtists.map(k => db.entries.find(e => e.user === m.id && e.artist.toLowerCase() === k).artist);
    return { score: Math.round(score * 100), shared, sharedArtists: names, onlyMine: m.genres.filter(g => !t.genres.includes(g)), onlyTheirs: t.genres.filter(g => !m.genres.includes(g)) };
  }],

  ['POST', /^\/diary$/, ({ body }) => {
    const m = needMe();
    if(!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) fail(400, 'nota inválida.');
    const e = { id: ++db.seq.e, user: m.id, item_id: String(body.itemId), item_type: body.itemType, title: body.title, artist: body.artist, genre: body.genre, year: body.year || '', sp: body.sp || null, preview: body.previewUrl || null, rating: body.rating, note: (body.note || '').trim() || null, created: new Date().toISOString() };
    db.entries.push(e);
    return { entry: serializeEntry(e, m) };
  }],
  ['GET', /^\/diary\/me$/, ({ query }) => {
    const m = needMe();
    const { rows, nextCursor } = page(db.entries.filter(e => e.user === m.id).sort(newestFirst), query, 200);
    return { entries: rows.map(e => serializeEntry(e, m)), nextCursor };
  }],
  ['GET', /^\/diary\/feed$/, ({ query }) => {
    const m = needMe();
    const followed = new Set(db.follows.filter(f => f[0] === m.id).map(f => f[1]));
    const { rows, nextCursor } = page(db.entries.filter(e => followed.has(e.user) && e.note).sort(newestFirst), query);
    return { entries: rows.map(e => serializeEntry(e, m, true)), nextCursor };
  }],
  ['GET', /^\/diary\/recent$/, ({ query }) => {
    const m = needMe();
    const { rows, nextCursor } = page(db.entries.filter(e => e.note).sort(newestFirst), query);
    return { entries: rows.map(e => serializeEntry(e, m, true)), nextCursor };
  }],
  ['GET', /^\/diary\/user\/([^/]+)$/, ({ params }) => {
    const t = byName(params[0]);
    return { entries: db.entries.filter(e => e.user === t.id).sort(newestFirst).map(e => serializeEntry(e, me())) };
  }],
  ['PATCH', /^\/diary\/comments\/(\d+)$/, ({ params, body }) => {
    const m = needMe(); const c = commentById(params[0]);
    if(c.user !== m.id) fail(403, 'você só pode editar seus próprios comentários.');
    if(!String(body.text || '').trim()) fail(400, 'o comentário não pode ficar vazio.');
    c.text = body.text.trim();
    return { comment: serializeComment(c, m) };
  }],
  ['DELETE', /^\/diary\/comments\/(\d+)$/, ({ params }) => {
    const m = needMe(); const c = commentById(params[0]);
    const e = db.entries.find(x => x.id === c.entry);
    if(c.user !== m.id && !(e && e.user === m.id)) fail(403, 'você não pode apagar esse comentário.');
    db.comments = db.comments.filter(x => x.id !== c.id);
    return null;
  }],
  ['POST', /^\/diary\/comments\/(\d+)\/like$/, ({ params }) => {
    const m = needMe(); const c = commentById(params[0]);
    const had = db.likes.some(l => l[0] === c.id && l[1] === m.id);
    db.likes = had ? db.likes.filter(l => !(l[0] === c.id && l[1] === m.id)) : [...db.likes, [c.id, m.id]];
    return { liked: !had, likes: db.likes.filter(l => l[0] === c.id).length };
  }],
  ['PATCH', /^\/diary\/(\d+)$/, ({ params, body }) => {
    const m = needMe(); const e = entryById(params[0]);
    if(e.user !== m.id) fail(403, 'você só pode editar suas próprias escutas.');
    if(body.rating !== undefined) e.rating = body.rating;
    if(body.note !== undefined) e.note = (body.note || '').trim() || null;
    return { entry: serializeEntry(e, m) };
  }],
  ['DELETE', /^\/diary\/(\d+)$/, ({ params }) => {
    const m = needMe(); const e = entryById(params[0]);
    if(e.user !== m.id) fail(403, 'você só pode apagar suas próprias escutas.');
    db.entries = db.entries.filter(x => x.id !== e.id);
    db.comments = db.comments.filter(c => c.entry !== e.id);
    db.reactions = db.reactions.filter(r => r[0] !== e.id);
    return null;
  }],
  ['POST', /^\/diary\/(\d+)\/comments$/, ({ params, body }) => {
    const m = needMe(); const e = entryById(params[0]);
    const text = String(body.text || '').trim();
    if(!text && !body.photo) fail(400, 'escreva algo ou anexe uma foto.');
    const c = { id: ++db.seq.c, entry: e.id, user: m.id, text, photo: body.photo || null, created: new Date().toISOString() };
    db.comments.push(c);
    notify(e.user, m.id, 'comment', e.id);
    return { comment: serializeComment(c, m) };
  }],
  ['POST', /^\/diary\/(\d+)\/react$/, ({ params, body }) => {
    const m = needMe(); const e = entryById(params[0]);
    if(!REACTIONS.has(body.emoji)) fail(400, 'reação inválida.');
    const cur = db.reactions.find(r => r[0] === e.id && r[1] === m.id);
    db.reactions = db.reactions.filter(r => !(r[0] === e.id && r[1] === m.id));
    if(!cur || cur[2] !== body.emoji) db.reactions.push([e.id, m.id, body.emoji]);
    return { reactions: serializeEntry(e, m).reactions };
  }],

  ['GET', /^\/messages$/, () => {
    const m = needMe();
    const last = new Map();
    db.messages.filter(x => x.from === m.id || x.to === m.id).forEach(x => {
      const other = x.from === m.id ? x.to : x.from;
      if(!last.has(other) || last.get(other).id < x.id) last.set(other, x);
    });
    return { conversations: [...last.entries()].sort((a, b) => b[1].id - a[1].id).map(([other, x]) => {
      const u = db.users.find(y => y.id === other);
      return { username: u.username, avatar: avatarOf(u), lastText: x.text, lastAt: x.created, lastFromMe: x.from === m.id,
        unread: db.messages.filter(y => y.to === m.id && y.from === other && !y.read).length };
    }) };
  }],
  ['GET', /^\/messages\/([^/]+)$/, ({ params, query }) => {
    const m = needMe(); const o = byName(params[0]);
    const after = Number(query.get('after')) || 0;
    const thread = db.messages.filter(x => x.id > after && ((x.from === m.id && x.to === o.id) || (x.from === o.id && x.to === m.id)));
    db.messages.forEach(x => { if(x.to === m.id && x.from === o.id) x.read = true; });
    return { messages: thread.map(x => ({ id: x.id, text: x.text, fromMe: x.from === m.id, createdAt: x.created, read: x.read })) };
  }],
  ['POST', /^\/messages\/([^/]+)$/, ({ params, body }) => {
    const m = needMe(); const o = byName(params[0]);
    if(o.id === m.id) fail(400, 'você não pode mandar mensagem pra si mesmo.');
    const text = String(body.text || '').trim();
    if(!text) fail(400, 'escreva uma mensagem.');
    const x = { id: ++db.seq.m, from: m.id, to: o.id, text, created: new Date().toISOString(), read: true };
    db.messages.push(x);
    if(o.id !== 1 && o.password === 'x'){
      setTimeout(() => {
        db.messages.push({ id: ++db.seq.m, from: o.id, to: m.id, text: REPLIES[Math.floor(Math.random() * REPLIES.length)], created: new Date().toISOString(), read: false });
        save();
      }, 1200);
    }
    return { message: { id: x.id, text: x.text, fromMe: true, createdAt: x.created, read: true } };
  }],

  ['GET', /^\/notifications$/, () => {
    const m = needMe();
    return { notifications: db.notifications.filter(n => n.user === m.id).sort(newestFirst).map(serializeNotif) };
  }],
  ['GET', /^\/notifications\/poll$/, ({ query }) => {
    const m = needMe();
    const after = Number(query.get('after')) || 0;
    const mine = db.notifications.filter(n => n.user === m.id);
    return {
      unread: mine.filter(n => !n.read).length,
      unreadMessages: db.messages.filter(x => x.to === m.id && !x.read).length,
      latestId: mine.reduce((t, n) => Math.max(t, n.id), 0),
      fresh: after ? mine.filter(n => n.id > after).map(serializeNotif) : [],
    };
  }],
  ['POST', /^\/notifications\/read$/, () => { const m = needMe(); db.notifications.forEach(n => { if(n.user === m.id) n.read = true; }); return null; }],

  ['GET', /^\/itunes\/search$/, () => ({ results: [] })],
  ['GET', /^\/credits$/, () => ({ found: false })],
  ['GET', /^\/artist-info$/, () => ({ found: false })],
];

function serializeNotif(n){
  const a = db.users.find(u => u.id === n.actor);
  const e = db.entries.find(x => x.id === n.entry);
  return {
    id: n.id, type: n.type, actor: a ? { username: a.username, avatar: avatarOf(a) } : null,
    entryId: n.entry, entry: e ? { title: e.title, artist: e.artist } : null, read: n.read, createdAt: n.created,
  };
}

export async function handle(method, fullPath, body){
  await new Promise(r => setTimeout(r, 90 + Math.random() * 120)); // uma latência de rede de mentira
  const [path, qs] = fullPath.split('?');
  const query = new URLSearchParams(qs || '');
  for(const [m, re, fn] of routes){
    if(m !== method) continue;
    const match = path.match(re);
    if(!match) continue;
    const out = fn({ params: match.slice(1).map(decodeURIComponent), query, body: body || {} });
    save();
    return out === null ? null : JSON.parse(JSON.stringify(out));
  }
  fail(404, 'rota não encontrada.');
}
