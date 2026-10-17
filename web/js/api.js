import { API_BASE, DEMO } from './config.js';

export class ApiError extends Error{
  constructor(message, status){
    super(message);
    this.status = status;
  }
}

let demoModule = null;

// chamada à API do Cassete. Devolve o JSON (ou null em respostas 204) e
// lança ApiError com a mensagem do servidor quando dá erro.
export async function api(path, { method = 'GET', body, signal } = {}){
  if(DEMO){
    demoModule = demoModule || await import('./demo.js');
    return demoModule.handle(method, path, body);
  }
  let res;
  try{
    res = await fetch(API_BASE + path, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  }catch(e){
    if(e.name === 'AbortError') throw e;
    throw new ApiError('sem conexão com o servidor — confira sua internet e tente de novo.', 0);
  }
  let data = null;
  if(res.status !== 204){
    try{ data = await res.json(); }catch(e){ /* corpo vazio ou não-JSON */ }
  }
  if(!res.ok) throw new ApiError((data && data.error) || 'erro ao falar com o servidor.', res.status);
  return data;
}

// URL de imagem segura pra usar em <img src>. Aceita:
// - caminhos da própria API (/api/users/x/avatar) → prefixa a base certa
// - foto embutida em base64 (modo demo, prévia antes de enviar)
// - https comum (fotos do Discogs)
const DATA_IMG = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
export function mediaUrl(u){
  if(typeof u !== 'string' || !u) return '';
  if(u.startsWith('/api/')) return API_BASE + u.slice(4);
  if(DATA_IMG.test(u)) return u;
  if(/^https:\/\/[^\s"'()<>\\]+$/.test(u)) return u;
  return '';
}

export const q = (params) => {
  const s = new URLSearchParams();
  for(const [k, v] of Object.entries(params)) if(v !== undefined && v !== null && v !== '') s.set(k, v);
  const str = s.toString();
  return str ? '?' + str : '';
};
