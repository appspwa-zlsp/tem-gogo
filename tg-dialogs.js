/* Tem Gogó Beta 1.0.2 — diálogos próprios, sem alert/confirm/prompt do navegador. */
(()=>{'use strict';
let current=null;
function createDialog(){
  let dialog=document.getElementById('tg-ui-dialog');
  if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id='tg-ui-dialog';dialog.className='tg-ui-dialog';
  dialog.setAttribute('aria-labelledby','tg-ui-title');
  dialog.setAttribute('aria-describedby','tg-ui-copy');
  const panel=document.createElement('div');panel.className='tg-ui-dialog-panel';
  const mark=document.createElement('span');mark.className='tg-ui-dialog-mark';mark.textContent='✦ TEM GOGÓ · SUA FESTA';
  const heading=document.createElement('h2');heading.id='tg-ui-title';
  const copy=document.createElement('p');copy.id='tg-ui-copy';
  const field=document.createElement('input');field.id='tg-ui-input';field.className='tg-ui-dialog-input';field.type='text';field.hidden=true;
  const options=document.createElement('div');options.className='tg-ui-dialog-actions';options.id='tg-ui-dialog-actions';
  panel.append(mark,heading,copy,field,options);dialog.append(panel);document.body.append(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
  return dialog;
}
function finish(value){if(!current)return;const resolve=current;current=null;const dialog=createDialog();if(dialog.open)dialog.close();resolve(value);}
async function open({title,message,choices,inputValue,maxLength}={}){
  const dialog=createDialog();
  // Serializar os diálogos evita decisões sobrepostas durante uma apresentação.
  if(current)return null;
  document.getElementById('tg-ui-title').textContent=title||'Tem Gogó';
  document.getElementById('tg-ui-copy').textContent=message||'';
  const field=document.getElementById('tg-ui-input');field.hidden=inputValue===undefined;
  if(inputValue!==undefined){field.value=String(inputValue);field.maxLength=maxLength||100;field.setAttribute('aria-label','Sua resposta');}
  const actions=document.getElementById('tg-ui-dialog-actions');actions.replaceChildren();
  for(const option of choices||[]){
    const btn=document.createElement('button');btn.type='button';btn.className='tg-ui-dialog-button'+(option.primary?' primary':'')+(option.danger?' danger':'');btn.textContent=option.label;
    btn.addEventListener('click',()=>finish(option.input?field.value:option.value));actions.append(btn);
  }
  return new Promise(resolve=>{current=resolve;try{dialog.showModal();if(!field.hidden)field.focus();else (actions.querySelector('button.danger')?actions.querySelector('button:not(.primary)'):actions.querySelector('button.primary'))?.focus();}catch(e){console.warn('Não foi possível abrir diálogo Tem Gogó:',e);finish(null);}});
}
function confirm(message,{title='Confirmar ação',confirmText='Confirmar',danger=false}={}){
  return open({title,message,choices:[{label:'Voltar',value:false},{label:confirmText,value:true,primary:true,danger}]}).then(Boolean);
}
function prompt(message,value='',title='Meu nome no palco'){
  return open({title,message,inputValue:value,maxLength:100,choices:[{label:'Cancelar',value:null},{label:'Salvar',value:null,primary:true,input:true}]});
}
function choose({title,message,choices}){
  return open({title,message,choices:[...(choices||[]),{label:'Agora não',value:null}]});
}

function notice(message,{title='Tem Gogó',buttonText='Entendi'}={}){
  return open({title,message,choices:[{label:buttonText,value:true,primary:true}]});
}
function shareLink(message,url){
  return open({title:'Controle no celular',message,inputValue:url,maxLength:2048,choices:[{label:'Fechar',value:null},{label:'Copiar endereço',value:null,primary:true,input:true}]}).then(async value=>{
    if(value===null)return;try{await navigator.clipboard.writeText(value);}catch{
      const f=document.createElement('textarea');f.value=value;f.style.position='fixed';f.style.opacity='0';document.body.append(f);f.select();try{document.execCommand('copy');}catch{}f.remove();
    }
  });
}
// R10 — navegação de abas por teclado, delegada aos mesmos cliques autorizados.
function bindAccessTabs(){
  for(const group of document.querySelectorAll('#access-tabs,.tg19-remote-tabs')){
    const tabs=()=>[...group.querySelectorAll('[role="tab"]')];
    const sync=()=>{for(const t of tabs())t.tabIndex=t.getAttribute('aria-selected')==='true'&&!t.disabled?0:-1;};
    sync();new MutationObserver(sync).observe(group,{subtree:true,attributes:true,attributeFilter:['aria-selected','disabled']});
    group.addEventListener('keydown',e=>{
      const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key)||!tabs().includes(e.target))return;
      const available=tabs().filter(t=>!t.disabled&&!t.hidden);const i=available.indexOf(e.target);if(i<0||!available.length)return;
      e.preventDefault();const next=available[e.key==='Home'?0:e.key==='End'?available.length-1:(i+(e.key==='ArrowLeft'?-1:1)+available.length)%available.length];
      next.click();if(next.getAttribute('aria-selected')==='true'&&next.getClientRects().length)next.focus();
    });
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindAccessTabs,{once:true});else bindAccessTabs();

window.TG_UI={confirm,prompt,choose,notice,shareLink};
})();
