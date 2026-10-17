// perfil de outra pessoa (real ou da comunidade de exemplo)
import { html, render, $ } from '../dom.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { cassette } from '../cassette.js';
import { playButton } from '../player.js';
import { state, getPerson, isCommunity, communityPerson } from '../state.js';
import { avatar, followBtn, msgBtn, stars, empty } from '../components.js';
import { getItemSafe, mergeSnapshot, parseItemId } from '../items.js';

function compatRing(score){
  const r = 40, c = 2 * Math.PI * r;
  return html`<svg class="compat-ring" viewBox="0 0 100 100" role="img" aria-label="${score}% de compatibilidade">
    <circle class="track" cx="50" cy="50" r="${r}" fill="none" stroke-width="9"/>
    <circle class="val" cx="50" cy="50" r="${r}" fill="none" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${(score / 100 * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/>
    <text x="50" y="59" text-anchor="middle">${score}%</text>
  </svg>`;
}

async function loadCompat(username, box){
  try{
    const d = await api(`/users/${encodeURIComponent(username)}/compatibility`);
    if(!box.isConnected) return;
    const word = d.score >= 70 ? 'almas gêmeas de fone' : d.score >= 40 ? 'dá pra dividir o fone' : d.score >= 15 ? 'gostos que se cruzam às vezes' : 'mundos bem diferentes';
    render(box, html`<div class="card compat">
      ${compatRing(d.score)}
      <div style="min-width:0">
        <span class="eyebrow">compatibilidade musical</span>
        <div class="hand" style="font-size:26px;line-height:1.1">${word}</div>
        <p>${d.shared.length ? `estilos em comum: ${d.shared.join(', ')}` : 'nenhum estilo favorito em comum ainda'}</p>
        ${d.sharedArtists && d.sharedArtists.length ? html`<p>vocês dois ouviram: ${d.sharedArtists.join(', ')}</p>` : ''}
      </div>
    </div>`);
  }catch(e){ box.remove(); }
}

export async function mount(root, { id }){
  render(root, html`<div class="skeleton" style="height:120px;margin-bottom:18px"></div><div class="skeleton" style="height:220px"></div>`);
  let person, entries = [];

  if(isCommunity(id)){
    person = communityPerson(id);
    if(person) entries = person.reviews.map(r => ({ itemId: r.itemId, rating: r.rating, note: r.text }));
  }else{
    person = await getPerson(id);
    if(person){
      try{
        const res = await api(`/diary/user/${encodeURIComponent(person.username)}`);
        res.entries.forEach(mergeSnapshot);
        entries = res.entries.map(e => ({ itemId: parseItemId(e.itemId), rating: e.rating, note: e.note, date: e.createdAt }));
      }catch(e){ entries = []; }
    }
  }
  if(!root.isConnected) return;
  if(!person){
    render(root, empty('esse perfil não existe (mais)', 'a pessoa pode ter mudado de nome ou apagado a conta.', html`<a class="btn" href="#/pessoas">Ver pessoas</a>`));
    return;
  }
  if(state.me && person.username === state.me.username){ location.replace('#/perfil'); return; }

  const pid = isCommunity(id) ? id : person.username;
  const last = entries[0] ? getItemSafe(entries[0].itemId) : null;
  const avg = entries.length ? (entries.reduce((t, e) => t + e.rating, 0) / entries.length).toFixed(1) : '—';

  render(root, html`
    <button class="btn btn-sm" type="button" data-person="back" style="margin-bottom:18px">${icon('back')} Voltar</button>
    <section class="profile-head">
      ${avatar(person, 92)}
      <div style="min-width:0">
        <h1>${person.username}</h1>
        <div class="sub">${person.community ? 'perfil de exemplo da comunidade Cassete' : (person.nationality || 'ouvinte')}</div>
        ${(person.genres || []).length ? html`<div class="genre-tags">${person.genres.map(g => html`<span>${g}</span>`)}</div>` : ''}
      </div>
    </section>
    <div class="stats">
      ${person.community ? '' : html`
        <div class="stat"><span class="v">${person.followerCount || 0}</span><span class="k">seguidores</span></div>
        <div class="stat"><span class="v">${person.followingCount || 0}</span><span class="k">seguindo</span></div>`}
      <div class="stat"><span class="v">${entries.length}</span><span class="k">escutas</span></div>
      <div class="stat"><span class="v">${avg}</span><span class="k">nota média</span></div>
    </div>
    <div class="actions-row">${followBtn(pid, { sm: false })}${msgBtn(pid, { sm: false })}</div>
    ${!person.community && state.me ? html`<div id="compatBox"></div>` : ''}
    ${last ? html`
      <section class="now-playing">
        <button class="mini" type="button" data-act="detail" data-id="${last.id}" style="background:none;border:0;padding:0">${cassette(last)}</button>
        <div style="min-width:0">
          <span class="eyebrow">última escuta registrada</span>
          <div class="t">${last.title}</div>
          <div class="a">${last.artist}</div>
          ${playButton(last, { cls: 'btn btn-sm', label: 'Ouvir' })}
        </div>
      </section>` : ''}
    <div class="divider-label"><span class="eyebrow">estante de ${person.username}</span></div>
    ${entries.length ? html`<div class="entries">${entries.map(e => {
      const it = getItemSafe(e.itemId);
      return html`<div class="entry">
        <button class="mini" type="button" data-act="detail" data-id="${it.id}" aria-label="Ficha de ${it.title}">${cassette(it, { size: 'sm' })}</button>
        <div class="body">
          <span class="t">${it.title}</span>
          <span class="a">${it.artist}</span>
          <div>${stars(e.rating)}</div>
          ${e.note ? html`<div class="note">${e.note}</div>` : ''}
          <div class="foot">
            ${playButton(it, { cls: 'btn btn-sm btn-icon' })}
            <button class="btn btn-sm" type="button" data-act="log" data-id="${it.id}">${icon('star')} Registrar também</button>
          </div>
        </div>
      </div>`;
    })}</div>` : empty('estante vazia', `${person.username} ainda não registrou nenhuma escuta.`)}
  `);

  root.addEventListener('click', (e) => {
    if(e.target.closest('[data-person="back"]')){
      if(history.length > 1) history.back(); else location.hash = '#/pessoas';
    }
  });
  const box = $('#compatBox', root);
  if(box) loadCompat(person.username, box);
}
