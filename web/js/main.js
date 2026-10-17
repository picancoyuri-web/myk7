// ponto de entrada: casca do app, rotas (#/...), ações globais e eventos
import { DEMO, POLL_MS } from './config.js';
import { html, render, $, $$, toast, closeAllSheets } from './dom.js';
import { api } from './api.js';
import { icon } from './icons.js';
import { applyTheme } from './theme.js';
import { state, on, loadSession, loadDiary, startPolling, stopPolling, toggleFollow, isFollowing, reportError } from './state.js';
import { getItem } from './items.js';
import { play, close as closePlayer } from './player.js';
import { openLogSheet, openItemSheet, openChat } from './sheets.js';
import { avatar } from './components.js';
import { mountGate } from './views/auth.js';
import * as feed from './views/feed.js';
import * as reviews from './views/reviews.js';
import * as search from './views/search.js';
import * as people from './views/people.js';
import * as person from './views/person.js';
import * as diary from './views/diary.js';
import * as profile from './views/profile.js';
import { mountMessages, mountNotifications, notifText } from './views/inbox.js';
import './install.js';

applyTheme();
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyTheme());

const app = document.getElementById('app');

const ROUTES = {
  '': { title: 'Pra você', mount: feed.mount, refresh: feed.refresh },
  resenhas: { title: 'Resenhas', mount: reviews.mount, refresh: reviews.refresh, unmount: reviews.unmount },
  buscar: { title: 'Buscar', mount: search.mount },
  pessoas: { title: 'Pessoas', mount: people.mount },
  mensagens: { title: 'Mensagens', mount: mountMessages },
  avisos: { title: 'Notificações', mount: mountNotifications },
  diario: { title: 'Diário', mount: diary.mount, refresh: diary.refresh },
  perfil: { title: 'Perfil', mount: profile.mount, refresh: profile.refresh },
  u: { title: 'Perfil', mount: person.mount },
};

const NAV = [
  ['', 'home', 'Pra você', true],
  ['resenhas', 'reviews', 'Resenhas', true],
  ['buscar', 'search', 'Buscar'],
  ['pessoas', 'people', 'Pessoas'],
  ['mensagens', 'send', 'Mensagens'],
  ['avisos', 'bell', 'Notificações'],
  ['diario', 'book', 'Diário'],
  ['perfil', 'user', 'Perfil'],
];

let current = null; // { name, route, root, handle }

function parseHash(){
  const h = location.hash.replace(/^#\/?/, '');
  const [name, ...rest] = h.split('/');
  return { name: ROUTES[name] ? name : '', param: rest.length ? decodeURIComponent(rest.join('/')) : null };
}

function renderShell(){
  render(app, html`
    ${DEMO ? html`<div class="demo-ribbon">demonstração · dados de exemplo</div>` : ''}
    <header class="topbar">
      <div class="topbar-inner">
        <a class="wordmark" href="#/" aria-label="Cassete — início"><img src="icon-512.png" alt="" width="34" height="34"><span>Cassete</span></a>
        <nav class="top-tabs" aria-label="Seções">
          <a href="#/" data-nav="">Pra você</a>
          <a href="#/resenhas" data-nav="resenhas">Resenhas</a>
        </nav>
      </div>
    </header>
    <nav class="rail" aria-label="Navegação principal">
      ${NAV.map(([name, ic, label, wide]) => html`
        <a href="#/${name}" data-nav="${name}" ${wide ? html`data-wide` : ''} aria-label="${label}">
          ${icon(ic)}<span class="lbl">${label}</span>
          ${name === 'avisos' ? html`<span class="badge" id="badgeNotif" hidden></span>` : ''}
          ${name === 'mensagens' ? html`<span class="badge" id="badgeMsg" hidden></span>` : ''}
        </a>`)}
    </nav>
    <main class="main" id="view" tabindex="-1"></main>
  `);
  paintBadges();
}

function paintBadges(){
  const set = (id, n) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.hidden = !n;
    el.textContent = n > 9 ? '9+' : String(n);
  };
  set('badgeNotif', state.unread);
  set('badgeMsg', state.unreadMessages);
}

async function route(){
  if(!state.me || !$('#view')) return;
  closeAllSheets();
  const { name, param } = parseHash();
  const r = ROUTES[name];
  if(name === 'u' && !param){ location.replace('#/pessoas'); return; }
  if(current && current.route.unmount) current.route.unmount();

  const view = $('#view');
  const root = document.createElement('div');
  root.className = 'view-enter';
  view.replaceChildren(root);
  window.scrollTo({ top: 0 });
  $$('[data-nav]').forEach(a => {
    const on = a.dataset.nav === (name === 'u' ? 'pessoas' : name);
    a.classList.toggle('on', on);
    if(on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.title = `${r.title} · Cassete`;
  current = { name, route: r, root, handle: null };
  try{
    current.handle = await r.mount(root, { id: param });
  }catch(e){
    console.error(e);
    reportError(e, 'não deu pra abrir essa tela');
  }
}

function refreshCurrent(){
  if(!current || !current.root.isConnected) return;
  if(current.route.refresh) current.route.refresh();
}

async function startApp(){
  renderShell();
  await loadDiary();
  startPolling(POLL_MS);
  await route();
}

function showGate(opts = {}){
  stopPolling();
  closePlayer();
  current = null;
  document.title = 'Cassete — um diário de escuta';
  app.replaceChildren();
  mountGate(app, { ...opts, onDone: () => startApp() });
}

// ---------- ações que funcionam em qualquer tela (data-act) ----------
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if(!b) return;
  const act = b.dataset.act;
  if(act === 'play'){ e.preventDefault(); play(getItem(b.dataset.id)); }
  if(act === 'log'){ e.preventDefault(); openLogSheet(getItem(b.dataset.id)); }
  if(act === 'detail'){ e.preventDefault(); openItemSheet(getItem(b.dataset.id)); }
  if(act === 'chat'){ e.preventDefault(); openChat(b.dataset.user); }
  if(act === 'go'){ e.preventDefault(); location.hash = b.dataset.href; }
  if(act === 'person'){
    e.preventDefault();
    const id = b.dataset.user;
    if(state.me && id === state.me.username) location.hash = '#/perfil';
    else location.hash = '#/u/' + encodeURIComponent(id);
  }
  if(act === 'follow'){
    e.preventDefault();
    b.disabled = true;
    try{ await toggleFollow(b.dataset.id); }
    catch(err){ reportError(err, 'não deu pra seguir agora'); }
    b.disabled = false;
  }
});

// ---------- eventos do estado ----------
on('follow', ({ id }) => {
  const now = isFollowing(id);
  $$(`[data-act="follow"][data-id="${CSS.escape(id)}"]`).forEach(b => {
    b.classList.toggle('on', now);
    b.setAttribute('aria-pressed', String(now));
    b.textContent = now ? 'Seguindo' : 'Seguir';
  });
  if(current && current.name === 'perfil') refreshCurrent();
});
on('diary', refreshCurrent);
on('counts', paintBadges);
on('messages', () => { if(current && current.name === 'mensagens' && current.handle) current.handle.refresh(); });
on('me', (me) => {
  if(!me){ showGate(); return; }
  if(current && current.name === 'perfil') refreshCurrent();
});
on('notification', (n) => {
  if(current && current.name === 'avisos') return;
  const isMemory = n.type === 'memory';
  toast(notifText(n), {
    push: {
      title: isMemory ? 'lembrança musical' : (n.actor ? n.actor.username : 'Cassete'),
      avatar: !isMemory && n.actor ? avatar(n.actor, 34) : '',
      onClick: () => { location.hash = isMemory ? '#/diario' : n.actor ? '#/u/' + encodeURIComponent(n.actor.username) : '#/avisos'; },
    },
  });
});

window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible' && state.me) import('./state.js').then(m => m.poll());
});

// ---------- início ----------
(async () => {
  const params = new URLSearchParams(location.search);
  const resetToken = params.get('reset');
  const verifyToken = params.get('verify');

  await loadSession();

  if(verifyToken){
    try{ toast((await api('/auth/verify-email', { method: 'POST', body: { token: verifyToken } })).message); if(state.me) state.me.emailVerified = true; }
    catch(e){ reportError(e); }
    history.replaceState(null, '', location.pathname + location.hash);
  }

  if(resetToken) showGate({ mode: 'reset', resetToken });
  else if(!state.me) showGate();
  else startApp();

  if(!DEMO && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
    const register = () => navigator.serviceWorker.register('sw.js').catch(() => {});
    if(document.readyState === 'complete') register(); else window.addEventListener('load', register);
  }
})();
