// tema: 'system' (segue o aparelho), 'dark' ou 'light'
import { storage } from './dom.js';

const KEY = 'cassete_theme';
export const THEMES = { system: 'Igual ao aparelho', dark: 'Escuro', light: 'Claro' };

export function getTheme(){
  const t = storage.get(KEY, 'system');
  return THEMES[t] ? t : 'system';
}

export function applyTheme(t = getTheme()){
  if(t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && !matchMedia('(prefers-color-scheme: light)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', dark ? '#17161A' : '#EFEAE0');
}

export function setTheme(t){
  storage.set(KEY, t);
  applyTheme(t);
}
