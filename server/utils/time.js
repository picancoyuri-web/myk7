// o SQLite guarda datetime('now') como "2026-10-16 12:34:56", em UTC mas
// sem fuso. new Date() no navegador interpreta isso como horário LOCAL
// (horas erradas no Brasil) e o Safari/iPhone nem consegue ler (Invalid
// Date). Convertendo pra ISO com "Z" fica certo em qualquer navegador.
function toIso(sqliteDate){
  if(!sqliteDate) return null;
  if(sqliteDate.includes('T')) return sqliteDate;
  return sqliteDate.replace(' ', 'T') + 'Z';
}

module.exports = { toIso };
