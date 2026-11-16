from pathlib import Path
p=Path('/mnt/data/temgogo_v19_work/app.js')
s=p.read_text()
def repl(old,new,n=1):
 global s
 c=s.count(old)
 if c!=n: raise RuntimeError(f'expected {n}, found {c}: {old[:110]}')
 s=s.replace(old,new)
# state extras without touching preexisting fields
repl('remoteLastSent:0, soloMic:null, pushAsked:false, guestMicLock:false','remoteLastSent:0, soloMic:null, pushAsked:false, guestMicLock:false, remoteTab:"control", remotePending:new Map(), deviceChannelReady:false, lastDevicePoll:0, deviceId:(typeof crypto.randomUUID==="function"?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2))')
# remote tabs / status and phone performance parity
start=s.index('  function renderRemote(){')
end=s.index('  async function renameRemoteSinger(){',start)
s=s[:start]+'''  function switchRemoteTab(tab='control'){
    if(state.role!=='remote')return;
    const next=tab==='singing'?'singing':'control';state.remoteTab=next;
    for(const [name,id] of [['control','tg19-remote-control'],['singing','tg19-remote-singing']]){
      const panel=$(id),button=$('tg19-tab-'+name),active=name===next;
      panel.hidden=!active;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));
    }
  }
  function callActive(){return Boolean(state.guestPreflightSong||isMyTurn());}
  function renderRemote(){
    if(state.role!=='remote'||!state.room)return;
    const playing=state.songs.find(x=>x.status==='playing');
    const next=state.songs.find(x=>x.status==='queued');
    $('tg18-remote-now').textContent=playing?.title||'Palco aguardando música';
    $('tg18-remote-next').textContent=next?.title||'Fim da fila';
    $('tg18-remote-count').textContent=state.songs.filter(x=>x.status==='queued').length+' na fila';
    const personal=state.scores.find(x=>x.user_id===state.user?.id);
    $('tg19-remote-score').textContent=personal?'🏆 Sua última nota: '+personal.score+'/100 · A Diva avaliou sua participação':'🏆 Seu placar aparece depois de cantar';
    renderRemoteMic();
  }
  function renderRemoteMic(){
    const panel=$('tg18-remote-mic');if(!panel||state.role!=='remote')return;
    const playing=state.songs.find(s=>s.status==='playing'&&isSinger(s,state.user?.id));
    const called=Boolean(state.guestPreflightSong);
    const active=Boolean(playing);
    document.body.classList.toggle('tg18-remote-singing',active);
    panel.hidden=!called&&!active;
    $('tg19-remote-idle').hidden=called||active;
    $('tg18-remote-song').textContent=playing?.title||state.guestPreflightSong?.title||'Sua próxima música';
    $('tg18-remote-mic-title').textContent=active?'🎤 VOCÊ ESTÁ CANTANDO!':'👑 VOCÊ É O PRÓXIMO!';
    $('tg18-remote-mic-status').textContent=!availableMic()?'🔴 Microfone desligado':state.localPeer?.connectionState==='connected'?'🟢 Áudio conectado à TV':state.guestReady?'✅ Pronto(a) · aguarde a TV':'🟡 Autorizado no celular';
    $('tg18-remote-mic-toggle').textContent=availableMic()?'🔇 Desligar microfone':called?'🎙️ ATIVAR MIC E FICAR PRONTO(A)':'🎙️ Ativar microfone';
    const ready=$('tg18-remote-mic-ready');ready.hidden=true;
    $('tg18-remote-mic-note').textContent=active?'Seu áudio está sendo enviado à TV por WebRTC; a nota vem do medidor deste celular. O controle permanece acessível na outra aba.':called?'Um toque autoriza seu microfone e avisa o anfitrião automaticamente. A TV só libera o vídeo quando todos estiverem preparados.':'Sua voz só é capturada quando a Diva chamar.';
    if($('tg19-remote-vocal-gain'))$('tg19-remote-vocal-gain').value=String(Math.round(state.guestMicGain*100));
  }
''' + s[end:]
# send via dedicated owner-only device signaling, no karaoke_signals new constraint
repl("await sendSignal(state.user.id,'host-remote',{command:cmd,value:typeof value==='number'?value:null,at:Date.now()});\n      $('tg18-remote-feedback').textContent='✓ Comando enviado à TV: '+cmd;", "const id=crypto.randomUUID();\n      $('tg18-remote-feedback').textContent='◌ Enviando ao palco…';\n      await sendSignal(state.user.id,'host-remote',{command:cmd,value:typeof value==='number'?value:null,at:Date.now(),id});\n      $('tg18-remote-feedback').textContent='◌ Comando enviado; aguardando confirmação da TV…';\n      state.remotePending.set(id,Date.now());\n      setTimeout(()=>{if(state.remotePending.has(id)){state.remotePending.delete(id);if(state.role==='remote')$('tg18-remote-feedback').textContent='⚠ Sem confirmação da TV. Verifique a conexão e o SQL 019.';}},8500);")
repl("const allowed=['play','pause','toggle','next','prepare','start','resend','playback-volume','mic-volume'];","const allowed=['play','pause','toggle','next','prepare','start','resend','playback-volume','mic-volume'];")
# ack any remote command, even if action no effect; send after process
repl('  async function handleRemoteCommand(data){\n    if(state.role!==\'host\'||!state.room||Math.abs(Date.now()-Number(data.at))>20000)return;\n    const cmd=data.command;','''  async function handleRemoteCommand(data){
    if(state.role!=='host'||!state.room||Math.abs(Date.now()-Number(data.at))>20000)return;
    const cmd=data.command;
    const ack=()=>{if(data.id)void sendSignal(state.user.id,'host-remote-ack',{id:data.id,command:cmd,at:Date.now()}).catch(console.warn);};
    ack();''')
# UI status at remote start / reset
repl("await stopSession();state.room=room;state.role='remote';show('tg18-remote');","await stopSession();state.room=room;state.role='remote';state.remoteTab='control';show('tg18-remote');switchRemoteTab('control');")
# host mic stream in same owner must use self device channel, not original signals
repl('  async function sendSignal(to,kind,payload={}) {\n    if(!state.room||!state.user)return;','''  async function sendSignal(to,kind,payload={}) {
    if(!state.room||!state.user)return;
    // Conta do host em TV e celular tem o MESMO UID. O banco antigo de sinais
    // não permite (ou distingue) envio para si próprio. Canal dedicado + RLS.
    if(to===state.user.id&&state.room.owner_id===state.user.id&&['host','remote'].includes(state.role)){
      const {error}=await state.client.from('karaoke_host_device_signals').insert({
        room_id:state.room.id,owner_id:state.user.id,
        sender_role:state.role,receiver_role:state.role==='host'?'remote':'host',
        kind,payload:{...payload,_device:state.deviceId}
      });
      if(error)throw new Error('Canal host/celular não configurado: '+error.message+' (aplique o SQL 019)');
      return;
    }''')
# add channel subscriber and polling
repl(".on('postgres_changes',{event:'INSERT',schema:'public',table:'karaoke_signals',filter:`receiver_id=eq.${uid}`},payload=>receiveSignal(payload.new));", """.on('postgres_changes',{event:'INSERT',schema:'public',table:'karaoke_signals',filter:`receiver_id=eq.${uid}`},payload=>receiveSignal(payload.new))
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'karaoke_host_device_signals',filter:`owner_id=eq.${uid}`},payload=>receiveHostDeviceSignal(payload.new));""")
repl('    await fetchRecentSignals();\n    if(state.role===\'host\'){',"    await fetchRecentSignals();\n    await fetchHostDeviceSignals();\n    if(state.role==='host'){")
repl("state.signalPoller=setInterval(()=>{if(state.room&&navigator.onLine&&(state.role==='host'||isPhoneSingerRole()))void fetchRecentSignals();},state.role==='host'?3500:8500);","""state.signalPoller=setInterval(()=>{
      if(state.room&&navigator.onLine&&(state.role==='host'||isPhoneSingerRole())){
        void fetchRecentSignals();void fetchHostDeviceSignals();
      }
    },state.role==='remote'?2000:state.role==='host'?2400:7000);""")
# host signal inbound (ack remote phone)
repl("      if(signal.kind==='host-remote'){if(from===state.room.owner_id)await handleRemoteCommand(data);return;}","      if(signal.kind==='host-remote'){if(from===state.room.owner_id&&signal._ownerDevice===true)await handleRemoteCommand(data);return;}")
repl("    }else if(isPhoneSingerRole()&&from===state.room.owner_id){\n      if(signal.kind==='stage-prepare'){","""    }else if(isPhoneSingerRole()&&from===state.room.owner_id){
      if(signal.kind==='host-remote-ack'&&state.role==='remote'){
        if(data.id&&state.remotePending.has(data.id)){
          state.remotePending.delete(data.id);
          $('tg18-remote-feedback').textContent='✅ TV confirmou: '+String(data.command||'comando');
        }
        return;
      }
      if(signal.kind==='stage-prepare'){""")
# add dedicated channel fetch methods before receiveSignal
anchor='  function receiveSignal(signal) {'
assert anchor in s
s=s.replace(anchor,'''  function receiveHostDeviceSignal(record){
    if(!state.room||record.room_id!==state.room.id||record.owner_id!==state.user?.id)return;
    if(!['host','remote'].includes(state.role)||record.receiver_role!==state.role)return;
    if(record.sender_role===state.role||record.payload?._device===state.deviceId)return;
    const signal={...record,id:'device-'+record.id,sender_id:record.owner_id,receiver_id:record.owner_id,_ownerDevice:true};
    receiveSignal(signal);
  }
  async function fetchHostDeviceSignals(){
    if(!state.room||!['host','remote'].includes(state.role)||state.room.owner_id!==state.user?.id)return;
    try{
      const {data,error}=await state.client.from('karaoke_host_device_signals').select('*')
        .eq('room_id',state.room.id).eq('owner_id',state.user.id).eq('receiver_role',state.role)
        .gte('created_at',new Date(Date.now()-95000).toISOString()).order('created_at',{ascending:true}).limit(120);
      if(error)throw error;
      for(const item of data||[])receiveHostDeviceSignal(item);
    }catch(err){
      if(Date.now()-state.lastDevicePoll>15000){state.lastDevicePoll=Date.now();console.warn('Sincronia host/celular: ',err.message);}
    }
  }
''' +anchor)
# mic permission/ready one click
start=s.index('  function openMicPermission(){');end=s.index('  async function startMicrophone(){',start)
s=s[:start]+'''  function openMicPermission(){
    if(!isPhoneSingerRole())return;
    if(!callActive()){toast('A Diva libera o microfone quando chegar sua chamada. Enquanto isso, escolha músicas!');return;}
    if(availableMic()){
      if(state.guestPreflightSong&&!state.guestReady){state.guestReady=true;void notifyPreflightGuest();renderGuestPreflight();renderRemoteMic();closeGuestCall();}
      else toast('Seu microfone já está ativado. Para desligar, toque no botão do microfone.');
      return;
    }
    if(!navigator.mediaDevices?.getUserMedia){toast('Microfone exige HTTPS e navegador compatível.',true);return;}
    // Chamada direta de getUserMedia a partir do clique: sem modal intermediário.
    void startMicrophone();
  }
  async function toggleMic(){
    if(availableMic()){await stopMicrophone(true);return;}
    openMicPermission();
  }
''' +s[end:]
repl("      renderGuestPreflight();renderRemoteMic();if(state.guestPreflightSong&&!state.guestReady)openGuestCall();void notifyPreflightGuest();", """      if(state.guestPreflightSong){state.guestReady=true;closeGuestCall();toast('✅ Microfone autorizado! A Diva avisou ao anfitrião que você está pronto(a).');}
      renderGuestPreflight();renderRemoteMic();void notifyPreflightGuest();""")
repl("    if(!state.room||!isPhoneSingerRole())return;\n    if(!navigator.mediaDevices?.getUserMedia)","    if(!state.room||!isPhoneSingerRole()||!callActive())return;\n    if(!navigator.mediaDevices?.getUserMedia)")
# stop mic after leaving preflight if canceled (unless song has started)
repl("if(signal.kind==='stage-prepare-cancel'&&state.guestPreflightSong?.id===data.songId&&state.guestPreflightSong?.token===data.token){state.guestPreflightSong=null;state.guestReady=false;renderGuestPreflight();closeGuestCall();return;}","""if(signal.kind==='stage-prepare-cancel'&&state.guestPreflightSong?.id===data.songId&&state.guestPreflightSong?.token===data.token){
        state.guestPreflightSong=null;state.guestReady=false;
        if(!isMyTurn()&&state.localStream)void stopMicrophone(true);
        renderGuestPreflight();renderGuestCallVisibility();closeGuestCall();return;
      }""")
# when preparing render call state and button only; sync readiness after grant
start=s.index('  function renderGuestPreflight(){');end=s.index('  async function sendProfileToHost(){',start)
s=s[:start]+'''  function renderGuestCallVisibility(){
    if(state.role!=='guest')return;
    const called=callActive();
    $('mobile-tab-mic').hidden=!called;
    $('tg16-mic-shortcut').hidden=!called;
    $('guest-preflight').hidden=!state.guestPreflightSong;
    $('guest-mic-panel').hidden=!called||state.mobileTab!=='mic';
    if(!called&&state.mobileTab==='mic')switchMobileTab('queue',false);
  }
  function renderGuestPreflight(){
    const playing=state.songs.find(s=>s.status==='playing'&&isSinger(s,state.user?.id));
    const urgent=Boolean(playing&&!availableMic());
    const song=urgent?playing:state.guestPreflightSong,box=$('guest-preflight');
    if(state.role==='guest')renderGuestCallVisibility();
    box.hidden=state.role!=='guest'||!song;
    if(!song){renderRemoteMic();return;}
    $('guest-preflight-title').textContent=song.title||'Próximo show';
    $('guest-preflight-status').textContent=availableMic()?(state.guestReady?'✅ Pronto(a)! Aguardando liberação da TV':'🟡 Microfone ativo no celular'):'🔴 Microfone desligado';
    $('guest-preflight-ready').hidden=true;
    $('guest-preflight-mic').hidden=Boolean(availableMic());
    $('guest-preflight-mic').textContent=urgent?'🎙️ LIGAR MICROFONE AGORA':'🎙️ ATIVAR MIC E FICAR PRONTO(A)';
    $('guest-preflight-message').textContent=urgent?'Sua música começou. Ative o microfone para cantar!':state.guestReady&&availableMic()?'Tudo certo! O anfitrião já sabe que você está pronto(a).':'Um toque autoriza o microfone e confirma sua prontidão à TV. A apresentação só começa quando o host liberar.';
    updateGuestMicLabel();renderRemoteMic();
  }
''' +s[end:]
# guest called overlay only; host remote tab
repl("    $('tg18-turn-track').textContent=state.guestPreflightSong.title||'Seu show';", "    if(state.role==='remote'){switchRemoteTab('singing');toast('🎤 Você é o próximo! Abra Eu cantando para liberar seu microfone.');if(navigator.vibrate)navigator.vibrate([120,80,120]);return;}\n    $('tg18-turn-track').textContent=state.guestPreflightSong.title||'Seu show';")
repl("    $('tg18-turn-ready').disabled=!availableMic();\n    $('tg18-turn-ready').textContent=state.guestReady?'✅ PRONTO(A) — AGUARDANDO':'✅ ESTOU PRONTO(A)';","    $('tg18-turn-ready').hidden=true;\n    $('tg18-turn-mic').textContent=availableMic()?'✅ MICROFONE PRONTO':'🎙️ ATIVAR MIC E FICAR PRONTO(A)';")
# render score and mic on remote same analyzer
repl("if(state.role==='remote'&&((state.remoteMicTick=(state.remoteMicTick||0)+1)%14===0))renderRemoteMic();", "if(state.role==='remote'){drawRemoteLevels(rms);if(((state.remoteMicTick=(state.remoteMicTick||0)+1)%14===0))renderRemoteMic();}")
repl('  function drawMobileLevels(value){','''  function drawRemoteLevels(value){
    const list=$('tg19-remote-levels')?.children||[];
    const count=Math.round(Math.min(1,value/.12)*list.length);
    Array.from(list).forEach((bar,i)=>{bar.classList.toggle('lit',i<count);bar.style.height=(i<count?Math.min(100,20+value*500+(i%3)*7):10)+'%';});
  }
  function drawMobileLevels(value){''')
# update guest tab logic
repl("    if(state.guestMicLock&&tab!=='mic')return;", "    if(state.guestMicLock&&tab!=='mic')return;\n    if(tab==='mic'&&!callActive()){toast('Seu microfone aparece quando a Diva chamar.');tab='queue';}")
# called state set before renderGuestPreflight; one re-render
repl("    $('mobile-tab-mic').classList.toggle('turn-highlight',mine);", "    $('mobile-tab-mic').classList.toggle('turn-highlight',mine);\n    if(state.role==='remote'&&mine)switchRemoteTab('singing');")
# prevent stale `lastMySong` set while mine playing: original good
# make main mic hidden unless active, use callback accessible on show
repl("    $('your-turn-banner').hidden=!mine;$('mic-turn-kicker').hidden=!mine;", "    $('your-turn-banner').hidden=!mine;$('mic-turn-kicker').hidden=!mine;")
# use smaller QR generation (display scales); avoid overbound fixed width 240
repl("width:240,height:240,colorDark", "width:176,height:176,colorDark")
# remote and guest push, not only guest
repl("if(!state.user||state.role!=='guest'){toast('Entre numa festa para ligar os avisos.',true);return;}", "if(!state.user||!isPhoneSingerRole()){toast('Entre numa festa pelo celular para ligar os avisos.',true);return;}")
repl("toast('✅ Avisos de chamada ativados neste aparelho!');$('tg18-push-cta').textContent='🔔 Avisos ativados';", "toast('✅ Avisos de chamada ativados neste aparelho!');$('tg18-push-cta').textContent='🔔 Avisos ativados';if($('tg19-remote-push'))$('tg19-remote-push').textContent='🔔 Avisos ativados';")
# listeners
repl("$('tg18-remote-open').addEventListener('click',()=>{if(state.room)void enterRoomAsRemote(state.room);});","""$('tg18-remote-open').addEventListener('click',()=>{
      if(!state.room)return;
      const url=new URL(currentURL(state.room.code));url.searchParams.set('remote','1');
      const message='Abra ESTE endereço no celular, entre na mesma conta e escolha a aba Controle: '+url.href;
      if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url.href).then(()=>toast('📱 Link do controle copiado! Abra no seu celular.')).catch(()=>window.prompt(message,url.href));}
      else window.prompt(message,url.href);
    });""")
repl("$('tg18-remote-stage').addEventListener('click',", "$('tg19-tab-control').addEventListener('click',()=>switchRemoteTab('control'));\n    $('tg19-tab-singing').addEventListener('click',()=>switchRemoteTab('singing'));\n    $('tg18-remote-stage').addEventListener('click',")
repl("$('tg18-remote-mic-toggle').addEventListener('click',()=>openMicPermission());", "$('tg18-remote-mic-toggle').addEventListener('click',()=>void toggleMic());")
repl("$('tg18-remote-mic-ready').addEventListener('click',()=>{if(!state.guestPreflightSong||!availableMic()){toast('Ative seu microfone e aguarde sua chamada.',true);return;}state.guestReady=true;renderGuestPreflight();void notifyPreflightGuest();closeGuestCall();renderRemoteMic();toast('✅ Pronto(a)! Seu celular vai cantar e continuar controlando a festa.');});", "$('tg18-remote-mic-ready').addEventListener('click',openMicPermission);")
repl("$('tg18-turn-mic').addEventListener('click',()=>{closeGuestCall();if(state.role==='guest')switchMobileTab('mic');openMicPermission();});", "$('tg18-turn-mic').addEventListener('click',()=>{if(state.role==='guest')switchMobileTab('mic');openMicPermission();});")
repl("$('tg18-turn-ready').addEventListener('click',()=>{if(!availableMic()){toast('Microfone ainda desligado.',true);return;}state.guestReady=true;renderGuestPreflight();void notifyPreflightGuest();closeGuestCall();toast('✅ Pronto(a)! O host foi avisado.');});", "$('tg18-turn-ready').addEventListener('click',openMicPermission);")
repl("$('guest-preflight-mic').addEventListener('click',()=>{switchMobileTab('mic');openMicPermission();});", "$('guest-preflight-mic').addEventListener('click',()=>{switchMobileTab('mic');openMicPermission();});")
repl("$('guest-preflight-ready').addEventListener('click',()=>{if(!availableMic()){toast('Ative o microfone primeiro.',true);return;}state.guestReady=true;renderGuestPreflight();void notifyPreflightGuest();toast('Confirmação enviada ao anfitrião! ✅');});", "$('guest-preflight-ready').addEventListener('click',openMicPermission);")
repl("$('mic-confirm-permission').addEventListener('click',()=>{$('mic-permission-dialog').close();void startMicrophone();});", "$('mic-confirm-permission').addEventListener('click',()=>{$('mic-permission-dialog').close();openMicPermission();});")
# ensure overlay auto hide after state ready, remote tab other controls remain accessible
# device references reset (pending only)
repl("state.songs=[];state.members=[];state.scores=[];state.lastMySong=null;", "state.remotePending.clear();state.songs=[];state.members=[];state.scores=[];state.lastMySong=null;")
# improve front-end error if SQL omitted, remote should explicitly show inaccessible
repl("catch(err){toast('Controle remoto indisponível: '+humanError(err),true);}", "catch(err){$('tg18-remote-feedback').textContent='⚠ '+humanError(err);toast('Controle remoto indisponível: '+humanError(err),true);}")
# singer on remote volume panel
anchor="    for(const [id,cmd] of [['tg18-remote-playback','playback-volume'],['tg18-remote-mics','mic-volume']])$(id).addEventListener('change',e=>void remoteCommand(cmd,Number(e.target.value)));"
assert anchor in s
s=s.replace(anchor,anchor+"\n    $('tg19-remote-vocal-gain').addEventListener('input',event=>{const value=Number(event.target.value);$('guest-mic-gain').value=String(value);$('guest-mic-gain').dispatchEvent(new Event('input',{bubbles:true}));});")
# init render visibility after various events
p.write_text(s)
print('patched js',len(s))
