const CACHE='tem-gogo-beta12-shell-rev1';
const SHELL=['./','./index.html','./styles.css','./visual-v2.css','./visual-v14.css','./visual-v15.css','./visual-v16.css','./visual-v17.css','./visual-v18.css','./visual-v19.css','./refinamento-v19-2.css','./tour-suporte-v19-3.css','./beta10.css','./beta10.css?v=120','./beta12.css','./beta12.css?v=120','./beta10.js','./beta10.js?v=120','./beta12.js','./beta12.js?v=120','./tg-dialogs.js','./tg-dialogs.js?v=120','./termos.html','./privacidade.html','./bora-pro-role-logo.png','./diva.png','./diva-busto.png','./cantor-urbano.png','./cantor-esporte.png','./cantora-ruiva.png','./cantora-oculos.png','./qr-local.js','./app.js','./app.js?v=120','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  // A configuração deve refletir sempre a versão mais recente, sem cache de credenciais.
  if(url.pathname.endsWith('/config.js'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));}
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  // Sempre buscar os arquivos recentes online e usar cache apenas como fallback.
  event.respondWith(fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
    return response;
  }).catch(()=>caches.match(request)));
});

// Web Push genuíno: mensagem enviada pela Edge Function autenticada.
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  const title=String(data.title||'🎤 Tem Gogó: é sua vez!').slice(0,90);
  const options={body:String(data.body||'Abra o Tem Gogó e prepare seu microfone.').slice(0,180),
    icon:'./icon-192.png',badge:'./icon-192.png',tag:'tem-gogo-call-'+String(data.songId||''),
    renotify:true,data:{url:typeof data.url==='string'&&data.url.startsWith('./')?data.url:'./'}};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    const same=clients.find(c=>c.url.startsWith(self.registration.scope));
    if(same){await same.focus();return same.navigate(target);}
    return self.clients.openWindow(target);
  }));
});
