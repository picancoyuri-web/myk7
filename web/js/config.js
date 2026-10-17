// De onde o app fala com a API.
// - No site publicado: /api relativo — o _redirects do Netlify repassa pro
//   Render por dentro, então pro navegador é "o mesmo site" (o Safari/iPhone
//   bloqueia cookie entre domínios diferentes).
// - Servido pelo próprio backend (http://localhost:3001): /api relativo também.
// - Live Server do VS Code (porta 55xx) ou arquivo aberto direto: backend local.
// - App empacotado (Capacitor): fala direto com o Render.
const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const isLocalDevServer = location.protocol === 'file:' ||
  ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') && /^55\d\d$/.test(location.port));

export const API_BASE = window.CASSETE_API_BASE || (isNativeApp
  ? 'https://cassete.onrender.com/api'
  : isLocalDevServer
    ? 'http://localhost:3001/api'
    : '/api');

// modo demonstração: roda inteiro no navegador, com dados de exemplo e sem
// servidor (usado na prévia publicada e ao abrir com ?demo)
export const DEMO = window.CASSETE_DEMO === true || new URLSearchParams(location.search).has('demo');

export const POLL_MS = 20000;
export const CHAT_POLL_MS = 4000;
