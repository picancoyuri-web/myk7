// utilitários de interface: templates com escape automático, avisos,
// folhas (modais), datas e imagens.

class SafeHtml{
  constructor(s){ this.__html = s; }
  toString(){ return this.__html; }
}

const ESC = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
export function escapeHtml(v){
  return String(v ?? '').replace(/[&<>"']/g, ch => ESC[ch]);
}

function piece(v){
  if(v === null || v === undefined || v === false || v === true) return '';
  if(v instanceof SafeHtml) return v.__html;
  if(Array.isArray(v)) return v.map(piece).join('');
  return escapeHtml(v);
}

// html`<p>${texto}</p>` — tudo que é interpolado é escapado, a não ser que
// venha de outro html`` ou de raw(). Assim nenhum texto de usuário vira HTML.
export function html(strings, ...values){
  let out = strings[0];
  for(let i = 0; i < values.length; i++) out += piece(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}
export const raw = (s) => new SafeHtml(String(s));

export function render(el, tpl){
  el.innerHTML = piece(tpl);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------- armazenamento local (pode falhar em aba anônima etc.) ----------
export const storage = {
  get(key, fallback = null){
    try{ const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch(e){ return fallback; }
  },
  set(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){ /* sem armazenamento: segue sem lembrar */ }
  },
  remove(key){
    try{ localStorage.removeItem(key); }catch(e){ /* idem */ }
  },
};

// ---------- avisos ----------
function toastHost(){
  let host = $('#toasts');
  if(!host){
    host = document.createElement('div');
    host.id = 'toasts';
    host.className = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  return host;
}

export function toast(message, { error = false, push = null, ms = 3600 } = {}){
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' err' : '') + (push ? ' push' : '');
  if(push){
    render(el, html`${push.avatar || ''}<div><b>${push.title}</b><div class="muted">${message}</div></div>`);
    el.addEventListener('click', () => { dismiss(); push.onClick && push.onClick(); });
  }else{
    el.textContent = message;
  }
  toastHost().appendChild(el);
  const dismiss = () => {
    if(!el.isConnected) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 200);
  };
  setTimeout(dismiss, push ? 6000 : ms);
  return dismiss;
}

// ---------- folhas (modais que sobem de baixo) ----------
const openSheets = [];

export function sheet(content, { label = '', onClose = null, className = '' } = {}){
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  render(wrap, html`
    <div class="sheet-scrim"></div>
    <div class="sheet ${className}" role="dialog" aria-modal="true" aria-label="${label}" tabindex="-1">
      <div class="sheet-grip"></div>
      <button class="btn btn-icon btn-sm sheet-close" type="button" aria-label="Fechar" data-sheet-close>${raw(ICON_CLOSE)}</button>
      <div class="sheet-content"></div>
    </div>
  `);
  const panel = $('.sheet', wrap);
  const body = $('.sheet-content', wrap);
  render(body, content);

  const lastFocus = document.activeElement;
  let closed = false;
  const close = () => {
    if(closed) return;
    closed = true;
    wrap.classList.add('closing');
    panel.classList.add('closing');
    document.removeEventListener('keydown', onKey);
    const i = openSheets.indexOf(api); if(i >= 0) openSheets.splice(i, 1);
    if(!openSheets.length) document.body.style.overflow = '';
    setTimeout(() => wrap.remove(), 190);
    if(lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    onClose && onClose();
  };
  const onKey = (e) => { if(e.key === 'Escape' && openSheets[openSheets.length - 1] === api) close(); };

  wrap.addEventListener('click', (e) => {
    if(e.target.classList.contains('sheet-scrim') || e.target.closest('[data-sheet-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  const api = { el: body, panel, close, get closed(){ return closed; } };
  openSheets.push(api);
  requestAnimationFrame(() => {
    const first = $('[autofocus]', body);
    (first || panel).focus({ preventScroll: true });
  });
  return api;
}

export function closeAllSheets(){
  [...openSheets].forEach(s => s.close());
}

// confirmação dentro da página (o confirm() do navegador não funciona em
// todo lugar e é feio)
export function confirmSheet({ title, text = '', confirmLabel = 'Confirmar', danger = false }){
  return new Promise(resolve => {
    let answered = false;
    const s = sheet(html`
      <h2>${title}</h2>
      ${text ? html`<p class="muted">${text}</p>` : ''}
      <div class="sheet-actions">
        <button class="btn" type="button" data-sheet-close>Cancelar</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-ok autofocus>${confirmLabel}</button>
      </div>
    `, { label: title, onClose: () => { if(!answered) resolve(false); } });
    $('[data-ok]', s.el).addEventListener('click', () => { answered = true; resolve(true); s.close(); });
  });
}

// ---------- datas ----------
const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto', style: 'short' });
export function timeAgo(input){
  const t = typeof input === 'number' ? input : new Date(input).getTime();
  if(!t) return '';
  const s = Math.round((t - Date.now()) / 1000);
  const a = Math.abs(s);
  if(a < 45) return 'agora';
  if(a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if(a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if(a < 7 * 86400) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: a > 300 * 86400 ? 'numeric' : undefined });
}
export function fmtDate(t, opts = { day: '2-digit', month: 'short', year: 'numeric' }){
  return new Date(t).toLocaleDateString('pt-BR', opts);
}
export function fmtTime(t){
  return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ---------- imagens ----------
// reduz a foto escolhida no próprio aparelho antes de mandar (JPEG ~85%)
export function resizeImage(file, maxDim){
  return new Promise((resolve, reject) => {
    if(!file || !/^image\//.test(file.type)) return reject(new Error('escolha um arquivo de imagem.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('não deu pra ler essa imagem.')); };
    img.src = url;
  });
}

export function pickFile(accept = 'image/*'){
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files[0] || null), { once: true });
    input.click();
  });
}

export function normalizeText(s){
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function hashHue(s){
  let h = 0;
  s = String(s || '');
  for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
