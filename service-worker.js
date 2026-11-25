const CACHE='tem-gogo-30-r31-resultado';
const SHELL=["./capa-pop.webp","./capa-rock.webp","./capa-funk.webp","./capa-sertanejo.webp","./capa-pagode-samba.webp","./capa-forro.webp","./capa-rap-trap.webp","./capa-mpb.webp","./capa-internacional.webp","./capa-outras.webp","./pop-fogos.wav","./pop-vinheta.wav","./ux-r26.css?v=r31","./tg26-navigation.js?v=r29","./pop-recado.wav","./pop-suspense.wav","./pop-palmas.wav","./","./index.html","./ux-revisao.css?v=r22","./termos.html","./privacidade.html","./bora-pro-role-logo.png","./diva.png","./diva-busto.png","./cantor-urbano.png","./cantor-esporte.png","./cantora-ruiva.png","./cantora-oculos.png","./manifest.webmanifest","./icon-192.png","./icon-512.png","./tem-gogo.css?v=r10","./qr-local.js?v=3beta05","./tg73-invitations.js?v=3beta05","./tg73-battle-gate.js?v=3beta05","./tg-dialogs.js?v=r10","./tg30-voice.js?v=3beta05","./tg30-voice-shadow.js?v=3beta05","./tg30-voice-ui.js?v=3beta05","./tg30-diva-result.js?v=3beta05","./app.js?v=r31","./beta10.js?v=3beta05","./beta12.js?v=r30","./tg124-enhance.js?v=3beta05","./tg20.js?v=3beta05","./tg21-shortcuts.js?v=3beta05","./tg70-ux.js?v=3beta05","./tg74-voice-catalog.js?v=3beta05","./tg74-diva-studio.js?v=r26","./tg75-battle-core.js?v=3beta05","./tg75-battle-bridge.js?v=3beta05","./tg75-battle-panel.js?v=3beta05","./tg100-story.js?v=3beta05","./tg30-campaign.js?v=3beta05","./tg-premium-interface.js?v=r31"];
// Cache apenas de recursos estáticos inventariados e deste escopo.
const scopeURL=()=>new URL(self.registration.scope);
const isShell=url=>SHELL.some(path=>new URL(path,scopeURL()).href===url.href);
const cacheable=response=>response.ok&&!response.redirected&&!/\b(?:private|no-store)\b/i.test(response.headers.get('cache-control')||'');
const ownCache=key=>caches.match(key,{cacheName:CACHE});
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(path=>new Request(new URL(path,scopeURL()),{cache:"reload"})))));
});
self.addEventListener('message',event=>{if(event.data?.type==='TG_APPLY_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tem-gogo-') && k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  // Prévia de voz: não armazenar MP3 em cache, evitar uso desnecessário no celular.
  if(/^voz-\d{2}\.mp3$/i.test(url.pathname.split('/').pop()||''))return;
  // A configuração deve refletir sempre a versão mais recente, sem cache de credenciais.
  if(url.pathname.endsWith('/config.js'))return;
  if(request.mode==='navigate'){
    const base=new URL(self.registration.scope);
    const relative=url.pathname.startsWith(base.pathname)?url.pathname.slice(base.pathname.length):null;
    const key=relative===''||relative==='index.html'?'./index.html':relative==='termos.html'?'./termos.html':relative==='privacidade.html'?'./privacidade.html':null;
    event.respondWith(fetch(request,{cache:"no-cache"}).then(async response=>{
      if(cacheable(response)&&key){const copy=response.clone();try{await (await caches.open(CACHE)).put(key,copy);}catch{}}
      return response;
    }).catch(async()=> (key&&await ownCache(key))||new Response('Sem conexão. Esta página não está disponível offline.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
    return;
  }
  // Não interceptar APIs, arquivos de outros sistemas ou URLs arbitrárias da mesma origem.
  if(!isShell(url))return;
  event.respondWith(fetch(request,{cache:"no-cache"}).then(async response=>{
    if(cacheable(response)){try{await (await caches.open(CACHE)).put(request,response.clone());}catch{}}
    return response;
  }).catch(async()=> (await ownCache(request))||new Response('Recurso indisponível offline.',{status:503})));
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
