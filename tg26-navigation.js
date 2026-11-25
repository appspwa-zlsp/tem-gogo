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
  const heading=el('header','tg50-drawer-head'),title=el('h2','','Painel');title.id='tg50-drawer-title';const close=button('Voltar',()=>drawer.close());heading.append(title,close);drawer.append(heading);stage.append(drawer);
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
  const queueButton=quick('Fila','fila'),rankButton=quick('Placar','placar'),mixerButton=quick('Áudio','audio'),roomButton=quick('Sala','sala');
  move(bar,play,skip,call,audio,queueButton,music,mixerButton,rankButton,roomButton);screen.after(bar);bar.after(status);
  if(theme){theme.classList.remove('full');theme.textContent='Tema';theme.setAttribute('aria-label','Trocar tema do palco');q('.stage-actions',header)?.prepend(theme);}
  if(settings)settings.textContent='Ajustes e acessibilidade';
  const roomActions=el('div','tg50-room-actions');const switcher=$('stage-switch'),end=$('stage-exit');if(switcher)switcher.textContent='Minhas salas';if(end)end.textContent='Encerrar festa';
  move(roomActions,settings,voice,switcher,el('small','tg26-note','A festa permanece aberta.'),end,el('small','tg26-note','Finaliza para todos após confirmação.'));room.prepend(roomActions);
  if(remoteQR)room.append(remoteQR);if(help&&tools){move(tools,...help.children);help.remove();}
  window.TG74_DIVA_STUDIO?.mount();legacy($('tg74-voice-preview'));legacy(q('.tg26-effects',consoleNode));
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
  const cat=$('catalog-dialog');cat?.addEventListener('close',()=>{if(!stage.hidden&&!document.querySelector('dialog[open]'))music.focus({preventScroll:true});});
  measure();
 }
 function remoteNav(){
  const r=$('tg18-remote'),header=q('.tg18-remote-header',r),control=$('tg19-remote-control'),info=$('tg19-remote-singing');if(!header||!control||!info||r.dataset.tg28Ready)return;r.dataset.tg28Ready='true';
  const more=el('details','tg26-remote-more');more.append(el('summary','','☰ Sala e ajuda'));
  const wrap=el('div','tg26-remote-menu');more.append(wrap);
  const help=q('.tg193-remote-help',header);wrap.append(el('h3','','Gerenciar festa'));move(wrap,$('tg18-remote-back'));wrap.append(el('small','tg26-note','Volta às suas salas sem encerrar a festa.'));move(wrap,$('tg04-remote-end'));wrap.append(el('small','tg26-note','Encerra a festa para todos, mediante confirmação.'));move(wrap,$('tg18-remote-stage'));wrap.append(el('h3','','Ajuda'));move(wrap,help);
  header.append(more);
  const moderation=$('tg-beta-host-moderate');if(moderation)move(wrap,moderation);legacy($('tg-beta-remote-nav'));
  const closeMenu=()=>{more.open=false;};wrap.addEventListener('click',e=>{if(e.target.closest('button'))closeMenu();});
  const music=$('tg18-remote-music');if(music){music.textContent='Músicas';music.classList.add('tg28-remote-catalog','button-primary');q('.tg18-remote-grid',control)?.after(music);}
  const audio=q('.tg05-remote-audio',control);if(audio){audio.open=false;const summary=q('summary',audio);if(summary)summary.textContent='🎚 Mesa de áudio da TV';
   const effects=el('details','tg192-remote-advanced tg28-effects');effects.append(el('summary','','✦ Drag Diva e efeitos da TV'));const pads=el('section','tg26-effects');pads.append(el('p','tg26-note','A TV precisa estar com o som ativo. Falas exigem publicação pela Central; efeitos somente no intervalo.'));
   const send=(command,value)=>window.dispatchEvent(new CustomEvent('temgogo:remote-audio',{detail:{command,value}}));
   for(const [cmd,value,label] of [['diva-auto',1,'Autorizar falas'],['diva-auto',0,'Silenciar falas']])pads.append(button(label,()=>send(cmd,value)));
   const status=el('p','tg26-note','Consulte a TV para conferir as falas.');status.id='tg26-remote-audio-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');pads.append(status);effects.append(pads);audio.after(effects);
  }
  const recado=$('tg04-remote-send')?.closest('details');if(recado){const hint=el('p','tg26-note','O texto fica na fila de recados e aparece no intervalo da TV. Não é uma gravação de voz.');recado.insertBefore(hint,$('tg04-remote-send'));}
  legacy($('tg18-remote-rename')); // existing profile menu delegates to this action
  const end=$('tg04-remote-end');if(end)end.textContent='⏻ Encerrar festa para todos';
  const back=$('tg18-remote-back');if(back)back.textContent='⇄ Minhas salas';
  window.addEventListener('temgogo:view',()=>{more.open=false;});
 }
 function guestNav(){
  const guest=$('guest'),top=q('.tg12-participant-top',guest),music=$('tg-r05-catalog-tab');if(!guest||!top||!music||guest.dataset.tg58Ready)return;
  guest.dataset.tg58Ready='true';
  const more=el('details','tg58-guest-more');more.append(el('summary','','Sala'));const menu=el('div','tg58-guest-menu');more.append(menu);
  const people=$('tg96-party-open'),help=$('open-guest-faq'),sw=$('guest-switch'),leave=$('leave-party'),bottom=q('.guest-bottom',guest),helpTools=q('.tg193-help-tools',bottom);
  if(people)people.textContent='Pessoas da festa';if(help)help.textContent='Ajuda';if(sw)sw.textContent='Minhas salas';if(leave)leave.textContent='Sair desta festa';
  move(menu,people,sw,help,helpTools,leave);top.append(more);
  const extra=q('.guest-song-search-card',guest),install=$('guest-install');if(install)menu.append(install);
  legacy(extra);legacy(q('.guest-hit-library',guest));for(const n of guest.querySelectorAll('.tg16-guest-actions [data-catalog-open]'))legacy(n);
  music.setAttribute('aria-label','Músicas');const labels=music.querySelectorAll('span');if(labels.length>1)labels[1].textContent='Músicas';
  menu.addEventListener('click',e=>{if(e.target.closest('button'))more.open=false;});window.addEventListener('temgogo:view',()=>{more.open=false;});
 }
 function profile(){
  const dlg=$('tg124-profile-menu');if(!dlg)return;
  const content=q('.tg124-profile-inner',dlg);if(!content)return;
  const leave=q('[data-tg124-action="leave"]',dlg),change=q('[data-tg124-action="change"]',dlg),help=q('[data-tg124-action="help"]',dlg);
  legacy(change);legacy(help);
  for(const id of ['tg-beta-stage-profile','tg-beta-lobby-profile','tg-beta-remote-profile'])legacy($(id));
  for(const b of document.querySelectorAll('#stage .stage-actions .tg124-profile-shortcut,#lobby .header-control-group .tg124-profile-shortcut,#tg18-remote .tg18-remote-header .tg124-profile-shortcut')){b.hidden=false;b.textContent='👤 Minha conta';}
  legacy($('edit-guest-profile'));legacy($('account-password-open'));legacy($('logout-button'));
  legacy(q('#lobby .header-control-group .open-settings')); // delegated from Minha conta
  legacy(q('#guest .guest-live .open-settings'));
  const guest=$('guest');if(guest){const profileTab=q('.tg-beta-unified-tab',guest);if(profileTab)profileTab.textContent='👤 Perfil';}
  const appearance=button('🎨 Aparência pessoal',()=>{dlg.close();const view=$(document.body.dataset.currentView);(q('.open-settings',view||document)||q('.open-settings'))?.click();});appearance.id='tg26-profile-appearance';content.insertBefore(appearance,leave);
  const password=button('🔒 Alterar senha',()=>{dlg.close();$('account-password-open')?.click();});password.id='tg26-profile-password';content.insertBefore(password,leave); // the room and help paths now live in their own menus
  const sync=()=>{const view=document.body.dataset.currentView;leave.hidden=view!=='guest';appearance.hidden=view==='stage'||view==='tg18-remote';const b=window.TG_BETA_BRIDGE?.();password.hidden=!b?.user||b.isAnonymous?.(b.user);if(view==='guest')leave.textContent='↩ Desvincular desta festa';};
  new MutationObserver(sync).observe(dlg,{attributes:true,attributeFilter:['open']});sync();
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
