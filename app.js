/* Tem Gogó v9 — edição brasileira: palco, Diva Gogó e reações GIPHY (opcional) — aplicativo estático (PWA + Supabase + WebRTC + YouTube IFrame API).
 * Os vídeos são reproduzidos pelo YouTube; nenhum áudio do YouTube é extraído.
 * Microfones são transportados diretamente via WebRTC quando houver conexão.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cfg = window.TEM_GOGO_CONFIG || {};
  const state = {
    client: null, user: null, room: null, role: null, emergencyBlocked:true, emergencyLatch:false, emergencyGeneration:undefined,
    songs: [], members: [], scores: [], channel: null,
    currentSong: null, player: null, playerReady: false,
    playerAPIReady: false, isPlaying: false, finishing: false,
    peers: new Map(), localPeer: null, localStream: null,
    localAnalyzer: null, localAudioContext: null,
    context: null, masterGain: 1, playbackVolume: 80, guestMicGain: 1, micGainNode: null, micSendStream: null, micStats: new Map(),
    candidateBuffer: new Map(), processedSignals: new Set(),
    signalChain: Promise.resolve(), ticker: null, signalCleaner: null,
    pendingInstall: null, inviteRoom: null, wakeLock: null, currentTheme: 'glam',
    roomReloadTimer: null, roomPoller: null, signalPoller: null, syncRunning: false, syncQueued: false, realtimeOk: false, lastMySong: null, micConnecting: false, captureSeen: false, memberVerifier: null, scoreOverlayTimer: null, humorMode: 'debochado', gifsEnabled: true, effectsEnabled: true, reactionToken: 0, voxIndex: 0, readyRoom: null, externalSearchBlocked: false, failedVideoSong: null, catalog: [], catalogFetchedAt: 0, catalogLoading: null, catalogError: null, catalogFilter: "all", catalogQuery: "", catalogPage: 1, voxTimer: null, playMetrics: null, micActivity: null, micActivitySyncing: false, cloudMicStats: new Map(), scoreReady: new Map(), lastActivityRefresh: 0, lastMicSnapshot: 0, preflight: null, preflightTimer: null, guestPreflightSong: null, guestReady: false, avatars: new Map(), avatar: localStorage.getItem("tem-gogo-avatar")||"urbano", lastProfileSent: 0, divaVoiceEnabled: false, divaSpeakingTimer: null, divaLastSpokenAt: 0, lastGuestResultKey: null, micPermissions: new Map(), remoteLastSent:0, soloMic:null, pushAsked:false, guestMicLock:false, remoteTab:"control", remoteAutoSinger:false, remotePending:new Map(), remoteLatestCommandId:null, recoveryVerified:false, recoveryIntent:false, deviceChannelReady:false, lastDevicePoll:0, deviceId:(typeof crypto.randomUUID==="function"?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2))
  };


  // V7.5: contexto de leitura compartilhado com o painel isolado da Batalha.
  // Nunca expor segredos administrativos, nem permitir que o painel altere state.
  Object.defineProperty(window,'TG_APP_CONTEXT',{value:Object.freeze({
    getClient:()=>state.client,
    getUser:()=>state.user,
    getRole:()=>state.role,
    getRoomId:()=>state.room?.id||null,
    getCompetitiveRoom:()=>state.role==='host'&&state.room?.owner_id===state.user?.id?{id:state.room.id,reserved:state.room.tg30_battle_reserved===true}:null,
    reserveCompetitiveRoom:async festivalId=>{
      const room=state.room?.id,uid=state.user?.id;
      if(state.role!=='host'||!room||state.room.owner_id!==uid||state.currentSong||state.songs.length)throw Error('Abra uma sala clássica nova, sem músicas ou convidados.');
      const result=await callRPC('tg30_reserve_battle_room',{p_room:room,p_festival:festivalId});
      if(state.room?.id!==room||state.user?.id!==uid||state.role!=='host')throw Error('Sessão alterada. Consulte a sala novamente.');
      if(result?.reserved!==true||result.room_id!==room)throw Error('Reserva não confirmada.');
      await fetchRoom();if(state.room?.id!==room||state.room.tg30_battle_reserved!==true)throw Error('Reserva não confirmada na leitura da sala.');
      renderAll();return result;
    },
    refreshCompetitiveRoom:async roomId=>{if(state.room?.id===roomId&&state.room.tg30_battle_reserved===true)await fetchRoom();},
    getBattleQueue:()=>{
      if(state.role!=='host'||state.room?.owner_id!==state.user?.id||state.room?.tg30_battle_reserved!==true||state.emergencyBlocked)return [];
      return state.songs.filter(s=>s.status==='queued'&&!s.started_at&&!s.finished_at).map(s=>({id:s.id,room_id:s.room_id,video_id:s.video_id,title:s.title,singers:songSingers(s)}));
    },
    getBattlePerformance:()=>{
      const song=state.currentSong;
      if(state.room?.tg30_battle_reserved!==true||state.role!=='host'||state.room?.owner_id!==state.user?.id||!song||state.room.current_song_id!==song.id||song.status!=='playing'||state.finishing)return null;
      return {room_id:state.room.id,song_id:song.id,singers:songSingers(song)};
    }
  }),writable:false,configurable:false});

  // V14 — personagens originais enviados como homenagem; sem redesenhar seus traços.
  const AVATARS = Object.freeze({
    urbano:'./cantor-urbano.png', esporte:'./cantor-esporte.png',
    ruiva:'./cantora-ruiva.png', oculos:'./cantora-oculos.png'
  });
  const AVATAR_NUMBERS={urbano:'1',esporte:'2',ruiva:'3',oculos:'4'};
  // Quem usava 'diva' como avatar na V14 passa a usar 1; a Diva Gogó agora é somente apresentadora.
  if(!AVATARS[state.avatar]){state.avatar='urbano';localStorage.setItem('tem-gogo-avatar','urbano');}
  // Estado desconhecido também não exibe notas; o banco é a fonte da classificação.
  function tg13Recreational(){return state.room?.tg30_battle_reserved===false;}
  function tg13ScorePrivacy(){
    if(tg13Recreational())return;
    state.scores=[];
    if($('guest-latest-score'))$('guest-latest-score').hidden=true;
    if($('guest-latest-score-value'))$('guest-latest-score-value').textContent='';
    if($('stage-rank-list'))$('stage-rank-list').textContent='Placar recreativo indisponível nesta sala.';
    if($('rank-updated'))$('rank-updated').textContent='';
    if($('live-score-list'))$('live-score-list').textContent='Avaliação técnica reservada.';
    if($('mic-list'))for(const el of $('mic-list').querySelectorAll('.mic-person-top b'))el.textContent='Sinal do microfone';
    if($('tg19-remote-score'))$('tg19-remote-score').textContent='Avaliação técnica reservada.';
    if($('tg04-remote-ranking'))$('tg04-remote-ranking').textContent='Placar recreativo indisponível nesta sala.';
    if($('score-list'))$('score-list').replaceChildren();
    if($('score-dialog')?.open)$('score-dialog').close();
    if($('final-number'))$('final-number').textContent='';
    if($('final-stars'))$('final-stars').textContent='';
    if($('final-duet-details'))$('final-duet-details').replaceChildren();
    if($('final-overlay')&&!$('final-overlay').hidden)hideFinal();
  }
  function avatarSrc(key){return AVATARS[key]||AVATARS.urbano;}
  function avatarForMember(uid){return avatarSrc(state.avatars.get(uid)||(uid===state.user?.id?state.avatar:undefined));}
  function isPhoneSingerRole(){return state.role==='guest'||state.role==='remote';}
  function updateMicPersona(){
    const who=state.user?.id ? memberName(state.user.id) : 'Estrela';
    const playing=state.songs.find(s=>s.status==='playing'&&isSinger(s,state.user?.id));
    const track=playing?.title||state.guestPreflightSong?.title||'A Diva avisa quando chegar sua vez';
    for(const prefix of ['guest','remote']){
      const avatar=$('tg123-'+prefix+'-mic-avatar');if(!avatar)continue;
      avatar.src=avatarSrc(state.avatar);
      const name=$('tg123-'+prefix+'-mic-name');if(name)name.textContent=who;
      const song=$('tg123-'+prefix+'-mic-track');if(song)song.textContent=track;
    }
  }

  function availableMic(){return !!state.localStream?.getAudioTracks().some(t=>t.readyState==='live'&&t.enabled);}
  // R83: a conta permanente lê o avatar canônico; a identidade temporária conserva a escolha local por UID.
  let tg83AvatarRevision=0;
  const tg83AvatarKey=uid=>'tem-gogo-avatar:'+uid;
  function tg83SetAvatar(key){
    if(!Object.hasOwn(AVATARS,key))return false;
    state.avatar=key;tg83AvatarRevision++;
    if(state.room&&state.user?.id)state.avatars.set(state.user.id,key);
    try{localStorage.setItem('tem-gogo-avatar',key);if(state.user?.id)localStorage.setItem(tg83AvatarKey(state.user.id),key);}catch{}
    renderAvatarOptions();updateMicPersona();return true;
  }
  async function tg83RestoreAvatar(){
    const uid=state.user?.id,epoch=tg07SessionEpoch,revision=tg83AvatarRevision,client=state.client;
    if(!uid||!client)return;
    const current=()=>uid===state.user?.id&&epoch===tg07SessionEpoch&&revision===tg83AvatarRevision&&client===state.client;
    if(isAnonymous(state.user)){
      let cached;try{cached=localStorage.getItem(tg83AvatarKey(uid));}catch{}
      if(current())tg83SetAvatar(cached&&Object.hasOwn(AVATARS,cached)?cached:'urbano');
      return;
    }
    try{const {data,error}=await client.from('tg_profiles').select('avatar_key').eq('user_id',uid).maybeSingle();
      if(!error&&current()){let cached;try{cached=localStorage.getItem(tg83AvatarKey(uid));}catch{}tg83SetAvatar(data&&Object.hasOwn(AVATARS,data.avatar_key)?data.avatar_key:cached&&Object.hasOwn(AVATARS,cached)?cached:'urbano');}
    }catch(e){console.warn('Avatar da conta não consultado:',e);}
  }
  function renderAvatarOptions(){
    for(const id of ['entry-avatar-options','profile-avatar-options']){
      const root=$(id);if(!root)continue;
      // Preserve an unsaved guest avatar choice while room hydration completes.
      if(id==='profile-avatar-options'&&$('guest-profile-dialog')?.open&&root.children.length)continue;
      root.innerHTML=Object.entries(AVATARS).map(([key,src])=>`<label class="avatar-option"><input type="radio" name="${id}" value="${key}" ${key===state.avatar?'checked':''}><img src="${src}" alt="Avatar ${AVATAR_NUMBERS[key]}" loading="lazy"><span>${AVATAR_NUMBERS[key]}</span></label>`).join('');
      root.onchange=event=>{if(id==='profile-avatar-options')return;const key=event.target?.value;if(Object.hasOwn(AVATARS,key)&&(!state.user||isAnonymous(state.user)))tg83SetAvatar(key);else for(const input of root.querySelectorAll('input'))input.checked=input.value===state.avatar;};
    }
    if($('guest-profile-avatar'))$('guest-profile-avatar').src=avatarSrc(state.avatar);
    for(const img of document.querySelectorAll('[data-tg83-account-avatar]'))img.src=avatarSrc(state.avatar);
  }
  // V18: controle remoto por sinais autenticados e dirigidos ao palco (sem segundo player).
  async function enterRoomAsRemote(room){
    if(state.emergencyClosing||state.finishing||state.startingSong)return false;
    if(room?.room_mode==='solo'){toast('A Carreira Solo usa apenas o aparelho do palco.',true);return;}
    if(!state.user || room.owner_id!==state.user.id || isAnonymous(state.user)){toast('Somente a conta anfitriã pode usar o controle remoto.',true);return;}
    const uid=state.user.id,epoch=tg07SessionEpoch+1;await stopSession();if(state.user?.id!==uid||tg07SessionEpoch!==epoch||state.room)return false;state.room=room;state.role='remote';state.remoteTab='control';state.remoteAutoSinger=false;show('tg18-remote');switchRemoteTab('control');
    $('tg18-remote-room').textContent=room.title;document.body.classList.add('tg18-remote-active');
    const scope=tg07Scope(),current=()=>tg38RoomCurrent(scope,'remote');
    try{await hydrateRoom();if(!current())return;await subscribeRoom();if(!current())return;startTicker();renderRemote();void loadCatalog();await sendProfileToHost();if(!current())return;toast('Controle remoto conectado. Você também pode cantar pelo celular!');void remoteCommand('stage-status');}
    catch(err){if(tg07Current(scope)&&!state.emergencyClosing)toast('Não foi possível conectar o controle: '+humanError(err),true);}
  }
  function switchRemoteTab(tab='control'){
    if(state.role!=='remote')return;
    const next=tab==='singing'?'singing':'control';
    if((state.guestPreflightSong||isMyTurn())&&next==='control')return;
    state.remoteTab=next;document.body.classList.toggle('tg124-remote-focus',callActive());
    if(next==='control')state.remoteAutoSinger=false;
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
    if($('tg92-remote-info-current'))$('tg92-remote-info-current').textContent=playing?.title||'Aguardando música';
    if($('tg92-remote-info-next'))$('tg92-remote-info-next').textContent=next?.title||'Fim da fila';
    if($('tg92-remote-info-queue'))$('tg92-remote-info-queue').textContent=state.songs.filter(x=>x.status==='queued').length+' na fila';
    const personal=tg13Recreational()?state.scores.find(x=>x.user_id===state.user?.id):null;
    $('tg19-remote-score').textContent=personal?'🏆 Sua última nota: '+personal.score+'/100 · A Diva avaliou sua participação':'🏆 Seu placar aparece depois de cantar';
    renderRemoteQueue();
    const rank=$('tg04-remote-ranking');if(rank){const rows=getRankingRows();rank.textContent=rows.length?rows.slice(0,3).map((r,i)=>`${i+1}º ${memberName(r.uid)} · ${r.best}/100`).join(' • '):'Ainda não há notas nesta festa.';}
    renderRemoteMic();if(!tg13Recreational())tg13ScorePrivacy();
  }
  function renderRemoteQueue(){
    const list=$('tg19-remote-queue-list');if(!list||state.role!=='remote')return;
    const pending=state.songs.filter(song=>song.status==='queued');
    list.innerHTML=pending.length?pending.map((song,index)=>`<article class="tg19-remote-queue-item">
      <div class="tg19-remote-queue-name"><small>#${index+1} · ${escapeHTML(songSingerLabel(song))}</small><strong>${escapeHTML(song.title)}</strong></div>
      <div class="tg19-remote-queue-actions"><button class="button button-primary" type="button" data-tg19-prepare="${song.id}">🎬 Preparar</button><button class="button button-soft" type="button" data-tg19-remove="${song.id}" aria-label="Remover música da fila">✕</button></div>
    </article>`).join(''):'<p class="tg19-remote-queue-empty">A fila está vazia. Toque em Músicas para adicionar uma apresentação.</p>';
  }
  async function remoteRemoveSong(songId){
    if(state.role!=='remote'||state.user?.id!==state.room?.owner_id)return;
    const scope=tg07Scope();
    const song=state.songs.find(s=>s.id===songId&&s.status==='queued');
    if(!song||!await window.TG_UI.confirm('Remover “'+song.title+'” da fila?',{title:'Organizar fila',confirmText:'Remover música',danger:true}))return;
    if(state.emergencyBlocked||!tg07Current(scope)||state.role!=='remote'||callActive()||!state.songs.some(s=>s.id===songId&&s.status==='queued'))return;
    try{await callRPC('karaoke_remove_song',{p_room:scope.room,p_song:song.id});if(!tg07Current(scope))return;await fetchSongs();toast('Música removida da fila.');}
    catch(err){toast('Não foi possível remover a música: '+humanError(err),true);}
  }
  function renderRemoteMic(){
    const panel=$('tg18-remote-mic');if(!panel||state.role!=='remote')return;
    updateMicPersona();
    const playing=state.songs.find(s=>s.status==='playing'&&isSinger(s,state.user?.id));
    const called=Boolean(state.guestPreflightSong);
    const active=Boolean(playing);
    const controlTab=$('tg19-tab-control');
    const music=$('tg18-remote-music');if(music){music.hidden=called||active;music.disabled=called||active||state.emergencyBlocked;}
    controlTab.disabled=called||active;
    controlTab.title=called||active?'Controle protegido durante sua apresentação.':'';
    document.body.classList.toggle('tg18-remote-singing',active);
    document.body.classList.toggle('tg103-remote-mic-focus',called||active);document.body.classList.toggle('tg124-remote-focus',called||active);
    if(called||active){
      if(state.remoteTab!=='singing'){
        state.remoteAutoSinger=true; // abertura automática pela Diva, não escolha manual
        switchRemoteTab('singing');
      }
    }else if(state.remoteAutoSinger){
      // Só retornar automaticamente se o aplicativo (e não a pessoa) abriu Participar.
      state.remoteAutoSinger=false;
      if(state.remoteTab==='singing')switchRemoteTab('control');
    }
    panel.hidden=!called&&!active;
    $('tg19-remote-idle').hidden=called||active;
    $('tg18-remote-song').textContent=playing?.title||state.guestPreflightSong?.title||'Sua próxima música';
    $('tg18-remote-mic-title').textContent=active?'VOCÊ ESTÁ CANTANDO!':'VOCÊ É O PRÓXIMO!';
    $('tg18-remote-mic-status').classList.toggle('tg103-status-on',availableMic());
    $('tg18-remote-mic-status').classList.toggle('tg103-status-off',!availableMic());
    $('tg18-remote-mic-status').textContent=!availableMic()?'🔴 MICROFONE DESLIGADO':state.localPeer?.connectionState==='connected'?'Ao vivo · TV conectada':state.guestReady?'Pronto(a) · aguardando TV':'Autorizado · conectando';
    const micAction=availableMic()?'Desligar microfone':called?'Ativar mic e ficar pronto(a)':'Ativar microfone';$('tg192-remote-mic-action').textContent=micAction;$('tg18-remote-mic-toggle').setAttribute('aria-label',micAction);$('tg18-remote-mic-toggle').classList.toggle('active',availableMic());
    const ready=$('tg18-remote-mic-ready');ready.hidden=true;
    $('tg18-remote-mic-note').textContent=active?'Seu áudio está sendo enviado à TV por WebRTC; a nota vem do medidor deste celular. O controle fica protegido durante sua apresentação e volta a ficar disponível ao terminar.':called?'Um toque autoriza seu microfone e avisa o anfitrião automaticamente. A TV só libera o vídeo quando todos estiverem preparados.':'Sua voz só é capturada quando a Diva chamar.';
    if($('tg19-remote-vocal-gain'))$('tg19-remote-vocal-gain').value=String(Math.round(state.guestMicGain*100));
  }
  async function renameRemoteSinger(){
    if(state.role!=='remote'||!state.room||state.room.owner_id!==state.user?.id)return;
    const current=state.members.find(m=>m.user_id===state.user.id)?.display_name||'Anfitrião';
    const answer=await window.TG_UI.prompt('Como quer aparecer na fila e no placar?',current,'Nome de cantor');const name=answer?.trim();
    if(name==null||name===current)return;
    if(name.length<2||name.length>24){toast('Use um apelido de 2 a 24 caracteres.',true);return;}
    try{
      const {data,error}=await state.client.from('karaoke_members').update({display_name:name})
        .eq('room_id',state.room.id).eq('user_id',state.user.id).select('display_name');
      if(error||!data?.length)throw error||new Error('Atualização não autorizada; execute o SQL_018.');
      localStorage.setItem('tem-gogo-display-name',name);
      await fetchMembers();renderRemote();toast('Apelido atualizado no palco!');
    }catch(err){toast('Não foi possível alterar o apelido: '+humanError(err),true);}
  }
  const tgR14Volumes={
    'playback-volume':['tg18-remote-playback','playback',100],
    'mic-volume':['tg18-remote-mics','mics',200],
    'diva-preview-volume':['tg04-remote-diva','diva',75],
    'pop-volume':['tg05-remote-pop','pop',75]
  };
  const tgR14CommandNames={'playback-volume':'volume da música','mic-volume':'volume dos microfones','diva-preview-volume':'volume da Diva','pop-volume':'volume POP','stage-status':'consulta dos ajustes','stage-theme':'tema do palco','diva-auto':'falas da Diva','pop-effect':'efeito sonoro',next:'próxima música',prepare:'preparar',toggle:'play/pausa',play:'reproduzir',pause:'pausar',start:'iniciar',resend:'reenviar chamada','prepare-song':'preparar música'};
  function tgR14Release(id){
    const pending=state.remotePending.get(id);if(!pending)return;
    state.remotePending.delete(id);
    const channel=tgR14Volumes[pending.cmd];if(channel)$(channel[0]).disabled=false;
  }
  function tgR14ClearRemote(){
    state.remotePending.clear();state.remoteLatestCommandId=null;
    for(const [id] of Object.values(tgR14Volumes))if($(id))$(id).disabled=false;
    if($('tg-r22-tv-theme-feedback'))$('tg-r22-tv-theme-feedback').textContent='Nenhum ajuste enviado.';
    if($('tg26-remote-audio-status'))$('tg26-remote-audio-status').textContent='Consulte a TV para conferir as falas.';
  }
  function tgR14AcceptAck(data){
    const pending=state.remotePending.get(data.id);if(!pending||data.command!==pending.cmd)return;
    tgR14Release(data.id);
    const latest=state.remoteLatestCommandId===data.id;
    const channel=tgR14Volumes[pending.cmd];
    const valid=(v,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
    let ok=data.ok===true;
    if(ok&&channel){const [id,key,max]=channel;const v=data.stage?.[key];if(valid(v,max))$(id).value=String(v);else ok=false;}
    if(ok&&latest&&!state.remotePending.size&&pending.cmd==='stage-status'){
      for(const [id,key,max] of Object.values(tgR14Volumes))if(valid(data.stage?.[key],max)&&document.activeElement!==$(id))$(id).value=String(data.stage[key]);
    }
    if(ok&&latest&&['stage-status','stage-theme'].includes(pending.cmd)&&THEMES.includes(data.stage?.theme)&&document.activeElement!==$('tg30-remote-stage-theme'))$('tg30-remote-stage-theme').value=data.stage.theme;
    const message=ok?'✅ TV confirmou: '+String(data.message||'comando'):'⚠ TV não confirmou '+(tgR14CommandNames[pending.cmd]||'o comando')+': '+String(data.ok===true?'resposta incompleta; consulte os ajustes da TV':data.message||'Não foi possível executar');
    if(pending.cmd==='stage-theme')$('tg-r22-tv-theme-feedback').textContent=message;
    if(['diva-auto','pop-effect','stage-status'].includes(pending.cmd)&&$('tg26-remote-audio-status')){const level=typeof data.stage?.auto==='boolean'?(data.stage.auto?' · Falas autorizadas':' · Falas desativadas'):'';$('tg26-remote-audio-status').textContent=message+(ok?level:'');}
    if(latest)$('tg18-remote-feedback').textContent=message;
    else if(!ok)toast(message,true);
  }
  let tgR13NextConfirmation=null;
  async function remoteCommand(cmd,value,songId=null){
    if(state.emergencyBlocked)return;
    if(state.role!=='remote'||state.user?.id!==state.room?.owner_id)return;
    const allowed=['play','pause','toggle','next','prepare','start','resend','playback-volume','mic-volume','prepare-song','stage-theme','diva-preview-volume','pop-volume','stage-status','diva-auto','pop-effect'];
    if(!allowed.includes(cmd))return;
    if(callActive() && !['start','resend'].includes(cmd)){toast('Durante sua vez o controle fica protegido; use o painel do microfone.',true);return;}
    if((cmd==='stage-status'||cmd==='stage-theme'||cmd==='diva-auto'||cmd==='pop-effect'||Object.hasOwn(tgR14Volumes,cmd))&&[...state.remotePending.values()].some(p=>p.cmd===cmd))return;
    const roomId=state.room.id,scope=tg07Scope();
    const playingId=()=>state.songs.find(s=>s.status==='playing')?.id??null;
    const expectedSongId=playingId();
    if(cmd==='prepare'&&expectedSongId){toast('Já existe uma música tocando. Use Próxima para pular.',true);return;}
    if(cmd==='next'){
      if((tgR13NextConfirmation&&tg07Current(tgR13NextConfirmation))||[...state.remotePending.values()].some(p=>p.cmd==='next')){toast('Aguarde a confirmação da próxima música.');return;}
      const ticket=scope;tgR13NextConfirmation=ticket;
      try{if(expectedSongId&&!await window.TG_UI.confirm('Pular a apresentação atual? Ela ficará sem nota.',{title:'Próxima música',confirmText:'Pular apresentação',danger:true}))return;}
      finally{if(tgR13NextConfirmation===ticket)tgR13NextConfirmation=null;}
      if(tg07Current(scope)&&playingId()!==expectedSongId){toast('A música mudou. Confira a fila antes de pular.',true);return;}
    }
    if(state.emergencyBlocked||!tg07Current(scope)||state.room?.id!==roomId||state.role!=='remote'||(callActive()&&!['start','resend'].includes(cmd)))return;
    state.remoteLastSent=Date.now();
    let id=null;
    try{
      id=crypto.randomUUID();
      state.remoteLatestCommandId=id;
      $('tg18-remote-feedback').textContent='◌ Enviando comando ao palco…';
      state.remotePending.set(id,{cmd,at:Date.now()});
      if(cmd==='stage-theme')$('tg-r22-tv-theme-feedback').textContent='Aguardando confirmação da TV…';
      if(['diva-auto','pop-effect'].includes(cmd)&&$('tg26-remote-audio-status'))$('tg26-remote-audio-status').textContent='Aguardando confirmação da TV…';
      if(tgR14Volumes[cmd])$(tgR14Volumes[cmd][0]).disabled=true;
      setTimeout(async()=>{
        if(state.emergencyBlocked||!tg07Current(scope)||!state.remotePending.has(id))return;
        // Reconcilia uma última vez com o banco, inclusive se o Realtime falhou.
        await Promise.race([(async()=>{await fetchHostDeviceSignals();await state.signalChain;})(),new Promise(resolve=>setTimeout(resolve,3000))]);
        if(state.emergencyBlocked||!tg07Current(scope)||!state.remotePending.has(id))return;
        tgR14Release(id);
        if(cmd==='stage-theme')$('tg-r22-tv-theme-feedback').textContent='A TV não confirmou. Confira o palco antes de repetir.';
        if(['diva-auto','pop-effect'].includes(cmd)&&$('tg26-remote-audio-status'))$('tg26-remote-audio-status').textContent='A TV não confirmou. Confira o palco antes de repetir.';
        if(state.role==='remote'&&state.remoteLatestCommandId===id){
          $('tg18-remote-feedback').textContent='⚠ A TV não confirmou este comando. Confira a tela antes de tocar novamente; não repetimos ações automaticamente.';
        }else toast('A TV não confirmou '+(tgR14CommandNames[cmd]||'o comando')+'. Consulte os ajustes antes de repetir.',true);
      },12000);
      await sendSignal(state.user.id,'host-remote',{command:cmd,value:typeof value==='number'||(cmd==='stage-theme'&&THEMES.includes(value))?value:null,songId:typeof songId==='string'?songId:null,...(cmd==='next'?{expectedSongId}:{}),at:Date.now(),id});
      // O ACK pode chegar pelo Realtime antes de o INSERT terminar.
      if(state.emergencyBlocked||!tg07Current(scope))return;
      if(state.remotePending.has(id)&&state.remoteLatestCommandId===id){
        $('tg18-remote-feedback').textContent='◌ Comando registrado; aguardando resposta da TV…';
      }
    }catch(err){
      if(!tg07Current(scope)||state.emergencyBlocked)return;
      if(id&&!state.remotePending.has(id))return; // ACK ou prazo já encerrou este comando.
      if(id)tgR14Release(id); // Não apagar outros comandos pendentes.
      if(cmd==='stage-theme')$('tg-r22-tv-theme-feedback').textContent='Não foi possível confirmar o envio.';
      if(['diva-auto','pop-effect'].includes(cmd)&&$('tg26-remote-audio-status'))$('tg26-remote-audio-status').textContent='Não foi possível confirmar o envio.';
      if(state.role==='remote'&&(!id||state.remoteLatestCommandId===id)){
        $('tg18-remote-feedback').textContent='⚠ Envio não concluído: '+humanError(err);
      }
      toast('Não foi possível enviar o comando: '+humanError(err),true);
    }
  }
  async function handleRemoteCommand(data,recordCreatedAt){
    if(state.emergencyBlocked)return;
    if(state.role!=='host'||!state.room||state.room.status!=='open')return;
    const scope=tg07Scope(),cmd=data?.command;
    const ack=async(ok,message)=>{
      if(state.emergencyBlocked||!tg07Current(scope)||!data?.id)return;
      await sendSignal(state.user.id,'host-remote-ack',{id:data.id,command:cmd,ok,message,at:Date.now(),...(ok?{stage:{playback:state.playbackVolume,mics:Math.round(state.masterGain*100),diva:window.TG74_DIVA_STUDIO?.getVolume(),pop:window.TG74_DIVA_STUDIO?.getPopVolume?.(),theme:state.currentTheme,auto:window.TG74_DIVA_STUDIO?.getAuto?.()}}:{})}).catch(err=>console.warn('Confirmação do controle remoto:',err));
    };
    // Usar o horário de gravação no Supabase evita descartar por relógio
    // incorreto do segundo aparelho. Nenhum comando expira sem resposta.
    const dbTime=Date.parse(recordCreatedAt||'');
    const submittedAt=Number.isFinite(dbTime)?dbTime:Number(data?.at);
    if(!Number.isFinite(submittedAt)||Math.abs(Date.now()-submittedAt)>20000){
      await ack(false,'O comando chegou fora do prazo. Confira a TV e envie uma nova ação.');
      return;
    }
    try{
      const playbackSongId=state.currentSong?.id??null;
      const toggleHadSong=cmd==='toggle'&&Boolean(state.currentSong);
      const toggleTarget=toggleHadSong?(state.isPlaying?2:1):null;
      if(cmd==='prepare-song'){
        let song=state.songs.find(s=>s.id===data.songId&&s.status==='queued');
        if(!song){await fetchSongs();song=state.songs.find(s=>s.id===data.songId&&s.status==='queued');}
        if(state.emergencyBlocked||!tg07Current(scope))return;
        if(!song)throw new Error('Esta música não está mais disponível na fila.');
        await prepareSong(song);
        if(state.preflight?.song.id!==song.id)throw new Error('Não foi possível preparar a música.');
      }else if(cmd==='toggle'){await togglePlayback();}
      else if(cmd==='play'){
        if(state.emergencyBlocked)return;
        if(state.currentSong)state.player?.playVideo();
        else if(state.preflight)await startPreparedSong();else await advanceSong();
      }else if(cmd==='pause'){if(!state.currentSong)throw new Error('Nenhuma música tocando.');state.player?.pauseVideo();}
      else if(cmd==='next'||cmd==='prepare'){
        const activeId=state.currentSong?.id??null;
        if(cmd==='prepare'&&activeId)throw Error('Já existe uma música tocando. Use Próxima para pular.');
        if(cmd==='next'&&(!Object.hasOwn(data,'expectedSongId')||data.expectedSongId!==activeId))throw Error('A música mudou ou o celular precisa ser atualizado. Confira a TV antes de pular.');
        if(!await advanceSong({remoteConfirmed:cmd==='next',expectedSongId:activeId}))throw Error('A ação não foi concluída. Confira o palco.');
      }
      else if(cmd==='start'){
        if(!state.preflight)throw new Error('Prepare uma música da fila primeiro.');
        const preparedSong=state.preflight.song.id;await startPreparedSong();if(state.currentSong?.id!==preparedSong)throw new Error('Aguardando prontidão dos cantores.');
      }else if(cmd==='resend'){
        if(!state.preflight)throw new Error('Ainda não há cantor chamado. Toque em Preparar na fila antes de reenviar a chamada.');
        await sendPreflightInvites(true);
      }else if(cmd==='stage-theme'){
        if(!canDirectDiva()||!THEMES.includes(data.value))throw new Error('Tema de palco inválido ou não autorizado.');
        await setStageTheme(data.value);
      }else if(cmd==='diva-auto'){
        if(!canDirectDiva()||!tg13Recreational()||![0,1].includes(data.value)||!window.TG74_DIVA_STUDIO?.setAuto)throw Error('Ajuste da Diva inválido ou indisponível.');
        window.TG74_DIVA_STUDIO.setAuto(data.value===1);
      }else if(cmd==='pop-effect'){
        throw Error('Os efeitos fazem parte da narração automática da Drag Diva.');
      }else if(cmd==='stage-status'){
        // Leitura local do palco, devolvida no ACK.
      }else if(cmd==='diva-preview-volume'){
        if(typeof data.value!=='number'||!Number.isFinite(data.value)||data.value<0||data.value>75||!window.TG74_DIVA_STUDIO?.setVolume)throw new Error('Volume da Drag Diva inválido ou estúdio indisponível.');
        window.TG74_DIVA_STUDIO.setVolume(data.value);
      }else if(cmd==='pop-volume'){
        if(!window.TG74_DIVA_STUDIO?.setPopVolume)throw new Error('Controle POP indisponível.');
        window.TG74_DIVA_STUDIO.setPopVolume(data.value);
      }else if(['playback-volume','mic-volume'].includes(cmd)){
        const v=data.value;
        if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>(cmd==='playback-volume'?100:200))throw new Error('Volume fora do intervalo permitido.');
        const id=cmd==='playback-volume'?'playback-volume-range':'volume-range';
        $(id).value=String(v);$(id).dispatchEvent(new Event('input',{bubbles:true}));
      }else throw new Error('Comando não reconhecido.');
      if(state.emergencyBlocked||!tg07Current(scope))return;
      const playbackCmd=['toggle','play','pause'].includes(cmd);
      if(playbackCmd && !state.currentSong && !state.preflight)throw new Error('Não há apresentação para controlar.');
      if(playbackCmd && state.currentSong && !state.playerReady)throw new Error('O player ainda não está pronto para confirmar este comando.');
      if(playbackCmd && state.currentSong && state.playerReady){
        await new Promise(resolve=>setTimeout(resolve,240));
        if(state.emergencyBlocked||!tg07Current(scope))return;
        if(playbackSongId!==null&&state.currentSong?.id!==playbackSongId)throw Error('A apresentação mudou antes da confirmação.');
        const status=state.player?.getPlayerState?.();
        if(cmd==='toggle' && toggleTarget!==null && status!==toggleTarget)throw new Error('O player ainda não confirmou a alteração de reprodução.');
        if(cmd==='pause' && status!==2)throw new Error('O player ainda não confirmou a pausa.');
        if(cmd==='play' && status!==1)throw new Error('O player ainda não confirmou a reprodução.');
      }
      if(cmd==='playback-volume'&&state.playerReady&&typeof state.player?.getVolume==='function'&&Math.round(state.player.getVolume())!==state.playbackVolume)throw Error('O player ainda não confirmou o volume.');
      await ack(true,cmd==='playback-volume'&&!state.playerReady?'Volume configurado; o vídeo ainda não está pronto.':cmd==='toggle'&&!toggleHadSong&&state.preflight?'Apresentação preparada; aguarde a prontidão dos cantores.':playbackCmd?'Ação recebida pelo player; confira a reprodução.':'Comando executado no palco');
    }catch(err){console.warn('Comando remoto:',err);await ack(false,String(err.message||'Falha ao executar').slice(0,130));}
  }
  // V18: microfone solo utiliza a captura local SEM enviar áudio para a própria saída,
  // evitando eco. A nota continua sendo atividade vocal, não afinação.
  let tgR19SoloRequest=null,tgR25SoloReport=null,tgR25SoloRetry=null;
  function tgR25SoloAllowed(a){return !!a&&tgR25SoloReport===a&&tg07Current(a.scope)&&!state.emergencyBlocked&&!state.emergencyClosing&&state.role==='host'&&state.room?.room_mode==='solo'&&tg13Recreational()&&state.room.owner_id===state.user?.id&&state.currentSong?.id===a.songId&&isSinger(state.currentSong,a.scope.uid);}
  function tgR25SoloFor(song){
    if(state.room?.room_mode!=='solo'||!tg13Recreational()||state.role!=='host'||state.room.owner_id!==state.user?.id||!isSinger(song,state.user?.id))return null;
    if(!tgR25SoloAllowed(tgR25SoloReport))tgR25SoloReport={scope:tg07Scope(),songId:song.id,samples:0,vocal:0,intensity:0,last:0,lastAttempt:0,sent:0,pending:null};
    return tgR25SoloReport;
  }
  function tgR25SyncSolo(a,force=false){
    if(!tgR25SoloAllowed(a))return Promise.resolve(false);
    if(a.pending)return a.pending;
    if(a.samples<=a.sent)return Promise.resolve(true);
    if(!force&&performance.now()-a.lastAttempt<2300)return Promise.resolve(false);
    a.lastAttempt=performance.now();
    const payload={p_room:a.scope.room,p_song:a.songId,p_samples:a.samples,p_vocal_samples:a.vocal,p_intensity_sum:a.intensity};
    const job=Promise.resolve().then(async()=>{
      if(!tgR25SoloAllowed(a))return false;
      try{const saved=await callRPC('karaoke_report_mic_activity',payload);if(saved===true&&tgR25SoloAllowed(a)){a.sent=payload.p_samples;return true;}}
      catch(err){console.warn('Sincronização Solo:',err?.message||err);}
      return false;
    }).finally(()=>{if(a.pending===job)a.pending=null;});
    a.pending=job;return job;
  }
  async function tgR25WaitSolo(job){let timer;try{return await Promise.race([job,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),3500);})]);}finally{clearTimeout(timer);}}
  async function tgR25FlushSolo(a){
    if(!a||a.samples<8)return true;
    if(!tgR25SoloAllowed(a))return false;
    if(a.pending)await tgR25WaitSolo(a.pending);
    if(!tgR25SoloAllowed(a))return false;
    if(a.sent===a.samples)return true;
    return await tgR25WaitSolo(tgR25SyncSolo(a,true))&&tgR25SoloAllowed(a)&&a.sent===a.samples;
  }
  function tgR25ClearSoloReport(){tgR25SoloReport=null;tgR25SoloRetry=null;}
  function tgR07SyncSoloDock(){
    const dock=$('tg192-solo-dock'),button=$('tg192-solo-off');if(!dock||!button)return;
    const active=Boolean(state.soloMic),solo=state.role==='host'&&state.room?.room_mode==='solo';
    dock.dataset.micActive=String(active);dock.hidden=!(state.role==='host'&&(active||solo));
    for(const id of ['tg192-solo-off','tg18-solo-button'])if($(id))$(id).disabled=Boolean(tgR19SoloRequest);
    const label=dock.querySelector('.tg192-solo-label');if(label)label.textContent=active?'MIC SOLO ATIVO':'MIC SOLO DESLIGADO';
    button.textContent=active?'Desligar':'Ativar';button.setAttribute('aria-label',active?'Desligar microfone solo':'Ativar microfone solo');button.title=button.getAttribute('aria-label');
    if(!active)for(const bar of $('tg192-solo-meter')?.children||[]){bar.classList.remove('lit');bar.style.height='12%';}
  }
  async function toggleSoloMic(){
    if(state.emergencyBlocked)return;
    if(state.role!=='host'||!state.room||state.emergencyClosing||state.finishing||tgR19SoloRequest||tgR25SoloRetry===state.currentSong?.id)return;
    if(state.soloMic){stopSoloMic();return;}
    window.TG74_DIVA_STUDIO?.stop();
    if(!navigator.mediaDevices?.getUserMedia){toast('Microfone solo exige HTTPS e navegador compatível.',true);return;}
    const scope=tg07Scope(),ticket={scope,song:state.currentSong?.id??null,preflight:state.preflight};let stream,ctx;
    tgR19SoloRequest=ticket;tgR07SyncSoloDock();
    const current=()=>tgR19SoloRequest===ticket&&tg07Current(scope)&&state.role==='host'&&!state.emergencyBlocked&&!state.emergencyClosing&&!state.finishing&&(state.currentSong?.id??null)===ticket.song&&state.preflight===ticket.preflight;
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,autoGainControl:false,noiseSuppression:true},video:false});
      if(!current()){stream.getTracks().forEach(t=>t.stop());return;}
      ctx=new (window.AudioContext||window.webkitAudioContext)();
      const analyser=ctx.createAnalyser();analyser.fftSize=2048;
      ctx.createMediaStreamSource(stream).connect(analyser);await ctx.resume();
      if(!current()||!stream.getAudioTracks().some(t=>t.readyState==='live')){stream.getTracks().forEach(t=>t.stop());await ctx.close().catch(()=>{});return;}
      state.soloMic={stream,ctx,analyser,samples:0,vocal:0,volume:0,last:0,songId:null};
      $('tg192-solo-dock').hidden=false;
      tgR07SyncSoloDock();
      const capture=state.soloMic;stream.getAudioTracks().forEach(t=>t.onended=()=>{if(state.soloMic===capture&&tg07Current(scope))stopSoloMic();});
      $('tg18-solo-button').textContent='🎙️ Desligar microfone solo';
      $('tg18-solo-status').textContent='🟢 Mic ativo no celular · áudio não sai pelos alto-falantes para evitar eco';
      if(state.preflight&&isSinger(state.preflight.song,state.user.id))renderPreflightHost();
    }catch(err){for(const t of stream?.getTracks()||[])t.stop();try{await ctx?.close();}catch{}if(current())toast('Não foi possível ativar o microfone: '+humanError(err),true);}
    finally{if(tgR19SoloRequest===ticket){tgR19SoloRequest=null;tgR07SyncSoloDock();}}
  }
  function tgR19CancelSoloRequest(){tgR19SoloRequest=null;tgR07SyncSoloDock();}
  function stopSoloMic(){
    tgR19CancelSoloRequest();
    const m=state.soloMic;state.soloMic=null;
    if(m){m.stream.getTracks().forEach(t=>{t.onended=null;t.stop();});m.ctx.close().catch(()=>{});}
    const pre=state.preflight;if(pre?.statuses.get(state.user?.id)?.localSolo)pre.statuses.delete(state.user.id);
    if(pre&&state.role==='host')renderPreflightHost();
    $('tg192-solo-dock').hidden=true;
    if(document.body.classList.contains('tg104-single-device')){$('tg192-solo-dock').hidden=false;document.querySelector('#tg192-solo-dock .tg192-solo-label')?.replaceChildren(document.createTextNode('MIC SOLO DESLIGADO'));}
    $('tg18-solo-button').textContent='🎙️ Ativar microfone solo';
    $('tg18-solo-status').textContent='Microfone solo desligado';
    tgR07SyncSoloDock();
  }
  function sampleSoloMic(){
    const m=state.soloMic;if(!m||state.role!=='host')return;
    const rms=calculateRMS(m.analyser);
    const bars=$('tg192-solo-meter').children;const count=Math.round(Math.min(1,rms/.13)*bars.length);Array.from(bars).forEach((bar,i)=>{bar.classList.toggle('lit',i<count);bar.style.height=(i<count?Math.min(95,25+rms*440+(i%3)*9):12)+'%';});
    const song=state.currentSong;
    if(!song||!state.isPlaying||state.finishing||state.emergencyBlocked||!isSinger(song,state.user.id))return;
    if(m.songId!==song.id){m.songId=song.id;m.samples=0;m.vocal=0;m.volume=0;m.last=0;m.tg30Shadow=tg30ShadowFor(song.id);}
    const a=tgR25SoloFor(song),now=performance.now();if(now-(a?a.last:m.last)<250)return;
    m.last=now;m.samples++;if(a){a.last=now;a.samples++;}
    tg30CollectShadow(m.tg30Shadow,m.analyser,m.ctx?.sampleRate,now);
    if(rms>.012){const intensity=Math.min(1,(rms-.012)/.085);m.vocal++;m.volume+=intensity;if(a){a.vocal++;a.intensity+=Math.round(intensity*1000);}}
    if(a&&now-a.lastAttempt>=2300&&a.samples>a.sent)void tgR25SyncSolo(a);
    const el=$('tg18-solo-status');if(el)el.textContent='🎙️ Captando atividade vocal • '+Math.round(Math.min(100,rms*750))+'%';
  }
  // Identidade anônima convertida pelo mesmo UID, para preservar as avaliações.
  function updateAccountCTA(){
    const anon=state.role==='guest'&&isAnonymous(state.user);
    if($('tg18-account-cta'))$('tg18-account-cta').hidden=!anon;
    if($('tg18-account-history'))$('tg18-account-history').hidden=state.role!=='guest';
    if($('tg18-push-cta'))$('tg18-push-cta').hidden=state.role!=='guest';
    const promo=document.querySelector('#guest .tg18-account-promo');
    if(promo&&state.role==='guest'){
      const headline=promo.querySelector(':scope > strong'),copy=promo.querySelector(':scope > p');
      if(headline)headline.textContent=anon?'🎖️ Suas notas merecem um histórico!':'🏆 Seu histórico está no camarim!';
      if(copy)copy.textContent=anon
        ?'Criar uma conta é opcional para guardar suas notas e voltar às suas festas.'
        :'Consulte suas notas recreativas, suas festas e as preferências da conta. Não é necessário cadastrar-se novamente.';
    }
  }
  async function saveGuestIdentity(event){
    event.preventDefault();if(!state.user||state.role!=='guest')return;
    const email=$('tg18-account-email').value.trim();
    if(!isAnonymous(state.user)){toast('Esta conta já está vinculada. Use Alterar senha no perfil.');return;}
    const btn=$('tg18-account-submit');setLoading(btn,true,'Enviando confirmação...');
    try{
      const {error}=await state.client.auth.updateUser({email});if(error)throw error;localStorage.setItem('tem-gogo-upgrading-account','1');
      $('tg18-account-feedback').textContent='Confira sua caixa de entrada e confirme o e-mail. Depois da confirmação, defina sua senha no menu de conta. Não saia da conta anônima antes de concluir!';
      $('tg18-account-email').value='';
      toast('E-mail de confirmação solicitado. Sua identidade atual foi preservada.');
    }catch(err){$('tg18-account-feedback').textContent=humanError(err);}
    finally{setLoading(btn,false);}
  }
  let tgR09HistorySerial=0;
  function tgR09ClearHistory(){
    ++tgR09HistorySerial;
    const dlg=$('tg18-history-dialog');if(dlg?.open)dlg.close();
    $('tg18-history-list')?.replaceChildren();
    const score=$('score-dialog');if(score?.open)score.close();$('score-list')?.replaceChildren();
  }
  async function showPersonalHistory(){
    if(!state.user)return;
    const historyUid=state.user.id,epoch=tg07SessionEpoch,serial=++tgR09HistorySerial;
    const dlg=$('tg18-history-dialog'),host=$('tg18-history-list');
    host.textContent='Buscando notas salvas…';if(!dlg.open)dlg.showModal();
    const current=()=>state.user?.id===historyUid&&epoch===tg07SessionEpoch&&serial===tgR09HistorySerial&&dlg.open;
    try{
      const {data,error}=await state.client.from('karaoke_scores').select('score,created_at,room_id,song_id').eq('user_id',historyUid).order('created_at',{ascending:false}).limit(100);
      if(!current())return;if(error)throw error;
      const list=(data||[]).filter(x=>x.score!=null&&x.score!==''&&Number.isFinite(Number(x.score)));
      host.replaceChildren();
      if(!list.length){host.textContent='Nenhuma nota encontrada. Suas apresentações serão registradas quando o microfone conseguir enviar as medições.';return;}
      for(const x of list){const item=document.createElement('div');item.className='tg18-history-item';const date=document.createElement('span'),score=document.createElement('strong');date.textContent=new Date(x.created_at).toLocaleDateString('pt-BR');score.textContent=Number(x.score)+'/100';item.append(date,score);host.appendChild(item);}
    }catch(err){if(current())host.textContent='Histórico indisponível. Confira a conexão e tente novamente.';}
  }
  async function enableTurnPush(){
    if(!state.user||!isPhoneSingerRole()){toast('Entre numa festa pelo celular para ligar os avisos.',true);return;}
    if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){
      toast('Este navegador não oferece Web Push. O aviso dentro do app continuará funcionando.',true);return;}
    if(!cfg.VAPID_PUBLIC_KEY){toast('Push externo ainda não foi configurado pelo administrador. O aviso dentro do app continua ativo.',true);return;}
    try{
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){toast('Notificações não autorizadas. Você continuará vendo o alerta dentro do app.',true);return;}
      const reg=await navigator.serviceWorker.ready;
      const existing=await reg.pushManager.getSubscription();
      const key=cfg.VAPID_PUBLIC_KEY.replace(/-/g,'+').replace(/_/g,'/');
      const raw=atob(key.padEnd(Math.ceil(key.length/4)*4,'='));
      const sub=existing||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});
      const json=sub.toJSON();
      const {error}=await state.client.from('karaoke_push_subscriptions').upsert({user_id:state.user.id,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth},{onConflict:'endpoint'});
      if(error)throw error;
      toast('✅ Avisos de chamada ativados neste aparelho!');$('tg18-push-cta').textContent='🔔 Avisos ativados';$('tg19-push-shortcut').textContent='🔔 Alertas de chamada ativados neste celular';if($('tg19-remote-push'))$('tg19-remote-push').textContent='🔔 Avisos ativados';
    }catch(err){toast('Não foi possível ativar Push: '+humanError(err),true);}
  }
  async function dispatchPushForSong(song){
    if(state.emergencyBlocked)return;
    if(state.role!=='host'||!song||!state.client||!cfg.VAPID_PUBLIC_KEY)return;
    try{const {error}=await state.client.functions.invoke('karaoke-push',{body:{song_id:song.id,room_id:state.room.id}});if(error)console.warn('Push não enviado:',error.message);}
    catch(err){console.warn('Push indisponível:',err);}
  }
  function openGuestCall(){
    if(!isPhoneSingerRole()||!state.guestPreflightSong)return;
    if(state.role==='remote'){if(state.remoteTab!=='singing'){state.remoteAutoSinger=true;switchRemoteTab('singing');}toast('🎤 Você é o próximo! Abra Participar para liberar seu microfone.');if(navigator.vibrate)navigator.vibrate([120,80,120]);return;}
    $('tg18-turn-track').textContent=state.guestPreflightSong.title||'Seu show';
    $('tg18-turn-overlay').hidden=false;
    $('tg18-turn-mic-state').textContent=availableMic()?'🟢 Microfone ligado • confirme quando estiver pronto(a)':'🔴 Microfone desligado • ative antes de confirmar';
    $('tg18-turn-ready').hidden=true;
    $('tg18-turn-mic').textContent=availableMic()?'✅ MICROFONE PRONTO':'🎙️ ATIVAR MIC E FICAR PRONTO(A)';
  }
  function closeGuestCall(){if($('tg18-turn-overlay'))$('tg18-turn-overlay').hidden=true;}

  function micStatusLabel(uid){
    if(state.peers.get(uid)?.connection==='connected')return '🟢 Captação em comunicação';
    const s=state.preflight?.statuses.get(uid);
    if(s?.mic) return '🟡 Mic liberado no celular';
    return '🔴 Mic ainda desligado';
  }
  // V17: Only TEXT signals reach the TV. No recording, no synthesized narration.
  // A local queue preserves guest recados until the interval; host reload clears this ephemeral buffer.
  const pendingGuestRecados=[];
  const tg04SeenMessages=new Set();
  let tg04MessageFetch=null,tg04HostSending=null,tg18GuestSending=null,tg18Recognition=null;
  async function syncPartyMessages(){
    if(state.emergencyBlocked)return;
    if(state.role!=='host'||!state.room||tg04MessageFetch)return;
    const roomId=state.room.id,scope=tg07Scope(),ticket={};tg04MessageFetch=ticket;
    try{
      const {data,error}=await state.client.from('tg_party_messages').select('id,author_id,body,created_at').eq('room_id',roomId).eq('status','sent').order('created_at',{ascending:true}).limit(12);
      if(error)throw error;
      if(!tg07Current(scope)||state.role!=='host')return;
      for(const row of data||[]){
        if(tg04SeenMessages.has(row.id)||pendingGuestRecados.length>=12)continue;
        const host=row.author_id===state.room.owner_id;
        const member=state.members.find(m=>m.user_id===row.author_id);
        if(!host&&!member)continue;
        const text=String(row.body||'').replace(/\s+/g,' ').trim();if(text.length<3||text.length>160)continue;
        tg04SeenMessages.add(row.id);pendingGuestRecados.push({name:host?'Anfitrião':member.display_name,uid:row.author_id,text,messageId:row.id,host});
      }
      if(!state.currentSong&&!state.preflight&&!state.finishing&&$('final-overlay')?.hidden&&!recadoShowing)showNextGuestRecado();
    }catch(e){if(tg07Current(scope))console.warn('Sincronia de recados:',e);}finally{if(tg04MessageFetch===ticket)tg04MessageFetch=null;}
  }
  async function sendHostRecado(inputId,buttonId){
    if(state.emergencyBlocked){toast('O palco está protegido por uma pausa de segurança. Reconecte antes de enviar recados.',true);return;}
    if(!canDirectDiva()){toast('Entre com a conta do anfitrião desta festa para enviar recados.',true);return;}
    if(callActive()&&state.role==='remote'){toast('Conclua sua vez de cantar antes de enviar recados.',true);return;}
    if(tg04HostSending){toast('Aguarde a confirmação do recado anterior.');return;}
    const text=$(inputId).value.replace(/\s+/g,' ').trim();
    if(text.length<3||text.length>160){toast('Escreva um recado de 3 a 160 caracteres.',true);return;}
    if(Date.now()<nextGuestRecadoAt){toast('Espere alguns segundos antes de outro recado.',true);return;}
    const scope=tg07Scope(),roomId=scope.room,uid=scope.uid,ticket={};tg04HostSending=ticket;setLoading($(buttonId),true,'Enviando…');
    try{
      const {data,error}=await state.client.from('tg_party_messages').insert({room_id:roomId,author_id:uid,nickname:'Anfitrião',body:text,status:'sent'}).select('id').single();
      if(error)throw error;if(!data?.id)throw Error('O servidor não confirmou o recado.');
      if(!tg07Current(scope))return;
      $(inputId).value='';nextGuestRecadoAt=Date.now()+25000;
      toast('Recado registrado. A TV o exibirá no intervalo.');if(state.role==='host')void syncPartyMessages();
    }catch(e){if(tg07Current(scope))toast('Recado não registrado: '+humanError(e),true);}finally{if(tg04HostSending===ticket){tg04HostSending=null;if(tg07Current(scope))setLoading($(buttonId),false);}}
  }
  const recadoFrequency=new Map();
  let nextGuestRecadoAt=0, recadoTimer=null, recadoShowing=false, recadoAfter=null, tgR15RecadoTicket=null;
  function hideGuestRecado(){
    clearTimeout(recadoTimer);recadoTimer=null;
    if(recadoShowing)window.TG74_DIVA_STUDIO?.stop();
    recadoShowing=false;tgR15RecadoTicket=null;recadoAfter=null;
    const el=$('tg17-message-screen');if(el)el.hidden=true;
  }
  function tgR15FinishRecado(ticket){
    if(!ticket||tgR15RecadoTicket!==ticket||!tg07Current(ticket.scope))return;
    const fn=recadoAfter;hideGuestRecado();
    if(state.emergencyBlocked||state.role!=='host'||state.currentSong||state.preflight||state.finishing)return;
    if(fn)void fn();
    else if(pendingGuestRecados.length)showNextGuestRecado();
  }
  function showNextGuestRecado(after=null){
    if(state.emergencyBlocked)return false;
    if(state.role!=='host'||state.currentSong||state.isPlaying||state.preflight||state.startingSong||state.finishing||!$('final-overlay')?.hidden||recadoShowing||!pendingGuestRecados.length)return false;
    const scope=tg07Scope(),el=$('tg17-message-screen');if(!tg07Current(scope)||!el)return false;
    const msg=pendingGuestRecados.shift(),ticket={scope};tgR15RecadoTicket=ticket;
    if(msg.messageId && state.client){const roomId=state.room.id;void state.client.from('tg_party_messages').update({status:'displayed',displayed_at:new Date().toISOString()}).eq('id',msg.messageId).eq('room_id',roomId).eq('status','sent').then(({error})=>{if(error&&tg07Current(scope)){tg04SeenMessages.delete(msg.messageId);console.warn('Auditoria de recados:',error.message);}});}
    if(!el)return false;
    const key=String(state.room?.id||'')+':'+String(msg.uid||msg.name);
    const repeat=(recadoFrequency.get(key)||0)+1;recadoFrequency.set(key,repeat);
    const lines=repeat===1?[`Atenção, temos recado de ${msg.name}!`,`Produção, abre o correio! ${msg.name} mandou um recado!`]:[`Olha quem voltou: ${msg.name} tem mais um recado!`,`E lá vem outro babado de ${msg.name}!`];
    const title=msg.host?'Recado do anfitrião':chooseDifferent(lines);
    $('tg17-message-from').textContent=title;
    if(state.role==='host')showDivaBubble(title,'💌');
    $('tg17-message-text').textContent=msg.text; // Never render user text as HTML.
    el.hidden=false;recadoShowing=true;recadoAfter=after;
    const studio=window.TG74_DIVA_STUDIO,roomId=state.room?.id,eventKey='recado:'+roomId+':'+(msg.messageId||key+':'+repeat);
    if(studio)void (async()=>{try{const spoken=await studio.announce('recado',eventKey);if(!spoken&&tgR15RecadoTicket===ticket&&tg07Current(scope)&&!state.emergencyBlocked&&recadoShowing)await studio.pop('recado',eventKey);}catch(err){if(tgR15RecadoTicket===ticket)console.warn('Áudio do recado:',err);}})();
    recadoTimer=setTimeout(()=>tgR15FinishRecado(ticket),10000);
    return true;
  }
  async function sendGuestRecado(){
    if(state.emergencyBlocked)return;
    if(state.role!=='guest'||!state.room||!state.user){toast('Entre numa festa para enviar recados.',true);return;}
    const text=($('tg17-message-input')?.value||'').replace(/\s+/g,' ').trim();
    if(text.length<3||text.length>160){toast('Escreva um recado de 3 a 160 caracteres.',true);return;}
    if(Date.now()<nextGuestRecadoAt){toast('Espere alguns segundos para mandar outro recado.',true);return;}
    if(tg18GuestSending)return;const scope=tg07Scope(),owner=state.room.owner_id,ticket={};tg18GuestSending=ticket;const btn=$('tg17-send-message');setLoading(btn,true,'Enviando…');
    try{
      const myName=memberName(state.user.id);
      const saved=await state.client.from('tg_party_messages').insert({room_id:state.room.id,author_id:state.user.id,nickname:myName,body:text,status:'sent'}).select('id').single();
      if(saved.error)throw saved.error;
      // A gravação é a fonte de verdade; o sinal é só uma notificação opcional.
      if(!tg07Current(scope))return;
      await sendSignal(owner,'stage-recado',{messageId:saved.data.id}).catch(console.warn);
      if(!tg07Current(scope))return;
      nextGuestRecadoAt=Date.now()+25000;
      $('tg17-message-input').value='';
      toast('💌 Recado registrado! A TV sincroniza os recados no intervalo.');
    }catch(err){if(tg07Current(scope))toast('Não foi possível enviar: '+humanError(err),true);}
    finally{if(tg18GuestSending===ticket){tg18GuestSending=null;if(tg07Current(scope))setLoading(btn,false);}}
  }
  function tg18AbortDictation(){const old=tg18Recognition;tg18Recognition=null;try{old?.abort();}catch{}const btn=$('tg17-dictate');if(btn){btn.disabled=false;btn.textContent='🎙️ Ditar recado';}}
  function dictateGuestRecado(){
    if(state.emergencyBlocked)return;
    if(state.role!=='guest'||!state.room||!state.user)return;
    if(isMyTurn()||state.localStream||callActive()){toast('Durante sua música ou preparação, prefira digitar o recado para não interferir no microfone.',true);return;}
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){toast('Este celular não oferece ditado no navegador. Escreva seu recado normalmente.',true);return;}
    if(tg18Recognition)return;const scope=tg07Scope(),btn=$('tg17-dictate');let recognition;
    try{
      recognition=new SpeechRecognition();tg18Recognition=recognition;recognition.lang='pt-BR';recognition.interimResults=false;recognition.maxAlternatives=1;
      btn.disabled=true;btn.textContent='🎙️ Ouvindo…';
      recognition.onresult=e=>{
        if(tg18Recognition!==recognition||!tg07Current(scope)||isMyTurn())return;
        const words=String(e.results?.[0]?.[0]?.transcript||'').trim();
        $('tg17-message-input').value=words.slice(0,160);
        toast('Texto transcrito. Confira antes de enviar!');
      };
      recognition.onerror=()=>{if(tg18Recognition===recognition&&tg07Current(scope))toast('Ditado indisponível. Digite seu recado.',true);};
      recognition.onend=()=>{if(tg18Recognition===recognition){tg18Recognition=null;if(tg07Current(scope)){btn.disabled=false;btn.textContent='🎙️ Ditar recado';}}};
      recognition.start();
    }catch(e){if(tg18Recognition===recognition)tg18Recognition=null;btn.disabled=false;btn.textContent='🎙️ Ditar recado';toast('Não foi possível iniciar o ditado.',true);}
  }
  function showHostCommand(){
    if(state.role!=='host'||!state.room)return;
    const queued=state.songs.filter(s=>s.status==='queued');
    const next=state.preflight?.song||queued[0];
    $('command-next').textContent='🎤 Próximo: '+(next?songSingerLabel(next):'sem músicas');
    $('command-queue').textContent='🎵 Fila: '+queued.length;
    $('command-mics').textContent='🎙️ Áudio na TV: '+[...state.peers.values()].filter(x=>x.connection==='connected').length;
    $('command-live-state').textContent=state.preflight?'🟡 Preparando cantores':state.currentSong?'🟢 Música no palco':'⚪ Em espera';
    const singing=state.currentSong||state.preflight?.song||next;
    $('stage-command-participants').innerHTML=singing?songSingers(singing).map(uid=>`<div class="command-singer"><img alt="" src="${avatarForMember(uid)}"><span><b>${escapeHTML(memberName(uid))}</b><small>${micStatusLabel(uid)}</small></span></div>`).join(''):'<span class="command-placeholder">Escaneie o QR para a plateia escolher músicas.</span>';
  }
  function renderPreflightHost(){
    if(state.preflight&&state.soloMic&&isSinger(state.preflight.song,state.user?.id)&&state.soloMic.stream.getAudioTracks().some(t=>t.readyState==='live'))state.preflight.statuses.set(state.user.id,{mic:true,ready:true,at:Date.now(),localSolo:true});
    else if(state.preflight?.statuses.get(state.user?.id)?.localSolo)state.preflight.statuses.delete(state.user.id);
    const pre=state.preflight,box=$('stage-preflight');
    box.hidden=!pre;showHostCommand();if(!pre)return;
    $('stage-preflight-track').textContent=pre.song.title;
    $('tg19-next-singer').textContent=state.room?.room_mode==='solo'?'PREPARE SEU MICROFONE':'VOCÊ É O PRÓXIMO: '+songSingerLabel(pre.song).toUpperCase();
    setDivaStageState('preflight');
    const singers=songSingers(pre.song);
    tgBetaStageAvatars(singers,'preflight');
    $('stage-preflight-singers').innerHTML=singers.map(uid=>{
      const raw=pre.statuses.get(uid);const s=raw&&Date.now()-raw.at<25000?raw:null;const online=s?.mic?'🎙️ MIC LIBERADO':'🔇 MIC DESLIGADO';
      const label=s?.ready&&s.mic?'✅ PRONTO(A)':s?.mic?'🟡 AGUARDANDO CONFIRMAÇÃO':'🔴 NÃO PREPARADO(A)';
      return `<div class="preflight-singer"><img alt="" src="${avatarForMember(uid)}"><div><strong>${escapeHTML(memberName(uid))}</strong><small>${online}</small><span>${label}</span></div></div>`;
    }).join('');
    const completed=singers.filter(uid=>{const s=pre.statuses.get(uid);return s?.ready&&s?.mic&&Date.now()-s.at<25000;}).length;
    $('stage-preflight-feedback').textContent=state.room?.room_mode==='solo'?(completed===singers.length?'Microfone pronto. Comece quando quiser.':'Ative o microfone deste aparelho.'):`${completed} de ${singers.length} confirmado(s) • o vídeo só começa depois do seu comando`;
    $('stage-preflight-start').disabled=completed!==singers.length||pre.starting;
    if(completed===singers.length&&!pre.notifiedReady){pre.notifiedReady=true;updateVoxLine('ready');}
  }
  async function notifyPreflightGuest(){
    if(!isPhoneSingerRole()||!state.guestPreflightSong||!state.room||!state.user)return;
    try{await sendSignal(state.room.owner_id,'stage-ready-status',{
      songId:state.guestPreflightSong.id,token:state.guestPreflightSong.token,ready:Boolean(state.guestReady&&availableMic()),
      mic:availableMic(),avatar:state.avatar,sentAt:Date.now()
    });}catch(err){console.warn('Aviso de preparação:',err);}
  }
  function renderGuestCallVisibility(){
    if(state.role!=='guest')return;
    const called=callActive();
    $('mobile-tab-mic').hidden=!called;
    $('tg16-mic-shortcut').hidden=!called;
    document.querySelector('#guest .guest-show-mic').hidden=!called;
    $('guest-preflight').hidden=!state.guestPreflightSong;
    state.guestMicLock=called;
    document.body.classList.toggle('tg103-mic-focus',called);
    if(called && state.mobileTab!=='mic')switchMobileTab('mic',false);
    $('guest-mic-panel').hidden=!called||state.mobileTab!=='mic';
    if(!called&&state.mobileTab==='mic')switchMobileTab('queue',false);
  }
  function renderGuestPreflight(){
    updateMicPersona();
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
  async function sendProfileToHost(){
    if(!isPhoneSingerRole()||!state.room||!state.user)return;
    try{await sendSignal(state.room.owner_id,'stage-profile',{avatar:state.avatar,sentAt:Date.now()});}catch(err){console.warn('Avatar ainda não foi sincronizado:',err);}
  }
  function clearHostPreflight(notify=true){
    const pre=state.preflight;state.preflight=null;clearInterval(state.preflightTimer);state.preflightTimer=null;
    if(pre&&notify){for(const uid of songSingers(pre.song))void sendSignal(uid,'stage-prepare-cancel',{songId:pre.song.id,token:pre.token}).catch(console.warn);}
    if(state.role==='host'&&!state.currentSong)setNowPlaying(null);
    renderPreflightHost();
  }
  async function sendPreflightInvites(force=false){
    const pre=state.preflight,scope=tg07Scope();if(!pre||!state.room)return;
    for(const uid of songSingers(pre.song)){
      if(state.emergencyBlocked||!tg07Current(scope)||state.preflight!==pre)return;
      const status=pre.statuses.get(uid);
      if(!force&&status?.ready&&status.mic)continue;
      try{await sendSignal(uid,'stage-prepare',{songId:pre.song.id,token:pre.token,title:pre.song.title,sentAt:Date.now()});}
      catch(err){console.warn('Convite de prontidão:',err);}
    }
  }
  async function prepareSong(song){
    if(state.emergencyBlocked)return;
    if(state.role!=='host'||!song||state.finishing)return;
    if(recadoShowing){toast('Aguarde o recado do intervalo terminar.',true);return;}
    if(state.currentSong){toast('Finalize ou pule a música atual antes de preparar a próxima.',true);return;}
    if(state.preflight?.song.id===song.id){renderPreflightHost();return;}
    window.TG74_DIVA_STUDIO?.stop(); // não sobrepor convocação da Diva ou microfones
    clearHostPreflight();
    state.preflight={song,token:typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join(''),statuses:new Map(),starting:false};
    $('now-title').textContent='A seguir: '+song.title;
    $('now-by').textContent='Preparem-se: '+songSingerLabel(song);
    $('song-pill').textContent='⏳ Aguardando confirmação';
    $('video-placeholder').hidden=false;setDivaStageState('preflight');
    renderPreflightHost();updateVoxLine('preflight');void window.TG74_DIVA_STUDIO?.announce('chamada','chamada:'+state.room.id+':'+state.preflight.token,song.id);void dispatchPushForSong(song);
    const prepared=state.preflight,scope=tg07Scope();
    await sendPreflightInvites(true);
    if(state.emergencyBlocked||!tg07Current(scope)||state.preflight!==prepared)return;
    clearInterval(state.preflightTimer);
    state.preflightTimer=setInterval(()=>{if(state.preflight)void sendPreflightInvites(false);},12000);
  }
  async function startPreparedSong(override=false){
    if(state.emergencyBlocked)return;
    const pre=state.preflight,scope=tg07Scope();if(!pre||pre.starting)return;
    const singers=songSingers(pre.song);
    const ready=singers.every(uid=>{const s=pre.statuses.get(uid);return s?.ready&&s?.mic&&Date.now()-s.at<25000;});
    if(!ready&&!override){toast('Aguarde o microfone e a confirmação de todas as pessoas.',true);return;}
    if(!ready&&override&&!await window.TG_UI.confirm('Iniciar sem todos prontos? As pessoas sem microfone podem ficar sem voz ou nota.',{title:'Liberar apresentação',confirmText:'Iniciar mesmo assim'}))return;
    if(state.emergencyBlocked||!tg07Current(scope)||state.preflight!==pre)return;
    pre.starting=true;renderPreflightHost();
    const song=pre.song;
    // startSong retorna erro tratado internamente; confira no estado antes de encerrar o preparo.
    await startSong(song);
    if(state.emergencyBlocked||!tg07Current(scope)||state.preflight!==pre)return;
    if(state.currentSong?.id===song.id){
      for(const uid of singers)void sendSignal(uid,'stage-prepare-cancel',{songId:song.id,token:pre.token,started:true}).catch(console.warn);
      clearHostPreflight(false);
    } else {pre.starting=false;renderPreflightHost();}
  }
  async function editGuestProfile(event){
    event.preventDefault();if(state.role!=='guest'||!state.room||!state.user||!isAnonymous(state.user)||state.emergencyBlocked)return;
    const scope=tg07Scope(),name=$('guest-profile-name').value.trim(),btn=event.target.querySelector('button[type=submit]'),avatar=event.target.querySelector('input[name="profile-avatar-options"]:checked')?.value||state.avatar;
    if(!btn||btn.disabled)return;if(name.length<2||name.length>24){toast('Use um apelido de 2 a 24 caracteres.',true);return;}
    btn.disabled=true;try{
      const {data,error}=await state.client.from('karaoke_members').update({display_name:name}).eq('room_id',scope.room).eq('user_id',scope.uid).select('display_name');
      if(!tg07Current(scope)||state.emergencyBlocked)return;
      if(error||data?.length!==1||data[0].display_name!==name)throw error||Error('Apelido não confirmado.');
      try{localStorage.setItem('tem-gogo-display-name',name);}catch{}$('guest-display-name').textContent=name;
      state.members=state.members.map(m=>m.user_id===scope.uid?{...m,display_name:name}:m);
      if(Object.hasOwn(AVATARS,avatar))tg83SetAvatar(avatar);
      renderAll();await sendProfileToHost();if(!tg07Current(scope))return;
      $('guest-profile-dialog').close();queueChanged();toast('Perfil atualizado.');
    }catch(e){if(tg07Current(scope))toast('Não foi possível salvar: '+humanError(e),true);}finally{btn.disabled=false;}
  }
  // R60: canonical registered identity is tg_profiles. Copies are synchronized only after verified profile save.
  let tg60IdentityPending=null;
  async function tg60SyncIdentity(name,key,expected){
    const uid=state.user?.id,epoch=tg07SessionEpoch,room=state.room?.id||null,client=state.client;
    const current=()=>uid===state.user?.id&&epoch===tg07SessionEpoch&&room===(state.room?.id||null)&&!state.emergencyBlocked&&client===state.client;
    if(!uid||!client||isAnonymous(state.user)||uid!==expected?.uid||epoch!==expected?.epoch||!current()||typeof name!=='string'||name.length<2||name.length>24||!AVATARS[key]||tg60IdentityPending)throw Error('Identidade ou sessão inválida.');
    const token={};tg60IdentityPending=token;const failures=[];
    try{
      if(state.user.user_metadata?.display_name!==name){try{const {data,error}=await client.auth.updateUser({data:{display_name:name}});if(error||data?.user?.id!==uid||data.user.user_metadata?.display_name!==name)throw error||Error('Conta não confirmada.');}catch(e){failures.push('conta');}}
      if(!current())throw Error('Sessão alterada; reabra o perfil.');
      if(room&&state.room?.status==='open'&&tg13Recreational()){
        if(state.room.owner_id!==uid||state.members.some(m=>m.user_id===uid))try{const {data,error}=await client.from('karaoke_members').update({display_name:name}).eq('room_id',room).eq('user_id',uid).select('display_name');if(error||data?.length!==1||data[0].display_name!==name)throw error||Error('Participação não confirmada.');}catch(e){failures.push('sala');}
        if(!current())throw Error('Sessão alterada; reabra o perfil.');
        if(!failures.includes('sala'))state.members=state.members.map(m=>m.user_id===uid?{...m,display_name:name}:m);
      }else if(room)failures.push('sala não recreativa ou encerrada');
      if(!current())throw Error('Sessão alterada; reabra o perfil.');
      localStorage.setItem('tem-gogo-display-name',name);$('guest-name').value=name;
      if(state.role==='guest'&&!failures.includes('sala'))$('guest-display-name').textContent=name;
      tg83SetAvatar(key);
      if(room){renderAll();if(state.role==='remote')renderRemote();await sendProfileToHost();}
      return {ok:failures.length===0,failures};
    }finally{if(tg60IdentityPending===token)tg60IdentityPending=null;}
  }

  function toast(message, error = false) {
    const node = $('toast'); node.textContent = message;
    node.classList.toggle('error', error); node.classList.add('visible');
    // Erros de encerramento e mensagens longas precisam de tempo para leitura no celular.
    const visibleMs = error && String(message).length > 110 ? 11000 : 4200;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('visible'), visibleMs);
  }
  function humanError(err) {
    const msg = String(err?.message || err || 'Ocorreu um erro inesperado.');
    if (/TG30_MODE_PROGRAMMED_(classic|solo|battle)/.test(msg)) return 'Este modo está em manutenção programada. Novas festas estão pausadas; consulte seu histórico para continuar uma festa aberta.';
    if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
    if (err?.code==='email_not_confirmed'||/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar. Use Reenviar e-mail de confirmação se necessário.';
    if (err?.code==='email_address_not_authorized'||/email address not authorized/i.test(msg)) return 'O serviço de e-mail ainda não permite este endereço. Fale com o suporte.';
    if (err?.code==='over_email_send_rate_limit'||/email rate limit/i.test(msg)) return 'Limite de envio de e-mails atingido. Aguarde e tente mais tarde.';
    if (/user already registered/i.test(msg)) return 'Esse e-mail já está cadastrado. Tente entrar.';
    if (/password should be at least/i.test(msg)) return 'Escolha uma senha com pelo menos 6 caracteres.';
    if (/rate limit|too many requests/i.test(msg)) return 'Muitas tentativas. Aguarde e tente novamente.';
    // Mensagens do PostgreSQL/PostgREST não são falhas de permissão do microfone.
    // NotAllowedError é produzido pela API de mídia do navegador.
    if (['NotAllowedError','PermissionDeniedError','SecurityError'].includes(String(err?.name||'')) || /notallowederror|permission denied by user|permission dismissed|microphone permission/i.test(msg))
      return 'Microfone bloqueado. Libere a permissão nas configurações do navegador.';
    if (String(err?.code||'')==='42501' || /permission denied|row.level security|insufficient.privilege|not authorized|unauthorized/i.test(msg))
      return 'Você não tem autorização para esta ação. Confira sua conta e tente novamente.';
    if (/notfounderror/i.test(msg)) return 'Nenhum microfone foi encontrado no celular.';
    if (/network|failed to fetch/i.test(msg)) return 'Falha de conexão. Confira sua internet e tente novamente.';
    if (/PGRST|postgres|schema cache|relation .*does not exist|column .* does not exist|SQLSTATE|\b42P01\b|\b42703\b|\b23505\b|syntax error|https?:\/\/|supabase\.co|github\.com|service_role|\bSQL\b/i.test(msg))
      return 'Não conseguimos concluir esta ação agora. Tente novamente ou abra o Suporte Tem Gogó.';
    // Nao exibir respostas inesperadas do backend como stack trace ou caminho interno.
    if (msg.length>175 || /\n|\r|(?:\/[A-Za-z0-9_.-]+){2,}|\bSELECT\b|\bINSERT\b|\bUPDATE\b/i.test(msg))
      return 'Algo saiu do roteiro. Tente novamente ou peça ajuda pelo Suporte Tem Gogó.';
    return msg;
  }
  function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function show(id) { const isStage=id==='stage'&&state.role==='host'&&state.room&&state.room.owner_id===state.user?.id;
    let chosen='glam';try{chosen=(isStage?localStorage.getItem('tg30-stage-theme:'+state.room.id):null)||localStorage.getItem('tem-gogo-theme')||'glam';}catch{}
    applyTheme(chosen,false,isStage?'stage':'render');
    document.body.dataset.currentView=id; document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== id); window.scrollTo({top:0}); tg193ScheduleTour(id); window.dispatchEvent(new CustomEvent('temgogo:view',{detail:{view:id}})); }
  function configured() { return !!(cfg.SUPABASE_URL?.startsWith('https://') && cfg.SUPABASE_ANON_KEY?.length > 25); }
  function formatTime(sec) { sec = Math.max(0, Math.floor(Number(sec) || 0)); return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`; }
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function setLoading(button, active, label) { button.disabled = active; if(active) {button.dataset.previous = button.innerHTML; button.textContent = label || 'Carregando...';} else if(button.dataset.previous) {button.innerHTML = button.dataset.previous;delete button.dataset.previous;} }
  function youtubeId(input) {
    const value = String(input || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'youtu.be') return /^[A-Za-z0-9_-]{11}$/.test(url.pathname.slice(1).split('/')[0]) ? url.pathname.slice(1).split('/')[0] : null;
      if (['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com'].includes(host)) {
        let id = url.searchParams.get('v');
        if (!id) {const pieces = url.pathname.split('/').filter(Boolean); if(['shorts','embed','live'].includes(pieces[0])) id=pieces[1];}
        return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
      }
    } catch { /* não é URL */ }
    return null;
  }
  function currentURL(code) { const url = new URL('./',location.href); url.searchParams.set('room', code); return url.href; }
  const THEMES = ['glam','crystal','midnight','brasil'];
  const THEME_LABELS = {glam:'Glam Pop Futurista',crystal:'Crystal Pop',midnight:'Midnight Club',brasil:'Brasil em Canto'};
  const voxMoments = {
    opening: [
      'Eu sou a Diva Gogó, meu amor! Trago brilho, microfone e um leve histórico de escândalos musicais!',
      'Cadê o primeiro hino? A minha peruca tá pronta pra bater palma!',
      'O palco é livre, o carão é obrigatório e o playback é por conta da casa!'
    ],
    preflight: [
      "Checando microfones! Só solto o playback quando a galera der o sinal!",
      "A Diva Gogó não começa um show sem conferir o camarim, meu amor!",
      "Microfone ligado, carão montado? Aguardo o ESTOU PRONTO!"
    ],
    singing: [
      'É pra cantar, não é pra pedir desculpa! Solta esse gogó, estrela!',
      'Um momento de respeito: a turnê da sala de estar começou!',
      'A Diva Gogó está de olho! O microfone não mente, mas sabe fazer drama!'
    ],
    queue: [
      'Próxima estrela chegando! Equipe, passa o brilho que o show não pode parar!',
      'Se ajeita no camarim, mona! A sua vez tá chegando!',
      'Tem hit na fila e uma drag ansiosa no comando!'
    ],
    ending: [
      'Segura esse close! Agora eu quero ver a nota desse babado!',
      'A luz apagou, mas meu julgamento carinhoso continua aceso!',
      'Momento de tensão, Brasil: é hora do placar!'
    ],
    ready: [
      'ELENCO COMPLETO! Todo mundo com o microfone liberado? Host, agora é contigo: pode soltar o vídeo!',
      'Todo mundo confirmou! Produção, vai buscar o confete que o palco tá pronto!',
      'Preparados e maravilhosos! Anfitrião, aperta COMEÇAR que eu já fiz a chamada!'
    ],
    reminder: [
      'Ô, estrela! Abre o microfone no celular e toca em ESTOU PRONTO. A diva não é vidente!',
      'Gente, falta a autorização do mic. Sem isso, o playback vai cantar sozinho!',
      'Quem tá no dueto, por favor: cada celular precisa ativar o seu microfone. Eu tenho uma festa pra apresentar!'
    ]
  };
  function chooseDifferent(items){
    const pool = items.filter(Boolean);
    if(!pool.length)return '';
    // Rodízio com início variável, sem exigir IA nem criar custos de API para textos.
    chooseDifferent.last = (chooseDifferent.last + 1 + Math.floor(Math.random()*Math.max(1,pool.length-1)))%pool.length;
    return pool[chooseDifferent.last];
  }
  chooseDifferent.last = 0;
  function setDivaStageState(mode){
    const stage=$('stage');if(stage)stage.dataset.showState=mode;
    for(const id of ['diva-stage-banner','diva-idle-hero'])if($(id))$(id).dataset.mood=mode;
  }
  // V17: Browser TTS was removed because timbre and quality are unpredictable.
  // The presenter speaks through animated on-screen text, never through robotic audio.
  function speakDiva(){ /* intentionally silent */ }
  const tg124HumorLines={
    familia:{opening:['Chegou a hora de cantar, minha gente! Todo mundo é estrela aqui!'],preflight:['Vamos preparar o microfone com calma. O palco espera por vocês!'],reminder:['Consegue conferir o microfone, estrela? Estamos esperando você!'],ready:['Todo mundo pronto! Anfitrião, pode começar o show!'],ending:['Muito bem, estrelas! Hora de conferir nosso placar divertido!'],queue:['Tem mais um hit na fila!'],singing:['Aproveite o show!']},
    debochado:{opening:['A produção já chegou com a peruca e o julgamento recreativo, Brasil!'],preflight:['Alô, camarim! O close não espera, liga esse microfone!'],reminder:['Segunda chamada, minha filha! Esse camarim tá cobrando aluguel!'],ready:['Prontíssimos! A produção liberou o close — começa esse hino!'],ending:['Segura esse glitter, vou conferir esse babado de nota!'],queue:['Outra música! O palco já pediu aposentadoria e nem começou!'],singing:['Solta a voz, que o refrão é seu!']},
    caos:{opening:['PAREM TUDO! O MAIOR ACONTECIMENTO MUSICAL DA SALA COMEÇOU!'],preflight:['PRODUÇÃO! O ELENCO PRECISA ESTAR PRONTO AGORA!'],reminder:['ALERTA DE CAMARIM! SEGUNDA CHAMADA! CADÊ O MICROFONE?'],ready:['ELENCO CONFIRMADO! ABRAM AS CORTINAS!'],ending:['O SHOW ACABOU! O VEREDITO VEM AÍ!'],queue:['MAIS UM HIT! SEGUREM ESSAS LUZES!'],singing:['É A SUA ERA MUSICAL!']},
    lgbt:{opening:['O palco tá liberado, o carão tá pronto e o babado vai acontecer!'],preflight:['Arruma a peruca imaginária e confirma o microfone, mona!'],reminder:['O close tá atrasando, estrela! Confere o microfone!'],ready:['Tudo pronto, meu cristal! Agora entrega esse hino!'],ending:['Foi close atrás de close! Agora vem o placar, meu bem!'],queue:['Tem outro hit na fila, e a playlist não aceita flop!'],singing:['Entrega seu refrão com orgulho!']},
    reality:{opening:['A produção anuncia: está aberta a temporada do Gogó!'],preflight:['Participantes, dirijam-se ao palco. O programa vai começar!'],reminder:['A produção convoca novamente o participante para confirmar prontidão!'],ready:['Participantes confirmados! Anfitrião, a decisão é sua: libere a apresentação!'],ending:['A votação recreativa terminou. O placar será revelado!'],queue:['Nova prova musical no palco. Participantes, preparem-se!'],singing:['Valendo a apresentação!']},
    bafao:{opening:['Cheguei no camarim e já fiquei sabendo que hoje vai ter babado!'],preflight:['Ajeita esse carão, estrela: o camarim inteiro tá de olho!'],reminder:['Ih, lá vem nova chamada! Será que essa estrela tá passando gloss?'],ready:['Todo mundo prontinho! Vamos dar esse close na plateia!'],ending:['Acho que a produção precisa me contar uma coisa... vamos ver a nota!'],queue:['Novo babado musical na fila, minha gente!'],singing:['Faz esse palco virar notícia boa!']}
  };
  // R87 — one visible Diva speech surface per stage scene; audio takes priority.
  let tg87DivaFallback='O palco é seu! Escolha um hit para começar.',tg87DivaAudio='';
  function tg87RenderDiva(){
    if(state.role!=='host')return;
    const words=tg87DivaAudio||tg87DivaFallback;
    const idle=$('vox-idle-line');if(idle)idle.textContent='“'+words+'”';
    const pre=$('diva-preflight-speech');if(pre)pre.textContent='“'+words+'”';
    const recap=$('tg87-recado-caption');if(recap){recap.textContent=tg87DivaAudio;recap.hidden=!tg87DivaAudio;}
    const result=$('tg05-result-narration');
    if(result&&$('final-overlay')?.dataset.phase==='announcing')result.textContent=tg87DivaAudio||'Segura o glitter! A nota já vem.';
  }
  function tg87SetDivaCaption(words){tg87DivaAudio=typeof words==='string'?words.trim():'';tg87RenderDiva();}
  function showDivaBubble(line,emoji='🎤'){
    if(state.role!=='host'||!line)return;
    tg87DivaFallback=String(line);tg87RenderDiva();
  }
  function updateVoxLine(moment='opening'){
    const pool=tg124HumorLines[state.humorMode]?.[moment]||voxMoments[moment]||voxMoments.opening;
    const text=chooseDifferent(pool);
    if($('vox-line'))$('vox-line').textContent=`“${text}”`;
    if(state.role==='host')showDivaBubble(text);
    if($('vox-guest-line'))$('vox-guest-line').textContent=`“${text}” — Diva Gogó`;
    // Preflight and idle share the same audio-priority renderer.
    if(state.role==='host'){
      document.body.classList.remove('diva-talking');void document.body.offsetWidth;
      document.body.classList.add('diva-talking');clearTimeout(state.divaSpeakingTimer);
      state.divaSpeakingTimer=setTimeout(()=>document.body.classList.remove('diva-talking'),4500);
      const emojis={opening:'👑',preflight:'⏳',ready:'🎉',reminder:'👀',singing:'🎤',queue:'✨',ending:'🏆'};
      for(const id of ['diva-idle-expression','diva-preflight-expression','diva-result-expression'])if($(id))$(id).textContent=emojis[moment]||'💅';
      tg87RenderDiva();
    }
  }
  function applyTheme(theme,announce=false,scope=null){
    state.currentTheme=THEMES.includes(theme)?theme:'glam';
    document.body.dataset.theme=state.currentTheme;
    document.documentElement.dataset.tgTheme=state.currentTheme;
    const isStage=scope==='stage'||(scope===null&&state.role==='host'&&state.room);
    if(isStage&&state.room&&state.room.owner_id===state.user?.id){try{localStorage.setItem('tg30-stage-theme:'+state.room.id,state.currentTheme);}catch{}}
    else if(scope!=='render'){try{localStorage.setItem('tem-gogo-theme',state.currentTheme);}catch{}}
    const hint=$('tg30-theme-scope');if(hint)hint.textContent=isStage?'Tema compartilhado do palco. Os celulares dos convidados não mudam.':'Tema pessoal deste aparelho.';
    document.querySelectorAll('[data-theme-choice]').forEach(btn=>{const selected=btn.dataset.themeChoice===state.currentTheme;btn.classList.toggle('chosen',selected);btn.setAttribute('aria-pressed',String(selected));});
    if(announce)toast(THEME_LABELS[state.currentTheme]+' ativado!');
  }
  async function setStageTheme(theme){
    if(!canDirectDiva()||state.role!=='host'||!THEMES.includes(theme))throw new Error('Tema de palco inválido ou não autorizado.');
    const roomId=state.room.id,scope=tg07Scope();
    await callRPC('tg30_set_stage_theme',{p_room:roomId,p_theme:theme});
    if(!tg07Current(scope)||state.emergencyBlocked||state.room?.id!==roomId||state.role!=='host')throw new Error('A sala mudou. Confira o tema ao retornar.');
    applyTheme(theme,false,'stage');
  }
  async function chooseTheme(theme){
    if(state.role==='host'&&state.room){try{await setStageTheme(theme);toast(THEME_LABELS[theme]+' salvo no palco!');}catch(e){toast('Tema não salvo: '+humanError(e),true);}}
    else applyTheme(theme,true,'personal');
  }
  function themeCycle() {void chooseTheme(THEMES[(THEMES.indexOf(state.currentTheme)+1)%THEMES.length]);}
  function loadPreferences(){
    applyTheme(localStorage.getItem('tem-gogo-theme')||'glam',false,'personal');
    state.playbackVolume=Math.min(100,Math.max(0,Number(localStorage.getItem('tem-gogo-playback-volume')??80)));
    state.guestMicGain=Math.min(1.5,Math.max(0,Number(localStorage.getItem('tem-gogo-mic-send-volume')??100)/100));
    $('playback-volume-range').value=String(state.playbackVolume);$('playback-volume-label').textContent=state.playbackVolume+'%';
    $('guest-mic-gain').value=String(Math.round(state.guestMicGain*100));$('guest-mic-gain-value').textContent=Math.round(state.guestMicGain*100)+'%';
    state.humorMode=['familia','debochado','caos','lgbt','reality','bafao'].includes(localStorage.getItem('tem-gogo-humor'))?localStorage.getItem('tem-gogo-humor'):'debochado';
    state.gifsEnabled=localStorage.getItem('tem-gogo-gifs')!=='false';
    state.effectsEnabled=localStorage.getItem('tem-gogo-effects')!=='false';
    document.body.classList.toggle('high-contrast',localStorage.getItem('tem-gogo-contrast')==='true');
    document.body.classList.toggle('effects-off',!state.effectsEnabled);
    $('humor-mode').value=state.humorMode;
    $('gifs-enabled').checked=state.gifsEnabled;
    $('effects-enabled').checked=state.effectsEnabled;
    $('settings-contrast').checked=document.body.classList.contains('high-contrast');
    document.querySelectorAll('[data-theme-choice]').forEach(btn=>btn.classList.toggle('chosen',btn.dataset.themeChoice===state.currentTheme));
  }
  function toggleContrast(value){
    document.body.classList.toggle('high-contrast',value);
    $('settings-contrast').checked=value;
    localStorage.setItem('tem-gogo-contrast',String(value));
  }
  function confetti() {
    const box = $('confetti'); box.replaceChildren();
    if (!state.effectsEnabled || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for(let i=0;i<62;i++) {const el=document.createElement('i'); el.style.left=Math.random()*100+'%'; el.style.animationDelay=Math.random()*1.2+'s'; el.style.animationDuration=(2.2+Math.random()*1.5)+'s'; box.append(el);}
    setTimeout(() => box.replaceChildren(),4800);
  }
  function isStandalone(){return matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;}
  function normalizeRoom(value){return String(value||'').trim().toUpperCase().replace(/[^A-F0-9]/g,'').slice(0,12);}
  function validRoom(code){return /^(?:[A-F0-9]{8}|[A-F0-9]{12})$/.test(String(code||''));}
  function holdInvitation(code){
    return window.TG73_INVITES.remember(localStorage,code);
  }
  // Apaga SOMENTE o convite transitório. Identidade, preferências, notas e histórico permanecem.
  function forgetInvitation(code){
    window.TG73_INVITES.forget(localStorage,code);
    if(!code || state.inviteRoom===normalizeRoom(code))state.inviteRoom=null;
  }
  function cleanInvitationURL(){
    const u=new URL(location.href);
    if(u.searchParams.has('room') && u.searchParams.get('remote')!=='1'){
      u.searchParams.delete('room');history.replaceState(history.state,'',u.href);
    }
  }
  function showInvite(code){
    const clean=holdInvitation(code);
    if(!clean)return;
    state.inviteRoom=clean;
    document.body.classList.add('invite-active');
    document.body.classList.remove('entry-active');
    openGuestEntry(clean);
    $('invite-room-code').textContent=clean;
    $('invite-welcome').hidden=false;
    $('access-tabs').hidden=true;
    $('host-access').hidden=true;
    $('guest-access').hidden=true;
    $('invite-install-help').hidden=false;
    show('landing');
  }
  function showGuestEntry(code){
    const clean=normalizeRoom(code);
    // Todo convite novo substitui o antigo; ao entrar sem codigo, nao ressuscitar QR anterior.
    if(validRoom(clean))holdInvitation(clean);
    else {forgetInvitation();cleanInvitationURL();}
    state.inviteRoom=validRoom(clean)?clean:null;
    document.body.classList.remove('invite-active');
    document.body.classList.toggle('entry-active',!!clean || isStandalone());
    $('invite-welcome').hidden=true;
    // Sessão autenticada já existente: entrar por convite sem outra tela de login.
    const signedIn=!!(state.user&&!isAnonymous(state.user));
    $('access-tabs').hidden=signedIn;
    document.body.classList.toggle('tg95-join-signed-in',signedIn);
    openGuestEntry(clean);
    if(signedIn&&!$('guest-name').value.trim()){
      $('guest-name').value=String(state.user.user_metadata?.display_name||'');
    }
    show('landing');
    window.dispatchEvent(new CustomEvent('temgogo:guest-entry',{detail:{room:clean}}));
    $(clean?'guest-name':'guest-code').focus({preventScroll:true});
  }
  async function switchToInvitation(rawCode){
    if(state.emergencyClosing||state.finishing||state.startingSong){toast('Aguarde a operação atual antes de trocar de festa.',true);return false;}
    const code=normalizeRoom(rawCode);
    if(state.room && state.role){
      const same=state.room.code===code;
      if(same){toast('Você já está nesta festa! 🎤');return false;}
      const message=state.role==='host'
        ? 'Sair do palco neste aparelho? A festa continua aberta, mas o vídeo e o áudio deste dispositivo serão interrompidos.'
        : 'Trocar de festa neste aparelho? Seu microfone será desligado e a festa anterior não será encerrada.';
      const scope=tg07Scope();
      const confirmed=await window.TG_UI.confirm(message,{title:'Entrar em outra festa',confirmText:'Trocar de festa'});
      if(!confirmed||!tg07Current(scope)||state.emergencyClosing||state.finishing||state.startingSong)return false;
      const nextEpoch=tg07SessionEpoch+1;await stopSession();
      if(state.user?.id!==scope.uid||tg07SessionEpoch!==nextEpoch||state.room)return false;
    }else if(tgR18RoomRequest)return false;
    if(code && validRoom(code)){
      const u=new URL('./',location.href);u.searchParams.set('room',code);
      history.replaceState(null,'',u.href);
      showGuestEntry(code);
    }else{
      forgetInvitation();cleanInvitationURL();showGuestEntry('');
    }
    return true;
  }
  async function installFromInvite(){
    holdInvitation(state.inviteRoom);
    if(state.pendingInstall){
      state.pendingInstall.prompt();
      const outcome=await state.pendingInstall.userChoice;
      if(outcome?.outcome==='accepted')toast('Instalação solicitada! O convite continua disponível no Tem Gogó.');
      state.pendingInstall=null;
      return;
    }
    $('invite-install-help').textContent=/iPad|iPhone|iPod/.test(navigator.userAgent)
      ? 'No Safari: Compartilhar → Adicionar à Tela de Início. Depois abra o Tem Gogó e digite o código da festa, caso ele não apareça.'
      : 'No Chrome/Edge: abra o menu ⋮ → Instalar app ou Adicionar à tela inicial. Você também pode entrar pelo navegador.';
    toast('Abra o menu do navegador e escolha Instalar aplicativo.');
  }
  async function tryResumeMembership(code){
    if(!state.client||!state.user||!validRoom(code)||state.room)return false;
    const ticket=tgR18BeginRoomRequest();if(!ticket)return false;
    try{
      const own=await state.client.from('karaoke_rooms').select('id,code,title,owner_id,room_mode')
        .eq('code',code).eq('owner_id',state.user.id).eq('status','open').gt('expires_at',new Date().toISOString()).maybeSingle();
      if(!tgR18RoomRequestCurrent(ticket))return false;
      if(own.error)throw own.error;
      if(own.data){if(new URLSearchParams(location.search).get('remote')==='1')await enterRoomAsRemote(own.data);else await enterRoomAsHost(own.data);return true;}
      const rows=await callRPC('karaoke_resume_room',{p_code:code});
      if(!tgR18RoomRequestCurrent(ticket)||!rows?.length)return false;
      const r=rows[0];
      await enterRoomAsGuest({id:r.room_id,code:r.room_code,title:r.room_title,owner_id:r.owner_id},r.display_name);
      switchMobileTab('queue');
      toast('Bem-vinda de volta! Sua festa continua e a fila te espera. 🎶');
      return true;
    }catch(err){if(tgR18RoomRequestCurrent(ticket))console.warn('Retomada indisponível:',err.message);return false;}finally{tgR18EndRoomRequest(ticket);}
  }
  // R35: aviso de atualização somente fora do palco/camarim, sem reload forçado.
  let tg35UpdatePending=false;
  function notifyUpdateAvailable(){
    if(state.updateNotified)return;
    tg35UpdatePending=true;
    const view=document.body.dataset.currentView;
    if(!['landing','lobby'].includes(view)||state.room||state.currentSong||state.preflight||state.startingSong||state.finishing||state.localStream||state.soloMic||state.peers.size||state.recoveryIntent||document.hidden)return;
    state.updateNotified=true;tg35UpdatePending=false;
    toast('Nova versão do Tem Gogó disponível. Quando todas as festas terminarem, feche e reabra as abas ou o aplicativo para atualizar.');
  }
  function initPWA() {
    window.addEventListener('temgogo:view',()=>{if(tg35UpdatePending)notifyUpdateAvailable();});
    document.addEventListener('visibilitychange',()=>{if(tg35UpdatePending&&!document.hidden)notifyUpdateAvailable();});
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./service-worker.js').then(reg=>{if(reg.waiting)notifyUpdateAvailable();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)notifyUpdateAvailable();});});}).catch(err => console.warn('Service worker:',err));
    }
    window.addEventListener('beforeinstallprompt',event => {event.preventDefault();state.pendingInstall=event;document.querySelectorAll('.install-trigger').forEach(el=>el.hidden=false);});
    document.querySelectorAll('.install-trigger').forEach(button => button.addEventListener('click',async()=>{
      if(!state.pendingInstall)return;state.pendingInstall.prompt();await state.pendingInstall.userChoice;state.pendingInstall=null;button.hidden=true;
    }));
  }
  function isRecoveryReturn(){
    const url=new URL(location.href);
    const q=url.searchParams;
    const hash=new URLSearchParams(url.hash.replace(/^#/,''));
    return q.get('auth')==='recovery'||q.get('type')==='recovery'||hash.get('type')==='recovery';
  }
  function offerRecoveryForm(){
    if(!state.recoveryVerified||!state.user||tgR17RecoveryUid!==state.user.id||isAnonymous(state.user))return;
    show('landing');document.body.classList.remove('invite-active','entry-active');
    $('invite-welcome').hidden=true;
    $('host-access').hidden=false;$('guest-access').hidden=true;
    $('access-tabs').hidden=true;
    $('tg192-recovery-caption').hidden=false;
    openPasswordDialog(true);
    $('tg16-password-title').textContent='Defina sua nova senha';
    $('tg16-new-password').focus({preventScroll:true});
  }
  function showRemoteLogin(code){
    show('landing');document.body.classList.remove('invite-active','entry-active');
    $('invite-welcome').hidden=true;$('access-tabs').hidden=false;
    $('tab-host').click();$('auth-state').textContent='🔐 Você precisa entrar primeiro com a mesma conta do anfitrião da TV. Depois do login, o Controle abrirá automaticamente.';
    if(code)localStorage.setItem('tem-gogo-pending-remote',code);
  }
  async function resumeRemoteAfterLogin(){
    const roomCode=normalizeRoom(new URL(location.href).searchParams.get('room')||localStorage.getItem('tem-gogo-pending-remote'));
    if(!validRoom(roomCode)||!state.user||isAnonymous(state.user)||state.room)return false;
    const ticket=tgR18BeginRoomRequest();if(!ticket)return false;
    try{const {data,error}=await state.client.from('karaoke_rooms').select('id,code,title,owner_id,room_mode').eq('code',roomCode).eq('owner_id',state.user.id)
      .eq('status','open').gt('expires_at',new Date().toISOString()).maybeSingle();
    if(error)throw error;
    if(!tgR18RoomRequestCurrent(ticket))return false;
    if(!data||data.owner_id!==ticket.uid){$('auth-state').textContent='Este QR é exclusivo do anfitrião. Entre na conta que criou a festa na TV.';return false;}
    localStorage.removeItem('tem-gogo-pending-remote');
    await enterRoomAsRemote(data);return true;
    }finally{tgR18EndRoomRequest(ticket);}
  }
  // V19.3 — onboarding por papel. Não inicia durante recuperação de senha.
  const tg193TourSteps={
    solo:[
      ['Seu palco Solo','Escolha Músicas, adicione um hit e volte ao Palco. Não há QR de convidados no Solo.'],
      ['Microfone e nota','Ative o MIC SOLO e confirme o medidor antes de cantar. A avaliação usa tempo e volume; o Supabase confirma a nota ao final.'],
      ['Controle da Diva','Em Controle estão volumes, recados e autorização de falas automáticas. As falas dependem das gravações publicadas pela Central.'],
      ['Placar e outras salas','Abra Placar para conferir o resultado. Em Mais, Minhas salas mantém a festa aberta; Encerrar festa termina a sessão e abre o placar.']
    ],
    stage:[
      ['Seu palco está pronto!','A Diva recebe os cantores na TV. Mantenha o vídeo e a letra em destaque: o QR ao lado é a entrada dos convidados.'],
      ['Convidados pelo QR','Mostre o QR da festa. O QR separado do anfitrião abre o Controle no celular, com a mesma conta da TV.'],
      ['Músicas e controle','Use Músicas para a fila e biblioteca. Em Controle estão volumes, microfones, recados e autorização das falas da Diva.'],
      ['Placar, salas e ajuda','Em Placar veja notas. Em Mais encontre QR do controle, aparência, ajuda, Minhas salas e Encerrar festa. Trocar de sala não encerra a festa.']
    ],
    guest:[
      ['Entrou no camarim!','Escolha o seu avatar e faça parte da festa. Na aba Músicas você procura e adiciona sua favorita à fila.'],
      ['A Diva vai chamar','Quando chegar sua vez, você recebe o aviso e autoriza o microfone em um toque. Antes disso, ele fica desligado.'],
      ['O celular é seu microfone','Segure o aparelho como preferir. Veja o indicador de voz e o estado da conexão; o vídeo com a letra fica na TV.'],
      ['Salve seu histórico se quiser','Você pode cantar sem conta. O cadastro é opcional para guardar a identidade de palco e permitir conquistas oficiais quando disponíveis. FAQ e suporte ficam no rodapé.']
    ],
    'tg18-remote':[
      ['Seu controle está na mão!','O notebook/TV continua como palco. O celular controla a fila, a reprodução e o volume sem assumir o vídeo.'],
      ['Controle','Na primeira aba, chame cantores, prepare músicas e veja se o comando foi executado na TV.'],
      ['Informações e microfone','Na aba Informações, acompanhe a fila e escolha sua música. Quando chegar a sua vez, o microfone aparece no celular e transmite somente após autorização.'],
      ['Sala e ajuda','Abra Sala e ajuda no cabeçalho para voltar a Minhas salas, encerrar a festa ou obter suporte. Em Controle ficam volumes, aparência e recados.']
    ]
  };
  let tg193TourView='guest',tg193TourStep=0,tg193TourTimer=null;
  function tg31TourBusy(view){
    if(view==='stage')return !!(state.isPlaying||state.currentSong||state.preflight||state.finishing||!$('final-overlay')?.hidden||!$('tg123-post-score')?.hidden);
    return (view==='guest'||view==='tg18-remote')&&callActive();
  }
  function tg193OpenTour(force=false){
    if(state.recoveryIntent)return;
    const view=document.body.dataset.currentView;
    const kind=view==='stage'&&state.room?.room_mode==='solo'?'solo':view;
    if(!tg193TourSteps[kind])return;
    // Nunca bloquear música, chamada da Diva ou microfone durante um show.
    if(tg31TourBusy(view)){if(force)toast('Conclua a apresentação e o resultado para refazer o tour.',true);return;}
    const key='tem-gogo-tour-r26-'+kind;
    if(!force&&localStorage.getItem(key)==='seen')return;
    if($('tg193-tour-dialog').open||document.querySelector('dialog[open]'))return;
    tg193TourView=kind;tg193TourStep=0;tg193RenderTour();$('tg193-tour-dialog').showModal();
    localStorage.setItem(key,'seen');
  }
  function tg193RenderTour(){
    const steps=tg193TourSteps[tg193TourView]||tg193TourSteps.guest;
    const [title,body]=steps[tg193TourStep];
    $('tg193-tour-title').textContent=title;$('tg193-tour-copy').textContent=body;
    $('tg193-tour-count').textContent=`${tg193TourStep+1} de ${steps.length}`;
    $('tg193-tour-bars').innerHTML=steps.map((_,i)=>'<i'+(i<=tg193TourStep?' class="active"':'')+'></i>').join('');
    $('tg193-tour-prev').hidden=tg193TourStep===0;
    $('tg193-tour-next').textContent=tg193TourStep===steps.length-1?'Pronto! ✨':'Próximo →';
  }
  function tg193ScheduleTour(view){
    clearTimeout(tg193TourTimer);
    if(!tg193TourSteps[view])return;
    tg193TourTimer=setTimeout(()=>{if(document.body.dataset.currentView===view)tg193OpenTour(false);},1600);
  }
  function tg193OpenSupport(){
    const faq=$('faq-dialog');if(faq.open)faq.close();
    const tour=$('tg193-tour-dialog');if(tour.open)tour.close();
    tg193SwitchSupportTab('new');$('tg193-support-feedback').textContent='';
    $('tg193-support-dialog').showModal();
  }
  function tg193SwitchSupportTab(tab){
    const listing=tab==='list';
    $('tg193-support-new').hidden=listing;$('tg193-support-list').hidden=!listing;
    $('tg193-support-tab-new').setAttribute('aria-selected',String(!listing));
    $('tg193-support-tab-list').setAttribute('aria-selected',String(listing));
    if(listing)void tg193LoadTickets();
  }
  function tg193SupportError(err){
    const text=String(err?.message||err||'Falha desconhecida');
    if(/relation.*does not exist|tg_support_tickets|permission denied|schema cache/i.test(text))return 'Central de atendimento ainda não configurada. Peça ao responsável para aplicar o SQL 020 no Supabase.';
    return humanError(err);
  }
  async function tg193SendTicket(event){
    event.preventDefault();const f=$('tg193-support-feedback');
    if(!state.client||!state.user){f.textContent='Entre em sua conta ou participe de uma festa antes de enviar um chamado.';return;}
    const area=$('tg193-support-area').value,subject=$('tg193-support-subject').value.trim(),body=$('tg193-support-message').value.trim();
    if(subject.length<5||body.length<15){f.textContent='Informe um título (5+ caracteres) e descreva em pelo menos 15 caracteres.';return;}
    const button=$('tg193-support-send');button.disabled=true;f.textContent='Enviando para a Central…';
    try{
      const {data,error}=await state.client.from('tg_support_tickets').insert({area,subject,body,context_view:document.body.dataset.currentView||'landing'}).select('id,number').single();
      if(error)throw error;
      $('tg193-support-form').reset();f.textContent='✅ Chamado #'+data.number+' criado. Acompanhe em Meus chamados.';
      tg193SwitchSupportTab('list');
    }catch(err){f.textContent='⚠ '+tg193SupportError(err);}finally{button.disabled=false;}
  }
  async function tg193LoadTickets(){
    const root=$('tg193-support-tickets');
    if(!state.client||!state.user){root.textContent='Entre no Tem Gogó para ver seus pedidos.';return;}
    root.textContent='Carregando seus chamados…';
    try{
      const {data,error}=await state.client.from('tg_support_tickets').select('id,number,subject,body,status,created_at,updated_at').order('created_at',{ascending:false}).limit(40);
      if(error)throw error;
      if(!data?.length){root.textContent='Nenhum chamado ainda. Quando precisar, use Novo chamado.';return;}
      const ids=data.map(t=>t.id);
      const {data:replies,error:replyError}=await state.client.from('tg_support_replies').select('id,ticket_id,body,is_staff,created_at').in('ticket_id',ids).order('created_at',{ascending:true}).limit(200);
      if(replyError)throw replyError;
      const statusLabel={pendente:'Pendente',em_andamento:'Em andamento',aguardando_resposta:'Aguardando resposta',concluido:'Concluído',reaberto:'Reaberto'};
      root.innerHTML=data.map(t=>{const notes=(replies||[]).filter(r=>r.ticket_id===t.id).map(r=>`<div class="tg193-reply ${r.is_staff?'staff':''}"><small>${r.is_staff?'Equipe Tem Gogó':'Você'} · ${new Date(r.created_at).toLocaleDateString('pt-BR')}</small><div>${escapeHTML(r.body)}</div></div>`).join('');
        return `<article class="tg193-ticket"><header><strong>#${t.number} · ${escapeHTML(t.subject)}</strong><span class="tg193-status">${statusLabel[t.status]||'Em análise'}</span></header><small>Enviado ${new Date(t.created_at).toLocaleDateString('pt-BR')}</small><p>${escapeHTML(t.body)}</p><div class="tg193-replies">${notes||'<small>Sem respostas ainda.</small>'}</div>${t.status==='concluido'?`<button type="button" class="button button-soft" data-tg193-reopen="${t.id}">↻ Reabrir chamado</button>`:`<form data-tg193-reply="${t.id}"><label class="sr-only" for="tg193-reply-${t.id}">Responder chamado ${t.number}</label><textarea id="tg193-reply-${t.id}" maxlength="3000" required minlength="2" rows="2" placeholder="Responder à equipe…"></textarea><button class="button button-soft" type="submit">Enviar</button></form>`}</article>`;
      }).join('');
    }catch(err){root.textContent='⚠ '+tg193SupportError(err);}
  }
  async function tg193Reply(event){
    const form=event.target.closest('[data-tg193-reply]');if(!form)return;
    event.preventDefault();const body=form.querySelector('textarea').value.trim();
    if(body.length<2)return;
    const button=form.querySelector('button');button.disabled=true;
    const {error}=await state.client.from('tg_support_replies').insert({ticket_id:form.dataset.tg193Reply,body});
    if(error){$('tg193-support-feedback').textContent='⚠ '+tg193SupportError(error);button.disabled=false;return;}
    $('tg193-support-feedback').textContent='✅ Resposta enviada.';await tg193LoadTickets();
  }
  function tg193AttachEvents(){
    document.querySelectorAll('[data-tg193-tour]').forEach(b=>b.addEventListener('click',()=>{
      if($('faq-dialog').open)$('faq-dialog').close();tg193OpenTour(true);
    }));
    document.querySelectorAll('[data-tg193-support]').forEach(b=>b.addEventListener('click',tg193OpenSupport));
    document.querySelectorAll('[data-tg193-faq]').forEach(b=>b.addEventListener('click',()=>{$('faq-dialog').showModal();}));
    for(const id of ['tg193-tour-close','tg193-tour-skip'])$(id).addEventListener('click',()=>$('tg193-tour-dialog').close());
    $('tg193-tour-prev').addEventListener('click',()=>{tg193TourStep=Math.max(0,tg193TourStep-1);tg193RenderTour();});
    $('tg193-tour-next').addEventListener('click',()=>{if(tg193TourStep===(tg193TourSteps[tg193TourView]?.length||4)-1){$('tg193-tour-dialog').close();return;}tg193TourStep++;tg193RenderTour();});
    $('tg193-support-close').addEventListener('click',()=>$('tg193-support-dialog').close());
    $('tg193-support-tab-new').addEventListener('click',()=>tg193SwitchSupportTab('new'));
    $('tg193-support-tab-list').addEventListener('click',()=>tg193SwitchSupportTab('list'));
    $('tg193-support-form').addEventListener('submit',event=>{void tg193SendTicket(event);});
    $('tg193-support-refresh').addEventListener('click',()=>void tg193LoadTickets());
    $('tg193-support-tickets').addEventListener('submit',event=>void tg193Reply(event));
    $('tg193-support-tickets').addEventListener('click',async event=>{const b=event.target.closest('[data-tg193-reopen]');if(!b)return;b.disabled=true;const {error}=await state.client.rpc('tg_support_reopen_ticket',{p_ticket:b.dataset.tg193Reopen});if(error){$('tg193-support-feedback').textContent='⚠ '+tg193SupportError(error);b.disabled=false;return;}$('tg193-support-feedback').textContent='✅ Chamado reaberto.';await tg193LoadTickets();});
  }
  async function init() {
    initPWA();loadPreferences();renderAvatarOptions();
    document.getElementById('tg-beta-external-go')?.addEventListener('click',()=>{const input=$('tg07-external-query'),main=$('catalog-search');input.value=main.value.trim();if(input.value.length>=2)void searchYoutube(state.role==='host',true,true);else{main.focus();toast('Digite uma música ou artista na busca acima.');}});
    $('video-frame').appendChild($('stage-preflight'));
    setupHostCockpit();
    attachEvents();tg193AttachEvents();
    state.recoveryIntent=isRecoveryReturn();
    const url=new URL(location.href);
    const remoteIntent=!state.recoveryIntent&&url.searchParams.get('remote')==='1';
    const linkRoom=normalizeRoom(url.searchParams.get('room'));
    const savedRoom=state.recoveryIntent?null:normalizeRoom(localStorage.getItem('tem-gogo-pending-room'));
    const targetRoom=window.TG73_INVITES.initial({linkRoom,savedRoom,recoveryIntent:state.recoveryIntent,remoteIntent});
    if(targetRoom && validRoom(linkRoom) && !remoteIntent)holdInvitation(linkRoom); // URL recente prevalece.
    if(!state.recoveryIntent&&!remoteIntent&&linkRoom && url.searchParams.get('auth')!=='login'){
      showGuestEntry(linkRoom);
      $('invite-welcome').querySelector('p')?.replaceChildren(document.createTextNode('🎟️ Convite recebido! Informe seu apelido e escolha seu avatar para entrar.'));
    }
    if(!configured()){$('auth-state').textContent='⚙️ Confira config.js e a instalação SQL do Tem Gogó para ativar as salas.';return;}
    if(!window.supabase?.createClient){toast('Não foi possível carregar a biblioteca Supabase. Verifique a internet.',true);return;}
    state.client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    // IMPORTANTE: receber PASSWORD_RECOVERY antes de ler/restaurar convites ou abrir o lobby.
    state.client.auth.onAuthStateChange((event,session)=>{
      const favoriteIdentityChanged=tg26FavoriteAccount()!==tg36FavoriteIdentity(session?.user);
      if(favoriteIdentityChanged)tg36ClearFavoriteIdentity();
      if(state.user?.id!==session?.user?.id){
        if($('catalog-dialog')?.open)$('catalog-dialog').close();
        if(state.room&&!state.emergencyClosing){tg23Suspend('A conta deste aparelho mudou. Saia do palco local e entre novamente com a conta correta.');show('landing');}
        tgR18ClearReadyRoom();tgR17ClearPasswordContext();tgR09ClearHistory();tg15ClearRecap();++tg15RoomsSerial;$('existing-rooms')?.replaceChildren();$('tg123-active-controls')?.replaceChildren();}
      state.user=session?.user||null;tg26FavoritePaint();if(favoriteIdentityChanged&&$('catalog-dialog')?.open){renderFullCatalog();void tg26LoadFavorites();}
      if(event==='PASSWORD_RECOVERY'){
        state.recoveryVerified=true;state.recoveryIntent=true;tgR17RecoveryUid=state.user?.id||null;
        setTimeout(offerRecoveryForm,0);
      }
      if(state.role==='guest')updateAccountCTA();
    });
    try{
      const {data:{session},error}=await state.client.auth.getSession();if(error)throw error;
      state.user=session?.user||null;
      if(state.recoveryIntent){
        // Não confie apenas em ?auth=recovery: é preciso o evento autenticado do Supabase.
        show('landing');$('invite-welcome').hidden=true;$('access-tabs').hidden=true;
        $('host-access').hidden=false;$('guest-access').hidden=true;
        if(state.recoveryVerified)offerRecoveryForm();
        else {
          $('auth-state').textContent='Validando o link de recuperação…';
          setTimeout(()=>{
            if(state.recoveryVerified)return;
            $('access-tabs').hidden=false;
            $('auth-state').textContent='O link não foi validado (pode ter expirado ou já ter sido usado). Informe seu e-mail e toque em “Esqueci minha senha” para solicitar outro.';
          },1800);
        }
        return;
      }
      if(url.searchParams.get('auth')==='login'&&!state.recoveryIntent&&!remoteIntent){
        if(validRoom(linkRoom))sessionStorage.setItem('tg20-auth-return-room',linkRoom);
        show('landing');$('invite-welcome').hidden=true;$('access-tabs').hidden=false;
        $('tab-host').click();
        $('auth-state').textContent='Entre com sua conta ou crie uma nova. Seu convite ficará disponível após o acesso.';
        if(url.searchParams.get('mode')==='signup')setTimeout(openSignup,0);
        return;
      }
      if(remoteIntent){
        if(state.user&&!isAnonymous(state.user)){
          if(!await resumeRemoteAfterLogin()){
            showRemoteLogin(linkRoom);
            toast('Este QR é do anfitrião: entre com a mesma conta usada na TV.',true);
          }
        }else showRemoteLogin(linkRoom);
        return;
      }
      if(targetRoom){
        const resumed=await tryResumeMembership(targetRoom);
        if(!resumed){
          if(linkRoom){showGuestEntry(linkRoom);toast('Confira o convite da festa e escolha seu avatar para entrar. 🎭');}
          else{
            localStorage.removeItem('tem-gogo-pending-room');
            if(state.user&&!isAnonymous(state.user))await openLobby();
            else show('landing');
          }
        }
      }else if(state.user&&!isAnonymous(state.user))await openLobby();
      // Sem convite na URL, abrir o login limpo, inclusive no PWA instalado.
    }catch(err){toast(humanError(err),true);}
  }
  function isAnonymous(user) {return user?.is_anonymous===true || user?.app_metadata?.provider==='anonymous';}
  function checkBackend() {if (!state.client){toast('Antes de usar, configure o Supabase em config.js.',true);return false;}return true;}
  async function callRPC(name,params) {const {data,error}=await state.client.rpc(name,params);if(error)throw error;return data;}

  function openGuestEntry(roomCode) {
    $('tab-host').classList.remove('active');$('tab-host').setAttribute('aria-selected','false');
    $('tab-guest').classList.add('active');$('tab-guest').setAttribute('aria-selected','true');
    $('host-access').hidden=true;$('guest-access').hidden=false;
    $('guest-code').value=normalizeRoom(roomCode);
    const signed=!!(state.user&&!isAnonymous(state.user));
    $('guest-name').readOnly=signed;
    $('guest-name').value=signed?String(state.user.user_metadata?.display_name||''):localStorage.getItem('tem-gogo-display-name')||'';
    if(signed){
      const uid=state.user.id,epoch=tg07SessionEpoch,code=$('guest-code').value,field=$('guest-name');
      void (async()=>{try{
        const {data,error}=await state.client.from('tg_profiles').select('nickname').eq('user_id',uid).maybeSingle();
        if(!error&&state.user?.id===uid&&tg07SessionEpoch===epoch&&!state.room&&$('guest-code').value===code&&!$('guest-access').hidden&&field.readOnly&&typeof data?.nickname==='string')field.value=data.nickname;
      }catch(e){console.warn('Apelido da conta ainda não carregado.');}})();
    }
  }
  let tg12AvailabilityEpoch=0;
  async function tg12ModeAvailability(){
    const uid=state.user?.id, gen=++tg12AvailabilityEpoch;
    if(!uid||!state.client)return;
    const entries=[['classic','tg70-go-classic','Criar festa · convidados, QR e fila de músicas'],['solo','tg70-go-solo','Cante no mesmo aparelho · sem QR de convidados']];
    const current=()=>gen===tg12AvailabilityEpoch&&uid===state.user?.id&&!state.room;
    try{
      const {data,error}=await state.client.rpc('tg30_mode_availability');
      if(error||!data?.modes)throw Error('indisponível');
      if(!current())return;
      for(const [mode,id,normal] of entries){const button=$(id),status=data.modes[mode]?.status;if(!button)continue;const blocked=status==='maintenance'||status==='safety_hold';const label=button.querySelector('small');if(label)label.textContent=status==='safety_hold'?'Bloqueio de segurança · aguarde validação':blocked?'Manutenção programada · festas abertas no histórico':status==='available'?normal:'Disponibilidade não verificada';button.disabled=blocked;button.setAttribute('aria-disabled',String(blocked));}
    }catch{if(!current())return;for(const [,id] of entries){const b=$(id);if(b){b.disabled=false;b.setAttribute('aria-disabled','false');const label=b.querySelector('small');if(label)label.textContent='Disponibilidade não verificada · servidor confirma ao criar';}}}
  }
  async function openLobby() {
    document.body.classList.remove('invite-active','entry-active','tg95-join-signed-in');
    show('lobby');
    // R92: o lobby comeca por Criar, Entrar ou Historico; os formularios
    // originais continuam disponiveis depois da escolha do usuario.
    $('host-create-area').hidden=true;
    if($('tg92-hub-choices'))$('tg92-hub-choices').hidden=false;
    const modeSection=$('tg70-modes');if(modeSection)modeSection.hidden=true;
    const historySection=$('tg93-history-panel');if(historySection)historySection.hidden=true;
    const modeTrigger=$('tg92-hub-create');if(modeTrigger)modeTrigger.setAttribute('aria-expanded','false');
    $('tg92-hub-history')?.setAttribute('aria-expanded','false');
    void tg12ModeAvailability();
    void tg83RestoreAvatar();
    await loadMyRooms();
  }
  let tg15RoomsSerial=0;
  async function loadMyRooms() {
    const serial=++tg15RoomsSerial,uid=state.user?.id,epoch=tg07SessionEpoch;
    const current=()=>!!uid&&state.user?.id===uid&&epoch===tg07SessionEpoch&&serial===tg15RoomsSerial;
    const container=$('existing-rooms');
    container.replaceChildren();
    if(!state.client||!state.user)return;
    try {
      // RLS: a consulta só mostra salas que o usuário possui ou das quais é membro.
      const {data,error}=await state.client.from('karaoke_rooms')
        .select('id,title,code,status,expires_at,created_at,owner_id,room_mode,tg30_battle_reserved')
        .order('created_at',{ascending:false}).limit(60);
      if(!current())return;if(error)throw error;
      const rooms=(data||[]).filter(r=>r.status==='closed'||(r.status==='open'&&new Date(r.expires_at).getTime()>Date.now()));
      const membership=await state.client.from('karaoke_members')
        .select('room_id,display_name').eq('user_id',uid).limit(60);
      if(!current())return;if(membership.error)throw membership.error;
      const names=new Map((membership.data||[]).map(m=>[m.room_id,m.display_name]));
      const heading=document.createElement('h3');heading.className='my-rooms-heading';heading.textContent='🎟️ Minhas festas ('+rooms.length+')';container.append(heading);
      // Beta 1.2.3: atalho proprietário independente do QR de convidados.
      const controls=$('tg123-active-controls');
      if(controls){
        controls.replaceChildren();
        const own=rooms.filter(r=>r.owner_id===state.user.id&&r.status==='open');
        controls.hidden=!own.length;
        if(own.length){
          const cap=document.createElement('strong');cap.textContent=own.length===1?'🎛️ Sua festa está no ar':'🎛️ Suas festas ativas';controls.append(cap);
          for(const active of own){
            const row=document.createElement('div');row.className='tg123-hub-room';
            const label=document.createElement('span');label.textContent=active.title;
            const control=document.createElement('button');control.type='button';control.className='button button-primary';control.textContent='Controlar minha festa';
            control.addEventListener('click',()=>{if(current())void enterRoomAsRemote(active);});
            const stage=document.createElement('button');stage.type='button';stage.className='button button-outline';stage.textContent='Abrir palco';
            stage.addEventListener('click',()=>{if(current())void enterRoomAsHost(active);});
            row.append(label);if(active.room_mode!=='solo')row.append(control);row.append(stage);controls.append(row);
          }
        }
      }
      if(!rooms.length){const p=document.createElement('p');p.className='hub-empty';p.textContent='Ainda não tem festa por aqui. Crie uma ou entre com o convite de alguém!';container.append(p);return;}
      for(const room of rooms){
        const host=room.owner_id===state.user.id;
        const card=document.createElement('button');card.type='button';card.className='hub-room-card'+(room.status==='closed'?' hub-room-closed':'');
        const finished=room.status==='closed';const description=finished?(room.tg30_battle_reserved?'🏆 Palco competitivo encerrado • Meus festivais':'🏆 Festa encerrada • Ver placar'):room.tg30_battle_reserved?'🏆 Palco competitivo':host?'👑 Você apresenta':'🎤 Você participa';
        card.innerHTML='<span class="hub-room-icon">'+(host?'📺':'🎙️')+'</span><span class="hub-room-info"><strong>'+escapeHTML(room.title)+'</strong><small>'+description+' · '+escapeHTML(room.code)+'</small></span><span class="hub-room-arrow">↗</span>';
        card.addEventListener('click',async()=>{
          if(!current())return;
          if(finished&&room.tg30_battle_reserved!==false){if(room.tg30_battle_reserved===true&&window.TEM_GOGO_CONFIG?.BATTLE_API_RELEASE_ALLOWED===true)void window.TG75_BATTLE_PANEL?.open();else toast('O placar recreativo não está disponível para este palco.');return;}
          if(finished){try{await tg15LoadRecap(room.id);}catch(error){toast(humanError(error),true);}return;}
          if(host && room.room_mode!=='solo' && matchMedia('(max-width: 750px)').matches){
            const choice=await window.TG_UI.choose({title:'Como vai usar este aparelho?',message:'A TV pode continuar no palco enquanto você controla a festa ou canta pelo celular.',choices:[{label:'🎛️ Controle no celular',value:'remote',primary:true},{label:'📺 Abrir palco aqui',value:'stage'}]});
            if(!current())return;
            if(choice==='remote')await enterRoomAsRemote(room);else if(choice==='stage')await enterRoomAsHost(room);
          }else if(host)await enterRoomAsHost(room);
          else await enterRoomAsGuest(room,names.get(room.id)||localStorage.getItem('tem-gogo-display-name')||'Estrela');
        });
        container.append(card);
      }
    }catch(err){
      if(!current())return;
      const p=document.createElement('p');p.className='hub-empty';p.textContent='Não consegui carregar suas festas: '+humanError(err);container.append(p);
    }
  }
  async function goToMyRooms(){
    const uid=state.user?.id,epoch=tg07SessionEpoch,roomId=state.room?.id;
    if(state.emergencyClosing||state.finishing||state.startingSong){toast('Aguarde a conclusão da operação atual antes de trocar de sala.',true);return;}
    const active=state.role==='host'&&(state.currentSong||state.preflight)||(['remote','guest'].includes(state.role)&&callActive());
    const solo=state.room?.room_mode==='solo';
    if(active&&!await window.TG_UI.confirm(solo?'Ao sair, a apresentação e o microfone deste aparelho serão interrompidos. Sua sessão continuará aberta.':'Ao trocar de sala, a apresentação ou o microfone deste aparelho será interrompido. A festa continuará aberta.',{title:solo?'Voltar aos modos':'Trocar de sala',confirmText:solo?'Voltar aos modos':'Ir para Minhas salas'}))return;
    if(state.user?.id!==uid||tg07SessionEpoch!==epoch||state.room?.id!==roomId||state.emergencyClosing||state.finishing||state.startingSong)return;
    await stopSession();
    if(state.user?.id!==uid||tg07SessionEpoch!==epoch+1||state.room)return;
    forgetInvitation();
    document.body.classList.remove('tg104-single-device');
    history.replaceState(null,'',new URL('./',location.href).href);
    if(state.user)await openLobby();
    else showGuestEntry('');
  }
  async function login(event) {
    event.preventDefault();if(!checkBackend()||tgR17PasswordPending||$('login-button').disabled)return;
    const button=$('login-button');setLoading(button,true,'Entrando...');
    try {
      const {data,error}=await state.client.auth.signInWithPassword({email:$('auth-email').value.trim(),password:$('auth-password').value});
      if(error)throw error; state.user=data.user;
      if(localStorage.getItem('tem-gogo-pending-remote')&&await resumeRemoteAfterLogin())return;
      const returnRoom=normalizeRoom(sessionStorage.getItem('tg20-auth-return-room'));
      sessionStorage.removeItem('tg20-auth-return-room');
      if(validRoom(returnRoom)){
        const cleanUrl=new URL('./',location.href);cleanUrl.searchParams.set('room',returnRoom);
        history.replaceState(null,'',cleanUrl.href);
        holdInvitation(returnRoom);showGuestEntry(returnRoom);
        toast('Conta conectada! Confira seu apelido e entre na festa. 🎤');return;
      }
      await openLobby();
    }catch(err){$('auth-state').textContent=humanError(err);toast(humanError(err),true);}finally{setLoading(button,false);}
  }
  // Reenvio de confirmação: sem senha, sem criar outra conta, sem revelar existência de cadastro.
  let tg30ResendUntil=0, tg30Resending=false;
  async function tg30ResendConfirmation(source){
    if(!checkBackend()||tg30Resending)return;
    const emailInput=$(source==='signup'?'signup-email':'auth-email');
    const output=$(source==='signup'?'signup-feedback':'auth-state');
    const email=emailInput.value.trim().toLowerCase();
    if(!email||!emailInput.checkValidity()){output.textContent='Informe um e-mail válido para solicitar a confirmação.';emailInput.focus();return;}
    if(Date.now()<tg30ResendUntil){output.textContent='Aguarde '+Math.ceil((tg30ResendUntil-Date.now())/1000)+' segundos antes de pedir outro e-mail.';return;}
    const buttons=[$('auth-resend-confirmation'),$('signup-resend-confirmation')];
    tg30Resending=true;tg30ResendUntil=Date.now()+60000;buttons.forEach(b=>b.disabled=true);
    output.textContent='Solicitando novo e-mail…';
    try{
      const {error}=await state.client.auth.resend({type:'signup',email,options:{emailRedirectTo:new URL('./',location.href).href}});
      if(error){if(error.status===429||Number(error.status)>=500||['over_email_send_rate_limit','email_address_not_authorized','over_request_rate_limit'].includes(error.code)||/rate limit|email address not authorized|network|failed to fetch/i.test(error.message||''))throw error;}
      output.textContent='Se houver uma confirmação pendente, você poderá receber um novo link. Confira a caixa de entrada e o spam; se já confirmou, tente entrar.';
    }catch(error){output.textContent=humanError(error);}
    finally{tg30Resending=false;buttons.forEach(b=>b.disabled=false);}
  }
  function openSignup() {
    $('signup-feedback').textContent='';
    $('signup-form').reset();['signup-password','signup-confirm'].forEach(id=>$(id).type='password');
    $('signup-email').value=$('auth-email').value.trim();
    $('signup-dialog').showModal();
    $('signup-name').focus();
  }
  function closeSignup(){ $('signup-dialog').close(); }
  async function signup(event) {
    event.preventDefault();
    if(!checkBackend()||tgR17PasswordPending||$('signup-submit').disabled)return;
    const name=$('signup-name').value.trim();
    const email=$('signup-email').value.trim().toLowerCase();
    const password=$('signup-password').value;
    const confirm=$('signup-confirm').value;
    const feedback=$('signup-feedback');
    if(name.length<2){feedback.textContent='Conte para a gente seu nome de palco. ✨';return;}
    if(password.length<10||!/[A-Za-zÀ-ÿ]/.test(password)||!/[0-9]/.test(password)){
      feedback.textContent='Sua senha precisa ter pelo menos 10 caracteres, com letras e números.';return;
    }
    if(password!==confirm){feedback.textContent='As senhas não são iguais. Confere, estrela!';return;}
    const button=$('signup-submit');setLoading(button,true,'Criando sua conta...');
    feedback.textContent='';
    try{
      const {data,error}=await state.client.auth.signUp({
        email,password,
        options:{ data:{display_name:name,tg_voice_profile:window.TG30VoiceUI?.signup()||null}, emailRedirectTo:new URL('./',location.href).href }
      });
      if(error)throw error;
      $('auth-email').value=email;
      if(data.session){
        state.user=data.user;closeSignup();
        const returnRoom=normalizeRoom(sessionStorage.getItem('tg20-auth-return-room'));
        sessionStorage.removeItem('tg20-auth-return-room');
        if(validRoom(returnRoom)){
          const cleanUrl=new URL('./',location.href);cleanUrl.searchParams.set('room',returnRoom);
          history.replaceState(null,'',cleanUrl.href);
          holdInvitation(returnRoom);showGuestEntry(returnRoom);toast('Conta criada! Confirme seus dados para participar. 🌟');}
        else {await openLobby();toast('Conta criada! Agora o palco é seu. 🌟');}
      }
      else {
        // O Supabase pode não revelar quando um endereço já existe. Não prometer conta nova.
        feedback.textContent='📬 Se o cadastro puder ser concluído, você receberá um e-mail de confirmação. Confira também o spam; depois entre com sua senha.';
        ['signup-password','signup-confirm'].forEach(id=>{$(id).value='';$(id).type='password';});$('signup-show-password').checked=false;tg30ResendUntil=Date.now()+60000;
      }
    }catch(err){feedback.textContent=humanError(err);toast(humanError(err),true);}
    finally{setLoading(button,false);}
  }
  let tgR18RoomRequest=null;
  function tgR18BeginRoomRequest(){
    if(tgR18RoomRequest||state.room||state.emergencyClosing)return null;
    const t={uid:state.user?.id??null,epoch:tg07SessionEpoch,view:document.body.dataset.currentView};tgR18RoomRequest=t;return t;
  }
  function tgR18RoomRequestCurrent(t){return tgR18RoomRequest===t&&t.epoch===tg07SessionEpoch&&t.uid===(state.user?.id??null)&&t.view===document.body.dataset.currentView&&!state.room&&!state.emergencyClosing;}
  function tgR18EndRoomRequest(t){if(tgR18RoomRequest===t)tgR18RoomRequest=null;}
  function tgR18ClearReadyRoom(){state.readyRoom=null;$('ready-code').textContent='';if($('room-ready-dialog').open)$('room-ready-dialog').close();}
  function tgR18ReadyRoom(){const saved=state.readyRoom;return saved&&saved.uid===state.user?.id&&saved.epoch===tg07SessionEpoch&&saved.room.owner_id===saved.uid&&$('room-ready-dialog').open?saved:null;}
  async function makeRoom(event) {
    event.preventDefault();if(!checkBackend()||!state.user||isAnonymous(state.user)||state.room)return;
    const button=event.target.querySelector('[type=submit]');if(button.disabled)return;const ticket=tgR18BeginRoomRequest();if(!ticket)return;setLoading(button,true,'Montando seu palco…');ticket.narration=$('tg64-create-narration')?.checked===true;
    try {
      const data=await callRPC('karaoke_create_room_mode',{p_title:$('room-title').value.trim(),p_mode:'classic'});
      if(!tgR18RoomRequestCurrent(ticket))return;
      if(!data?.[0]?.room_id||!validRoom(data[0].room_code))throw new Error('Não foi possível confirmar a criação da festa. Confira Minhas festas antes de tentar novamente.');
      const room={id:data[0].room_id,code:data[0].room_code,title:data[0].room_title,owner_id:ticket.uid,room_mode:'classic'};
      state.readyRoom={room,uid:ticket.uid,epoch:ticket.epoch,narration:ticket.narration===true};
      $('ready-code').textContent=room.code;
      $('room-ready-dialog').showModal();
      await openLobby(); // Login autenticado deve abrir o lobby, nao somente consultar salas.
    }catch(err){if(tgR18RoomRequestCurrent(ticket))toast(humanError(err),true);}finally{tgR18EndRoomRequest(ticket);setLoading(button,false);}
  }
  async function joinRoomByCode(rawCode,{auto=false}={}){
    if(!checkBackend())return false;
    const code=normalizeRoom(rawCode);
    if(!validRoom(code)){if(!auto)toast('Confira o código da festa no QR ou na TV.',true);return false;}
    let name=($('guest-name').value||'').trim();
    if((!state.user||isAnonymous(state.user))&&name.length<2){toast('Escolha um apelido com pelo menos 2 caracteres antes de entrar.',true);return false;}
    if(name.length>24)name=name.slice(0,24);
    if(state.room)return false;const ticket=tgR18BeginRoomRequest();if(!ticket)return false;
    const sameCode=()=>normalizeRoom($('guest-code').value)===code;
    try{
      if(!state.user){
        const {data,error}=await state.client.auth.signInAnonymously();
        if(error)throw error;
        if(!data?.user?.id||tgR18RoomRequest!==ticket||ticket.epoch!==tg07SessionEpoch||ticket.view!==document.body.dataset.currentView||(state.user&&state.user.id!==data.user.id))return false;
        state.user=data.user;ticket.uid=data.user.id;tg83SetAvatar(state.avatar);
      }
      if(!tgR18RoomRequestCurrent(ticket)||!sameCode())return false;
      if(!isAnonymous(state.user)){
        const {data:identity,error:identityError}=await state.client.from('tg_profiles').select('nickname').eq('user_id',ticket.uid).maybeSingle();
        if(!tgR18RoomRequestCurrent(ticket)||!sameCode())return false;if(identityError)throw identityError;
        name=String(identity?.nickname||state.user.user_metadata?.display_name||'').trim();
        if(name.length<2||name.length>24)throw Error('Atualize o apelido em Meu perfil (2 a 24 caracteres) antes de entrar.');
      }
      const result=await callRPC('karaoke_join_room',{p_code:code,p_name:name});
      if(!tgR18RoomRequestCurrent(ticket)||!sameCode())return false;
      const codeError=result?.[0]?.error_code;
      if(codeError==='full')throw new Error('Esta festa já tem 40 participantes.');
      if(codeError==='rate_limited')throw new Error('Muitos convites tentados. Aguarde 10 minutos para tentar novamente.');
      if(codeError)throw new Error('Festa não encontrada, encerrada ou convite inválido. Peça o QR atualizado.');
      if(!result?.[0]?.room_id)throw new Error('Não foi possível validar o convite da festa.');
      localStorage.setItem('tem-gogo-display-name',name);
      localStorage.setItem('tem-gogo-pending-room',code);
      const r=result[0];if(await enterRoomAsGuest({id:r.room_id,code:r.room_code,title:r.room_title,owner_id:r.owner_id},name)===false)return false;
      return true;
    }catch(err){
      if(!tgR18RoomRequestCurrent(ticket)||!sameCode())return false;
      toast(humanError(err),true);
      if(auto)showGuestEntry(code);
      // A identificação não confirma a existência da sala: devolva o usuário à busca
      // quando o convite for recusado, sem perder apelido e avatar.
      if(!auto && /Festa não encontrada|convite inválido|Não foi possível validar o convite/i.test(String(err?.message||''))){
        if(localStorage.getItem('tem-gogo-pending-room')===code)localStorage.removeItem('tem-gogo-pending-room');
        window.dispatchEvent(new CustomEvent('temgogo:guest-invalid-room',{detail:{room:code}}));
      }
      return false;
    }finally{tgR18EndRoomRequest(ticket);}
  }
  async function joinParty(event) {
    event.preventDefault();
    const button=event.target.querySelector('[type=submit]');if(button.disabled)return;setLoading(button,true,'Entrando na festa...');
    try{await joinRoomByCode($('guest-code').value);}finally{setLoading(button,false);}
  }

  let tgR15StageTicket=null;
  async function tgR15RequestStage(){
    const scope=tg07Scope();
    const allowed=()=>tg07Current(scope)&&state.role==='remote'&&canDirectDiva()&&!state.emergencyBlocked&&!callActive()&&!state.localStream&&!state.remotePending.size;
    if(!allowed()){toast('Conclua sua apresentação e aguarde os comandos da TV antes de abrir o palco.',true);return false;}
    if(tgR15StageTicket&&tg07Current(tgR15StageTicket))return false;
    tgR15StageTicket=scope;const button=$('tg18-remote-stage');button.disabled=true;
    const fresh=async()=>{
      const {data,error}=await state.client.from('karaoke_rooms').select('id,code,title,owner_id,status,current_song_id,expires_at,room_mode,tg30_battle_reserved').eq('id',scope.room).single();
      if(error)throw error;
      if(!allowed()||data?.id!==scope.room||data.owner_id!==scope.uid||data.status!=='open'||data.current_song_id||data.tg30_battle_reserved!==false||data.room_mode!=='classic'||!(Date.parse(data.expires_at)>Date.now()))return null;
      return data;
    };
    try{
      if(!await fresh()){if(tg07Current(scope))toast('Não é possível abrir outro palco agora. Confira a música e a sala na TV.',true);return false;}
      if(!await window.TG_UI.confirm('Encerre o player ou feche o aplicativo do palco anterior, sem encerrar a festa. Confirme somente quando a TV estiver parada. O sistema ainda não verifica exclusividade entre aparelhos.',{title:'Abrir palco neste aparelho',confirmText:'TV fechada · Abrir palco'}))return false;
      if(!allowed())return false;
      const room=await fresh();if(!room){if(tg07Current(scope))toast('O estado da festa mudou. Continue usando o controle.',true);return false;}
      if(!allowed())return false;
      await enterRoomAsHost(room);return true;
    }catch(err){if(tg07Current(scope))toast('Não foi possível verificar o palco. Continue usando o controle.',true);return false;}
    finally{if(tgR15StageTicket===scope){tgR15StageTicket=null;button.disabled=false;}}
  }
  async function enterRoomAsHost(room,{narration=true}={}){
    if(state.emergencyClosing||state.finishing||state.startingSong)return false;
    if(!state.user||isAnonymous(state.user)||room?.owner_id!==state.user.id)return false;
    const uid=state.user.id,epoch=tg07SessionEpoch+1;await stopSession();if(state.user?.id!==uid||tg07SessionEpoch!==epoch||state.room)return false;
    state.room=room;state.role='host';if($('tg30-control-qr-details'))$('tg30-control-qr-details').open=false;tg100SyncRoomMode();setSyncStatus('sync');$('stage-room-title').textContent=room.title;
    $('room-code').textContent=room.code;show('stage');setDivaStageState('idle');drawQR();
    const scope=tg07Scope(),current=()=>tg38RoomCurrent(scope,'host');
    try{await hydrateRoom();if(!current())return;await subscribeRoom();if(!current())return;startTicker();
      tg89OfferSound(scope);
      void loadCatalog(true);
      try{if(current()){await loadYouTubeAPI();if(!current())return;if(state.room?.current_song_id)await resumeExistingSong();}}
      catch(err){if(current())toast(humanError(err),true);}
      if(!current())return;
      await unlockWakeLock();
      if(!current())return;
      if(tg13Recreational())window.TG74_DIVA_STUDIO?.setAuto(narration===true);
      updateVoxLine('opening');
      clearInterval(state.voxTimer);
      state.voxTimer=setInterval(()=>{if(!state.emergencyBlocked&&state.role==='host'&&!state.isPlaying&&!state.currentSong&&!state.preflight&&!recadoShowing&&!tg87DivaAudio&&$('final-overlay')?.hidden)updateVoxLine('opening');},14000);
      toast(state.room?.room_mode==='solo'?'Seu palco solo está pronto! 🎤':'Diva Gogó NO AR! Mostre o QR: ele já dá acesso direto à festa. 🎉');
    }catch(err){if(tg07Current(scope)&&!state.emergencyClosing)toast(humanError(err),true);}
  }
  async function enterRoomAsGuest(room,name){
    if(state.emergencyClosing||state.finishing||state.startingSong)return false;
    if(!state.user||!room?.id)return false;
    const uid=state.user.id,epoch=tg07SessionEpoch+1;await stopSession();if(state.user?.id!==uid||tg07SessionEpoch!==epoch||state.room)return false;
    document.body.classList.remove('invite-active','entry-active');
    state.room=room;state.role='guest';setSyncStatus('sync');$('guest-display-name').textContent=name;$('guest-profile-avatar').src=avatarSrc(state.avatar);$('guest-room-code').textContent=room.code;
    $('guest-room-title').textContent=room.title;show('guest');$('guest-install').hidden=isStandalone();updateVoxLine('opening');
    history.replaceState({temGogo:true,view:'entry'},'',currentURL(room.code));
    history.pushState({temGogo:true,view:'guest',tab:'queue'},'',currentURL(room.code));
    localStorage.setItem('tem-gogo-pending-room',room.code);
    state.mobileTab=null;switchMobileTab('queue',false);updateAccountCTA();
    const scope=tg07Scope(),current=()=>tg38RoomCurrent(scope,'guest');
    try{await hydrateRoom();if(!current())return;void loadCatalog(true);await subscribeRoom();if(!current())return;startTicker();startMemberVerifier();await sendProfileToHost();if(current())toast('Entrou! 🎉 Escolha um hit para sua fila.');}
    catch(err){if(tg07Current(scope)&&!state.emergencyClosing)toast(humanError(err),true);}
  }
  function startMemberVerifier(){
    clearInterval(state.memberVerifier);
    state.memberVerifier=setInterval(async()=>{
      if(state.role!=='guest'||!state.room||!state.client||!navigator.onLine)return;
      const code=state.room.code,scope=tg07Scope();
      try{
        const entries=await callRPC('karaoke_resume_room',{p_code:code});
        if(!tg07Current(scope)||entries?.length)return;
        const lastRoom=state.room?.id;
        let recap=null;
        try{if(tg13Recreational())recap=await callRPC('karaoke_get_party_recap',{p_room:lastRoom});}catch{}
        if(!tg07Current(scope))return;
        const avatars=new Map(state.avatars),nextEpoch=tg07SessionEpoch+1;await stopSession();
        if(state.user?.id!==scope.uid||tg07SessionEpoch!==nextEpoch||state.room)return;
        state.recapAvatars=avatars;
        if(recap){
          localStorage.removeItem('tem-gogo-pending-room');
          history.replaceState(null,'',new URL('./',location.href).href);
          show('landing');showPartyRecap(recap,lastRoom);
        } else {
          forgetInvitation(code);
          showGuestEntry('');
          toast('Este convite não está mais valendo. Leia outro QR ou digite um novo código.',true);
        }
      }catch(err){console.warn('Verificação de acesso adiada:',err.message);}
    },12000);
  }
  function setSyncStatus(mode){
    const label=mode==='live'?'● Ao vivo':mode==='fallback'?'◌ Atualizando a fila':mode==='offline'?'⚠ Sem internet':'◌ Sincronizando';
    for(const id of ['stage-sync-status','guest-sync-status']){
      const el=$(id); if(!el)continue;el.textContent=label;el.dataset.status=mode;
    }
  }
  async function hydrateRoom() {const scope=tg07Scope();await tg83RestoreAvatar();if(!tg07Current(scope))return;await fetchRoom();if(!tg07Current(scope))return;await tg23Start();if(!tg07Current(scope)||state.emergencyBlocked)return;await fetchSongs();if(!tg07Current(scope)||state.emergencyBlocked)return;await fetchMembers();if(!tg07Current(scope)||state.emergencyBlocked)return;await fetchScores();if(!tg07Current(scope)||state.emergencyBlocked)return;renderAll();void fetchRoomHumor();if(state.role==='host')void syncPartyMessages();}
  let tgR15SyncTicket=null;
  async function refreshRoomSnapshot(){
    if(state.emergencyBlocked||state.emergencyClosing||!state.room)return;
    if(Date.now()-state.catalogFetchedAt>45000)void loadCatalog();
    if(tgR15SyncTicket&&tg07Current(tgR15SyncTicket.scope)){state.syncQueued=true;return;}
    const roomId=state.room.id,scope=tg07Scope(),ticket={scope};tgR15SyncTicket=ticket;state.syncRunning=true;
    try{
      await fetchRoom();if(!tg07Current(scope)||state.emergencyBlocked)return;
      await fetchSongs();if(!tg07Current(scope)||state.emergencyBlocked)return;
      await fetchMembers();if(!tg07Current(scope)||state.emergencyBlocked)return;
      await fetchScores();if(!tg07Current(scope)||state.emergencyBlocked)return;
      renderAll();if(state.role==='host')void syncPartyMessages();if(state.role==='host'||state.role==='remote')void fetchRoomHumor();setSyncStatus(navigator.onLine?(state.realtimeOk?'live':'fallback'):'offline');
    }catch(err){if(tgR15SyncTicket===ticket&&tg07Current(scope)){console.warn('Falha ao sincronizar sala:',err);setSyncStatus('offline');}}
    finally{if(tgR15SyncTicket===ticket){tgR15SyncTicket=null;state.syncRunning=false;const queued=state.syncQueued;state.syncQueued=false;if(queued&&tg07Current(scope)&&!state.emergencyBlocked)queueChanged();}}
  }
  function startSyncFallback(){
    clearInterval(state.roomPoller);clearInterval(state.signalPoller);
    state.roomPoller=setInterval(()=>{if(state.room&&navigator.onLine)void refreshRoomSnapshot();},5500);
    state.signalPoller=setInterval(()=>{
      if(state.room&&navigator.onLine&&(state.role==='host'||isPhoneSingerRole())){
        void fetchRecentSignals();void fetchHostDeviceSignals();
      }
    },state.role==='remote'?2000:state.role==='host'?2400:7000);
  }

  async function fetchRoom() {
    if(!state.room)return;const requestedRoom=state.room.id,scope=tg07Scope();
    const {data,error}=await state.client.from('karaoke_rooms').select('id,code,title,owner_id,status,current_song_id,expires_at,room_mode,tg30_battle_reserved')
      .eq('id',requestedRoom).single();
    if(!tg07Current(scope))return;
    if(error)throw error;
    state.room={...state.room,...data};
    tg13ScorePrivacy();
    if(state.role==='host')tg100SyncRoomMode();
    if((isPhoneSingerRole()||state.role==='host')&&!state.finishing&&(data.status!=='open'||new Date(data.expires_at)<new Date())) {
      let recap=null;
      try{if(tg13Recreational())recap=await callRPC('karaoke_get_party_recap',{p_room:requestedRoom});}catch(e){console.warn('Recap convidado:',e);}
      // Não apagar a associação: os participantes podem rever o placar enquanto autorizados.
      if(!tg07Current(scope))return;const avatars=new Map(state.avatars),nextEpoch=tg07SessionEpoch+1;
      await stopSession();if(state.user?.id!==scope.uid||tg07SessionEpoch!==nextEpoch||state.room)return;state.recapAvatars=avatars;localStorage.removeItem('tem-gogo-pending-room');
      history.replaceState(null,'',new URL('./',location.href).href);
      show('landing'); if(recap)showPartyRecap(recap,requestedRoom);else toast('A festa terminou. Até o próximo show! 🎤');
      return;
    }
    const found=state.songs.find(s=>s.id===data.current_song_id);
    if(state.role==='guest') setGuestNowPlaying(found||null);
  }
  async function fetchSongs() {
    if(!state.room||state.emergencyBlocked)return;const requestedRoom=state.room.id,scope=tg07Scope();
    const {data,error}=await state.client.from('karaoke_songs').select('*').eq('room_id',requestedRoom)
      .in('status',['queued','playing']).order('created_at',{ascending:true}).limit(150);
    if(!tg07Current(scope)||state.emergencyBlocked)return;
    if(error)throw error;
    state.songs=data||[];
    // A fila confirmada também encerra chamadas cujo cancelamento não chegou por sinalização.
    if(state.role==='host'&&state.preflight&&!state.preflight.starting&&!state.songs.some(s=>s.id===state.preflight.song.id&&s.status==='queued'))clearHostPreflight();
    if(isPhoneSingerRole()&&state.guestPreflightSong&&!state.songs.some(s=>s.id===state.guestPreflightSong.id&&isSinger(s,state.user?.id))){
      state.guestPreflightSong=null;state.guestReady=false;closeGuestCall();
      if(!isMyTurn()&&(state.localStream||tgR20MicRequest))await stopMicrophone(true);
      if(!tg07Current(scope)||state.emergencyBlocked)return;
      renderGuestPreflight();renderGuestCallVisibility();
    }
    if(isPhoneSingerRole())tg90PaintPhone();
    if(state.role==='remote')renderRemote();
    if(state.role==='guest')setGuestNowPlaying(state.songs.find(s=>s.id===state.room?.current_song_id)||null);
  }
  async function fetchMembers() {
    if(!state.room||state.emergencyBlocked)return;const requestedRoom=state.room.id,scope=tg07Scope();
    const {data,error}=await state.client.from('karaoke_members').select('user_id,display_name,joined_at')
      .eq('room_id',requestedRoom).order('joined_at',{ascending:true});
    if(!tg07Current(scope)||state.emergencyBlocked)return;if(error)throw error;
    state.members=data||[];const own=state.members.find(m=>m.user_id===state.user?.id);if(own&&state.role==='guest')$('guest-display-name').textContent=own.display_name;refreshDuetOptions();
  }
  let tg37ScoreRead=0,tg37ScoreApplied=0;
  async function fetchScores(){
    if(!state.room||state.emergencyBlocked)return;
    if(!tg13Recreational()){tg13ScorePrivacy();return;}
    const roomId=state.room.id,all=[],scope=tg07Scope(),serial=++tg37ScoreRead;
    const current=()=>tg07Current(scope)&&!state.emergencyBlocked&&tg13Recreational()&&serial>=tg37ScoreApplied;
    for(let offset=0;offset<30000;offset+=500){
      const {data,error}=await state.client.from('karaoke_scores').select('*').eq('room_id',roomId).order('created_at',{ascending:false}).range(offset,offset+499);
      if(!current())return;
      if(error)throw error;
      all.push(...(data||[]));if((data||[]).length<500)break;
    }
    if(!current())return;
    tg37ScoreApplied=serial;state.scores=all;
    // D014: metadados de músicas concluídas; a pontuação continua intocada.
    state.songTitleCache=state.songTitleCache||new Map();
    const ids=[...new Set(all.map(row=>row.song_id).filter(Boolean))].filter(id=>!state.songTitleCache.has(String(id)));
    for(let start=0;start<ids.length;start+=80){
      const {data,error}=await state.client.from('karaoke_songs').select('id,title').eq('room_id',roomId).in('id',ids.slice(start,start+80));
      if(!current())return;
      if(!error)(data||[]).forEach(song=>state.songTitleCache.set(String(song.id),String(song.title||'Música')));
    }
    if(!current())return;
    if(state.role==='host')renderStageRanking();
    if(state.role==='guest')renderGuestScore();
    if(state.role==='remote')renderRemote();
  }
  // R37: a cerimônia depende da leitura específica da música, não de um ranking paginado.
  async function tg37ReadFinishedScores(scope,songId){
    const current=()=>tg07Current(scope)&&!state.emergencyBlocked&&tg13Recreational()&&state.currentSong?.id===songId;
    if(!current())return null;
    const {data,error}=await state.client.from('karaoke_scores').select('song_id,user_id,score').eq('room_id',scope.room).eq('song_id',songId).limit(5);
    if(!current())return null;
    if(error)throw error;
    return Array.isArray(data)&&data.length<=4&&data.every(row=>row?.song_id===songId)?data:null;
  }
  function renderGuestScore(){
    if(!tg13Recreational()){tg13ScorePrivacy();return;}
    const el=$('guest-latest-score');if(!el||!state.user)return;
    const last=state.scores.find(row=>row.user_id===state.user.id&&row.score!==null&&row.score!==undefined&&row.score!==''&&Number.isFinite(Number(row.score)));
    el.hidden=!last;if(!last)return;
    const value=Math.max(0,Math.min(100,Math.round(Number(last.score))));
    $('guest-latest-score-value').textContent=value+'/100';
    if(isAnonymous(state.user))$('tg18-account-cta').hidden=false;
    $('guest-latest-score-comment').textContent='Drag Diva: '+(value>=85?'Meu amor, que estrela!':value>=65?'Você entregou espetáculo!':value>=40?'A próxima apresentação promete!':'Coragem também é show. Vamos de bis?');
    if($('tg05-guest-score-avatar'))$('tg05-guest-score-avatar').src=avatarSrc(state.avatar);
  }
  function memberName(userId) {const member=state.members.find(m=>m.user_id===userId);if(member)return member.display_name;if(userId===state.room?.owner_id)return userId===state.user?.id?(localStorage.getItem('tem-gogo-display-name')||'Anfitrião'):'Anfitrião';return 'Artista';}
  let tg07SessionEpoch=0;
  const tg07Scope=()=>({epoch:tg07SessionEpoch,room:state.room?.id,uid:state.user?.id});
  const tg07Current=x=>!!x.room&&!!x.uid&&x.epoch===tg07SessionEpoch&&x.room===state.room?.id&&x.uid===state.user?.id;
  function tg07Partners(partners){
    if(!Array.isArray(partners)||partners.length>3||new Set(partners).size!==partners.length||partners.some(id=>!id||id===state.user?.id||!state.members.some(m=>m.user_id===id)))throw new Error('Os participantes mudaram. Escolha novamente quem vai cantar.');
    if(state.room?.room_mode==='solo'&&partners.length)throw new Error('Na Carreira Solo, cante sozinho neste aparelho.');
    return partners;
  }
  function songSingers(song){return [...new Set([song?.user_id,...(Array.isArray(song?.group_partner_ids)&&song.group_partner_ids.length?song.group_partner_ids:[song?.duet_partner_id])].filter(Boolean))].slice(0,4);}
  function songSingerLabel(song){return songSingers(song).map(memberName).join(' + ')||'Artista';}
  function isSinger(song,uid){return Boolean(uid&&songSingers(song).includes(uid));}
  function preferredPartner(host){
    const el=$(host?'host-duet-partner':'guest-duet-partner');
    if(!el||el.closest('.duet-choice')?.querySelector('input[value="solo"]:checked'))return null;
    const user=el.value;
    if(!user||user===state.user?.id||!state.members.some(m=>m.user_id===user)){
      throw new Error('Escolha uma pessoa da mesma sala para fazer o dueto.');
    }
    return user;
  }
  function refreshDuetOptions(){
    for(const host of [false,true]){
      const el=$(host?'host-duet-partner':'guest-duet-partner');if(!el)continue;
      const previous=el.value;
      const choices=state.members.filter(m=>m.user_id!==state.user?.id);
      el.replaceChildren(new Option(choices.length?'Escolha o outro cantor':'Ainda não há outra pessoa na sala',''));
      for(const m of choices)el.add(new Option(m.display_name,m.user_id));
      if(choices.some(m=>m.user_id===previous))el.value=previous;
      const prefix=host?'host':'guest';const group=$(prefix+'-group-members');
      const selected=new Set([...group.querySelectorAll('input:checked')].map(c=>c.value));
      group.replaceChildren();
      for(const member of choices){
        const label=document.createElement('label');label.className='tg16-group-person tg123-person-item';
        const input=document.createElement('input');input.type='checkbox';input.value=member.user_id;input.checked=selected.has(member.user_id);
        const symbol=document.createElement('span');symbol.className='tg123-person-avatar';
        const key=state.avatars.get(member.user_id);
        if(AVATARS[key]){const img=document.createElement('img');img.src=AVATARS[key];img.alt='';symbol.append(img);}
        else symbol.textContent=String(member.display_name||'?').trim().charAt(0).toUpperCase();
        label.append(input,symbol,document.createTextNode(member.display_name));group.append(label);
      }
    }
  }
  function chosenSingers(host){
    const prefix=host?'host':'guest';
    const mode=document.querySelector('input[name="'+prefix+'-mode"]:checked')?.value||'solo';
    if(mode==='solo'||state.room?.room_mode==='solo')return [];
    if(mode==='duet')return [preferredPartner(host)];
    const root=$(prefix+'-group-members');
    const choices=[...root.querySelectorAll('input[type="checkbox"]:checked')].map(c=>c.value);
    if(choices.length<2||choices.length>3)throw new Error('Para grupos, escolha exatamente 2 ou 3 pessoas além de você (3 a 4 cantores no total).');
    if(new Set(choices).size!==choices.length||choices.includes(state.user?.id)||choices.some(id=>!state.members.some(m=>m.user_id===id)))throw new Error('Escolha pessoas válidas desta festa.');
    return choices;
  }
  function confirmMusicSelection(title,partners){
    return new Promise(resolve=>{
      const dialog=$('tg16-confirm-music');
      $('tg16-confirm-song').textContent=title;
      $('tg16-confirm-people').textContent='Cantam: '+[state.user?.id,...partners].map(memberName).join(' + ');
      let settled=false;function finish(yes){if(settled)return;settled=true;yesBtn.removeEventListener('click',accept);cancelBtn.removeEventListener('click',reject);dialog.removeEventListener('close',closed);if(dialog.open)dialog.close();resolve(yes);}
      const yesBtn=$('tg16-confirm-yes'),cancelBtn=$('tg16-confirm-cancel');
      const accept=()=>finish(true),reject=()=>finish(false),closed=()=>finish(false);
      yesBtn.addEventListener('click',accept);cancelBtn.addEventListener('click',reject);dialog.addEventListener('close',closed);dialog.showModal();
    });
  }
  function chooseGuestSingers(title,initialMode='solo'){
    return new Promise(resolve=>{
      const dialog=$('tg17-singer-dialog');
      if(!dialog){resolve(null);return;}
      $('tg17-selected-track').textContent='🎶 '+title;
      // Reutiliza o diálogo real de seleção, como bottom sheet; sem duplicar a lógica do banco.
      const selection=dialog.querySelector('input[name="guest-mode"][value="'+(['solo','duet','group'].includes(initialMode)?initialMode:'solo')+'"]');
      if(selection)selection.checked=true;
      $('tg17-singer-heading').textContent=initialMode==='group'?'Quem entra no seu grupo?':initialMode==='duet'?'Quem canta com você?':'Quem canta esta música?';
      dialog.querySelectorAll('[data-group-people] input[type="checkbox"]').forEach(el=>el.checked=false);
      refreshDuetOptions();updateGroupChoice(false);
      let done=false;
      const ok=$('tg17-singer-confirm'),cancel=$('tg17-singer-cancel'),cross=$('tg17-singer-cancel-x');
      const cleanup=()=>{ok.removeEventListener('click',accept);cancel.removeEventListener('click',reject);cross.removeEventListener('click',reject);dialog.removeEventListener('close',closed);};
      const finish=value=>{if(done)return;done=true;cleanup();if(dialog.open)dialog.close();resolve(value);};
      const accept=()=>{try{finish(chosenSingers(false));}catch(err){toast(humanError(err),true);}};
      const reject=()=>finish(null),closed=()=>finish(null);
      ok.addEventListener('click',accept);cancel.addEventListener('click',reject);cross.addEventListener('click',reject);dialog.addEventListener('close',closed);
      dialog.showModal();
    });
  }
  async function enqueueSelectedVideo(video,title,host,cardMode=null,cardPartners=null){
    if(state.emergencyBlocked)throw Error('Palco em pausa de segurança.');
    // When chosen from the catalogue, the SAME bottom sheet already contains mode
    // and participants. No second modal can hide the Add button or selections.
    const scope=tg07Scope();if(!tg07Current(scope))throw new Error("Entre em uma festa primeiro.");
    const partners=Array.isArray(cardPartners)?cardPartners:
      (cardMode ? (cardMode==='solo'?[]:await chooseGuestSingers(title,cardMode)) : (host?chosenSingers(true):await chooseGuestSingers(title)));
    if(partners===null)throw new Error('Seleção cancelada. A música não foi adicionada.');
    // Guest already confirmed track, format and singers in the same modal.
    if(host&&!cardMode&&!await confirmMusicSelection(title,partners))throw new Error('Escolha cancelada.');
    if(!tg07Current(scope))throw new Error('A sala mudou. Escolha a música novamente.');
    tg07Partners(partners);
    if(partners.length>=2)return callRPC('karaoke_enqueue_group',{p_room:scope.room,p_video:video,p_title:title,p_partner_ids:partners});
    if(partners.length===1)return callRPC('karaoke_enqueue_duet',{p_room:scope.room,p_video:video,p_title:title,p_partner:partners[0]});
    return callRPC('karaoke_enqueue',{p_room:scope.room,p_video:video,p_title:title});
  }
  function renderAll(){renderQueue();renderMembers();if(state.role==='host'){renderMics();renderStageRanking();renderLiveScore();renderPreflightHost();}}
  function renderMembers(){if(state.role==='host')$('stage-count').textContent=`👥 ${state.members.length+(state.members.some(m=>m.user_id===state.room?.owner_id)?0:1)} na festa`;}
  function renderQueue() {
    const songs=state.songs.filter(s=>s.status==='playing'||s.status==='queued');
    if(state.role==='host') {
      $('queue-counter').textContent=`${songs.filter(s=>s.status==='queued').length} MÚSICAS`;
      $('queue-list').innerHTML=songs.length?songs.map((s,i)=>`<div class="queue-item ${s.status==='playing'?'playing':''}"><div class="queue-num">${s.status==='playing'?'♫':String(i+1).padStart(2,'0')}</div><div class="queue-text"><strong>${escapeHTML(s.title)}</strong><small>${state.room?.room_mode==='solo'?(s.status==='playing'?'● Tocando':'Na sua lista'):(s.status==='playing'?'● Tocando • ':'')+escapeHTML(songSingerLabel(s))}</small></div>${s.status==='queued'?`<span class="queue-actions"><button class="queue-play" type="button" data-play-song="${s.id}" aria-label="Tocar esta música">▶</button><button class="queue-remove" type="button" data-remove-song="${s.id}" aria-label="Remover esta música">✕</button></span>`:'<span class="queue-play">ON</span>'}</div>`).join(''):'<div class="queue-empty">'+(state.room?.room_mode==='solo'?'Escolha sua primeira música. 🎶':'A fila ainda tá vazia. Mostre o QR Code! 🎶')+'</div>';
    }
    if(isPhoneSingerRole()) {
      if(state.role==='remote'){syncGuestTurn(songs.find(s=>s.status==='playing')||null);renderRemote();return;}
      $('guest-queue-list').innerHTML=songs.length?songs.map((s,i)=>`<div class="mobile-queue-item"><span class="number">${s.status==='playing'?'♫':i+1}</span><span class="title"><strong>${escapeHTML(s.title)}</strong><small>${escapeHTML(songSingerLabel(s))}</small></span><span>${s.status==='playing'?'🔊':'🎵'}</span></div>`).join(''):'<p style="color:var(--muted);font-size:13px">Sem músicas ainda. Que tal escolher a primeira? 🎤</p>';
      setGuestNowPlaying(songs.find(s=>s.status==='playing')||null);
      syncGuestTurn(songs.find(s=>s.status==='playing')||null);renderGuestPreflight();
    }
  }
  function setGuestNowPlaying(song){
    $('guest-now-playing').textContent=song?.title || 'O palco tá pronto pra você!';
    $('guest-now-singer').textContent=song?'Com '+songSingerLabel(song):'Escolha um hit no menu Músicas.';
    $('guest-hub-current').textContent=song?song.title:'Aguardando próximo hit';
    const next=state.songs.filter(s=>s.status==='queued').slice(0,2);
    $('guest-hub-next').textContent=next.length?next.map(songSingerLabel).join(' · '):'Fila livre!';
    updateGuestMicLabel();
  }
  function updateGuestMicLabel(){if(state.role!=='guest')return;
    const label=state.localPeer?.connectionState==='connected'?'🟢 Ao vivo na TV':availableMic()?'🟡 Liberado no celular':'🔴 Desligado';
    if($('guest-hub-mic'))$('guest-hub-mic').textContent=label;
    if($('mobile-tab-mic'))$('mobile-tab-mic').classList.toggle('mic-needs-attention',Boolean(state.guestPreflightSong&&!availableMic()));
  }
  function isMyTurn(){return isPhoneSingerRole()&&Boolean(state.user?.id)&&state.songs.some(song=>song.status==='playing'&&isSinger(song,state.user.id));}
  function syncGuestTurn(playing){
    if(state.emergencyBlocked)return;
    if(!isPhoneSingerRole())return;
    const mine=Boolean(playing&&isSinger(playing,state.user?.id));
    document.body.classList.toggle('tg18-singing',mine);state.guestMicLock=mine||Boolean(state.guestPreflightSong);if(mine)closeGuestCall();
    $('your-turn-banner').hidden=!mine;$('mic-turn-kicker').hidden=!mine;
    $('mic-card').classList.toggle('my-turn',mine);
    $('mobile-tab-mic').classList.toggle('turn-highlight',mine);
    // O estado do mic remoto é controlado em renderRemoteMic(), que preserva
    // a seleção manual da aba e memoriza apenas transições automáticas da Diva.
    if(mine){$('your-turn-track').textContent=playing.title;}renderGuestPreflight();renderRemoteMic();
    if(state.lastMySong!==playing?.id){
      const wasMine=Boolean(state.lastMySong);
      state.lastMySong=mine?playing.id:null;
      if(mine){
        if(state.role==='guest')switchMobileTab('mic');
        $('mic-headline').textContent=state.localStream?'Seu mic tá preparado!':'É sua vez, estrela! 🎤';
        $('mic-description').textContent=state.localStream?'Conectando seu som com a TV...':'Toque no microfone e autorize o uso. As barras vão mostrar sua voz de verdade.';
        toast('🎤 É SUA VEZ! A Diva Gogó convocou seu microfone.');
        if(state.localStream){if(state.micActivity?.songId!==playing.id)resetLocalMicActivity(playing.id);if(!state.localPeer)void connectMicToStage();}
        if(navigator.vibrate)navigator.vibrate([100,60,100]);
      }else if(wasMine){
        // Privacidade: ao terminar a apresentação, fecha a captura e a conexão.
        if(state.localStream||tgR20MicRequest)void stopMicrophone(true);
        if(state.role==='guest')switchMobileTab('queue',false);else renderRemoteMic();
        void fetchScores().catch(console.warn);toast('Apresentação encerrada! Confira se sua nota foi confirmada no placar. 👏');
      }
    }
  }
  function drawQR() {
    const holder=$('stage-qr');holder.replaceChildren();
    const hostHolder=$('stage-host-qr');if(hostHolder)hostHolder.replaceChildren();
    if(state.room?.room_mode==='solo')return;
    if(window.QRCode){
      new window.QRCode(holder,{text:currentURL(state.room.code),width:176,height:176,colorDark:'#171023',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
      if(hostHolder){const controlUrl=new URL(currentURL(state.room.code));controlUrl.searchParams.set('remote','1');new window.QRCode(hostHolder,{text:controlUrl.href,width:176,height:176,colorDark:'#171023',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});}
    }
    else {holder.textContent='QR indisponível';if(hostHolder)hostHolder.textContent='QR indisponível';toast('Biblioteca de QR Code não carregou. Compartilhe o código da sala.',true);}
  }
  function queueChanged(){clearTimeout(state.roomReloadTimer);state.roomReloadTimer=setTimeout(()=>{void refreshRoomSnapshot();},180);}
  async function subscribeRoom(){
    if(!state.room)return;
    const uid=state.user.id,scope=tg07Scope();
    const channel=state.client.channel(`tem-gogo-db-${state.room.id}-${uid}`);state.channel=channel;
    const live=()=>tg07Current(scope)&&state.channel===channel&&!state.emergencyBlocked;
    const onQueue=()=>{if(live())queueChanged();};
    channel
      .on('postgres_changes',{event:'*',schema:'public',table:'karaoke_songs',filter:`room_id=eq.${state.room.id}`},onQueue)
      .on('postgres_changes',{event:'*',schema:'public',table:'karaoke_members',filter:`room_id=eq.${state.room.id}`},onQueue)
      .on('postgres_changes',{event:'*',schema:'public',table:'karaoke_rooms',filter:`id=eq.${state.room.id}`},onQueue)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'karaoke_scores',filter:`room_id=eq.${state.room.id}`},onQueue)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'karaoke_signals',filter:`receiver_id=eq.${uid}`},payload=>{if(live())receiveSignal(payload.new);})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'karaoke_host_device_signals',filter:`owner_id=eq.${uid}`},payload=>{if(live())receiveHostDeviceSignal(payload.new);});
    startSyncFallback();setSyncStatus('fallback');
    await new Promise(resolve=>{
      let resolved=false;
      const done=()=>{if(!resolved){resolved=true;resolve();}};
      const timeout=setTimeout(()=>{if(live()){state.realtimeOk=false;setSyncStatus('fallback');}done();},9000);
      channel.subscribe(status=>{
        if(!live()){clearTimeout(timeout);done();return;}
        if(status==='SUBSCRIBED'){
          clearTimeout(timeout);state.realtimeOk=true;setSyncStatus('live');done();
          void refreshRoomSnapshot();void fetchRecentSignals();
        }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
          state.realtimeOk=false;setSyncStatus('fallback');done();
        }
      });
    });
    if(!live())return;await fetchRecentSignals();
    if(!live())return;await fetchHostDeviceSignals();
    if(!live())return;
    if(state.role==='host'){
      state.signalCleaner=setInterval(()=>{callRPC('karaoke_clean_signals',{p_room:state.room?.id}).catch(console.warn);},180000);
    }
  }
  async function fetchRecentSignals(){
    if(!state.room||state.emergencyBlocked)return;const scope=tg07Scope();
    const since=new Date(Date.now()-90000).toISOString();
    const {data,error}=await state.client.from('karaoke_signals').select('*').eq('receiver_id',state.user.id)
      .eq('room_id',state.room.id).gte('created_at',since).order('id',{ascending:true}).limit(70);
    if(!tg07Current(scope)||state.emergencyBlocked)return;
    if(error){console.warn('Inbox:',error);return;}
    (data||[]).forEach(receiveSignal);
  }
  function receiveHostDeviceSignal(record){
    if(!state.room||record.room_id!==state.room.id||record.owner_id!==state.user?.id)return;
    if(!['host','remote'].includes(state.role)||record.receiver_role!==state.role)return;
    if(record.sender_role===state.role||record.payload?._device===state.deviceId)return;
    const signal={...record,id:'device-'+record.id,sender_id:record.owner_id,receiver_id:record.owner_id,_ownerDevice:true};
    receiveSignal(signal);
  }
  async function fetchHostDeviceSignals(){
    if(state.emergencyBlocked||!state.room||!['host','remote'].includes(state.role)||state.room.owner_id!==state.user?.id)return;
    const scope=tg07Scope();
    try{
      const {data,error}=await state.client.from('karaoke_host_device_signals').select('*')
        .eq('room_id',state.room.id).eq('owner_id',state.user.id).eq('receiver_role',state.role)
        .gte('created_at',new Date(Date.now()-95000).toISOString()).order('created_at',{ascending:true}).limit(120);
      if(!tg07Current(scope)||state.emergencyBlocked)return;
      if(error)throw error;
      for(const item of data||[])receiveHostDeviceSignal(item);
    }catch(err){
      if(Date.now()-state.lastDevicePoll>15000){state.lastDevicePoll=Date.now();console.warn('Sincronia host/celular: ',err.message);}
    }
  }
  // C24: a geração é escolhida pelo servidor, nunca pelo relógio do aparelho.
  const tg24GenerationValid=g=>g===null||typeof g==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(g);
  function tg24AcceptSignal(signal){
    return (signal?.payload?._tg30Generation??null)===(state.emergencyGeneration??null);
  }
  function receiveSignal(signal) {
    if(state.emergencyBlocked||!tg24AcceptSignal(signal))return;
    if(!state.room||signal.room_id!==state.room.id)return;
    if(state.processedSignals.has(signal.id))return;
    state.processedSignals.add(signal.id);
    if(state.processedSignals.size>800) state.processedSignals.clear();
    const scope=tg07Scope();state.signalChain=state.signalChain.then(()=>{if(tg07Current(scope)&&!state.emergencyBlocked&&tg24AcceptSignal(signal))return handleSignal(signal);}).catch(err=>console.warn('Sinalização:',err));
  }
  async function sendSignal(to,kind,payload={}) {
    if(state.emergencyBlocked)return;
    if(!state.room||!state.user)return;
    payload={...payload};delete payload._tg30Generation;
    if(state.emergencyGeneration)payload._tg30Generation=state.emergencyGeneration;
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
    }
    const {error}=await state.client.from('karaoke_signals').insert({room_id:state.room.id,sender_id:state.user.id,receiver_id:to,kind,payload});
    if(error)throw error;
  }

  // ----- Audio real-time: cada telefone cria uma conexão ponto a ponto com o anfitrião. -----
  function makePeer(peerId,hostSide=false) {
    const pc=new RTCPeerConnection({iceServers:cfg.ICE_SERVERS||[{urls:'stun:stun.l.google.com:19302'}]});
    const scope=tg07Scope();
    const current=()=>tg07Current(scope)&&!state.emergencyBlocked&&(hostSide?state.peers.get(peerId)?.pc===pc:state.localPeer===pc);
    pc.onicecandidate=ev=>{if(current()&&ev.candidate)sendSignal(peerId,'candidate',ev.candidate.toJSON()).catch(console.warn);};
    pc.onconnectionstatechange=()=>{
      if(!current())return;
      if(hostSide){const item=state.peers.get(peerId);if(item){item.connection=pc.connectionState;renderMics();}}
      else {updateGuestMicState(pc.connectionState);renderRemoteMic();if(['failed','closed'].includes(pc.connectionState)){state.localPeer=null;}}
    };
    if(hostSide) {
      const record={pc,analyser:null,source:null,gain:null,stream:null,connection:'connecting',level:0};
      state.peers.set(peerId,record);
      pc.ontrack=event=>{if(current()&&event.track.kind==='audio')connectIncomingAudio(peerId,event.streams[0]||new MediaStream([event.track]));};
    }
    return pc;
  }
  async function ensureOutputContext() {
    if(!state.context)state.context=new (window.AudioContext||window.webkitAudioContext)();
    return state.context;
  }
  // R88: no separate sound switch. Unlock output on a real local interaction,
  // without touching volume preferences, microphone permissions or playback.
  function unlockSound() {
    if(state.emergencyBlocked||state.emergencyClosing||state.role!=='host'||!state.room||state.room.owner_id!==state.user?.id||$('stage')?.hidden)return;
    try {
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(AudioCtx&&(!state.context||state.context.state==='closed'))state.context=new AudioCtx();
      if(state.context&&state.context.state!=='running')void Promise.resolve(state.context.resume()).catch(()=>{});
    }catch{}
    window.TG74_DIVA_STUDIO?.unlock();
  }
  // One temporary, local browser audio prompt per host session.
  let tg89SoundScope=null,tg89SoundOffered=null;
  function tg89CloseSound(){tg89SoundScope=null;const d=$('tg89-sound-dialog');if(d?.open)d.close();}
  function tg89OfferSound(scope){
    if(!tg38RoomCurrent(scope,'host')||tg89SoundOffered===scope.epoch||state.currentSong||state.room?.current_song_id)return;
    const d=$('tg89-sound-dialog');if(!d||d.open)return;
    if(document.querySelector('dialog[open]')){
      const opened=document.querySelector('dialog[open]');opened.addEventListener('close',()=>{if(tg38RoomCurrent(scope,'host'))tg89OfferSound(scope);},{once:true});return;
    }
    tg89SoundOffered=scope.epoch;tg89SoundScope=scope;
    try{d.showModal();$('tg89-sound-allow')?.focus({preventScroll:true});}catch{tg89SoundScope=null;}
  }
  function tg89AllowSound(){
    const scope=tg89SoundScope;if(!scope||!tg38RoomCurrent(scope,'host')){tg89CloseSound();return;}
    // Run synchronously inside the real click, before closing the prompt.
    unlockSound();tg89CloseSound();
  }
  function tg88StageAudioGesture(event){
    if(!event.isTrusted||document.body.dataset.currentView!=='stage'||document.hidden)return;
    if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
    const target=event.target;
    if(target?.closest?.('#stage-exit,#stage-switch,#logout-button')||document.querySelector('dialog[open]:not(#tg50-drawer):not(#catalog-dialog):not(#settings-dialog)'))return;
    unlockSound();
  }
  async function connectIncomingAudio(uid,stream) {
    if(state.emergencyBlocked)return;
    if(state.role!=='host')return;
    const entry=state.peers.get(uid);if(!entry)return;
    try{
      const ctx=await ensureOutputContext();
      if(state.emergencyBlocked||state.peers.get(uid)!==entry)return;
      if(entry.source){try{entry.source.disconnect();entry.analyser.disconnect();entry.gain.disconnect();}catch{}}
      const source=ctx.createMediaStreamSource(stream);
      const analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.58;
      const gain=ctx.createGain();gain.gain.value=state.masterGain;
      source.connect(analyser);analyser.connect(gain);gain.connect(ctx.destination);
      Object.assign(entry,{source,analyser,gain,stream,connection:'connected'});
      renderMics();showHostCommand();
      if(ctx.state!=='running')toast('🎧 Microfone conectado. Se necessário, toque em um controle do palco para liberar o áudio.');
    }catch(err){console.error(err);toast('Não foi possível preparar o áudio remoto.',true);}
  }
  async function handleSignal(signal) {
    if(state.emergencyBlocked)return;
    if(!state.room)return;
    const scope=tg07Scope(),from=signal.sender_id,data=signal.payload||{};
    if(state.role==='host'){
      if(signal.kind==='host-remote'){if(from===state.room.owner_id&&signal._ownerDevice===true)await handleRemoteCommand(data,signal.created_at);return;}
      if(signal.kind==='stage-recado'){await syncPartyMessages();return;}
      if(signal.kind==='stage-profile'&&AVATARS[data.avatar]){state.avatars.set(from,data.avatar);showHostCommand();renderPreflightHost();return;}
      if(signal.kind==='stage-ready-status'&&state.preflight?.song.id===data.songId&&state.preflight.token===data.token&&isSinger(state.preflight.song,from)){
        if(AVATARS[data.avatar])state.avatars.set(from,data.avatar);
        state.preflight.statuses.set(from,{mic:data.mic===true,ready:data.ready===true&&data.mic===true,at:Date.now()});
        renderPreflightHost();return;
      }
      if(signal.kind==='offer') {
        const singer=state.songs.find(s=>s.status==='playing');
        if(!singer||!isSinger(singer,from)){await sendSignal(from,'notice',{message:'Seu microfone entra ao vivo somente na sua música. Aguarde sua vez. 🎤'});return;}
        const limit=Number(cfg.MAX_ACTIVE_MICS)||8;
        if(!state.peers.has(from)&&state.peers.size>=limit){await sendSignal(from,'notice',{message:`O palco já tem ${limit} microfones. Aguarde alguém sair.`});return;}
        closePeer(from);
        const pc=makePeer(from,true);
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        await flushCandidates(from,pc);
        const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
        if(state.emergencyBlocked||!tg07Current(scope)||state.peers.get(from)?.pc!==pc){pc.close();return;}
        await sendSignal(from,'answer',pc.localDescription.toJSON());renderMics();
      } else if(signal.kind==='candidate') {
        const pc=state.peers.get(from)?.pc;
        if(pc?.remoteDescription){try{await pc.addIceCandidate(new RTCIceCandidate(data));}catch(err){console.warn('ICE remoto:',err);}}
        else bufferCandidate(from,data);
      } else if(signal.kind==='score-ready'){
        if(data.songId===state.currentSong?.id){
          state.scoreReady.set(from,{songId:data.songId,samples:Number(data.samples)||0});
          void fetchMicActivity().then(renderLiveScore);
        }
      } else if(signal.kind==='bye')closePeer(from);
    }else if(isPhoneSingerRole()&&from===state.room.owner_id){
      if(signal.kind==='host-remote-ack'&&state.role==='remote'){
        if(signal._ownerDevice!==true)return;
        tgR14AcceptAck(data);
        return;
      }
      if(signal.kind==='stage-up-next'){await tg90ReceiveUpcoming(data,signal,scope);return;}
      if(signal.kind==='stage-prepare'){
        if(Date.now()-Number(data.sentAt||0)>95000)return;
        if(!state.songs.some(s=>s.id===data.songId&&s.status==='queued'&&isSinger(s,state.user.id)))await fetchSongs();
        if(state.emergencyBlocked||!tg07Current(scope))return;
        if(!state.songs.some(s=>s.id===data.songId&&s.status==='queued'&&isSinger(s,state.user.id)))return;
        if(state.guestPreflightSong?.token!==data.token)state.guestReady=false;
        state.guestPreflightSong={id:data.songId,token:data.token,title:data.title};tg90PhoneNotice=null;tg90PaintPhone();
        renderGuestPreflight();if(state.role==='guest')switchMobileTab('mic');if(!state.guestReady)openGuestCall();await notifyPreflightGuest();renderRemoteMic();return;
      }
      if(signal.kind==='stage-prepare-cancel'&&state.guestPreflightSong?.id===data.songId&&state.guestPreflightSong?.token===data.token){
        state.guestPreflightSong=null;state.guestReady=false;
        if(data.started===true){try{await fetchSongs();}catch(err){console.warn('Início do show:',err);}}
        else if(!isMyTurn()&&state.localStream)void stopMicrophone(true);
        renderGuestPreflight();renderGuestCallVisibility();closeGuestCall();return;
      }
      const pc=state.localPeer;
      if(signal.kind==='answer'&&pc) {await pc.setRemoteDescription(new RTCSessionDescription(data));await flushCandidates(from,pc);}
      else if(signal.kind==='candidate') {
        if(pc?.remoteDescription){try{await pc.addIceCandidate(new RTCIceCandidate(data));}catch(err){console.warn('ICE local:',err);}}
        else bufferCandidate(from,data);
      } else if(signal.kind==='notice') {toast(data.message||'O anfitrião enviou um aviso.',true);await stopMicrophone(false);}
      else if(signal.kind==='score-flush'){
        // Host encerra: confirmar o último lote ANTES do placar final.
        if(state.micActivity?.songId===data.songId){
          void tg30SendShadow(state.micActivity.tg30Shadow,true);
          await flushFinalMicReport();
          await sendSignal(state.room.owner_id,'score-ready',{
            songId:data.songId,samples:state.micActivity?.lastSentSamples||0
          });
          if($('mic-score-sync'))$('mic-score-sync').textContent='🏁 Medições finais entregues para a Diva Gogó!';
        }
      }
      else if(signal.kind==='bye'){await stopMicrophone(false);toast('O anfitrião desconectou este microfone.',true);}
    }
  }
  function bufferCandidate(id,data){const arr=state.candidateBuffer.get(id)||[];if(arr.length<100)arr.push(data);state.candidateBuffer.set(id,arr);}
  async function flushCandidates(id,pc){
    const arr=state.candidateBuffer.get(id)||[];state.candidateBuffer.delete(id);
    for(const candidate of arr){try{await pc.addIceCandidate(new RTCIceCandidate(candidate));}catch(err){console.warn('ICE:',err);}}
  }
  function closePeer(uid){
    const entry=state.peers.get(uid);if(!entry)return;
    try{entry.pc.close();entry.source?.disconnect();entry.analyser?.disconnect();entry.gain?.disconnect();}catch{}
    state.peers.delete(uid);renderMics();
  }
  function openMicPermission(){
    if(state.emergencyBlocked)return;
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
    if(availableMic()){
      const scope=tg07Scope(),stream=state.localStream;
      const yes=callActive()?await window.TG_UI.confirm('Seu microfone está ativo. Desligar agora? O palco deixará de receber sua voz até você ligá-lo novamente.',{title:'Desligar microfone?',confirmText:'Sim, desligar',danger:true}):true;
      if(yes&&tg07Current(scope)&&state.localStream===stream&&!state.emergencyBlocked)await stopMicrophone(true);return;
    }
    openMicPermission();
  }
  let tgR20MicRequest=null;
  const tgR20MicButtons=['mic-toggle','tg18-remote-mic-toggle','tg18-turn-mic','guest-preflight-mic'];
  function tgR20MicPending(pending){for(const id of tgR20MicButtons)if($(id))$(id).disabled=pending;}
  function tgR20CancelMicRequest(){tgR20MicRequest=null;tgR20MicPending(false);}
  async function startMicrophone(){
    if(state.emergencyBlocked||state.emergencyClosing||tgR20MicRequest||state.localStream)return;
    if(!state.room||!isPhoneSingerRole()||!callActive())return;
    if(!navigator.mediaDevices?.getUserMedia){toast('Microfone exige HTTPS (ou localhost) e navegador compatível.',true);return;}
    tg18AbortDictation();const scope=tg07Scope(),btn=$('mic-toggle');
    const activeSong=()=>state.songs.find(s=>s.status==='playing'&&isSinger(s,state.user?.id));
    const ticket={songId:activeSong()?.id??state.guestPreflightSong?.id,token:state.guestPreflightSong?.token};
    tgR20MicRequest=ticket;tgR20MicPending(true);let stream=null;
    const current=()=>tgR20MicRequest===ticket&&tg07Current(scope)&&!state.emergencyBlocked&&!state.emergencyClosing&&isPhoneSingerRole()&&(activeSong()?.id===ticket.songId||(!activeSong()&&state.guestPreflightSong?.id===ticket.songId&&state.guestPreflightSong?.token===ticket.token))&&!$('tg-beta-emergency')?.open;
    try{
      // A permissão real do navegador só é solicitada após um clique explícito.
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:false,autoGainControl:false,channelCount:1},video:false});
      if(!current()||!stream.getAudioTracks().some(t=>t.readyState==='live'&&t.enabled)){stream.getTracks().forEach(t=>t.stop());return;}
      state.localStream=stream;
      stream.getAudioTracks().forEach(track=>track.onended=()=>{if(state.localStream===stream&&tg07Current(scope))void stopMicrophone(true);});
      const ctx=new (window.AudioContext||window.webkitAudioContext)();state.localAudioContext=ctx;
      const analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.65;
      const micSource=ctx.createMediaStreamSource(stream);
      micSource.connect(analyser);state.localAnalyzer=analyser;
      // A pontuação lê a voz ANTES deste ganho; só o áudio enviado à TV é ajustado.
      const sendGain=ctx.createGain();sendGain.gain.value=state.guestMicGain;
      const sendDestination=ctx.createMediaStreamDestination();
      micSource.connect(sendGain);sendGain.connect(sendDestination);
      state.micGainNode=sendGain;state.micSendStream=sendDestination.stream;
      await ctx.resume();
      if(!current()||state.localStream!==stream){if(state.localStream===stream)await stopMicrophone(false);return;}
      btn.classList.add('active');btn.setAttribute('aria-label','Desligar microfone');
      $('mic-headline').textContent=isMyTurn()?'A TV tá te esperando! 🎤':'Seu mic foi autorizado!';
      $('mic-description').textContent=isMyTurn()?'Seu som será enviado ao palco. Confira a conexão e cante!':'Teste o volume aqui. O áudio só será transmitido quando chegar sua música.';
      updateGuestMicState('preview');
      $('mic-capture-state').textContent='🎙️ Microfone ligado • fale ou cante para testar';
      $('mic-volume-title').textContent='NÍVEL DO SOM • CAPTAÇÃO LOCAL';
      if(isMyTurn()){const playing=state.songs.find(s=>s.status==='playing');if(playing)resetLocalMicActivity(playing.id);await connectMicToStage();}
      if(!current()||state.localStream!==stream){if(state.localStream===stream)await stopMicrophone(false);return;}
      if(state.guestPreflightSong){state.guestReady=true;closeGuestCall();toast('✅ Microfone autorizado! A Diva avisou ao anfitrião que você está pronto(a).');}
      renderGuestPreflight();renderRemoteMic();void notifyPreflightGuest();
    }catch(err){if(current()){console.error(err);toast(humanError(err),true);if(!stream||state.localStream===stream)await stopMicrophone(false);}}finally{if(tgR20MicRequest===ticket)tgR20CancelMicRequest();}
  }
  async function connectMicToStage(){
    if(state.emergencyBlocked)return;
    if(!isMyTurn()||!state.localStream||state.localPeer||state.micConnecting)return;
    const scope=tg07Scope();state.micConnecting=true;
    try{
      updateGuestMicState('connecting');
      const pc=makePeer(state.room.owner_id,false);state.localPeer=pc;
      const output=state.micSendStream||state.localStream;
      output.getAudioTracks().forEach(track=>pc.addTrack(track,output));
      const offer=await pc.createOffer();await pc.setLocalDescription(offer);
      if(state.emergencyBlocked||!tg07Current(scope)||state.localPeer!==pc){pc.close();return;}
      await sendSignal(state.room.owner_id,'offer',pc.localDescription.toJSON());
    }catch(err){if(!tg07Current(scope)||state.emergencyBlocked)return;console.warn('Conexão de microfone:',err);try{state.localPeer?.close();}catch{}state.localPeer=null;updateGuestMicState('failed');toast('A TV não recebeu seu microfone. Verifique Wi-Fi/TURN e tente novamente.',true);}
    finally{if(tg07Current(scope))state.micConnecting=false;}
  }
  function updateGuestMicState(connection){
    const badge=$('mic-status');if(!badge)return;
    const text={new:'● Conectando',connecting:'◌ Ligando ao palco',connected:'● PALCO CONECTADO',preview:'◉ Teste local',disconnected:'⚠ Desconectado',failed:'⚠ Falha no palco',closed:'● Desligado'};
    badge.textContent=text[connection]||'● '+connection;
    badge.classList.toggle('active',connection==='connected');
    badge.setAttribute('aria-label',availableMic()?(connection==='connected'?'Microfone ligado e conectado à TV':'Microfone ligado, conexão com a TV ainda não confirmada'):'Microfone desligado');
    badge.dataset.status=connection;
    $('mic-card').classList.toggle('stage-connected',connection==='connected');
    $('mic-card').classList.toggle('tg103-mic-on',availableMic());
    $('mic-card').classList.toggle('tg103-mic-off',!availableMic());
    const statusCard=$('mic-card').querySelector('.tg103-mic-status-banner');
    if(statusCard){statusCard.querySelector('strong').textContent=availableMic()?'MICROFONE LIGADO':'MICROFONE DESLIGADO';statusCard.querySelector('span:last-child').textContent=availableMic()?(connection==='connected'?'Voz conectada ao palco':connection==='failed'||connection==='disconnected'?'Captando no celular, sem conexão com a TV':'Captando no celular · aguardando a TV'):'Toque no microfone para ligar';}
    badge.textContent=availableMic()?(connection==='connected'?'🟢 LIGADO · AO VIVO':connection==='connecting'?'🟢 LIGADO · CONECTANDO':'🟢 LIGADO · CAPTANDO'):'🔴 DESLIGADO';
    if(connection==='failed')toast('WebRTC falhou. Confira a conexão ou configure um servidor TURN.',true);
    if(connection==='disconnected'||connection==='failed'){
      $('mic-capture-state').textContent='⚠ O celular capta, mas não está conectado à TV.';
    }
  }
  async function stopMicrophone(notifyHost=true){
    tgR20CancelMicRequest();
    if(!state.emergencyBlocked&&state.micActivity?.samples>state.micActivity?.lastSentSamples)void syncMicActivity(true);
    if(!state.emergencyBlocked&&state.micActivity?.tg30Shadow)void tg30SendShadow(state.micActivity.tg30Shadow,true);
    if(notifyHost&&state.room&&state.user){sendSignal(state.room.owner_id,'bye').catch(console.warn);}
    try{state.localPeer?.close();}catch{}state.localPeer=null;
    const oldStream=state.localStream,oldOutput=state.micSendStream,oldContext=state.localAudioContext;
    state.localStream=null;state.localAudioContext=null;state.localAnalyzer=null;state.micGainNode=null;state.micSendStream=null;
    for(const stream of [oldStream,oldOutput])for(const track of stream?.getTracks()||[]){track.onended=null;track.stop();}
    try{Promise.resolve(oldContext?.close()).catch(()=>{});}catch{}
    const btn=$('mic-toggle');btn.classList.remove('active','voice-detected');btn.setAttribute('aria-label','Ativar microfone');
    $('mic-card').classList.remove('tg103-mic-on');$('mic-card').classList.add('tg103-mic-off');
    $('mic-headline').textContent=isMyTurn()?'É sua vez! Ative seu microfone 🎤':'Preparado pro seu momento?';
    $('mic-description').textContent='Toque para autorizar o microfone. Antes da sua música, o som fica apenas no celular.';
    $('mic-volume-title').textContent='NÍVEL DO SOM • AGUARDANDO PERMISSÃO';
    $('mic-capture-state').textContent='🔒 Microfone desligado — toque para autorizar';
    state.captureSeen=false;state.micConnecting=false;state.guestReady=false;
    updateGuestMicState('closed');drawMobileLevels(0);renderGuestPreflight();renderRemoteMic();void notifyPreflightGuest();
  }
  function calculateRMS(analyser){
    if(!analyser)return 0;
    const values=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(values);
    let power=0;for(let i=0;i<values.length;i++)power+=values[i]*values[i];
    return Math.sqrt(power/values.length);
  }
  function drawRemoteLevels(value){
    const list=$('tg19-remote-levels')?.children||[];
    const count=Math.round(Math.min(1,value/.12)*list.length);
    Array.from(list).forEach((bar,i)=>{bar.classList.toggle('lit',i<count);bar.style.height=(i<count?Math.min(100,20+value*500+(i%3)*7):10)+'%';});
  }
  function drawMobileLevels(value){
    const bars=$('guest-levels')?.children||[];
    const count=Math.round(Math.min(1,value/.12)*bars.length);
    Array.from(bars).forEach((bar,i)=>{
      const active=i<count;bar.classList.toggle('lit',active);
      bar.style.height=(active?Math.min(100,18+Math.max(0,value)*490+(i%3)*7):8)+'%';
    });
    const capturing=Boolean(state.localStream&&value>.017);
    $('mic-toggle').classList.toggle('voice-detected',capturing);
    if(capturing!==state.captureSeen){
      state.captureSeen=capturing;
      $('mic-capture-state').textContent=!state.localStream?'🔒 Microfone desligado':capturing?'🎵 VOZ CAPTADA NO CELULAR! Confira também o estado da TV e da pontuação.':'🎙️ Microfone ligado • fale ou cante para testar';
      $('mic-volume-title').textContent=capturing?'NÍVEL DO SOM • RECEBENDO ÁUDIO':'NÍVEL DO SOM • SEM ÁUDIO DETECTADO';
    }
  }
  function liveScore(stat,frames){
    if(!stat||frames<=0||stat.sung<=0)return 0;
    const participation=Math.min(1,stat.sung/frames);
    const volume=Math.min(1,stat.intensity/stat.sung);
    return Math.max(0,Math.min(100,Math.round((participation*.72+volume*.28)*100)));
  }
  function renderMics(){
    if(state.role!=='host')return;
    const entries=[...state.peers.entries()];
    // Exibe também cantores com participação sincronizada, mesmo se a voz WebRTC falhar.
    for(const uid of songSingers(state.currentSong)){
      if(!state.peers.has(uid))
        entries.push([uid,{level:0,connection:state.cloudMicStats.has(uid)?'cloud':'waiting'}]);
    }
    const audioCount=entries.filter(([_,m])=>m.connection==='connected').length;
    const cloudCount=entries.filter(([_,m])=>m.connection==='cloud').length;
    $('active-mic-count').textContent=tg13Recreational()?`${audioCount} voz(es) na TV • ${songSingers(state.currentSong).filter(id=>state.cloudMicStats.get(id)?.samples>=8).length} nota(s) sincronizada(s)`:`${audioCount} voz(es) na TV • avaliação reservada`;
    $('mic-list').innerHTML=entries.length?entries.map(([uid,record])=>{
      const status=tg13Recreational()?scoreForSinger(uid):null;const score=status?.score;
      return `<div class="mic-person"><div class="mic-person-top"><span>🎙️ ${escapeHTML(memberName(uid))}</span><b>${!tg13Recreational()?'Sinal do microfone':score==null?'Aguardando sinal':score+' pts'}</b></div><div class="mic-level"><span id="meter-${uid}" style="width:${Math.min(100,record.level*800)}%"></span></div><small style="display:block;margin-top:7px;color:var(--muted);font-size:10px">${escapeHTML(record.connection==='connected'?'● Áudio ao vivo na TV':record.connection==='cloud'?'☁ Sinal recebido do celular • áudio da TV sem conexão':record.connection==='failed'?'⚠ Áudio não chegou à TV':'○ Conectando...' )}</small></div>`;
    }).join(''):'<div class="mic-empty">Quando alguém ativar o microfone, aparece aqui. ✨</div>';
    renderLiveScore();showHostCommand();
  }
  function sampleAudio(){
    sampleSoloMic();
    if(isPhoneSingerRole()&&state.localAnalyzer){const rms=calculateRMS(state.localAnalyzer);drawMobileLevels(rms);collectLocalMicActivity(rms);if(state.role==='remote'){drawRemoteLevels(rms);if(((state.remoteMicTick=(state.remoteMicTick||0)+1)%14===0))renderRemoteMic();}}
    if(state.role!=='host')return;
    if(state.isPlaying&&state.currentSong)state.songFrames=(state.songFrames||0)+1;
    state.peers.forEach((entry,uid)=>{
      const rms=calculateRMS(entry.analyser);entry.level=rms;
      const meter=document.getElementById('meter-'+uid);if(meter)meter.style.width=Math.min(100,rms*800)+'%';
      // Apenas volume para visualização no palco, sem criar notas aqui.
      // Todas as notas nascem das amostras agregadas reportadas pelo CELULAR.

    });
  }

  // ---- Pontuação resiliente: relatório de atividade vocal do celular via Supabase.
  // O sinal local não substitui o som WebRTC na TV; é apenas um respaldo para a nota.
  // Experimental profile is frozen in memory per room/song/cantor, including reconnects.
  const tg30VoiceSnapshots=new Map();
  function tg30ShadowFor(songId){
    const key=[state.room?.id,state.user?.id,songId].join(':');
    if(!tg30VoiceSnapshots.has(key)){
      if(tg30VoiceSnapshots.size>=20)tg30VoiceSnapshots.delete(tg30VoiceSnapshots.keys().next().value);
      const allowed=tg13Recreational()&&window.TG30VoiceUI?.enabled()&&['classic','solo'].includes(state.room?.room_mode)&&window.TG30VoiceShadow;
      let a=null;
      try{if(allowed&&typeof crypto.randomUUID==='function')a=window.TG30VoiceShadow.make(window.TG30VoiceUI.current(),crypto.randomUUID());}catch{/* Optional experiment never blocks official mic. */}
      if(a){a.roomId=state.room.id;a.songId=songId;a.uid=state.user.id;}
      tg30VoiceSnapshots.set(key,a);
    }
    return tg30VoiceSnapshots.get(key);
  }
  function tg30ShadowAllowed(a){return tg13Recreational()&&!!a&&!a.disabled&&window.TG30VoiceUI?.enabled()&&state.room?.id===a.roomId&&state.user?.id===a.uid;}
  async function tg30SendShadow(a,force=false){
    if(state.emergencyBlocked)return false;
    if(!tg30ShadowAllowed(a))return false;
    try{return await window.TG30VoiceShadow.sync(a,p=>callRPC('tg30_voice_shadow_report',{p_room:a.roomId,p_song:a.songId,...p}),performance.now(),force);}catch{return false;}
  }
  function tg30CollectShadow(a,analyser,rate,now){
    if(!tg30ShadowAllowed(a))return;
    try{if(window.TG30VoiceShadow.sample(a,analyser,rate,now))void tg30SendShadow(a);}catch{/* preserve V1 */}
  }
  function tg30RevokeShadow(){for(const a of tg30VoiceSnapshots.values())if(a)a.disabled=true;}
  function resetLocalMicActivity(songId){
    state.micActivity={songId, samples:0,vocalSamples:0,intensitySum:0,
      lastSampleAt:0,lastSentSamples:0,lastSyncAt:0,lastAttemptAt:0,
      tg30Shadow:tg30ShadowFor(songId)};
  }
  function collectLocalMicActivity(rms){
    if(!isPhoneSingerRole()||!state.localStream||!isMyTurn())return;
    const song=state.songs.find(s=>s.status==='playing');if(!song)return;
    if(state.micActivity?.songId!==song.id)resetLocalMicActivity(song.id);
    const a=state.micActivity;const now=performance.now();
    if(now-a.lastSampleAt<250)return;
    a.lastSampleAt=now;
    a.samples++;
    tg30CollectShadow(a.tg30Shadow,state.localAnalyzer,state.localAudioContext?.sampleRate,now);
    if(rms>.012){a.vocalSamples++;a.intensitySum+=Math.round(Math.min(1,(rms-.012)/.085)*1000);}
    if(now-a.lastAttemptAt>2300&&a.samples>a.lastSentSamples)void syncMicActivity();
  }
  async function syncMicActivity(force=false){
    if(state.emergencyBlocked)return;
    const a=state.micActivity;
    if(!a||!state.room||!isPhoneSingerRole()||state.micActivitySyncing||a.samples<=a.lastSentSamples)return;
    const now=performance.now();if(!force&&now-a.lastAttemptAt<2100)return;
    a.lastAttemptAt=now;state.micActivitySyncing=true;
    try{
      const sent={p_room:state.room.id,p_song:a.songId,p_samples:a.samples,p_vocal_samples:a.vocalSamples,p_intensity_sum:a.intensitySum};
      const saved=await callRPC('karaoke_report_mic_activity',sent);
      if(saved&&!state.emergencyBlocked&&state.micActivity===a){a.lastSentSamples=sent.p_samples;a.lastSyncAt=Date.now();
        const label=$('mic-score-sync');if(label)label.textContent='✅ Dados do microfone enviados • aguardando placar do palco';
      }
    }catch(err){
      console.warn('Não foi possível sincronizar os dados de pontuação:',err.message);
      const label=$('mic-score-sync');if(!state.emergencyBlocked&&state.micActivity===a&&label)label.textContent='⚠ Pontuação sem sincronização. Confira a internet ou atualize o banco.';
    }finally{state.micActivitySyncing=false;}
  }
  async function flushFinalMicReport(){
    // Evita dupla chamada simultânea: aguarda a requisição periódica terminar.
    for(let i=0;i<25&&state.micActivitySyncing;i++)await wait(120);
    if(state.micActivity?.samples>state.micActivity?.lastSentSamples)await syncMicActivity(true);
    for(let i=0;i<25&&state.micActivitySyncing;i++)await wait(120);
  }
  async function awaitSingersLastMicReport(song){
    const scope=tg07Scope(),current=()=>tg07Current(scope)&&!state.emergencyBlocked&&state.currentSong?.id===song.id;
    const singers=songSingers(song);
    if(!singers.length||!current())return;
    // Solicita captura de dados finais; não solicita gravações de voz.
    await Promise.allSettled(singers.map(uid=>sendSignal(uid,'score-flush',{songId:song.id})));
    const start=Date.now();
    while(current()&&Date.now()-start<5200){
      await fetchMicActivity();
      if(!current())return;
      // Os microfones que confirmaram entrega podem ser pontuados com as amostras atualizadas.
      const expected=singers.filter(uid=>state.peers.has(uid)||state.cloudMicStats.has(uid));
      if(expected.length&&expected.every(uid=>state.scoreReady.get(uid)?.songId===song.id))break;
      await wait(650);
    }
    if(current())await fetchMicActivity();
  }
  let tg37MicRead=0,tg37MicApplied=0;
  async function fetchMicActivity(){
    if(!state.room||state.emergencyBlocked)return;
    const requestedRoom=state.room.id,scope=tg07Scope(),serial=++tg37MicRead;
    const song=state.currentSong||state.songs.find(s=>s.status==='playing');
    if(!song)return;
    const {data,error}=await state.client.from('karaoke_mic_activity')
      .select('user_id,samples,vocal_samples,intensity_sum')
      .eq('room_id',requestedRoom).eq('song_id',song.id);
    if(!tg07Current(scope)||state.emergencyBlocked||state.currentSong?.id!==song.id||serial<tg37MicApplied)return;
    if(error){console.warn('Pontuação sincronizada indisponível:',error.message);return;}
    if(!Array.isArray(data))return;
    tg37MicApplied=serial;
    state.cloudMicStats=new Map(data.map(x=>[x.user_id,x]));
    renderLiveScore();
  }
  function scoreForSinger(uid){
    if(!state.currentSong)return null;
    // Nunca use microfone do notebook nem amostras do WebRTC para pontuar.
    // WebRTC transporta apenas o som dos celulares para as caixas do palco.
    const frames=state.songFrames||0;
    const report=tgR25SoloReport;
    if(state.room?.room_mode==='solo'&&uid===state.user?.id){
      if(!tgR25SoloAllowed(report)||report.samples<8)return null;
      const observedSeconds=Math.max(1,Number((frames*.14).toFixed(2)));
      const sungSeconds=Math.min(observedSeconds,report.vocal*.25);
      const volume=report.vocal?Math.min(1,report.intensity/(report.vocal*1000)):0;
      return {score:Math.round(Math.min(100,72*sungSeconds/observedSeconds+28*volume)),sungSeconds,observedSeconds,source:'microfone solo (Supabase)'};
    }
    const solo=state.soloMic;
    if(uid===state.user?.id&&solo?.songId===state.currentSong?.id&&solo.samples>=8){
      const observedSeconds=Math.max(1,(state.songFrames||0)*.14);
      const sungSeconds=Math.min(observedSeconds,solo.vocal*.25);
      const volume=solo.vocal?Math.min(1,solo.volume/solo.vocal):0;
      return {score:Math.round(Math.min(100,(sungSeconds/observedSeconds)*72+volume*28)),sungSeconds,observedSeconds,source:'microfone solo local'};
    }
    const cloud=state.cloudMicStats.get(uid);
    if(frames<=0 || !cloud || Number(cloud.samples)<8)return null;
    const observedSeconds=frames*.14;
    if(observedSeconds<1)return null;
    const sungSeconds=Math.min(observedSeconds,Math.max(0,Number(cloud.vocal_samples)||0)*.25);
    const volume=Number(cloud.vocal_samples)>0
      ?Math.min(1,Math.max(0,Number(cloud.intensity_sum)||0)/(Number(cloud.vocal_samples)*1000)):0;
    const score=Math.round(Math.min(100,Math.max(0,(sungSeconds/observedSeconds)*72+volume*28)));
    return {score,sungSeconds,observedSeconds,source:'somente celular (Supabase)'};
  }
  // ----- YouTube e avaliação de atividade vocal (não de afinação). -----
  function loadYouTubeAPI(){
    if(window.YT?.Player){state.playerAPIReady=true;return Promise.resolve();}
    if(loadYouTubeAPI.promise)return loadYouTubeAPI.promise;
    loadYouTubeAPI.promise=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('O YouTube não respondeu. Confira o bloqueador de conteúdo e a rede.')),18000);
      window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);state.playerAPIReady=true;resolve();};
      const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timeout);reject(new Error('Não foi possível carregar o player do YouTube.'));};
      document.head.append(script);
    });
    return loadYouTubeAPI.promise;
  }
  // A Edge Function valida disponibilidade antes de tocar ou aceitar links manuais.
  // Mesmo uma resposta positiva não é garantia: a política do YouTube pode mudar.
  async function checkVideoAvailability(videoId){
    if(!state.client || !state.room)throw new Error('Entre na festa primeiro.');
    const {data,error}=await state.client.functions.invoke('youtube-search',{
      body:{action:'check',videoId,roomId:state.room.id,roomCode:state.room.code}
    });
    if(error){
      let msg='Não foi possível consultar a verificação no Supabase. Você pode tentar adicionar o link mesmo assim.';
      try{const body=await error.context?.json?.();if(body?.error)msg=body.error;}catch{}
      throw new Error(msg);
    }
    if(data?.error)throw new Error(data.error);
    return typeof data?.playable === "boolean" ? data.playable : null;
  }
  function showVideoError(message,song=null){
    state.isPlaying=false;
    state.failedVideoSong=song||state.currentSong||null;
    $('video-error-text').textContent=message;
    if(!$('video-error-dialog').open)$('video-error-dialog').showModal();
    toast('Vídeo bloqueado. Escolha outra versão ou pule sem pontuar.',true);
    if(state.failedVideoSong?.id&&tg13Recreational())void window.TG74_DIVA_STUDIO?.announce('video_indisponivel','video:'+state.room.id+':'+state.failedVideoSong.id);
  }
  async function skipFailedVideo(){
    $('video-error-dialog').close();
    const failed=state.failedVideoSong;
    if(failed&&state.role==='host'&&state.currentSong?.id!==failed.id){
      // Vídeo novo recusado antes da troca: preserve o vídeo que já estava tocando.
      try{await callRPC('karaoke_remove_song',{p_room:state.room.id,p_song:failed.id});await fetchSongs();renderQueue();toast('Versão indisponível removida. O show atual continua!');}
      catch(err){toast(humanError(err),true);}
    }else if(state.currentSong){await advanceSong();}
    else if(failed&&state.role==='host'){
      try{await callRPC('karaoke_remove_song',{p_room:state.room.id,p_song:failed.id});await advanceSong();}
      catch(err){toast(humanError(err),true);}
    }
    state.failedVideoSong=null;
  }
  function tg25DiscardPlayer(){
    const old=state.player;state.player=null;state.playerReady=false;state.playerSongId=null;
    try{old?.mute();}catch{}try{old?.destroy();}catch{}
    const frame=$('video-frame');if(frame){$('youtube-player')?.remove();const node=document.createElement('div');node.id='youtube-player';node.className='youtube-player';frame.prepend(node);}
  }
  async function ensurePlayer(id,songId) {
    const scope=tg07Scope();await loadYouTubeAPI();
    if(state.emergencyBlocked||!tg07Current(scope)||state.currentSong?.id!==songId)throw Error('Palco suspenso ou apresentação alterada.');
    if(state.playerSongId!==songId)tg25DiscardPlayer();
    state.playerSongId=songId;
    if(state.playerReady&&state.player)return state.player;
    if(state.player)return new Promise((resolve,reject)=>{const start=Date.now();const it=setInterval(()=>{if(state.emergencyBlocked||!tg07Current(scope)||state.currentSong?.id!==songId||state.playerSongId!==songId||Date.now()-start>14000){clearInterval(it);reject(Error('Player indisponível ou sessão alterada.'));}else if(state.playerReady){clearInterval(it);resolve(state.player);}},50);});
    return new Promise((resolve,reject)=>{
      const valid=e=>!state.emergencyBlocked&&tg07Current(scope)&&state.currentSong?.id===songId&&state.playerSongId===songId&&e.target===state.player;
      const timeout=setTimeout(()=>{if(state.playerSongId===songId&&tg07Current(scope))tg25DiscardPlayer();reject(new Error('O player de vídeo não carregou.'));},14000);
      state.player=new window.YT.Player('youtube-player',{
        videoId:id,playerVars:{playsinline:1,controls:1,rel:0,origin:location.origin,cc_load_policy:0},
        events:{onReady:e=>{clearTimeout(timeout);if(!valid(e)){try{e.target.mute();e.target.destroy();}catch{}reject(Error('Palco suspenso ou apresentação alterada.'));return;}state.playerReady=true;try{e.target.setVolume(state.playbackVolume);}catch{}resolve(e.target);},onStateChange:e=>{if(valid(e))onPlayerState(e);},
          onError:e=>{if(!valid(e))return;const codes={2:'Link inválido.',5:'Este vídeo não pôde ser reproduzido no player.',100:'Vídeo removido ou privado.',101:'O dono ou detentor dos direitos bloqueou a incorporação.',150:'O dono ou detentor dos direitos bloqueou a incorporação.'};showVideoError(codes[e.data]||'O YouTube recusou este vídeo.');},
          onAutoplayBlocked:e=>{if(valid(e))toast('O navegador bloqueou o início automático. Clique em “Reproduzir”.');}}
      });
    });
  }
  function onPlayerState(event) {
    if(state.role!=='host')return;
    if(state.emergencyBlocked||event.target!==state.player||!state.currentSong||state.playerSongId!==state.currentSong.id){try{event.target?.mute();}catch{}return;}
    state.isPlaying=event.data===window.YT.PlayerState.PLAYING;if(!state.isPlaying)tg90ClearHost();
    if(!state.isPlaying && state.playMetrics){state.playMetrics.lastPosition=null;state.playMetrics.lastWall=0;}
    if(state.isPlaying && $('video-error-dialog').open)$('video-error-dialog').close();
    $('play-pause').textContent=state.isPlaying?'⏸ Pausar':'▶ Reproduzir';
    if(event.data===window.YT.PlayerState.ENDED&&!state.finishing&&state.currentSong)finishSong(false);
  }
  function resetSongMetrics(){tgR25ClearSoloReport();state.micStats=new Map();state.cloudMicStats=new Map();state.scoreReady=new Map();state.songFrames=0;state.isPlaying=false;state.playMetrics=null;}
  function setNowPlaying(song){
    $('now-title').textContent=song?.title||'O palco tá esperando você! 🎶';
    $('now-by').textContent=song?'Com '+songSingerLabel(song):'Adicione a primeira música pelo celular ou pelo painel.';
    $('song-pill').textContent=song?'✦ Faça barulho!':'✦ Prontos para o show?';
    $('video-placeholder').hidden=!!song;setDivaStageState(song?'playing':(state.preflight?'preflight':'idle'));
  }
  async function startSong(song) {
    if(state.emergencyBlocked)return;
    if(!song||state.role!=='host'||state.finishing)return;
    const scope=tg07Scope(),generation=state.emergencyGeneration??null;
    if(state.startingSong)return;
    const startTicket={};state.startingSong=startTicket;window.TG74_DIVA_STUDIO?.stop();
    try {
      // Valide ANTES de remover a música anterior da tela ou marcar a nova como em reprodução.
      let playable=null;
      try{playable=await checkVideoAvailability(song.video_id);}
      catch(err){toast('Não foi possível pré-verificar o YouTube. Vou tentar reproduzir normalmente; se falhar, trocamos o vídeo.',true);}
      if(state.emergencyBlocked||!tg07Current(scope))return;
      if(playable===false){showVideoError('Este vídeo não está liberado para reprodução incorporada no Brasil. Escolha outra versão.',song);return;}
      if(state.currentSong){await finishSong(true,false);if(state.currentSong||!tg07Current(scope)||state.emergencyBlocked)return;}
      window.TG74_DIVA_STUDIO?.stop();
      const startRoom=state.room?.id,startUid=state.user?.id;await fetchRoom();
      if(state.emergencyBlocked||!tg07Current(scope))return;
      if(!state.room||state.room.id!==startRoom||state.user?.id!==startUid||typeof state.room.tg30_battle_reserved!=='boolean')throw Error('Não foi possível confirmar a modalidade da sala.');
      if(state.room.current_song_id)throw Error('Já existe uma apresentação ativa no servidor.');
      await callRPC('tg30_start_song_bound',{p_room:scope.room,p_song:song.id,p_generation:generation});
      if(state.emergencyBlocked||!tg07Current(scope))return;
      window.TG74_DIVA_STUDIO?.stop();
      state.currentSong={...song,status:'playing'};state.room.current_song_id=song.id;
      hideGuestRecado();
      resetSongMetrics();state.playMetrics={songId:song.id, played:0, lastPosition:null, lastWall:0, duration:0, sent:false, sending:false};setNowPlaying(song);hideFinal();updateVoxLine('singing');
      if('speechSynthesis' in window)try{window.speechSynthesis.cancel();}catch{}
      const player=await ensurePlayer(song.video_id,song.id);
      if(state.emergencyBlocked||!tg07Current(scope)||state.currentSong?.id!==song.id||state.player!==player)return;
      player.setVolume(state.playbackVolume);player.loadVideoById(song.video_id);renderMics();queueChanged();
    }catch(err){if(tg07Current(scope)&&!state.emergencyBlocked)toast('Não foi possível tocar: '+humanError(err),true);}
    finally{if(state.startingSong===startTicket)state.startingSong=null;}
  }
  async function resumeExistingSong(){
    if(state.emergencyBlocked)return;
    const song=state.songs.find(s=>s.id===state.room?.current_song_id);
    if(!song)return;
    state.currentSong=song;setNowPlaying(song);resetSongMetrics();state.playMetrics={songId:song.id,played:0,lastPosition:null,lastWall:0,duration:0,sent:false,sending:false};
    const scope=tg07Scope();try {const player=await ensurePlayer(song.video_id,song.id);if(state.emergencyBlocked||!tg07Current(scope)||state.currentSong?.id!==song.id||state.player!==player)return;player.cueVideoById(song.video_id);toast('Música recuperada. Clique em Reproduzir para continuar.');}
    catch(err){toast(humanError(err),true);}
  }
  function tgBetaStageAvatars(singers,mode){
    const el=$(mode==='preflight'?'tg-beta-stage-avatars':'tg-beta-result-avatars');if(!el)return;
    el.replaceChildren();for(const uid of singers.slice(0,4)){
      const card=document.createElement('div');card.className='tg-beta-stage-artist';
      const img=document.createElement('img');img.src=avatarForMember(uid);img.alt='Avatar original do cantor';
      const name=document.createElement('strong');name.textContent=memberName(uid);card.append(img,name);el.append(card);
    }
  }
  function getScoreResults(){
    return songSingers(state.currentSong).map(uid=>{
      const result=scoreForSinger(uid);
      if(!result)return null; // Sem dados: nunca invente nota zero.
      return {user_id:uid,score:result.score,
        sung_seconds:Number(result.sungSeconds.toFixed(2)),
        observed_seconds:Number(result.observedSeconds.toFixed(2))};
    }).filter(Boolean);
  }
  function showPerformanceResults(results,singers){
    if(!tg13Recreational()){tg13ScorePrivacy();return;}
    $('final-overlay').dataset.phase='revealed';$('final-overlay').querySelector('.tg05-result-wait').hidden=true;$('final-overlay').querySelector('.tg05-result-reveal').hidden=false;
    if(!results.length){
      clearGif();$('final-overlay').hidden=false;setDivaStageState('result');$('tg192-result-tier').textContent='SEM DADOS DE MICROFONE';$('final-overlay').dataset.verdict='missing';
      $('final-meme').textContent='';$('final-person').textContent=singers.map(memberName).join(' + ')||'Artista';
      $('final-number').innerHTML='—<span>/100</span>';
      $('final-stars').textContent='Sem avaliação';$('final-stars').setAttribute('aria-label','Sem avaliação disponível');
      $('final-caption').textContent='A voz pode ter sido captada no celular, mas não chegou ao placar. Confira a conexão e a sincronização antes de tentar novamente.';
      tgBetaStageAvatars(singers,'result');
      $('final-duet-details').hidden=true;
      return;
    }
    const mean=Math.round(results.reduce((total,r)=>total+r.score,0)/results.length);
    showFinal({score:mean,user_id:results[0].user_id});
    $('final-person').textContent=singers.map(memberName).join(' + ');
    tgBetaStageAvatars(singers,'result');
    const detail=$('final-duet-details');
    if(singers.length>1){
      detail.hidden=false;
      detail.replaceChildren();
      for(const uid of singers){
        const result=results.find(r=>r.user_id===uid);
        const entry=document.createElement('div');entry.className='duet-result-line';
        entry.textContent=memberName(uid)+' • '+(result?result.score+' pontos':'Sem sinal para avaliação');
        detail.append(entry);
      }
      $('final-caption').textContent=results.length===singers.length?'Média das notas individuais. '+tg05ResultPhrase(mean):'Nota parcial das vozes com sinal. Nem todos tiveram dados suficientes para avaliação.';
    }else detail.hidden=true;
  }
  /* Um veredito bem brasileiro. Os textos são originais, sem copiar falas de artistas. */
  const memes=[
    {max:19,icon:'🫠',query:'dramatic shocked reaction',
      familia:['A gente veio pela coragem e ficou pelo espetáculo!','Aplausos pra quem se jogou de coração!'],
      debochado:['O microfone pediu demissão, mona!','O compositor ouviu e solicitou direito de resposta!','O importante é que você não deixou o medo cantar!'],
      caos:['MEU DEUS! CHAMEM O RESGATE DO REFRÃO!','O microfone quer uma medida protetiva contra esse agudo!']},
    {max:39,icon:'🐸',query:'funny confused shocked meme',
      familia:['O talento pegou trânsito, mas sua coragem chegou!','O refrão escapou, mas coragem não faltou!'],
      debochado:['Foi conceito. Ninguém entendeu, mas foi!','Essa versão veio direto de um universo paralelo!','A música original tá perguntando o que aconteceu!'],
      caos:['O JÚRI DESMAIOU E FOI PARAR NA FILA DO SUS!','GENTE, O TOM DA MÚSICA FUGIU DO PAÍS!']},
    {max:59,icon:'🤡',query:'funny applause reaction',
      familia:['Você fez o seu show e a gente amou a energia!','Foi divertido e cheio de personalidade!'],
      debochado:['A afinação? Mistério. O entretenimento? ENTREGUE!','A carreira tá pronta. A música ainda tá em reunião!','O importante é que teve coragem e muito carão!'],
      caos:['ISSO NÃO FOI UMA NOTA, FOI UMA REVELAÇÃO!','PAREM AS MÁQUINAS! ALGUÉM TÁ DIVANDO FORA DO TOM!']},
    {max:79,icon:'💃',query:'dance party celebration reaction',
      familia:['Mandou bem demais! Queremos bis!','Que alegria! A plateia já é seu fã-clube!'],
      debochado:['Avisa que nasceu uma subcelebridade!','Já pode cantar na festa da firma com cachê!','Foi hit, foi close, foi praticamente uma turnê!'],
      caos:['O BRASIL ACORDOU COM UMA NOVA ESTRELA!','DIVOU TANTO QUE O PALCO PEDIU ARREGO!']},
    {max:94,icon:'🔥',query:'diva standing ovation celebration',
      familia:['Que apresentação maravilhosa!','Tá com cara de artista de verdade!'],
      debochado:['Já pode anunciar a turnê pelo Brasil!','Vou abrir uma produtora só pra te agenciar!','Uma diva dessas e o povo pagando streaming?'],
      caos:['CHAMEM A IMPRENSA! A LENDA NASCEU!','TIREM AS CRIANÇAS DA SALA: TEM ESTRELA DEMAIS!']},
    {max:100,icon:'👑',query:'queen crown celebration confetti',
      familia:['Uma lenda da nossa festa! Parabéns!','Você é a grande estrela da noite!'],
      debochado:['ALÔ, GLOBO? TEMOS UMA NOVA ESTRELA!','Beyoncé, pode liberar a agenda: chegou concorrência!','O BRASIL INTEIRO PAROU PRA TE OUVIR!'],
      caos:['PAREM TUDO! A PRÓXIMA TEMPORADA TEM PROTAGONISTA!','EU NÃO TÔ BEM! DEU 100! CHAMEM UM CAMINHÃO DE CONFETE!']}
  ];
  function selectedMeme(score){return memes.find(m=>score<=m.max)||memes[memes.length-1];}
  // Comentários por faixa: família nunca recebe shade, mesmo em notas baixas.
  function tg05ResultPhrase(score){
    const tier=score<20?0:score<40?1:score<60?2:score<80?3:score<95?4:5;
    const mode=state.humorMode;
    const extra={lgbt:[['O glitter chegou antes da nota, amor!','O close veio, falta o bis!'],['A passarela veio antes do hit!','Foi conceito, agora bora de bis!'],['Babado em construção!','O close já tá encaminhado!'],['Serviu brilho!','Que energia, amor!'],['Pisa menos, estrela!','A pista é sua!'],['Coroa e glitter, meu amor!','O palco virou passarela!']],reality:[['O júri quer uma nova chance de show.','Corta pro confessionário!'],['A produção pede um bis!','A edição salvou o carão!'],['Tem potencial no próximo episódio.','O júri quer ver mais!'],['A bancada aprovou a energia!','O episódio ganhou seu destaque!'],['A plateia pediu final de temporada!','O júri aplaudiu!'],['Protagonista da temporada!','A edição coroou seu show!']],bafao:[['A produção pede outro capítulo!','O grupo já quer um bis!'],['O babado ficou pela metade!','O próximo hit promete!'],['Tá começando o close!','Ainda tem muito show pela frente!'],['O grupo da festa tá comentando!','Que close gostoso!'],['Chama a produção, virou notícia!','O babado foi grande!'],['O grupo entrou em colapso de alegria!','O palco virou manchete!']]};
    const pool=extra[mode]?.[tier]||memes[tier][mode]||memes[tier].debochado;const choices=pool.filter(line=>line!==tg05ResultPhrase.last);const line=choices[Math.floor(Math.random()*choices.length)]||pool[0];tg05ResultPhrase.last=line;return line;
  }
  function tg05BeginResult(singers){
    const overlay=$('final-overlay');clearGif();overlay.dataset.phase='announcing';overlay.dataset.verdict='pending';overlay.querySelector('.tg05-result-wait').hidden=false;overlay.querySelector('.tg05-result-reveal').hidden=true;
    tgBetaStageAvatars(singers,'result');$('final-number').textContent='—';$('final-stars').textContent='';$('final-caption').textContent='';$('final-person').textContent='';$('final-duet-details').hidden=true;
    $('tg05-result-narration').textContent='Segura o glitter! A nota já vem.';
    overlay.hidden=false;setDivaStageState('result');
  }
  function clearGif(){
    state.reactionToken++;
    const img=$('final-gif');img.removeAttribute('src');img.hidden=true;
    $('gif-powered').hidden=true;$('final-meme').hidden=false;
    $('final-reaction').classList.remove('has-gif');
  }
  function trustedGiphyMedia(uri){
    try{
      const parsed=new URL(uri);
      return parsed.protocol==='https:' && /(^|\.)giphy\.com$/.test(parsed.hostname) ? parsed.href : null;
    }catch{return null;}
  }
  async function fetchReactionGIF(query,token){
    const apiKey=String(cfg.GIPHY_API_KEY||'').trim();
    if(!apiKey||!state.gifsEnabled||!navigator.onLine)return;
    try{
      const url=new URL('https://api.giphy.com/v1/gifs/search');
      url.searchParams.set('api_key',apiKey);
      url.searchParams.set('q',query);
      url.searchParams.set('limit','12');
      url.searchParams.set('rating','g');
      url.searchParams.set('lang','pt');
      const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),7000);
      let resp;
      try{resp=await fetch(url.toString(),{signal:abort.signal,cache:'no-store'});}finally{clearTimeout(timer);}
      if(!resp.ok)throw new Error(`GIPHY ${resp.status}`);
      const data=await resp.json();
      if(token!==state.reactionToken || $('final-overlay').hidden)return;
      const entries=(Array.isArray(data.data)?data.data:[]).filter(item=>item.images?.fixed_height?.webp || item.images?.downsized?.url);
      if(!entries.length)return;
      const item=entries[Math.floor(Math.random()*entries.length)];
      const uri=trustedGiphyMedia(item.images?.fixed_height?.webp || item.images?.downsized?.url);
      if(!uri)return;
      const img=$('final-gif');
      img.onload=()=>{if(token!==state.reactionToken || $('final-overlay').hidden)return;img.hidden=false;$('final-meme').hidden=true;$('final-reaction').classList.add('has-gif');$('gif-powered').hidden=false;};
      img.onerror=()=>{if(token!==state.reactionToken)return;img.hidden=true;$('final-meme').hidden=false;};
      img.alt='GIF de reação: '+String(item.title||'celebração ou meme').slice(0,110);
      img.src=uri;
    }catch(err){console.warn('GIPHY indisponível; usando meme local:',err.message);}
  }
  function showFinal(result){
    if(!tg13Recreational()){tg13ScorePrivacy();return;}
    const value=Math.max(0,Math.min(100,Math.round(Number(result?.score)||0)));
    const meme=selectedMeme(value);
    const verdict=value<40?(state.humorMode==='familia'?'VAMOS TENTAR DE NOVO':'A DIVA NÃO PERDOOU'):value<60?'A DIVA QUER BIS (COM ENSAIO)':value<80?'A DIVA APROVOU':value<95?'A DIVA APLAUDIU DE PÉ':'A DIVA COROOU';
    $('tg192-result-tier').textContent=verdict;
    $('final-overlay').dataset.phase='revealed';$('final-overlay').querySelector('.tg05-result-wait').hidden=true;$('final-overlay').querySelector('.tg05-result-reveal').hidden=false;$('final-overlay').dataset.verdict=value<40?'shade':value<60?'tease':value<80?'good':value<95?'great':'legend';
    clearGif();
    $('final-meme').textContent='';
    $('final-person').textContent=memberName(result?.user_id);
    $('final-number').innerHTML=`${value}<span>/100</span>`;
    const stars=Math.ceil(value/20);
    $('final-stars').textContent='★'.repeat(stars)+'☆'.repeat(5-stars);
    $('final-stars').setAttribute('aria-label',`${stars} de cinco estrelas`);
    $('final-caption').textContent=tg05ResultPhrase(value);
    $('final-overlay').hidden=false;setDivaStageState('result');
    if(value>=60)confetti();
    const token=state.reactionToken;
    void fetchReactionGIF(meme.query,token);
  }
  function hideFinal(){if($('final-overlay')&&!$('final-overlay').hidden)window.TG74_DIVA_STUDIO?.stop();clearTimeout(state.scoreOverlayTimer);clearTimeout(window.__tg123PostScoreTimer);if($('tg123-post-score'))$('tg123-post-score').hidden=true;clearGif();$('final-overlay').hidden=true;}
  async function finishSong(skipped=false,showResults=true){
    if(state.emergencyBlocked)return;
    if(!state.currentSong||state.finishing)return;
    const completedRoom=state.room?.id,completedSong=state.currentSong.id,finishScope=tg07Scope(),generation=state.emergencyGeneration??null;
    state.finishing=true;tg90ClearHost();tgR19CancelSoloRequest();
    try {
      if(!skipped&&state.soloMic?.songId===completedSong)void tg30SendShadow(state.soloMic.tg30Shadow,true);
      if(!skipped){
        showDivaBubble('Segura o glitter, que eu estou conferindo o placar desta cantoria!','🏆');
        if(state.room?.room_mode==='solo'&&tg13Recreational()){
          state.isPlaying=false;tgR25SoloRetry=completedSong;stopSoloMic();
          if(!await tgR25FlushSolo(tgR25SoloReport)){
            if(tg07Current(finishScope)&&!state.emergencyBlocked){$('play-pause').textContent='↻ Tentar finalizar';toast('Não foi possível confirmar as amostras Solo. Toque em Tentar finalizar quando a conexão voltar.',true);}
            return;
          }
        }else{await fetchMembers();if(!tg07Current(finishScope)||state.currentSong?.id!==completedSong)return;await awaitSingersLastMicReport(state.currentSong);}
      }
      if(!tg07Current(finishScope)||state.emergencyBlocked||state.currentSong?.id!==completedSong)return;
      const singers=songSingers(state.currentSong);
      const results=skipped?[]:getScoreResults();
      await callRPC('tg30_finish_song_bound',{p_room:completedRoom,p_song:completedSong,p_generation:generation,p_skipped:skipped,p_results:results});
      if(!tg07Current(finishScope)||state.currentSong?.id!==completedSong)return;
      state.isPlaying=false;let verifiedRows=null;
      if(!skipped&&tg13Recreational()){
        try{verifiedRows=await tg37ReadFinishedScores(finishScope,completedSong);}catch(e){console.warn('Confirmação da apresentação:',e);}
        if(tg07Current(finishScope)&&!state.emergencyBlocked)void fetchScores().catch(e=>console.warn('Atualização do ranking:',e));
      }
      if(!tg07Current(finishScope)||state.currentSong?.id!==completedSong)return;
      if(skipped){try{state.player?.stopVideo();}catch{}}
      state.currentSong=null;state.playMetrics=null;state.room.current_song_id=null;tgR25ClearSoloReport();
      // D001: pontuação registrada ANTES de liberar o microfone solo.
      if(state.soloMic)stopSoloMic();
      // Privacidade: feche os microfones ao fim do show.
      for(const uid of [...state.peers.keys()]){void sendSignal(uid,'bye').catch(console.warn);closePeer(uid);}
      if(!skipped&&showResults&&!tg13Recreational()){
        tg13ScorePrivacy();setNowPlaying(null);showDivaBubble('Apresentação concluída. Consulte o festival para a apuração.','🎤');
      }
      if(!skipped&&showResults&&tg13Recreational()){
        // A tela cheia da central permanece: a pontuação faz parte da experiência completa.
        updateVoxLine('ending');
        const studio=window.TG74_DIVA_STUDIO;
        const eventKey=completedRoom+':'+completedSong;
        const decision=verifiedRows!==null?window.TG30DivaResult?.decide(completedSong,singers,results,verifiedRows):null;
        const stillCurrent=()=>tg07Current(finishScope)&&!state.emergencyBlocked&&state.role==='host'&&tg13Recreational()&&!state.currentSong&&!state.preflight&&!$('final-overlay').hidden;
        tg05BeginResult(singers);
        if(studio&&decision){
          const spoken=await studio.announce(decision.event,'resultado:'+eventKey,completedSong);
          await studio.waitForCaption?.();if(!stillCurrent())return;
          if(!spoken&&decision.count)await studio.pop('suspense','suspense:'+eventKey);
          if(!stillCurrent())return;
          // Elogio publicado só antes de revelar, com todas as notas altas e verificadas.
          if(decision.count===singers.length){const values=verifiedRows.map(row=>row.score);const reaction=decision.praise?'elogio':state.humorMode==='familia'?null:values.every(v=>v<40)?'nota_baixa':values.every(v=>v>=40&&v<80)?'nota_media':null;if(reaction){await studio.announce(reaction,reaction+':'+eventKey,completedSong);await studio.waitForCaption?.();}}
        }
        // Mesmo quando o áudio está desligado, dê tempo à apresentação textual antes da nota.
        await new Promise(resolve=>setTimeout(resolve,1200));
        if(!stillCurrent())return;
        if(decision){showPerformanceResults(results,singers);}
        else {
          // Não apresentar estimativa local como nota confirmada quando a leitura falha/diverge.
          showPerformanceResults([],singers);$('final-overlay').dataset.verdict='pending';
          $('tg192-result-tier').textContent='AGUARDANDO SINCRONIZAÇÃO';
          $('final-caption').textContent='O resultado ainda não foi confirmado nesta tela. Consulte o placar após a sincronização. Nenhuma nota foi inventada.';
        }
        // R67: reação contextual somente com resultado completo confirmado; nunca por falta de sinal.
        if(decision?.count===singers.length&&studio&&stillCurrent()){
          const values=verifiedRows.map(row=>row.score),mean=values.reduce((a,b)=>a+b,0)/values.length;
          const effect=values.every(v=>v>=95)?'celebration':decision.praise?'palmas':state.humorMode==='familia'?null:mean<40?'low':mean<60?'mid':null;
          if(effect)void studio.pop(effect,'reveal:'+eventKey);
        }
        // Nota permanece visível; painel de próximas ações aparece depois, sem avançar sozinho.
        const nextMenu=$('tg123-post-score');if(nextMenu)nextMenu.hidden=true;
        state.scoreOverlayTimer=setTimeout(()=>{
          if(!tg07Current(finishScope)||state.role!=='host'||$('final-overlay')?.hidden)return;
          hideFinal();setNowPlaying(null);if(nextMenu){nextMenu.hidden=false;clearTimeout(window.__tg123PostScoreTimer);window.__tg123PostScoreTimer=setTimeout(()=>{nextMenu.hidden=true;},12000);}
        },16500);
      }
      $('play-pause').textContent='▶ Reproduzir';queueChanged();
    }catch(err){if(tg07Current(finishScope)){if(tgR25SoloRetry===completedSong&&!state.emergencyBlocked)$('play-pause').textContent='↻ Tentar finalizar';toast('Falha ao finalizar música: '+humanError(err),true);}}
    finally{if(tg07Current(finishScope))state.finishing=false;}
  }
  let tgR13AdvanceConfirmation=null;
  async function advanceSong(options={}){
    if(state.emergencyBlocked||state.role!=='host')return false;
    if(recadoShowing){toast('Feche ou aguarde o recado do intervalo.');return false;}
    if(state.finishing||state.startingSong||state.preflight?.starting){toast('Aguarde a apresentação atual.');return false;}
    const scope=tg07Scope(),expected=state.currentSong?.id??null;
    if(Object.hasOwn(options,'expectedSongId')&&options.expectedSongId!==expected)return false;
    if(expected&&!options.remoteConfirmed){
      if(tgR13AdvanceConfirmation&&tg07Current(tgR13AdvanceConfirmation))return false;
      tgR13AdvanceConfirmation=scope;
      try{if(!await window.TG_UI.confirm('Pular esta apresentação? Ela será encerrada sem nota.',{title:'Pular música',confirmText:'Pular apresentação',danger:true}))return false;}
      finally{if(tgR13AdvanceConfirmation===scope)tgR13AdvanceConfirmation=null;}
    }
    if(state.emergencyBlocked||!tg07Current(scope)||state.finishing||state.startingSong||state.preflight?.starting||(state.currentSong?.id??null)!==expected)return false;
    window.TG74_DIVA_STUDIO?.stop();
    if($('tg123-post-score'))$('tg123-post-score').hidden=true;
    hideFinal();
    if(state.currentSong){await finishSong(true,false);if(state.currentSong||state.emergencyBlocked||!tg07Current(scope))return false;}
    if(state.role==='host'&&pendingGuestRecados.length){
      if(showNextGuestRecado(()=>advanceSong()))return true;
    }
    await fetchSongs();if(state.emergencyBlocked||!tg07Current(scope)||state.currentSong||state.startingSong||state.preflight?.starting)return false;renderQueue();
    const next=state.songs.find(s=>s.status==='queued');
    if(next){updateVoxLine('queue');await prepareSong(next);return tg07Current(scope)&&!state.emergencyBlocked&&state.preflight?.song.id===next.id;}
    setNowPlaying(null);toast('A fila acabou! Hora de escolher outro hit. 🎶');return true;
  }
  async function togglePlayback(){
    if(state.emergencyBlocked)return;
    if(!state.currentSong){await advanceSong();return;}
    if(state.finishing)return;
    if(tgR25SoloRetry===state.currentSong.id){await finishSong(false,true);return;}
    if(!state.playerReady){toast('O vídeo ainda está carregando.',true);return;}
    if(state.isPlaying)state.player.pauseVideo();else state.player.playVideo();
  }
  // Biblioteca colaborativa: somente tempo REAL tocando. Saltos/seek, pausas e buffering
  // não aumentam o contador. Cada instância de música entra no histórico no máximo 1 vez.
  async function recordQualifyingPlayback(metrics){
    if(state.emergencyBlocked)return;
    if(!state.room || !state.currentSong || state.currentSong.id!==metrics.songId || metrics.sent || metrics.sending)return;
    metrics.sending=true;
    try{
      await callRPC('karaoke_confirm_playback',{
        p_room:state.room.id,p_song:metrics.songId,
        p_played_seconds:Math.floor(metrics.played),p_duration_seconds:Math.ceil(metrics.duration)
      });
      metrics.sent=true;
      void loadCatalog(true);
      toast('⭐ Este vídeo entrou nos candidatos da Biblioteca para análise da Central!');
    }catch(error){
      // Pode falhar por atraso no servidor ou RPC ainda não instalada; não insistir a cada segundo.
      console.warn('Histórico de reprodução:',error?.message||error);
      metrics.sent=true;
    }finally{metrics.sending=false;}
  }
  function measureActualPlayback(position,duration){
    const m=state.playMetrics;
    if(!m || m.sent || !state.currentSong || m.songId!==state.currentSong.id)return;
    const now=performance.now();
    if(!Number.isFinite(position)||!Number.isFinite(duration)||duration<40||duration>9000)return;
    if(!state.isPlaying){m.lastPosition=null;m.lastWall=now;return;}
    if(m.lastPosition!==null && m.lastWall>0){
      const realSeconds=(now-m.lastWall)/1000;
      const mediaDelta=position-m.lastPosition;
      // No padrão 1x, tolerar pequenas variações do player. Pulos não contam.
      if(realSeconds>0 && realSeconds<4 && mediaDelta>0 && mediaDelta<=Math.max(2.2,realSeconds*1.5)){
        m.played+=Math.min(mediaDelta,realSeconds*1.5);
      }
    }
    m.duration=duration;m.lastWall=now;m.lastPosition=position;
    if(Math.floor(m.played)>=Math.ceil(Math.ceil(duration)*0.5) && !m.sending)void recordQualifyingPlayback(m);
  }
  // R90: informational heads-up only. No preflight, permission, playback or scoring writes.
  let tg90Upcoming=null,tg90PhoneNotice=null,tg90LastVibration=null;
  function tg90NextRecreational(){
    return tg13Recreational()?state.songs.find(s=>s.status==='queued'&&s.id!==state.currentSong?.id):null;
  }
  function tg90Card(id,heading='',detail=''){
    const box=$(id);if(!box)return;
    if(heading){const h=box.querySelector('strong'),p=box.querySelector('small');if(h.textContent!==heading)h.textContent=heading;if(p.textContent!==detail)p.textContent=detail;}
    box.hidden=!heading;
  }
  function tg90ResetUpcoming(){
    tg90Upcoming=null;tg90PhoneNotice=null;tg90LastVibration=null;
    tg90Card('tg90-stage-next');tg90Card('tg90-phone-next');tg90Card('tg90-remote-next');
  }
  function tg90HostNotice(next,playing,visible){
    if(!next||!playing)return;
    const ids=songSingers(next),scope=tg07Scope();
    for(const uid of ids){
      if(uid===state.user?.id&&state.room?.room_mode==='solo')continue;
      void sendSignal(uid,'stage-up-next',{currentSongId:playing.id,nextSongId:next.id,visible,sentAt:Date.now()})
        .catch(err=>{if(tg07Current(scope))console.debug('Aviso antecipado indisponível:',err?.code||'sinalização');});
    }
  }
  function tg90ClearHost(notify=true){
    const old=tg90Upcoming;tg90Upcoming=null;tg90Card('tg90-stage-next');
    if(notify&&old?.next&&tg07Current(old.scope)&&!state.emergencyBlocked)tg90HostNotice(old.next,old.playing,false);
  }
  function tg90UpdateHost(current,duration){
    const remaining=duration-current,playing=state.currentSong;
    if(state.emergencyBlocked||state.role!=='host'||!state.isPlaying||state.finishing||state.startingSong||state.preflight||!playing||state.playerSongId!==playing.id||!Number.isFinite(current)||!Number.isFinite(duration)||duration<=0||current<0||remaining<=0||remaining>30){
      tg90ClearHost();return;
    }
    const next=tg90NextRecreational(),competitive=state.room?.tg30_battle_reserved===true;
    if(!next&&!competitive){tg90ClearHost();return;}
    const key=playing.id+':'+(next?.id||'competitive');
    if(tg90Upcoming?.key!==key){
      tg90ClearHost();tg90Upcoming={key,next,playing,scope:tg07Scope()};
      if(next)tg90HostNotice(next,playing,true);
    }
    if(competitive)tg90Card('tg90-stage-next','Próxima etapa em breve','Competidores: aguardem a confirmação do próximo confronto.');
    else tg90Card('tg90-stage-next',state.room?.room_mode==='solo'?'Seu próximo hit':'A seguir · '+songSingerLabel(next),next.title+' · prepare-se');
  }
  function tg90PaintPhone(){
    const n=tg90PhoneNotice,valid=n&&tg07Current(n.scope)&&!state.emergencyBlocked&&isPhoneSingerRole()&&!callActive()&&Date.now()-n.sentAt<=40000&&state.songs.some(s=>s.id===n.currentSongId&&s.status==='playing')&&state.songs.find(s=>s.status==='queued')?.id===n.nextSongId;
    const next=valid?state.songs.find(s=>s.id===n.nextSongId&&isSinger(s,state.user?.id)):null;
    if(!next)tg90PhoneNotice=null;
    tg90Card('tg90-phone-next',next&&state.role==='guest'?'Sua vez está chegando!':'',next?.title||'');
    tg90Card('tg90-remote-next',next&&state.role==='remote'?'Sua vez está chegando!':'',next?.title||'');
  }
  async function tg90ReceiveUpcoming(data,signal,scope){
    if(state.role==='remote'&&signal._ownerDevice!==true)return;
    if(!tg13Recreational()||typeof data.visible!=='boolean'||typeof data.currentSongId!=='string'||typeof data.nextSongId!=='string'||data.currentSongId===data.nextSongId)return;
    const age=Date.now()-Number(data.sentAt);if(!Number.isFinite(age)||age< -5000||age>40000)return;
    if(!data.visible){if(tg90PhoneNotice?.currentSongId===data.currentSongId&&tg90PhoneNotice?.nextSongId===data.nextSongId){tg90PhoneNotice=null;tg90PaintPhone();}return;}
    if(callActive())return;
    if(!state.songs.some(s=>s.id===data.nextSongId&&s.status==='queued'&&isSinger(s,state.user?.id)))await fetchSongs();
    if(!tg07Current(scope)||state.emergencyBlocked||callActive())return;
    tg90PhoneNotice={scope,currentSongId:data.currentSongId,nextSongId:data.nextSongId,sentAt:Number(data.sentAt)};tg90PaintPhone();
    const key=data.currentSongId+':'+data.nextSongId;if(tg90PhoneNotice&&tg90LastVibration!==key){tg90LastVibration=key;try{navigator.vibrate?.(100);}catch{}}
  }
  function updateVideoProgress(){
    if(state.role!=='host'||!state.playerReady||!state.currentSong){if(state.role==='host')tg90ClearHost();$('time-now').textContent='0:00';$('time-all').textContent='0:00';$('progress-fill').style.width='0%';return;}
    try{const current=state.player.getCurrentTime(),duration=state.player.getDuration();$('time-now').textContent=formatTime(current);$('time-all').textContent=formatTime(duration);$('progress-fill').style.width=duration?Math.min(100,current/duration*100)+'%':'0%';measureActualPlayback(current,duration);tg90UpdateHost(current,duration);}catch{tg90ClearHost();}
  }

  // ----- Fila de músicas e busca opcional pela API oficial do YouTube. -----
  async function enqueue(form,host){
    if(state.emergencyBlocked)return;
    if(!checkBackend()||!state.room)return;
    const input=$(host?'host-url':'guest-video-url');
    const title=$(host?'host-song-title':'guest-song-title');
    const scope=tg07Scope();
    const video=youtubeId(input.value);
    if(!video){toast('Cole um link válido de vídeo do YouTube.',true);return;}
    const button=form.querySelector('[type=submit]');if(button.disabled)return;setLoading(button,true,'Entrando na fila...');
    try{
      let playable=null;
      try{playable=await checkVideoAvailability(video);}
      catch{toast('Não consegui verificar o link agora. Vou adicioná-lo, mas pode haver restrição de reprodução.',true);}
      if(playable===false)throw new Error('Este link não permite reprodução incorporada no Brasil. Procure outra versão.');
      if(!tg07Current(scope))return;
      await enqueueSelectedVideo(video,title.value.trim(),host);
      if(!tg07Current(scope))return;
      input.value='';title.value='';await fetchSongs();renderQueue();
      if(host && $('song-dialog').open)$('song-dialog').close();
      toast('Música adicionada! Agora é só ensaiar o refrão. 🎶');
    }catch(err){toast(humanError(err),true);}finally{setLoading(button,false);}
  }
  // A pesquisa externa usa Edge Function autenticada e segredo SerpApi no Supabase.
  // Nunca abrir outra aba nem exigir colar um URL quando a busca estiver habilitada.

// Catálogo coletivo: sugestões da playlist + reproduções confirmadas.
// RLS da migração 008 permite apenas SELECT a usuários autenticados (inclusive convidados da sala).
// Consultas do acervo nunca chamam a SerpApi.
const CATALOG_PAGE_SIZE = 18;
function normalizedMusic(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function wordNear(a,b){
  if(!a||!b)return false;
  if(b.length>=3&&b.includes(a))return true;
  if(b.length>=4&&a.includes(b)&&b.length/a.length>=.65)return true;
  // Corrige pequenos erros de digitação sem mostrar resultados completamente diferentes.
  if(a.length<4||Math.abs(a.length-b.length)>2)return false;
  const max=a.length>=5?2:1;
  const previous=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let last=previous[0];previous[0]=i;
    let rowMin=previous[0];
    for(let j=1;j<=b.length;j++){
      const old=previous[j];
      previous[j]=Math.min(previous[j]+1,previous[j-1]+1,last+(a[i-1]===b[j-1]?0:1));
      last=old;rowMin=Math.min(rowMin,previous[j]);
    }
    if(rowMin>max)return false;
  }
  return previous[b.length]<=max;
}
function matchesMusic(item,query){
  const tokens=normalizedMusic(query).split(' ').filter(Boolean);
  if(!tokens.length)return true;
  const title=normalizedMusic(item.title),words=title.split(' ');
  return tokens.every(token=>title.includes(token)||words.some(word=>wordNear(token,word)));
}
// R26: favoritos privados, independentes do catálogo oficial e do ranking.
let tg26Favorites={uid:null,items:new Map(),status:'idle',pending:null,writes:new Set()};
function tg36FavoriteIdentity(user){return user?.id&&!isAnonymous(user)?user.id:null;}
function tg26FavoriteAccount(){return tg36FavoriteIdentity(state.user);}
function tg36ClearFavoriteIdentity(){
  tg26Favorites={uid:null,items:new Map(),status:'idle',pending:null,writes:new Set()};
  if(state.catalogFilter==='favorites'){state.catalogFilter='all';state.catalogPage=1;const filter=$('catalog-filter');if(filter)filter.value='all';$('catalog-list')?.replaceChildren();if($('catalog-total'))$('catalog-total').textContent='';if($('catalog-more'))$('catalog-more').hidden=true;}
  for(const b of document.querySelectorAll('[data-tg26-favorite]')){b.hidden=true;b.disabled=true;b.textContent='♡';b.setAttribute('aria-pressed','false');}
}
function tg26FavoriteState(){const uid=tg26FavoriteAccount();if(tg26Favorites.uid!==uid)tg26Favorites={uid,items:new Map(),status:'idle',pending:null,writes:new Set()};return tg26Favorites;}
function tg26FavoritePaint(){
  const f=tg26FavoriteState(),opt=$('catalog-favorites-option'),status=$('tg26-favorite-status');
  if(opt){opt.hidden=!f.uid;opt.disabled=!f.uid;}
  if(status)status.textContent=!f.uid?'':f.status==='loading'?'Carregando favoritos…':f.status==='error'?'Favoritos indisponíveis. Atualize para tentar novamente.':'';
  const refresh=$('tg26-favorite-refresh');if(refresh){refresh.hidden=!f.uid||f.status==='ready';refresh.disabled=f.status==='loading'||f.writes.size>0;}const quick=$('tg28-favorites-quick');if(quick){quick.hidden=!f.uid;quick.setAttribute('aria-pressed',String(state.catalogFilter==='favorites'));}
  for(const b of document.querySelectorAll('[data-tg26-favorite]')){
    const id=b.dataset.tg26Favorite,on=f.items.has(id);b.hidden=!f.uid||b.dataset.tg26Uid!==f.uid;b.disabled=f.status!=='ready'||f.writes.has(id);b.textContent=on?'♥':'♡';b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',(on?'Remover dos favoritos: ':'Favoritar: ')+b.dataset.title);b.title=on?'Remover favorito':'Salvar favorito';
  }
}
async function tg26LoadFavorites(force=false){
  const f=tg26FavoriteState();if(!f.uid||!state.client){tg26FavoritePaint();return false;}if(f.pending)return f.pending;if(f.writes.size)return false;if(!force&&f.status==='ready')return true;if(!force&&f.status==='error')return false;
  f.status='loading';tg26FavoritePaint();
  const job=Promise.resolve().then(async()=>{try{
    if(tg26FavoriteState()!==f)return false;
    const data=await callRPC('tg26_favorites_list',{});if(tg26FavoriteState()!==f)return false;
    if(!Array.isArray(data)||data.some(x=>!x||typeof x.video_id!=='string'||!/^[A-Za-z0-9_-]{11}$/.test(x.video_id)||typeof x.title!=='string'))throw Error('Lista inválida');f.items=new Map(data.map(x=>[x.video_id,x.title]));f.status='ready';return true;
  }catch{if(tg26FavoriteState()===f)f.status='error';return false;}finally{if(tg26FavoriteState()===f){f.pending=null;tg26FavoritePaint();if($('catalog-dialog')?.open&&state.catalogFilter==='favorites')renderFullCatalog();}}});f.pending=job;return job;
}
async function tg26ToggleFavorite(item,origin){
  const f=tg26FavoriteState(),id=youtubeId(item.video_id);if(!f.uid||origin!==f||!id||f.status!=='ready'||f.writes.has(id)||f.pending)return;
  const save=!f.items.has(id);f.writes.add(id);tg26FavoritePaint();
  try{const data=await callRPC('tg26_favorite_set',{p_video:id,p_title:String(item.title).slice(0,200),p_saved:save});if(tg26FavoriteState()!==f)return;if(data!==save)throw Error('Não confirmado');if(save)f.items.set(id,item.title);else f.items.delete(id);toast(save?'Karaokê salvo nos favoritos.':'Karaokê removido dos favoritos.');}
  catch{if(tg26FavoriteState()===f){f.status='error';toast('Não foi possível confirmar o favorito. Atualize a lista antes de tentar novamente.',true);}}
  finally{f.writes.delete(id);if(tg26FavoriteState()===f){tg26FavoritePaint();if($('catalog-dialog')?.open&&state.catalogFilter==='favorites')renderFullCatalog();}}
}
// R27: capa gráfica por classificação oficial, nunca por inferência do título.
const tg27Covers=Object.freeze({pop:'pop',rock:'rock',funk:'funk',sertanejo:'sertanejo',pagode:'pagode-samba',samba:'pagode-samba',forro:'forro',rap:'rap-trap',mpb:'mpb',internacional:'internacional',outros:'outras'});
const tg27ExtraIcons=Object.freeze({reggae:'🌿',eletronica:'🎛️',axe:'☀️',infantil:'🎈'});
// R66: taxonomia pública homologada; não excluir músicas do acervo.
const tg66AllowedGenre=g=>g&&typeof g.code==='string'&&g.code.toLowerCase()!=='gospel';
function tg27Genre(item){
 const official=(state.catalogGenres||[]).find(g=>tg66AllowedGenre(g)&&g.code===item?.genre);
 const code=official?.code||'outros';
 return {code,label:code==='outros'?'Outras':String(official.label||code),cover:Object.hasOwn(tg27Covers,code)?tg27Covers[code]:null};
}
function tg27Cover(item){
 const genre=tg27Genre(item),cover=document.createElement('div');cover.className='tg27-genre-cover';cover.dataset.genre=genre.code;cover.setAttribute('aria-hidden','true');
 const fallback=document.createElement('span');fallback.className='tg27-genre-fallback';const icon=document.createElement('span');icon.textContent=Object.hasOwn(tg27ExtraIcons,genre.code)?tg27ExtraIcons[genre.code]:'♫';const label=document.createElement('b');label.textContent=genre.label;fallback.append(icon,label);cover.append(fallback);
 if(genre.cover){const img=document.createElement('img');img.alt='';img.width=256;img.height=256;img.loading='lazy';img.decoding='async';img.addEventListener('error',()=>img.remove(),{once:true});img.src='./capa-'+genre.cover+'.webp';cover.append(img);}
 return cover;
}
function tg27GenreOptions(){const list=(state.catalogGenres||[]).filter(g=>tg66AllowedGenre(g)&&g.code!=='outros');return [...list,{code:'outros',label:'Outras'}];}
function catalogResults(query='',filter='all'){
  if(filter==='favorites'){const f=tg26FavoriteState();if(!f.uid||f.status!=='ready')return [];const official=new Map(state.catalog.map(x=>[x.video_id,x]));return [...f.items].map(([video_id,title])=>official.get(video_id)||{video_id,title,plays:0,source_kind:'external'}).filter(x=>matchesMusic(x,query)).sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));}
  const records=state.catalog.filter(song=>(filter==='played'?Number(song.plays)>0:
    filter==='suggested'?Number(song.plays)===0:filter.startsWith('genre:')?tg27Genre(song).code===filter.slice(6):true)&&matchesMusic(song,query));
  return records.sort((a,b)=>Number(b.plays)-Number(a.plays)||a.title.localeCompare(b.title,'pt-BR'));
}
// R39: falhas do acervo não provocam uma consulta completa a cada sincronização.
let tg39CatalogRetryAt=0;
function tg39CatalogMayRead(force,now,fetched,retryAt){return force||now>=retryAt&&(!fetched||now-fetched>=180000);}
async function loadCatalog(force=false){
  if(!state.client||!state.room||state.emergencyBlocked||state.emergencyClosing)return [];
  if(state.catalogLoading){try{return await state.catalogLoading;}catch{return state.catalog;}}
  if(!tg39CatalogMayRead(force,Date.now(),state.catalogFetchedAt,tg39CatalogRetryAt))return state.catalog;
  const scope=tg07Scope(),current=()=>tg07Current(scope)&&!state.emergencyBlocked&&!state.emergencyClosing;
  const task=(async()=>{
    const loaded=new Map(),batch=200,maxRecords=50000;let complete=false,genres=[],genreUnavailable=false;
    for(let offset=0;offset<maxRecords;offset+=batch){
      const {data,error}=await state.client.from('tg_official_catalog')
        .select('video_id,title,plays,last_qualified_play')
        .order('plays',{ascending:false}).order('last_qualified_play',{ascending:false}).order('video_id',{ascending:true})
        .range(offset,offset+batch-1);
      if(error)throw error;
      if(!current())return [];
      let classified={};if(typeof state.client.rpc==='function'&&!genreUnavailable){try{const result=await state.client.rpc('tg30_music_genres',{p_ids:(data||[]).map(r=>r.video_id)});if(result.error||!Array.isArray(result.data?.genres))throw Error('Categorias indisponíveis');genres=result.data.genres;classified=result.data.classified||{};}catch{genreUnavailable=true;}}
      if(!current())return [];
      for(const row of data||[]){const id=youtubeId(row.video_id);if(id&&row.approved!==false&&!loaded.has(id))loaded.set(id,{...row,genre:classified[id]||null});}
      if((data||[]).length<batch){complete=true;break;}
    }
    if(!current())return [];
    state.catalog=[...loaded.values()];state.catalogIncomplete=!complete;state.catalogGenres=genreUnavailable?[]:genres.filter(tg66AllowedGenre);state.catalogGenreUnavailable=genreUnavailable;const genreFilter=$('catalog-filter');if(genreFilter){for(const opt of [...genreFilter.options])if(opt.value.startsWith('genre:'))opt.remove();for(const g of tg27GenreOptions()){const opt=document.createElement('option');opt.value='genre:'+g.code;opt.textContent=g.label;genreFilter.append(opt);}if([...genreFilter.options].some(o=>o.value===state.catalogFilter))genreFilter.value=state.catalogFilter;else{state.catalogFilter='all';genreFilter.value='all';}}
    state.catalogError=null;tg39CatalogRetryAt=0;
    state.catalogFetchedAt=Date.now();
    renderCatalog();
    if($('catalog-dialog')?.open)renderFullCatalog();
    return state.catalog;
  })();
  state.catalogLoading=task;
  try{return await task;}
  catch(err){
    if(!current())return [];
    state.catalogError=err;tg39CatalogRetryAt=Date.now()+60000;
    console.warn('Falha ao ler o catálogo do Supabase:',err.message);
    if(!state.catalog.length)document.querySelectorAll('.hit-library-list').forEach(el=>{
      el.textContent='Biblioteca indisponível. Confira sua conexão e tente novamente.';
    });
    return state.catalog;
  }finally{if(state.catalogLoading===task)state.catalogLoading=null;}
}
async function queryLocalCatalog(query){
  await loadCatalog();
  if(state.catalog.length||!state.catalogError)return catalogResults(query).slice(0,40);
  throw new Error('A biblioteca está indisponível. Tente novamente.');
}
function catalogCard(item,host){
  const scope=tg07Scope();
  const videoId=youtubeId(item.video_id);
  if(!videoId)return null;
  const card=document.createElement('article');card.className='history-song-card tg123-track';
  const cover=tg27Cover(item);
  const info=document.createElement('div');info.className='history-song-info';
  const title=document.createElement('strong');title.textContent=item.title;
  const tiny=document.createElement('small');tiny.textContent=item.source_kind==='external'?'🔎 Sugestão externa · reprodução sujeita ao YouTube':Number(item.plays)>0?`🔥 ${Number(item.plays)} apresentação(ões)`:'📚 Música do catálogo';
  info.append(title,tiny);
  const genre=tg27Genre(item);const label=document.createElement('small');label.className='tg27-genre-label';label.textContent=genre.label;info.append(label);
  let curation=null;
  if(item.source_kind!=='external'){
    const details=document.createElement('details');details.className='tg-r16-curation';curation=details;
    const summary=document.createElement('summary');summary.textContent='⋯';summary.setAttribute('aria-label','Sugerir melhoria para '+item.title);summary.title='Sugerir melhoria';details.append(summary);details.addEventListener('toggle',()=>{if(details.open)for(const d of document.querySelectorAll('.tg-r16-curation[open]'))if(d!==details)d.open=false;});
    const suggest=document.createElement('button');suggest.type='button';suggest.className='tg124-suggest';suggest.textContent='Corrigir título';suggest.dataset.tg124Suggest=videoId;suggest.dataset.originalTitle=item.title;
    suggest.addEventListener('click',event=>{event.stopPropagation();void sendTitleSuggestion(videoId,item.title,scope,suggest);});details.append(suggest);
    if(state.user&&!isAnonymous(state.user)&&(state.catalogGenres||[]).length&&!state.catalogGenreUnavailable){
      const label=document.createElement('label');label.textContent='Sugerir gênero';const select=document.createElement('select');select.setAttribute('aria-label','Gênero musical sugerido');
      const empty=document.createElement('option');empty.value='';empty.textContent='Escolher gênero';select.append(empty);
      for(const g of state.catalogGenres){const opt=document.createElement('option');opt.value=g.code;opt.textContent=g.label;select.append(opt);}label.append(select);
      const send=document.createElement('button');send.type='button';send.textContent='Enviar gênero';send.className='tg124-suggest';send.disabled=true;
      select.addEventListener('change',()=>{send.disabled=!select.value;});
      send.addEventListener('click',async()=>{
        const chosen=select.value;
        if(send.disabled||!tgR16CurateAllowed(scope,videoId)||isAnonymous(state.user)||state.catalogGenreUnavailable||!(state.catalogGenres||[]).some(g=>g.code===chosen))return;
        const ticket=tgR16BeginCurate(scope,'genre',videoId);if(!ticket)return;
        send.disabled=true;select.disabled=true;
        try{const {data,error}=await state.client.rpc('tg30_music_suggest',{p_video:videoId,p_genre:chosen});if(error||data!==true)throw error||Error('Não confirmado');if(tg07Current(scope))toast('Sugestão de gênero enviada à Central.');}
        catch(err){if(tg07Current(scope))toast(String(err?.message||'').includes('TG30_MUSIC_WAIT')?'Aguarde 10 segundos entre sugestões de gênero.':'Não foi possível confirmar o envio. Tente novamente.',true);}
        finally{tgR16EndCurate(ticket);select.disabled=false;send.disabled=!select.value;}
      });details.append(label,send);
    }
    const hint=document.createElement('small');hint.textContent='A Central revisará sua sugestão.';details.append(hint);
  }
  const toggle=document.createElement('button');toggle.type='button';toggle.className='tg123-track-toggle';
  toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Escolher formato para '+item.title);toggle.textContent=state.room?.room_mode==='solo'?'+ Lista':'+ Fila';if(state.room?.room_mode==='solo'){toggle.removeAttribute('aria-expanded');toggle.setAttribute('aria-label','Adicionar '+item.title+' à minha lista');}
  const expanded=document.createElement('div');expanded.className='tg123-track-choice';expanded.hidden=true;
  const hint=document.createElement('span');hint.textContent='Como vai ser o show?';hint.className='tg123-track-hint';
  const modes=document.createElement('div');modes.className='tg123-track-modes';modes.setAttribute('role','group');modes.setAttribute('aria-label','Formato da apresentação');
  let chosen='solo';
  const partnerBox=document.createElement('div');partnerBox.className='tg20-partner-box';partnerBox.hidden=true;
  const instructions=document.createElement('p');instructions.className='tg20-partner-help';
  const people=document.createElement('div');people.className='tg20-partner-list';
  partnerBox.append(instructions,people);
  function renderPartners(){
    const other=state.members.filter(m=>m.user_id!==state.user?.id);
    partnerBox.hidden=chosen==='solo';people.replaceChildren();
    if(chosen==='solo')return;
    instructions.textContent=chosen==='duet'?'Escolha 1 pessoa da festa para cantar com você:':'Escolha 2 ou 3 pessoas da festa para montar o grupo:';
    if(!other.length){const hint=document.createElement('p');hint.className='tg20-partner-help';hint.textContent='Ainda não há outros participantes nesta festa. Aguarde alguém entrar ou escolha Solo.';people.append(hint);return;}
    for(const member of other){
      const label=document.createElement('label');label.className='tg20-partner-option';
      const input=document.createElement('input');input.type=chosen==='duet'?'radio':'checkbox';input.name='tg20-partners-'+videoId;input.value=member.user_id;
      const photo=document.createElement('span');photo.textContent=member.display_name?.trim()?.charAt(0)?.toUpperCase()||'🎤';photo.setAttribute('aria-hidden','true');photo.className='tg20-partner-avatar';
      const title=document.createElement('span');title.textContent=member.display_name||'Participante';label.append(input,photo,title);people.append(label);
    }
  }
  const formats=state.room?.room_mode==='solo'?[['solo','🎤 Solo']]:[['solo','🎤 Solo'],['duet','🎤🎤 Dueto'],['group','👥 Grupo']];
  for(const [mode,label] of formats){
    const option=document.createElement('button');option.type='button';option.className='tg123-mode';option.textContent=label;option.dataset.mode=mode;option.setAttribute('aria-pressed',String(mode==='solo'));
    option.addEventListener('click',()=>{chosen=mode;
      for(const b of modes.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===option));
      add.textContent=mode==='solo'?'Confirmar solo na fila':mode==='duet'?'Confirmar dueto na fila':'Confirmar grupo na fila';
      renderPartners();
    });
    modes.append(option);
  }
  const add=document.createElement('button');add.type='button';add.className='button button-primary tg123-track-add';add.textContent='Confirmar solo na fila';
  add.setAttribute('aria-label','Confirmar '+item.title+' na fila');
  add.addEventListener('click',()=>{
    if(!tg07Current(scope)){toast('A sala mudou. Abra o catálogo novamente.',true);return;}
    const selected=Array.from(people.querySelectorAll('input:checked')).map(i=>i.value);
    if(chosen==='duet'&&selected.length!==1){toast('Selecione uma pessoa para o dueto.',true);return;}
    if(chosen==='group'&&(selected.length<2||selected.length>3)){toast('Escolha 2 ou 3 pessoas além de você para o grupo.',true);return;}
    if(chosen!=='solo'&&new Set(selected).size!==selected.length){toast('Confira os participantes escolhidos.',true);return;}
    void addSearchedVideo({id:videoId,title:item.title},host,add,card,chosen,chosen==='solo'?[]:selected);
  });
  expanded.append(hint,modes,partnerBox,add);
  toggle.addEventListener('click',()=>{
    if(!tg07Current(scope)){toast('A sala mudou. Abra o catálogo novamente.',true);return;}
    if(state.room?.room_mode==='solo'&&state.role==='host'){void addSearchedVideo({id:videoId,title:item.title},true,toggle,card,'solo',[]);return;}
    const opening=expanded.hidden;
    document.querySelectorAll('.tg123-track-choice:not([hidden])').forEach(el=>{if(el!==expanded){el.hidden=true;el.closest('.tg123-track')?.querySelector('.tg123-track-toggle')?.setAttribute('aria-expanded','false');}});
    expanded.hidden=!opening;toggle.setAttribute('aria-expanded',String(opening));
    if(opening){
      const sheet=$('tg124-choice-dialog');
      if(sheet){
        const slot=$('tg124-choice-slot');slot.replaceChildren(expanded);expanded.hidden=false;
        sheet.addEventListener('close',()=>{if(slot.contains(expanded)){card.append(expanded);expanded.hidden=true;toggle.setAttribute('aria-expanded','false');}},{once:true});
        renderPartners();$('tg124-choice-title').textContent=item.title;sheet.showModal();modes.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
        return;
      }
      add.focus({preventScroll:true});
    }
  });
  const actions=document.createElement('div');actions.className='tg26-track-actions';const f=tg26FavoriteState();
  if(f.uid){const fav=document.createElement('button');fav.type='button';fav.className='tg26-favorite';fav.dataset.tg26Favorite=videoId;fav.dataset.tg26Uid=f.uid;fav.dataset.title=item.title;fav.textContent=f.items.has(videoId)?'♥':'♡';fav.disabled=f.status!=='ready'||f.writes.has(videoId);fav.setAttribute('aria-pressed',String(f.items.has(videoId)));fav.setAttribute('aria-label',(f.items.has(videoId)?'Remover dos favoritos: ':'Favoritar: ')+item.title);fav.addEventListener('click',()=>void tg26ToggleFavorite(item,f));actions.append(fav);}
  actions.prepend(toggle);card.append(cover,info,actions);if(curation)card.append(curation);card.append(expanded);return card;
}

function renderCatalog(){
  void tg26LoadFavorites();
  const groups=[['guest-library',false],['stage-library',true]];
  for(const [id,host] of groups){
    const holder=$(id);if(!holder)continue;
    holder.replaceChildren();
    if(!state.catalog.length){holder.textContent=state.catalogError?'Catálogo indisponível. Abra o catálogo para tentar novamente.':'Catálogo ainda vazio. O primeiro hit pode ser seu! 🎤';continue;}
    state.catalog.slice(0,4).forEach(item=>{const card=catalogCard(item,host);if(card)holder.append(card);});
  }
  document.querySelectorAll('[data-catalog-open]').forEach(btn=>{
    btn.setAttribute('aria-label',`Abrir catálogo completo de ${state.catalog.length} músicas`);
  });
}
async function openFullCatalog(){
  if(state.emergencyBlocked){toast('A sala está em pausa de segurança. Aguarde a reconexão.',true);return;}
  if(isPhoneSingerRole()&&callActive()){toast('Conclua sua apresentação antes de escolher músicas.',true);return;}
  if(!state.room){toast('Entre em uma festa para ver o catálogo.',true);return;}
  if($('song-dialog')?.open)$('song-dialog').close();
  state.catalogPage=1;state.catalogQuery='';state.catalogFilter='all';
  $('catalog-search').value='';$('catalog-filter').value='all';
  $('tg07-external-query').value='';$('tg07-external-results').replaceChildren();$('tg07-link').value='';$('tg07-link-title').value='';
  if($('catalog-dialog').open)return;
  $('catalog-dialog').showModal();
  if(document.body.dataset.currentView==='stage')$('catalog-close').focus({preventScroll:true});
  $('catalog-list').textContent='Abrindo a biblioteca do povo... 🎶';
  const scope=tg07Scope();void tg26LoadFavorites(true);await loadCatalog();if(!tg07Current(scope)||!$('catalog-dialog').open)return;renderFullCatalog();
  if(document.body.dataset.currentView!=='stage')$('catalog-search').focus({preventScroll:true});
}
function tg05RenderGenreNav(){
  const nav=$('tg05-genre-nav'),strip=$('tg05-genre-strip'),select=$('catalog-filter');if(!nav||!strip||!select)return;
  const genres=tg27GenreOptions();
  nav.hidden=!genres.length;if(!genres.length){strip.replaceChildren();delete strip.dataset.signature;return;}
  const icons={sertanejo:'🤠',pop:'✨',reggae:'🌿',rock:'🎸',pagode:'🥁',samba:'🪘',mpb:'🎼',funk:'🔊',forro:'🪗',rap:'🎤',eletronica:'🎛️',axe:'☀️',infantil:'🎈',outros:'♫'};
  const counts=new Map();let totalMatches=0;for(const song of state.catalog){if(matchesMusic(song,state.catalogQuery)){totalMatches++;const code=tg27Genre(song).code;counts.set(code,(counts.get(code)||0)+1);}}
  const entries=[{code:'all',label:'Todos'},...genres];const signature=JSON.stringify(entries.map(g=>[g.code,g.label]));
  if(strip.dataset.signature!==signature){strip.dataset.signature=signature;strip.replaceChildren();for(const g of entries){const btn=document.createElement('button');btn.type='button';btn.className='tg05-genre-chip';btn.dataset.filter=g.code==='all'?'all':'genre:'+g.code;btn.dataset.genre=g.code;btn.textContent=(icons[g.code]||'♫')+' '+g.label;btn.addEventListener('click',()=>{if(![...select.options].some(o=>o.value===btn.dataset.filter))return;select.value=btn.dataset.filter;select.dispatchEvent(new Event('change',{bubbles:true}));});strip.append(btn);}}
  for(const btn of strip.querySelectorAll('button')){const code=btn.dataset.genre,n=code==='all'?totalMatches:counts.get(code)||0;btn.setAttribute('aria-pressed',String(btn.dataset.filter===state.catalogFilter));btn.title=n+' música(s) na busca atual';}
}
function renderFullCatalog(){
  if(!$('catalog-dialog')?.open)return;
  tg05RenderGenreNav();
  const items=catalogResults(state.catalogQuery,state.catalogFilter);
  const total=state.catalogFilter==='favorites'?tg26FavoriteState().items.size:state.catalog.length;
  $('catalog-total').textContent=`${items.length} de ${total} música(s) do acervo${state.catalogQuery?' para sua busca':''}${state.catalogGenreUnavailable?' · classificação musical indisponível':state.catalogError?' · última consulta falhou; dados anteriores':state.catalogIncomplete?' · limite de leitura atingido; acervo parcial':''}`;
  const list=$('catalog-list');list.replaceChildren();
  if(!items.length){
    const note=document.createElement('p');note.className='catalog-no-results';
    note.textContent=state.catalogFilter==='favorites'?(tg26FavoriteState().status==='loading'?'Carregando favoritos…':tg26FavoriteState().status==='error'?'Não foi possível consultar seus favoritos.':'Nenhum favorito nesta busca. Toque no coração para guardar uma música.'):state.catalogError?'O catálogo está indisponível agora. Confira sua conexão e tente novamente.':
      'Nenhuma música com essas palavras aqui. Experimente só o artista ou parte do título.';
    list.append(note);
  }
  for(const item of items.slice(0,state.catalogPage*CATALOG_PAGE_SIZE)){
    const card=catalogCard(item,state.role==='host');if(card)list.append(card);
  }
  $('catalog-more').hidden=state.catalogPage*CATALOG_PAGE_SIZE>=items.length;tg26FavoritePaint();
}
  function showMoreExternal(results,host,query,inCatalog=false){
    const panel=document.createElement('div');panel.className='more-external';
    const info=document.createElement('span');info.textContent='Não achou seu hit? A busca externa usa uma consulta da cota mensal.';
    const btn=document.createElement('button');btn.className='button button-soft';btn.type='button';btn.textContent='🔎 Buscar outras versões no YouTube';
    btn.addEventListener('click',()=>searchYoutube(host,true,inCatalog));
    panel.append(info,btn);results.append(panel);
  }
  const searchMemory = new Map();
  function decodedYouTubeText(value) {
    const t=document.createElement('textarea');t.innerHTML=String(value||'');return t.value;
  }
  function makeSearchMessage(results,message,kind='info') {
    results.replaceChildren();
    const node=document.createElement('div');node.className='search-feedback '+(kind==='error'?'search-error':'');
    node.textContent=message;results.append(node);
  }
  let tg123SuccessTimer=null;
  function showEnqueueSuccess(title,mode){
    const panel=$('tg123-success');if(!panel)return;
    clearTimeout(tg123SuccessTimer);
    const label={solo:'Solo',duet:'Dueto',group:'Grupo'}[mode]||'Apresentação';
    $('tg123-success-track').textContent=title;
    $('tg123-success-mode').textContent=label+' · adicionada ao setlist';
    // Sem inventar posição: ela pode mudar quando outros convidados adicionam músicas.
    panel.hidden=false;
    const hide=()=>{panel.hidden=true;clearTimeout(tg123SuccessTimer);};
    $('tg123-success-close').onclick=hide;
    $('tg123-success-another').onclick=()=>{hide();if($('catalog-dialog')?.open)(document.body.dataset.currentView==='stage'?$('catalog-close'):$('catalog-search'))?.focus({preventScroll:true});};
    tg123SuccessTimer=setTimeout(hide,4800);
  }
  async function addSearchedVideo(item,host,button,results,cardMode=null,cardPartners=null) {
    if(button.disabled)return;
    const scope=tg07Scope();
    if(!state.room || !state.client){toast('Entre numa festa antes de adicionar músicas.',true);return;}
    if(!youtubeId(item.id)){toast('Vídeo indisponível. Escolha outro.',true);return;}
    setLoading(button,true,'Entrando na fila...');
    try {
      await enqueueSelectedVideo(item.id,item.title.slice(0,120),host,cardMode,cardPartners);
      if(!tg07Current(scope))return;
      // Confirmação de sucesso apenas depois do RPC; falha de refresh não desfaz a gravação.
      try{await fetchSongs();renderQueue();}catch(err){console.warn('Fila salva; atualização visual pendente:',err);}
      if(!tg07Current(scope))return;
      showEnqueueSuccess(item.title,cardMode);
      if($('tg124-choice-dialog')?.open)$('tg124-choice-dialog').close();
      if($('catalog-dialog')?.open)$('catalog-dialog').close();
      if(host && $('song-dialog').open)$('song-dialog').close();
      else {const feedback=results.closest('.search-results')||results;if(feedback.id==='search-results')makeSearchMessage(feedback,'💚 Entrou na fila! Pode escolher outro hit se quiser.');}
      toast('🎤 Música adicionada à fila!');
    }catch(err){toast(humanError(err),true);}
    finally{setLoading(button,false);}
  }
  // Importação com links e títulos confirmados pelo usuário: sem SerpApi.
  // Não atribui reprodução antes de o YouTube tocar ao menos 50% do vídeo.
  async function importPlaylistManual(){
    if(state.role!=='host'||!state.room){toast('Só o anfitrião pode importar a playlist.',true);return;}
    const input=$('playlist-import-lines');const lines=input.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(lines.length<1||lines.length>60){toast('Cole de 1 a 60 músicas, uma por linha.',true);return;}
    const items=[];
    for(const line of lines){
      const cut=line.lastIndexOf('|');
      if(cut<0){toast('Cada linha deve ter Título | URL do YouTube.',true);return;}
      const title=line.slice(0,cut).trim(), video_id=youtubeId(line.slice(cut+1).trim());
      if(!video_id||title.length<3||title.length>120){toast('Corrija a linha: '+line.slice(0,35),true);return;}
      items.push({video_id,title});
    }
    const btn=$('playlist-import-submit');setLoading(btn,true,'Importando...');
    try{
      const saved=await callRPC('karaoke_seed_playlist',{p_room:state.room.id,p_items:items});
      toast('🎤 '+saved+' indicações cadastradas! A reprodução será verificada durante a festa.');
      input.value='';$('playlist-import-panel').open=false;await loadCatalog(true);
    }catch(err){toast('Falha ao importar: '+humanError(err),true);}
    finally{setLoading(btn,false);}
  }
  function renderYoutubeResults(hits,results,host){
    results.replaceChildren();
    if(!hits.length){makeSearchMessage(results,'Nenhum karaokê encontrado. Tente outro nome ou artista.');return;}
    const caption=document.createElement('div');caption.className='search-count';
    caption.textContent=`🎶 ${hits.length} sugestões do YouTube · a reprodução pode ter restrições`;
    results.append(caption);
    for(const hit of hits){
      const videoId=youtubeId(hit.id);if(!videoId)continue;
      const card=catalogCard({video_id:videoId,title:decodedYouTubeText(hit.title),plays:0,source_kind:'external'},host);
      if(card){card.classList.add('tg123-external-card');results.append(card);}
    }
  }

  function showExternalFallback(results,host,query,reason){
    if(results.id==='tg07-external-results'){makeSearchMessage(results,'Busca externa indisponível. Use o acervo acima ou cole um link abaixo.','error');return;}
    results.replaceChildren();
    const box=document.createElement('div');box.className='quota-fallback';
    const heading=document.createElement('h3');heading.textContent='🚫 Busca externa temporariamente pausada';
    const expl=document.createElement('p');expl.textContent=reason+' A Diva Gogó ainda tem soluções: escolha um hit do histórico ou cole um link do YouTube.';
    const actions=document.createElement('div');actions.className='quota-actions';
    const history=document.createElement('button');history.className='button button-primary';history.type='button';history.textContent='🔥 Usar as mais pedidas';
    history.addEventListener('click',()=>{
      const target=$(host?'stage-library':'guest-library');
      if(host)$('song-dialog').close();
      if(!host)switchMobileTab('queue');
      target?.scrollIntoView({behavior:'smooth',block:'center'});
    });
    const direct=document.createElement('button');direct.className='button button-soft';direct.type='button';direct.textContent='🔗 Tenho um link do YouTube';
    direct.addEventListener('click',()=>{
      const details=document.querySelector(host?'.host-manual':'#guest-queue-panel .manual-song');
      if(!details)return;
      details.open=true;
      const urlInput=$(host?'host-url':'guest-video-url');
      const title=$(host?'host-song-title':'guest-song-title');
      if(title&&!title.value)title.value=query.slice(0,120);
      details.scrollIntoView({behavior:'smooth',block:'center'});
      urlInput?.focus({preventScroll:true});
    });
    actions.append(history,direct);box.append(heading,expl,actions);results.append(box);
  }
  async function searchYoutube(host,forceExternal=false,inCatalog=false) {
    const search=$(inCatalog?'tg07-external-query':host?'host-search':'youtube-search');
    const results=$(inCatalog?'tg07-external-results':host?'host-results':'search-results');
    const button=$(inCatalog?'tg07-external-search':host?'host-search-button':'search-youtube');
    const query=search.value.trim().replace(/\s+/g,' ');
    if(button.disabled)return;
    const scope=tg07Scope();const current=()=>tg07Current(scope)&&!state.emergencyBlocked&&!state.emergencyClosing&&(!inCatalog||$('catalog-dialog').open)&&search.value.trim().replace(/\s+/g,' ')===query;
    if(query.length<2){makeSearchMessage(results,'Escreva o nome da música ou artista para buscar.');search.focus();return;}
    if(!state.client||!state.room){makeSearchMessage(results,'Entre numa festa antes de buscar músicas.','error');return;}
    if(!current()){makeSearchMessage(results,'Aguarde a sincronização segura da festa antes de buscar.','error');return;}
    if(!forceExternal){
      setLoading(button,true,'Consultando nosso acervo...');
      try{
        const found=await queryLocalCatalog(query);
        if(!current())return;
        results.replaceChildren();
        const label=document.createElement('div');label.className='search-count';
        label.textContent=(found.length?`💚 ${found.length} hit(s) do acervo — não consomem buscas!`:'Nenhuma música encontrada nesta consulta.')+(state.catalogError?' · consulta anterior; atualize o acervo.':state.catalogIncomplete?' · acervo parcial.':'');
        results.append(label);
        found.forEach(item=>{const card=catalogCard(item,host);if(card)results.append(card);});
        showMoreExternal(results,host,query,inCatalog);
        return;
      }catch(err){
        if(!current())return;
        makeSearchMessage(results,'Acervo indisponível agora. Você pode buscar externamente.');
        showMoreExternal(results,host,query,inCatalog);
        return;
      }finally{setLoading(button,false);}
    }
    if(state.externalSearchBlocked){showExternalFallback(results,host,query,'O servidor indicou que a cota não está disponível.');return;}
    const key=scope.uid+'|'+scope.room+'|'+query.toLocaleLowerCase('pt-BR');
    const cached=searchMemory.get(key);
    if(cached&&Date.now()-cached.date<5*60*1000){renderYoutubeResults(cached.items,results,host);return;}
    setLoading(button,true,'Buscando...');
    makeSearchMessage(results,'🔎 Procurando o hino perfeito no YouTube...');
    try {
      const {data,error}=await state.client.functions.invoke('youtube-search',{
        body:{ query,roomId:scope.room,roomCode:state.room.code }
      });
      if(!current())return;
      if(error){
        let detail='Não consegui consultar a busca externa. Tente novamente ou use o catálogo.';
        let code='';
        try{
          const response=error.context;
          if(response?.json){const j=await response.clone().json();detail=j.error||j.message||detail;code=j.code||'';}
          if(response?.status===429&&code==='')code='RATE_LIMIT';
        }catch{}
        if(!current())return;
        if(code==='QUOTA_EXHAUSTED'||code==='QUOTA_UNAVAILABLE'){
          state.externalSearchBlocked=true;
          showExternalFallback(results,host,query,detail);
          return;
        }
        if(code==='ROOM_REFERENCE_INVALID'||/Identificador da sala inválido/i.test(detail))
          throw new Error('Não foi possível confirmar a sala na busca externa. Tente entrar novamente.');
        throw new Error(detail);
      }
      if(data?.code==='QUOTA_EXHAUSTED'||data?.code==='QUOTA_UNAVAILABLE'){
        state.externalSearchBlocked=true;
        showExternalFallback(results,host,query,data.error||'A cota externa acabou.');
        return;
      }
      if(data?.error)throw new Error(data.error);
      if(!Array.isArray(data?.items))throw new Error('Resposta inválida da busca. Tente novamente.');
      const hits=data.items.filter(i=>i&&youtubeId(i.id)&&typeof i.title==='string').slice(0,8);
      searchMemory.set(key,{date:Date.now(),items:hits});
      if(searchMemory.size>30)searchMemory.delete(searchMemory.keys().next().value);
      renderYoutubeResults(hits,results,host);
    }catch(err){
      if(!current())return;
      makeSearchMessage(results,humanError(err)+' Você ainda pode usar a opção “Tenho um link” abaixo.','error');
    }finally{setLoading(button,false);}
  }
  function getRankingRows(){
    if(!tg13Recreational())return [];
    const rows=new Map();
    const titles=new Map(state.songTitleCache||[]);(state.songs||[]).forEach(song=>titles.set(String(song.id),String(song.title||'Música')));
    for(const row of state.scores){
      const value=Number(row.score);if(row.score==null||row.score===''||!Number.isFinite(value))continue;
      const songId=String(row.song_id||'');
      const key=String(row.user_id)+'|'+songId;
      const record=rows.get(key)||{uid:row.user_id,songId,title:titles.get(songId)||row.song_title||'Música da apresentação',best:0,count:0,attempts:[]};
      record.best=Math.max(record.best,Math.max(0,Math.min(100,value)));
      record.count++;record.attempts.push({score:value,created_at:row.created_at});rows.set(key,record);
    }
    return [...rows.values()].sort((a,b)=>b.best-a.best||b.count-a.count||String(a.title).localeCompare(String(b.title),'pt-BR'));
  }
  function renderStageRanking(){
    const list=$('stage-rank-list');if(!list)return;
    if(!tg13Recreational()){tg13ScorePrivacy();return;}
    const rows=getRankingRows();
    if(!rows.length){list.innerHTML='<p class="rank-empty">Ainda não saiu a primeira nota. A Diva já está preparando a coroa! 👑</p>';return;}
    list.innerHTML=rows.slice(0,5).map((d,i)=>`<div class="mini-rank-item"><span class="rank-medal">${['🥇','🥈','🥉'][i]||i+1+'º'}</span><span class="mini-rank-name">${escapeHTML(memberName(d.uid))}<small>${escapeHTML(d.title)} · ${d.count} tentativa(s)</small></span><strong>${d.best}<small>/100</small></strong></div>`).join('');
    $('rank-updated').textContent=rows.length+' recordes no placar';
  }
  function renderLiveScore(){
    const holder=$('live-score-list');if(!holder||state.role!=='host')return;
    if(!tg13Recreational()){holder.textContent='Avaliação técnica reservada.';return;}
    const song=state.currentSong;
    if(!song){holder.textContent='Quando começar uma música, a nota de cada celular aparece aqui. 🎙️';return;}
    const singers=songSingers(song);
    holder.innerHTML=singers.map(uid=>{
      const report=state.cloudMicStats.get(uid);
      const score=scoreForSinger(uid);
      const complete=!!report && Number(report.samples)>=8;
      return `<div class="round-score-row"><span><strong>${escapeHTML(memberName(uid))}</strong><small>${complete?'📡 Celular sincronizado':'◌ Aguardando dados do celular'}</small></span><b>${score?.score??'—'}<small>/100</small></b></div>`;
    }).join('');
  }
  function openScoreboard(){
    if(!tg13Recreational()){tg13ScorePrivacy();toast('Placar recreativo indisponível nesta sala.');return;}
    const sorted=getRankingRows();
    $('score-list').innerHTML=sorted.length?sorted.map((d,i)=>`<details class="tg124-rank-entry"><summary class="score-row"><span class="score-rank">${['🥇','🥈','🥉'][i]||i+1+'º'}</span><div class="score-detail"><strong>${escapeHTML(memberName(d.uid))}</strong><small>${escapeHTML(d.title)} · ${d.count} tentativa(s) · melhor nota ${d.best}</small></div><strong class="score-value">${d.best}/100</strong></summary><div class="tg124-attempts">${d.attempts.map((a,n)=>`<p>${n+1}ª tentativa · ${Math.round(a.score)}/100 ${Math.round(a.score)===d.best?'🏆':''}</p>`).join('')}</div></details>`).join(''):'<p class="subtle">O ranking começa depois da primeira apresentação avaliada. 🎤</p>';
    $('score-dialog').showModal();
  }
  function tg38RoomCurrent(scope,role){return tg07Current(scope)&&state.role===role&&!state.emergencyBlocked&&!state.emergencyClosing;}
  let tg38WakePending=null;
  async function unlockWakeLock(){
    const scope=tg07Scope(),current=()=>tg38RoomCurrent(scope,'host');
    if(!current()||!('wakeLock' in navigator)||document.visibilityState!=='visible'||(state.wakeLock&&!state.wakeLock.released))return;
    if(tg38WakePending&&tg07Current(tg38WakePending.scope))return;
    const ticket={scope};tg38WakePending=ticket;
    try{
      const lock=await navigator.wakeLock.request('screen');
      if(tg38WakePending!==ticket||!current()||document.visibilityState!=='visible'){await lock.release();return;}
      state.wakeLock=lock;
      lock.addEventListener?.('release',()=>{if(state.wakeLock===lock)state.wakeLock=null;},{once:true});
    }catch{}finally{if(tg38WakePending===ticket)tg38WakePending=null;}
  }
  // Somente a leitura periódica é coalescida; a coleta final continua independente.
  let tg39MicTick=null;
  function tg39PollMic(){
    const scope=tg07Scope(),song=state.currentSong?.id;
    if(!song||state.role!=='host'||state.emergencyBlocked||state.emergencyClosing||state.finishing)return;
    if(tg39MicTick&&tg07Current(tg39MicTick.scope)&&tg39MicTick.song===song)return;
    const ticket={scope,song};tg39MicTick=ticket;
    void Promise.resolve().then(()=>{
      if(tg39MicTick!==ticket||!tg07Current(scope)||state.currentSong?.id!==song||state.emergencyBlocked||state.emergencyClosing||state.finishing)return;
      return fetchMicActivity();
    }).catch(err=>{if(tg07Current(scope))console.warn('Leitura periódica de microfone:',err);}).finally(()=>{if(tg39MicTick===ticket)tg39MicTick=null;});
  }
  function startTicker(){
    clearInterval(state.ticker);let cycles=0;
    state.ticker=setInterval(()=>{
      if(!state.room||state.emergencyBlocked)return;
      if(tg18Recognition&&(isMyTurn()||callActive()))tg18AbortDictation();
      window.TG74_DIVA_STUDIO?.guard();
      sampleAudio();cycles++;
      if(cycles%72===0&&isPhoneSingerRole()&&state.guestPreflightSong)void notifyPreflightGuest();
      if(cycles%36===0&&state.role==='host'&&state.preflight)renderPreflightHost();
      if(cycles%7===0){updateVideoProgress();if(state.role==='host')renderMics();else tg90PaintPhone();}
      if(cycles%10===0 && state.role==='host' && state.currentSong)tg39PollMic();
    },140);
  }
  async function stopSession(){
    ++tg07SessionEpoch;tg90ResetUpcoming();tg89CloseSound();tg89SoundOffered=null;tgR25ClearSoloReport();tgR18ClearReadyRoom();tgR09ClearHistory();state.emergencyClosing=true;clearInterval(tg23Timer);tg23Timer=null;tg23Pending=null;tg15ClearRecap();tg18AbortDictation();
    for(const id of ["tg124-choice-dialog","tg17-singer-dialog","tg16-confirm-music","catalog-dialog","song-dialog"]){const dlg=$(id);if(dlg?.open)dlg.close();}
    searchMemory.clear();state.externalSearchBlocked=false;state.catalogIncomplete=false;
    for(const id of ['host-results','search-results','tg07-external-results'])$(id)?.replaceChildren();
    window.TG74_DIVA_STUDIO?.reset();

    if('speechSynthesis' in window)try{window.speechSynthesis.cancel();}catch{}
    clearTimeout(state.divaSpeakingTimer);document.body.classList.remove('diva-talking');
    clearInterval(state.ticker);state.ticker=null;tg39MicTick=null;
    clearInterval(state.voxTimer);state.voxTimer=null;
    clearInterval(state.signalCleaner);state.signalCleaner=null;
    clearInterval(state.memberVerifier);state.memberVerifier=null;
    clearInterval(state.roomPoller);state.roomPoller=null;clearInterval(state.signalPoller);state.signalPoller=null;state.realtimeOk=false;tgR15SyncTicket=null;state.syncRunning=false;state.syncQueued=false;
    clearTimeout(state.roomReloadTimer);clearTimeout(state.scoreOverlayTimer);
    if($('tg123-post-score'))$('tg123-post-score').hidden=true;clearTimeout(window.__tg123PostScoreTimer);
    clearHostPreflight(false);state.guestPreflightSong=null;state.guestReady=false;state.avatars.clear();
    stopSoloMic();if(state.localStream||tgR20MicRequest)await stopMicrophone(true);
    if(state.role==='host'){for(const uid of state.peers.keys())void sendSignal(uid,'bye').catch(console.warn);}
    for(const uid of [...state.peers.keys()])closePeer(uid);
    try{if(state.channel&&state.client)await state.client.removeChannel(state.channel);}catch{}
    state.channel=null;
    try{await state.context?.close();}catch{}state.context=null;
    try{state.wakeLock?.release();}catch{}state.wakeLock=null;
    if(state.player){try{state.player.destroy();}catch{}state.player=null;state.playerReady=false;
      const frame=$('video-frame');const old=$('youtube-player');if(old)old.remove();
      const el=document.createElement('div');el.id='youtube-player';el.className='youtube-player';frame.prepend(el);
    }
    state.peers.clear();state.candidateBuffer.clear();state.processedSignals.clear();state.signalChain=Promise.resolve();
    hideGuestRecado();recadoAfter=null;pendingGuestRecados.length=0;recadoFrequency.clear();tg04SeenMessages.clear();nextGuestRecadoAt=0;tg04MessageFetch=null;tg04HostSending=null;tg18GuestSending=null;
    for(const id of ['tg17-send-message','tg04-stage-send','tg04-remote-send'])if($(id))setLoading($(id),false);
    tgR15StageTicket=null;if($('tg18-remote-stage'))$('tg18-remote-stage').disabled=false;
    if($('mic-toggle'))$('mic-toggle').disabled=false;
    for(const id of ['stage-exit','tg04-remote-end'])if($(id))$(id).disabled=false;
    tg30VoiceSnapshots.clear();state.songFrames=0;state.micStats.clear();state.playMetrics=null;state.micActivity=null;state.cloudMicStats.clear();state.catalog=[];state.catalogGenres=[];state.catalogGenreUnavailable=false;state.catalogFetchedAt=0;state.catalogLoading=null;state.catalogError=null;tg39CatalogRetryAt=0;state.currentSong=null;state.room=null;state.role=null;
    tgR14ClearRemote();state.songs=[];state.members=[];state.scores=[];state.lastMySong=null;state.mobileTab=null;state.isPlaying=false;state.finishing=false;state.guestMicLock=false;document.body.classList.remove('tg18-remote-singing','tg18-remote-active','tg18-singing','tg103-mic-focus','tg103-remote-mic-focus');
    tg23Reset();hideFinal();$('video-placeholder').hidden=false;$('qr-bubble').classList.remove('qr-expanded');
  }
  async function leaveGuest(){
    if(state.role!=='guest')return;
    const room=state.room?.id,user=state.user?.id,epoch=tg07SessionEpoch+1;
    await stopSession();
    if(state.user?.id!==user||tg07SessionEpoch!==epoch||state.room)return;
    if(room&&user)state.client.from('karaoke_members').delete().eq('room_id',room).eq('user_id',user).then(({error})=>{if(error)console.warn(error);});
    history.replaceState(null,'',new URL('./',location.href).href);
    localStorage.removeItem('tem-gogo-pending-room');
    if(state.user)await openLobby();else showGuestEntry('');
  }
  function recapText(data,includeFlop=false){
    const podium=Array.isArray(data?.podium)?data.podium:[];
    const rows=podium.map((p,i)=>`${['🥇','🥈','🥉'][i]} ${p.name} — ${p.best_score}/100 (melhor nota, ${p.songs_scored} apresentação(ões))`);
    const flop=includeFlop?data?.perrengue:null;
    return `🎤 TEM GOGÓ — ${data?.room_title||'Nossa festa'}\n`+
      `🎵 ${Number(data?.songs_completed)||0} músicas concluídas • ${Number(data?.songs_scored)||0} com nota\n`+
      `🏆 TOP 3\n${rows.join('\n')||'Ainda sem notas.'}\n`+
      (flop?`🫠 Perrengue da noite: ${flop.name} — ${flop.score}/100\n`:'')+
      'Nota divertida de participação e volume no microfone do celular; não mede afinação.';
  }
  let tg30FeedbackContext=null,tg30FeedbackSerial=0;
  let tg15RecapContext=null,tg15RecapSerial=0;
  function tg15RecapScope(){return {uid:state.user?.id,epoch:tg07SessionEpoch,serial:++tg15RecapSerial};}
  function tg15RecapCurrent(scope){return !!scope?.uid&&scope.uid===state.user?.id&&scope.epoch===tg07SessionEpoch&&scope.serial===tg15RecapSerial;}
  function tg15ClearRecap(){
    ++tg15RecapSerial;++tg30FeedbackSerial;tg15RecapContext=null;tg30FeedbackContext=null;state.latestRecap=null;state.recapAvatars=null;
    const dlg=$('party-recap-dialog');if(dlg?.open)dlg.close();
    for(const id of ['recap-room-title','recap-total','recap-scored','recap-duets','recap-flop-name','recap-flop-score','tg30-feedback-status'])if($(id))$(id).textContent='';
    $('recap-podium')?.replaceChildren();if($('recap-flop'))$('recap-flop').hidden=true;if($('tg124-flop-avatar')){$('tg124-flop-avatar').hidden=true;$('tg124-flop-avatar').removeAttribute('src');}
    if($('tg30-feedback-card'))$('tg30-feedback-card').hidden=true;$('tg30-feedback-form')?.reset();if($('tg15-share-flop'))$('tg15-share-flop').checked=false;
  }
  function tg15RememberRecap(roomId,uid){if(!roomId||!uid)return;try{localStorage.setItem('tem-gogo-last-recap-room:'+uid,roomId);}catch{}}
  function tg15RecapToken(){const x=tg15RecapContext;return x&&tg15RecapCurrent(x)&&$('party-recap-dialog')?.open?x:null;}
  // The sharing module receives only a short-lived context, never a credential.
  window.TG15_RECAP_CONTEXT=tg15RecapToken;
  async function tg15LoadRecap(roomId){
    tg15ClearRecap();const scope=tg15RecapScope();const data=await callRPC('karaoke_get_party_recap',{p_room:roomId});
    if(!tg15RecapCurrent(scope))return false;
    if(!data)throw new Error('Este placar não está disponível.');
    showPartyRecap(data,roomId,scope);return true;
  }
  async function tg30OfferFeedback(roomId){
    const serial=++tg30FeedbackSerial;const card=$('tg30-feedback-card'),form=$('tg30-feedback-form');
    tg30FeedbackContext=null;card.hidden=true;form.reset();form.hidden=false;$('tg30-feedback-status').textContent='';
    $('tg30-feedback-send').disabled=false;
    if(!roomId||!state.user?.id||!state.client)return;
    const userId=state.user.id;
    try{
      const info=await callRPC('tg30_party_feedback_status',{p_room:roomId});
      if(serial!==tg30FeedbackSerial||state.user?.id!==userId||!$('party-recap-dialog').open)return;
      if(info?.eligible!==true||info?.submitted===true)return;
      tg30FeedbackContext={roomId,userId,serial};card.hidden=false;
    }catch{/* avaliação indisponível não impede o placar nem o encerramento */}
  }
  async function tg30SubmitFeedback(event){
    event.preventDefault();const ctx=tg30FeedbackContext,button=$('tg30-feedback-send'),out=$('tg30-feedback-status');
    if(!ctx||state.user?.id!==ctx.userId||button.disabled)return;
    const rating=Number(new FormData(event.target).get('rating'));
    if(!Number.isInteger(rating)||rating<1||rating>5)return;
    button.disabled=true;out.textContent='Enviando sua avaliação…';
    try{
      const result=await callRPC('tg30_party_feedback_submit',{p_room:ctx.roomId,p_rating:rating,p_topic:$('tg30-feedback-topic').value||null});
      if(tg30FeedbackContext!==ctx||state.user?.id!==ctx.userId)return;
      if(!result?.submitted)throw Error('Avaliação não confirmada');
      event.target.hidden=true;out.textContent='Obrigada pelo close, estrela! Sua avaliação foi registrada. 💜';
    }catch{if(tg30FeedbackContext===ctx)out.textContent='Não consegui confirmar a avaliação. Tente novamente ou feche a cerimônia.';}
    finally{if(tg30FeedbackContext===ctx)button.disabled=false;}
  }
  function showPartyRecap(data,roomId,scope=tg15RecapScope()){
    if(!data||!tg15RecapCurrent(scope))return;
    tg15RecapContext=Object.freeze({...scope,roomId});
    tg15RememberRecap(roomId,scope.uid);state.latestRecap=data;
    $('tg15-share-flop').checked=false;
    $('recap-room-title').textContent=data?.room_title||'A festa de milhões';
    $('recap-total').textContent=String(Number(data?.songs_completed)||0);
    $('recap-scored').textContent=String(Number(data?.songs_scored)||0);
    $('recap-duets').textContent=String(Number(data?.duets_completed)||0);
    const ranked=Array.isArray(data?.podium)?data.podium:[];
    $('recap-podium').innerHTML=ranked.length?ranked.map((row,i)=>{
      const known=state.recapAvatars?.get(row.user_id)||state.avatars.get(row.user_id)||row.avatar;
      const picture=AVATARS[known]?`<img class="tg124-podium-avatar" src="${avatarSrc(known)}" alt="Avatar de ${escapeHTML(row.name||'Artista')}">`:'<span class="tg124-podium-avatar tg124-unknown-avatar" aria-label="Avatar não disponível">🎤</span>';
      return `<div class="recap-winner tg124-podium-place tg124-place-${i+1}"><span class="recap-medal">${['🥇','🥈','🥉'][i]}</span>${picture}<div><b>${escapeHTML(row.name||'Artista')}</b><small>Melhor nota • ${Number(row.songs_scored)||1} apresentação(ões)</small></div><strong>${Number(row.best_score)||0}/100</strong></div>`;
    }).join(''):'<p class="recap-muted">Sem notas válidas nesta festa. Ninguém vai levar zero por falha de sinal!</p>';
    const flop=data?.perrengue;
    $('recap-flop').hidden=!flop;
    if(flop){$('recap-flop-name').textContent=flop.name||'Estrela';$('recap-flop-score').textContent=(Number(flop.score)||0)+'/100';const known=state.recapAvatars?.get(flop.user_id)||state.avatars.get(flop.user_id)||flop.avatar;const img=$('tg124-flop-avatar');if(img){img.hidden=!AVATARS[known];if(AVATARS[known])img.src=avatarSrc(known);}}
    const dlg=$('party-recap-dialog');if(!dlg.open)dlg.showModal();
    void tg30OfferFeedback(roomId);
    if(ranked.length)confetti();
  }
  async function reopenLastRecap(){
    if(!state.client || !state.user){toast('Faça login para rever o placar.',true);return;}
    let roomId;try{roomId=localStorage.getItem('tem-gogo-last-recap-room:'+state.user.id);}catch{}
    if(!roomId){toast('Ainda não há festa encerrada neste aparelho.',true);return;}
    try{
      await tg15LoadRecap(roomId);
    }catch(error){toast(humanError(error),true);}
  }
  // O encerramento é uma operação de banco; nunca confundir recusa de autorização
  // com permissão do microfone, nem descartar o placar se a limpeza local falhar.
  function finalizePartyError(error){
    const code=String(error?.code||'');
    const message=String(error?.message||error||'');
    if(code==='42501'||/permission denied|row.level security|not authorized|insufficient.privilege/i.test(message))
      return 'O Supabase não autorizou o encerramento desta festa. Ela não foi marcada como encerrada. Confira se esta conta é a anfitriã; se persistir, verifique as permissões da função karaoke_finalize_party.';
    if(code==='P0001'&&/manuten|maintenance|bloquead/i.test(message)||/Tem Gogó em manutenção geral/i.test(message))
      return 'A manutenção geral está bloqueando o encerramento no banco. Desative a manutenção pela Central antes de tentar novamente.';
    if(code==='PGRST202'||/function.*karaoke_finalize_party.*(not found|does not exist)/i.test(message))
      return 'A função de encerramento não foi encontrada no Supabase. Confira a instalação do banco antes de tentar novamente.';
    if(/failed to fetch|network|fetch error/i.test(message))
      return 'Sem conexão com o Supabase. Confira a internet e tente novamente. Não é possível confirmar o encerramento agora.';
    const reference=code?' (código '+code+')':'';
    return 'Não foi possível confirmar o encerramento no Supabase'+reference+'. '+humanError(error);
  }
  async function exitStage(){
    if(state.emergencyBlocked)return;
    if(!canDirectDiva()||!state.room)return;
    if(!tg13Recreational()){toast('Use a aba Prêmios do festival para encerrar o palco competitivo após o resultado oficial.',true);return;}
    if(state.role==='remote'&&callActive()){toast('Finalize sua participação antes de encerrar a festa.',true);return;}
    const initialRoom=state.room.id,initialScope=tg07Scope();
    if(state.finishing){toast('Concluindo a música atual. Aguarde um instante para encerrar a festa.');return;}
    const solo=state.room.room_mode==='solo';
    if(!await window.TG_UI.confirm(solo?'Encerrar sua sessão Solo? As músicas pendentes serão encerradas.':'Encerrar a festa e apresentar o TOP 3? A fila será encerrada.',{title:solo?'Finalizar sessão':'Finalizar a festa',confirmText:solo?'Encerrar sessão':'Encerrar festa',danger:true}))return;
    if(state.emergencyBlocked||!tg07Current(initialScope)||!canDirectDiva()||!tg13Recreational()||state.room?.id!==initialRoom||state.finishing||(state.role==='remote'&&callActive()))return;
    const id=state.room.id,scope=tg07Scope();
    const button=$(state.role==='remote'?'tg04-remote-end':'stage-exit');
    state.finishing=true;
    if(button)button.disabled=true;
    try{
      let recap;
      try{
        // Só o retorno bem-sucedido da função no banco confirma a festa como encerrada.
        recap=await callRPC('karaoke_finalize_party',{p_room:id});
      }catch(error){
        console.error('Tem Gogó: falha ao encerrar festa no Supabase',{
          code:error?.code||null,message:error?.message||String(error),hint:error?.hint||null
        });
        if(tg07Current(scope)&&!state.emergencyClosing)toast(finalizePartyError(error),true);
        return;
      }
      // Depois do sucesso no banco, nenhuma falha de limpeza pode esconder o placar.
      if(!tg07Current(scope))return;tg15RememberRecap(id,scope.uid);
      try{state.player?.stopVideo();}catch(error){console.warn('Falha ao parar vídeo já encerrado',error);}
      const avatars=new Map(state.avatars),nextEpoch=tg07SessionEpoch+1;
      try{await stopSession();}catch(error){console.error('Festa encerrada no banco; falha ao limpar recursos locais',error);}
      if(state.user?.id!==scope.uid||tg07SessionEpoch!==nextEpoch||state.room)return;
      try{await openLobby();}catch(error){console.error('Festa encerrada no banco; falha ao atualizar Minhas festas',error);show('lobby');}
      if(state.user?.id!==scope.uid||tg07SessionEpoch!==nextEpoch||state.room)return;state.recapAvatars=avatars;
      try{if(solo)toast('Sessão Solo encerrada. Consulte o histórico quando quiser.');else showPartyRecap(recap,id);}catch(error){console.error('Festa encerrada; placar indisponível nesta tela',error);toast('A festa foi encerrada no Supabase, mas não foi possível abrir o placar. Use Rever último placar.',true);}
    }finally{
      if(tg07Current(scope)||!state.room){state.finishing=false;if(button)button.disabled=false;}
    }
  }
  async function logout(){
    if(tgR17PasswordPending){toast('Aguarde a operação de senha terminar.',true);return;}
    tgR17ClearPasswordContext();state.recoveryIntent=false;
    if(state.client){const {error}=await state.client.auth.signOut();if(error){toast(humanError(error),true);return;}}
    await stopSession();tg36ClearFavoriteIdentity();state.user=null;tg26FavoritePaint();
    sessionStorage.removeItem('tg20-auth-return-room');
    localStorage.removeItem('tem-gogo-pending-remote');
    localStorage.removeItem('tem-gogo-pending-room');
    state.inviteRoom=null;
    const cleanUrl=new URL('./',location.href);history.replaceState(null,'',cleanUrl.href);
    document.body.classList.remove('invite-active','entry-active','tg12-guest-mode');
    document.body.classList.add('tg12-login-mode');
    $('invite-welcome').hidden=true;$('access-tabs').hidden=false;
    $('tab-host').click();show('landing');
    $('auth-password').value='';toast('Você saiu da conta. Entre com outra ou crie uma conta.');
  }
  // ----- BETA 16: scanner, senhas e permissões ----
  function canDirectDiva(){return !!state.room && !!state.user && state.room.owner_id===state.user.id && (state.role==='host'||state.role==='remote');}
  async function persistRoomHumor(mode){
    if(!canDirectDiva())return;
    const {error}=await state.client.from('tg_room_settings').upsert({room_id:state.room.id,humor_mode:mode,updated_by:state.user.id},{onConflict:'room_id'});
    if(error){toast('Humor não sincronizado: instale a migration 023 e confirme as permissões da festa.',true);return;}
    toast('Humor da Diva sincronizado com o palco. 💅');
    // O host lê a configuração em tempo real e também durante o refresh periódico.
    if(state.role==='remote')await sendSignal(state.user.id,'host-room-humor',{mode}).catch(()=>{});
  }
  async function fetchRoomHumor(){
    if(!state.room || !state.client)return;
    const roomId=state.room.id;
    const {data,error}=await state.client.from('tg_room_settings').select('humor_mode,stage_theme').eq('room_id',roomId).maybeSingle();
    if(error||!data||state.room?.id!==roomId)return;
    if(THEMES.includes(data.stage_theme)){
      if(state.role==='host'&&data.stage_theme!==state.currentTheme)applyTheme(data.stage_theme,false,'stage');
      const sel=$('tg30-remote-stage-theme');if(state.role==='remote'&&sel&&document.activeElement!==sel&&!state.remotePending.size)sel.value=data.stage_theme;
    }
    if(['familia','debochado','caos','lgbt','reality','bafao'].includes(data.humor_mode) && data.humor_mode!==state.humorMode){
      state.humorMode=data.humor_mode;
      const select=$('humor-mode');if(select)select.value=state.humorMode;
      syncPrivateControls();updateVoxLine('opening');
    }
  }
  function syncPrivateControls(){
    $('tg-r22-tv-theme').hidden=!(state.role==='remote'&&canDirectDiva());
    const stage=state.role==='host'&&state.room;
    $('tg-r22-personal-heading').textContent=stage?'Tema do palco':'Tema deste aparelho';
    $('tg30-theme-scope').textContent=stage?'Tema compartilhado do palco. Os celulares dos convidados não mudam.':'Tema pessoal deste aparelho. Não altera a TV.';
    document.querySelectorAll('[data-host-only]').forEach(el=>el.hidden=!canDirectDiva());document.querySelectorAll('[data-diva-mode]').forEach(btn=>btn.classList.toggle('chosen',btn.dataset.divaMode===state.humorMode));}
  function updateGroupChoice(host){
    const p=host?'host':'guest',chosen=document.querySelector('input[name="'+p+'-mode"]:checked')?.value||'solo';
    const group=$(p+'-duet-choice');group.querySelector('.duet-person').hidden=chosen!=='duet';
    group.querySelector('.group-people').hidden=chosen!=='group';
    if(chosen==='group')refreshDuetOptions();
  }
  let qrStream=null,qrTimer=null,qrBusy=false;
  async function closeQrScan(){clearInterval(qrTimer);qrTimer=null;qrBusy=false;for(const t of qrStream?.getTracks()||[])t.stop();qrStream=null;const video=$('tg16-scan-video');video.srcObject=null;if($('tg16-scan-dialog').open)$('tg16-scan-dialog').close();}
  function readQrRoom(text){
    let room=normalizeRoom(text);
    try{const u=new URL(text);room=normalizeRoom(u.searchParams.get('room')||'');if(!['https:','http:'].includes(u.protocol))return null;}catch{}
    return validRoom(room)?room:null;
  }
  async function startQrScan(){
    if(!navigator.mediaDevices?.getUserMedia){toast('A câmera não está disponível: digite o código da TV.',true);return;}
    if(!('BarcodeDetector' in window)){toast('Leitor QR indisponível neste navegador. Aponte a câmera normal do celular para o QR da TV ou digite o código.',true);return;}
    const dlg=$('tg16-scan-dialog');$('tg16-scan-feedback').textContent='Aponte para o QR da TV. A câmera só é usada neste aparelho.';dlg.showModal();
    try{
      qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      const video=$('tg16-scan-video');video.srcObject=qrStream;await video.play();
      if(!('BarcodeDetector' in window)){$('tg16-scan-feedback').textContent='Este navegador não oferece leitura automática de QR. Use a câmera normal do celular para abrir o convite ou digite o código.';return;}
      const types=await BarcodeDetector.getSupportedFormats?.().catch(()=>[])||['qr_code'];
      if(!types.includes('qr_code')){$('tg16-scan-feedback').textContent='Leitura de QR não suportada neste navegador. Use a câmera padrão do celular ou digite o código.';return;}
      const detector=new BarcodeDetector({formats:['qr_code']});
      qrTimer=setInterval(async()=>{
        if(qrBusy||video.readyState<2||!dlg.open)return;
        qrBusy=true;
        try{const seen=await detector.detect(video);for(const scan of seen){const code=readQrRoom(scan.rawValue);if(code){await closeQrScan();if(await switchToInvitation(code)){toast('QR reconhecido! Escolha seu apelido e avatar.');}return;}}}catch(e){console.warn('Leitor QR:',e);}finally{qrBusy=false;}
      },350);
    }catch(err){$('tg16-scan-feedback').textContent='Não foi possível ativar a câmera. Verifique a permissão e use o código da festa.';for(const t of qrStream?.getTracks()||[])t.stop();qrStream=null;}
  }
  let recoveryMode=false,tgR17RecoveryUid=null,tgR17PasswordContext=null,tgR17PasswordPending=null,tgR17ResetPending=false,tgR17ResetUntil=0;
  function tgR17ResetPasswordFields(){
    $('tg16-password-form').reset();
    for(const id of ['tg16-old-password','tg16-new-password','tg16-confirm-password'])$(id).type='password';
    $('tg192-show-password').checked=false;
  }
  function tgR17ClearPasswordContext(){
    tgR17RecoveryUid=null;state.recoveryVerified=false;recoveryMode=false;tgR17PasswordContext=null;
    if($('tg16-password-dialog').open)$('tg16-password-dialog').close();
    tgR17ResetPasswordFields();$('tg192-recovery-caption').hidden=true;$('tg16-password-title').textContent='Trocar senha';
  }
  function openPasswordDialog(recovery=false){
    if(tgR17PasswordPending)return;
    if(recovery&&(!state.recoveryVerified||tgR17RecoveryUid!==state.user?.id)){toast('Este link de recuperação não foi validado. Peça um novo e-mail.',true);return;}
    if(!state.user||isAnonymous(state.user)){toast('Para trocar senha, entre com uma conta de e-mail.',true);return;}
    if($('tg16-password-dialog').open&&tgR17PasswordContext?.uid===state.user.id&&tgR17PasswordContext.recovery===recovery)return;
    recoveryMode=recovery;tgR17PasswordContext={uid:state.user.id,epoch:tg07SessionEpoch,recovery};tgR17ResetPasswordFields();
    $('tg16-old-label').hidden=recovery;$('tg16-old-password').hidden=recovery;$('tg16-old-password').required=!recovery;
    $('tg16-password-feedback').textContent='';if(!$('tg16-password-dialog').open)$('tg16-password-dialog').showModal();
  }
  async function submitNewPassword(event){
    event.preventDefault();if(!checkBackend()||tgR17PasswordPending)return;
    const context=tgR17PasswordContext,dlg=$('tg16-password-dialog'),feedback=$('tg16-password-feedback'),current=$('tg16-old-password').value,pwd=$('tg16-new-password').value;
    const valid=()=>!!context&&tgR17PasswordContext===context&&dlg.open&&state.user?.id===context.uid&&tg07SessionEpoch===context.epoch&&!isAnonymous(state.user)&&(!context.recovery||(state.recoveryVerified&&tgR17RecoveryUid===context.uid));
    if(!valid()){feedback.textContent='Abra novamente a troca de senha com sua conta atual.';return;}
    if(pwd!==$('tg16-confirm-password').value){feedback.textContent='As novas senhas não coincidem.';return;}
    if(pwd.length<10||!/[A-Za-zÀ-ÿ]/.test(pwd)||!/[0-9]/.test(pwd)){feedback.textContent='Use pelo menos 10 caracteres, com letras e números.';return;}
    const button=$('tg16-password-form').querySelector('[type=submit]');tgR17PasswordPending=context;setLoading(button,true,'Salvando…');$('tg16-password-close').disabled=true;
    try{
      if(!context.recovery){const email=state.user?.email;if(!email||!current)throw new Error('Digite sua senha atual.');const {data,error}=await state.client.auth.signInWithPassword({email,password:current});if(error||data?.user?.id!==context.uid)throw new Error('Não foi possível confirmar a senha atual.');}
      if(!valid())return;
      const {error}=await state.client.auth.updateUser({password:pwd});if(error)throw error;
      if(!valid())return;
      const wasRecovery=context.recovery;
      const url=new URL(location.href),returnRoom=normalizeRoom(url.searchParams.get('remote')==='1'?null:url.searchParams.get('room')||sessionStorage.getItem('tg20-auth-return-room'));
      localStorage.removeItem('tem-gogo-upgrading-account');tgR17ClearPasswordContext();state.recoveryIntent=false;$('access-tabs').hidden=false;toast('Senha atualizada com sucesso! 🔒');
      if(wasRecovery){sessionStorage.removeItem('tg20-auth-return-room');const clean=new URL('./',location.href);if(validRoom(returnRoom))clean.searchParams.set('room',returnRoom);history.replaceState(null,'',clean.href);if(validRoom(returnRoom))showGuestEntry(returnRoom);else await openLobby();}
    }catch(e){if(valid())feedback.textContent=humanError(e);}
    finally{if(tgR17PasswordPending===context){tgR17PasswordPending=null;setLoading(button,false);$('tg16-password-close').disabled=false;}}
  }
  async function forgotPassword(){
    if(!checkBackend()||tgR17ResetPending)return;
    const input=$('auth-email'),email=input.value.trim();if(!email||!input.checkValidity()||!email.includes('@')){toast('Digite um e-mail válido no campo acima.',true);return;}
    if(Date.now()<tgR17ResetUntil){toast('Aguarde um minuto antes de solicitar outro link.');return;}
    const button=$('auth-forgot-password');tgR17ResetPending=true;tgR17ResetUntil=Date.now()+60000;button.disabled=true;
    try{
      const target=new URL('./index.html?auth=recovery',location.href),url=new URL(location.href);
      const room=normalizeRoom(url.searchParams.get('remote')==='1'||localStorage.getItem('tem-gogo-pending-remote')?null:url.searchParams.get('room')||sessionStorage.getItem('tg20-auth-return-room')||state.inviteRoom);
      if(validRoom(room))target.searchParams.set('room',room);
      const {error}=await state.client.auth.resetPasswordForEmail(email,{redirectTo:target.href});
      if(error&&(error.status===429||Number(error.status)>=500||/network|failed to fetch|rate limit/i.test(error.message||'')))throw error;
      toast('Se o endereço tiver conta, você receberá instruções para redefinir a senha.');
    }catch(e){toast('Não foi possível solicitar o link agora. Aguarde e tente novamente.',true);}
    finally{tgR17ResetPending=false;button.disabled=false;}
  }
  function setupProfileQuickMenu(){
    const dlg=$('tg124-profile-menu');if(!dlg)return;
    document.querySelectorAll('[data-tg124-profile]').forEach(button=>{button.addEventListener('click',()=>{if(!dlg.open)dlg.showModal();});if(button.tagName!=='BUTTON'&&button.getAttribute('role')==='button')button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();button.click();}});});
    $('tg124-profile-close')?.addEventListener('click',()=>dlg.close());
    dlg.querySelectorAll('[data-tg124-action]').forEach(button=>button.addEventListener('click',async()=>{
      const action=button.dataset.tg124Action;dlg.close();
      if(action==='edit'){if(state.role==='remote')$('tg18-remote-rename')?.click();else if(state.role==='guest')$('edit-guest-profile')?.click();else $('tg20-host-profile-dialog')?.showModal();}
      else if(action==='privacy'){window.TG_BETA_OPEN_TAB?.('profile');}
      else if(action==='history'){await showPersonalHistory();}
      else if(action==='change')await goToMyRooms();
      else if(action==='leave'){
        if(state.role==='guest')$('leave-party')?.click();
        else if(state.role==='host'||state.role==='remote')await goToMyRooms();
        else show('landing');
      }else if(action==='logout'){
        if(await window.TG_UI.confirm('Sair da conta neste aparelho?',{title:'Sair da conta',confirmText:'Sair'}))await logout();
      }else if(action==='help'){document.querySelector('[data-tg193-faq]')?.click();}
    }));
  }
  const tgR16CuratePending=new Map();
  function tgR16CurateAllowed(scope,videoId){return tg07Current(scope)&&!state.emergencyBlocked&&state.room?.status==='open'&&state.catalog.some(v=>v.video_id===videoId);}
  function tgR16BeginCurate(scope,kind,videoId){
    const key=scope.uid+':'+kind+':'+videoId;
    if(tgR16CuratePending.has(key)){toast('Aguarde a sugestão anterior.');return null;}
    const ticket={key,scope};tgR16CuratePending.set(key,ticket);return ticket;
  }
  function tgR16EndCurate(ticket){if(tgR16CuratePending.get(ticket.key)===ticket)tgR16CuratePending.delete(ticket.key);}
  async function sendTitleSuggestion(videoId,currentTitle,scope=tg07Scope(),button=null){
    if(!tgR16CurateAllowed(scope,videoId)){toast('Abra novamente a biblioteca para sugerir uma correção.',true);return;}
    const ticket=tgR16BeginCurate(scope,'title',videoId);if(!ticket)return;
    if(button)button.disabled=true;
    try{
      const suggestion=await window.TG_UI.prompt('Sugira o nome completo desta música. Sua sugestão será analisada pela Central; nada será alterado agora.',currentTitle,'Sugerir correção de título');
      if(!tgR16CurateAllowed(scope,videoId)||typeof suggestion!=='string'||suggestion.trim()===currentTitle)return;
      const title=suggestion.trim();if(title.length<4||title.length>160){toast('O título deve conter de 4 a 160 caracteres.',true);return;}
      const {error}=await state.client.from('tg_title_suggestions').insert({video_id:videoId,original_title:currentTitle,proposed_title:title,author_id:scope.uid,room_id:scope.room});
      if(error)throw error;
      if(tg07Current(scope))toast('Sugestão enviada! A Central decidirá se será publicada.');
    }catch{if(tg07Current(scope))toast('Não foi possível confirmar o envio. Confira sua conexão e participação na sala.',true);}
    finally{tgR16EndCurate(ticket);if(button)button.disabled=false;}
  }
  function setupCatalogSuggestions(){
    for(const holder of ['catalog-list','guest-library','stage-library','search-results','host-results'])$(holder)?.addEventListener('click',event=>{
      const btn=event.target.closest('[data-tg124-suggest]');if(!btn)return;
      void sendTitleSuggestion(btn.dataset.tg124Suggest,btn.dataset.originalTitle);
    });
  }
  function attachEvents(){
    setupProfileQuickMenu();setupCatalogSuggestions();
    window.TG30VoiceUI?.install({user:()=>state.user,notify:(text)=>toast(text,true),compare:()=>callRPC('tg30_voice_shadow_history',{}),erase:async()=>{tg30RevokeShadow();return callRPC('tg30_voice_shadow_erase',{});},revoke:tg30RevokeShadow,save:async(profile,uid)=>{
      if(!state.user||state.user.id!==uid)throw Error('Sessão alterada');
      if(isAnonymous(state.user)){sessionStorage.setItem('tg30-voice:'+uid,JSON.stringify(profile));return;}
      const {data,error}=await state.client.auth.updateUser({data:{tg_voice_profile:profile}});
      if(error||data?.user?.id!==uid||state.user?.id!==uid)throw error||Error('Sessão alterada');
      state.user=data.user;
    }});
    $('tg124-choice-close')?.addEventListener('click',()=>$('tg124-choice-dialog')?.close());
    document.querySelectorAll('[data-scan-qr]').forEach(b=>b.addEventListener('click',startQrScan));
    $('tg16-scan-close').addEventListener('click',closeQrScan);$('tg16-scan-manual').addEventListener('click',closeQrScan);
    $('tg16-scan-dialog').addEventListener('close',()=>void closeQrScan());
    $('account-password-open').addEventListener('click',()=>openPasswordDialog());
    $('tg16-password-close').addEventListener('click',()=>$('tg16-password-dialog').close());
    $('tg16-password-dialog').addEventListener('cancel',event=>{if(tgR17PasswordPending)event.preventDefault();});
    $('tg16-password-dialog').addEventListener('close',()=>{if(!$('tg16-password-dialog').open){tgR17PasswordContext=null;recoveryMode=false;tgR17ResetPasswordFields();}});
    $('tg16-password-form').addEventListener('submit',submitNewPassword);$('tg192-show-password').addEventListener('change',e=>{for(const id of ['tg16-old-password','tg16-new-password','tg16-confirm-password'])$(id).type=e.target.checked?'text':'password';});
    $('auth-forgot-password').addEventListener('click',forgotPassword);
    for(const host of [true,false]){
      const prefix=host?'host':'guest';
      document.querySelectorAll('input[name="'+prefix+'-mode"]').forEach(r=>r.addEventListener('change',()=>updateGroupChoice(host)));
      updateGroupChoice(host);
    }
    document.querySelectorAll('[data-diva-mode]').forEach(b=>b.addEventListener('click',()=>{
      if(!canDirectDiva()){toast('A direção do humor é exclusiva do anfitrião.',true);return;}
      state.humorMode=b.dataset.divaMode;$('humor-mode').value=state.humorMode;syncPrivateControls();updateVoxLine('opening');void persistRoomHumor(state.humorMode);
    }));
    $('tg17-send-message').addEventListener('click',()=>void sendGuestRecado());
    $('tg17-dictate').addEventListener('click',dictateGuestRecado);
    $('tg17-message-close').addEventListener('click',()=>tgR15FinishRecado(tgR15RecadoTicket));
    $('tg16-mic-shortcut').addEventListener('click',()=>switchMobileTab('mic'));
    $('tg16-queue-shortcut').addEventListener('click',()=>switchMobileTab('queue'));
    $('tg16-score-shortcut').addEventListener('click',openScoreboard);

    $('invite-install').addEventListener('click',installFromInvite);
    $('guest-install').addEventListener('click',installFromInvite);
    $('entry-install').addEventListener('click',installFromInvite);
    $('invite-continue').addEventListener('click',()=>showGuestEntry(state.inviteRoom));
    $('hub-join-room').addEventListener('click',()=>void switchToInvitation(''));
    $('guest-switch').addEventListener('click',goToMyRooms);
    $('stage-switch').addEventListener('click',goToMyRooms);
    $('copy-room-invite').addEventListener('click',async()=>{
      const saved=tgR18ReadyRoom();if(!saved)return;
      const {room}=saved;
      const text=`🎤 Tem Gogó — ${room.title}\nConvite: ${currentURL(room.code)}\nCódigo: ${room.code}\nEscaneie, escolha seu apelido e avatar. Não precisa de senha!`;
      try{await navigator.clipboard.writeText(text);toast('Convite copiado! Envie só para quem foi chamado. 🎟️');}
      catch{toast('Copiar indisponível; compartilhe o endereço ou o QR do palco.',true);}
    });
    $('ready-open-stage').addEventListener('click',async()=>{
      const saved=tgR18ReadyRoom();
      tgR18ClearReadyRoom();
      if(saved)await enterRoomAsHost(saved.room,{narration:saved.narration===true});
    });
    $('room-ready-dialog').addEventListener('cancel',e=>{e.preventDefault();toast('Toque em Abrir palco para mostrar o QR da festa.');});
    $('video-error-close').addEventListener('click',()=>$('video-error-dialog').close());
    $('video-replace').addEventListener('click',()=>{
      const s=state.failedVideoSong||state.currentSong;
      $('video-error-dialog').close();
      $('host-search').value=(s?.title||'').replace(/karaok[eê]/ig,'').trim().slice(0,90);
      $('song-dialog').showModal();
    });
    $('video-skip').addEventListener('click',skipFailedVideo);
    $('video-retry').addEventListener('click',()=>{
      $('video-error-dialog').close();
      if(state.emergencyBlocked)return;
      if(state.currentSong?.video_id&&state.playerReady)state.player.loadVideoById(state.currentSong.video_id);
      else if(state.failedVideoSong)startSong(state.failedVideoSong);
    });
    $('tab-host').addEventListener('click',()=>{
      $('tab-host').classList.add('active');$('tab-guest').classList.remove('active');
      $('tab-host').setAttribute('aria-selected','true');$('tab-guest').setAttribute('aria-selected','false');
      $('host-access').hidden=false;$('guest-access').hidden=true;
      document.body.classList.remove('entry-active');
    });
    $('tab-guest').addEventListener('click',()=>openGuestEntry($('guest-code').value));
    $('auth-form').addEventListener('submit',login);
    $('signup-button').addEventListener('click',openSignup);
    $('auth-resend-confirmation').addEventListener('click',()=>void tg30ResendConfirmation('login'));
    $('signup-resend-confirmation').addEventListener('click',()=>void tg30ResendConfirmation('signup'));
    $('tg30-feedback-form').addEventListener('submit',tg30SubmitFeedback);
    $('tg30-feedback-skip').addEventListener('click',()=>{$('tg30-feedback-card').hidden=true;});
    $('signup-form').addEventListener('submit',signup);
    $('signup-close').addEventListener('click',closeSignup);
    $('signup-back-login').addEventListener('click',()=>{closeSignup();$('auth-email').focus();});
    $('signup-show-password').addEventListener('change',event=>{
      ['signup-password','signup-confirm'].forEach(id=>$(id).type=event.target.checked?'text':'password');
    });
    $('tg92-hub-create')?.addEventListener('click',()=>void tg12ModeAvailability());
    $('guest-entry-form').addEventListener('submit',joinParty);$('create-room-form').addEventListener('submit',makeRoom);
    document.querySelectorAll('.duet-choice').forEach(group=>{
      group.addEventListener('change',()=>updateGroupChoice(group.id.startsWith('host')));
    });
    $('logout-button').addEventListener('click',logout);
    $('stage-exit').addEventListener('click',exitStage);
    $('tg04-remote-end').addEventListener('click',exitStage);
    $('tg04-remote-rank').addEventListener('click',openScoreboard);
    $('tg04-remote-status').addEventListener('click',()=>void remoteCommand('stage-status'));
    $('tg04-remote-invite').addEventListener('click',()=>{if(state.role==='remote'&&state.room)void window.TG_UI.shareLink('Venha cantar no Tem Gogó!',currentURL(state.room.code));});
    for(const [input,button] of [['tg04-remote-message','tg04-remote-send'],['tg04-stage-message','tg04-stage-send']])$(button).addEventListener('click',()=>void sendHostRecado(input,button));
    for(const type of ['click','pointerup','keydown'])document.addEventListener(type,tg88StageAudioGesture,true);
    $('tg89-sound-allow').addEventListener('click',tg89AllowSound);$('tg89-sound-later').addEventListener('click',tg89CloseSound);$('tg89-sound-dialog').addEventListener('cancel',()=>{tg89SoundScope=null;});
    $('play-pause').addEventListener('click',togglePlayback);
    $('skip-track').addEventListener('click',advanceSong);
    $('theme-cycle').addEventListener('click',themeCycle);
    document.querySelectorAll('.open-settings').forEach(button=>button.addEventListener('click',()=>{syncPrivateControls();const d=$('settings-dialog');if(!d.open){d.showModal();d.querySelector('.modal-inner')?.scrollTo({top:0,behavior:'instant'});$('settings-close')?.focus({preventScroll:true});}}));
    $('settings-close').addEventListener('click',()=>$('settings-dialog').close());
    $('settings-done').addEventListener('click',()=>$('settings-dialog').close());
    document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>void chooseTheme(button.dataset.themeChoice)));
    $('tg05-theme-reset')?.addEventListener('click',()=>void chooseTheme('glam'));
    $('humor-mode').addEventListener('change',e=>{if(!canDirectDiva())return;state.humorMode=e.target.value;syncPrivateControls();updateVoxLine('opening');void persistRoomHumor(state.humorMode);});
    $('gifs-enabled').addEventListener('change',e=>{state.gifsEnabled=e.target.checked;localStorage.setItem('tem-gogo-gifs',String(state.gifsEnabled));});
    $('effects-enabled').addEventListener('change',e=>{state.effectsEnabled=e.target.checked;localStorage.setItem('tem-gogo-effects',String(state.effectsEnabled));document.body.classList.toggle('effects-off',!state.effectsEnabled);});
    $('settings-contrast').addEventListener('change',e=>toggleContrast(e.target.checked));
    $('contrast-toggle').addEventListener('click',()=>toggleContrast(!document.body.classList.contains('high-contrast')));
    $('tg103-solo-entry')?.addEventListener('click',startSingleDeviceMode);
    $('tg18-solo-button').addEventListener('click',()=>void toggleSoloMic());$('tg192-solo-off').addEventListener('click',()=>void toggleSoloMic());
    $('tg18-remote-open').addEventListener('click',()=>{
      if(!state.room)return;
      const url=new URL(currentURL(state.room.code));url.searchParams.set('remote','1');
      const message='Abra ESTE endereço no celular, entre na mesma conta e escolha a aba Controle: '+url.href;
      if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url.href).then(()=>toast('📱 Link do controle copiado! Abra no seu celular.')).catch(()=>void window.TG_UI.shareLink(message,url.href));}
      else void window.TG_UI.shareLink(message,url.href);
    });
    $('tg18-remote-back').addEventListener('click',()=>void goToMyRooms());
    $('tg18-remote-music').addEventListener('click',()=>{if(!canDirectDiva()||state.role!=='remote'){toast('Reconecte o controle com a conta anfitriã.',true);return;}void openFullCatalog();});
    $('tg18-remote-rename').addEventListener('click',()=>void renameRemoteSinger());
    $('tg19-tab-control').addEventListener('click',()=>switchRemoteTab('control'));
    $('tg19-tab-singing').addEventListener('click',()=>switchRemoteTab('singing'));
    $('tg19-remote-queue-list').addEventListener('click',event=>{
      const prepare=event.target.closest('[data-tg19-prepare]');
      if(prepare){void remoteCommand('prepare-song',null,prepare.dataset.tg19Prepare);return;}
      const remove=event.target.closest('[data-tg19-remove]');
      if(remove)void remoteRemoveSong(remove.dataset.tg19Remove);
    });
    $('tg18-remote-stage').addEventListener('click',()=>void tgR15RequestStage());
    $('tg18-remote-mic-toggle').addEventListener('click',()=>void toggleMic());
    $('tg18-remote-mic-ready').addEventListener('click',openMicPermission);
    document.querySelectorAll('[data-tg18-command]').forEach(b=>b.addEventListener('click',()=>void remoteCommand(b.dataset.tg18Command)));
    $('tg30-remote-stage-theme-send')?.addEventListener('click',()=>void remoteCommand('stage-theme',$('tg30-remote-stage-theme').value));
    for(const [id,cmd] of [['tg18-remote-playback','playback-volume'],['tg18-remote-mics','mic-volume'],['tg04-remote-diva','diva-preview-volume'],['tg05-remote-pop','pop-volume']])$(id).addEventListener('change',e=>void remoteCommand(cmd,Number(e.target.value)));
    $('tg19-remote-vocal-gain').addEventListener('input',event=>{const value=Number(event.target.value);$('guest-mic-gain').value=String(value);$('guest-mic-gain').dispatchEvent(new Event('input',{bubbles:true}));});
    $('tg18-turn-mic').addEventListener('click',()=>{if(state.role==='guest')switchMobileTab('mic');openMicPermission();});
    $('tg18-turn-ready').addEventListener('click',openMicPermission);
    $('tg18-turn-dismiss').addEventListener('click',()=>{closeGuestCall();if(state.role==='guest')switchMobileTab('mic');else renderRemoteMic();});
    $('tg18-account-cta').addEventListener('click',()=>$('tg18-account-dialog').showModal());
    $('tg18-account-close').addEventListener('click',()=>$('tg18-account-dialog').close());
    $('tg18-account-form').addEventListener('submit',saveGuestIdentity);
    $('tg18-account-history').addEventListener('click',showPersonalHistory);
    $('tg18-account-password').addEventListener('click',()=>{if(isAnonymous(state.user)){toast('Confirme seu e-mail antes de definir uma senha.',true);return;}openPasswordDialog(localStorage.getItem('tem-gogo-upgrading-account')==='1');});
    $('tg18-install').addEventListener('click',installFromInvite);
    $('tg18-history-close').addEventListener('click',()=>$('tg18-history-dialog').close());
    $('tg18-history-dialog').addEventListener('close',()=>{if(!$('tg18-history-dialog').open){++tgR09HistorySerial;$('tg18-history-list').replaceChildren();}});
    $('tg18-push-cta').addEventListener('click',enableTurnPush);
    $('tg19-push-shortcut').addEventListener('click',enableTurnPush);
    $('tg19-remote-push').addEventListener('click',enableTurnPush);
    $('fullscreen-button').addEventListener('click',async()=>{
      try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();}
      catch{toast('Tela cheia não disponível neste navegador.',true);}
    });
    $('ranking-full-link').addEventListener('click',openScoreboard);
    $('playback-volume-range').addEventListener('input',event=>{
      state.playbackVolume=Math.round(Number(event.target.value));
      $('playback-volume-label').textContent=state.playbackVolume+'%';
      localStorage.setItem('tem-gogo-playback-volume',String(state.playbackVolume));
      try{if(state.playerReady)state.player?.setVolume(state.playbackVolume);}catch(err){console.warn('Volume YouTube:',err);}
    });
    $('guest-mic-gain').addEventListener('input',event=>{
      const value=Math.round(Number(event.target.value));
      state.guestMicGain=value/100;
      $('guest-mic-gain-value').textContent=value+'%';
      if(state.micGainNode)state.micGainNode.gain.setTargetAtTime(state.guestMicGain,state.localAudioContext.currentTime,.015);
      localStorage.setItem('tem-gogo-mic-send-volume',String(value));
    });
    $('volume-range').addEventListener('input',event=>{
      state.masterGain=Number(event.target.value)/100;
      $('volume-label').textContent=event.target.value+'%';
      state.peers.forEach(record=>{if(record.gain)record.gain.gain.value=state.masterGain;});
    });
    $('queue-list').addEventListener('click',async e=>{
      const remove=e.target.closest('[data-remove-song]');
      if(remove){
        const target=state.songs.find(s=>s.id===remove.dataset.removeSong);
        if(!target||!await window.TG_UI.confirm('Tirar esta música da fila?',{title:'Organizar fila',confirmText:'Remover música',danger:true}))return;
        callRPC('karaoke_remove_song',{p_room:state.room.id,p_song:target.id})
          .then(()=>{toast('Música retirada da fila.');queueChanged();})
          .catch(err=>toast(humanError(err),true));
        return;
      }
      const button=e.target.closest('[data-play-song]');if(button){const song=state.songs.find(s=>s.id===button.dataset.playSong);if(song)void prepareSong(song);}
    });
    $('open-add-song').addEventListener('click',()=>$('song-dialog').showModal());
    $('playlist-import-submit').addEventListener('click',importPlaylistManual);
    $('open-scoreboard').addEventListener('click',openScoreboard);
    $('reopen-recap').addEventListener('click',reopenLastRecap);
    $('recap-copy').addEventListener('click',async()=>{if(!tg15RecapToken())return;const content=recapText(state.latestRecap,$('tg15-share-flop').checked);try{await navigator.clipboard.writeText(content);toast('Placar copiado! Compartilha com o povo! 🏆');}catch{toast('Não foi possível copiar automaticamente.',true);}});
    $('recap-done').addEventListener('click',()=>$('party-recap-dialog').close());
    $('party-recap-dialog').addEventListener('close',()=>{if(!$('party-recap-dialog').open&&tg15RecapContext)tg15ClearRecap();});
    document.querySelectorAll('[data-close-score]').forEach(btn=>btn.addEventListener('click',()=>$('score-dialog').close()));
    $('host-song-form').addEventListener('submit',e=>{e.preventDefault();enqueue(e.target,true);});
    $('guest-song-form').addEventListener('submit',e=>{e.preventDefault();enqueue(e.target,false);});
    document.querySelectorAll('[data-catalog-open]').forEach(btn=>btn.addEventListener('click',openFullCatalog));
    $('catalog-close').addEventListener('click',()=>$('catalog-dialog').close());
    let catalogDebounce=null;
    $('catalog-search').addEventListener('input',e=>{
      clearTimeout(catalogDebounce);catalogDebounce=setTimeout(()=>{
        state.catalogQuery=e.target.value;state.catalogPage=1;renderFullCatalog();
      },100);
    });
    $('tg26-favorite-refresh').addEventListener('click',()=>void tg26LoadFavorites(true));
    $('tg28-favorites-quick')?.addEventListener('click',()=>{if(!tg26FavoriteAccount())return;const filter=$('catalog-filter');filter.value=state.catalogFilter==='favorites'?'all':'favorites';filter.dispatchEvent(new Event('change',{bubbles:true}));});
    $('catalog-filter').addEventListener('change',e=>{
      state.catalogFilter=e.target.value;state.catalogPage=1;renderFullCatalog();
    });
    $('catalog-more').addEventListener('click',()=>{state.catalogPage++;renderFullCatalog();});
    $('tg07-external-search').addEventListener('click',()=>void searchYoutube(state.role==='host',true,true));
    $('tg07-external-query').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void searchYoutube(state.role==='host',true,true);}});
    $('tg07-link-form').addEventListener('submit',async e=>{e.preventDefault();const scope=tg07Scope(),btn=$('tg07-link-check'),id=youtubeId($('tg07-link').value),title=$('tg07-link-title').value.trim();if(btn.disabled)return;if(!tg07Current(scope)||!id||!title){toast('Informe um link do YouTube e o título.',true);return;}setLoading(btn,true,'Verificando…');try{let playable=null;try{playable=await checkVideoAvailability(id);}catch{}if(!tg07Current(scope)||!$('catalog-dialog').open)return;if(playable===false){toast('Este vídeo não permite reprodução incorporada. Escolha outra versão.',true);return;}const holder=$('tg07-external-results');holder.replaceChildren();const note=document.createElement('p');note.textContent=playable===true?'Vídeo verificado; escolha quem vai cantar.':'Disponibilidade não confirmada. O vídeo ainda pode ser bloqueado pelo YouTube.';holder.append(note);const card=catalogCard({video_id:id,title,plays:0,source_kind:'external'},state.role==='host');if(card)holder.append(card);}finally{setLoading(btn,false);}});
    $('tg07-catalog-refresh').addEventListener('click',async e=>{const btn=e.currentTarget;if(btn.disabled)return;setLoading(btn,true,'Atualizando…');try{await loadCatalog(true);renderFullCatalog();}finally{setLoading(btn,false);}});
    $('search-youtube').addEventListener('click',()=>searchYoutube(false));
    $('host-search-button').addEventListener('click',()=>searchYoutube(true));
    $('youtube-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchYoutube(false);}});
    $('host-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchYoutube(true);}});
    $('stage-preflight-start').addEventListener('click',()=>void startPreparedSong());
    $('stage-preflight-override').addEventListener('click',()=>void startPreparedSong(true));
    $('stage-preflight-cancel').addEventListener('click',()=>clearHostPreflight());
    $('stage-preflight-resend').addEventListener('click',()=>{updateVoxLine('reminder');if(state.preflight&&state.humorMode!=='familia')void window.TG74_DIVA_STUDIO?.announce('espera','espera:'+state.room.id+':'+state.preflight.token,state.preflight.song.id);void sendPreflightInvites(true);});
    $('guest-preflight-mic').addEventListener('click',()=>{switchMobileTab('mic');openMicPermission();});
    $('guest-preflight-ready').addEventListener('click',openMicPermission);
    $('mobile-tab-score').addEventListener('click',openScoreboard);
    $('guest-all-scores').addEventListener('click',openScoreboard);
    $('edit-guest-profile').addEventListener('click',()=>{$('guest-profile-name').value=$('guest-display-name').textContent;$('guest-profile-dialog').showModal();});
    $('guest-profile-form').addEventListener('submit',event=>{void editGuestProfile(event);});
    $('guest-profile-close').addEventListener('click',()=>$('guest-profile-dialog').close());
    for(const id of ['open-stage-faq','open-guest-faq'])$(id).addEventListener('click',()=>$('faq-dialog').showModal());
    for(const id of ['faq-close','faq-done'])$(id).addEventListener('click',()=>$('faq-dialog').close());
    $('mic-toggle').addEventListener('click',toggleMic);
    $('mic-confirm-permission').addEventListener('click',()=>{$('mic-permission-dialog').close();openMicPermission();});
    $('mic-cancel-permission').addEventListener('click',()=>$('mic-permission-dialog').close());
    $('go-mic-now').addEventListener('click',()=>{switchMobileTab('mic');$('mic-toggle').focus({preventScroll:true});});
    $('leave-party').addEventListener('click',leaveGuest);
    $('mobile-tab-mic').addEventListener('click',()=>switchMobileTab('mic'));
    $('mobile-tab-queue').addEventListener('click',()=>switchMobileTab('queue'));
    $('final-close').addEventListener('click',advanceSong);
    for(const button of document.querySelectorAll('[data-tg123-host-command]')){
      button.addEventListener('click',async()=>{
        const cmd=button.dataset.tg123HostCommand;
        if(state.role!=='host')return;
        if(cmd==='toggle'){$('play-pause')?.click();return;}
        if(cmd==='next'){$('skip-track')?.click();return;}
        if(cmd==='volumes'){$('tg17-console')?.scrollIntoView({block:'nearest'});$('playback-volume-range')?.focus({preventScroll:true});return;}
        if(cmd==='call'){
          if(state.preflight){$('stage-preflight-resend')?.click();return;}
          const queued=state.songs.find(s=>s.status==='queued');
          if(!queued){toast('Ainda não há músicas na fila.',true);return;}
          await prepareSong(queued);return;
        }
      });
    }
    $('tg123-after-prepare')?.addEventListener('click',async()=>{
      $('tg123-post-score').hidden=true;
      const queued=state.songs.find(s=>s.status==='queued');
      if(queued)await prepareSong(queued);else toast('A fila está vazia. Escolha outra música.',true);
    });
    $('tg123-after-call')?.addEventListener('click',async()=>{
      $('tg123-post-score').hidden=true;
      if(state.preflight){await sendPreflightInvites(true);toast('Aviso reenviado ao cantor.');return;}
      const queued=state.songs.find(s=>s.status==='queued');
      if(queued)await prepareSong(queued);else toast('Nenhum cantor na fila ainda.',true);
    });
    $('qr-bubble').addEventListener('click',()=> $('qr-bubble').classList.toggle('qr-expanded'));
    $('qr-bubble').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('qr-bubble').classList.toggle('qr-expanded');}});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void tg38Reconnect(false);});
    window.addEventListener('online',()=>{void tg38Reconnect(true);});
    window.addEventListener('offline',()=>{if(state.room)tg23Suspend('Conexão interrompida. Não foi possível confirmar a segurança do palco.','connection');setSyncStatus('offline');toast('Sem internet: o palco e a fila podem parar.',true);});
    window.addEventListener('popstate',event=>{
      if(state.role==='guest'&&state.room){
        if(event.state?.view==='guest'&&['mic','queue'].includes(event.state.tab)){switchMobileTab(event.state.tab,false);return;}
        history.pushState({temGogo:true,view:'guest',tab:'queue'},'',currentURL(state.room.code));switchMobileTab('queue',false);
        toast('Você continua na festa. Para sair, use “Sair desta festa”.');
      }
    });
  }
  // BETA 1.0.4 — Cockpit modular do host: MOVE nós existentes, preserva IDs,
  // listeners, playback YouTube, microfones, QR, ranking, fila e políticas.
  function setupHostCockpit(){
    const stage=$('stage'),layout=stage?.querySelector('.stage-layout'),main=stage?.querySelector('.stage-main');
    if(!layout||!main||$('tg104-cockpit'))return;
    const rail=stage.querySelector('.qr-rail'),remote=stage.querySelector('.tg19-host-remote-card'),queue=stage.querySelector('.stage-sidebar'),rank=stage.querySelector('.stage-rank-panel'),catalog=stage.querySelector('.stage-hit-library'),tools=stage.querySelector('.tg19-stage-tool-grid'),help=stage.querySelector('.tg19-stage-footer > .tg193-help-tools'),ad=stage.querySelector('.tg192-bora-ad'),consoleNode=$('tg17-console'),bar=$('tg123-host-bar'),post=$('tg123-post-score');
    if(!rail||!remote||!queue||!rank||!consoleNode||!bar||!catalog||!tools)throw Error('Estrutura do palco incompatível.');
    const element=(tag,cls,label)=>{const n=document.createElement(tag);n.className=cls;if(label)n.setAttribute('aria-label',label);return n;};
    const side=element('section','tg100-side','Fila e placar');side.append(queue,rank);layout.append(side);
    const invites=element('div','tg100-invites','QR dos convidados');invites.append(rail);const screen=main.querySelector('.screen-row');if(!screen)throw Error('Tela do vídeo ausente.');screen.append(invites);
    const controls=element('section','tg100-controls','Mesa de controle do palco');controls.append(consoleNode,bar);if(post)controls.append(post);
    const remoteDetails=document.createElement('details');remoteDetails.id='tg30-control-qr-details';remoteDetails.className='tg30-control-qr-details';
    const remoteSummary=document.createElement('summary');remoteSummary.textContent='📱 QR do controle do anfitrião';remoteDetails.append(remoteSummary,remote);controls.append(remoteDetails);main.append(controls);
    const exit=$('stage-exit');if(exit)bar.append(exit);
    const solo=$('tg18-solo-button');if(solo)bar.append(solo);
    const cockpit=element('section','tg100-secondary','Catálogo e configurações');cockpit.id='tg104-cockpit';
    const disclosure=(label,cls)=>{const d=document.createElement('details'),s=document.createElement('summary'),v=element('div',cls);s.textContent=label;d.append(s,v);cockpit.append(d);return v;};
    disclosure('♫ Catálogo e músicas mais tocadas','tg100-catalog-panel').append(catalog);
    const room=disclosure('⚙ Configurações, Diva e ajuda','tg104-room-panel');room.append(tools);if(help)room.append(help);if(ad)room.append(ad);
    const footer=layout.querySelector(':scope > .tg19-stage-footer');if(footer){if(footer.children.length)room.append(footer);else footer.remove();}
    main.append(cockpit);stage.classList.add('tg100-stage-ready');
    window.dispatchEvent(new Event('temgogo:host-cockpit-ready'));
  }
  function tg100SyncRoomMode(){
    if(state.role!=='host'||!state.room)return;
    const solo=state.room.room_mode==='solo';document.body.classList.toggle('tg104-single-device',solo);
    const stage=$('stage');if(!stage)return;
    stage.dataset.tg100Mode=solo?'solo':'classic';
    tgR07SyncSoloDock();
    const title=stage.querySelector('.stage-sidebar .sidebar-top h2');if(title)title.textContent=solo?'SUAS MÚSICAS':'PRÓXIMOS A CANTAR';
    const call=stage.querySelector('[data-tg123-host-command="call"]');if(call)call.textContent=solo?'🎤 Preparar música':'🎤 Chamar cantor';
    const hint=stage.querySelector('.vox-idle-copy small');if(hint)hint.textContent=solo?'Escolha sua música pelo catálogo. A Drag Diva acompanha seu show!':'Escolha sua música pelo QR ou pelo catálogo. A Drag Diva tá de olho!';
    const remoteDetails=$('tg30-control-qr-details');if(remoteDetails){remoteDetails.hidden=solo;if(solo)remoteDetails.open=false;}
    if(solo){$('stage-qr')?.replaceChildren();$('stage-host-qr')?.replaceChildren();}
  }

  // Acesso seguro ao modo solo: não cria outro fluxo de música ou altera a pontuação.
  async function startSingleDeviceMode(){
    if(!state.client||!state.user||isAnonymous(state.user)){
      toast('Entre com sua conta de anfitrião para cantar sozinho neste aparelho.',true);return;
    }
    const button=$('tg103-solo-entry');if(button.disabled||state.room)return;
    const ticket=tgR18BeginRoomRequest();if(!ticket)return;button.disabled=true;ticket.narration=$('tg64-solo-narration')?.checked===true;
    const current=()=>tgR18RoomRequestCurrent(ticket)&&!state.room;
    const valid=r=>r?.id&&r.owner_id===ticket.uid&&r.room_mode==='solo'&&r.status==='open'&&r.tg30_battle_reserved===false&&Date.parse(r.expires_at)>Date.now()&&validRoom(r.code);
    const fields='id,code,title,owner_id,status,expires_at,current_song_id,room_mode,tg30_battle_reserved';
    try{
      const {data,error}=await state.client.from('karaoke_rooms').select(fields)
        .eq('owner_id',ticket.uid).eq('room_mode','solo').eq('status','open')
        .gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1);
      if(!current())return;if(error)throw error;
      let room;
      if(data?.length){
        room=data[0];if(!valid(room))throw Error('Não foi possível confirmar a sala solo.');
        if(!await window.TG_UI.confirm('Se o palco solo estiver aberto em outro aparelho, feche-o sem encerrar a festa. A exclusividade ainda não é verificada pelo servidor.',{title:'Retomar show solo',confirmText:'Palco anterior fechado · Retomar'}))return;
        if(!current())return;
        const fresh=await state.client.from('karaoke_rooms').select(fields).eq('id',room.id).single();
        if(!current())return;if(fresh.error)throw fresh.error;
        if(!valid(fresh.data)||fresh.data.id!==room.id||fresh.data.current_song_id!==room.current_song_id)throw Error('A sala mudou. Confira Minhas festas antes de retomar.');
        room=fresh.data;
      }else{
        const results=await callRPC('karaoke_create_room_mode',{p_title:'Meu show solo 🎤',p_mode:'solo'});
        if(!current())return;
        const x=results?.[0];if(!x?.room_id||!validRoom(x.room_code))throw Error('Não foi possível confirmar a criação. Confira Minhas festas.');
        room={id:x.room_id,code:x.room_code,title:x.room_title,owner_id:ticket.uid,room_mode:'solo'};
      }
      if(!current())return;
      const epoch=ticket.epoch+1;
      await enterRoomAsHost(room,{narration:ticket.narration===true});
      if(state.user?.id!==ticket.uid||tg07SessionEpoch!==epoch||state.role!=='host'||state.room?.id!==room.id||state.room.room_mode!=='solo'||state.emergencyBlocked)return;
      tg100SyncRoomMode();
      $('tg18-solo-status').textContent='🎤 Modo solo: toque em Ativar microfone solo. A letra continua no vídeo e sua nota usa a captação local.';
      toast('Modo solo pronto! Ative o microfone para captar sua voz. O vídeo permanece em destaque.');
      $('tg192-solo-off')?.focus({preventScroll:true});
    }catch(err){if(current())toast('Não foi possível iniciar o modo solo: '+humanError(err),true);}
    finally{tgR18EndRoomRequest(ticket);button.disabled=false;}
  }
  function switchMobileTab(tab,push=true){
    if(state.guestMicLock&&tab!=='mic')return;
    if(tab==='mic'&&!callActive()){toast('Seu microfone aparece quando a Diva chamar.');tab='queue';}
    if(!['mic','queue'].includes(tab))tab='queue';
    const before=state.mobileTab;state.mobileTab=tab;
    const mic=tab==='mic';$('guest-mic-panel').hidden=!mic;$('guest-queue-panel').hidden=mic;
    $('mobile-tab-mic').classList.toggle('active',mic);$('mobile-tab-queue').classList.toggle('active',!mic);
    $('mobile-tab-mic').setAttribute('aria-selected',String(mic));
    $('mobile-tab-queue').setAttribute('aria-selected',String(!mic));
    if(push&&state.role==='guest'&&state.room&&before&&before!==tab)history.pushState({temGogo:true,view:'guest',tab},'',currentURL(state.room.code));
  }

  // C23 — contenção seletiva (SQL22). A trava no servidor NÃO é ativada por este cliente.
  // O estado desconhecido bloqueia o início de mídia; uma suspensão observada é terminal
  // para esta sessão local. Não retomar nem finalizar uma música interrompida.
  let tg23Pending=null,tg23Timer=null,tg23Leaving=false;
  function tg23Dialog(message,reason='security'){
    let d=$('tg23-emergency');
    if(!d){d=document.createElement('dialog');d.id='tg23-emergency';d.className='tg103-emergency';d.setAttribute('aria-labelledby','tg23-emergency-title');
      const panel=document.createElement('div');panel.className='tg103-emergency-inner';
      const title=document.createElement('h2');title.id='tg23-emergency-title';title.textContent='Palco em pausa de segurança';
      const text=document.createElement('p');text.id='tg23-emergency-message';text.setAttribute('role','status');
      const help=document.createElement('small');help.textContent='O áudio foi interrompido neste aparelho. Não enviaremos notas finais nem retomaremos automaticamente.';
      const exit=document.createElement('button');exit.type='button';exit.textContent='Sair do palco neste aparelho';exit.addEventListener('click',()=>void tg23ExitLocal());
      panel.append(title,text,help,exit);d.append(panel);document.body.append(d);d.addEventListener('cancel',e=>e.preventDefault());}
    d.dataset.reason=reason;
    $('tg23-emergency-title').textContent=reason==='connection'?'Conexão com o servidor não confirmada':'Palco em pausa de segurança';
    $('tg23-emergency-message').textContent=message;
    if(!d.open&&!$('tg-beta-emergency')?.open){try{d.showModal();}catch(e){console.warn('Diálogo de segurança:',e);}}
  }
  function tg23Suspend(message,reason='security'){
    if(!state.room||state.emergencyClosing)return;
    state.emergencyBlocked=true;tg90ResetUpcoming();
    if(!state.emergencyLatch){
      state.emergencyLatch=true;++tg07SessionEpoch;tgR25ClearSoloReport();tgR19CancelSoloRequest();tgR20CancelMicRequest();
      // Invalida respostas pendentes antes de fechar mídia. Não chama finishSong nem flush.
      state.isPlaying=false;state.finishing=false;state.playMetrics=null;
      tg18AbortDictation();window.TG74_DIVA_STUDIO?.reset();
      try{window.speechSynthesis?.cancel();}catch{}
      try{state.player?.mute();state.player?.stopVideo();}catch{}
      try{state.player?.destroy();}catch{}state.player=null;state.playerReady=false;
      const frame=$('video-frame');if(frame){$('youtube-player')?.remove();const node=document.createElement('div');node.id='youtube-player';node.className='youtube-player';frame.prepend(node);}
      // Desvincular referências primeiro: callbacks de onended não podem iniciar envio.
      const streams=[state.localStream,state.micSendStream,state.soloMic?.stream];
      const contexts=[state.localAudioContext,state.context,state.soloMic?.ctx];
      state.localStream=null;state.micSendStream=null;state.localAudioContext=null;state.localAnalyzer=null;state.micGainNode=null;state.context=null;state.soloMic=null;
      for(const stream of streams)for(const track of stream?.getTracks()||[]){try{track.onended=null;track.stop();}catch{}}
      for(const ctx of contexts)try{Promise.resolve(ctx?.close()).catch(()=>{});}catch{}
      try{state.localPeer?.close();}catch{}state.localPeer=null;
      for(const peer of state.peers.values()){try{peer.pc.ontrack=null;peer.pc.close();}catch{}for(const node of [peer.source,peer.analyser,peer.gain])try{node?.disconnect();}catch{}}
      state.peers.clear();state.candidateBuffer.clear();tgR14ClearRemote();
      state.micActivity=null;state.micActivitySyncing=false;state.micConnecting=false;tg30RevokeShadow();
      clearHostPreflight(false);state.guestPreflightSong=null;state.guestReady=false;state.guestMicLock=false;closeGuestCall();
      hideFinal();hideGuestRecado();recadoAfter=null;pendingGuestRecados.length=0;
      if($('mic-toggle'))$('mic-toggle').disabled=true;
      tgR07SyncSoloDock();if($('tg18-solo-status'))$('tg18-solo-status').textContent='Microfone interrompido por segurança.';
      if($('tg18-remote-feedback'))$('tg18-remote-feedback').textContent='Comandos suspensos; não serão reenviados.';
    }
    tg23Dialog(message,reason);
  }
  async function tg23Poll(){
    if(!state.room||!state.user||tg23Leaving||state.emergencyClosing)return false;
    if(tg23Pending)return tg23Pending.promise;
    const scope=tg07Scope(),ticket={};tg23Pending=ticket;
    ticket.promise=(async()=>{let timer;
      try{
        const response=await Promise.race([state.client.rpc('tg30_room_emergency_status',{p_room:scope.room}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),4500);})]);
        if(!tg07Current(scope)||tg23Pending!==ticket)return false;
        if(response?.error||typeof response?.data?.suspended!=='boolean')throw Error('Estado não confirmado');
        if(response.data.suspended){tg23Suspend('A produção suspendeu esta modalidade. Seus registros confirmados continuam no servidor.');return false;}
        if(state.emergencyLatch){const reason=$('tg23-emergency')?.dataset.reason||'security';tg23Dialog('O servidor voltou a responder e não indica suspensão neste momento. Saia deste palco e entre novamente; não haverá retomada automática.',reason);return false;}
        const generation=Object.hasOwn(response.data,'signal_generation')?response.data.signal_generation:null;
        if(!tg24GenerationValid(generation))throw Error('Geração de segurança inválida');
        if(state.emergencyGeneration!==undefined&&state.emergencyGeneration!==generation){
          tg23Suspend('Houve uma mudança de segurança enquanto este aparelho estava conectado. Entre novamente no palco para receber somente os comandos atuais.');return false;
        }
        state.emergencyGeneration=generation;
        state.emergencyBlocked=false;return true;
      }catch{if(tg07Current(scope)&&tg23Pending===ticket)tg23Suspend('Não conseguimos consultar a segurança da sala. O áudio foi interrompido por precaução; isso não confirma uma suspensão administrativa. Verifique a conexão e entre novamente.', 'connection');return false;}
      finally{clearTimeout(timer);if(tg23Pending===ticket)tg23Pending=null;}
    })();return ticket.promise;
  }
  async function tg38Reconnect(announce){
    if(!state.room){if(announce)toast('Internet conectada novamente. ✅');return;}
    const scope=tg07Scope(),role=state.role;
    const safe=await tg23Poll();
    if(!tg07Current(scope)||state.emergencyClosing)return;
    if(!safe||!tg38RoomCurrent(scope,role)){if(announce)toast('Internet voltou, mas este palco precisa de nova entrada para retomar com segurança.',true);return;}
    if(announce)toast('Internet conectada novamente. ✅');
    if(role==='host')void unlockWakeLock();
    void refreshRoomSnapshot();void fetchRecentSignals();void fetchHostDeviceSignals();
  }
  async function tg23Start(){clearInterval(tg23Timer);tg23Timer=setInterval(()=>{void tg23Poll();},4000);return tg23Poll();}
  function tg23Reset(){clearInterval(tg23Timer);tg23Timer=null;tg23Pending=null;state.emergencyBlocked=true;state.emergencyLatch=false;state.emergencyGeneration=undefined;state.emergencyClosing=false;state.startingSong=null;state.playerSongId=null;if($('tg23-emergency')?.open)$('tg23-emergency').close();}
  async function tg23ExitLocal(){if(tg23Leaving)return;tg23Leaving=true;try{await stopSession();history.replaceState(null,'',new URL('./',location.href).href);localStorage.removeItem('tem-gogo-pending-room');localStorage.removeItem('tem-gogo-pending-remote');if(state.user&&!isAnonymous(state.user))await openLobby();else showGuestEntry('');}finally{tg23Leaving=false;}}
  // Bloqueio administrativo – recursos locais param quando o estado chega ao navegador.
  window.TG_MAINTENANCE_STOP=async()=>{
    if(state.room){tg23Suspend('Manutenção geral. O palco foi interrompido neste aparelho.');return;}
    tg18AbortDictation();window.TG74_DIVA_STUDIO?.reset();
    try{if(state.player?.pauseVideo)state.player.pauseVideo();}catch(e){console.warn('Pausa por manutenção',e);}
    try{await stopMicrophone(false);}catch(e){console.warn('Fechamento do microfone',e);}
    try{stopSoloMic();}catch(e){console.warn(e);}
    try{for(const peer of state.peers.values()){peer?.pc?.close?.();peer?.peer?.close?.();peer?.gain?.disconnect?.();}state.peers.clear();}catch(e){console.warn(e);}
    state.isPlaying=false;
  };
  window.addEventListener('temgogo:remote-audio',e=>{const {command,value}=e.detail||{};if(command==='diva-auto'&&[0,1].includes(value))void remoteCommand(command,value);});
  // Beta 1.0: apenas a interface social usa este contexto; não expõe chaves administrativas.
  window.TG_BETA_BRIDGE=()=>({client:state.client,user:state.user,room:state.room,role:state.role,
    members:state.members,avatar:state.avatar,isAnonymous,isMyTurn,sessionEpoch:tg07SessionEpoch,tg60SyncIdentity,setDivaCaption:tg87SetDivaCaption,
    campaignSafe:!state.emergencyBlocked&&!state.room?.current_song_id&&!state.currentSong&&!state.preflight&&!state.isPlaying&&!state.localStream&&!state.soloMic&&!state.guestMicLock,
    canAnnounceOpening:()=>!state.emergencyBlocked&&tg13Recreational()&&['classic','solo'].includes(state.room?.room_mode)&&state.role==='host'&&!state.currentSong&&!state.preflight&&!state.songs.some(s=>s.status==='done'||s.status==='playing'||s.status==='skipped'),
    canContextualDiva:()=>!state.startingSong&&!state.emergencyBlocked&&!state.emergencyClosing&&tg13Recreational()&&state.role==='host'&&state.room?.status==='open'&&state.room.owner_id===state.user?.id&&!state.currentSong&&!state.room.current_song_id&&!state.isPlaying&&!state.soloMic&&!state.localStream&&!state.peers.size,
    canManualAudio:()=>!state.startingSong&&!state.finishing&&!recadoShowing&&!!$('final-overlay')?.hidden,
    canPreviewVoices:()=>!state.startingSong&&!state.emergencyBlocked&&tg13Recreational()&&state.role==='host'&&state.room?.status==='open'&&state.room.owner_id===state.user?.id&&!state.currentSong&&!state.preflight&&!state.isPlaying&&!state.soloMic&&!state.localStream&&!state.peers.size,
    setAvatar(key){if(!tg83SetAvatar(key))return;void sendProfileToHost().catch(()=>{});}});
  init().catch(err=>{console.error(err);toast(humanError(err),true);});
})();
