from playwright.sync_api import sync_playwright
from pathlib import Path
from bs4 import BeautifulSoup
root=Path('/mnt/data/temgogo_v19_work')
html=BeautifulSoup((root/'index.html').read_text(),'html.parser')
for x in html.find_all(['script','link']):
 if x.name=='script' or (x.name=='link' and x.get('rel')==['stylesheet']):x.decompose()
html=str(html)
css='\n'.join((root/name).read_text() for name in ['styles.css','visual-v2.css','visual-v14.css','visual-v15.css','visual-v16.css','visual-v17.css','visual-v18.css','visual-v19.css'])
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
 for w,h,view,prep in [(1440,900,'stage',True),(390,844,'tg18-remote',False),(390,844,'guest',True),(390,844,'stage',True)]:
  pg=browser.new_page(viewport={'width':w,'height':h})
  errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.set_content(html,wait_until='domcontentloaded')
  pg.add_style_tag(content=css)
  pg.evaluate("Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});")
  pg.add_script_tag(content="window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({})}})};")
  pg.add_script_tag(content=(root/'config.js').read_text())
  pg.add_script_tag(content=(root/'app.js').read_text())
  pg.wait_for_timeout(450)
  pg.evaluate("""({view,prep})=>{
     document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!==view);
     document.body.dataset.currentView=view;
     if(view==='stage'){
       document.getElementById('stage-preflight').hidden=!prep;
       document.getElementById('video-placeholder').hidden=!prep;
       document.getElementById('tg19-next-singer').textContent='VOCÊ É O PRÓXIMO: CAMILA + JOÃO!';
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
  pg.screenshot(path=str(root/f'preview_{view}_{w}.png'),full_page=False)
  result=pg.evaluate("""()=>({documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,documentHeight:document.documentElement.scrollHeight,qr:(()=>{let r=document.getElementById('qr-bubble').getBoundingClientRect();return {x:r.x,right:r.right,width:r.width}})(),preflight:(()=>{let r=document.getElementById('stage-preflight').getBoundingClientRect();return {x:r.x,right:r.right,height:r.height}})()})""")
  print(w,view,'errors',errors,'layout',result)
  pg.close()
 browser.close()
