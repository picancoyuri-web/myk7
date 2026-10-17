const db = require('../db');
const { createNotification } = require('./notify');

// procura entradas de diário escritas há 1 ano (mesmo dia/mês) e cria uma
// notificação de "memória" pra pessoa relembrar — uma única vez por
// entrada, pra não repetir todo dia. Olha os últimos 3 dias (e não só
// "exatamente hoje") pra não perder lembrete se o servidor ficou fora do ar
// um dia — no plano grátis do Render ele dorme quando ninguém acessa.
function checkMemories(){
  try{
    const rows = db.prepare(`
      SELECT e.id, e.user_id FROM diary_entries e
      WHERE date(e.created_at) BETWEEN date('now', '-1 year', '-2 days') AND date('now', '-1 year')
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id = e.user_id AND n.type = 'memory' AND n.entry_id = e.id
        )
    `).all();

    db.transaction(() => {
      rows.forEach(entry => {
        createNotification({
          userId: entry.user_id,
          actorId: entry.user_id,
          type: 'memory',
          entryId: entry.id,
          allowSelf: true,
        });
      });
    })();

    if(rows.length) console.log(`[lembretes] ${rows.length} memória(s) criada(s).`);
  }catch(e){
    // nunca deixa um erro aqui derrubar o servidor (roda num setInterval)
    console.error('[lembretes] falhou:', e.message);
  }
}

module.exports = { checkMemories };
