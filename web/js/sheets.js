// folhas que podem ser abertas de qualquer tela
import { html, render, sheet, toast, $, fmtDate, fmtTime } from './dom.js';
import { api, q, mediaUrl } from './api.js';
import { icon } from './icons.js';
import { cassette } from './cassette.js';
import { playButton } from './player.js';
import { typeLabel, spotifyUrl } from './items.js';
import { state, addEntry, editEntry, getPerson, reportError, poll, emit } from './state.js';
import { avatar, stars } from './components.js';
import { communityReviews } from './data.js';
import { CHAT_POLL_MS, DEMO } from './config.js';

const STAR_WORDS = ['', 'não desceu', 'meh', 'boa', 'muito boa', 'obra-prima'];

// ---------- registrar (ou editar) uma escuta ----------
export function openLogSheet(item, { entry = null } = {}){
  if(!item) return;
  let rating = entry ? entry.rating : 0;
  const s = sheet(html`
    <div class="log-cassette">${cassette(item)}</div>
    <div class="eyebrow">${entry ? 'editar escuta' : 'registrar escuta'} · ${typeLabel(item)}</div>
    <h2>${item.title}</h2>
    <p class="muted" style="margin:0 0 18px">${item.artist}${item.year ? ' · ' + item.year : ''}</p>
    <form class="form" id="logForm">
      <div class="field">
        <span class="field-label" id="ratingLbl">Sua nota</span>
        <div class="star-pick" role="radiogroup" aria-labelledby="ratingLbl">
          ${[1, 2, 3, 4, 5].map(n => html`<button type="button" role="radio" data-n="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}: ${STAR_WORDS[n]}">★</button>`)}
          <span class="star-word" id="starWord"></span>
        </div>
      </div>
      <div class="field">
        <label for="logNote">O que ficou dessa escuta? <span class="muted">(opcional)</span></label>
        <textarea class="textarea" id="logNote" maxlength="5000" placeholder="um verso que grudou, onde você estava, o que sentiu...">${entry ? entry.note : ''}</textarea>
        <span class="hint">escrever conta mais pras suas recomendações do que só dar nota. Com texto, a escuta aparece nas Resenhas de quem te segue.</span>
      </div>
      <div class="sheet-actions">
        <button class="btn" type="button" data-sheet-close>Cancelar</button>
        <button class="btn btn-primary" type="submit" id="logSave" disabled>${entry ? 'Salvar' : 'Registrar no diário'}</button>
      </div>
    </form>
  `, { label: `Registrar ${item.title}` });

  const paint = () => {
    s.el.querySelectorAll('.star-pick button').forEach(b => {
      const n = Number(b.dataset.n);
      b.classList.toggle('on', n <= rating);
      b.setAttribute('aria-checked', String(n === rating));
    });
    $('#starWord', s.el).textContent = STAR_WORDS[rating] || '';
    $('#logSave', s.el).disabled = !rating;
  };
  paint();
  s.el.querySelector('.star-pick').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-n]');
    if(!b) return;
    rating = Number(b.dataset.n);
    paint();
  });
  $('#logForm', s.el).addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!rating) return;
    const btn = $('#logSave', s.el);
    btn.disabled = true;
    const note = $('#logNote', s.el).value.trim();
    try{
      if(entry){
        await editEntry(entry.id, rating, note);
        toast('escuta atualizada.');
      }else{
        await addEntry(item, rating, note);
        toast(`“${item.title}” entrou no seu diário.`);
      }
      s.close();
    }catch(err){
      btn.disabled = false;
      reportError(err, 'não deu pra salvar');
    }
  });
  setTimeout(() => s.el.querySelector('.star-pick button').focus(), 60);
}

// ---------- ficha da fita ----------
export function openItemSheet(item){
  if(!item) return;
  const community = communityReviews.filter(r => r.itemId === item.id);
  const avg = community.length ? (community.reduce((t, r) => t + r.rating, 0) / community.length).toFixed(1) : null;
  const mine = state.diary.filter(e => e.itemId === item.id);
  const sp = spotifyUrl(item);

  const s = sheet(html`
    <div class="log-cassette">${cassette(item)}</div>
    <div class="eyebrow">${typeLabel(item)} · ${item.genre}</div>
    <h2>${item.title}</h2>
    <div class="detail-meta">
      <span>${item.artist}</span>
      ${item.year ? html`<span class="num">${item.year}</span>` : ''}
      ${avg ? html`<span>★ ${avg} · ${community.length} resenha${community.length > 1 ? 's' : ''} da comunidade</span>` : ''}
    </div>
    ${mine.length ? html`<div class="card" style="padding:12px 14px;margin-bottom:16px">
      <div class="field-label" style="margin-bottom:6px">no seu diário</div>
      ${mine.map(e => html`<div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">${stars(e.rating)}<span class="muted" style="font-size:14px">${fmtDate(e.date)}</span></div>`)}
    </div>` : ''}
    <div class="actions-row">
      ${playButton(item, { cls: 'btn', label: 'Ouvir' })}
      <button class="btn btn-primary" type="button" data-act="log" data-id="${item.id}">${icon('star')} Registrar escuta</button>
      ${sp ? html`<a class="btn" href="${sp}" target="_blank" rel="noopener">${icon('external')} Spotify</a>` : ''}
    </div>
    <div class="credits" id="credits">
      <div class="field-label">ficha técnica</div>
      <div class="skeleton" style="height:120px"></div>
    </div>
  `, { label: item.title });

  // o botão "Registrar" dentro da ficha troca uma folha pela outra
  s.el.addEventListener('click', (e) => {
    if(e.target.closest('[data-act="log"]')){ e.stopPropagation(); s.close(); openLogSheet(item); }
  });
  loadCredits(item, $('#credits', s.el));
}

async function loadCredits(item, box){
  const fail = (msg) => render(box, html`<div class="field-label">ficha técnica</div><p class="muted" style="margin:0">${msg}</p>`);
  if(item.missing || item.type === 'playlist') return fail('sem ficha técnica pra esse item.');
  try{
    const data = await api('/credits' + q({ artist: item.artist, title: item.title }));
    if(!box.isConnected) return;
    if(!data.found) return fail('não encontramos a ficha técnica dessa fita no Discogs.');
    const credits = [
      ...(data.credits || []),
      ...(data.trackCredits || []).map(c => ({ name: c.name, role: `${c.role} · ${c.track}` })),
    ];
    const images = (data.images || []).map(mediaUrl).filter(Boolean);
    const photo = mediaUrl(data.artistPhoto);
    const discogs = mediaUrl(data.discogsUrl);
    render(box, html`
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap">
        <span class="field-label">ficha técnica</span>
        ${discogs ? html`<a class="link-btn" href="${discogs}" target="_blank" rel="noopener">ver no Discogs ↗</a>` : ''}
      </div>
      <div class="detail-meta" style="margin:0">
        ${data.label ? html`<span>selo: ${data.label}</span>` : ''}
        ${data.year ? html`<span>lançamento: ${data.year}</span>` : ''}
        ${(data.styles || []).length ? html`<span>${data.styles.join(', ')}</span>` : ''}
      </div>
      ${photo ? html`<div style="display:flex;gap:12px;align-items:center"><img src="${photo}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover"><b>${data.mainArtist || item.artist}</b></div>` : ''}
      ${credits.length ? html`<div class="credit-grid">${credits.slice(0, 40).map(c => html`<div class="credit"><div class="r">${c.role}</div><div class="n">${c.name}</div></div>`)}</div>`
        : html`<p class="muted" style="margin:0">sem créditos detalhados de quem toca o quê nesse lançamento.</p>`}
      ${images.length ? html`<div class="gallery">${images.map(src => html`<img src="${src}" alt="imagem do lançamento" loading="lazy">`)}</div>` : ''}
    `);
  }catch(e){
    if(!box.isConnected) return;
    fail(e.status === 503 ? 'a ficha técnica ainda não foi configurada no servidor.' : 'não deu pra carregar a ficha técnica agora.');
  }
}

// ---------- conversa ----------
export async function openChat(username){
  if(!state.me || !username) return;
  const person = await getPerson(username);
  const name = person ? person.username : username;
  let messages = [];
  let timer = null;
  let sending = false;

  const s = sheet(html`
    <div class="chat">
      <div class="chat-head">
        ${avatar(person || { username: name }, 40, { act: 'person' })}
        <div>
          <div class="n">${name}</div>
          <div class="hint">${person && person.nationality ? person.nationality : 'ouvinte'}</div>
        </div>
      </div>
      <div class="chat-body" id="chatBody" aria-live="polite"><div class="skeleton" style="height:40px;width:60%"></div></div>
      <form class="chat-form" id="chatForm">
        <label class="sr-only" for="chatInput">Mensagem</label>
        <input class="input" id="chatInput" maxlength="2000" autocomplete="off" placeholder="escreva uma mensagem..." autofocus>
        <button class="btn btn-primary btn-icon" type="submit" aria-label="Enviar">${icon('send')}</button>
      </form>
    </div>
  `, { label: `Conversa com ${name}`, onClose: () => { clearInterval(timer); emit('messages'); poll(); } });

  const body = $('#chatBody', s.el);
  const paint = () => {
    if(!messages.length){
      render(body, html`<div class="empty" style="margin:auto"><div class="hand">diga oi pra ${name}</div><p>que tal começar pela última fita que você ouviu?</p></div>`);
      return;
    }
    let lastDay = '';
    render(body, messages.map(m => {
      const day = fmtDate(m.createdAt, { day: '2-digit', month: 'long' });
      const sep = day !== lastDay ? html`<div class="eyebrow" style="text-align:center;margin:10px 0 4px">${day}</div>` : '';
      lastDay = day;
      return html`${sep}<div class="bubble ${m.fromMe ? 'me' : 'them'}"><div>${m.text}</div><div class="bt">${fmtTime(m.createdAt)}</div></div>`;
    }));
    body.scrollTop = body.scrollHeight;
  };

  try{
    ({ messages } = await api(`/messages/${encodeURIComponent(name)}`));
  }catch(e){
    reportError(e, 'não deu pra abrir a conversa');
  }
  paint();

  const refresh = async () => {
    if(s.closed || document.visibilityState !== 'visible' || sending) return;
    const last = messages.length ? messages[messages.length - 1].id : null;
    try{
      const res = await api(`/messages/${encodeURIComponent(name)}` + (last ? `?after=${last}` : ''));
      const fresh = last ? res.messages : res.messages.slice(messages.length);
      if(fresh.length){ messages = messages.concat(fresh.filter(m => !messages.some(x => x.id === m.id))); paint(); }
    }catch(e){ /* tenta de novo no próximo ciclo */ }
  };
  timer = setInterval(refresh, CHAT_POLL_MS);

  $('#chatForm', s.el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#chatInput', s.el);
    const text = input.value.trim();
    if(!text || sending) return;
    sending = true;
    input.value = '';
    try{
      const { message } = await api(`/messages/${encodeURIComponent(name)}`, { method: 'POST', body: { text } });
      messages.push(message);
      paint();
    }catch(err){
      if(!input.value) input.value = text; // não perde o que foi escrito
      reportError(err, 'não deu pra enviar');
    }
    sending = false;
    input.focus();
  });

  if(DEMO){
    // na demonstração, a outra pessoa "responde" pra dar vida à conversa
    s.el.addEventListener('submit', () => setTimeout(refresh, 1800));
  }
}

