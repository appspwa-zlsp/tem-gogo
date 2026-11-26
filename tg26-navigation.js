/* R26 — Navigation only. Keep existing nodes, handlers and permissions. */
(()=>{'use strict';
 const $=id=>document.getElementById(id), q=(s,r=document)=>r?.querySelector(s)||null;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const button=(label,fn)=>{const b=el('button','button button-outline',label);b.type='button';b.addEventListener('click',fn);return b;};
 const move=(parent,...nodes)=>nodes.filter(Boolean).forEach(n=>parent.append(n));
 const legacy=n=>{if(n)n.classList.add('tg26-legacy');};
 // R86: one menu-row component. Decorate existing buttons; do not replace their handlers.
 const menuRow=(node,icon,label,danger=false)=>{
   if(!node)return node;
   node.classList.add('tg86-menu-row');node.classList.toggle('tg86-danger',danger);
   node.dataset.tg86Icon=icon;node.textContent=label;node.setAttribute('aria-label',label);
   return node;
 };
 const row=(node,icon,label,danger=false)=>menuRow(node,icon,label,danger);
 const hideLegacy=n=>{if(n){legacy(n);n.hidden=true;}};
 const helpRow=n=>row(n,'?','Central de ajuda');
 function stageNav(){
  const stage=$('stage'),main=q('.stage-main',stage),bar=$('tg123-host-bar'),consoleNode=$('tg17-console'),cockpit=$('tg104-cockpit'),room=q('.tg104-room-panel',cockpit),catalog=q('.tg100-catalog-panel',cockpit),side=q('.tg100-side',stage),queue=q('.stage-sidebar',side),rank=q('.stage-rank-panel',side),screen=q('.screen-row',main),header=q('.stage-header',stage);
  if(!stage||!main||!bar||!consoleNode||!room||!catalog||!side||!queue||!rank||!screen||!header||stage.dataset.tg50Ready)return;
  stage.dataset.tg50Ready='true';
  const drawer=el('dialog','tg50-drawer');drawer.id='tg50-drawer';drawer.setAttribute('aria-labelledby','tg50-drawer-title');
  const heading=el('header','tg50-drawer-head'),title=el('h2','','Painel');title.id='tg50-drawer-title';const close=button('Voltar',()=>drawer.close());close.classList.add('tg61-back');heading.append(title,close);drawer.append(heading);stage.append(drawer);
  const sections=new Map();let opener=null;
  function section(key,label,...nodes){const panel=el('section','tg50-panel');panel.dataset.tg50Section=key;panel.hidden=true;move(panel,...nodes);drawer.append(panel);sections.set(key,{panel,label});return panel;}
  function show(key,trigger){const entry=sections.get(key);if(!entry||stage.hidden)return;opener=trigger;for(const x of sections.values())x.panel.hidden=x!==entry;title.textContent=entry.label;drawer.dataset.tg86Menu=key;if(!drawer.open)drawer.showModal();entry.panel.scrollTop=0;close.focus({preventScroll:true});}
  drawer.addEventListener('close',()=>{if(!document.querySelector('dialog[open]')&&opener?.isConnected&&!stage.hidden)opener.focus({preventScroll:true});opener=null;});
  const quick=(label,key)=>{const b=button(label,()=>show(key,b));b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls',drawer.id);return b;};
  const recado=q('.tg04-stage-recado',stage),tools=q('.tg19-stage-tool-grid',room),help=q('.tg193-help-tools',room),remoteQR=$('tg30-control-qr-details');
  const end=$('stage-exit'),play=$('play-pause'),skip=$('skip-track'),call=q('[data-tg123-host-command="call"]',bar),theme=$('theme-cycle'),settings=q('.open-settings',tools),voice=q('[data-tg30-voice-open]',main),solo=$('tg18-solo-button');
  const status=el('div','tg50-status');move(status,$('command-next'),$('command-mics'),$('command-queue'),q('.progress-wrap',consoleNode));
  for(const n of [play,skip,end,theme])n?.classList.remove('tg26-legacy');
  for(const n of [q('[data-tg123-host-command="toggle"]',bar),q('[data-tg123-host-command="next"]',bar),q('[data-tg123-host-command="volumes"]',bar),$('tg21-volume-panel'),$('contrast-toggle'),$('open-scoreboard')])legacy(n);
  const musicTarget=q('.stage-hit-library [data-catalog-open]',stage);
  const music=button('Músicas',()=>{if(musicTarget){if(drawer.open)drawer.close();musicTarget.click();}});
  music.id='tg58-stage-music';
  const queueButton=quick('Fila','fila'),rankButton=quick('Placar','placar'),mixerButton=quick('Áudio','audio'),roomButton=quick('Sala','sala');queueButton.id='tg63-stage-queue';rankButton.id='tg63-stage-rank';roomButton.id='tg63-stage-room';
  move(bar,play,skip,end,call,queueButton,music,mixerButton,rankButton,roomButton);screen.after(bar);bar.after(status);
  if(theme){theme.classList.remove('full');theme.textContent='Tema';theme.setAttribute('aria-label','Trocar tema do palco');q('.stage-actions',header)?.prepend(theme);}
  if(settings)settings.textContent='Ajustes e acessibilidade';
  const roomActions=el('div','tg50-room-actions');const switcher=$('stage-switch');if(switcher)switcher.textContent='Minhas salas';if(end)end.textContent='Encerrar festa';
  row(settings,'⚙','Ajustes e acessibilidade');row(voice,'♪','Identidade vocal');row(switcher,'↶','Minhas salas');if(end){end.classList.add('tg88-end-stage');end.classList.remove('tg86-menu-row');end.setAttribute('aria-label','Encerrar festa');}const stageHelp=helpRow($('open-stage-faq'));
  move(roomActions,settings,voice,switcher,stageHelp);if(switcher)switcher.setAttribute('title','Volta às suas salas sem encerrar a festa');if(end)end.setAttribute('title','Encerra para todos, após confirmação');room.prepend(roomActions);
  if(remoteQR)room.append(remoteQR);if(help)hideLegacy(help);
  window.TG74_DIVA_STUDIO?.mount();legacy($('tg74-voice-preview'));
  const voiceControls=q('.tg05-voice-controls',consoleNode);if(voiceControls)voiceControls.setAttribute('aria-label','Drag Diva');
  const catalogDetails=catalog.closest('details'),roomDetails=room.closest('details');if(roomDetails)roomDetails.open=true;if(catalogDetails)catalogDetails.open=false;
  section('fila','Fila e participantes',queue,$('stage-command'),q('.singer-strip',main));legacy(catalogDetails||catalog);legacy($('open-add-song'));section('placar','Placar',rank);section('audio','Mesa de áudio',consoleNode,solo,$('tg18-solo-status'));if(recado)room.append(recado);section('sala','Configurações da sala',cockpit);
  legacy(musicTarget);legacy(q('.side-helper',queue));
  drawer.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.matches('.open-settings,[data-tg124-profile],[data-tg30-voice-open],#ranking-full-link,#open-add-song,#stage-switch,#stage-exit,#open-stage-faq,[data-tg193-tour],[data-tg193-support]')&&drawer.open)drawer.close();},true);
  const dock=$('tg192-solo-dock'),post=$('tg123-post-score');if(dock)status.after(dock);if(post)status.after(post);
  const measured=[header,q('.stage-meta',main),bar,status,dock,post];
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
    row(switcher,'↶',solo?'Voltar aos modos':'Minhas salas');
    if(end){const label=solo?'Encerrar sessão':'Encerrar festa';end.textContent='⏻ '+label;end.setAttribute('aria-label',label);end.title=solo?'Encerra a sessão Solo após confirmação':'Encerra a festa para todos após confirmação';}
    if(drawer.open){const entry=[...sections.values()].find(x=>!x.panel.hidden);if(entry)title.textContent=entry.label;}
  };
  new MutationObserver(syncSolo).observe(stage,{attributes:true,attributeFilter:['data-tg100-mode']});
  window.addEventListener('temgogo:view',syncSolo);syncSolo();measure();
 }
 function remoteNav(){
  const r=$('tg18-remote'),header=q('.tg18-remote-header',r),control=$('tg19-remote-control'),info=$('tg19-remote-singing');if(!header||!control||!info||r.dataset.tg28Ready)return;r.dataset.tg28Ready='true';
  // R83: menu em diálogo de largura independente do cabeçalho.
  const more=button('Sala e ajuda',()=>{if(!r.hidden&&!document.body.classList.contains('tg103-remote-mic-focus')&&!menu.open)menu.showModal();});more.classList.add('tg83-remote-menu-button');more.setAttribute('aria-haspopup','dialog');more.setAttribute('aria-controls','tg83-remote-menu');header.append(more);
  const menu=el('dialog','tg81-mobile-drawer tg83-remote-menu');menu.id='tg83-remote-menu';menu.setAttribute('aria-labelledby','tg83-remote-menu-title');
  const heading=el('header','tg81-drawer-head'),title=el('h2','','Minha sala');title.id='tg83-remote-menu-title';heading.append(title,button('Voltar',()=>menu.close()));
  const wrap=el('div','tg81-drawer-content');menu.append(heading,wrap);r.append(menu);
  const help=q('.tg193-remote-help',header),moderation=$('tg-beta-host-moderate');
  const group=(label,...nodes)=>{const section=el('section','tg81-room-actions');section.append(el('h3','',label));move(section,...nodes);wrap.append(section);return section;};
  const end=$('tg04-remote-end'),back=$('tg18-remote-back'),share=$('tg04-remote-invite'),stage=$('tg18-remote-stage'),appearance=q('.open-settings',control);
  if(end){end.textContent='Encerrar festa para todos';end.title='Finaliza para todos após confirmação';end.classList.add('tg83-danger');}
  if(back){back.textContent='Minhas salas';back.title='Volta às suas salas sem encerrar a festa';}
  if(stage){stage.textContent='Abrir palco neste aparelho';stage.title='Feche o palco anterior primeiro';}
  if(appearance)appearance.textContent='Aparência da TV';
  if(moderation)moderation.textContent='Segurança';
  row(share,'↗','Compartilhar convite');row(back,'↶','Minhas salas');row(stage,'▣','Abrir palco neste aparelho');row(appearance,'◈','Aparência da TV');row(end,'⏻','Encerrar festa para todos',true);row(moderation,'◇','Segurança');
  const remoteHelp=helpRow(q('[data-tg193-faq]',help));group('Festa',share,back,stage,appearance);group('Ajuda e segurança',remoteHelp,moderation,end);hideLegacy(help);
  legacy($('tg-beta-remote-nav'));
  const closeMenu=()=>{if(menu.open)menu.close();};wrap.addEventListener('click',e=>{if(e.target.closest('button'))closeMenu();},true);
  menu.addEventListener('click',e=>{if(e.target===menu)closeMenu();});menu.addEventListener('close',()=>{if(!r.hidden&&!document.querySelector('dialog[open]')&&!document.body.classList.contains('tg103-remote-mic-focus'))more.focus({preventScroll:true});});
  const music=$('tg18-remote-music'),tabs=q('.tg19-remote-tabs',r);if(music&&tabs){music.textContent='♫ Escolher música · + Fila';music.setAttribute('aria-label','Abrir biblioteca de músicas e adicionar à fila');music.classList.add('tg83-remote-music','button-primary');tabs.before(music);}
  const sync=()=>{if(r.hidden||document.body.classList.contains('tg103-remote-mic-focus'))closeMenu();};
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
  const audio=q('.tg05-remote-audio',control);if(audio){audio.open=false;const summary=q('summary',audio);if(summary)summary.textContent='🎚 Mesa de áudio da TV';
   const effects=el('section','tg28-effects');effects.append(el('h3','','Drag Diva'));const pads=el('section','tg26-effects');
   const send=(command,value)=>window.dispatchEvent(new CustomEvent('temgogo:remote-audio',{detail:{command,value}}));
   for(const [cmd,value,label] of [['diva-auto',1,'Ativar narração'],['diva-auto',0,'Desativar narração']])pads.append(button(label,()=>send(cmd,value)));
   const status=el('p','tg26-note','A narração inclui efeitos automáticos. Consulte a TV.');status.id='tg26-remote-audio-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');pads.append(status);effects.append(pads);audio.append(effects);
  }
  const recado=$('tg04-remote-send')?.closest('details');if(recado){const label=q('summary',recado);if(label)label.textContent='💌 Recado para a TV';recado.open=false;}
  const remoteHint=q('.tg-remote-help-note',control),queue=q('.tg19-remote-queue',control),feedback=$('tg18-remote-feedback'),grid=q('.tg18-remote-grid',control);
  if(feedback&&grid)grid.after(feedback);if(queue&&recado)queue.after(recado);if(remoteHint&&queue){const hint=q('.tg19-remote-queue-hint',queue);if(hint){hint.textContent='Toque em Preparar para chamar um cantor.';legacy(remoteHint);}else queue.prepend(remoteHint);}
  legacy($('tg18-remote-rename'));
  window.addEventListener('temgogo:view',closeMenu);

 }
 function guestNav(){
  const guest=$('guest'),top=q('.tg12-participant-top',guest),music=$('tg-r05-catalog-tab');if(!guest||!top||!music||guest.dataset.tg58Ready)return;
  guest.dataset.tg58Ready='true';
  const nav=q('.mobile-switch',guest),bottom=q('.guest-bottom',guest);
  const locked=()=>guest.hidden||document.body.classList.contains('tg103-mic-focus')||document.body.classList.contains('tg18-singing')||!$('guest-preflight')?.hidden||!$('your-turn-banner')?.hidden;
  function drawer(id,title,opener){
    const d=el('dialog','tg81-mobile-drawer');d.id=id;d.setAttribute('aria-labelledby',id+'-title');
    const h=el('header','tg81-drawer-head'),label=el('h2','',title);label.id=id+'-title';const back=button('Voltar',()=>d.close());
    h.append(label,back);const content=el('div','tg81-drawer-content');d.append(h,content);guest.append(d);
    const open=()=>{if(locked())return;if(!d.open)d.showModal();content.scrollTop=0;back.focus({preventScroll:true});};
    d.addEventListener('close',()=>{if(!guest.hidden&&!document.querySelector('dialog[open]')&&!locked())opener?.focus({preventScroll:true});});
    d.addEventListener('click',e=>{if(e.target===d)d.close();});return {d,content,open};
  }
  const roomButton=button('Sala',()=>room.open());roomButton.classList.add('tg81-room-button');top.append(roomButton);roomButton.setAttribute('aria-haspopup','dialog');roomButton.setAttribute('aria-controls','tg81-room-dialog');
  const room=drawer('tg81-room-dialog','Minha sala',roomButton);
  const info=el('div','tg81-room-info'),title=el('strong','','Sua festa'),code=el('small','','');info.append(title,code);room.content.append(info);
  function syncRoom(){title.textContent=$('guest-room-title')?.textContent||'Sua festa';code.textContent='Código: '+($('guest-room-code')?.textContent||'—');}
  for(const id of ['guest-room-title','guest-room-code']){const source=$(id);if(source)new MutationObserver(syncRoom).observe(source,{childList:true,characterData:true,subtree:true});}syncRoom();
  const people=$('tg96-party-open'),help=$('open-guest-faq'),sw=$('guest-switch'),leave=$('leave-party'),helpTools=q('.tg193-help-tools',bottom);
  if(people)people.textContent='Pessoas da festa';if(sw){sw.textContent='Trocar de sala';sw.title='Volta às suas salas sem encerrar a festa';}if(leave){leave.textContent='Sair desta festa';leave.classList.add('button','button-outline','tg81-leave');}if(help)help.textContent='Ajuda';
  const group=(heading,...nodes)=>{const section=el('section','tg81-room-actions');section.append(el('h3','',heading));move(section,...nodes);room.content.append(section);};
  row(people,'☷','Pessoas da festa');row(sw,'↶','Trocar de sala');row(leave,'⏻','Sair desta festa',true);const guestHelp=helpRow(help||q('[data-tg193-faq]',helpTools));group('Festa',people,sw,guestHelp,leave);hideLegacy(helpTools);
  room.content.addEventListener('click',e=>{if(e.target.closest('button'))room.d.close();},true);
  const recado=$('tg17-guest-message'),recadoButton=el('button','mobile-tab tg81-recado-tab');recadoButton.id='tg81-recado-tab';recadoButton.type='button';const icon=el('span','','✉');icon.setAttribute('aria-hidden','true');recadoButton.append(icon,el('span','','Recados'));
  recadoButton.setAttribute('aria-haspopup','dialog');recadoButton.setAttribute('aria-controls','tg81-recado-dialog');
  const messages=drawer('tg81-recado-dialog','Recados',recadoButton);
  if(recado){messages.content.append(recado);const heading=q('h3',recado),copy=q('p',recado),eyebrow=q('.card-eyebrow',recado);if(heading)heading.textContent='Seu recado para a Diva';if(copy)copy.textContent='Escreva ou dite. O recado aparece na TV entre as músicas.';if(eyebrow)eyebrow.hidden=true;const submit=$('tg17-send-message');if(submit)submit.textContent='Enviar';}
  recadoButton.addEventListener('click',messages.open);const profileTab=q('[data-tg-beta-open="profile"]',nav);if(profileTab)profileTab.before(recadoButton);else nav?.append(recadoButton);
  const extra=q('.guest-song-search-card',guest),library=q('.guest-hit-library',guest),install=$('guest-install');
  legacy(extra);legacy(install);legacy(q('.tg18-account-promo',guest));legacy($('tg19-push-shortcut'));
  if(library){library.classList.remove('tg26-legacy');library.classList.add('tg81-library');const h=q('h2',library),copy=q('p',library),eyebrow=q('.card-eyebrow',library),open=q('[data-catalog-open]',library);if(h)h.textContent='Escolha seu próximo hit';if(copy)copy.hidden=true;if(eyebrow)eyebrow.hidden=true;if(open)open.textContent='Buscar todas as músicas';const list=$('guest-library');if(list)list.setAttribute('aria-live','polite');}
  for(const x of guest.querySelectorAll('.tg16-guest-actions [data-catalog-open],#tg16-queue-shortcut,#tg16-score-shortcut'))legacy(x);const latest=$('guest-all-scores');if(latest)latest.textContent='Placar completo';
  if(nav)nav.setAttribute('aria-label','Músicas, fila, microfone, placar, recados e perfil');
  music.setAttribute('aria-label','Músicas');const labels=music.querySelectorAll('span');if(labels.length>1)labels[1].textContent='Músicas';
  const close=()=>{for(const x of [room,messages])if(x.d.open)x.d.close();};window.addEventListener('temgogo:view',close);
  new MutationObserver(()=>{if(locked())close();}).observe(document.body,{attributes:true,attributeFilter:['class']});
  for(const id of ['guest-preflight','your-turn-banner']){const x=$(id);if(x)new MutationObserver(()=>{if(locked())close();}).observe(x,{attributes:true,attributeFilter:['hidden']});}

 }
 function profile(){
  const quick=$('tg124-profile-menu'),social=$('tg-beta-dialog'),guest=$('guest-profile-dialog');if(!quick||!social||!guest||quick.dataset.tg60Ready)return;quick.dataset.tg60Ready='true';
  const blocked=()=>document.body.classList.contains('tg103-mic-focus')||document.body.classList.contains('tg103-remote-mic-focus');
  const open=()=>{if(blocked())return;const b=window.TG_BETA_BRIDGE?.();if(!b?.user)return;for(const d of [$('tg50-drawer'),quick,$('tg20-host-profile-dialog'),guest,social])if(d?.open)d.close();
    if(!b.isAnonymous(b.user)){window.TG_BETA_OPEN_TAB?.('profile');return;}
    if(b.role!=='guest')return;const own=b.members?.find(m=>m.user_id===b.user.id);$('guest-profile-name').value=own?.display_name||$('guest-display-name').textContent;const chosen=[...$('profile-avatar-options').querySelectorAll('input')].find(n=>n.value===b.avatar);if(chosen)chosen.checked=true;const preview=$('tg83-guest-avatar-preview');if(preview)preview.src=avatarPaths[b.avatar]||avatarPaths.urbano;guest.showModal();
  };
  const headerButtons=[];
  const avatarPaths={urbano:'./cantor-urbano.png',esporte:'./cantor-esporte.png',ruiva:'./cantora-ruiva.png',oculos:'./cantora-oculos.png'};
  for(const root of ['#lobby .simple-header .header-control-group','#tg18-remote .tg18-remote-header']){
    const node=q(root),b=q('.tg124-profile-shortcut',node);if(!b)continue;
    b.hidden=false;b.classList.remove('tg26-legacy');b.classList.add('tg83-header-avatar');b.dataset.tg83ProfileMenu='1';b.setAttribute('aria-label','Menu do perfil');b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls',quick.id);
    const img=el('img');img.alt='';img.dataset.tg83AccountAvatar='1';img.src=avatarPaths[window.TG_BETA_BRIDGE?.()?.avatar]||avatarPaths.urbano;b.replaceChildren(img,el('span','','Perfil'));headerButtons.push(b);
  }
  const settings=button('Aparência',()=>{quick.close();const view=$(document.body.dataset.currentView);(q('.open-settings',view)||q('.open-settings'))?.click();});
  const password=button('Alterar senha',()=>{quick.close();$('account-password-open')?.click();});
  const logout=q('[data-tg124-action="logout"]',quick),help=helpRow(q('[data-tg124-action="help"]',quick)),voice=q('[data-tg30-voice-open]',quick),edit=q('[data-tg124-action="edit"]',quick),history=q('[data-tg124-action="history"]',quick);
  const inner=q('.tg124-profile-inner',quick);
  row(edit,'✎','Nome e avatar');row(history,'★','Minhas notas');row(voice,'♪','Identidade vocal');row(settings,'◈','Aparência');row(password,'◇','Alterar senha');row(logout,'⏻','Sair da conta',true);
  if(inner)move(inner,edit,history,voice,settings,password,help,logout);
  for(const key of ['privacy','change','leave'])hideLegacy(q('[data-tg124-action="'+key+'"]',quick));
  hideLegacy(q('#lobby > .tg193-help-tools'));
  // Close the menu before opening the existing voice dialog; other actions already close it.
  voice?.addEventListener('click',()=>{if(quick.open)quick.close();},true);
  const quickOpen=()=>{if(blocked())return;const b=window.TG_BETA_BRIDGE?.();if(!b?.user)return;
    const anon=b.isAnonymous(b.user);if(history)history.hidden=anon;password.hidden=anon;if(logout)logout.hidden=anon;
    if(!quick.open)quick.showModal();};
  const selectors='[data-tg124-profile],[data-tg-beta-open="profile"],#tg-beta-stage-profile,#tg-beta-lobby-profile,#tg-beta-remote-profile,#edit-guest-profile,#tg18-remote-rename,[data-tg124-action="edit"],[data-tg124-action="privacy"]';
  document.addEventListener('click',e=>{if(!e.target.closest(selectors))return;e.preventDefault();e.stopImmediatePropagation();if(e.target.closest('[data-tg124-action="edit"],[data-tg124-action="privacy"],#edit-guest-profile,#tg18-remote-rename'))open();else quickOpen();},true);
  document.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key)||!e.target.matches('[data-tg124-profile]:not(button)'))return;e.preventDefault();e.stopImmediatePropagation();quickOpen();},true);
  for(const id of ['tg-beta-stage-profile','tg-beta-lobby-profile','tg-beta-remote-profile','edit-guest-profile','account-password-open','logout-button'])legacy($(id));
  legacy(q('#lobby .header-control-group .open-settings'));legacy(q('#guest .guest-live .open-settings'));
  for(const b of document.querySelectorAll('.tg124-profile-shortcut:not([data-tg83-profile-menu])'))b.textContent='Meu perfil';
  const panel=q('[data-tg-beta-panel="profile"]',social),save=$('tg-p-save'),anonInner=q('.modal-inner',guest);
  if(panel&&save){
    const socialDetails=el('details','tg60-social-options');socialDetails.append(el('summary','','Redes sociais e privacidade'));socialDetails.open=false;
    for(const id of ['tg-p-handle','tg-p-insta','tg-p-score-vis','tg-p-best','tg-p-rank','tg-p-age','tg-p-legal']){const label=$(id)?.closest('label');if(label)socialDetails.append(label);if(id==='tg-p-insta'){const bora=q('.tg95-bora',panel);if(bora)socialDetails.append(bora);}}save.before(socialDetails);
  }
  const actions=(target,isGuest)=>{if(!target)return;const box=el('div','tg60-profile-actions');
    const action=(label,fn)=>{const icons={'Aparência':'◈','Identidade vocal':'♪','Minhas notas':'★','Alterar senha':'◇','Sair da conta':'⏻','Criar conta':'+'};box.append(row(button(label,fn),icons[label]||'›',label,label==='Sair da conta'));};
    const close=()=>{if(guest.open)guest.close();if(social.open)social.close();};
    action('Aparência',()=>{const view=$(document.body.dataset.currentView);close();(q('.open-settings',view)||q('.open-settings'))?.click();});
    action('Identidade vocal',()=>{close();const view=$(document.body.dataset.currentView);(q('[data-tg30-voice-open]',view)||q('[data-tg30-voice-open]'))?.click();});
    if(!isGuest){action('Minhas notas',()=>{close();q('[data-tg124-action="history"]',quick)?.click();});action('Alterar senha',()=>{close();$('account-password-open')?.click();});action('Sair da conta',()=>{close();q('[data-tg124-action="logout"]',quick)?.click();});}else{action('Criar conta',()=>{close();$('tg18-account-cta')?.click();});}
    const notify=el('section','tg81-profile-notify');notify.append(el('h3','','Conta e notificações'));const nt=button('🔔 Avisar minha vez',()=>{close();$('tg18-push-cta')?.click();});const install=button('Instalar app',()=>{close();$('tg18-install')?.click();});notify.append(row(nt,'♧','Avisar minha vez'),row(install,'↓','Instalar app'));const sync=()=>{const b=window.TG_BETA_BRIDGE?.();nt.hidden=b?.role!=='guest';};window.addEventListener('temgogo:view',sync);sync();box.append(notify);
    target.append(box);
  };
  actions(panel,false);actions(anonInner,true);
  if(anonInner){const preview=el('img','tg83-guest-preview');preview.id='tg83-guest-avatar-preview';preview.alt='Prévia do avatar';preview.src=avatarPaths.urbano;const name=$('guest-profile-name');name?.before(preview);
    $('profile-avatar-options')?.addEventListener('change',e=>{const key=e.target?.value;if(Object.hasOwn(avatarPaths,key))preview.src=avatarPaths[key];});
  }
  const syncEntry=()=>{const b=window.TG_BETA_BRIDGE?.(),name=$('guest-name');if(name)name.readOnly=!!(b?.user&&!b.isAnonymous(b.user));};
  window.addEventListener('temgogo:view',syncEntry);syncEntry();
  for(const d of [$('tg20-host-profile-dialog')])if(d)new MutationObserver(()=>{if(d.open)open();}).observe(d,{attributes:true,attributeFilter:['open']});
 }
 function faq(){
  const dlg=$('faq-dialog'),inner=q('.modal-inner',dlg);if(!inner)return;
  const entries=[...inner.querySelectorAll('details')];const list=el('div','tg26-faq-list');const footer=el('div','tg26-faq-footer');
  const first=entries[0];if(first){first.before(list);const priorities=['Como entro na festa?','Passo a passo: como começar uma festa na TV?','Como canto?','Como sei se o microfone funciona?','Como uso o celular para controlar a festa e cantar?','Como encontro músicas sem gastar a busca externa?','Onde vejo minha nota?','Como funciona a nota?'];const priority=d=>{const i=priorities.indexOf(q('summary',d)?.textContent.trim());return i<0?priorities.length:i;};entries.sort((x,y)=>priority(x)-priority(y));for(const d of entries)d.open=false;move(list,...entries);}
  const faqActions=q('.tg193-faq-actions',inner);row(q('[data-tg193-tour]',faqActions),'↻','Refazer tour');row(q('[data-tg193-support]',faqActions),'?','Falar com suporte');move(footer,faqActions,$('faq-done'));inner.append(footer);
  dlg.addEventListener('close',()=>{for(const d of entries)d.open=false;const search=$('tg05-faq-search');if(search){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));}list.scrollTop=0;});
  for(const d of entries)d.addEventListener('toggle',()=>{if(d.open)for(const x of entries)if(x!==d)x.open=false;});
 }
 function boot(){stageNav();remoteNav();guestNav();profile();faq();row($('tg83-join-scan'),'▣','Ler QR Code');row($('tg83-join-code'),'⌨','Informar código');row($('tg83-join-back'),'↶','Voltar');}
 window.addEventListener('temgogo:host-cockpit-ready',()=>queueMicrotask(stageNav));
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
