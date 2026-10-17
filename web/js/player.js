// player único do app: uma fita toca por vez, numa barra fixa acima da
// navegação. Prévia de 30s do iTunes vira <audio>; itens do Spotify abrem o
// player oficial embutido. Os rolos da fita certa giram via CSS gerado aqui,
// então nenhuma tela precisa se preocupar em atualizar o estado do player.
import { DEMO } from './config.js';
import { html, render } from './dom.js';
import { icon } from './icons.js';
import { cassette } from './cassette.js';
import { spotifyUrl } from './items.js';

let current = null;
let mode = null; // 'audio' | 'spotify' | 'link'
let playing = false;
let audio = null;
let host = null;
const styleEl = document.createElement('style');
document.head.appendChild(styleEl);

function sel(attr, id){
  return `[${attr}="${CSS.escape(String(id))}"]`;
}

function syncStyles(){
  if(!current){ styleEl.textContent = ''; return; }
  const c = sel('data-cassette', current.id);
  const p = sel('data-play', current.id);
  styleEl.textContent = playing ? `
    @media (prefers-reduced-motion: no-preference){
      ${c} .reel{animation:reelSpin 1.8s linear infinite;}
      ${c} .reel.r2{animation-duration:1.3s;}
    }
    ${p} .i-play{display:none;} ${p} .i-pause{display:inline-flex;}
    ${p}.btn{border-color:var(--mustard);}
  ` : `${p}.btn{border-color:var(--mustard);}`;
}

function renderBar(){
  if(!host){
    host = document.createElement('div');
    host.id = 'player';
    document.body.appendChild(host);
  }
  if(!current){ host.innerHTML = ''; return; }
  const embedHeight = current.sp && current.sp.t === 'track' ? 80 : 152;
  render(host, html`
    <div class="player" role="region" aria-label="Tocando agora">
      ${mode === 'audio' ? html`<div class="player-progress"><i id="playerProgress"></i></div>` : ''}
      <div class="player-bar">
        <div>${cassette(current, { size: 'sm' })}</div>
        <div style="min-width:0">
          <div class="t">${current.title}</div>
          <div class="a">${current.artist}</div>
        </div>
        <div class="acts">
          ${mode === 'audio' ? html`
            <button class="btn btn-icon" type="button" data-player="toggle" aria-label="${playing ? 'Pausar' : 'Tocar'}">${icon(playing ? 'pause' : 'play')}</button>
          ` : ''}
          <button class="btn btn-icon" type="button" data-player="close" aria-label="Fechar player">${icon('x')}</button>
        </div>
      </div>
      ${mode === 'spotify' ? html`
        <div class="player-embed">
          <iframe title="Player do Spotify" src="${`https://open.spotify.com/embed/${current.sp.t}/${current.sp.id}?utm_source=generator&theme=0`}" height="${embedHeight}" allow="autoplay; encrypted-media; clipboard-write" loading="lazy"></iframe>
        </div>
      ` : ''}
      ${mode === 'link' ? html`
        <div class="player-note">a prévia não toca aqui na demonstração — <a href="${spotifyUrl(current)}" target="_blank" rel="noopener">ouvir no Spotify ↗</a></div>
      ` : ''}
    </div>
  `);
}

function setPlaying(v){
  playing = v;
  syncStyles();
  const btn = host && host.querySelector('[data-player="toggle"]');
  if(btn){
    btn.setAttribute('aria-label', v ? 'Pausar' : 'Tocar');
    render(btn, icon(v ? 'pause' : 'play'));
  }
}

function stopAudio(){
  if(audio){
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
}

export function close(){
  stopAudio();
  current = null;
  mode = null;
  playing = false;
  syncStyles();
  renderBar();
  if('mediaSession' in navigator) navigator.mediaSession.metadata = null;
}

export function isCurrent(item){
  return !!(current && item && current.id === item.id);
}

// tocar/pausar uma fita. Chamar de novo na mesma fita pausa (ou fecha o
// player do Spotify, que não deixa a gente controlar a reprodução).
export function play(item){
  if(!item) return;
  if(isCurrent(item)){
    if(mode === 'audio'){ audio.paused ? audio.play().catch(() => {}) : audio.pause(); }
    else close();
    return;
  }
  stopAudio();
  current = item;
  playing = false;

  if(item.previewUrl && !DEMO){
    mode = 'audio';
    if(!audio){
      audio = new Audio();
      audio.preload = 'none';
      audio.addEventListener('play', () => setPlaying(true));
      audio.addEventListener('pause', () => setPlaying(false));
      audio.addEventListener('ended', () => setPlaying(false));
      audio.addEventListener('timeupdate', () => {
        const bar = document.getElementById('playerProgress');
        if(bar && audio.duration) bar.style.width = (audio.currentTime / audio.duration * 100) + '%';
      });
    }
    renderBar();
    audio.src = item.previewUrl;
    audio.play().catch(() => setPlaying(false));
    if('mediaSession' in navigator){
      navigator.mediaSession.metadata = new MediaMetadata({ title: item.title, artist: item.artist, album: 'Cassete' });
      navigator.mediaSession.setActionHandler('play', () => audio.play());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    }
  }else if(item.sp && !DEMO){
    mode = 'spotify';
    playing = true;
    renderBar();
  }else{
    mode = 'link';
    renderBar();
  }
  syncStyles();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-player]');
  if(!b) return;
  if(b.dataset.player === 'close') close();
  if(b.dataset.player === 'toggle' && audio) audio.paused ? audio.play().catch(() => {}) : audio.pause();
});

// botão de tocar padrão (troca o ícone sozinho quando aquela fita toca)
export function playButton(item, { label = '', cls = 'btn btn-icon' } = {}){
  if(!item || !(item.previewUrl || item.sp)) return '';
  return html`<button class="${cls}" type="button" data-act="play" data-play="${item.id}" data-id="${item.id}" aria-label="Tocar ${item.title}">
    <span class="i-play">${icon('play')}</span><span class="i-pause">${icon('pause')}</span>${label ? ' ' + label : ''}
  </button>`;
}
