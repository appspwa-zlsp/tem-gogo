// R93 — navegador real, dados simulados. Nunca usa o Supabase de produção.
const { chromium }=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const BASE='http://127.0.0.1:8765/';
 try{
  for(const width of [390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce'});
   await page.route('**/*',route=>{
    if(route.request().url().startsWith(BASE))return route.continue();
    return route.abort();
   });
   await page.goto(BASE,{waitUntil:'domcontentloaded'});
   await page.waitForTimeout(300);
   await page.evaluate(()=>{
    document.querySelectorAll('.view').forEach(el=>{el.hidden=el.id!=='lobby';});
    document.body.dataset.currentView='lobby';
    dispatchEvent(new CustomEvent('temgogo:view',{detail:{view:'lobby'}}));
   });
   assert.equal(await page.locator('#tg12-hub-choices').count(),0,'Menu antigo duplicado');
   assert.equal(await page.locator('#tg92-hub-choices').count(),1);
   assert.equal(await page.locator('#tg70-modes').isVisible(),false);
   await page.locator('#tg92-hub-history').click();
   assert.equal(await page.locator('#tg93-history-panel').isVisible(),true);
   assert.equal(await page.locator('#tg70-modes').isVisible(),false);
   assert.equal(await page.locator('#reopen-recap').count(),1);
   await page.locator('#tg93-history-back').click();
   assert.equal(await page.locator('#tg93-history-panel').isVisible(),false);
   await page.locator('#tg92-hub-create').click();
   assert.equal(await page.locator('#tg70-modes').isVisible(),true);
   assert.equal(await page.locator('#tg70-go-battle').isDisabled(),true);
   assert.equal(await page.locator('#tg75-open-workspace').isDisabled(),true);
   await page.locator('#tg70-go-classic').click();
   assert.equal(await page.locator('#host-create-area').isVisible(),true);
   await page.locator('#tg70-battle-story-open').click();
   assert.equal(await page.locator('#tg70-battle-guide').evaluate(el=>el.open),true);
   assert.match(await page.locator('#tg70-guide-counter').innerText(),/1 de 6/);
   for(let i=2;i<=6;i++){
     await page.locator('#tg70-guide-next').click();
     assert.match(await page.locator('#tg70-guide-counter').innerText(),new RegExp(i+' de 6'));
   }
   await page.locator('#tg70-guide-next').click();
   assert.equal(await page.locator('#tg70-battle-guide').evaluate(el=>el.open),false);
   await page.locator('#tg70-battle-story-open').click();
   await page.locator('#tg70-guide-skip').click();
   assert.equal(await page.locator('#tg70-battle-guide').evaluate(el=>el.open),false);

   await page.locator('#settings-dialog').evaluate(el=>el.showModal());
   await page.locator('#tg93-a11y-panel').evaluate(el=>{el.open=true;});
   await page.locator('#tg93-reduce-motion').check();
   await page.locator('#tg93-large-text').check();
   await page.locator('#tg93-voice-previews').uncheck();
   assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('tg93-reduce-motion')),true);
   assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('tg93-large-text')),true);
   assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('tg93-voice-previews-off')),true);
   await page.locator('#settings-dialog').evaluate(el=>el.close());

   await page.locator('#guest-profile-avatar').evaluate(img=>{img.src='./cantor-urbano.png'});
   const fit=await page.locator('#guest-profile-avatar').evaluate(img=>getComputedStyle(img).objectFit);
   assert.equal(fit,'contain','Avatar oficial deve caber na bolinha sem cortar rosto');

   const overflow=await page.evaluate(()=>({view:innerWidth,page:document.documentElement.scrollWidth}));
   console.log('OK viewport',width,'scrollWidth',overflow.page);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
