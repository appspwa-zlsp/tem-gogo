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
 ['Bem-vindos à Batalha!', 'A Drag Diva apresenta o festival: inscrições, apresentações, confrontos e um pódio oficial. Talento ajuda, mas coragem também conta!'],
 ['Vamos montar o elenco!', 'O anfitrião abre as inscrições e aprova de dois a doze competidores. Depois do fechamento do elenco, ninguém entra como novo competidor; espectadores podem solicitar participação conforme as regras.'],
 ['Hora da classificatória!', 'Cada competidor sobe ao palco e recebe sua avaliação. A classificação segue as regras oficiais do festival e a nota recreativa não mede afinação.'],
 ['Começam os confrontos!', 'O chaveamento depende da quantidade de competidores. Avanços e vitórias só aparecem quando o resultado é confirmado pelo servidor.'],
 ['Todo voto importa!', 'Votantes habilitados avaliam de uma a cinco estrelas. São 150 segundos com uma única prorrogação possível de 30 segundos. O eleitorado é congelado ao abrir a votação e o voto confirmado não pode ser trocado.'],
 ['O grande pódio!', 'A Drag Diva comemora conquistas oficiais de ouro, prata e bronze, persistentes somente na Batalha. Se não houver um resultado justo e válido, ninguém recebe um título inventado.']
 ];let i=0;const dialog=$('tg70-battle-guide');function showGuide(){const g=guides[i];$('tg70-guide-counter').textContent=`Cena ${i+1} de ${guides.length}`;$('tg70-guide-heading').textContent=g[0];$('tg70-guide-text').textContent=g[1];$('tg70-guide-prev').disabled=i===0;$('tg70-guide-next').textContent=i===guides.length-1?'Concluir':'Próximo';}
$('tg70-battle-story-open')?.addEventListener('click',()=>{i=0;showGuide();dialog?.showModal();});$('tg70-guide-close')?.addEventListener('click',()=>dialog.close());$('tg70-guide-prev')?.addEventListener('click',()=>{i=Math.max(0,i-1);showGuide();});$('tg70-guide-next')?.addEventListener('click',()=>{if(i===guides.length-1){dialog.close();return;}i++;showGuide();});dialog?.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
const faq=$('faq-dialog')?.querySelector('.tg193-faq-actions');if(faq){const btn=document.createElement('button');btn.type='button';btn.className='button button-outline';btn.textContent='🏆 Rever apresentação da Batalha';btn.addEventListener('click',()=>{if($('faq-dialog')?.open)$('faq-dialog').close();i=0;showGuide();dialog?.showModal();});faq.append(btn);}
if(battle){battle.disabled=true;battle.setAttribute('aria-disabled','true');}
})();
