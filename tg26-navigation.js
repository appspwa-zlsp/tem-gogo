/* R26 — Navigation only. Keep existing nodes, handlers and permissions. */
(()=>{'use strict';
 const $=id=>document.getElementById(id), q=(s,r=document)=>r?.querySelector(s)||null;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const button=(label,fn)=>{const b=el('button','button button-outline',label);b.type='button';b.addEventListener('click',fn);return b;};
 const move=(parent,...nodes)=>nodes.filter(Boolean).forEach(n=>parent.append(n));
 const legacy=n=>{if(n)n.classList.add('tg26-legacy');};
 function stageNav(){
  const stage=$('stage'),main=q('.stage-main',stage),bar=$('tg123-host-bar'),consoleNode=$('tg17-console'),cockpit=$('tg104-cockpit'),room=q('.tg104-room-panel',cockpit),catalog=q('.tg100-catalog-panel',cockpit),side=q('.tg100-side',stage),queue=q('.stage-sidebar',side),rank=q('.stage-rank-panel',side);
  if(!main||!bar||!consoleNode||!room||!catalog||!side||!queue||!rank||stage.dataset.tg26Ready)return;
  stage.dataset.tg26Ready='true';
  const nav=el('nav','tg26-nav');nav.setAttribute('aria-label','Navegação do anfitrião');
  const options=[['palco','▶ Palco'],['controle','🎛 Controle'],['musicas','♫ Músicas'],['placar','🏆 Placar'],['mais','☰ Sala']];
  const select=(key,scroll=false)=>{if(!options.some(x=>x[0]===key))return;stage.dataset.tg26Panel=key;for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.tg26Key===key));if(key==='musicas')catalog.closest('details').open=true;if(key==='mais')room.closest('details').open=true;if(scroll){const target=key==='controle'?consoleNode:key==='musicas'?catalog:key==='placar'?rank:key==='mais'?room:q('.stage-header',stage)||bar;target.scrollIntoView({block:'start',behavior:'instant'});}};
  for(const [key,label] of options){const b=button(label,()=>select(key,true));b.dataset.tg26Key=key;const split=label.indexOf(' ');const icon=el('span','tg28-nav-icon',label.slice(0,split));icon.setAttribute('aria-hidden','true');b.replaceChildren(icon,el('span','tg28-nav-label',label.slice(split+1)));b.setAttribute('aria-label',label.slice(split+1));nav.append(b);}
  const controls=consoleNode.parentElement;
  const remoteQR=$('tg30-control-qr-details');if(remoteQR)room.append(remoteQR);
  controls.prepend(bar);q('.stage-header',stage).after(nav);move(bar,$('start-audio'));
  const recado=q('.tg04-stage-recado',stage);if(recado)controls.append(recado);
  const tools=q('.tg19-stage-tool-grid',room);const help=q('.tg193-help-tools',room);
  const roomActions=el('section','tg26-room-actions');roomActions.append(el('h3','','Gerenciar festa'));
  const switcher=$('stage-switch'),end=$('stage-exit');if(switcher)switcher.textContent='Minhas salas';if(end)end.textContent='Encerrar festa';move(roomActions,switcher,el('small','','A festa permanece aberta.'),end,el('small','','Finaliza para todos, após confirmação.'));
  room.prepend(roomActions);
  const theme=$('theme-cycle');if(theme){theme.classList.remove('tg26-legacy');theme.setAttribute('aria-label','Trocar tema do palco');q('.stage-actions',stage)?.prepend(theme);}legacy($('contrast-toggle'));legacy($('open-scoreboard'));
  const settings=q('.open-settings',tools);if(settings){settings.textContent='Ajustes e acessibilidade';roomActions.prepend(settings);}
  const faq=$('open-stage-faq');if(faq)faq.textContent='❔ Ajuda e dúvidas';
  if(help&&tools)move(tools,...help.children);if(help)help.remove();
  const footer=q('.tg19-stage-footer',room);if(footer&&!footer.children.length)footer.remove();
  // One authoritative mixer; keep the old mirror nodes for compatibility.
  const volume=q('[data-tg123-host-command="volumes"]',bar);legacy(volume);
  const quickToggle=q('[data-tg123-host-command="toggle"]',bar),original=$('play-pause');
  if(quickToggle&&original){const sync=()=>{const label=q('.tg21-command-label',quickToggle);if(label)label.textContent=original.textContent.trim();else quickToggle.textContent=original.textContent.trim();quickToggle.disabled=original.disabled;quickToggle.setAttribute('aria-label',original.textContent.trim());};new MutationObserver(sync).observe(original,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled']});sync();legacy(original);}
  legacy($('skip-track'));
  legacy($('tg21-volume-panel'));
  // Studio remains the existing single instance, not an extra host-facing panel.
  window.TG74_DIVA_STUDIO?.mount();const studio=$('tg74-voice-preview');if(studio){controls.append(studio);const s=q('summary',studio);if(s)s.textContent='🎙️ Biblioteca de voz · prévias e revisão';}
  const voice=q('.tg05-voice-controls',consoleNode);if(voice){const hint=el('p','tg26-note','Para ouvir a Drag Diva durante a festa, autorize as falas nesta sessão. O teste manual não ativa as falas; eventos automáticos exigem gravações publicadas pela Central.');voice.prepend(hint);}
  const empty=q('.tg19-stage-footer',room);if(empty){empty.classList.add('tg26-footer');}
  select('palco');
  window.addEventListener('temgogo:r57-back',e=>{if(stage.hidden||stage.dataset.tg26Panel==='palco')return;e.preventDefault();select('palco');nav.querySelector('[data-tg26-key=palco]')?.focus({preventScroll:true});});
  window.addEventListener('temgogo:view',e=>{if(e.detail?.view==='stage')select('palco');});
 }
 function remoteNav(){
  const r=$('tg18-remote'),header=q('.tg18-remote-header',r),control=$('tg19-remote-control'),info=$('tg19-remote-singing');if(!header||!control||!info||r.dataset.tg28Ready)return;r.dataset.tg28Ready='true';
  const more=el('details','tg26-remote-more');more.append(el('summary','','☰ Sala e ajuda'));
  const wrap=el('div','tg26-remote-menu');more.append(wrap);
  const help=q('.tg193-remote-help',header);wrap.append(el('h3','','Gerenciar festa'));move(wrap,$('tg18-remote-back'));wrap.append(el('small','tg26-note','Volta às suas salas sem encerrar a festa.'));move(wrap,$('tg04-remote-end'));wrap.append(el('small','tg26-note','Encerra a festa para todos, mediante confirmação.'));move(wrap,$('tg18-remote-stage'));wrap.append(el('h3','','Ajuda'));move(wrap,help);
  header.append(more);
  const moderation=$('tg-beta-host-moderate');if(moderation)move(wrap,moderation);legacy($('tg-beta-remote-nav'));
  const closeMenu=()=>{more.open=false;};wrap.addEventListener('click',e=>{if(e.target.closest('button'))closeMenu();});
  const music=$('tg18-remote-music');if(music){const shortcut=button('♫ Escolher música / catálogo',()=>music.click());shortcut.classList.add('tg28-remote-catalog','button-primary');q('.tg18-remote-grid',control)?.after(shortcut);}
  const audio=q('.tg05-remote-audio',control);if(audio){audio.open=true;const summary=q('summary',audio);if(summary)summary.textContent='🎚 Mesa de áudio da TV';
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
 function boot(){stageNav();remoteNav();profile();faq();}
 window.addEventListener('temgogo:host-cockpit-ready',()=>queueMicrotask(stageNav));
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
