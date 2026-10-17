// "instalar app" (PWA): guarda o convite do navegador pra mostrar no perfil
let deferred = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
});
window.addEventListener('appinstalled', () => { deferred = null; });

export function installPrompt(){
  return !!deferred;
}

export async function promptInstall(){
  if(!deferred) return;
  deferred.prompt();
  try{ await deferred.userChoice; }catch(e){ /* ignorado */ }
  deferred = null;
}
