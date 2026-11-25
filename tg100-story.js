/* R100: ilustração educativa; não abre competição, não toca som, não inventa resultados. */
(()=>{'use strict';
const dlg=document.getElementById('tg70-battle-guide'),counter=document.getElementById('tg70-guide-counter');if(!dlg||!counter)return;
const scenes=[
 [{label:'Drag Diva',img:'diva-busto.png'},{label:'Seu palco',icon:'🎤'},{label:'O festival',icon:'✦'}],
 [{label:'Inscrição',img:'cantor-urbano.png'},{label:'Elenco aprovado',img:'cantora-ruiva.png'},{label:'2 a 12 competidores',icon:'🎙️'}],
 [{label:'Apresentação',img:'cantora-oculos.png'},{label:'Avaliação',icon:'★'},{label:'Classificação oficial',icon:'▤'}],
 [{label:'Confronto',img:'cantor-esporte.png'},{label:'Chave por fase',icon:'◇'},{label:'Próxima fase',icon:'→'}],
 [{label:'Eleitorado congelado',icon:'🔒'},{label:'150 s + 30 s (uma vez)',icon:'⏱'},{label:'Voto confirmado',icon:'✓'}],
 [{label:'Ouro',icon:'🥇'},{label:'Prata',icon:'🥈'},{label:'Bronze',icon:'🥉'}]
];
const section=document.createElement('section');section.className='tg100-scene';section.setAttribute('aria-label','Ilustração educativa da cena');const caption=document.createElement('small');caption.textContent='VISUAL EDUCATIVO · SEM RESULTADOS REAIS';const items=document.createElement('div');items.className='tg100-scene-list';const progress=document.createElement('div');progress.className='tg100-scene-progress';progress.setAttribute('aria-hidden','true');section.append(caption,items,progress);document.getElementById('tg70-guide-text')?.after(section);
let last=-1;function render(){const m=counter.textContent.match(/\d+/);const n=Math.max(0,Math.min(5,Number(m?.[0]||1)-1));if(n===last)return;last=n;items.replaceChildren();progress.replaceChildren();for(const v of scenes[n]){const card=document.createElement('div');card.className='tg100-scene-item';if(v.img){const im=document.createElement('img');im.src='./'+v.img;im.alt='';card.append(im)}else{const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.textContent=v.icon;card.append(icon)}const label=document.createElement('b');label.textContent=v.label;card.append(label);items.append(card)}for(let k=0;k<6;k++){const i=document.createElement('i');if(k<=n)i.className='on';progress.append(i)}}
new MutationObserver(render).observe(counter,{childList:true,characterData:true,subtree:true});render();
})();
