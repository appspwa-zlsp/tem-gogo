/* Tem Gogó: mesa rápida visual + volume inline. Não modifica WebRTC/nota/player.
 * The existing player/microphone volume input listeners remain the only writers.
 */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  function init(){
    const bar=$('tg123-host-bar');
    const volumeBtn=bar?.querySelector('[data-tg123-host-command="volumes"]');
    if(!bar||!volumeBtn||bar.classList.contains('tg21-shortcuts'))return;
    bar.classList.add('tg21-shortcuts');
    const commands={
      toggle:['⏯','Play / Pausa','Reproduzir ou pausar a música no host'],
      next:['⏭','Próxima','Passar para a próxima música'],
      call:['🎤','Chamar','Preparar o próximo cantor'],
      volumes:['🎚','Volumes','Mostrar ajustes de volume aqui']
    };
    for(const b of bar.querySelectorAll('[data-tg123-host-command]')){
      const v=commands[b.dataset.tg123HostCommand];if(!v)continue;
      // Button itself is kept intact, preserving the real event handlers.
      b.replaceChildren();
      const icon=document.createElement('span');icon.className='tg21-command-icon';icon.setAttribute('aria-hidden','true');icon.textContent=v[0];
      const text=document.createElement('span');text.className='tg21-command-label';text.textContent=v[1];
      b.append(icon,text);b.setAttribute('aria-label',v[2]);b.title=v[2];
    }
    volumeBtn.setAttribute('aria-expanded','false');
    volumeBtn.setAttribute('aria-controls','tg21-volume-panel');
    const panel=document.createElement('section');panel.id='tg21-volume-panel';panel.className='tg21-volume-panel';panel.hidden=true;
    panel.setAttribute('aria-label','Ajustes rápidos de volume');
    panel.innerHTML=`<div class="tg21-volume-heading"><strong>🎚 Ajustar volumes</strong><button type="button" class="tg21-volume-close" aria-label="Fechar ajuste de volume">✕</button></div>
      <label class="tg21-volume-row" for="tg21-playback-volume"><span class="tg21-volume-meta"><span>🎵 Música / YouTube</span><output id="tg21-playback-value">80%</output></span><input type="range" id="tg21-playback-volume" min="0" max="100" step="1" value="80" aria-label="Volume da música no host"></label>
      <label class="tg21-volume-row" for="tg21-mics-volume"><span class="tg21-volume-meta"><span>🎙️ Microfones</span><output id="tg21-mics-value">100%</output></span><input type="range" id="tg21-mics-volume" min="0" max="200" step="1" value="100" aria-label="Nível dos microfones, controle existente"></label>
      <label class="tg21-volume-row" for="tg21-diva-volume"><span class="tg21-volume-meta"><span>🎙 Voz da Drag Diva</span><output id="tg21-diva-value">40%</output></span><input type="range" id="tg21-diva-volume" min="0" max="75" step="5" value="40" aria-label="Volume da Diva na TV"></label>
      <label class="tg21-volume-row" for="tg21-pop-volume"><span class="tg21-volume-meta"><span>🔔 Efeitos POP</span><output id="tg21-pop-value">25%</output></span><input type="range" id="tg21-pop-volume" min="0" max="75" step="5" value="25" aria-label="Volume POP na TV"></label>
      <p class="tg21-volume-note">Ajustes originais do host, sem mudar captação ou cálculo das notas.</p>`;
    const finish=$('stage-exit');
    if(finish?.parentElement===bar)bar.insertBefore(panel,finish);
    else bar.append(panel);
    const pairs=[['playback-volume-range','tg21-playback-volume','tg21-playback-value'],['volume-range','tg21-mics-volume','tg21-mics-value'],['tg74-voice-volume','tg21-diva-volume','tg21-diva-value'],['tg05-pop-volume','tg21-pop-volume','tg21-pop-value']];
    const sync=()=>{
      for(const [originalId,mirrorId,labelId] of pairs){
        const original=$(originalId),mirror=$(mirrorId),label=$(labelId);
        if(!original||!mirror)continue;
        mirror.value=original.value;mirror.disabled=original.disabled;
        mirror.min=original.min;mirror.max=original.max;mirror.step=original.step;
        if(label)label.textContent=original.value+'%';
      }
    };
    const setOpen=(open,restoreFocus=false)=>{
      panel.hidden=!open;volumeBtn.setAttribute('aria-expanded',String(open));
      if(open){sync();$('tg21-playback-volume')?.focus({preventScroll:true});}
      else if(restoreFocus)volumeBtn.focus({preventScroll:true});
    };
    // app.js has an old listener that jumps to another tab/scrolls. Intercept
    // only this one click during capture, while preserving all other buttons.
    volumeBtn.addEventListener('click',event=>{
      event.preventDefault();event.stopImmediatePropagation();
      setOpen(panel.hidden);
    },true);
    panel.querySelector('.tg21-volume-close').addEventListener('click',()=>setOpen(false,true));
    for(const [originalId,mirrorId,labelId] of pairs){
      const original=$(originalId),mirror=$(mirrorId),label=$(labelId);
      if(!original||!mirror){if(mirror)mirror.disabled=true;continue;}
      mirror.addEventListener('input',()=>{
        original.value=mirror.value;
        // Use the existing handler, which applies the actual volume.
        original.dispatchEvent(new Event('input',{bubbles:true}));
        if(label)label.textContent=original.value+'%';
      });
      original.addEventListener('input',()=>{
        mirror.value=original.value;
        if(label)label.textContent=original.value+'%';
      });
    }
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!panel.hidden){event.stopPropagation();setOpen(false,true);}
    });
    document.addEventListener('pointerdown',event=>{
      if(!panel.hidden&&!bar.contains(event.target))setOpen(false);
    });
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
