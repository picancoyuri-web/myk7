// Resenhas: o que quem você segue (ou a comunidade inteira) anda escrevendo
import { html, render, $, timeAgo, toast, confirmSheet, resizeImage, pickFile } from '../dom.js';
import { api, mediaUrl } from '../api.js';
import { icon } from '../icons.js';
import { cassette } from '../cassette.js';
import { playButton } from '../player.js';
import { state, reportError, deleteEntry } from '../state.js';
import { avatar, followBtn, stars, empty, skeletonList } from '../components.js';
import { openLogSheet } from '../sheets.js';
import { getItemSafe, mergeSnapshot, parseItemId, typeLabel } from '../items.js';
import { reviewers, communityReviews } from '../data.js';

const REACTIONS = ['❤️', '🔥', '😢', '😂', '🤯', '👏'];
const v = { tab: null, list: [], cursor: null, hasMore: true, loading: false, photos: new Map() };
let rootEl = null;
let observer = null;

function fromEntry(e){
  mergeSnapshot(e);
  const own = !!state.me && e.username === state.me.username;
  return {
    key: 'e' + e.id, kind: 'real', entryId: e.id, own,
    user: { username: e.username, avatar: e.avatar, id: e.username },
    item: getItemSafe(parseItemId(e.itemId)), rating: e.rating, text: e.note,
    time: new Date(e.createdAt).getTime(), comments: e.comments || [], reactions: e.reactions || { counts: {}, mine: null },
  };
}
function fromOwn(d){
  return {
    key: 'e' + d.id, kind: 'real', entryId: d.id, own: true,
    user: { username: state.me.username, avatar: state.me.avatar, id: state.me.username },
    item: getItemSafe(d.itemId), rating: d.rating, text: d.note, time: d.date,
    comments: d.comments, reactions: d.reactions, diaryRef: d,
  };
}
function fromCommunity(r, i){
  const who = reviewers[r.user];
  r.reactions = r.reactions || { counts: {}, mine: null };
  return {
    key: 'c' + i, kind: 'community', own: false,
    user: { username: who.name, avatar: null, id: 'community:' + r.user },
    item: getItemSafe(r.itemId), rating: r.rating, text: r.text, timeLabel: r.time + ' atrás',
    comments: r.comments, reactions: r.reactions,
  };
}

async function load(reset = false){
  if(reset){ v.list = []; v.cursor = null; v.hasMore = true; }
  if(!v.hasMore || v.loading) return;
  v.loading = true;
  paintMore();
  const path = v.tab === 'seguindo' ? '/diary/feed' : '/diary/recent';
  try{
    const { entries, nextCursor } = await api(path + `?limit=20${v.cursor ? `&before=${v.cursor}` : ''}`);
    let items = entries.map(fromEntry);
    if(v.tab === 'seguindo' && reset){
      // as suas próprias resenhas entram junto, na ordem do tempo
      items = items.concat(state.diary.filter(d => d.note).map(fromOwn)).sort((a, b) => b.time - a.time);
    }
    v.list = v.list.concat(items);
    v.cursor = nextCursor;
    v.hasMore = !!nextCursor;
    if(!v.hasMore && v.tab === 'todos') v.list = v.list.concat(communityReviews.map(fromCommunity));
  }catch(e){
    reportError(e, 'não deu pra carregar as resenhas');
    v.hasMore = false;
  }
  v.loading = false;
  paint();
}

function reactionsBar(r){
  const counts = r.reactions.counts || {};
  return html`<div class="reactions" data-reactions="${r.key}">
    ${REACTIONS.map(e => html`<button class="react ${r.reactions.mine === e ? 'on' : ''}" type="button" data-rv="react" data-key="${r.key}" data-emoji="${e}" aria-pressed="${r.reactions.mine === e}" aria-label="Reagir com ${e}"><span>${e}</span>${counts[e] ? html`<span class="n">${counts[e]}</span>` : ''}</button>`)}
  </div>`;
}

function comment(r, c, i){
  const photo = mediaUrl(c.photo);
  return html`<div class="comment" id="cm-${r.key}-${i}">
    <div><span class="who">${c.name}</span>${c.text || ''}</div>
    ${photo ? html`<img src="${photo}" alt="foto enviada por ${c.name}" loading="lazy">` : ''}
    <div class="meta">
      <button type="button" class="${c.liked ? 'liked' : ''}" data-rv="like" data-key="${r.key}" data-i="${i}" aria-pressed="${!!c.liked}">♥ ${Number(c.likes) || 0}</button>
      ${c.createdAt ? html`<span class="eyebrow" style="letter-spacing:.04em">${timeAgo(c.createdAt)}</span>` : ''}
      ${c.mine ? html`<button type="button" data-rv="edit-comment" data-key="${r.key}" data-i="${i}">editar</button>` : ''}
      ${c.mine || (r.own && c.id) ? html`<button type="button" data-rv="delete-comment" data-key="${r.key}" data-i="${i}">apagar</button>` : ''}
    </div>
  </div>`;
}

function card(r){
  const it = r.item;
  const pending = v.photos.get(r.key);
  const personAct = r.own ? null : 'person';
  return html`
    <article class="review" id="rv-${r.key}">
      ${avatar(r.user, 44, { act: personAct })}
      <div class="rv-body">
        <div class="rv-head">
          ${r.own ? html`<span class="rv-user">você</span>` : html`<button class="rv-user" type="button" data-act="person" data-user="${r.user.id}">${r.user.username}</button>`}
          <span class="rv-time">${r.timeLabel || timeAgo(r.time)}</span>
          ${r.kind === 'community' ? html`<span class="rv-tag">exemplo</span>` : ''}
          ${!r.own ? html`<span class="follow">${followBtn(r.user.id)}</span>` : ''}
        </div>
        <div class="tape-row" style="background:var(--bg-sunk)">
          <button class="mini" type="button" data-act="detail" data-id="${it.id}" aria-label="Ficha de ${it.title}">${cassette(it, { size: 'sm' })}</button>
          <button class="t-btn info" type="button" data-act="detail" data-id="${it.id}">
            <span class="t">${it.title}</span>
            <span class="a">${it.artist} · ${typeLabel(it)}${it.year ? ' · ' + it.year : ''}</span>
          </button>
          <div class="acts">${playButton(it, { cls: 'btn btn-icon btn-sm' })}</div>
        </div>
        <div>${stars(r.rating)}</div>
        <p class="rv-text">${r.text}</p>
        ${reactionsBar(r)}
        ${r.own ? html`<div class="rv-own">
          <button class="btn btn-sm" type="button" data-rv="edit" data-key="${r.key}">${icon('edit')} Editar</button>
          <button class="btn btn-sm btn-danger" type="button" data-rv="delete" data-key="${r.key}">${icon('trash')} Apagar</button>
        </div>` : ''}
        ${r.comments.length ? html`<div class="comments">${r.comments.map((c, i) => comment(r, c, i))}</div>` : ''}
        ${pending ? html`<div class="attach-preview"><img src="${pending}" alt="foto escolhida"><button class="link-btn" type="button" data-rv="unattach" data-key="${r.key}">remover foto</button></div>` : ''}
        <form class="comment-form" data-rv-form="${r.key}">
          <label class="sr-only" for="ci-${r.key}">Comentar</label>
          <input class="input" id="ci-${r.key}" maxlength="2000" placeholder="comentar essa escuta..." autocomplete="off">
          <button class="btn btn-icon btn-sm" type="button" data-rv="attach" data-key="${r.key}" aria-label="Anexar foto">${icon('camera')}</button>
          <button class="btn btn-sm btn-solid" type="submit">Enviar</button>
        </form>
      </div>
    </article>
  `;
}

function find(key){ return v.list.find(r => r.key === key); }

function repaintCard(key){
  const r = find(key);
  const el = rootEl && $('#rv-' + key, rootEl);
  if(!r || !el) return;
  const draft = $('#ci-' + key, el);
  const text = draft ? draft.value : '';
  const tmp = document.createElement('div');
  render(tmp, card(r));
  el.replaceWith(tmp.firstElementChild);
  const input = $('#ci-' + key, rootEl);
  if(input && text) input.value = text;
}

function paintMore(){
  const more = rootEl && $('#rvMore', rootEl);
  if(more) render(more, v.loading ? html`<div style="display:grid;gap:16px">${skeletonList(v.list.length ? 1 : 3, 300)}</div>` : '');
}

function paint(){
  const box = rootEl && $('#rvList', rootEl);
  if(!box) return;
  if(!v.list.length && !v.loading){
    render(box, v.tab === 'seguindo'
      ? empty('ninguém escreveu ainda', 'siga mais pessoas ou veja o que a comunidade toda anda ouvindo.', html`<button class="btn" type="button" data-rv="tab" data-tab="todos">Ver todas as resenhas</button>`)
      : empty('tudo em silêncio', 'seja a primeira pessoa a escrever sobre uma escuta.'));
  }else{
    render(box, v.list.map(card));
  }
  paintMore();
  if(observer) observer.disconnect();
  const sentinel = $('#rvSentinel', rootEl);
  if(v.hasMore && sentinel){
    observer = new IntersectionObserver((es) => { if(es[0].isIntersecting) load(); }, { rootMargin: '600px' });
    observer.observe(sentinel);
  }
}

async function onAction(b){
  const r = find(b.dataset.key);
  const act = b.dataset.rv;
  if(act === 'tab'){ switchTab(b.dataset.tab); return; }
  if(!r) return;

  if(act === 'react'){
    const emoji = b.dataset.emoji;
    if(r.kind === 'community'){
      const counts = { ...r.reactions.counts };
      if(r.reactions.mine) counts[r.reactions.mine] = Math.max(0, (counts[r.reactions.mine] || 1) - 1);
      const mine = r.reactions.mine === emoji ? null : emoji;
      if(mine) counts[mine] = (counts[mine] || 0) + 1;
      r.reactions = { counts, mine };
    }else{
      $$disable(r.key, true);
      try{ r.reactions = (await api(`/diary/${r.entryId}/react`, { method: 'POST', body: { emoji } })).reactions; }
      catch(e){ reportError(e, 'não deu pra reagir'); }
      if(r.diaryRef) r.diaryRef.reactions = r.reactions;
    }
    const bar = $(`[data-reactions="${r.key}"]`, rootEl);
    if(bar){ const tmp = document.createElement('div'); render(tmp, reactionsBar(r)); bar.replaceWith(tmp.firstElementChild); }
  }

  if(act === 'like'){
    const c = r.comments[Number(b.dataset.i)];
    if(!c) return;
    if(r.kind === 'community' || !c.id){ c.liked = !c.liked; c.likes = (c.likes || 0) + (c.liked ? 1 : -1); }
    else{
      b.disabled = true;
      try{ Object.assign(c, await api(`/diary/comments/${c.id}/like`, { method: 'POST' })); }
      catch(e){ reportError(e, 'não deu pra curtir'); }
    }
    repaintCard(r.key);
  }

  if(act === 'edit'){
    const entry = r.diaryRef || state.diary.find(d => d.id === r.entryId) || { id: r.entryId, rating: r.rating, note: r.text };
    openLogSheet(r.item, { entry });
  }

  if(act === 'delete'){
    const ok = await confirmSheet({ title: 'Apagar essa resenha?', text: 'a escuta sai do seu diário junto com os comentários e reações dela.', confirmLabel: 'Apagar', danger: true });
    if(!ok) return;
    try{
      await deleteEntry(r.entryId);
      v.list = v.list.filter(x => x !== r);
      paint();
      toast('resenha apagada.');
    }catch(e){ reportError(e, 'não deu pra apagar'); }
  }

  if(act === 'edit-comment'){
    const i = Number(b.dataset.i);
    const c = r.comments[i];
    const wrap = $(`#cm-${r.key}-${i}`, rootEl);
    render(wrap, html`<form class="comment-form" data-edit-comment="${r.key}" data-i="${i}">
      <label class="sr-only" for="ec-${r.key}-${i}">Editar comentário</label>
      <input class="input" id="ec-${r.key}-${i}" value="${c.text || ''}" maxlength="2000">
      <button class="btn btn-sm btn-solid" type="submit">Salvar</button>
      <button class="btn btn-sm" type="button" data-rv="cancel-edit" data-key="${r.key}">Cancelar</button>
    </form>`);
    $('input', wrap).focus();
  }
  if(act === 'cancel-edit') repaintCard(r.key);

  if(act === 'delete-comment'){
    const i = Number(b.dataset.i);
    const c = r.comments[i];
    const ok = await confirmSheet({ title: 'Apagar esse comentário?', confirmLabel: 'Apagar', danger: true });
    if(!ok) return;
    try{
      if(c.id) await api(`/diary/comments/${c.id}`, { method: 'DELETE' });
      r.comments.splice(i, 1);
      repaintCard(r.key);
    }catch(e){ reportError(e, 'não deu pra apagar'); }
  }

  if(act === 'attach'){
    const file = await pickFile();
    if(!file) return;
    try{ v.photos.set(r.key, await resizeImage(file, 960)); repaintCard(r.key); }
    catch(e){ reportError(e); }
  }
  if(act === 'unattach'){ v.photos.delete(r.key); repaintCard(r.key); }
}

function $$disable(key, on){
  rootEl.querySelectorAll(`[data-reactions="${key}"] button`).forEach(x => { x.disabled = on; });
}

async function onSubmit(form, e){
  e.preventDefault();
  if(form.dataset.editComment){
    const r = find(form.dataset.editComment);
    const c = r && r.comments[Number(form.dataset.i)];
    const text = $('input', form).value.trim();
    if(!c || !text) return;
    try{
      if(c.id) Object.assign(c, (await api(`/diary/comments/${c.id}`, { method: 'PATCH', body: { text } })).comment);
      else c.text = text;
      repaintCard(r.key);
    }catch(err){ reportError(err, 'não deu pra salvar'); }
    return;
  }
  const r = find(form.dataset.rvForm);
  if(!r) return;
  const input = $('input', form);
  const text = input.value.trim();
  const photo = v.photos.get(r.key) || null;
  if(!text && !photo) return;
  const btn = $('button[type="submit"]', form);
  btn.disabled = true;
  try{
    let c;
    if(r.kind === 'community') c = { name: state.me.username, text, photo, likes: 0, liked: false, mine: true, createdAt: new Date().toISOString() };
    else c = (await api(`/diary/${r.entryId}/comments`, { method: 'POST', body: { text, photo } })).comment;
    r.comments.push(c);
    v.photos.delete(r.key);
    input.value = '';
    repaintCard(r.key);
  }catch(err){
    reportError(err, 'não deu pra comentar');
    btn.disabled = false;
  }
}

function switchTab(tab){
  v.tab = tab;
  rootEl.querySelectorAll('[data-tab-btn]').forEach(x => { x.classList.toggle('on', x.dataset.tabBtn === tab); x.setAttribute('aria-selected', String(x.dataset.tabBtn === tab)); });
  load(true);
}

export function mount(root){
  rootEl = root;
  const followsSomeone = state.me && (state.me.following || []).length > 0;
  if(!v.tab) v.tab = followsSomeone ? 'seguindo' : 'todos';
  render(root, html`
    <header class="page-head">
      <span class="eyebrow">comunidade</span>
      <h1 class="h-display">Resenhas</h1>
      <p>o que a galera anda registrando — e o que ficou de cada escuta.</p>
    </header>
    <div class="seg" role="tablist" aria-label="De quem" style="margin-bottom:18px">
      <button type="button" role="tab" data-tab-btn="seguindo" class="${v.tab === 'seguindo' ? 'on' : ''}" aria-selected="${v.tab === 'seguindo'}">Quem eu sigo</button>
      <button type="button" role="tab" data-tab-btn="todos" class="${v.tab === 'todos' ? 'on' : ''}" aria-selected="${v.tab === 'todos'}">Todo mundo</button>
    </div>
    <div class="reviews" id="rvList"></div>
    <div id="rvMore" style="margin-top:16px"></div>
    <div id="rvSentinel"></div>
  `);
  root.addEventListener('click', (e) => {
    const tb = e.target.closest('[data-tab-btn]');
    if(tb){ if(tb.dataset.tabBtn !== v.tab) switchTab(tb.dataset.tabBtn); return; }
    const b = e.target.closest('[data-rv]');
    if(b){ e.preventDefault(); onAction(b); }
  });
  root.addEventListener('submit', (e) => {
    const f = e.target.closest('form');
    if(f) onSubmit(f, e);
  });
  load(true);
}

export function unmount(){
  if(observer) observer.disconnect();
  observer = null;
}

// suas resenhas mudaram em outro lugar (diário/folha de edição)
export function refresh(){
  if(!rootEl || !rootEl.isConnected) return;
  v.list.forEach(r => {
    if(!r.own) return;
    const d = state.diary.find(x => x.id === r.entryId);
    if(d){ r.rating = d.rating; r.text = d.note; }
  });
  v.list = v.list.filter(r => !r.own || state.diary.some(d => d.id === r.entryId && d.note));
  // uma resenha nova sua entra no topo
  const missing = state.diary.filter(d => d.note && !v.list.some(r => r.entryId === d.id));
  if(missing.length) v.list = missing.map(fromOwn).concat(v.list);
  paint();
}
