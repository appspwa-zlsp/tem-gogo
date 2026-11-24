/* TEM GOGÓ · BETA 2.0 — Acessibilidade, entrada, perfil e palco.
 * Camada de apresentação: NÃO modifica captação/WebRTC/nota.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const validRoom=value=>/^(?:[A-F0-9]{8}|[A-F0-9]{12})$/.test(String(value||'').trim().toUpperCase());
const roomCode=()=>String($('guest-code')?.value||new URL(location.href).searchParams.get('room')||'').trim().toUpperCase();
function makeButton(text,kind,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.className='button '+kind;b.dataset.tg20AuthAction=action;return b;}
function authActions(){
  const identity=$('tg12-guest-identity'),entry=$('tg12-guest-room');
  if(!identity||!entry)return;
  for(const target of [entry,identity]){
    if(target.querySelector('.tg20-auth-choices'))continue;
    const box=document.createElement('section');box.className='tg20-auth-choices';box.setAttribute('aria-label','Acesso com conta');
    const title=document.createElement('strong');title.textContent='Já tem conta ou quer guardar suas notas?';
    const expl=document.createElement('p');expl.textContent='Entre com seu e-mail ou crie sua conta. Também pode participar sem cadastro.';
    const buttons=document.createElement('div');buttons.className='tg20-auth-buttons';
    buttons.append(makeButton('Entrar com e-mail','button-outline','login'),makeButton('Criar conta','button-soft','signup'));
    box.append(title,expl,buttons);target.append(box);
  }
  document.querySelectorAll('[data-tg20-auth-action]').forEach(btn=>btn.addEventListener('click',()=>{
    const code=roomCode();if(validRoom(code)){
      sessionStorage.setItem('tg20-auth-return-room',code);
      localStorage.setItem('tem-gogo-pending-room',code);
    }else sessionStorage.removeItem('tg20-auth-return-room');
    // Reuse the REAL account login and signup forms; never send an e-mail without the form.
    $('tg12-back-login')?.click();
    document.body.classList.remove('tg12-guest-mode');document.body.classList.add('tg12-login-mode');
    if(btn.dataset.tg20AuthAction==='signup')$('signup-button')?.click();
    else {$('auth-email')?.focus({preventScroll:true});const msg=$('auth-state');if(msg)msg.textContent=validRoom(code)?'Entre na conta. Seu convite ficará guardado para voltar à festa.':'';}
  }));
  const stepLabel=$('tg12-guest-progress');if(stepLabel)stepLabel.setAttribute('aria-live','polite');
}
function hostProfile(){
  const dlg=$('tg20-host-profile-dialog'),form=$('tg20-host-profile-form');if(!dlg||!form)return;
  const avatars={urbano:'./cantor-urbano.png',esporte:'./cantor-esporte.png',ruiva:'./cantora-ruiva.png',oculos:'./cantora-oculos.png'};
  const wrap=$('tg20-profile-avatars');
  Object.entries(avatars).forEach(([key,src],n)=>{
    const label=document.createElement('label');label.className='tg20-avatar-choice';
    const inp=document.createElement('input');inp.type='radio';inp.name='tg20-avatar';inp.value=key;
    const img=document.createElement('img');img.src=src;img.alt='Avatar '+(n+1);img.loading='lazy';
    const num=document.createElement('span');num.textContent=String(n+1);label.append(inp,img,num);wrap.append(label);
  });
  dlg.addEventListener('close',()=>{$('tg20-profile-feedback').textContent='';});
  const sync=()=>{
    const b=window.TG_BETA_BRIDGE?.();if(!b?.user)return;
    $('tg20-profile-name').value=String(b.user.user_metadata?.display_name||localStorage.getItem('tem-gogo-display-name')||'');
    const chosen=b.avatar||localStorage.getItem('tem-gogo-avatar')||'urbano';
    const target=wrap.querySelector('input[value="'+chosen+'"]');if(target)target.checked=true;
  };
  document.querySelectorAll('[data-tg124-action="edit"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{if(dlg.open)sync();},0)));
  $('tg20-host-profile-close')?.addEventListener('click',()=>dlg.close());
  $('tg20-open-password')?.addEventListener('click',()=>{dlg.close();$('account-password-open')?.click();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();const b=window.TG_BETA_BRIDGE?.(),name=$('tg20-profile-name').value.trim();
    const feedback=$('tg20-profile-feedback');if(!b?.user||b.isAnonymous(b.user)){feedback.textContent='Entre com sua conta para editar o perfil.';return;}
    if(name.length<2||name.length>40){feedback.textContent='Use um nome de 2 a 40 caracteres.';return;}
    const btn=$('tg20-profile-save');btn.disabled=true;feedback.textContent='Salvando...';
    try{
      const client=b.client;
      if(!client)throw new Error('Conexão com conta indisponível.');
      const {error}=await client.auth.updateUser({data:{...b.user.user_metadata,display_name:name}});
      if(error)throw error;
      localStorage.setItem('tem-gogo-display-name',name);
      const selected=wrap.querySelector('input:checked');if(selected)b.setAvatar(selected.value);
      feedback.textContent='Perfil salvo!';setTimeout(()=>dlg.close(),400);
    }catch(e){feedback.textContent='Não foi possível salvar: '+(e.message||e);}
    finally{btn.disabled=false;}
  });
}
function fixDuplicateProfiles(){
  // The bottom mobile Profile shortcut and avatar must lead to the SAME quick menu.
  // Beta 1.0 also adds its own profile triggers: unify them, avoid double modals.
  for(const target of document.querySelectorAll('#guest [data-tg-beta-open="profile"],#tg-beta-stage-profile,#tg-beta-remote-profile,#tg-beta-lobby-profile')){
    target.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();$('tg124-profile-menu')?.showModal();},true);
  }
  const avatar=$('guest-profile-avatar');
  if(avatar){avatar.setAttribute('aria-label','Abrir acesso rápido do meu perfil');
    avatar.addEventListener('click',event=>{event.stopImmediatePropagation();$('tg124-profile-menu')?.showModal();},true);
    avatar.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopImmediatePropagation();$('tg124-profile-menu')?.showModal();}},true);
  }
  // Keep a single Profile entry in each main header.
  for(const root of ['#stage .stage-actions','#lobby .header-control-group','#tg18-remote .tg18-remote-header']){
    const buttons=Array.from(document.querySelectorAll(root+' .tg124-profile-shortcut,'+root+' #tg-beta-stage-profile,'+root+' #tg-beta-remote-profile,'+root+' #tg-beta-lobby-profile'));
    buttons.slice(1).forEach(el=>el.hidden=true);
  }
}
function accountChoice(){
  const gate=$('tg-beta-gate-account'),dlg=$('tg20-account-choice');if(!gate||!dlg)return;
  // Supersede the old direct e-mail-only conversion shortcut.
  gate.onclick=()=>{$('tg-beta-gate-dialog')?.close();dlg.showModal();};
  $('tg20-account-choice-close')?.addEventListener('click',()=>dlg.close());
  const go=mode=>{
    const bridge=window.TG_BETA_BRIDGE?.();const code=bridge?.room?.code||roomCode();
    if(validRoom(code))sessionStorage.setItem('tg20-auth-return-room',code);
    dlg.close();
    if(bridge?.isMyTurn?.()){
      void window.TG_UI?.notice?.('Termine a apresentação e desligue o microfone antes de trocar de conta.',{title:'Seu show está acontecendo'});return;
    }
    const u=new URL('./',location.href);u.searchParams.set('auth','login');
    if(validRoom(code))u.searchParams.set('room',code);
    if(mode==='signup')u.searchParams.set('mode','signup');
    location.assign(u.href);
  };
  $('tg20-account-existing')?.addEventListener('click',()=>go('login'));
  $('tg20-account-new')?.addEventListener('click',()=>go('signup'));
  $('tg20-account-preserve')?.addEventListener('click',()=>{
    dlg.close();$('tg18-account-cta')?.click();
  });
}
function groupCommunityProfile(){
  const panel=document.querySelector('#tg-beta-dialog [data-tg-beta-panel="profile"]');
  if(!panel||panel.querySelector('.tg20-profile-privacy'))return;
  const wrap=(title,cls,ids,open=false)=>{
    const details=document.createElement('details');details.className='tg20-profile-group '+cls;details.open=open;
    const summary=document.createElement('summary');summary.textContent=title;details.append(summary);
    for(const id of ids){const input=$(id);const label=input?.closest('label');if(label)details.append(label);}
    const save=$('tg-p-save');if(save)panel.insertBefore(details,save);
  };
  wrap('🔐 Privacidade e visibilidade','tg20-profile-privacy',['tg-p-insta-vis','tg-p-photo-vis','tg-p-score-vis','tg-p-discovery','tg-p-rank']);
  wrap('📄 Termos e declaração de idade','tg20-profile-legal',['tg-p-legal','tg-p-age'],true);
  const legal=$('tg-p-legal')?.closest('label');if(legal){
    // No false claims about unpublished versions: links point to actual current documents.
    for(const node of Array.from(legal.childNodes))if(node.nodeType===Node.TEXT_NODE)node.textContent=node.textContent.replace(/da Beta 1\.0\./,'do Tem Gogó.');
  }
}
function adaptHostStage(){
  const stage=$('stage'),rail=stage?.querySelector('.qr-rail'),main=stage?.querySelector('.stage-main'),screen=stage?.querySelector('.screen-row');
  const controls=$('tg123-host-bar'),next=$('tg123-post-score');if(!rail||!main||!screen||!controls)return;
  const mq=window.matchMedia('(min-width: 960px)');
  function arrange(){
    if(mq.matches&&!document.body.classList.contains('tg104-single-device')){
      rail.append(controls);if(next)rail.append(next);
    }else{screen.after(controls);if(next)controls.after(next);}
  }
  arrange();mq.addEventListener?.('change',arrange);
  // Existing controls keep their original IDs + listeners.
  window.addEventListener('resize',()=>{if(document.body.dataset.currentView==='stage')arrange();},{passive:true});
  // Solo mode may be entered dynamically without changing breakpoints.
  new MutationObserver(arrange).observe(document.body,{attributes:true,attributeFilter:['class']});
  controls.setAttribute('aria-label','Controle rápido do palco');
}
function statusPolish(){
  const toast=$('toast');if(toast)toast.setAttribute('aria-live','polite');
  const choice=$('tg124-choice-dialog');if(choice){choice.setAttribute('aria-modal','true');choice.addEventListener('close',()=>{const search=document.activeElement;if(search?.matches('input[type="search"]'))search.focus();});}
}
function init(){authActions();hostProfile();fixDuplicateProfiles();accountChoice();groupCommunityProfile();adaptHostStage();statusPolish();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
