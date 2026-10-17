// Diário: o track listing das suas escutas
import { html, render, $, fmtDate, toast, confirmSheet } from '../dom.js';
import { icon } from '../icons.js';
import { cassette } from '../cassette.js';
import { playButton } from '../player.js';
import { state, deleteEntry, reportError } from '../state.js';
import { stars, empty } from '../components.js';
import { openLogSheet } from '../sheets.js';
import { getItem, getItemSafe } from '../items.js';

let rootEl = null;

function summary(){
  const d = state.diary;
  const avg = (d.reduce((t, e) => t + e.rating, 0) / d.length).toFixed(1);
  const genres = {};
  d.forEach(e => { const it = getItem(e.itemId); if(it) genres[it.genre] = (genres[it.genre] || 0) + 1; });
  const top = Object.keys(genres).sort((a, b) => genres[b] - genres[a])[0] || '—';
  const dist = [5, 4, 3, 2, 1].map(n => ({ n, c: d.filter(e => e.rating === n).length }));
  const max = Math.max(1, ...dist.map(x => x.c));
  const withNotes = d.filter(e => e.note).length;
  return html`
    <div class="diary-summary">
      <div class="stats" style="margin:0;grid-template-columns:1fr 1fr">
        <div class="stat"><span class="v">${d.length}</span><span class="k">fitas no diário</span></div>
        <div class="stat"><span class="v">${avg}</span><span class="k">nota média</span></div>
        <div class="stat"><span class="v small">${top}</span><span class="k">estilo que mais toca</span></div>
        <div class="stat"><span class="v">${withNotes}</span><span class="k">com resenha</span></div>
      </div>
      <div class="dist" aria-label="Distribuição das suas notas">
        <span class="field-label">suas notas</span>
        ${dist.map(x => html`<div class="dist-row"><span>${x.n}★</span><span class="dist-bar"><i style="width:${(x.c / max * 100).toFixed(0)}%"></i></span><span class="num" style="text-align:right">${x.c}</span></div>`)}
      </div>
    </div>
  `;
}

// "há um ano você ouviu..." — entradas de 1 ano atrás (±3 dias)
function memory(){
  const target = Date.now() - 365 * 86400000;
  const e = state.diary.find(x => Math.abs(x.date - target) < 3 * 86400000);
  if(!e) return '';
  const it = getItemSafe(e.itemId);
  return html`<section class="memory">
    <div style="width:84px">${cassette(it, { size: 'sm' })}</div>
    <div style="min-width:0">
      <span class="eyebrow">lembrança · ${fmtDate(e.date)}</span>
      <div class="hand">há um ano você ouviu ${it.title}</div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">${playButton(it, { cls: 'btn btn-sm', label: 'Ouvir de novo' })}<button class="btn btn-sm" type="button" data-act="log" data-id="${it.id}">${icon('star')} Registrar de novo</button></div>
    </div>
  </section>`;
}

function paint(){
  if(!rootEl || !rootEl.isConnected) return;
  const box = $('#diaryBody', rootEl);
  const d = state.diary;
  if(!d.length){
    render(box, empty('sua fita está em branco', 'registre a primeira escuta: escolha uma fita no Pra Você ou na Busca e dê uma nota.', html`<a class="btn btn-primary" href="#/">Escolher uma fita</a>`));
    return;
  }
  const sorted = [...d].sort((a, b) => b.date - a.date);
  const months = [];
  sorted.forEach((e, i) => {
    const key = fmtDate(e.date, { month: 'long', year: 'numeric' });
    if(!months.length || months[months.length - 1].key !== key) months.push({ key, list: [] });
    months[months.length - 1].list.push({ e, track: sorted.length - i });
  });
  render(box, html`
    ${memory()}
    ${summary()}
    ${months.map(m => html`
      <div class="divider-label month"><span class="h-section">${m.key}</span></div>
      <div class="entries">${m.list.map(({ e, track }) => {
        const it = getItemSafe(e.itemId);
        return html`<article class="entry">
          <button class="mini" type="button" data-act="detail" data-id="${it.id}" aria-label="Ficha de ${it.title}">${cassette(it, { size: 'sm' })}</button>
          <div class="body">
            <span class="track">lado A · faixa ${String(track).padStart(2, '0')}</span>
            <span class="t">${it.title}</span>
            <span class="a">${it.artist}</span>
            <div>${stars(e.rating)}</div>
            ${e.note ? html`<div class="note">${e.note}</div>` : ''}
            <div class="foot">
              <span class="date">${fmtDate(e.date)}</span>
              ${playButton(it, { cls: 'btn btn-sm btn-icon' })}
              <button class="btn btn-sm btn-icon" type="button" data-diary="edit" data-id="${e.id}" aria-label="Editar escuta">${icon('edit')}</button>
              <button class="btn btn-sm btn-icon" type="button" data-diary="delete" data-id="${e.id}" aria-label="Apagar escuta">${icon('trash')}</button>
            </div>
          </div>
        </article>`;
      })}</div>
    `)}
  `);
}

export function mount(root){
  rootEl = root;
  render(root, html`
    <header class="page-head">
      <span class="eyebrow">${state.me ? state.me.username : ''} · lado A</span>
      <h1 class="h-display">Seu diário</h1>
      <p>o track listing das suas escutas — um diário, não um contador de streams.</p>
    </header>
    <div id="diaryBody"></div>
  `);
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-diary]');
    if(!b) return;
    const entry = state.diary.find(x => x.id === Number(b.dataset.id));
    if(!entry) return;
    if(b.dataset.diary === 'edit') openLogSheet(getItemSafe(entry.itemId), { entry });
    if(b.dataset.diary === 'delete'){
      const ok = await confirmSheet({ title: 'Apagar essa escuta?', text: 'ela sai do seu diário junto com os comentários e reações.', confirmLabel: 'Apagar', danger: true });
      if(!ok) return;
      try{ await deleteEntry(entry.id); toast('escuta apagada.'); }
      catch(err){ reportError(err, 'não deu pra apagar'); }
    }
  });
  paint();
}

export function refresh(){ paint(); }
