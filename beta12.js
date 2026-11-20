/* TEM GOGÓ — Beta 1.2: camada de arquitetura da informação.
   Não reimplementa sessões, QR, WebRTC, player, Supabase, notas ou fila.
   Reutiliza os IDs e listeners da Beta 1.1, e só reorganiza elementos visuais. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const mk=(tag,attrs={},txt='')=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(txt)e.textContent=txt;return e;};
const button=(label,cls='button button-soft full')=>mk('button',{type:'button',class:cls},label);
const bridge=()=>window.TG_BETA_BRIDGE?.();
const isSigned=()=>{const b=bridge();return !!b?.user&&!b.isAnonymous(b.user);};
const validCode=raw=>/^(?:[A-F0-9]{8}|[A-F0-9]{12})$/.test(String(raw||'').toUpperCase().trim());
let guestStep='room',hubSection='main',currentView='landing',locked=false;
function setStep(step){guestStep=step;document.body.dataset.tg12GuestStep=step;
 const room=$('tg12-guest-room'),identity=$('tg12-guest-identity');if(room)room.hidden=step!=='room';if(identity)identity.hidden=step!=='identity';
 $('tg12-guest-progress')?.replaceChildren(document.createTextNode(step==='room'?'1 de 2 · Localize sua festa':'2 de 2 · Escolha sua identidade'));
 if(step==='identity'){const preview=$('tg12-code-preview');if(preview)preview.textContent=$('guest-code')?.value||'Identificada';$('guest-name')?.focus({preventScroll:true});}}
function openGuest(code,{fresh=false}={}){
 const field=$('guest-code');
 if(fresh){
   // Somente o QR explícito pode preencher o convite. Não herdar salas anteriores.
   if(field){field.value='';field.setCustomValidity('');}
   localStorage.removeItem('tem-gogo-pending-room');
   const url=new URL(location.href);if(url.searchParams.has('room')&&!url.searchParams.has('remote')){url.searchParams.delete('room');history.replaceState(history.state,'',url.href);}
 }else if(code!=null&&field){field.value=String(code).trim().toUpperCase();}
 const known=String(fresh?'':(code??field?.value??'')).trim().toUpperCase();
 document.body.classList.add('tg12-guest-mode');document.body.classList.remove('tg12-login-mode');
 setStep(validCode(known)?'identity':'room');
}
function backToLogin(){document.body.classList.remove('tg12-guest-mode');document.body.classList.add('tg12-login-mode');$('tab-host')?.click();}
function initAccess(){
 const card=$('access-card'),host=$('host-access'),guest=$('guest-access'),tabs=$('access-tabs');if(!card||!host||!guest||!tabs)return;
 document.body.classList.add('tg12-ready','tg12-login-mode');
 tabs.classList.add('tg12-legacy-tabs');
 const intro=mk('div',{class:'tg12-access-intro'});intro.innerHTML='<span class="tg12-kicker">TEM GOGÓ · BETA 2.0</span><h1>Seu show começa aqui.</h1><p>Entre na sua conta ou participe de uma festa pelo QR.</p>';
 card.insertBefore(intro,card.firstChild);
 const title=host.querySelector('h2');if(title)title.textContent='Entre na sua conta';
 const subtle=host.querySelector('.subtle');if(subtle)subtle.textContent='Acesse suas festas, seu perfil e o controle.';
 $('login-button')?.replaceChildren(document.createTextNode('Entrar'));
 $('signup-button')?.replaceChildren(document.createTextNode('Criar conta'));
 const guestAction=button('🎟️ Entrar sem login (Convidado)','button button-outline full tg12-guest-entry-cta');guestAction.id='tg12-guest-entry-cta';
 guestAction.addEventListener('click',()=>{$('tab-guest')?.click();openGuest('',{fresh:true});});
 host.after(guestAction);
 const back=button('← Voltar para minha conta','tg12-back-link');back.id='tg12-back-login';back.addEventListener('click',backToLogin);guest.insertBefore(back,guest.firstChild);
 const subhead=mk('div',{class:'tg12-guest-progress',id:'tg12-guest-progress'},'1 de 2 · Localize sua festa');back.after(subhead);
 const form=$('guest-entry-form');const code=$('guest-code');const name=$('guest-name');if(!form||!code||!name)return;
 const roomPanel=mk('div',{id:'tg12-guest-room',class:'tg12-guest-step'});
 const identityPanel=mk('div',{id:'tg12-guest-identity',class:'tg12-guest-step'});
 const codeLabel=guest.querySelector('label[for="guest-code"]');const nameLabel=guest.querySelector('label[for="guest-name"]');
 form.prepend(roomPanel,identityPanel);
 const qr=guest.querySelector('.qr-scan-cta');if(qr)roomPanel.append(qr);
 if(codeLabel)roomPanel.append(codeLabel);roomPanel.append(code);
 const next=button('Continuar →','button button-primary full');next.id='tg12-next-guest';next.addEventListener('click',()=>{code.value=code.value.trim().toUpperCase();if(!validCode(code.value)){code.setCustomValidity('Digite o código de 8 ou 12 caracteres exibido na TV.');code.reportValidity();return;}code.setCustomValidity('');setStep('identity');});
 code.addEventListener('input',()=>code.setCustomValidity(''));
 roomPanel.append(next);
 const summary=mk('div',{class:'tg12-invite-summary'});summary.innerHTML='<span>Código informado · confirmar ao entrar</span><strong id="tg12-code-preview"></strong>';
 identityPanel.append(summary);
 if(nameLabel)identityPanel.append(nameLabel);identityPanel.append(name);
 const avatar=guest.querySelector('.avatar-picker');if(avatar)identityPanel.append(avatar);
 const notice=mk('p',{class:'tg12-privacy-note'},'Sem login, suas notas e seu histórico não ficarão salvos no seu perfil.');identityPanel.append(notice);
 const submit=form.querySelector('button[type="submit"]');if(submit){submit.textContent='Entrar mesmo assim';identityPanel.append(submit);}
 const edit=button('← Trocar sala ou ler outro QR','tg12-back-link');edit.addEventListener('click',()=>{setStep('room');$('guest-code')?.focus({preventScroll:true});});identityPanel.append(edit);
 name.addEventListener('focus',()=>{const preview=$('tg12-code-preview');if(preview)preview.textContent=code.value;});
 form.addEventListener('submit',e=>{if(guestStep!=='identity'){e.preventDefault();e.stopImmediatePropagation();if(validCode(code.value)){setStep('identity');}else{code.reportValidity();}}},true); // The original handler runs only on the confirmed step.
 const help=mk('nav',{class:'tg12-legal', 'aria-label':'Ajuda e informações'});
 help.innerHTML='<button type="button" data-tg193-faq>Como usar</button><button type="button" data-tg193-support>Suporte</button><a href="./termos.html" target="_blank" rel="noopener noreferrer">Termos</a><a href="./privacidade.html" target="_blank" rel="noopener noreferrer">Privacidade</a>';
 // Existing delegated help listener is attached in app.js at startup, so proxy the original buttons.
 help.querySelector('[data-tg193-faq]').addEventListener('click',()=>document.querySelector('#landing .tg193-help-tools [data-tg193-faq]')?.click());
 help.querySelector('[data-tg193-support]').addEventListener('click',()=>document.querySelector('#landing .tg193-help-tools [data-tg193-support]')?.click());
 card.append(help);
 setStep('room');
 window.addEventListener('temgogo:guest-entry',e=>openGuest(e.detail?.room));
 window.addEventListener('temgogo:guest-invalid-room',()=>{const url=new URL(location.href);if(url.searchParams.has('room')&&!url.searchParams.has('remote')){url.searchParams.delete('room');history.replaceState(history.state,'',url.href);}setStep('room');$('guest-code')?.focus({preventScroll:true});});
 $('tab-host').addEventListener('click',()=>{document.body.classList.remove('tg12-guest-mode');document.body.classList.add('tg12-login-mode');});
 $('tab-guest').addEventListener('click',()=>{setTimeout(()=>{if(document.body.classList.contains('tg12-guest-mode'))return;openGuest($('guest-code')?.value);},0);});
 if(new URL(location.href).searchParams.get('remote')==='1')guestAction.hidden=true;
 const room=new URL(location.href).searchParams.get('room');
 if(room&&validCode(room))openGuest(room);
}
function initHub(){
 const hub=$('room-hub');if(!hub)return;
 hub.classList.add('tg12-hub');
 const top=mk('div',{class:'tg12-hub-heading'});top.innerHTML='<span class="tg12-kicker">SEU CAMARIM</span><h2>O que vamos fazer?</h2><p>Escolha uma ação para começar.</p>';
 hub.prepend(top);
 const choices=mk('div',{class:'tg12-hub-choices',id:'tg12-hub-choices'});
 const create=button('＋  Criar minha festa','button button-primary full tg12-hub-primary');const join=button('⌁  Entrar em uma festa','button button-outline full');const history=button('◷  Ver festas / Histórico','button button-soft full');
 choices.append(create,join,history);top.after(choices);
 const createPanel=hub.querySelector('#host-create-area');const solo=$('tg103-solo-entry');const list=$('existing-rooms');
 const createBox=mk('section',{class:'tg12-hub-panel',id:'tg12-create-panel',hidden:''});
 const panelHeading=mk('h3',{},'Prepare seu palco');createBox.append(panelHeading);
 if(createPanel)createBox.append(createPanel);
 if(solo){const soloDetails=mk('details',{class:'tg12-solo-choice'});const summary=mk('summary',{},'🎙️ Aparelho único / Só eu vou cantar');soloDetails.append(summary,solo);createBox.append(soloDetails);}
 const historyBox=mk('section',{class:'tg12-hub-panel',id:'tg12-history-panel',hidden:''});historyBox.append(mk('h3',{},'Minhas festas e resultados'));if(list)historyBox.append(list);
 const back=button('← Voltar às opções','tg12-back-link');back.addEventListener('click',()=>showHub('main'));
 hub.append(createBox,historyBox,back);
 create.addEventListener('click',()=>showHub('create'));join.addEventListener('click',()=>$('hub-join-room')?.click());history.addEventListener('click',()=>showHub('history'));
 const old=hub.querySelector('.tg-beta-hub-actions');if(old)old.classList.add('tg12-old-hub-actions');
 const profile=$('tg-beta-lobby-profile');if(profile){profile.textContent='👤 Meu perfil';profile.classList.add('tg12-profile-shortcut');}
 const lead=$('lobby').querySelector('.lobby-main>div:first-child');if(lead)lead.classList.add('tg12-hidden-hero');
 showHub('main');
}
function showHub(section){hubSection=section;document.body.dataset.tg12HubSection=section;
 $('tg12-hub-choices').hidden=section!=='main';$('tg12-create-panel').hidden=section!=='create';$('tg12-history-panel').hidden=section!=='history';
 const btn=$('room-hub')?.querySelector('.tg12-back-link');if(btn)btn.hidden=section==='main';
}
function initParticipant(){
 const guest=$('guest');if(!guest)return;
 guest.classList.add('tg12-participant');
 const row=guest.querySelector('.guest-profile-row');const name=$('guest-display-name');
 const top=mk('div',{class:'tg12-participant-top'});
 const avatar=$('guest-profile-avatar');
 const avatarBtn=button('','tg12-avatar-button');avatarBtn.setAttribute('aria-label','Editar foto, apelido e avatar');avatarBtn.addEventListener('click',()=>avatar?.click());
 if(avatar)avatarBtn.append(avatar);top.append(avatarBtn);
 const label=mk('div',{class:'tg12-participant-label'});label.innerHTML='<span>MEU CAMARIM</span><strong id="tg12-party-title">Festa</strong>';
 top.append(label);
 const help=$('open-guest-faq');if(help){help.textContent='?';help.classList.add('tg12-help-button');top.append(help);}
 const welcome=guest.querySelector('.guest-welcome');if(welcome)welcome.prepend(top);
 const roomTitle=$('guest-room-title');const title=$('tg12-party-title');if(roomTitle&&title){
   const sync=()=>title.textContent=roomTitle.textContent||'Sua festa';sync();new MutationObserver(sync).observe(roomTitle,{childList:true,characterData:true,subtree:true});
 }
 const hero=guest.querySelector('.guest-hit-library');if(hero){const h=hero.querySelector('h2');if(h)h.textContent='Catálogo de músicas';}
 const bar=guest.querySelector('.mobile-switch');if(bar){bar.setAttribute('aria-label','Catálogo, Galera, Perfil e Ranking');const songs=$('mobile-tab-queue');if(songs){songs.textContent='';songs.append(mk('span',{},'♫'),mk('span',{},'Catálogo'));}}
 // The original score remains available from the single Ranking area; no duplicate fixed button.
 const communication=guest.querySelector('.vox-guest-quip');if(communication){communication.setAttribute('aria-live','polite');let timeout;
 const showTemporary=()=>{if(document.body.dataset.currentView!=='guest')return;communication.classList.add('tg12-visible');clearTimeout(timeout);timeout=setTimeout(()=>communication.classList.remove('tg12-visible'),4600);};
 const old=$('vox-guest-line');if(old)new MutationObserver(showTemporary).observe(old,{childList:true,subtree:true,characterData:true});
 }
}
function initRemote(){
 const remote=$('tg18-remote');if(!remote)return;remote.classList.add('tg12-remote');
 const h=remote.querySelector('.tg18-remote-shell > .card-eyebrow');if(h)h.textContent='CONTROLE · TEM GOGÓ';
 const tabs=remote.querySelector('.tg19-remote-tabs');if(tabs){const singer=$('tg19-tab-singing');if(singer)singer.textContent='🎤 Participar';}
 const social=$('tg-beta-remote-nav');if(social)social.classList.add('tg12-remote-social');
}
function initStage(){const stage=$('stage');if(!stage)return;stage.classList.add('tg12-stage');
 const cockpit=$('tg104-cockpit');if(cockpit){const header=cockpit.querySelector('.tg104-cockpit-header p');if(header)header.textContent='Mesa, fila, biblioteca e sala em um só painel.';
 for(const btn of cockpit.querySelectorAll('[data-tg104-tab]')){if(btn.dataset.tg104Tab==='catalogo')btn.textContent='♫ Biblioteca';if(btn.dataset.tg104Tab==='sala')btn.textContent='⚙ Sala';}}
}
function init(){initAccess();initHub();initParticipant();initRemote();initStage();
 window.addEventListener('temgogo:view',e=>{currentView=e.detail.view;if(currentView==='landing'){
 const remote=new URL(location.href).searchParams.get('remote')==='1';if(remote)backToLogin();
 }if(currentView==='lobby')showHub('main');});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
