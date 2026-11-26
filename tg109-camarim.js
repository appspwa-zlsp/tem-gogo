/* R109 — Camarim da Diva. Resolução no servidor, verificação de bytes e fallback.
 * Não altera avatares, troféus, vídeo/poster, som ou pontuação. */
(function(root){
'use strict';
const MAX=4194304, BUCKET='tem-gogo-visuals';
const pathOK=s=>typeof s==='string'&&s.length<=240&&/^diva\/[a-z0-9_/-]+\.(jpg|jpeg|png|webp)$/.test(s)&&!s.includes('//')&&!s.includes('..');
function candidate(v){
 if(!v||v.fallback!==false||v.storage_bucket!==BUCKET||typeof v.theme!=='string'||!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(v.theme)||!pathOK(v.storage_path)||typeof v.sha256!=='string'||!/^[a-f0-9]{64}$/.test(v.sha256)||!Number.isInteger(v.bytes)||v.bytes<1||v.bytes>MAX||typeof v.alt!=='string'||v.alt.length<5||v.alt.length>160)return null;
 return Object.freeze({theme:v.theme,path:v.storage_path,sha256:v.sha256,bytes:v.bytes,alt:v.alt});
}
function checkURL(raw,backend,asset){try{const u=new URL(raw),b=new URL(backend);return u.protocol==='https:'&&u.origin===b.origin&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/storage/v1/object/public/'+BUCKET+'/'+asset.path?u.href:null;}catch{return null;}}
function isOriginal(raw,base){try{const u=new URL(raw,base);return [new URL('./diva.png',base).href,new URL('./diva-busto.png',base).href].includes(u.href);}catch{return false;}}
function create({rpc,download,decode,dispose,paint,safe=()=>true,clock=()=>Date.now()}){
 let serial=0,active=null,pending=null,flight=null,closed=false,last=null;
 const drop=x=>{if(x?.url)dispose(x.url);};
 function flush(){if(closed||!pending||!safe())return false;const next=pending;pending=null;const before=active;try{paint(next.asset?next:null);active=next.asset?next:null;}catch{drop(next);try{paint(null);}catch{}active=null;}if(before&&before!==active)drop(before);return true;}
 function stage(next){if(pending&&pending!==next)drop(pending);pending=next;flush();}
 function refresh(force=false){
 if(closed)return Promise.resolve(false);if(flight)return flight;if(!force&&last!==null&&clock()-last<120000){flush();return Promise.resolve(false);}
 const ticket=++serial;last=clock();
 let task;task=Promise.resolve().then(async()=>{let url=null;try{const asset=candidate(await rpc());if(closed||ticket!==serial)return false;
 if(!asset){stage({asset:null});return true;}
 if(active?.asset.sha256===asset.sha256&&active.asset.path===asset.path&&active.asset.alt===asset.alt&&active.asset.theme===asset.theme&&!pending)return true;
 const data=await download(asset);if(closed||ticket!==serial)return false;
 url=await decode(data,asset);if(closed||ticket!==serial){dispose(url);url=null;return false;}stage({asset,url});url=null;return true;
 }catch{if(url)dispose(url);if(!closed&&ticket===serial)stage({asset:null});return false;}
 finally{if(flight===task)flight=null;}});flight=task;return task;
 }
 function reset(){++serial;flight=null;last=null;drop(pending);pending=null;try{paint(null);}finally{drop(active);active=null;}}
 function fallback(){if(closed)return false;++serial;flight=null;last=null;stage({asset:null});return true;}
 function stop(){closed=true;reset();}
 return Object.freeze({refresh,flush,reset,stop,fallback,snapshot:()=>Object.freeze({theme:active?.asset.theme||'default',pending:pending?.asset?.theme||null})});
}
function start(client,backend,safe){
 if(!client||!root.crypto?.subtle||typeof root.fetch!=='function'||typeof root.URL?.createObjectURL!=='function')return null;
 const records=new Map();let selected=null,stopped=false;
 const excluded=el=>!!el.closest('video,picture,[data-tg109-keep-original],.tg05-singer-avatar,.guest-profile-row');
 function update(){
 if(stopped)return;
 for(const [el,original] of records){if(!el.isConnected){records.delete(el);continue;}const src=el.getAttribute('src');if(!selected||excluded(el)){if(src===original.applied)el.setAttribute('src',original.src);if(el.getAttribute('alt')===original.appliedAlt){if(original.alt===null)el.removeAttribute('alt');else el.setAttribute('alt',original.alt);}records.delete(el);continue;}if(src!==original.applied&&!isOriginal(src,document.baseURI)){records.delete(el);continue;}if(src!==selected.url)el.setAttribute('src',selected.url);const alt=original.alt===null||original.alt===''?original.alt:selected.asset.alt;if(alt!==null&&el.getAttribute('alt')!==alt)el.setAttribute('alt',alt);original.applied=selected.url;original.appliedAlt=alt;}
 if(!selected)return;
 for(const el of document.querySelectorAll('img[src]')){if(records.has(el)||excluded(el)||!isOriginal(el.getAttribute('src'),document.baseURI))continue;const original={src:el.getAttribute('src'),alt:el.getAttribute('alt'),applied:selected.url,appliedAlt:el.getAttribute('alt')};records.set(el,original);el.setAttribute('src',selected.url);if(original.alt){el.setAttribute('alt',selected.asset.alt);original.appliedAlt=selected.asset.alt;}}
 }
 function paint(next){selected=next;update();document.documentElement.dataset.tg109Diva=next?.asset.theme||'default';}
 const withTimeout=async(fn,ms)=>{let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),ms);})]);}finally{clearTimeout(timer);}};
 const controller=create({
 rpc:async()=>{const r=await withTimeout(()=>client.rpc('tg32_current_diva'),4500);if(r.error)throw Error('Camarim indisponível');return r.data;},
 download:async asset=>{const raw=client.storage.from(BUCKET).getPublicUrl(asset.path)?.data?.publicUrl;const url=checkURL(raw,backend,asset);if(!url)throw Error('URL inválida');const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),8000);try{const r=await fetch(url,{signal:abort.signal,cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});const mime=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();if(!r.ok||!['image/jpeg','image/png','image/webp'].includes(mime))throw Error('Mídia inválida');const stream=r.body?.getReader();if(!stream)throw Error('Leitura indisponível');let total=0;const chunks=[];try{while(true){const {done,value}=await stream.read();if(done)break;total+=value.byteLength;if(total>asset.bytes||total>MAX){await stream.cancel();throw Error('Tamanho inválido');}chunks.push(value);}}finally{stream.releaseLock();}if(total!==asset.bytes)throw Error('Tamanho divergente');const blob=new Blob(chunks,{type:mime});const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==asset.sha256)throw Error('SHA-256 divergente');return blob;}finally{clearTimeout(timer);}},
 decode:async blob=>{const url=URL.createObjectURL(blob);try{await withTimeout(()=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth>0&&image.naturalHeight>0?resolve():reject(Error('Imagem inválida'));image.onerror=reject;image.src=url;}),5000);return url;}catch(e){URL.revokeObjectURL(url);throw e;}},
 dispose:url=>URL.revokeObjectURL(url),paint,safe
 });
 let queued=false;const observer=new MutationObserver(()=>{if(queued||!selected)return;queued=true;Promise.resolve().then(()=>{queued=false;update();});});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
 const tick=()=>{controller.flush();if(!document.hidden&&navigator.onLine!==false)void controller.refresh();};
 const onShow=()=>{if(!document.hidden)tick();};const onOffline=()=>{controller.fallback();};document.addEventListener('visibilitychange',onShow);root.addEventListener('temgogo:view',tick);root.addEventListener('online',tick);root.addEventListener('offline',onOffline);
 const timer=setInterval(tick,5000);void controller.refresh(true);
 return Object.freeze({flush:controller.flush,refresh:controller.refresh,stop:()=>{if(stopped)return;controller.stop();stopped=true;observer.disconnect();clearInterval(timer);document.removeEventListener('visibilitychange',onShow);root.removeEventListener('temgogo:view',tick);root.removeEventListener('online',tick);root.removeEventListener('offline',onOffline);},snapshot:controller.snapshot});
}
const api=Object.freeze({candidate,checkURL,isOriginal,create,start});
if(typeof module==='object'&&module.exports)module.exports=api;else Object.defineProperty(root,'TG109_CAMARIM',{value:api,writable:false,configurable:false});
})(typeof globalThis==='object'?globalThis:this);
