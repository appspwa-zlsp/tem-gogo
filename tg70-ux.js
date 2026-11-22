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
classic?.addEventListener('click',()=>{const el=$('host-create-area');el?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'center'});$('room-title')?.focus({preventScroll:true});});
const guides=[
 ['O reality começa!', 'De 2 a 12 estrelas participam do campeonato. Cada pessoa apresenta uma música solo antes de começar o mata-mata.'],
 ['Todo mundo se apresenta', 'As classificatórias organizam os confrontos. Ninguém é eliminado só porque o número de participantes não fecha uma chave perfeita.'],
 ['É hora de votar!', 'Os celulares habilitados recebem votação de 1 a 5 estrelas. Existem regras de quórum, desempate e proteção contra votos duplicados.'],
 ['Duelo é cantado junto', 'Em cada duelo, dois cantores apresentam a mesma música ao mesmo tempo. Se um microfone falhar, os dois podem repetir sem punição técnica.'],
 ['O troféu vem no final', 'Resultados, medalhas e retomadas precisam ser confirmados no servidor. O backend privado já foi instalado, mas só haverá batalhas após integração segura, testes e liberação específica.']
 ];let i=0;const dialog=$('tg70-battle-guide');function showGuide(){const g=guides[i];$('tg70-guide-counter').textContent=`Passo ${i+1} de ${guides.length}`;$('tg70-guide-heading').textContent=g[0];$('tg70-guide-text').textContent=g[1];$('tg70-guide-prev').disabled=i===0;$('tg70-guide-next').textContent=i===guides.length-1?'Concluir':'Próximo';}
battle?.addEventListener('click',()=>{i=0;showGuide();dialog?.showModal();});$('tg70-guide-close')?.addEventListener('click',()=>dialog.close());$('tg70-guide-prev')?.addEventListener('click',()=>{i=Math.max(0,i-1);showGuide();});$('tg70-guide-next')?.addEventListener('click',()=>{if(i===guides.length-1){dialog.close();return;}i++;showGuide();});dialog?.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
})();
