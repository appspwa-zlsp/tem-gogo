/* Tem Gogó beta 1.2.4 — acessibilidade, convite contextual e atualização voluntária. */
(()=>{
'use strict';
function byId(id){return document.getElementById(id);}
function boot(){
  // Foto de perfil também responde ao teclado.
  const avatar=byId('guest-profile-avatar');
  avatar?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();avatar.click();}});
  // O botão de finalizar permanece no painel principal após ser movido pelo app.
  const finish=byId('stage-exit');if(finish){finish.textContent='⏻ Finalizar festa';finish.title='Encerrar a festa para todos com confirmação';}
  // QR móvel do anfitrião: não mostrar bloco gigante o tempo inteiro.
  const stage=byId('stage');const invite=byId('stage-qr');
  if(stage&&invite){
    const btn=document.createElement('button');btn.className='button button-soft tg124-invite-shortcut';btn.type='button';btn.textContent='▦ Convidar';btn.setAttribute('aria-label','Ver QR de convite dos participantes');
    stage.querySelector('.stage-actions')?.prepend(btn);
    const dlg=document.createElement('dialog');dlg.className='tg124-profile-menu tg124-invite-dialog';
    dlg.innerHTML='<div class="tg124-profile-inner"><header><h2>Convidar para a festa</h2><button type="button" data-close-invite aria-label="Fechar">✕</button></header><div id="tg124-invite-qr"></div><p>Aponte a câmera de outro celular para o QR da festa.</p></div>';
    document.body.append(dlg);
    btn.addEventListener('click',()=>{const slot=byId('tg124-invite-qr');slot.replaceChildren(...Array.from(invite.children).map(node=>node.cloneNode(true)));dlg.showModal();});
    dlg.querySelector('[data-close-invite]')?.addEventListener('click',()=>dlg.close());
  }
  // Adição confirmada no painel: aguarda o resultado real; não fecha no clique de envio.
  // O usuário pode fechar manualmente, sem bloquear a biblioteca.
  // D023: exportação PNG real, usando o resultado mostrado pelo backend, não simulação.
  byId('tg124-recap-image')?.addEventListener('click',async()=>{
    try{
      const podium=Array.from(document.querySelectorAll('#recap-podium .recap-winner'));
      if(!podium.length){alert('Ainda não há pontuação válida para compartilhar.');return;}
      const cv=document.createElement('canvas');cv.width=1080;cv.height=1350;const c=cv.getContext('2d');
      const grad=c.createLinearGradient(0,0,1080,1350);grad.addColorStop(0,'#270e37');grad.addColorStop(.65,'#511a61');grad.addColorStop(1,'#171329');c.fillStyle=grad;c.fillRect(0,0,1080,1350);
      const txt=(str,x,y,size=34,color='#ffffff',weight='700',align='center')=>{c.fillStyle=color;c.font=weight+' '+size+'px system-ui';c.textAlign=align;c.fillText(String(str||'').slice(0,65),x,y,970);};
      txt('✳ TEM GOGÓ',540,110,65,'#d0ff9c');txt('🏆 RESULTADO DA NOITE',540,210,51,'#ffffff');
      txt(byId('recap-room-title')?.textContent||'Nossa festa',540,273,31,'#e7d0ef','500');
      const ordered=podium.map(el=>({place:el.querySelector('.recap-medal')?.textContent||'',name:el.querySelector('b')?.textContent||'',score:el.querySelector('strong')?.textContent||'',img:el.querySelector('img')}));
      // visual 2-1-3
      for(const [i,row] of ordered.entries()){
        const x=[540,215,865][i];const y=i===0?430:500;
        c.fillStyle=['#ad7d2c','#636596','#9f4f5b'][i];c.beginPath();c.roundRect(x-146,y+95,292,425-(i*40),20);c.fill();
        if(row.img?.complete&&row.img.naturalWidth){c.save();c.beginPath();c.arc(x,y+17,70,0,Math.PI*2);c.clip();c.drawImage(row.img,x-70,y-53,140,140);c.restore();}
        else txt('🎤',x,y+35,82);
        txt(row.place,x,y+164,53);txt(row.name,x,y+250,30);txt(row.score,x,y+315,39,'#d4ff9c');
      }
      const last=byId('recap-flop');if(last&&!last.hidden){txt('🎭 Perrengue da Noite',540,1040,41,'#ffb5c8');txt((byId('recap-flop-name')?.textContent||'')+' · '+(byId('recap-flop-score')?.textContent||''),540,1095,32);}
      txt('🎶 O povo é o show!',540,1200,36,'#cff2c8');
      cv.toBlob(async blob=>{
        if(!blob)return;const file=new File([blob],'tem-gogo-resultado.png',{type:'image/png'});
        if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Resultado do Tem Gogó'});return;}catch(e){if(e.name==='AbortError')return;}}
        const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='tem-gogo-resultado.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
      },'image/png');
    }catch(error){console.warn('Falha ao exportar o resultado:',error);alert('Não foi possível gerar o card neste navegador. Use Copiar placar.');}
  });
  // PWA: NÃO força update enquanto alguém estiver cantando.
  if('serviceWorker' in navigator){
    navigator.serviceWorker.ready.then(reg=>{
      function showUpdate(){
        if(!reg.waiting||byId('tg124-update-tip'))return;
        const box=document.createElement('div');box.id='tg124-update-tip';box.setAttribute('role','status');
        box.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;max-width:470px;margin:auto;z-index:9999;background:#352145;color:white;border:1px solid #b57bdb;border-radius:16px;padding:15px;box-shadow:0 8px 22px #160d22';
        box.innerHTML='<strong>✨ Atualização do Tem Gogó disponível</strong><p>Atualize quando terminar a apresentação. Seu show não será recarregado automaticamente.</p><button type="button" data-update-now>Atualizar agora</button> <button type="button" data-update-later>Depois</button>';
        document.body.append(box);
        box.querySelector('[data-update-later]').addEventListener('click',()=>box.remove());
        box.querySelector('[data-update-now]').addEventListener('click',()=>{
          const stageActive=byId('stage')&&!byId('stage').hidden&&(byId('stage-preflight')&&!byId('stage-preflight').hidden || byId('final-overlay')&&!byId('final-overlay').hidden || byId('stage')?.dataset.showState==='playing');
          const guestActive=byId('guest-preflight')&&!byId('guest-preflight').hidden||byId('guest-mic-panel')&&!byId('guest-mic-panel').hidden;
          if(stageActive||guestActive||document.body.classList.contains('tg124-remote-focus')){box.querySelector('p').textContent='Termine a apresentação e desligue o microfone antes de atualizar.';return;}
          navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});reg.waiting?.postMessage({type:'TG_APPLY_UPDATE'});
        });
      }
      if(reg.waiting)showUpdate();
      reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdate();});});
    }).catch(()=>{});
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
