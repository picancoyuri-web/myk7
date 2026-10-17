// Perfil da pessoa logada + configurações da conta
import { html, render, $, toast, sheet, confirmSheet, resizeImage, pickFile } from '../dom.js';
import { api } from '../api.js';
import { DEMO } from '../config.js';
import { icon } from '../icons.js';
import { cassette } from '../cassette.js';
import { playButton } from '../player.js';
import { state, updateMe, logout, reportError } from '../state.js';
import { avatar, empty } from '../components.js';
import { getItemSafe } from '../items.js';
import { famousGenres, countries } from '../data.js';
import { THEMES, getTheme, setTheme } from '../theme.js';
import { installPrompt, promptInstall } from '../install.js';

let rootEl = null;

function paint(){
  if(!rootEl || !rootEl.isConnected || !state.me) return;
  const me = state.me;
  const d = [...state.diary].sort((a, b) => b.date - a.date);
  const last = d[0] ? getItemSafe(d[0].itemId) : null;
  const avg = d.length ? (d.reduce((t, e) => t + e.rating, 0) / d.length).toFixed(1) : '—';
  const seen = new Set();
  const shelf = d.map(e => getItemSafe(e.itemId)).filter(it => !seen.has(it.id) && seen.add(it.id));

  render(rootEl, html`
    ${!me.emailVerified ? html`<div class="verify-banner">
      <span>confirme seu e-mail (<b>${me.email}</b>) pra conseguir recuperar a conta se esquecer a senha.</span>
      <button class="btn btn-sm" type="button" data-profile="resend">Reenviar link</button>
    </div>` : ''}
    ${installPrompt() ? html`<div class="install"><span>instale o Cassete na tela inicial — abre rápido e funciona até sem internet.</span><button class="btn btn-sm btn-solid" type="button" data-profile="install">${icon('download')} Instalar</button></div>` : ''}
    <section class="profile-head">
      <button type="button" data-profile="photo" style="background:none;border:0;padding:0;border-radius:50%" aria-label="Trocar foto de perfil">${avatar(me, 92)}</button>
      <div style="min-width:0">
        <h1>${me.username}</h1>
        <div class="sub">${me.nationality || ''}${me.createdAt ? ` · no Cassete desde ${new Date(me.createdAt).getFullYear()}` : ''}</div>
        <div class="genre-tags">${(me.genres || []).map(g => html`<span>${g}</span>`)}</div>
      </div>
    </section>
    <div class="stats">
      <div class="stat"><span class="v">${(me.followers || []).length}</span><span class="k">seguidores</span></div>
      <div class="stat"><span class="v">${(me.following || []).length}</span><span class="k">seguindo</span></div>
      <div class="stat"><span class="v">${d.length}</span><span class="k">fitas</span></div>
      <div class="stat"><span class="v">${avg}</span><span class="k">nota média</span></div>
    </div>
    <div class="actions-row">
      <button class="btn btn-sm" type="button" data-profile="photo">${icon('camera')} ${me.avatar ? 'Trocar foto' : 'Pôr foto'}</button>
      ${me.avatar ? html`<button class="btn btn-sm" type="button" data-profile="photo-remove">Remover foto</button>` : ''}
      <button class="btn btn-sm" type="button" data-profile="edit">${icon('edit')} Editar perfil</button>
    </div>

    <section class="now-playing">
      ${last ? html`<button class="mini" type="button" data-act="detail" data-id="${last.id}" style="background:none;border:0;padding:0">${cassette(last)}</button>`
        : html`<div class="mini">${cassette({ id: 'vazia', title: 'fita virgem', artist: 'sua próxima escuta', type: 'album', year: '' })}</div>`}
      <div style="min-width:0">
        <span class="eyebrow">última escuta</span>
        <div class="t">${last ? last.title : 'nada ainda'}</div>
        <div class="a">${last ? last.artist : 'registre uma escuta pra começar a sua estante'}</div>
        ${last ? playButton(last, { cls: 'btn btn-sm', label: 'Ouvir' }) : html`<a class="btn btn-sm" href="#/">Escolher uma fita</a>`}
      </div>
    </section>

    <div class="divider-label"><span class="eyebrow">estante · ${shelf.length} fita${shelf.length === 1 ? '' : 's'}</span></div>
    ${shelf.length ? html`<div class="shelf">${shelf.slice(0, 48).map(it => html`
      <button class="shelf-item" type="button" data-act="detail" data-id="${it.id}">
        ${cassette(it)}
        <span class="t">${it.title}</span>
        <span class="a">${it.artist}</span>
      </button>`)}</div>` : empty('estante vazia', 'cada fita que você registrar aparece aqui.')}

    <nav class="settings" aria-label="Configurações da conta">
      <button type="button" data-profile="edit"><span>Editar país e estilos favoritos</span>${icon('chevron')}</button>
      <button type="button" data-profile="password"><span>Alterar senha</span>${icon('key')}</button>
      <button type="button" data-profile="theme"><span>Tema: <b>${THEMES[getTheme()]}</b></span>${icon('moon')}</button>
      <a href="#/pessoas"><span>Encontrar pessoas pra seguir</span>${icon('people')}</a>
      ${DEMO ? html`<button type="button" data-profile="reset-demo"><span>Reiniciar a demonstração</span>${icon('refresh')}</button>` : ''}
      <button type="button" data-profile="logout"><span>Sair</span>${icon('logout')}</button>
      <button type="button" class="danger" data-profile="delete"><span>Apagar minha conta</span>${icon('trash')}</button>
    </nav>
    <p class="hint" style="margin-top:14px">${me.email} · senha guardada com criptografia, sessão num cookie seguro.</p>
  `);
}

function editProfileSheet(){
  const me = state.me;
  const picked = new Set(me.genres || []);
  const s = sheet(html`
    <h2>Editar perfil</h2>
    <form class="form" id="editForm" style="margin-top:14px">
      <div class="field">
        <label for="editCountry">País</label>
        <select class="select" id="editCountry">${countries.map(c => html`<option ${c === me.nationality ? 'selected' : ''}>${c}</option>`)}</select>
      </div>
      <div class="field">
        <span class="field-label">Estilos favoritos</span>
        <div class="genre-pick">${famousGenres.map(g => html`<button type="button" class="chip ${picked.has(g) ? 'on' : ''}" data-g="${g}" aria-pressed="${picked.has(g)}">${g}</button>`)}</div>
      </div>
      <div class="form-msg" id="editMsg"></div>
      <div class="sheet-actions"><button class="btn" type="button" data-sheet-close>Cancelar</button><button class="btn btn-primary" type="submit">Salvar</button></div>
    </form>
  `, { label: 'Editar perfil' });
  s.el.querySelector('.genre-pick').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if(!b) return;
    picked.has(b.dataset.g) ? picked.delete(b.dataset.g) : picked.add(b.dataset.g);
    b.classList.toggle('on'); b.setAttribute('aria-pressed', String(picked.has(b.dataset.g)));
  });
  $('#editForm', s.el).addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!picked.size){ $('#editMsg', s.el).textContent = 'escolha pelo menos um estilo.'; return; }
    try{
      await updateMe({ nationality: $('#editCountry', s.el).value, genres: [...picked] });
      toast('perfil atualizado.');
      s.close();
    }catch(err){ $('#editMsg', s.el).textContent = err.message; }
  });
}

function passwordSheet(){
  const s = sheet(html`
    <h2>Alterar senha</h2>
    <form class="form" id="pwForm" style="margin-top:14px">
      <div class="field"><label for="pwCur">Senha atual</label><input class="input" id="pwCur" type="password" autocomplete="current-password" required autofocus></div>
      <div class="field"><label for="pwNew">Nova senha</label><input class="input" id="pwNew" type="password" autocomplete="new-password" minlength="8" required><span class="hint">pelo menos 8 caracteres. As outras sessões abertas são encerradas.</span></div>
      <div class="form-msg" id="pwMsg"></div>
      <div class="sheet-actions"><button class="btn" type="button" data-sheet-close>Cancelar</button><button class="btn btn-primary" type="submit">Alterar senha</button></div>
    </form>
  `, { label: 'Alterar senha' });
  $('#pwForm', s.el).addEventListener('submit', async (e) => {
    e.preventDefault();
    try{
      const { message } = await api('/auth/change-password', { method: 'POST', body: { currentPassword: $('#pwCur', s.el).value, newPassword: $('#pwNew', s.el).value } });
      toast(message);
      s.close();
    }catch(err){ $('#pwMsg', s.el).textContent = err.message; }
  });
}

function deleteSheet(){
  const s = sheet(html`
    <h2>Apagar sua conta?</h2>
    <p class="muted">isso apaga de vez seu diário, resenhas, comentários, mensagens e seguidores. Não dá pra desfazer.</p>
    <form class="form" id="delForm">
      <div class="field"><label for="delPw">Digite sua senha pra confirmar</label><input class="input" id="delPw" type="password" autocomplete="current-password" required autofocus></div>
      <div class="form-msg" id="delMsg"></div>
      <div class="sheet-actions"><button class="btn" type="button" data-sheet-close>Cancelar</button><button class="btn btn-danger" type="submit">Apagar conta</button></div>
    </form>
  `, { label: 'Apagar conta' });
  $('#delForm', s.el).addEventListener('submit', async (e) => {
    e.preventDefault();
    try{
      await api('/users/me', { method: 'DELETE', body: { password: $('#delPw', s.el).value } });
      s.close();
      toast('sua conta foi apagada.');
      await logout();
    }catch(err){ $('#delMsg', s.el).textContent = err.message; }
  });
}

async function onAction(act){
  if(act === 'photo'){
    const file = await pickFile();
    if(!file) return;
    try{ await updateMe({ avatar: await resizeImage(file, 320) }); toast('foto atualizada.'); }
    catch(e){ reportError(e, 'não deu pra trocar a foto'); }
  }
  if(act === 'photo-remove'){
    try{ await updateMe({ avatar: null }); }catch(e){ reportError(e); }
  }
  if(act === 'edit') editProfileSheet();
  if(act === 'password') passwordSheet();
  if(act === 'delete') deleteSheet();
  if(act === 'install') promptInstall().then(paint);
  if(act === 'theme'){
    const order = Object.keys(THEMES);
    setTheme(order[(order.indexOf(getTheme()) + 1) % order.length]);
    paint();
  }
  if(act === 'resend'){
    try{ toast((await api('/auth/resend-verification', { method: 'POST' })).message); }
    catch(e){ reportError(e); }
  }
  if(act === 'logout'){
    const ok = await confirmSheet({ title: 'Sair da sua conta?', text: 'seu diário continua salvo no servidor.', confirmLabel: 'Sair' });
    if(ok) logout();
  }
  if(act === 'reset-demo'){
    const ok = await confirmSheet({ title: 'Reiniciar a demonstração?', text: 'volta tudo ao estado inicial de exemplo.', confirmLabel: 'Reiniciar' });
    if(!ok) return;
    const { resetDemo } = await import('../demo.js');
    resetDemo();
    location.reload();
  }
}

export function mount(root){
  rootEl = root;
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-profile]');
    if(b){ e.preventDefault(); onAction(b.dataset.profile); }
  });
  paint();
}

export function refresh(){ paint(); }
