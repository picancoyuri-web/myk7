// Em produção (HTTPS — Render, ou atrás do proxy do Netlify) o cookie
// precisa de SameSite=None + Secure, porque o app nativo (Capacitor) fala
// com a API de outro domínio. Em http://localhost um cookie Secure não é
// aceito por todo navegador, então lá usamos Lax (localhost:5500 e
// localhost:3001 contam como o mesmo "site").
function cookieOpts(req){
  const secure = req.secure || process.env.COOKIE_SECURE === 'true';
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  };
}

module.exports = { cookieOpts };
