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
  // R94: ranking recreativo, apenas resultados reais do backend.
  // Nunca usa alert/confirm/prompt do navegador e nunca inventa trofeus de Batalha.
  function rankingNotice(message,title='Placar Tem Gogó'){
    if(window.TG_UI?.notice){void window.TG_UI.notice(message,{title});return;}
    console.info('Tem Gogó · '+title+': '+message);
  }
  function shareText(c,value,x,y,{size=34,color='#ffffff',weight=700,maxWidth=900,align='center'}={}){
    c.fillStyle=color;c.font=weight+' '+size+'px system-ui,sans-serif';c.textAlign=align;
    c.fillText(String(value||'').slice(0,90),x,y,maxWidth);
  }
  function rounded(c,x,y,w,h,r,fill,stroke){
    c.beginPath();c.roundRect(x,y,w,h,r);
    if(fill){c.fillStyle=fill;c.fill();}
    if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}
  }
  function wrapName(c,raw,x,y,maxWidth){
    let words=String(raw||'Estrela').trim().split(/\s+/).filter(Boolean);
    if(!words.length)words=['Estrela'];
    const line1=[],line2=[];
    c.font='700 33px system-ui,sans-serif';
    for(const word of words){
      const target=!line1.length||c.measureText([...line1,word].join(' ')).width<maxWidth?line1:line2;
      target.push(word);
    }
    shareText(c,line1.join(' '),x,y,{size:33,maxWidth});
    if(line2.length)shareText(c,line2.join(' '),x,y+39,{size:30,color:'#ead7ef',maxWidth});
  }
  async function paintAvatar(c,img,x,y,radius=73){
    c.save();
    c.fillStyle='#39254d';c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.fill();
    c.lineWidth=4;c.strokeStyle='#e9b9ed';c.stroke();
    try{
      if(img && !img.complete && typeof img.decode==='function')await img.decode().catch(()=>{});
      if(img?.naturalWidth>0 && img?.naturalHeight>0){
        // Preserva cabelo, rosto e bordas do avatar inteiro dentro do circulo.
        const scale=Math.min((radius*1.68)/img.naturalWidth,(radius*1.68)/img.naturalHeight);
        const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
        c.beginPath();c.arc(x,y,radius-3,0,Math.PI*2);c.clip();
        c.drawImage(img,x-w/2,y-h/2,w,h);
      }else{
        shareText(c,'♪',x,y+radius*.28,{size:Math.round(radius),color:'#f5d9f4'});
      }
    }catch{shareText(c,'♪',x,y+radius*.28,{size:Math.round(radius),color:'#f5d9f4'});}
    c.restore();
  }
  async function makeRankingCard(){
    const context=window.TG15_RECAP_CONTEXT?.();
    if(!context){rankingNotice('Abra um placar autorizado da sua conta para compartilhar.');return;}
    const stillCurrent=()=>window.TG15_RECAP_CONTEXT?.()===context;
    const root=byId('recap-podium');
    const podium=Array.from(root?.querySelectorAll('.recap-winner')||[]).slice(0,3);
    if(!podium.length){
      rankingNotice('Ainda não há notas válidas para montar o card. Quando as apresentações forem avaliadas, o placar poderá ser compartilhado.','Card ainda indisponível');
      return;
    }
    const podiumData=podium.map((el,i)=>({
      position:i+1,
      name:el.querySelector('b')?.textContent?.trim()||'Estrela',
      score:el.querySelector('strong')?.textContent?.trim()||'',
      img:el.querySelector('img')
    }));
    const room=String(byId('recap-room-title')?.textContent||'Nossa festa').trim();
    const total=String(byId('recap-total')?.textContent||'0').trim(),scored=String(byId('recap-scored')?.textContent||'0').trim();
    const perrengue=byId('recap-flop'),includeFlop=byId('tg15-share-flop')?.checked===true;
    const flopName=includeFlop&&perrengue&&!perrengue.hidden?byId('recap-flop-name')?.textContent?.trim()||'':'';
    const cv=document.createElement('canvas');cv.width=1080;cv.height=1350;
    const c=cv.getContext('2d');if(!c)throw Error('Canvas indisponível');
    const grad=c.createLinearGradient(0,0,1080,1350);
    grad.addColorStop(0,'#180f2c');grad.addColorStop(.55,'#4c2053');grad.addColorStop(1,'#180f29');
    c.fillStyle=grad;c.fillRect(0,0,1080,1350);
    c.fillStyle='rgba(255,187,224,.05)';
    for(let i=0;i<15;i++){c.beginPath();c.arc((i*173+65)%1080,(i*241+80)%1220,8+(i%4)*4,0,Math.PI*2);c.fill();}
    // R87 — 4:5 card with adaptive podium. No empty columns for one or two singers.
    rounded(c,25,25,1030,1300,36,'rgba(27,14,43,.64)','#a86eaa');
    shareText(c,'✳ TEM GOGÓ',540,125,{size:76,color:'#f8d9f4',weight:900});
    shareText(c,'PLACAR DA NOITE',540,204,{size:64,weight:900});
    shareText(c,'RANKING RECREATIVO',540,257,{size:30,color:'#f3bde5',weight:700});
    shareText(c,room,540,324,{size:45,color:'#ffffff',maxWidth:950});
    rounded(c,64,358,952,4,2,'#c487c7');
    const colors={1:['#b77a26','#f4d487'],2:['#606b86','#d4dff4'],3:['#885c4e','#e3b39d']};
    const single=podiumData.length===1, count=podiumData.length;
    const height=count===3?196:count===2?288:602;
    for(let i=0;i<count;i++){
      const item=podiumData[i],x=54,y=384+i*(height+14),w=972;
      const [tone,border]=colors[item.position]||colors[3];
      const cardGrad=c.createLinearGradient(x,y,x+w,y+height);
      cardGrad.addColorStop(0,tone);cardGrad.addColorStop(.42,'#39244d');cardGrad.addColorStop(1,'#221a34');
      rounded(c,x,y,w,height,28,cardGrad,border);
      if(single){
        shareText(c,'1º LUGAR',540,y+85,{size:55,weight:900});
        await paintAvatar(c,item.img,540,y+230,112);if(!stillCurrent())return;
        shareText(c,item.name,540,y+398,{size:62,weight:850,maxWidth:875});
        shareText(c,'MELHOR NOTA',540,y+455,{size:29,color:'#f1dcec',weight:700});
        shareText(c,item.score,540,y+554,{size:102,color:'#f2f9c5',weight:900,maxWidth:875});
      }else{
        const cy=y+height/2,rad=count===3?65:88;
        await paintAvatar(c,item.img,x+rad+28,cy,rad);if(!stillCurrent())return;
        const tx=x+rad*2+53;
        shareText(c,item.position+'º LUGAR',tx,cy-48,{size:count===3?33:41,weight:900,align:'left',maxWidth:420});
        shareText(c,item.name,tx,cy+12,{size:count===3?42:51,weight:850,align:'left',maxWidth:count===3?425:375});
        shareText(c,'MELHOR NOTA',x+w-34,cy-23,{size:23,color:'#f1dcec',weight:700,align:'right',maxWidth:235});
        shareText(c,item.score,x+w-34,cy+49,{size:count===3?57:70,color:'#f2f9c5',weight:900,align:'right',maxWidth:260});
      }
    }
    rounded(c,54,1010,972,100,18,'#402b4e','#95739c');
    shareText(c,total+' '+(total==='1'?'MÚSICA CONCLUÍDA':'MÚSICAS CONCLUÍDAS'),540,1051,{size:34,weight:850,maxWidth:910});
    shareText(c,scored+' COM AVALIAÇÃO',540,1091,{size:30,weight:650});
    if(flopName)shareText(c,'PERRENGUE DA NOITE: '+flopName,540,1163,{size:33,color:'#f9bfd4',maxWidth:950});
    else shareText(c,'UMA NOITE DE ESTRELAS!',540,1163,{size:37,color:'#fad2ee',weight:850});
    shareText(c,'Nota recreativa de tempo e volume · não mede afinação',540,1220,{size:26,color:'#f1e1f4',maxWidth:950});
    shareText(c,'Tem Gogó · quem tem gogó, mostra!',540,1285,{size:30,color:'#d3ffac',weight:800});
    const blob=await new Promise(resolve=>cv.toBlob(resolve,'image/png'));
    if(!stillCurrent())return;
    if(!blob)throw Error('Não foi possível gerar PNG');
    const name='tem-gogo-placar.png';
    if(typeof File==='function' && navigator.canShare){
      const file=new File([blob],name,{type:'image/png'});
      if(navigator.canShare({files:[file]})){
        try{await navigator.share({files:[file],title:'Tem Gogó · Placar da noite'});return;}
        catch(error){if(error?.name==='AbortError')return;}
      }
    }
    if(!stillCurrent())return;
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=name;link.style.display='none';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  byId('tg124-recap-image')?.addEventListener('click',async()=>{
    const button=byId('tg124-recap-image');
    if(button?.disabled)return;
    if(button)button.disabled=true;
    try{await makeRankingCard();}
    catch(error){
      console.warn('Tem Gogó: card não gerado',error);
      rankingNotice('Não conseguimos preparar a imagem neste navegador. Você ainda pode usar “Copiar placar” para compartilhar o resultado.','Não foi possível criar o card');
    }
    finally{if(button)button.disabled=false;}
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
