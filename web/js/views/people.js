// Pessoas: encontrar e seguir outros ouvintes
import { html, render, $, debounce } from '../dom.js';
import { api, q } from '../api.js';
import { icon } from '../icons.js';
import { cachePerson, reportError } from '../state.js';
import { avatar, followBtn, msgBtn, empty, skeletonList } from '../components.js';
import { reviewers, communityReviews } from '../data.js';

let rootEl = null;
let term = '';
let seq = 0;

function row(p){
  const sub = p.community
    ? `${p.count} resenha${p.count === 1 ? '' : 's'} de exemplo`
    : [`${p.followerCount || 0} seguidor${p.followerCount === 1 ? '' : 'es'}`, p.nationality, (p.genres || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ');
  return html`
    <div class="person">
      ${avatar(p, 46, { act: 'person' })}
      <button class="who" type="button" data-act="person" data-user="${p.id}">
        <span class="n">${p.username}</span>
        <span class="s">${sub}</span>
      </button>
      <div class="acts">${followBtn(p.id)}${msgBtn(p.id)}</div>
    </div>
  `;
}

async function paint(){
  const box = $('#peopleList', rootEl);
  const mySeq = ++seq;
  render(box, html`<div class="people">${skeletonList(4, 72)}</div>`);
  let real = [];
  try{
    const { users } = await api('/users' + q({ search: term.trim() }));
    real = users.map(u => ({ ...cachePerson(u), id: u.username }));
  }catch(e){
    reportError(e, 'não deu pra carregar as pessoas');
  }
  if(mySeq !== seq || !box.isConnected) return;
  const t = term.trim().toLowerCase();
  const community = reviewers
    .map((r, i) => ({ id: 'community:' + i, username: r.name, avatar: null, community: true, count: communityReviews.filter(c => c.user === i).length }))
    .filter(p => !t || p.username.toLowerCase().includes(t));

  render(box, html`
    ${real.length ? html`<div class="divider-label"><span class="eyebrow">ouvintes no Cassete</span></div><div class="people">${real.map(row)}</div>` : ''}
    ${community.length ? html`<div class="divider-label"><span class="eyebrow">comunidade Cassete · perfis de exemplo</span></div><div class="people">${community.map(row)}</div>` : ''}
    ${!real.length && !community.length ? empty('ninguém com esse nome', 'confira a grafia — a busca é pelo nome de usuário.') : ''}
  `);
}

export function mount(root){
  rootEl = root;
  render(root, html`
    <header class="page-head">
      <span class="eyebrow">ouvintes</span>
      <h1 class="h-display">Pessoas</h1>
      <p>siga quem tem um gosto parecido (ou bem diferente) e acompanhe o que anda escutando.</p>
    </header>
    <div class="input-icon" style="margin-bottom:6px">
      ${icon('search')}
      <label class="sr-only" for="peopleSearch">Procurar pessoas</label>
      <input class="input" id="peopleSearch" type="search" placeholder="procurar pelo nome de usuário" value="${term}" autocomplete="off">
    </div>
    <div id="peopleList"></div>
  `);
  const go = debounce(paint, 250);
  $('#peopleSearch', root).addEventListener('input', (e) => { term = e.target.value; go(); });
  paint();
}
