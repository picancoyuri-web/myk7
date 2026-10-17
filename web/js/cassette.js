// a fita cassete desenhada em SVG — cada item ganha uma cor própria (a
// partir do título/artista) e o título escrito à mão na etiqueta. Os rolos
// giram quando aquela fita está tocando (ver player.js).
import { raw, escapeHtml } from './dom.js';
import { itemHue, typeLabel } from './items.js';

const INK = '#2A2420';
const HOLE = '#121013';

function clip(s, n){
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

function reel(cx, cls){
  let teeth = '';
  for(let a = 0; a < 360; a += 60) teeth += `<rect x="-2" y="-11.5" width="4" height="5" fill="${HOLE}" transform="rotate(${a})"/>`;
  return `<g transform="translate(${cx} 107)"><circle r="17" fill="${HOLE}"/><g class="reel ${cls}"><circle r="12" fill="#E4DED2"/>${teeth}<circle r="4.5" fill="#8C857A"/><rect x="-0.8" y="-12" width="1.6" height="4" fill="#B9B2A5"/></g></g>`;
}

// size: 'lg' (com título e artista) ou 'sm' (miniatura, sem texto)
export function cassette(item, { size = 'lg', label = true } = {}){
  const h = itemHue(item);
  const paper = `hsl(${h} 30% 87%)`;
  const accent = `hsl(${h} 52% 44%)`;
  const band = `hsl(${h} 28% 25%)`;
  const showText = size !== 'sm' && label;
  const id = escapeHtml(item.id);
  const aria = escapeHtml(`Fita: ${item.title} — ${item.artist}`);

  const text = showText ? `
    <text x="60" y="47" font-family="Caveat, 'Segoe Print', cursive" font-size="23" font-weight="700" fill="${INK}">${escapeHtml(clip(item.title, 26))}</text>
    <text x="60" y="71" font-family="Caveat, 'Segoe Print', cursive" font-size="18" font-weight="600" fill="#5C5249">${escapeHtml(clip(item.artist, 32))}</text>
    <text x="34" y="147" font-family="'JetBrains Mono', monospace" font-size="8.5" letter-spacing="1.2" fill="#6B6157">C-60 · ${escapeHtml(typeLabel(item).toUpperCase())}</text>
    <text x="286" y="147" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="8.5" letter-spacing="1" fill="#6B6157">${escapeHtml(item.year || '')}</text>
  ` : '';

  return raw(`<svg class="cassette" data-cassette="${id}" viewBox="0 0 320 204" role="img" aria-label="${aria}">
    <rect x="1.5" y="1.5" width="317" height="201" rx="14" fill="#1E1C20" stroke="#37333A" stroke-width="1.5"/>
    <path d="M14 30h292M14 158h292" stroke="#2A272D" stroke-width="1"/>
    <circle cx="11" cy="11" r="4.5" fill="#3A363C"/><circle cx="309" cy="11" r="4.5" fill="#3A363C"/>
    <circle cx="11" cy="193" r="4.5" fill="#3A363C"/><circle cx="309" cy="193" r="4.5" fill="#3A363C"/>
    <rect x="20" y="13" width="280" height="143" rx="8" fill="${paper}"/>
    <rect x="20" y="21" width="280" height="3" fill="${accent}"/>
    <text x="38" y="58" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="22" fill="${accent}">A</text>
    <path d="M58 52h232M58 76h232" stroke="hsl(6 62% 56%)" stroke-width="1.2" opacity=".75"/>
    ${text}
    <rect x="20" y="84" width="280" height="46" fill="${band}"/>
    <rect x="134" y="95" width="52" height="24" rx="3" fill="${HOLE}"/>
    <rect x="138" y="100" width="44" height="14" rx="2" fill="#4A3428"/>
    <path d="M138 107h44" stroke="#6A4C3C" stroke-width="1"/>
    ${reel(104, 'r1')}${reel(216, 'r2')}
    <path d="M88 202L102 166h116l14 36z" fill="#29262B" stroke="#37333A" stroke-width="1.2"/>
    <circle cx="122" cy="189" r="5" fill="${HOLE}"/><circle cx="198" cy="189" r="5" fill="${HOLE}"/>
    <rect x="140" y="183" width="8" height="8" rx="1.5" fill="${HOLE}"/><rect x="172" y="183" width="8" height="8" rx="1.5" fill="${HOLE}"/>
    <circle cx="160" cy="175" r="3.5" fill="#3A363C"/>
  </svg>`);
}
