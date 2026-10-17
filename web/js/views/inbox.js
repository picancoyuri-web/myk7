// Mensagens (lista de conversas) e Avisos (notificações)
import { html, render, timeAgo } from '../dom.js';
import { api } from '../api.js';
import { state, emit, reportError } from '../state.js';
import { avatar, empty, skeletonList } from '../components.js';

export async function mountMessages(root){
  render(root, html`
    <header class="page-head">
      <span class="eyebrow">correio</span>
      <h1 class="h-display">Mensagens</h1>
      <p>converse com outros ouvintes — recomendação boa chega por aqui.</p>
    </header>
    <div id="convs"><div class="list">${skeletonList(3, 70)}</div></div>
  `);
  const box = root.querySelector('#convs');
  const paint = async () => {
    let conversations = [];
    try{ ({ conversations } = await api('/messages')); }
    catch(e){ reportError(e, 'não deu pra carregar as conversas'); }
    if(!box.isConnected) return;
    render(box, conversations.length ? html`<div class="list">${conversations.map(c => html`
      <button class="list-row ${c.unread ? 'unread' : ''}" type="button" data-act="chat" data-user="${c.username}">
        ${avatar(c, 46)}
        <span style="min-width:0;display:grid;gap:2px">
          <span class="n">${c.username}</span>
          <span class="s">${c.lastFromMe ? 'você: ' : ''}${c.lastText}</span>
        </span>
        <span class="time">${timeAgo(c.lastAt)}${c.unread ? html`<span class="pill-count">${c.unread}</span>` : ''}</span>
      </button>`)}</div>`
      : empty('nenhuma conversa ainda', 'abra o perfil de alguém em Pessoas e mande a primeira mensagem.', html`<a class="btn" href="#/pessoas">Ver pessoas</a>`));
  };
  await paint();
  return { refresh: paint };
}

const NOTIF = {
  follow: { icon: '👋', text: 'começou a seguir você' },
  comment: { icon: '💬', text: 'comentou numa escuta sua' },
  like: { icon: '♥', text: 'curtiu seu comentário' },
  listen: { icon: '📼', text: 'registrou uma escuta nova' },
  reaction: { icon: '✨', text: 'reagiu a uma escuta sua' },
  memory: { icon: '🕰️', text: 'há 1 ano você registrou essa escuta — que tal ouvir de novo?' },
};
export function notifText(n){
  return (NOTIF[n.type] || { text: 'interagiu com você' }).text;
}

export async function mountNotifications(root){
  render(root, html`
    <header class="page-head">
      <span class="eyebrow">avisos</span>
      <h1 class="h-display">Notificações</h1>
      <p>quem seguiu, comentou, reagiu — e lembranças de um ano atrás.</p>
    </header>
    <div id="notifs"><div class="list">${skeletonList(4, 70)}</div></div>
  `);
  const box = root.querySelector('#notifs');
  let list = [];
  try{ ({ notifications: list } = await api('/notifications')); }
  catch(e){ reportError(e, 'não deu pra carregar as notificações'); }
  if(!box.isConnected) return;

  const row = (n) => {
    const meta = NOTIF[n.type] || { icon: '•' };
    const isMemory = n.type === 'memory';
    const target = isMemory ? html`data-act="go" data-href="#/diario"` : n.actor ? html`data-act="person" data-user="${n.actor.username}"` : '';
    return html`<button class="list-row ${n.read ? '' : 'unread'}" type="button" ${target}>
      ${isMemory || !n.actor ? html`<span class="notif-icon" aria-hidden="true">${meta.icon}</span>` : avatar(n.actor, 44)}
      <span style="min-width:0;display:grid;gap:2px">
        <span>${isMemory ? '' : html`<b>${n.actor ? n.actor.username : 'alguém'}</b> `}${notifText(n)}</span>
        ${n.entry ? html`<span class="s">${n.entry.title} — ${n.entry.artist}</span>` : ''}
      </span>
      <span class="time">${timeAgo(n.createdAt)}${n.read ? '' : html`<span class="dot" aria-label="não lida"></span>`}</span>
    </button>`;
  };
  const fresh = list.filter(n => !n.read);
  const old = list.filter(n => n.read);
  render(box, list.length ? html`
    ${fresh.length ? html`<div class="divider-label"><span class="eyebrow">novas</span></div><div class="list">${fresh.map(row)}</div>` : ''}
    ${old.length ? html`<div class="divider-label"><span class="eyebrow">anteriores</span></div><div class="list">${old.map(row)}</div>` : ''}
  ` : empty('nada por aqui ainda', 'quando alguém seguir você, comentar ou reagir a uma escuta, aparece nesta lista.'));

  if(fresh.length){
    try{
      await api('/notifications/read', { method: 'POST' });
      state.unread = 0;
      emit('counts');
    }catch(e){ /* tenta de novo da próxima vez */ }
  }
}
