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
// R67: apresentação cinematográfica em seis cenas, sem acionamento de competição.
const guides=[
 ['Batalha de Estrelas','O palco é seu!','opening'],
 ['Elenco e playlist','Inscrições abertas: o host monta a playlist dos confrontos.','cast'],
 ['Classificatória','Cada cantor escolhe sua música e se apresenta individualmente.','qualify'],
 ['Confrontos','O sistema escolhe uma música da playlist do host.','duel'],
 ['Votação','Eleitores habilitados: 1 a 5 estrelas. 150 s + uma extensão de 30 s.','vote'],
 ['O grande pódio','Ouro, prata e bronze após resultado confirmado.','podium']
];let i=0,guideTimer=null,playing=false;const dialog=$('tg70-battle-guide'),theme=$('tg67-guide-theme');
const art=['cantor-urbano.png','cantora-ruiva.png','cantor-esporte.png','cantora-oculos.png'];
function avatar(n){const img=document.createElement('img');img.src='./'+art[n];img.alt='Avatar ilustrativo do Tem Gogó';return img;}
function showGuide(){const g=guides[i],scene=$('tg67-guide-scene');$('tg70-guide-counter').textContent='Cena '+(i+1)+' de '+guides.length;$('tg33-guide-progress').value=i+1;$('tg70-guide-heading').textContent=g[0];$('tg70-guide-text').textContent=g[1];$('tg70-guide-prev').disabled=i===0;$('tg70-guide-next').textContent=i===guides.length-1?'Concluir':'Próximo';scene.replaceChildren();scene.dataset.scene=g[2];const diva=document.createElement('img');diva.src='./diva-busto.png';diva.alt='Drag Diva';diva.className='tg67-guide-diva';scene.append(diva);const cast=document.createElement('div');cast.className='tg67-guide-cast';const performers=document.createElement('div');performers.className='tg75-guide-performers';const cues=document.createElement('div');cues.className='tg75-guide-cues';const label=t=>{const el=document.createElement('span');el.textContent=t;return el;};
if(g[2]==='opening'){performers.append(avatar(0),avatar(1),avatar(2),avatar(3));cues.append(label('Batalha de Estrelas'));}
if(g[2]==='cast'){for(let n=0;n<4;n++)performers.append(avatar(n));cues.append(label('2–12 competidores'),label('♫ Playlist do host'));}
if(g[2]==='qualify'){performers.append(avatar(1));cues.append(label('♫ Minha escolha'),label('🎙 Solo'));}
if(g[2]==='duel'){performers.append(avatar(0),label('×'),avatar(2));cues.append(label('♫ Sorteio do sistema'));}
if(g[2]==='vote'){performers.append(avatar(0),avatar(2));cues.append(label('★ ★ ★ ★ ★'),label('2:30'));}
if(g[2]==='podium'){for(const [n,medal] of [[1,'🥈'],[0,'🥇'],[2,'🥉']]){const p=document.createElement('div');p.className='tg67-podium-step';p.append(avatar(n),label(medal));performers.append(p);}cues.append(label('Pódio oficial'));}
cast.append(performers,cues);scene.append(cast);$('tg67-guide-toggle').textContent=playing?'Pausar':'Reproduzir';}
function stopGuide(){clearTimeout(guideTimer);guideTimer=null;playing=false;theme?.pause();$('tg67-guide-toggle').textContent='Reproduzir';}
function schedule(){clearTimeout(guideTimer);if(!playing)return;guideTimer=setTimeout(()=>{if(!dialog.open||document.hidden){stopGuide();return;}if(i===guides.length-1){stopGuide();return;}i++;showGuide();schedule();},7000);}
function startGuide(){playing=true;showGuide();if(theme&&!theme.muted){theme.volume=.18;theme.play().catch(()=>{});}schedule();}
function openGuide(){i=0;stopGuide();if(theme){theme.currentTime=0;}if(!dialog.open)dialog.showModal();if(matchMedia('(prefers-reduced-motion:reduce)').matches||document.body.classList.contains('tg93-reduce-motion'))showGuide();else startGuide();}
$('tg70-battle-story-open')?.addEventListener('click',openGuide);$('tg70-guide-close')?.addEventListener('click',()=>dialog.close());$('tg70-guide-skip')?.addEventListener('click',()=>dialog.close());
$('tg70-guide-prev')?.addEventListener('click',()=>{stopGuide();i=Math.max(0,i-1);showGuide();});$('tg70-guide-next')?.addEventListener('click',()=>{stopGuide();if(i===guides.length-1){dialog.close();return;}i++;showGuide();});
$('tg67-guide-toggle')?.addEventListener('click',()=>{if(playing)stopGuide();else{if(i===guides.length-1){i=0;if(theme)theme.currentTime=0;}startGuide();}});
$('tg67-guide-sound')?.addEventListener('click',()=>{if(!theme)return;theme.muted=!theme.muted;$('tg67-guide-sound').textContent=theme.muted?'Ativar trilha':'Silenciar trilha';$('tg67-guide-sound').setAttribute('aria-pressed',String(!theme.muted));if(theme.muted)theme.pause();else if(playing)theme.play().catch(()=>{});});
dialog?.addEventListener('close',stopGuide);dialog?.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});$('tg75-open-workspace')?.addEventListener('click',stopGuide);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopGuide();});window.addEventListener('pagehide',stopGuide);
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
