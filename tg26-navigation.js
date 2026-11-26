/* R26 — Navigation only. Keep existing nodes, handlers and permissions. */
(()=>{'use strict';
 const $=id=>document.getElementById(id), q=(s,r=document)=>r?.querySelector(s)||null;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const button=(label,fn)=>{const b=el('button','button button-outline',label);b.type='button';b.addEventListener('click',fn);return b;};
 const move=(parent,...nodes)=>nodes.filter(Boolean).forEach(n=>parent.append(n));
 const legacy=n=>{if(n)n.classList.add('tg26-legacy');};
 function stageNav(){
  const stage=$('stage'),main=q('.stage-main',stage),bar=$('tg123-host-bar'),consoleNode=$('tg17-console'),cockpit=$('tg104-cockpit'),room=q('.tg104-room-panel',cockpit),catalog=q('.tg100-catalog-panel',cockpit),side=q('.tg100-side',stage),queue=q('.stage-sidebar',side),rank=q('.stage-rank-panel',side),screen=q('.screen-row',main),header=q('.stage-header',stage);
  if(!stage||!main||!bar||!consoleNode||!room||!catalog||!side||!queue||!rank||!screen||!header||stage.dataset.tg50Ready)return;
  stage.dataset.tg50Ready='true';
  const drawer=el('dialog','tg50-drawer');drawer.id='tg50-drawer';drawer.setAttribute('aria-labelledby','tg50-drawer-title');
  const heading=el('header','tg50-drawer-head'),title=el('h2','','Painel');title.id='tg50-drawer-title';const close=button('Voltar',()=>drawer.close());close.classList.add('tg61-back');heading.append(title,close);drawer.append(heading);stage.append(drawer);
  const sections=new Map();let opener=null;
  function section(key,label,...nodes){const panel=el('section','tg50-panel');panel.dataset.tg50Section=key;panel.hidden=true;move(panel,...nodes);drawer.append(panel);sections.set(key,{panel,label});return panel;}
  function show(key,trigger){const entry=sections.get(key);if(!entry||stage.hidden)return;opener=trigger;for(const x of sections.values())x.panel.hidden=x!==entry;title.textContent=entry.label;if(!drawer.open)drawer.showModal();entry.panel.scrollTop=0;close.focus({preventScroll:true});}
  drawer.addEventListener('close',()=>{if(!document.querySelector('dialog[open]')&&opener?.isConnected&&!stage.hidden)opener.focus({preventScroll:true});opener=null;});
  const quick=(label,key)=>{const b=button(label,()=>show(key,b));b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls',drawer.id);return b;};
  const recado=q('.tg04-stage-recado',stage),tools=q('.tg19-stage-tool-grid',room),help=q('.tg193-help-tools',room),remoteQR=$('tg30-control-qr-details');
  const audio=$('start-audio'),play=$('play-pause'),skip=$('skip-track'),call=q('[data-tg123-host-command="call"]',bar),theme=$('theme-cycle'),settings=q('.open-settings',tools),voice=q('[data-tg30-voice-open]',main),solo=$('tg18-solo-button');
  const status=el('div','tg50-status');move(status,$('command-next'),$('command-mics'),$('command-queue'),q('.progress-wrap',consoleNode));
  for(const n of [play,skip,audio,theme])n?.classList.remove('tg26-legacy');
  for(const n of [q('[data-tg123-host-command="toggle"]',bar),q('[data-tg123-host-command="next"]',bar),q('[data-tg123-host-command="volumes"]',bar),$('tg21-volume-panel'),$('contrast-toggle'),$('open-scoreboard')])legacy(n);
  const musicTarget=q('.stage-hit-library [data-catalog-open]',stage);
  const music=button('Músicas',()=>{if(musicTarget){if(drawer.open)drawer.close();musicTarget.click();}});
  music.id='tg58-stage-music';
  const queueButton=quick('Fila','fila'),rankButton=quick('Placar','placar'),mixerButton=quick('Áudio','audio'),roomButton=quick('Sala','sala');queueButton.id='tg63-stage-queue';rankButton.id='tg63-stage-rank';roomButton.id='tg63-stage-room';
  move(bar,play,skip,call,audio,queueButton,music,mixerButton,rankButton,roomButton);screen.after(bar);bar.after(status);
  if(theme){theme.classList.remove('full');theme.textContent='Tema';theme.setAttribute('aria-label','Trocar tema do palco');q('.stage-actions',header)?.prepend(theme);}
  if(settings)settings.textContent='Ajustes e acessibilidade';
  const roomActions=el('div','tg50-room-actions');const switcher=$('stage-switch'),end=$('stage-exit');if(switcher)switcher.textContent='Minhas salas';if(end)end.textContent='Encerrar festa';
  move(roomActions,settings,voice,switcher,end);if(switcher)switcher.setAttribute('title','Volta às suas salas sem encerrar a festa');if(end)end.setAttribute('title','Encerra para todos, após confirmação');room.prepend(roomActions);
  if(remoteQR)room.append(remoteQR);if(help&&tools){move(tools,...help.children);help.remove();}
  window.TG74_DIVA_STUDIO?.mount();legacy($('tg74-voice-preview'));
  const voiceControls=q('.tg05-voice-controls',consoleNode);if(voiceControls)voiceControls.setAttribute('aria-label','Drag Diva');
  const catalogDetails=catalog.closest('details'),roomDetails=room.closest('details');if(roomDetails)roomDetails.open=true;if(catalogDetails)catalogDetails.open=false;
  section('fila','Fila e participantes',queue,$('stage-command'),q('.singer-strip',main));legacy(catalogDetails||catalog);legacy($('open-add-song'));section('placar','Placar',rank);section('audio','Mesa de áudio',consoleNode,solo,$('tg18-solo-status'));if(recado)room.append(recado);section('sala','Configurações da sala',cockpit);
  legacy(musicTarget);legacy(q('.side-helper',queue));
  drawer.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.matches('.open-settings,[data-tg124-profile],[data-tg30-voice-open],#ranking-full-link,#open-add-song,#stage-switch,#stage-exit,#open-stage-faq,[data-tg193-tour],[data-tg193-support]')&&drawer.open)drawer.close();},true);
  const dock=$('tg192-solo-dock'),post=$('tg123-post-score');if(dock)status.after(dock);if(post)status.after(post);
  const measured=[header,q('.stage-meta',main),bar,status,dock,post,$('tg05-audio-caption'),$('tg124-diva-announcement')];
  const measure=()=>{if(stage.hidden)return;const occupied=measured.filter(n=>n&&!n.hidden&&n.getClientRects().length).reduce((sum,n)=>sum+n.getBoundingClientRect().height,0);const h=Math.max(180,Math.floor(window.innerHeight-occupied-28));const val=h+'px';if(stage.style.getPropertyValue('--tg50-player-height')!==val)stage.style.setProperty('--tg50-player-height',val);};
  if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(measure);for(const n of measured)if(n)observer.observe(n);}
  window.addEventListener('resize',measure);window.addEventListener('temgogo:view',()=>{if(drawer.open)drawer.close();measure();});document.addEventListener('fullscreenchange',measure);
  const cat=$('catalog-dialog');cat?.addEventListener('close',()=>{if(!stage.hidden&&!document.querySelector('dialog[open]')&&music.isConnected)music.focus({preventScroll:true});});
  const syncSolo=()=>{
    const solo=stage.dataset.tg100Mode==='solo';
    stage.dataset.tg63Experience=solo?'solo':'classic';
    queueButton.textContent=solo?'Minha lista':'Fila';music.textContent=solo?'Escolher música':'Músicas';roomButton.textContent=solo?'Opções':'Sala';
    sections.get('fila').label=solo?'Minha lista de músicas':'Fila e participantes';
    sections.get('sala').label=solo?'Opções da Carreira Solo':'Configurações da sala';
    if(switcher)switcher.textContent=solo?'Voltar aos modos':'Minhas salas';
    if(end)end.textContent=solo?'Encerrar sessão':'Encerrar festa';
    if(drawer.open){const entry=[...sections.values()].find(x=>!x.panel.hidden);if(entry)title.textContent=entry.label;}
  };
  new MutationObserver(syncSolo).observe(stage,{attributes:true,attributeFilter:['data-tg100-mode']});
  window.addEventListener('temgogo:view',syncSolo);syncSolo();measure();
 }
 function remoteNav(){
  const r=$('tg18-remote'),header=q('.tg18-remote-header',r),control=$('tg19-remote-control'),info=$('tg19-remote-singing');if(!header||!control||!info||r.dataset.tg28Ready)return;r.dataset.tg28Ready='true';
  const more=el('details','tg26-remote-more');more.append(el('summary','','☰ Sala e ajuda'));
  const wrap=el('div','tg26-remote-menu');more.append(wrap);
  const help=q('.tg193-remote-help',header);wrap.append(el('h3','','Festa'));move(wrap,$('tg18-remote-back'),$('tg04-remote-end'),$('tg18-remote-stage'));wrap.append(el('h3','','Ajuda'));move(wrap,help);
  header.append(more);
  const moderation=$('tg-beta-host-moderate');if(moderation)move(wrap,moderation);legacy($('tg-beta-remote-nav'));
  const closeMenu=()=>{more.open=false;};wrap.addEventListener('click',e=>{if(e.target.closest('button'))closeMenu();});
  const music=$('tg18-remote-music');if(music){music.textContent='Músicas';music.classList.add('tg28-remote-catalog','button-primary');q('.tg18-remote-grid',control)?.append(music);}
  const audio=q('.tg05-remote-audio',control);if(audio){audio.open=false;const summary=q('summary',audio);if(summary)summary.textContent='🎚 Mesa de áudio da TV';
   const effects=el('section','tg28-effects');effects.append(el('h3','','Drag Diva'));const pads=el('section','tg26-effects');
   const send=(command,value)=>window.dispatchEvent(new CustomEvent('temgogo:remote-audio',{detail:{command,value}}));
   for(const [cmd,value,label] of [['diva-auto',1,'Ativar narração'],['diva-auto',0,'Desativar narração']])pads.append(button(label,()=>send(cmd,value)));
   const status=el('p','tg26-note','A narração inclui efeitos automáticos. Consulte a TV.');status.id='tg26-remote-audio-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');pads.append(status);effects.append(pads);audio.append(effects);
  }
  const recado=$('tg04-remote-send')?.closest('details');if(recado){const label=q('summary',recado);if(label)label.textContent='💌 Recado para a TV';recado.open=false;}const appearance=q('.open-settings',control);if(appearance){appearance.textContent='Aparência da TV';wrap.insertBefore(appearance,help?.previousElementSibling||help||null);}const remoteHint=q('.tg-remote-help-note',control),queue=q('.tg19-remote-queue',control),feedback=$('tg18-remote-feedback'),grid=q('.tg18-remote-grid',control);if(feedback&&grid)grid.after(feedback);if(queue&&recado)queue.after(recado);if(remoteHint&&queue){const hint=q('.tg19-remote-queue-hint',queue);if(hint){hint.textContent='Toque em Preparar para chamar um cantor.';legacy(remoteHint);}else queue.prepend(remoteHint);}
  legacy($('tg18-remote-rename')); // existing profile menu delegates to this action
  const end=$('tg04-remote-end');if(end){end.textContent='⏻ Encerrar festa para todos';end.title='Finaliza para todos após confirmação';}
  const back=$('tg18-remote-back');if(back){back.textContent='⇄ Minhas salas';back.title='Volta às suas salas sem encerrar a festa';}const share=$('tg04-remote-invite');if(share)wrap.insertBefore(share,back||wrap.firstChild);
  window.addEventListener('temgogo:view',()=>{more.open=false;});
 }
 function guestNav(){
  const guest=$('guest'),top=q('.tg12-participant-top',guest),music=$('tg-r05-catalog-tab');if(!guest||!top||!music||guest.dataset.tg58Ready)return;
  guest.dataset.tg58Ready='true';
  const more=el('details','tg58-guest-more');more.append(el('summary','','Sala'));const menu=el('div','tg58-guest-menu');more.append(menu);
  const people=$('tg96-party-open'),help=$('open-guest-faq'),sw=$('guest-switch'),leave=$('leave-party'),bottom=q('.guest-bottom',guest),helpTools=q('.tg193-help-tools',bottom);
  if(people)people.textContent='Pessoas da festa';if(help)help.textContent='Ajuda';if(sw){sw.textContent='Minhas salas';sw.title='Trocar de sala sem encerrar a festa';}if(leave)leave.textContent='Sair desta festa';
  move(menu,people,sw,help,helpTools,leave);top.append(more);
  const extra=q('.guest-song-search-card',guest),install=$('guest-install');if(install)menu.append(install);const push=$('tg19-push-shortcut'),pushBackup=$('tg18-push-cta');if(push&&pushBackup){push.textContent='🔔 Avisar minha vez';const syncPush=()=>pushBackup.classList.toggle('tg26-legacy',!push.hidden&&!push.closest('[hidden]'));syncPush();window.addEventListener('temgogo:view',syncPush);new MutationObserver(syncPush).observe(push,{attributes:true,attributeFilter:['hidden']});}
  legacy(extra);legacy(q('.guest-hit-library',guest));for(const n of guest.querySelectorAll('.tg16-guest-actions [data-catalog-open],#tg16-queue-shortcut,#tg16-score-shortcut'))legacy(n);const latest=$('guest-all-scores');if(latest)latest.textContent='Placar completo';
  const recado=$('tg17-guest-message');if(recado){const d=el('details','tg61-guest-extra');d.append(el('summary','','Recados'));recado.before(d);d.append(recado);}
  const promo=q('.tg18-account-promo',guest);if(promo){const d=el('details','tg61-guest-extra');d.append(el('summary','','Conta e notificações'));promo.before(d);d.append(promo);const sync=()=>{const b=window.TG_BETA_BRIDGE?.();if(!b?.user)return;d.querySelector('summary').textContent=b.isAnonymous(b.user)?'Salvar minha participação':'Minha conta e notificações';};window.addEventListener('temgogo:view',sync);sync();}
  const nav=q('.mobile-switch',guest);if(nav)nav.setAttribute('aria-label','Músicas, fila, microfone, placar e perfil');
  music.setAttribute('aria-label','Músicas');const labels=music.querySelectorAll('span');if(labels.length>1)labels[1].textContent='Músicas';
  menu.addEventListener('click',e=>{if(e.target.closest('button'))more.open=false;});window.addEventListener('temgogo:view',()=>{more.open=false;});
 }
 function profile(){
  const quick=$('tg124-profile-menu'),social=$('tg-beta-dialog'),guest=$('guest-profile-dialog');if(!quick||!social||!guest||quick.dataset.tg60Ready)return;quick.dataset.tg60Ready='true';
  const blocked=()=>document.body.classList.contains('tg103-mic-focus')||document.body.classList.contains('tg103-remote-mic-focus');
  const open=()=>{if(blocked())return;const b=window.TG_BETA_BRIDGE?.();if(!b?.user)return;for(const d of [$('tg50-drawer'),quick,$('tg20-host-profile-dialog'),guest,social])if(d?.open)d.close();
    if(!b.isAnonymous(b.user)){window.TG_BETA_OPEN_TAB?.('profile');return;}
    if(b.role!=='guest')return;const own=b.members?.find(m=>m.user_id===b.user.id);$('guest-profile-name').value=own?.display_name||$('guest-display-name').textContent;const chosen=[...$('profile-avatar-options').querySelectorAll('input')].find(n=>n.value===b.avatar);if(chosen)chosen.checked=true;guest.showModal();
  };
  const selectors='[data-tg124-profile],[data-tg-beta-open="profile"],#tg-beta-stage-profile,#tg-beta-lobby-profile,#tg-beta-remote-profile,#edit-guest-profile,#tg18-remote-rename,[data-tg124-action="edit"],[data-tg124-action="privacy"]';
  document.addEventListener('click',e=>{if(!e.target.closest(selectors))return;e.preventDefault();e.stopImmediatePropagation();open();},true);
  document.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key)||!e.target.matches('[data-tg124-profile]:not(button)'))return;e.preventDefault();e.stopImmediatePropagation();open();},true);
  for(const id of ['tg-beta-stage-profile','tg-beta-lobby-profile','tg-beta-remote-profile','edit-guest-profile','account-password-open','logout-button'])legacy($(id));
  legacy(q('#lobby .header-control-group .open-settings'));legacy(q('#guest .guest-live .open-settings'));
  for(const b of document.querySelectorAll('.tg124-profile-shortcut'))b.textContent='Meu perfil';
  const panel=q('[data-tg-beta-panel="profile"]',social),save=$('tg-p-save'),anonInner=q('.modal-inner',guest);
  if(panel&&save){
    const socialDetails=el('details','tg60-social-options');socialDetails.append(el('summary','','Identificação social e privacidade'));
    for(const id of ['tg-p-handle','tg-p-insta','tg-p-insta-vis','tg-p-photo-vis','tg-p-score-vis','tg-p-legal','tg-p-age','tg-p-best','tg-p-rank']){const label=$(id)?.closest('label');if(label)socialDetails.append(label);}
    const bora=q('.tg95-bora',panel);if(bora){const links=el('details','tg60-social-options tg63-social-links');links.append(el('summary','','Bora de Rolê · link opcional'));bora.before(links);links.append(bora);}save.before(socialDetails);
  }
  const actions=(target,isGuest)=>{if(!target)return;const box=el('div','tg60-profile-actions');
    const action=(label,fn)=>{box.append(button(label,fn));};
    const close=()=>{if(guest.open)guest.close();if(social.open)social.close();};
    action('Aparência',()=>{const view=$(document.body.dataset.currentView);close();(q('.open-settings',view)||q('.open-settings'))?.click();});
    action('Identidade vocal',()=>{close();const view=$(document.body.dataset.currentView);(q('[data-tg30-voice-open]',view)||q('[data-tg30-voice-open]'))?.click();});
    if(!isGuest){action('Minhas notas',()=>{close();q('[data-tg124-action="history"]',quick)?.click();});action('Alterar senha',()=>{close();$('account-password-open')?.click();});action('Sair da conta',()=>{close();q('[data-tg124-action="logout"]',quick)?.click();});}else{action('Criar conta',()=>{close();$('tg18-account-cta')?.click();});}
    target.append(box);
  };
  actions(panel,false);actions(anonInner,true);
  const syncEntry=()=>{const b=window.TG_BETA_BRIDGE?.(),name=$('guest-name');if(name)name.readOnly=!!(b?.user&&!b.isAnonymous(b.user));};
  window.addEventListener('temgogo:view',syncEntry);syncEntry();
  for(const d of [quick,$('tg20-host-profile-dialog')])if(d)new MutationObserver(()=>{if(d.open)open();}).observe(d,{attributes:true,attributeFilter:['open']});
 }
 function faq(){
  const dlg=$('faq-dialog'),inner=q('.modal-inner',dlg);if(!inner)return;
  const entries=[...inner.querySelectorAll('details')];const list=el('div','tg26-faq-list');const footer=el('div','tg26-faq-footer');
  const first=entries[0];if(first){first.before(list);const priorities=['Como entro na festa?','Passo a passo: como começar uma festa na TV?','Como canto?','Como sei se o microfone funciona?','Como uso o celular para controlar a festa e cantar?','Como encontro músicas sem gastar a busca externa?','Onde vejo minha nota?','Como funciona a nota?'];const priority=d=>{const i=priorities.indexOf(q('summary',d)?.textContent.trim());return i<0?priorities.length:i;};entries.sort((x,y)=>priority(x)-priority(y));for(const d of entries)d.open=false;move(list,...entries);}
  move(footer,q('.tg193-faq-actions',inner),$('faq-done'));inner.append(footer);
  dlg.addEventListener('close',()=>{for(const d of entries)d.open=false;const search=$('tg05-faq-search');if(search){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));}list.scrollTop=0;});
  for(const d of entries)d.addEventListener('toggle',()=>{if(d.open)for(const x of entries)if(x!==d)x.open=false;});
 }
 function boot(){stageNav();remoteNav();guestNav();profile();faq();}
 window.addEventListener('temgogo:host-cockpit-ready',()=>queueMicrotask(stageNav));
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
