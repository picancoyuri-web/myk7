// Assinatura MyK7+ (sem anúncios + extras).
//
// A compra acontece na App Store / Play Store pelo app, intermediada pela
// RevenueCat. O servidor nunca confia no app dizendo "sou premium": ele
// confere direto na RevenueCat (POST /refresh) ou recebe o aviso dela
// (POST /webhook). O id da pessoa na RevenueCat é o billingId ("u" + id).
//
// Variáveis:
//   REVENUECAT_SECRET_KEY   — chave secreta da API v1 (sk_...), pra /refresh
//   REVENUECAT_WEBHOOK_AUTH — o mesmo texto cadastrado como "Authorization"
//                             no webhook da RevenueCat
//   REVENUECAT_ENTITLEMENT  — nome do entitlement (padrão: premium)
const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const rateLimit = require('../utils/rateLimit');
const { isPremium } = require('../utils/serialize');

const router = express.Router();

const ENTITLEMENT = process.env.REVENUECAT_ENTITLEMENT || 'premium';
const refreshLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: 'muitas tentativas — espere um minuto.' });

function status(row){
  return { premium: isPremium(row), premiumUntil: isPremium(row) ? row.premium_until : null };
}

function userIdFromBillingId(billingId){
  const m = /^u(\d+)$/.exec(String(billingId || ''));
  return m ? Number(m[1]) : null;
}

function setPremiumUntil(userId, until){
  db.prepare('UPDATE users SET premium_until = ? WHERE id = ?').run(until, userId);
}

// GET /api/billing/status
router.get('/status', requireAuth, (req, res) => {
  res.json(status(req.user));
});

// POST /api/billing/refresh — depois de comprar ou restaurar no app,
// pergunta pra RevenueCat se o entitlement está ativo
router.post('/refresh', requireAuth, refreshLimiter, async (req, res, next) => {
  try{
    const key = process.env.REVENUECAT_SECRET_KEY;
    if(!key) return res.json(status(req.user)); // sem RevenueCat configurada: fica o que está no banco

    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent('u' + req.user.id)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    if(!r.ok) return res.status(502).json({ error: 'não deu pra confirmar a assinatura agora — tente de novo.' });
    const data = await r.json();
    const ent = data && data.subscriber && data.subscriber.entitlements && data.subscriber.entitlements[ENTITLEMENT];

    let until = null;
    if(ent){
      if(!ent.expires_date) until = 'lifetime';
      else if(new Date(ent.expires_date).getTime() > Date.now()) until = new Date(ent.expires_date).toISOString();
    }
    // aqui só liga/estende: quem desliga é o webhook (EXPIRATION), assim um
    // MyK7+ dado pela moderação (revisores, parceiros) não some num refresh
    if(until && until !== req.user.premium_until && !(req.user.premium_until === 'lifetime')){
      setPremiumUntil(req.user.id, until);
    }
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json(status(row));
  }catch(e){
    next(e);
  }
});

// POST /api/billing/webhook — a RevenueCat avisa compras, renovações e fins
router.post('/webhook', (req, res) => {
  const auth = process.env.REVENUECAT_WEBHOOK_AUTH;
  if(!auth || req.get('authorization') !== auth) return res.status(401).json({ error: 'não autorizado.' });

  const event = (req.body && req.body.event) || {};
  const ids = [event.app_user_id, event.original_app_user_id, ...(event.aliases || [])];
  const userId = ids.map(userIdFromBillingId).find(Boolean);
  if(!userId) return res.json({ ok: true }); // compra de alguém sem conta ligada — ignora

  const grants = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT'];
  if(grants.includes(event.type)){
    const until = event.expiration_at_ms ? new Date(Number(event.expiration_at_ms)).toISOString() : 'lifetime';
    setPremiumUntil(userId, until);
  }else if(event.type === 'EXPIRATION'){
    setPremiumUntil(userId, null);
  }
  // CANCELLATION só desliga a renovação: o acesso vale até expirar
  console.log(`[billing] ${event.type} u${userId}`);
  res.json({ ok: true });
});

// POST /api/billing/grant { username, days }  (days 0 = tirar, -1 = sem prazo)
// pra moderação liberar MyK7+ a revisores das lojas, parceiros e demos
router.post('/grant', requireAuth, requireAdmin, (req, res) => {
  const { username, days } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(String(username || ''));
  if(!user) return res.status(404).json({ error: 'usuário não encontrado.' });
  const n = Number(days);
  if(!Number.isFinite(n)) return res.status(400).json({ error: 'dias inválido.' });

  const until = n < 0 ? 'lifetime' : n === 0 ? null : new Date(Date.now() + n * 86400000).toISOString();
  setPremiumUntil(user.id, until);
  console.log(`[billing] ${req.user.username} deu MyK7+ a ${user.username}: ${until}`);
  res.json({ username: user.username, ...status({ premium_until: until }) });
});

module.exports = router;
