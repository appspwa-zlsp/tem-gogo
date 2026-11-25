/* C20: campanha editorial. Nenhum link livre ou HTML vindo do banco. */
(function(root){'use strict';
 const URLS=new Set(['https://airamdazl.github.io/boraprorole/index.html','https://airamdazl.github.io/boraprorole/']);
 const valid=c=>!!c&&c.asset==='bora-logo'&&URLS.has(c.url)&&['both','stage','guest'].includes(c.placement)&&[['title',3,70],['body',3,160],['cta',2,24],['alt',3,100]].every(([k,a,b])=>typeof c[k]==='string'&&c[k].trim().length>=a&&c[k].trim().length<=b)&&[['zoom',100,200],['x',0,100],['y',0,100]].every(([k,a,b])=>Number.isInteger(c[k])&&c[k]>=a&&c[k]<=b);
 const eligible=(c,area,now=Date.now())=>valid(c)&&(c.placement==='both'||c.placement===area)&&(!c.starts_at||(Number.isFinite(Date.parse(c.starts_at))&&Date.parse(c.starts_at)<=now))&&(!c.ends_at||(Number.isFinite(Date.parse(c.ends_at))&&Date.parse(c.ends_at)>now));
 const context=b=>[b?.client,b?.user?.id??null,b?.room?.id??null,b?.sessionEpoch??null];
 const same=(a,b)=>a.every((v,i)=>v===b[i]);
 if(typeof module!=='undefined'&&module.exports){module.exports={valid,eligible,context,same};return;}
 const nodes=()=>Array.from(document.querySelectorAll('[data-tg30-campaign]'));
 function hide(a){a.hidden=true;a.style.display='none';a.removeAttribute('href');}
 function render(c){for(const a of nodes()){
  if(!eligible(c,a.dataset.tg30Campaign)){hide(a);continue;}
  const img=a.querySelector('img'),title=a.querySelector('strong'),body=a.querySelector('.tg192-bora-text > span'),cta=a.querySelector('.tg192-bora-go');if(!img||!title||!body||!cta){hide(a);continue;}
  img.alt=c.alt;img.style.transform=`scale(${c.zoom/100})`;img.style.transformOrigin=`${c.x}% ${c.y}%`;
  title.textContent=c.title;body.textContent=c.body;cta.textContent=c.cta+' ↗';a.setAttribute('aria-label',c.title+' — '+c.cta+' (abre outro site)');a.href=c.url;a.hidden=false;a.style.removeProperty('display');
 }}
 // C21: publicações têm validade local limitada; respostas tardias não reabrem links.
 const REFRESH_MS=60000,MAX_AGE_MS=65000,REQUEST_TIMEOUT_MS=12000;
 let lastContext=[],serial=0,lastRequest=null,requestedAt=0,busy=false,published=null,receivedAt=0;
 function clear(){published=null;receivedAt=0;nodes().forEach(hide);}
 function invalidate(){serial++;busy=false;lastRequest=null;clear();}
 function safe(b){return !!(b?.client&&b.campaignSafe&&!document.hidden);}
 function fresh(now){return !!published&&now>=receivedAt&&now-receivedAt<MAX_AGE_MS;}
 async function tick(){const b=root.TG_BETA_BRIDGE?.(),key=context(b),now=Date.now();
  if(!same(key,lastContext)){lastContext=key;invalidate();}
  if(!safe(b)){invalidate();return;}
  if(!fresh(now))clear();else render(published);
  if(busy&&now-requestedAt>=REQUEST_TIMEOUT_MS){invalidate();}
  if(busy||(lastRequest!==null&&now-lastRequest>=0&&now-lastRequest<REFRESH_MS))return;
  busy=true;lastRequest=now;requestedAt=now;const gen=++serial;
  try{const {data,error}=await b.client.rpc('tg30_campaign_public');const current=root.TG_BETA_BRIDGE?.();
   if(gen!==serial||!same(key,context(current))||!safe(current))return;
   if(error||!valid(data)){clear();return;}
   published=data;receivedAt=Date.now();render(published);
  }catch{if(gen===serial&&same(key,context(root.TG_BETA_BRIDGE?.())))clear();}
  finally{if(gen===serial)busy=false;}
 }
 nodes().forEach(hide);void tick();root.setInterval(tick,3000);
 document.addEventListener('visibilitychange',()=>{invalidate();if(!document.hidden)void tick();});
 // Validação no instante do clique, inclusive antes do próximo polling.
 document.addEventListener('click',e=>{const a=e.target?.closest?.('[data-tg30-campaign]');if(!a)return;
  const b=root.TG_BETA_BRIDGE?.();if(!safe(b)||!same(lastContext,context(b))||!fresh(Date.now())||!eligible(published,a.dataset.tg30Campaign)||a.getAttribute('href')!==published.url){e.preventDefault();clear();}
 },true);
})(typeof window!=='undefined'?window:globalThis);
