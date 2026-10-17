// porta de entrada: entrar, criar conta (2 passos), esqueci a senha,
// redefinir senha (link do e-mail) e sugestões de quem seguir
import { html, render, $ } from '../dom.js';
import { api } from '../api.js';
import { DEMO } from '../config.js';
import { cassette } from '../cassette.js';
import { setMe, cachePerson } from '../state.js';
import { avatar, followBtn } from '../components.js';
import { famousGenres, countries } from '../data.js';

const HERO = { id: 'cassete', title: 'um diário de escuta', artist: 'não de streams', type: 'album', year: '' };

export function mountGate(root, { mode = 'login', resetToken = null, onDone }){
  const g = { mode, step: 1, signup: { username: '', email: '', password: '', nationality: '', genres: new Set() } };

  const shell = (inner) => html`
    <div class="gate">
      <div class="gate-box view-enter">
        <div class="gate-hero">
          ${cassette(HERO)}
          <h1>Cassete</h1>
          <p>um diário de escuta, não de streams.</p>
        </div>
        ${inner}
      </div>
    </div>`;

  const tabs = () => html`
    <div class="seg" role="tablist" aria-label="Entrar ou criar conta">
      <button type="button" role="tab" data-gate="mode" data-mode="login" class="${g.mode === 'login' ? 'on' : ''}" aria-selected="${g.mode === 'login'}">Entrar</button>
      <button type="button" role="tab" data-gate="mode" data-mode="signup" class="${g.mode === 'signup' ? 'on' : ''}" aria-selected="${g.mode === 'signup'}">Criar conta</button>
    </div>`;

  const paint = () => {
    if(g.mode === 'login'){
      render(root, shell(html`
        ${tabs()}
        <form class="form" id="gateForm">
          <div class="field"><label for="gId">Usuário ou e-mail</label><input class="input" id="gId" autocomplete="username" required autofocus value="${DEMO ? 'voce.ouve' : ''}"></div>
          <div class="field"><label for="gPw">Senha</label><input class="input" id="gPw" type="password" autocomplete="current-password" required value="${DEMO ? 'cassete123' : ''}"></div>
          <div class="form-msg" id="gMsg" role="alert"></div>
          <button class="btn btn-primary btn-block" type="submit">Entrar</button>
          <button class="link-btn" type="button" data-gate="mode" data-mode="forgot" style="justify-self:center">esqueci minha senha</button>
          ${DEMO ? html`<p class="hint" style="text-align:center;margin:0">demonstração: os dados de acesso já estão preenchidos.</p>` : ''}
        </form>
      `));
    }else if(g.mode === 'signup' && g.step === 1){
      const su = g.signup;
      render(root, shell(html`
        ${tabs()}
        <div class="steps" aria-label="Passo 1 de 2"><i class="on"></i><i></i></div>
        <form class="form" id="gateForm">
          <div class="field"><label for="gUser">Nome de usuário</label><input class="input" id="gUser" autocomplete="username" maxlength="30" pattern="[a-zA-Z0-9_.]{3,30}" required value="${su.username}" autofocus><span class="hint">3 a 30 caracteres: letras, números, ponto ou _ (sem espaço nem acento).</span></div>
          <div class="field"><label for="gEmail">E-mail</label><input class="input" id="gEmail" type="email" autocomplete="email" required value="${su.email}"></div>
          <div class="field"><label for="gPass">Senha</label><input class="input" id="gPass" type="password" autocomplete="new-password" minlength="8" required value="${su.password}"><span class="hint">pelo menos 8 caracteres.</span></div>
          <div class="form-msg" id="gMsg" role="alert"></div>
          <button class="btn btn-primary btn-block" type="submit">Continuar</button>
        </form>
      `));
    }else if(g.mode === 'signup' && g.step === 2){
      const su = g.signup;
      render(root, shell(html`
        <div class="steps" aria-label="Passo 2 de 2"><i class="on"></i><i class="on"></i></div>
        <form class="form" id="gateForm">
          <div class="field"><label for="gCountry">De onde você é?</label>
            <select class="select" id="gCountry" required>
              <option value="">escolha um país</option>
              ${countries.map(c => html`<option ${c === su.nationality ? 'selected' : ''}>${c}</option>`)}
            </select>
            <span class="hint">usado pra mostrar o que está em alta no seu país.</span>
          </div>
          <div class="field"><span class="field-label">Estilos que você mais ouve</span>
            <div class="genre-pick" id="gGenres">${famousGenres.map(gn => html`<button type="button" class="chip ${su.genres.has(gn) ? 'on' : ''}" data-g="${gn}" aria-pressed="${su.genres.has(gn)}">${gn}</button>`)}</div>
          </div>
          <div class="form-msg" id="gMsg" role="alert"></div>
          <div style="display:flex;gap:10px">
            <button class="btn" type="button" data-gate="back">Voltar</button>
            <button class="btn btn-primary" type="submit" style="flex:1">Criar minha conta</button>
          </div>
        </form>
      `));
    }else if(g.mode === 'forgot'){
      render(root, shell(html`
        <form class="form" id="gateForm">
          <p class="muted" style="margin:0">digite o e-mail da conta — se ele existir, mandamos um link pra você escolher uma senha nova.</p>
          <div class="field"><label for="gFEmail">E-mail</label><input class="input" id="gFEmail" type="email" autocomplete="email" required autofocus></div>
          <div class="form-msg" id="gMsg" role="alert"></div>
          <button class="btn btn-primary btn-block" type="submit">Enviar link</button>
          <button class="link-btn" type="button" data-gate="mode" data-mode="login" style="justify-self:center">voltar pro login</button>
        </form>
      `));
    }else if(g.mode === 'reset'){
      render(root, shell(html`
        <form class="form" id="gateForm">
          <p class="muted" style="margin:0">escolha uma senha nova pra sua conta.</p>
          <div class="field"><label for="gR1">Nova senha</label><input class="input" id="gR1" type="password" autocomplete="new-password" minlength="8" required autofocus></div>
          <div class="field"><label for="gR2">Repita a senha</label><input class="input" id="gR2" type="password" autocomplete="new-password" minlength="8" required></div>
          <div class="form-msg" id="gMsg" role="alert"></div>
          <button class="btn btn-primary btn-block" type="submit">Salvar nova senha</button>
        </form>
      `));
    }
    const af = $('[autofocus]', root);
    if(af) af.focus();
  };

  const msg = (t, ok = false) => { const m = $('#gMsg', root); if(m){ m.textContent = t; m.classList.toggle('ok', ok); } };

  root.addEventListener('click', (e) => {
    const chip = e.target.closest('#gGenres [data-g]');
    if(chip){
      const set = g.signup.genres;
      set.has(chip.dataset.g) ? set.delete(chip.dataset.g) : set.add(chip.dataset.g);
      chip.classList.toggle('on'); chip.setAttribute('aria-pressed', String(set.has(chip.dataset.g)));
      return;
    }
    const b = e.target.closest('[data-gate]');
    if(!b) return;
    if(b.dataset.gate === 'mode'){ g.mode = b.dataset.mode; g.step = 1; paint(); }
    if(b.dataset.gate === 'back'){ g.signup.nationality = $('#gCountry', root).value; g.step = 1; paint(); }
  });

  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type="submit"]', root);
    const busy = (v) => { if(btn) btn.disabled = v; };
    msg('');
    try{
      if(g.mode === 'login'){
        busy(true);
        const { user } = await api('/auth/login', { method: 'POST', body: { identifier: $('#gId', root).value.trim(), password: $('#gPw', root).value } });
        setMe(user);
        onDone();
      }else if(g.mode === 'signup' && g.step === 1){
        const su = g.signup;
        su.username = $('#gUser', root).value.trim();
        su.email = $('#gEmail', root).value.trim();
        su.password = $('#gPass', root).value;
        if(!/^[a-zA-Z0-9_.]{3,30}$/.test(su.username)) return msg('o nome de usuário precisa ter de 3 a 30 caracteres: letras, números, ponto ou _.');
        if(su.password.length < 8) return msg('a senha precisa ter pelo menos 8 caracteres.');
        g.step = 2;
        paint();
      }else if(g.mode === 'signup' && g.step === 2){
        const su = g.signup;
        su.nationality = $('#gCountry', root).value;
        if(!su.nationality) return msg('escolha seu país.');
        if(!su.genres.size) return msg('escolha pelo menos um estilo musical.');
        busy(true);
        const { user } = await api('/auth/signup', { method: 'POST', body: { username: su.username, email: su.email, password: su.password, nationality: su.nationality, genres: [...su.genres] } });
        setMe(user);
        onboarding();
      }else if(g.mode === 'forgot'){
        busy(true);
        const { message } = await api('/auth/forgot-password', { method: 'POST', body: { email: $('#gFEmail', root).value.trim() } });
        msg(message, true);
        busy(false);
      }else if(g.mode === 'reset'){
        const p1 = $('#gR1', root).value, p2 = $('#gR2', root).value;
        if(p1 !== p2) return msg('as duas senhas não são iguais.');
        busy(true);
        const { user } = await api('/auth/reset-password', { method: 'POST', body: { token: resetToken, password: p1 } });
        history.replaceState(null, '', location.pathname + location.hash);
        setMe(user);
        onDone();
      }
    }catch(err){
      busy(false);
      // erro de cadastro por usuário/e-mail repetido volta pro passo 1
      if(g.mode === 'signup' && err.status === 409){ g.step = 1; paint(); }
      msg(err.message);
    }
  });

  async function onboarding(){
    render(root, shell(html`
      <div style="display:grid;gap:14px">
        <div style="text-align:center"><span class="hand" style="font-size:28px">sua fita tá pronta.</span><p class="muted" style="margin:4px 0 0">siga algumas pessoas pra encher suas Resenhas — dá pra fazer isso depois também.</p></div>
        <div class="people" id="gPeople"><div class="skeleton" style="height:72px"></div><div class="skeleton" style="height:72px"></div></div>
        <button class="btn btn-primary btn-block" type="button" id="gDone">Começar a ouvir</button>
      </div>
    `));
    $('#gDone', root).addEventListener('click', onDone);
    const box = $('#gPeople', root);
    try{
      const { users } = await api('/users');
      render(box, users.length ? users.slice(0, 8).map(u => { cachePerson(u); return html`
        <div class="person">${avatar(u, 46)}<div class="who"><span class="n">${u.username}</span><span class="s">${(u.genres || []).slice(0, 3).join(' · ')}</span></div><div class="acts">${followBtn(u.username)}</div></div>`; })
        : html`<p class="muted" style="text-align:center;margin:0">ainda não tem outras pessoas por aqui — volte depois em Pessoas.</p>`);
    }catch(e){
      render(box, html`<p class="muted" style="text-align:center;margin:0">não deu pra carregar sugestões agora.</p>`);
    }
  }

  paint();
}
