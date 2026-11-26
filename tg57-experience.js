/* R57: navegação direcional e aviso de armazenamento. Sem alterações em Auth/RPC. */
(()=>{'use strict';
 const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 const selector='button,summary,a[href],input:not([type=hidden]),select,textarea,[tabindex],[role=button]';
 const editable=n=>n?.matches('input,textarea,select,[contenteditable=true]')||n?.isContentEditable;
 const visible=n=>{if(n.disabled||n.getAttribute('aria-disabled')==='true'||n.tabIndex<0||n.closest('[hidden],[inert],.tg26-legacy,.tg57-legacy-editor'))return false;const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&s.visibility==='visible'&&s.display!=='none';};
 const topDialog=()=>document.activeElement?.closest('dialog[open]')||[...document.querySelectorAll('dialog[open]')].filter(d=>d.getClientRects().length).at(-1)||null;
 const center=r=>[r.left+r.width/2,r.top+r.height/2];
 const focus=n=>{n.focus({preventScroll:true});n.scrollIntoView({block:'nearest',inline:'nearest'});};
 document.addEventListener('pointerdown',()=>document.body.classList.remove('tg57-dpad'),true);
 document.addEventListener('keydown',e=>{
  const view=document.body.dataset.currentView;
  if(!['stage','lobby','landing'].includes(view)||e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.isComposing)return;
  const active=document.activeElement,dialog=topDialog();
  if(['BrowserBack','GoBack'].includes(e.key)){
    if(dialog){e.preventDefault();if(typeof dialog.requestClose==='function')dialog.requestClose();else if(dialog.dispatchEvent(new Event('cancel',{cancelable:true})))dialog.close();return;}
    if(view==='stage'){e.preventDefault();const target=document.querySelector('#tg123-host-bar button:not([hidden]):not(.tg26-legacy):not(:disabled)');if(target&&visible(target))focus(target);}return;
  }
  const dir=dirs[e.key];if(!dir||editable(active)||active?.matches('[role=tab]'))return;
  const scope=dialog||document.getElementById(view);if(!scope||scope.hidden)return;
  const all=[...scope.querySelectorAll(selector)].filter(visible);if(!all.length)return;
  document.body.classList.add('tg57-dpad');
  if(!all.includes(active)){e.preventDefault();focus(all.find(n=>n.id==='play-pause')||all[0]);return;}
  const ar=active.getBoundingClientRect(),[x,y]=center(ar);let best=null,score=Infinity;
  for(const n of all){if(n===active)continue;const r=n.getBoundingClientRect(),[cx,cy]=center(r),dx=cx-x,dy=cy-y;const along=dx*dir[0]+dy*dir[1],cross=Math.abs(dx*dir[1]-dy*dir[0]);if(along<=1)continue;const aligned=dir[0]?(r.top<ar.bottom&&r.bottom>ar.top):(r.left<ar.right&&r.right>ar.left);const cost=along+cross*(aligned?.5:3)+(aligned?0:80);if(cost<score){score=cost;best=n;}}
  if(best){e.preventDefault();focus(best);}
 });
 const key='tg57-storage-notice-v1';
 function boot(){
  const landing=document.getElementById('landing');if(!landing||document.getElementById('tg57-storage-notice'))return;
  const notice=document.createElement('section');notice.id='tg57-storage-notice';notice.className='tg57-storage-notice';notice.setAttribute('aria-labelledby','tg57-storage-title');
  const h=document.createElement('h2');h.id='tg57-storage-title';h.textContent='Cookies e armazenamento';
  const p=document.createElement('p');p.textContent='Usamos armazenamento do navegador para acesso e preferências. YouTube e serviços opcionais podem usar cookies próprios.';
  const actions=document.createElement('div');actions.className='tg57-storage-actions';
  const link=document.createElement('a');link.href='./privacidade.html#cookies';link.textContent='Saiba mais';
  const ok=document.createElement('button');ok.type='button';ok.className='button button-soft';ok.textContent='Entendi';
  actions.append(link,ok);notice.append(h,p,actions);
  const main=landing.querySelector('.landing-main');if(main)main.after(notice);else landing.append(notice);
  const reopen=document.createElement('button');reopen.type='button';reopen.className='text-button tg57-storage-reopen';reopen.textContent='Cookies';reopen.setAttribute('aria-controls',notice.id);
  const footer=landing.querySelector('.tg12-legal')||landing.querySelector('footer')||landing;footer.append(reopen);
  function show(){notice.hidden=false;ok.focus({preventScroll:true});notice.scrollIntoView({block:'nearest'});}
  reopen.addEventListener('click',show);
  ok.addEventListener('click',()=>{try{localStorage.setItem(key,'1');}catch{}notice.hidden=true;reopen.focus({preventScroll:true});});
  try{notice.hidden=localStorage.getItem(key)==='1';}catch{}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();