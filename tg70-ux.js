(()=>{'use strict';
const $=id=>document.getElementById(id);
function attachEyes(){document.querySelectorAll('input[type="password"]:not([data-tg70-eye])').forEach(input=>{
 input.dataset.tg70Eye='1';const w=document.createElement('span');w.className='tg70-eye-wrap';input.parentNode.insertBefore(w,input);w.append(input);
 const b=document.createElement('button');b.type='button';b.className='tg70-eye';b.textContent='◉ Mostrar';b.setAttribute('aria-pressed','false');b.setAttribute('aria-label','Mostrar senha digitada');
 b.addEventListener('click',event=>{event.preventDefault();const on=input.type==='password';input.type=on?'text':'password';b.textContent=on?'◌ Ocultar':'◉ Mostrar';b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Ocultar senha digitada':'Mostrar senha digitada');input.focus({preventScroll:true});});w.append(b);
 });}
attachEyes();
function syncEyeButtons(){document.querySelectorAll('.tg70-eye-wrap').forEach(w=>{const i=w.querySelector('input'),b=w.querySelector('button');if(i&&b){const on=i.type==='text';b.textContent=on?'◌ Ocultar':'◉ Mostrar';b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Ocultar senha digitada':'Mostrar senha digitada');}});}
function concealAll(){document.querySelectorAll('input[data-tg70-eye]').forEach(i=>i.type='password');syncEyeButtons();}
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',concealAll));
$('logout-button')?.addEventListener('click',concealAll);
$('tg192-show-password')?.addEventListener('change',()=>setTimeout(syncEyeButtons,0));
new MutationObserver(()=>attachEyes()).observe(document.body,{childList:true,subtree:true});
const solo=$('tg70-go-solo'),classic=$('tg70-go-classic'),battle=$('tg70-go-battle');
solo?.addEventListener('click',()=>{const el=$('tg103-solo-entry');if(el&&!el.disabled)el.click();});
classic?.addEventListener('click',()=>{const el=$('host-create-area');if(el)el.hidden=false;el?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'center'});$('room-title')?.focus({preventScroll:true});});
const hubCreate=$('tg92-hub-create');
function navigateHub(which){
 const modes=$('tg70-modes'),history=$('tg93-history-panel'),form=$('host-create-area');
 if(modes)modes.hidden=which!=='create';
 if(history)history.hidden=which!=='history';
 if(form)form.hidden=true;
 hubCreate?.setAttribute('aria-expanded',String(which==='create'));
 $('tg92-hub-history')?.setAttribute('aria-expanded',String(which==='history'));
 if(which==='create'){modes?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});$('tg70-go-classic')?.focus({preventScroll:true});}
 if(which==='history'){history?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});$('tg93-history-title')?.setAttribute('tabindex','-1');$('tg93-history-title')?.focus({preventScroll:true});}
}
hubCreate?.addEventListener('click',()=>navigateHub('create'));
$('tg92-hub-join')?.addEventListener('click',()=>$('hub-join-room')?.click());
$('tg92-hub-history')?.addEventListener('click',()=>navigateHub('history'));
$('tg93-history-back')?.addEventListener('click',()=>navigateHub('main'));
// R82 — trailer educativo. A arte é independente dos avatares de perfil.
const guides=[
 ['Batalha de Estrelas','Entre para cantar ou só assistir e votar. Seu celular vira o microfone.','opening',6500,'Estrelas'],
 ['O anfitrião prepara o show','Abre as inscrições de 2 a 12 competidores e monta a playlist dos confrontos.','cast',7500,'Playlist'],
 ['Escolha seu papel','Cantor(a) disputa com uma conta. A plateia pode acompanhar e votar quando habilitada, inclusive como convidado temporário.','join',8500,'Cantar • Votar'],
 ['Sua música, sua estreia','Cada competidor escolhe uma música para cantar sozinho na classificatória.','qualify',7500,'Minha música'],
 ['A plateia dá estrelas','Após cada apresentação, os eleitores habilitados votam de 1 a 5 estrelas. A janela tem 150 segundos e pode receber uma extensão de 30 segundos.','vote',9000,'★★★★★'],
 ['A Diva apresenta os confrontos','A classificação organiza a chave. Todos os competidores entram nela; ninguém é eliminado só por sua nota inicial.','bracket',8500,'Chave • VS'],
 ['Sorteio, celular na mão, VS!','O sistema sorteia uma faixa da playlist do host, sem repetir nos duelos iniciais. Os dois cantam a mesma música ao mesmo tempo.','duel',9000,'VS'],
 ['Votação e grande final','A plateia vota após os duelos. A apuração segue as regras; se houver empate absoluto, há revanche com outra faixa. A Diva anuncia o pódio confirmado.','podium',10000,'Grande final']
];
let i=0,guideTimer=null,playing=false,fromPanel=false,artReady=false;
const dialog=$('tg70-battle-guide'),theme=$('tg67-guide-theme'),atlas='./batalha-r82-cenas.webp';
const reduce=()=>matchMedia('(prefers-reduced-motion:reduce)').matches||document.body.classList.contains('tg93-reduce-motion');
const total=guides.length;
const image=new Image();
image.onload=()=>{artReady=true;if(dialog?.open)showGuide();};
image.onerror=()=>{artReady=false;if(dialog?.open)showGuide();};
image.src=atlas;
function showGuide(){
 const g=guides[i],scene=$('tg67-guide-scene');if(!dialog?.open||!scene)return;
 $('tg70-guide-counter').textContent=(i+1)+' / '+total;$('tg33-guide-progress').max=total;$('tg33-guide-progress').value=i+1;
 $('tg70-guide-heading').textContent=g[0];$('tg70-guide-text').textContent=g[1];$('tg70-guide-prev').disabled=i===0;$('tg70-guide-next').textContent=i===total-1?'Concluir':'Próximo';
 scene.dataset.scene=g[2];scene.classList.toggle('tg82-art-ready',artReady);scene.replaceChildren();
 const visual=document.createElement('div');visual.className='tg82-visual';visual.setAttribute('aria-hidden','true');
 if(artReady){visual.style.backgroundImage='url("'+atlas+'")';visual.style.backgroundPosition=(i%2*100)+'% '+(Math.floor(i/2)*100/3)+'%';}
 else{const logo=document.createElement('span');logo.className='tg82-fallback-mark';logo.textContent=g[4];visual.append(logo);}
 scene.append(visual);$('tg67-guide-toggle').textContent=playing?'Pausar':'Reproduzir';
 $('tg75-open-workspace').hidden=fromPanel;
}
function stopGuide(){clearTimeout(guideTimer);guideTimer=null;playing=false;theme?.pause();$('tg67-guide-toggle').textContent='Reproduzir';}
function schedule(){clearTimeout(guideTimer);if(!playing)return;guideTimer=setTimeout(()=>{if(!dialog.open||document.hidden){stopGuide();return;}if(i===total-1){stopGuide();return;}i++;showGuide();schedule();},guides[i][3]);}
function startGuide(){if(!dialog.open)return;playing=true;showGuide();if(theme&&!theme.muted){theme.volume=.18;theme.play().catch(()=>{});}schedule();}
function openGuide(options={}){if(!dialog||document.body.classList.contains('tg103-mic-focus')||document.body.classList.contains('tg103-remote-mic-focus')||document.body.classList.contains('tg18-singing'))return false;
 if(dialog.open)return false;fromPanel=options.fromPanel===true;i=0;stopGuide();
 if(theme){try{theme.currentTime=0;}catch{}theme.muted=true;$('tg67-guide-sound').textContent='Ativar trilha';$('tg67-guide-sound').setAttribute('aria-pressed','false');}
 dialog.showModal();showGuide();if(!reduce())startGuide();return true;
}
window.TG82_BATTLE_GUIDE=Object.freeze({open:openGuide});
$('tg70-battle-story-open')?.addEventListener('click',()=>openGuide());$('tg70-guide-close')?.addEventListener('click',()=>dialog.close());$('tg70-guide-skip')?.addEventListener('click',()=>dialog.close());
$('tg70-guide-prev')?.addEventListener('click',()=>{stopGuide();i=Math.max(0,i-1);showGuide();});$('tg70-guide-next')?.addEventListener('click',()=>{stopGuide();if(i===total-1){dialog.close();return;}i++;showGuide();});
$('tg67-guide-toggle')?.addEventListener('click',()=>{if(playing)stopGuide();else{if(i===total-1){i=0;if(theme)try{theme.currentTime=0;}catch{}}startGuide();}});
$('tg67-guide-sound')?.addEventListener('click',()=>{if(!theme)return;theme.muted=!theme.muted;$('tg67-guide-sound').textContent=theme.muted?'Ativar trilha':'Silenciar trilha';$('tg67-guide-sound').setAttribute('aria-pressed',String(!theme.muted));if(theme.muted)theme.pause();else if(playing){theme.volume=.18;theme.play().catch(()=>{});}});
dialog?.addEventListener('close',()=>{stopGuide();fromPanel=false;});dialog?.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});$('tg75-open-workspace')?.addEventListener('click',stopGuide);$('tg75-battle-panel')?.addEventListener('close',()=>{if(fromPanel&&dialog.open)dialog.close();});document.addEventListener('visibilitychange',()=>{if(document.hidden)stopGuide();});window.addEventListener('pagehide',stopGuide);
window.addEventListener('temgogo:view',()=>{if(dialog.open)dialog.close();});
const faq=$('faq-dialog')?.querySelector('.tg193-faq-actions');if(faq){const btn=document.createElement('button');btn.type='button';btn.className='button button-outline';btn.textContent='🏆 Rever apresentação da Batalha';btn.addEventListener('click',()=>{if($('faq-dialog')?.open)$('faq-dialog').close();openGuide();});faq.append(btn);}
if(battle){battle.disabled=true;battle.setAttribute('aria-disabled','true');}
// Preferencias individuais de acessibilidade (nao ligam audio automaticamente).
function readPreference(key,fallback){
 try{const value=localStorage.getItem('tem-gogo-a11y-'+key);return value===null?fallback:value==='true';}
 catch{return fallback;}
}
const reducedSystem=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
const preferences=[
 {id:'tg93-reduce-motion',key:'reduce-motion',css:'tg93-reduce-motion',fallback:reducedSystem},
 {id:'tg93-large-text',key:'large-text',css:'tg93-large-text',fallback:false},
 {id:'tg93-voice-previews',key:'voice-previews',css:'tg93-voice-previews-off',fallback:true,invert:true}
];
for(const item of preferences){
 const field=$(item.id);if(!field)continue;
 function update(next,save){
  field.checked=next;
  document.body.classList.toggle(item.css,item.invert?!next:next);
  if(save){try{localStorage.setItem('tem-gogo-a11y-'+item.key,String(next));}catch{}}
  if(item.key==='voice-previews'&&!next)window.TG74_DIVA_STUDIO?.stopVoice();
 }
 update(readPreference(item.key,item.fallback),false);
 field.addEventListener('change',()=>update(field.checked,true));
}

})();
