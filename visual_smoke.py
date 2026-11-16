from playwright.sync_api import sync_playwright
from pathlib import Path
import json
out=Path('/mnt/data/temgogo_v19_work')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
 for w,h,view,prep in [(1440,900,'stage',True),(390,844,'tg18-remote',False),(390,844,'guest',True),(390,844,'stage',True)]:
  pg=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  errors=[]
  pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.route('https://cdn.jsdelivr.net/**',lambda r:r.fulfill(status=200,content_type='text/javascript',body="window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({})}})};"))
  pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  pg.route('https://fonts.gstatic.com/**',lambda r:r.abort())
  pg.goto('file:///mnt/data/temgogo_v19_work/index.html',wait_until='domcontentloaded',timeout=30000)
  pg.wait_for_timeout(350)
  pg.evaluate("""({view,prep})=>{
     document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!==view);
     document.body.dataset.currentView=view;
     if(view==='stage'){
       document.getElementById('stage-preflight').hidden=!prep;
       document.getElementById('video-placeholder').hidden=!prep;
       const next=document.getElementById('tg19-next-singer');next.textContent='VOCÊ É O PRÓXIMO: CAMILA + JOÃO!';
       document.getElementById('stage-preflight-track').textContent='Rihanna - Diamonds (karaokê)';
       document.getElementById('stage-qr').innerHTML='<div style="height:176px;width:176px;background:white;color:black">QR CODE</div>';
     }
     if(view==='tg18-remote'){
       document.getElementById('tg18-remote-room').textContent='Sextou com a galera';
       document.getElementById('tg19-remote-control').hidden=false;
       document.getElementById('tg19-remote-singing').hidden=true;
     }
     if(view==='guest'){
       document.getElementById('guest-preflight').hidden=!prep;
       document.getElementById('guest-mic-panel').hidden=true;
       document.getElementById('guest-queue-panel').hidden=false;
       document.getElementById('mobile-tab-mic').hidden=!prep;
     }
   }""",{'view':view,'prep':prep})
  pg.screenshot(path=str(out/f'preview_{view}_{w}.png'),full_page=False)
  result=pg.evaluate("""()=>({documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,documentHeight:document.documentElement.scrollHeight,qr:(()=>{let r=document.getElementById('qr-bubble').getBoundingClientRect();return {x:r.x,right:r.right,width:r.width}})(),preflight:(()=>{let r=document.getElementById('stage-preflight').getBoundingClientRect();return {x:r.x,right:r.right,height:r.height}})()})""")
  print(w,view,'errors',errors,'layout',result)
  pg.close()
 browser.close()
