// peças de interface usadas em várias telas
import { html, raw, hashHue } from './dom.js';
import { mediaUrl } from './api.js';
import { icon } from './icons.js';
import { cassette } from './cassette.js';
import { playButton } from './player.js';
import { typeLabel } from './items.js';
import { state, isFollowing, isCommunity } from './state.js';

export function avatar(person, size = 40, { act = null } = {}){
  const name = (person && (person.username || person.name)) || '?';
  const src = person ? mediaUrl(person.avatar) : '';
  const style = `--size:${size}px;--h:${hashHue(name)}`;
  const inner = src ? html`<img src="${src}" alt="" loading="lazy" decoding="async">` : name[0].toUpperCase();
  if(act) return html`<button class="avatar" type="button" style="${style}" data-act="${act}" data-user="${person.id || name}" aria-label="Ver perfil de ${name}">${inner}</button>`;
  return html`<span class="avatar" style="${style}" aria-hidden="true">${inner}</span>`;
}

export function followBtn(id, { sm = true } = {}){
  if(!state.me || id === state.me.username) return '';
  const on = isFollowing(id);
  return html`<button class="btn ${sm ? 'btn-sm' : ''} follow ${on ? 'on' : ''}" type="button" data-act="follow" data-id="${id}" aria-pressed="${on}">${on ? 'Seguindo' : 'Seguir'}</button>`;
}

export function msgBtn(id, { sm = true } = {}){
  if(!state.me || isCommunity(id) || id === state.me.username) return '';
  return html`<button class="btn ${sm ? 'btn-sm btn-icon' : ''}" type="button" data-act="chat" data-user="${id}" aria-label="Mandar mensagem">${icon('message')}${sm ? '' : ' Mensagem'}</button>`;
}

export function stars(n){
  const v = Math.max(0, Math.min(5, Number(n) || 0));
  return html`<span class="stars" aria-label="${v} de 5 estrelas">${'★'.repeat(v)}<span class="off">${'★'.repeat(5 - v)}</span></span>`;
}

export function empty(title, text = '', action = ''){
  return html`<div class="empty"><div class="hand">${title}</div>${text ? html`<p>${text}</p>` : ''}${action}</div>`;
}

// linha de fita: miniatura, título/artista e ações
export function tapeRow(item, { sub = null, log = true } = {}){
  return html`
    <div class="tape-row">
      <button class="mini" type="button" data-act="detail" data-id="${item.id}" aria-label="Detalhes de ${item.title}">${cassette(item, { size: 'sm' })}</button>
      <button class="t-btn info" type="button" data-act="detail" data-id="${item.id}">
        <span class="t">${item.title}</span>
        <span class="a">${sub !== null ? sub : html`${item.artist} · ${typeLabel(item)}${item.year ? ' · ' + item.year : ''}`}</span>
      </button>
      <div class="acts">
        ${playButton(item, { cls: 'btn btn-icon btn-sm' })}
        ${log ? html`<button class="btn btn-sm" type="button" data-act="log" data-id="${item.id}" aria-label="Registrar ${item.title}">${icon('star')}<span>Registrar</span></button>` : ''}
      </div>
    </div>
  `;
}

export function skeletonList(n = 4, h = 92){
  return raw(Array.from({ length: n }, () => `<div class="skeleton" style="height:${h}px"></div>`).join(''));
}
