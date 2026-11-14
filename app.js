/* Tem Gogó v8 — edição brasileira: palco, VOX e reações GIPHY (opcional) — aplicativo estático (PWA + Supabase + WebRTC + YouTube IFrame API).
 * Os vídeos são reproduzidos pelo YouTube; nenhum áudio do YouTube é extraído.
 * Microfones são transportados diretamente via WebRTC quando houver conexão.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cfg = window.TEM_GOGO_CONFIG || {};
  const state = {
    client: null, user: null, room: null, role: null,
    songs: [], members: [], scores: [], channel: null,
    currentSong: null, player: null, playerReady: false,
    playerAPIReady: false, isPlaying: false, finishing: false,
    peers: new Map(), localPeer: null, localStream: null,
    localAnalyzer: null, localAudioContext: null,
    context: null, masterGain: 1, micStats: new Map(),
    candidateBuffer: new Map(), processedSignals: new Set(),
    signalChain: Promise.resolve(), ticker: null, signalCleaner: null,
    pendingInstall: null, inviteRoom: null, wakeLock: null, currentTheme: 'baile',
    roomReloadTimer: null, roomPoller: null, signalPoller: null, syncRunning: false, syncQueued: false, realtimeOk: false, lastMySong: null, micConnecting: false, captureSeen: false, memberVerifier: null, scoreOverlayTimer: null, humorMode: 'debochado', gifsEnabled: true, effectsEnabled: true, reactionToken: 0, voxIndex: 0, readyRoom: null, failedVideoSong: null, catalog: [], catalogFetchedAt: 0, playMetrics: null
  };

  function toast(message, error = false) {
    const node = $('toast'); node.textContent = message;
    node.classList.toggle('error', error); node.classList.add('visible');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('visible'), 4200);
  }
  function humanError(err) {
    const msg = String(err?.message || err || 'Ocorreu um erro inesperado.');
    if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar.';
    if (/user already registered/i.test(msg)) return 'Esse e-mail já está cadastrado. Tente entrar.';
    if (/password should be at least/i.test(msg)) return 'Escolha uma senha com pelo menos 6 caracteres.';
    if (/rate limit|too many requests/i.test(msg)) return 'Muitas tentativas. Aguarde e tente novamente.';
    if (/permission denied|notallowederror/i.test(msg)) return 'Microfone bloqueado. Libere a permissão nas configurações do navegador.';
    if (/notfounderror/i.test(msg)) return 'Nenhum microfone foi encontrado no celular.';
    if (/network|failed to fetch/i.test(msg)) return 'Falha de conexão. Confira sua internet e o Supabase.';
    return msg;
  }
  function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function show(id) { document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== id); window.scrollTo({top:0}); }
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
  const THEMES = ['baile','diva','boteco','glam'];
  const THEME_LABELS = {baile:'💚 Baile Neon',diva:'💖 Diva Pop',boteco:'🍊 Boteco Superstar',glam:'🪩 Glam Futurista'};
  const voxMoments = {
    opening: ['Boa noite, meu povo! Já pode avisar à vizinhança que tem espetáculo!', 'O palco é seu, o talento é negociável e a resenha é garantida!', 'Se a música começar, eu entro em surto. É meu jeitinho!'],
    singing: ['Olha o carão! Aqui é karaokê, mas a produção é de milhões!', 'Gente, me avisem quando for o refrão que eu já tô emocionado!', 'Tô ouvindo um hit? Tô. E uma coragem inabalável também!'],
    queue: ['Próxima estrela no aquecimento! Cadê o fã-clube?', 'Avisa que o microfone não tem um minuto de paz!', 'Coloca o look imaginário de turnê e vem!'],
    ending: ['Atenção, plateia! O VOX tem um comunicado de utilidade musical!', 'GENTE! Liberaram o placar! Preparem os prints!', 'Vamos de veredito, porque eu nasci pra entregar entretenimento!']
  };
  function chooseDifferent(items){
    const pool = items.filter(Boolean);
    if(!pool.length)return '';
    // Rodízio com início variável, sem exigir IA nem criar custos de API para textos.
    chooseDifferent.last = (chooseDifferent.last + 1 + Math.floor(Math.random()*Math.max(1,pool.length-1)))%pool.length;
    return pool[chooseDifferent.last];
  }
  chooseDifferent.last = 0;
  function updateVoxLine(moment='opening'){
    const text=chooseDifferent(voxMoments[moment]||voxMoments.opening);
    if($('vox-line'))$('vox-line').textContent=`“${text}”`;
    if($('vox-guest-line'))$('vox-guest-line').textContent=`“${text}” — VOX`;
  }
  function applyTheme(theme,announce=false){
    state.currentTheme=THEMES.includes(theme)?theme:'baile';
    document.body.dataset.theme=state.currentTheme;
    localStorage.setItem('tem-gogo-theme',state.currentTheme);
    document.querySelectorAll('[data-theme-choice]').forEach(btn=>{const selected=btn.dataset.themeChoice===state.currentTheme;btn.classList.toggle('chosen',selected);btn.setAttribute('aria-pressed',String(selected));});
    if(announce)toast(THEME_LABELS[state.currentTheme]+' ativado!');
  }
  function themeCycle() {applyTheme(THEMES[(THEMES.indexOf(state.currentTheme)+1)%THEMES.length],true);}
  function loadPreferences(){
    applyTheme(localStorage.getItem('tem-gogo-theme')||'baile');
    state.humorMode=['familia','debochado','caos'].includes(localStorage.getItem('tem-gogo-humor'))?localStorage.getItem('tem-gogo-humor'):'debochado';
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
  function sixDigitPin(){
    const nums=new Uint32Array(1); crypto.getRandomValues(nums);
    return String(100000+(nums[0]%900000));
  }
  function isStandalone(){return matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;}
  function normalizeRoom(value){return String(value||'').trim().toUpperCase().replace(/[^A-F0-9]/g,'').slice(0,8);}
  function holdInvitation(code){
    const clean=normalizeRoom(code);
    if(clean.length===8) localStorage.setItem('tem-gogo-pending-room',clean);
    return clean;
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
  function showPinEntry(code){
    const clean=normalizeRoom(code);
    state.inviteRoom=clean||null;
    document.body.classList.remove('invite-active');
    document.body.classList.toggle('entry-active',!!clean || isStandalone());
    $('invite-welcome').hidden=true;
    $('access-tabs').hidden=false;
    openGuestEntry(clean);
    show('landing');
    $('guest-pin').focus({preventScroll:true});
  }
  async function installFromInvite(){
    holdInvitation(state.inviteRoom);
    if(state.pendingInstall){
      state.pendingInstall.prompt();
      const outcome=await state.pendingInstall.userChoice;
      if(outcome?.outcome==='accepted')toast('Instalação solicitada! Se o convite não abrir no app, informe o código da TV.');
      state.pendingInstall=null;
      return;
    }
    $('invite-install-help').textContent=/iPad|iPhone|iPod/.test(navigator.userAgent)
      ? 'No Safari: Compartilhar → Adicionar à Tela de Início. Depois abra o Tem Gogó e digite o código da festa, caso ele não apareça.'
      : 'No Chrome/Edge: abra o menu ⋮ → Instalar app ou Adicionar à tela inicial. Você também pode entrar pelo navegador.';
    toast('Abra o menu do navegador e escolha Instalar aplicativo.');
  }
  async function tryResumeMembership(code){
    if(!state.client||!state.user||!code)return false;
    try{
      const own=await state.client.from('karaoke_rooms').select('id,code,title,owner_id')
        .eq('code',code).eq('owner_id',state.user.id).eq('status','open').gt('expires_at',new Date().toISOString()).maybeSingle();
      if(own.data){await enterRoomAsHost(own.data);return true;}
      const rows=await callRPC('karaoke_resume_room',{p_code:code});
      if(!rows?.length)return false;
      const r=rows[0];
      await enterRoomAsGuest({id:r.room_id,code:r.room_code,title:r.room_title,owner_id:r.owner_id},r.display_name);
      switchMobileTab('queue');
      toast('Bem-vinda de volta! Sua festa continua e a fila te espera. 🎶');
      return true;
    }catch(err){console.warn('Retomada indisponível:',err.message);return false;}
  }
  function initPWA() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('Service worker:',err));
    }
    window.addEventListener('beforeinstallprompt',event => {event.preventDefault();state.pendingInstall=event;document.querySelectorAll('.install-trigger').forEach(el=>el.hidden=false);});
    document.querySelectorAll('.install-trigger').forEach(button => button.addEventListener('click',async()=>{
      if(!state.pendingInstall)return;state.pendingInstall.prompt();await state.pendingInstall.userChoice;state.pendingInstall=null;button.hidden=true;
    }));
  }
  async function init() {
    initPWA();
    loadPreferences();
    attachEvents();
    const linkRoom=normalizeRoom(new URL(location.href).searchParams.get('room'));
    const savedRoom=normalizeRoom(localStorage.getItem('tem-gogo-pending-room'));
    const targetRoom=linkRoom||savedRoom;
    if(targetRoom){
      if(!isStandalone()&&linkRoom)showInvite(targetRoom);
      else showPinEntry(targetRoom);
    }
    if (!configured()) {
      $('auth-state').textContent='⚙️ Confira config.js e a instalação SQL do Tem Gogó para ativar as salas.';
      return;
    }
    if (!window.supabase?.createClient) {toast('Não foi possível carregar a biblioteca Supabase. Verifique a internet.',true);return;}
    state.client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    try {
      const {data:{session},error}=await state.client.auth.getSession(); if(error)throw error;
      state.user=session?.user||null;
      if(targetRoom){
        const resumed=await tryResumeMembership(targetRoom);
        if(!resumed && isStandalone())showPinEntry(targetRoom);
      }else if(state.user) await openLobby();
      else if(isStandalone())showPinEntry('');
    }catch(err){toast(humanError(err),true);}
    state.client.auth.onAuthStateChange((_event,session)=>{state.user=session?.user||null;});
  }
  function isAnonymous(user) {return user?.is_anonymous===true || user?.app_metadata?.provider==='anonymous';}
  function checkBackend() {if (!state.client){toast('Antes de usar, configure o Supabase em config.js.',true);return false;}return true;}
  async function callRPC(name,params) {const {data,error}=await state.client.rpc(name,params);if(error)throw error;return data;}

  function openGuestEntry(roomCode) {
    $('tab-host').classList.remove('active');$('tab-host').setAttribute('aria-selected','false');
    $('tab-guest').classList.add('active');$('tab-guest').setAttribute('aria-selected','true');
    $('host-access').hidden=true;$('guest-access').hidden=false;
    $('guest-code').value=String(roomCode||'').toUpperCase().replace(/[^A-F0-9]/g,'').slice(0,8);
    $('guest-name').value=localStorage.getItem('tem-gogo-display-name')||'';
  }
  async function openLobby() {
    document.body.classList.remove('invite-active','entry-active');
    show('lobby');
    $('host-create-area').hidden=!state.user || isAnonymous(state.user);
    await loadMyRooms();
  }
  async function loadMyRooms() {
    const container=$('existing-rooms');
    container.replaceChildren();
    if(!state.client||!state.user)return;
    try {
      // RLS: a consulta só mostra salas que o usuário possui ou das quais é membro.
      const {data,error}=await state.client.from('karaoke_rooms')
        .select('id,title,code,status,expires_at,created_at,owner_id')
        .eq('status','open').gt('expires_at',new Date().toISOString())
        .order('created_at',{ascending:false}).limit(60);
      if(error)throw error;
      const rooms=(data||[]);
      const membership=await state.client.from('karaoke_members')
        .select('room_id,display_name').eq('user_id',state.user.id).limit(60);
      if(membership.error)throw membership.error;
      const names=new Map((membership.data||[]).map(m=>[m.room_id,m.display_name]));
      const heading=document.createElement('h3');heading.className='my-rooms-heading';heading.textContent='🎟️ Minhas festas ('+rooms.length+')';container.append(heading);
      if(!rooms.length){const p=document.createElement('p');p.className='hub-empty';p.textContent='Ainda não tem festa por aqui. Crie uma ou entre com o convite de alguém!';container.append(p);return;}
      for(const room of rooms){
        const host=room.owner_id===state.user.id;
        const card=document.createElement('button');card.type='button';card.className='hub-room-card';
        const description=host?'👑 Você apresenta':'🎤 Você participa';
        card.innerHTML='<span class="hub-room-icon">'+(host?'📺':'🎙️')+'</span><span class="hub-room-info"><strong>'+escapeHTML(room.title)+'</strong><small>'+description+' · '+escapeHTML(room.code)+'</small></span><span class="hub-room-arrow">↗</span>';
        card.addEventListener('click',async()=>{
          if(host)await enterRoomAsHost(room);
          else await enterRoomAsGuest(room,names.get(room.id)||localStorage.getItem('tem-gogo-display-name')||'Estrela');
        });
        container.append(card);
      }
    }catch(err){
      const p=document.createElement('p');p.className='hub-empty';p.textContent='Não consegui carregar suas festas: '+humanError(err);container.append(p);
    }
  }
  async function goToMyRooms(){
    if(state.role==='host' && state.currentSong && !confirm('Ao trocar de sala neste aparelho, o vídeo e o som do palco serão interrompidos. Sua festa continuará aberta. Deseja sair desta tela?'))return;
    await stopSession();
    history.replaceState(null,'',new URL('./',location.href).href);
    if(state.user)await openLobby();
    else showPinEntry('');
  }
  async function login(event) {
    event.preventDefault();if(!checkBackend())return;
    const button=$('login-button');setLoading(button,true,'Entrando...');
    try {
      const {data,error}=await state.client.auth.signInWithPassword({email:$('auth-email').value.trim(),password:$('auth-password').value});
      if(error)throw error; state.user=data.user; await openLobby();
    }catch(err){$('auth-state').textContent=humanError(err);toast(humanError(err),true);}finally{setLoading(button,false);}
  }
  function openSignup() {
    $('signup-feedback').textContent='';
    $('signup-form').reset();
    $('signup-email').value=$('auth-email').value.trim();
    $('signup-dialog').showModal();
    $('signup-name').focus();
  }
  function closeSignup(){ $('signup-dialog').close(); }
  async function signup(event) {
    event.preventDefault();
    if(!checkBackend())return;
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
        options:{ data:{display_name:name}, emailRedirectTo:new URL('./',location.href).href }
      });
      if(error)throw error;
      $('auth-email').value=email;
      if(data.session){state.user=data.user;closeSignup();await openLobby();toast('Conta criada! Agora o palco é seu. 🌟');}
      else {
        // O Supabase pode não revelar quando um endereço já existe. Não prometer conta nova.
        feedback.textContent='📬 Se o cadastro puder ser concluído, você receberá um e-mail de confirmação. Confira também o spam; depois entre com sua senha.';
        $('signup-form').querySelectorAll('input[type=password]').forEach(i=>i.value='');
      }
    }catch(err){feedback.textContent=humanError(err);toast(humanError(err),true);}
    finally{setLoading(button,false);}
  }
  async function makeRoom(event) {
    event.preventDefault();if(!checkBackend())return;
    const button=event.target.querySelector('[type=submit]');setLoading(button,true,'Montando seu palco…');
    try {
      const pin=sixDigitPin();
      const data=await callRPC('karaoke_create_room',{p_title:$('room-title').value.trim(),p_pin:pin});
      if(!data?.length)throw new Error('Não foi possível criar a festa.');
      const room={id:data[0].room_id,code:data[0].room_code,title:data[0].room_title,owner_id:state.user.id};
      state.readyRoom={room,pin};
      $('ready-code').textContent=room.code;
      $('ready-pin').textContent=pin;
      $('room-ready-dialog').showModal();
      await loadMyRooms();
    }catch(err){toast(humanError(err),true);}finally{setLoading(button,false);}
  }
  async function joinParty(event) {
    event.preventDefault();if(!checkBackend())return;
    const code=$('guest-code').value.trim().toUpperCase();const name=$('guest-name').value.trim();
    const pin=$('guest-pin').value.trim();
    if(!/^[0-9]{6}$/.test(pin)){toast('Digite os seis números da senha da sala.',true);return;}
    if(!/^[A-F0-9]{8}$/.test(code)){toast('Confira os 8 caracteres do código da TV.',true);return;}
    const button=event.target.querySelector('[type=submit]');setLoading(button,true,'Entrando na festa...');
    try{
      if(!state.user){const {data,error}=await state.client.auth.signInAnonymously();if(error)throw error;state.user=data.user;}
      const result=await callRPC('karaoke_join_room',{p_code:code,p_name:name,p_pin:pin});
      if(result?.[0]?.error_code==='full')throw new Error('A festa atingiu o limite de 40 participantes.');
      if(result?.[0]?.error_code==='locked')throw new Error('Muitas senhas incorretas. Tente novamente em 15 minutos.');
      if(result?.[0]?.error_code)throw new Error('Senha incorreta ou festa indisponível. Confira com o anfitrião.');
      if(!result?.length)throw new Error('A sala não respondeu. Tente novamente.');
      localStorage.setItem('tem-gogo-display-name',name);
      localStorage.setItem('tem-gogo-pending-room',code);
      $('guest-pin').value='';
      const r=result[0];await enterRoomAsGuest({id:r.room_id,code:r.room_code,title:r.room_title,owner_id:r.owner_id},name);
    }catch(err){toast(humanError(err),true);}finally{setLoading(button,false);}
  }

  async function enterRoomAsHost(room) {
    await stopSession();
    state.room=room;state.role='host';setSyncStatus('sync');$('stage-room-title').textContent=room.title;
    $('room-code').textContent=room.code;show('stage');drawQR();
    try{await hydrateRoom();await subscribeRoom();startTicker();
      void loadCatalog(true);
      try{await loadYouTubeAPI();if(state.room?.current_song_id)await resumeExistingSong();}
      catch(err){toast(humanError(err),true);}
      await unlockWakeLock();
      updateVoxLine('opening');
      toast('VOX NO AR! Mostre o QR e passe a senha só para seus convidados. 🎉');
    }catch(err){toast(humanError(err),true);}
  }
  async function enterRoomAsGuest(room,name) {
    await stopSession();
    document.body.classList.remove('invite-active','entry-active');
    state.room=room;state.role='guest';setSyncStatus('sync');$('guest-display-name').textContent=name;$('guest-room-code').textContent=room.code;
    $('guest-room-title').textContent=room.title;show('guest');updateVoxLine('opening');
    history.replaceState(null,'',currentURL(room.code));
    localStorage.setItem('tem-gogo-pending-room',room.code);
    switchMobileTab('queue');
    try{await hydrateRoom();void loadCatalog(true);await subscribeRoom();startTicker();startMemberVerifier();toast('Entrou! 🎉 Escolha um hit para sua fila.');}
    catch(err){toast(humanError(err),true);}
  }
  function startMemberVerifier(){
    clearInterval(state.memberVerifier);
    state.memberVerifier=setInterval(async()=>{
      if(state.role!=='guest'||!state.room||!state.client||!navigator.onLine)return;
      const code=state.room.code;
      try{
        const entries=await callRPC('karaoke_resume_room',{p_code:code});
        if(entries?.length)return;
        await stopSession();
        showPinEntry(code);
        toast('O acesso a esta festa mudou. Peça a nova senha ao anfitrião. 🔐',true);
      }catch(err){console.warn('Verificação de acesso adiada:',err.message);}
    },12000);
  }
  function setSyncStatus(mode){
    const label=mode==='live'?'● Ao vivo':mode==='fallback'?'◌ Atualizando a fila':mode==='offline'?'⚠ Sem internet':'◌ Sincronizando';
    for(const id of ['stage-sync-status','guest-sync-status']){
      const el=$(id); if(!el)continue;el.textContent=label;el.dataset.status=mode;
    }
  }
  async function hydrateRoom() {await fetchRoom();if(!state.room)return;await fetchSongs();await fetchMembers();await fetchScores();renderAll();}
  async function refreshRoomSnapshot(){
    if(Date.now()-state.catalogFetchedAt>45000)void loadCatalog();
    if(!state.room||state.syncRunning){state.syncQueued=true;return;}
    state.syncRunning=true;const roomId=state.room.id;
    try{
      await fetchRoom();if(state.room?.id!==roomId)return;
      await fetchSongs();if(state.room?.id!==roomId)return;
      await fetchMembers();if(state.room?.id!==roomId)return;
      await fetchScores();if(state.room?.id!==roomId)return;
      renderAll();setSyncStatus(navigator.onLine?(state.realtimeOk?'live':'fallback'):'offline');
    }catch(err){console.warn('Falha ao sincronizar sala:',err);setSyncStatus('offline');}
    finally{state.syncRunning=false;if(state.syncQueued){state.syncQueued=false;if(state.room?.id===roomId)queueChanged();}}
  }
  function startSyncFallback(){
    clearInterval(state.roomPoller);clearInterval(state.signalPoller);
    state.roomPoller=setInterval(()=>{if(state.room&&navigator.onLine)void refreshRoomSnapshot();},5500);
    state.signalPoller=setInterval(()=>{if(state.room&&navigator.onLine&&(state.role==='host'||state.localPeer))void fetchRecentSignals();},3200);
  }

  async function fetchRoom() {
    if(!state.room)return;const requestedRoom=state.room.id;
    const {data,error}=await state.client.from('karaoke_rooms').select('id,code,title,owner_id,status,current_song_id,expires_at')
      .eq('id',requestedRoom).single();
    if(state.room?.id!==requestedRoom)return;
    if(error)throw error;
    state.room={...state.room,...data};
    if(state.role==='guest' && (data.status!=='open'||new Date(data.expires_at)<new Date())) {toast('Esta sala foi encerrada.',true);await leaveGuest();return;}
    const found=state.songs.find(s=>s.id===data.current_song_id);
    if(state.role==='guest') setGuestNowPlaying(found||null);
  }
  async function fetchSongs() {
    if(!state.room)return;const requestedRoom=state.room.id;
    const {data,error}=await state.client.from('karaoke_songs').select('*').eq('room_id',requestedRoom)
      .in('status',['queued','playing']).order('created_at',{ascending:true}).limit(150);
    if(state.room?.id!==requestedRoom)return;
    if(error)throw error;
    state.songs=data||[];
    if(state.role==='guest')setGuestNowPlaying(state.songs.find(s=>s.id===state.room?.current_song_id)||null);
  }
  async function fetchMembers() {
    if(!state.room)return;const requestedRoom=state.room.id;
    const {data,error}=await state.client.from('karaoke_members').select('user_id,display_name,joined_at')
      .eq('room_id',requestedRoom).order('joined_at',{ascending:true});
    if(state.room?.id!==requestedRoom)return;if(error)throw error;
    state.members=data||[];
  }
  async function fetchScores(){if(!state.room)return;const requestedRoom=state.room.id;const {data,error}=await state.client.from('karaoke_scores').select('*').eq('room_id',requestedRoom).order('created_at',{ascending:false}).limit(250);if(state.room?.id!==requestedRoom)return;if(error)throw error;state.scores=data||[];}
  function memberName(userId) {if(userId===state.room?.owner_id)return 'Anfitrião';return state.members.find(m=>m.user_id===userId)?.display_name || 'Artista';}
  function renderAll(){renderQueue();renderMembers();if(state.role==='host')renderMics();}
  function renderMembers(){if(state.role==='host')$('stage-count').textContent=`👥 ${state.members.length+1} na festa`;}
  function renderQueue() {
    const songs=state.songs.filter(s=>s.status==='playing'||s.status==='queued');
    if(state.role==='host') {
      $('queue-counter').textContent=`${songs.filter(s=>s.status==='queued').length} MÚSICAS`;
      $('queue-list').innerHTML=songs.length?songs.map((s,i)=>`<div class="queue-item ${s.status==='playing'?'playing':''}"><div class="queue-num">${s.status==='playing'?'♫':String(i+1).padStart(2,'0')}</div><div class="queue-text"><strong>${escapeHTML(s.title)}</strong><small>${s.status==='playing'?'● Tocando • ':''}${escapeHTML(memberName(s.user_id))}</small></div>${s.status==='queued'?`<span class="queue-actions"><button class="queue-play" type="button" data-play-song="${s.id}" aria-label="Tocar esta música">▶</button><button class="queue-remove" type="button" data-remove-song="${s.id}" aria-label="Remover esta música">✕</button></span>`:'<span class="queue-play">ON</span>'}</div>`).join(''):'<div class="queue-empty">A fila ainda tá vazia. Mostre o QR Code! 🎶</div>';
    }
    if(state.role==='guest') {
      $('guest-queue-list').innerHTML=songs.length?songs.map((s,i)=>`<div class="mobile-queue-item"><span class="number">${s.status==='playing'?'♫':i+1}</span><span class="title"><strong>${escapeHTML(s.title)}</strong><small>${escapeHTML(memberName(s.user_id))}</small></span><span>${s.status==='playing'?'🔊':'🎵'}</span></div>`).join(''):'<p style="color:var(--muted);font-size:13px">Sem músicas ainda. Que tal escolher a primeira? 🎤</p>';
      setGuestNowPlaying(songs.find(s=>s.status==='playing')||null);
      syncGuestTurn(songs.find(s=>s.status==='playing')||null);
    }
  }
  function setGuestNowPlaying(song){$('guest-now-playing').textContent=song?.title || 'O palco tá pronto pra você!';$('guest-now-singer').textContent=song?'Escolhida por '+memberName(song.user_id):'Escolha um hit na aba ao lado.';}
  function isMyTurn(){return state.role==='guest'&&Boolean(state.user?.id)&&state.songs.some(song=>song.status==='playing'&&song.user_id===state.user.id);}
  function syncGuestTurn(playing){
    if(state.role!=='guest')return;
    const mine=Boolean(playing&&playing.user_id===state.user?.id);
    $('your-turn-banner').hidden=!mine;$('mic-turn-kicker').hidden=!mine;
    $('mic-card').classList.toggle('my-turn',mine);
    $('mobile-tab-mic').classList.toggle('turn-highlight',mine);
    if(mine){$('your-turn-track').textContent=playing.title;}
    if(state.lastMySong!==playing?.id){
      const wasMine=Boolean(state.lastMySong);
      state.lastMySong=mine?playing.id:null;
      if(mine){
        switchMobileTab('mic');
        $('mic-headline').textContent=state.localStream?'Seu mic tá preparado!':'É sua vez, estrela! 🎤';
        $('mic-description').textContent=state.localStream?'Conectando seu som com a TV...':'Toque no microfone e autorize o uso. As barras vão mostrar sua voz de verdade.';
        toast('🎤 É SUA VEZ! O VOX convocou seu microfone.');
        if(state.localStream&&!state.localPeer)void connectMicToStage();
        if(navigator.vibrate)navigator.vibrate([100,60,100]);
      }else if(wasMine){
        // Privacidade: ao terminar a apresentação, fecha a captura e a conexão.
        if(state.localStream)void stopMicrophone(true);
        toast('Apresentação encerrada! O microfone foi desligado. 👏');
      }
    }
  }
  function drawQR() {
    const holder=$('stage-qr');holder.replaceChildren();
    if(window.QRCode){new window.QRCode(holder,{text:currentURL(state.room.code),width:240,height:240,colorDark:'#171023',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});}
    else {holder.textContent='QR indisponível';toast('Biblioteca de QR Code não carregou. Compartilhe o código da sala.',true);}
  }
  function queueChanged(){clearTimeout(state.roomReloadTimer);state.roomReloadTimer=setTimeout(()=>{void refreshRoomSnapshot();},180);}
  async function subscribeRoom(){
    if(!state.room)return;
    const uid=state.user.id;
    state.channel=state.client.channel(`tem-gogo-db-${state.room.id}-${uid}`);
    state.channel
      .on('postgres_changes',{event:'*',schema:'public',table:'karaoke_songs',filter:`room_id=eq.${state.room.id}`},queueChanged)
      .on('postgres_changes',{event:'*',schema:'public',table:'karaoke_members',filter:`room_id=eq.${state.room.id}`},queueChanged)
      .on('postgres_changes',{event:'*',schema:'public',table:'karaoke_rooms',filter:`id=eq.${state.room.id}`},queueChanged)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'karaoke_scores',filter:`room_id=eq.${state.room.id}`},queueChanged)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'karaoke_signals',filter:`receiver_id=eq.${uid}`},payload=>receiveSignal(payload.new));
    startSyncFallback();setSyncStatus('fallback');
    await new Promise(resolve=>{
      let resolved=false;
      const done=()=>{if(!resolved){resolved=true;resolve();}};
      const timeout=setTimeout(()=>{state.realtimeOk=false;setSyncStatus('fallback');done();},9000);
      state.channel.subscribe(status=>{
        if(state.channel===null)return;
        if(status==='SUBSCRIBED'){
          clearTimeout(timeout);state.realtimeOk=true;setSyncStatus('live');done();
          void refreshRoomSnapshot();void fetchRecentSignals();
        }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
          state.realtimeOk=false;setSyncStatus('fallback');done();
        }
      });
    });
    await fetchRecentSignals();
    if(state.role==='host'){
      state.signalCleaner=setInterval(()=>{callRPC('karaoke_clean_signals',{p_room:state.room?.id}).catch(console.warn);},180000);
    }
  }
  async function fetchRecentSignals(){
    if(!state.room)return;
    const since=new Date(Date.now()-90000).toISOString();
    const {data,error}=await state.client.from('karaoke_signals').select('*').eq('receiver_id',state.user.id)
      .eq('room_id',state.room.id).gte('created_at',since).order('id',{ascending:true}).limit(70);
    if(error){console.warn('Inbox:',error);return;}
    (data||[]).forEach(receiveSignal);
  }
  function receiveSignal(signal) {
    if(!state.room||signal.room_id!==state.room.id)return;
    if(state.processedSignals.has(signal.id))return;
    state.processedSignals.add(signal.id);
    if(state.processedSignals.size>800) state.processedSignals.clear();
    state.signalChain=state.signalChain.then(()=>handleSignal(signal)).catch(err=>console.warn('Sinalização:',err));
  }
  async function sendSignal(to,kind,payload={}) {
    if(!state.room||!state.user)return;
    const {error}=await state.client.from('karaoke_signals').insert({room_id:state.room.id,sender_id:state.user.id,receiver_id:to,kind,payload});
    if(error)throw error;
  }

  // ----- Audio real-time: cada telefone cria uma conexão ponto a ponto com o anfitrião. -----
  function makePeer(peerId,hostSide=false) {
    const pc=new RTCPeerConnection({iceServers:cfg.ICE_SERVERS||[{urls:'stun:stun.l.google.com:19302'}]});
    pc.onicecandidate=ev=>{if(ev.candidate)sendSignal(peerId,'candidate',ev.candidate.toJSON()).catch(console.warn);};
    pc.onconnectionstatechange=()=>{
      if(hostSide){const item=state.peers.get(peerId);if(item){item.connection=pc.connectionState;renderMics();}}
      else {updateGuestMicState(pc.connectionState);if(['failed','closed'].includes(pc.connectionState)){state.localPeer=null;}}
    };
    if(hostSide) {
      const record={pc,analyser:null,source:null,gain:null,stream:null,connection:'connecting',level:0};
      state.peers.set(peerId,record);
      pc.ontrack=event=>{if(event.track.kind==='audio')connectIncomingAudio(peerId,event.streams[0]||new MediaStream([event.track]));};
    }
    return pc;
  }
  async function ensureOutputContext() {
    if(!state.context)state.context=new (window.AudioContext||window.webkitAudioContext)();
    return state.context;
  }
  async function unlockSound() {
    try {
      const ctx=await ensureOutputContext();await ctx.resume();
      $('start-audio').textContent='🔊 Som ativo';
      if(ctx.state==='running')toast('Saída de áudio liberada! 🎧');
    }catch(err){toast('O navegador bloqueou a saída de som: '+humanError(err),true);}
  }
  async function connectIncomingAudio(uid,stream) {
    if(state.role!=='host')return;
    const entry=state.peers.get(uid);if(!entry)return;
    try{
      const ctx=await ensureOutputContext();
      if(entry.source){try{entry.source.disconnect();entry.analyser.disconnect();entry.gain.disconnect();}catch{}}
      const source=ctx.createMediaStreamSource(stream);
      const analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.58;
      const gain=ctx.createGain();gain.gain.value=state.masterGain;
      source.connect(analyser);analyser.connect(gain);gain.connect(ctx.destination);
      Object.assign(entry,{source,analyser,gain,stream,connection:'connected'});
      renderMics();
      if(ctx.state!=='running')toast('🎧 Microfone conectado! Clique em “Ativar som” para ouvi-lo.');
    }catch(err){console.error(err);toast('Não foi possível preparar o áudio remoto.',true);}
  }
  async function handleSignal(signal) {
    if(!state.room)return;
    const from=signal.sender_id,data=signal.payload||{};
    if(state.role==='host'){
      if(signal.kind==='offer') {
        const singer=state.songs.find(s=>s.status==='playing');
        if(!singer||singer.user_id!==from){await sendSignal(from,'notice',{message:'Seu microfone entra ao vivo somente na sua música. Aguarde sua vez. 🎤'});return;}
        const limit=Number(cfg.MAX_ACTIVE_MICS)||8;
        if(!state.peers.has(from)&&state.peers.size>=limit){await sendSignal(from,'notice',{message:`O palco já tem ${limit} microfones. Aguarde alguém sair.`});return;}
        closePeer(from);
        const pc=makePeer(from,true);
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        await flushCandidates(from,pc);
        const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
        await sendSignal(from,'answer',pc.localDescription.toJSON());renderMics();
      } else if(signal.kind==='candidate') {
        const pc=state.peers.get(from)?.pc;
        if(pc?.remoteDescription){try{await pc.addIceCandidate(new RTCIceCandidate(data));}catch(err){console.warn('ICE remoto:',err);}}
        else bufferCandidate(from,data);
      } else if(signal.kind==='bye')closePeer(from);
    }else if(state.role==='guest'&&from===state.room.owner_id){
      const pc=state.localPeer;
      if(signal.kind==='answer'&&pc) {await pc.setRemoteDescription(new RTCSessionDescription(data));await flushCandidates(from,pc);}
      else if(signal.kind==='candidate') {
        if(pc?.remoteDescription){try{await pc.addIceCandidate(new RTCIceCandidate(data));}catch(err){console.warn('ICE local:',err);}}
        else bufferCandidate(from,data);
      } else if(signal.kind==='notice') {toast(data.message||'O anfitrião enviou um aviso.',true);await stopMicrophone(false);}
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
    if(state.role!=='guest')return;
    if(state.localStream){void stopMicrophone(true);return;}
    if(!navigator.mediaDevices?.getUserMedia){toast('Microfone exige HTTPS, permissão e navegador compatível.',true);return;}
    $('mic-permission-dialog').showModal();
  }
  async function toggleMic(){openMicPermission();}
  async function startMicrophone(){
    if(!state.room||state.role!=='guest')return;
    if(!navigator.mediaDevices?.getUserMedia){toast('Microfone exige HTTPS (ou localhost) e navegador compatível.',true);return;}
    const btn=$('mic-toggle');btn.disabled=true;
    try{
      // A permissão real do navegador só é solicitada após um clique explícito.
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:false,autoGainControl:false,channelCount:1},video:false});
      if(state.role!=='guest'||!state.room){stream.getTracks().forEach(t=>t.stop());return;}
      state.localStream=stream;
      stream.getAudioTracks().forEach(track=>track.onended=()=>{if(state.localStream)void stopMicrophone(true);});
      const ctx=new (window.AudioContext||window.webkitAudioContext)();state.localAudioContext=ctx;
      const analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.65;
      ctx.createMediaStreamSource(stream).connect(analyser);state.localAnalyzer=analyser;
      await ctx.resume();
      btn.classList.add('active');btn.setAttribute('aria-label','Desligar microfone');
      $('mic-headline').textContent=isMyTurn()?'A TV tá te esperando! 🎤':'Seu mic foi autorizado!';
      $('mic-description').textContent=isMyTurn()?'Seu som será enviado ao palco. Confira a conexão e cante!':'Teste o volume aqui. O áudio só será transmitido quando chegar sua música.';
      updateGuestMicState('preview');
      $('mic-capture-state').textContent='🎙️ Microfone ligado • fale ou cante para testar';
      $('mic-volume-title').textContent='NÍVEL DO SOM • CAPTAÇÃO LOCAL';
      if(isMyTurn())await connectMicToStage();
    }catch(err){console.error(err);toast(humanError(err),true);await stopMicrophone(false);}finally{btn.disabled=false;}
  }
  async function connectMicToStage(){
    if(!isMyTurn()||!state.localStream||state.localPeer||state.micConnecting)return;
    state.micConnecting=true;
    try{
      updateGuestMicState('connecting');
      const pc=makePeer(state.room.owner_id,false);state.localPeer=pc;
      state.localStream.getTracks().forEach(track=>pc.addTrack(track,state.localStream));
      const offer=await pc.createOffer();await pc.setLocalDescription(offer);
      await sendSignal(state.room.owner_id,'offer',pc.localDescription.toJSON());
    }catch(err){console.warn('Conexão de microfone:',err);try{state.localPeer?.close();}catch{}state.localPeer=null;updateGuestMicState('failed');toast('A TV não recebeu seu microfone. Verifique Wi-Fi/TURN e tente novamente.',true);}
    finally{state.micConnecting=false;}
  }
  function updateGuestMicState(connection){
    const badge=$('mic-status');if(!badge)return;
    const text={new:'● Conectando',connecting:'◌ Ligando ao palco',connected:'● PALCO CONECTADO',preview:'◉ Teste local',disconnected:'⚠ Desconectado',failed:'⚠ Falha no palco',closed:'● Desligado'};
    badge.textContent=text[connection]||'● '+connection;
    badge.classList.toggle('active',connection==='connected');
    badge.dataset.status=connection;
    $('mic-card').classList.toggle('stage-connected',connection==='connected');
    if(connection==='failed')toast('WebRTC falhou. Confira a conexão ou configure um servidor TURN.',true);
    if(connection==='disconnected'||connection==='failed'){
      $('mic-capture-state').textContent='⚠ O celular capta, mas não está conectado à TV.';
    }
  }
  async function stopMicrophone(notifyHost=true){
    if(notifyHost&&state.room&&state.user){sendSignal(state.room.owner_id,'bye').catch(console.warn);}
    try{state.localPeer?.close();}catch{}state.localPeer=null;
    state.localStream?.getTracks().forEach(track=>track.stop());state.localStream=null;
    try{await state.localAudioContext?.close();}catch{}
    state.localAudioContext=null;state.localAnalyzer=null;
    const btn=$('mic-toggle');btn.classList.remove('active','voice-detected');btn.setAttribute('aria-label','Ativar microfone');
    $('mic-headline').textContent=isMyTurn()?'É sua vez! Ative seu microfone 🎤':'Preparado pro seu momento?';
    $('mic-description').textContent='Toque para autorizar o microfone. Antes da sua música, o som fica apenas no celular.';
    $('mic-volume-title').textContent='NÍVEL DO SOM • AGUARDANDO PERMISSÃO';
    $('mic-capture-state').textContent='🔒 Microfone desligado — toque para autorizar';
    state.captureSeen=false;state.micConnecting=false;
    updateGuestMicState('closed');drawMobileLevels(0);
  }
  function calculateRMS(analyser){
    if(!analyser)return 0;
    const values=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(values);
    let power=0;for(let i=0;i<values.length;i++)power+=values[i]*values[i];
    return Math.sqrt(power/values.length);
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
      $('mic-capture-state').textContent=!state.localStream?'🔒 Microfone desligado':capturing?'🎵 SOM CAPTADO! Sua voz está chegando ao microfone':'🎙️ Microfone ligado • fale ou cante para testar';
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
    $('active-mic-count').textContent=`${entries.filter(([_,m])=>m.connection==='connected').length} conectados`;
    $('mic-list').innerHTML=entries.length?entries.map(([uid,record])=>{
      const score=liveScore(state.micStats.get(uid),state.songFrames||0);
      return `<div class="mic-person"><div class="mic-person-top"><span>🎙️ ${escapeHTML(memberName(uid))}</span><b>${score} pts</b></div><div class="mic-level"><span id="meter-${uid}" style="width:${Math.min(100,record.level*800)}%"></span></div><small style="display:block;margin-top:7px;color:var(--muted);font-size:10px">${escapeHTML(record.connection==='connected'?'● Ao vivo':record.connection==='failed'?'⚠ Conexão falhou':'○ Conectando...')}</small></div>`;
    }).join(''):'<div class="mic-empty">Quando alguém ativar o microfone, aparece aqui. ✨</div>';
  }
  function sampleAudio(){
    if(state.role==='guest'&&state.localAnalyzer)drawMobileLevels(calculateRMS(state.localAnalyzer));
    if(state.role!=='host')return;
    if(state.isPlaying&&state.currentSong)state.songFrames=(state.songFrames||0)+1;
    state.peers.forEach((entry,uid)=>{
      const rms=calculateRMS(entry.analyser);entry.level=rms;
      const meter=document.getElementById('meter-'+uid);if(meter)meter.style.width=Math.min(100,rms*800)+'%';
      if(state.isPlaying&&state.currentSong&&uid===state.currentSong.user_id&&entry.connection==='connected'){
        const stat=state.micStats.get(uid)||{sung:0,intensity:0};
        if(rms>.017){stat.sung++;stat.intensity+=Math.min(1,(rms-.017)/.082);}
        state.micStats.set(uid,stat);
      }
    });
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
      body:{action:'check',videoId,roomId:state.room.id}
    });
    if(error){
      let msg='Não foi possível verificar o vídeo. Configure a função YouTube no Supabase.';
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
  async function ensurePlayer(id) {
    await loadYouTubeAPI();
    if(state.playerReady&&state.player)return state.player;
    if(state.player)return new Promise(resolve=>{const it=setInterval(()=>{if(state.playerReady){clearInterval(it);resolve(state.player);}},50);});
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('O player de vídeo não carregou.')),14000);
      state.player=new window.YT.Player('youtube-player',{
        videoId:id,playerVars:{playsinline:1,controls:1,rel:0,origin:location.origin,cc_load_policy:0},
        events:{onReady:e=>{clearTimeout(timeout);state.playerReady=true;resolve(e.target);},onStateChange:onPlayerState,
          onError:e=>{const codes={2:'Link inválido.',5:'Este vídeo não pôde ser reproduzido no player.',100:'Vídeo removido ou privado.',101:'O dono ou detentor dos direitos bloqueou a incorporação.',150:'O dono ou detentor dos direitos bloqueou a incorporação.'};showVideoError(codes[e.data]||'O YouTube recusou este vídeo.');},
          onAutoplayBlocked:()=>toast('O navegador bloqueou o início automático. Clique em “Reproduzir”.')}
      });
    });
  }
  function onPlayerState(event) {
    if(state.role!=='host')return;
    state.isPlaying=event.data===window.YT.PlayerState.PLAYING;
    if(!state.isPlaying && state.playMetrics){state.playMetrics.lastPosition=null;state.playMetrics.lastWall=0;}
    if(state.isPlaying && $('video-error-dialog').open)$('video-error-dialog').close();
    $('play-pause').textContent=state.isPlaying?'⏸ Pausar':'▶ Reproduzir';
    if(event.data===window.YT.PlayerState.ENDED&&!state.finishing&&state.currentSong)finishSong(false);
  }
  function resetSongMetrics(){state.micStats=new Map();state.songFrames=0;state.isPlaying=false;state.playMetrics=null;}
  function setNowPlaying(song){
    $('now-title').textContent=song?.title||'O palco tá esperando você! 🎶';
    $('now-by').textContent=song?'Escolhida por '+memberName(song.user_id):'Adicione a primeira música pelo celular ou pelo painel.';
    $('song-pill').textContent=song?'✦ Faça barulho!':'✦ Prontos para o show?';
    $('video-placeholder').hidden=!!song;
  }
  async function startSong(song) {
    if(!song||state.role!=='host'||state.finishing)return;
    try {
      // Valide ANTES de remover a música anterior da tela ou marcar a nova como em reprodução.
      let playable=null;
      try{playable=await checkVideoAvailability(song.video_id);}
      catch(err){toast('Não foi possível pré-verificar o YouTube. Vou tentar reproduzir normalmente; se falhar, trocamos o vídeo.',true);}
      if(playable===false){showVideoError('Este vídeo não está liberado para reprodução incorporada no Brasil. Escolha outra versão.',song);return;}
      if(state.currentSong)await finishSong(true,false);
      await callRPC('karaoke_start_song',{p_room:state.room.id,p_song:song.id});
      state.currentSong={...song,status:'playing'};state.room.current_song_id=song.id;
      resetSongMetrics();state.playMetrics={songId:song.id, played:0, lastPosition:null, lastWall:0, duration:0, sent:false, sending:false};setNowPlaying(song);hideFinal();updateVoxLine('singing');
      const player=await ensurePlayer(song.video_id);
      player.loadVideoById(song.video_id);renderMics();queueChanged();
    }catch(err){toast('Não foi possível tocar: '+humanError(err),true);}
  }
  async function resumeExistingSong(){
    const song=state.songs.find(s=>s.id===state.room?.current_song_id);
    if(!song)return;
    state.currentSong=song;setNowPlaying(song);resetSongMetrics();state.playMetrics={songId:song.id,played:0,lastPosition:null,lastWall:0,duration:0,sent:false,sending:false};
    try {const player=await ensurePlayer(song.video_id);player.cueVideoById(song.video_id);toast('Música recuperada. Clique em Reproduzir para continuar.');}
    catch(err){toast(humanError(err),true);}
  }
  function getScoreResults(){
    // Apenas a pessoa que escolheu a música recebe a avaliação desta apresentação.
    const uids=new Set(state.currentSong?.user_id?[state.currentSong.user_id]:[]);
    const seconds=Number(((state.songFrames||0)*.14).toFixed(2));
    return [...uids].slice(0,12).map(uid=>{
      const stat=state.micStats.get(uid)||{sung:0,intensity:0};
      return {user_id:uid,score:liveScore(stat,state.songFrames||0),sung_seconds:Number((stat.sung*.14).toFixed(2)),observed_seconds:seconds};
    });
  }
  /* Um veredito bem brasileiro. Os textos são originais, sem copiar falas de artistas. */
  const memes=[
    {max:19,icon:'🫠',query:'dramatic shocked reaction',
      familia:['A gente veio pela coragem e ficou pelo espetáculo!','Aplausos pra quem se jogou de coração!'],
      debochado:['O microfone pediu demissão, mona!','O compositor ouviu e solicitou direito de resposta!','O importante é que você não deixou o medo cantar!'],
      caos:['MEU DEUS! CHAMEM O RESGATE DO REFRÃO!','O microfone quer uma medida protetiva contra esse agudo!']},
    {max:39,icon:'🐸',query:'funny confused shocked meme',
      familia:['O talento tá chegando. Só pegou trânsito!','A plateia te amou, e isso já é prêmio!'],
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
    const value=Math.max(0,Math.min(100,Math.round(Number(result?.score)||0)));
    const meme=selectedMeme(value);
    clearGif();
    $('final-meme').textContent=meme.icon;
    $('final-person').textContent=memberName(result?.user_id);
    $('final-number').innerHTML=`${value}<span>/100</span>`;
    const stars=Math.ceil(value/20);
    $('final-stars').textContent='★'.repeat(stars)+'☆'.repeat(5-stars);
    $('final-stars').setAttribute('aria-label',`${stars} de cinco estrelas`);
    $('final-caption').textContent=chooseDifferent(meme[state.humorMode]||meme.debochado);
    $('final-overlay').hidden=false;
    updateVoxLine('ending');
    if(value>=60)confetti();
    const token=state.reactionToken;
    void fetchReactionGIF(meme.query,token);
  }
  function hideFinal(){clearTimeout(state.scoreOverlayTimer);clearGif();$('final-overlay').hidden=true;}
  async function finishSong(skipped=false,showResults=true){
    if(!state.currentSong||state.finishing)return;
    state.finishing=true;
    const results=skipped?[]:getScoreResults();
    try {
      await callRPC('karaoke_finish_song',{p_room:state.room.id,p_skipped:skipped,p_results:results});
      state.isPlaying=false;
      if(skipped){try{state.player?.stopVideo();}catch{}}
      state.currentSong=null;state.playMetrics=null;state.room.current_song_id=null;
      // Privacidade: feche os microfones ao fim do show.
      for(const uid of [...state.peers.keys()]){void sendSignal(uid,'bye').catch(console.warn);closePeer(uid);}
      if(!skipped&&showResults){
        showFinal([...results].sort((a,b)=>b.score-a.score)[0]||{score:0,user_id:null});
        state.scoreOverlayTimer=setTimeout(()=>{if(state.role==='host')advanceSong();},14000);
      }
      $('play-pause').textContent='▶ Reproduzir';queueChanged();
    }catch(err){toast('Falha ao finalizar música: '+humanError(err),true);}
    finally{state.finishing=false;}
  }
  async function advanceSong(){
    hideFinal();
    if(state.currentSong)await finishSong(true,false);
    await fetchSongs();renderQueue();
    const next=state.songs.find(s=>s.status==='queued');
    if(next){updateVoxLine('queue');await startSong(next);}
    else {setNowPlaying(null);toast('A fila acabou! Hora de escolher outro hit. 🎶');}
  }
  async function togglePlayback(){
    if(!state.currentSong){await advanceSong();return;}
    if(!state.playerReady){toast('O vídeo ainda está carregando.',true);return;}
    if(state.isPlaying)state.player.pauseVideo();else state.player.playVideo();
  }
  // Biblioteca colaborativa: somente tempo REAL tocando. Saltos/seek, pausas e buffering
  // não aumentam o contador. Cada instância de música entra no histórico no máximo 1 vez.
  async function recordQualifyingPlayback(metrics){
    if(!state.room || !state.currentSong || state.currentSong.id!==metrics.songId || metrics.sent || metrics.sending)return;
    metrics.sending=true;
    try{
      await callRPC('karaoke_confirm_playback',{
        p_room:state.room.id,p_song:metrics.songId,
        p_played_seconds:Math.floor(metrics.played),p_duration_seconds:Math.ceil(metrics.duration)
      });
      metrics.sent=true;
      void loadCatalog(true);
      toast('⭐ Um hit entrou no acervo do Tem Gogó!');
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
  function updateVideoProgress(){
    if(state.role!=='host'||!state.playerReady||!state.currentSong){$('time-now').textContent='0:00';$('time-all').textContent='0:00';$('progress-fill').style.width='0%';return;}
    try{const current=state.player.getCurrentTime(),duration=state.player.getDuration();$('time-now').textContent=formatTime(current);$('time-all').textContent=formatTime(duration);$('progress-fill').style.width=duration?Math.min(100,current/duration*100)+'%':'0%';measureActualPlayback(current,duration);}catch{}
  }

  // ----- Fila de músicas e busca opcional pela API oficial do YouTube. -----
  async function enqueue(form,host){
    if(!checkBackend()||!state.room)return;
    const input=$(host?'host-url':'guest-video-url');
    const title=$(host?'host-song-title':'guest-song-title');
    const video=youtubeId(input.value);
    if(!video){toast('Cole um link válido de vídeo do YouTube.',true);return;}
    const button=form.querySelector('[type=submit]');setLoading(button,true,'Entrando na fila...');
    try{
      let playable=null;
      try{playable=await checkVideoAvailability(video);}
      catch{toast('Não consegui verificar o link agora. Vou adicioná-lo, mas pode haver restrição de reprodução.',true);}
      if(playable===false)throw new Error('Este link não permite reprodução incorporada no Brasil. Procure outra versão.');
      await callRPC('karaoke_enqueue',{p_room:state.room.id,p_video:video,p_title:title.value.trim()});
      input.value='';title.value='';await fetchSongs();renderQueue();
      if(host && $('song-dialog').open)$('song-dialog').close();
      toast('Música adicionada! Agora é só ensaiar o refrão. 🎶');
    }catch(err){toast(humanError(err),true);}finally{setLoading(button,false);}
  }
  // A pesquisa externa usa Edge Function autenticada e segredo SerpApi no Supabase.
  // Nunca abrir outra aba nem exigir colar um URL quando a busca estiver habilitada.
  // Catálogo coletivo de vídeos já tocados pelo menos 50%, sem SerpApi e sem dados pessoais.
  async function loadCatalog(force=false){
    if(!state.client||!state.room)return;
    if(!force && Date.now()-state.catalogFetchedAt<45000)return;
    const roomId=state.room.id;
    try{
      const {data,error}=await state.client.rpc('karaoke_catalog_search',{p_query:'',p_limit:10});
      if(error)throw error;
      if(!state.room || state.room.id!==roomId)return;
      state.catalog=(data||[]).filter(x=>youtubeId(x.video_id));
      state.catalogFetchedAt=Date.now();
      renderCatalog();
    }catch(err){
      console.warn('Catálogo indisponível. Execute MIGRACAO_008_HISTORICO.sql:',err.message);
      document.querySelectorAll('.hit-library-list').forEach(el=>{el.textContent='O acervo estará disponível após instalar a atualização do banco. 🎶';});
    }
  }
  async function queryLocalCatalog(query){
    if(!state.client)return [];
    const {data,error}=await state.client.rpc('karaoke_catalog_search',{p_query:query,p_limit:12});
    if(error)throw error;
    return (data||[]).filter(x=>youtubeId(x.video_id));
  }
  function catalogCard(item,host){
    const videoId=youtubeId(item.video_id);
    if(!videoId)return null;
    const card=document.createElement('article');card.className='history-song-card';
    const cover=document.createElement('img');cover.src='https://i.ytimg.com/vi/'+videoId+'/mqdefault.jpg';cover.alt='';cover.loading='lazy';cover.width=95;cover.height=54;
    const info=document.createElement('div');info.className='history-song-info';
    const title=document.createElement('strong');title.textContent=item.title;
    const tiny=document.createElement('small');tiny.textContent=`🔥 ${Number(item.plays)||0} apresentação(ões) no Tem Gogó`;
    info.append(title,tiny);
    const button=document.createElement('button');button.type='button';button.className='button button-primary history-add';button.textContent='+ FILA';
    button.setAttribute('aria-label','Adicionar '+item.title+' à fila');
    button.addEventListener('click',()=>addSearchedVideo({id:videoId,title:item.title},host,button,card));
    card.append(cover,info,button);return card;
  }
  function renderCatalog(){
    const groups=[['guest-library',false],['stage-library',true]];
    for(const [id,host] of groups){
      const holder=$(id);if(!holder)continue;
      holder.replaceChildren();
      if(!state.catalog.length){holder.textContent='Ainda não temos hits confirmados. O primeiro sucesso pode ser seu! 🎤';continue;}
      state.catalog.slice(0,host?5:10).forEach(item=>{const card=catalogCard(item,host);if(card)holder.append(card);});
    }
  }
  function showMoreExternal(results,host,query){
    const panel=document.createElement('div');panel.className='more-external';
    const info=document.createElement('span');info.textContent='Não achou seu hit? A busca externa usa uma consulta da cota mensal.';
    const btn=document.createElement('button');btn.className='button button-soft';btn.type='button';btn.textContent='🔎 Buscar outras versões no YouTube';
    btn.addEventListener('click',()=>searchYoutube(host,true));
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
  async function addSearchedVideo(item,host,button,results) {
    if(!state.room || !state.client){toast('Entre numa festa antes de adicionar músicas.',true);return;}
    if(!youtubeId(item.id)){toast('Vídeo indisponível. Escolha outro.',true);return;}
    setLoading(button,true,'Entrando na fila...');
    try {
      await callRPC('karaoke_enqueue',{
        p_room:state.room.id, p_video:item.id, p_title:item.title.slice(0,120)
      });
      await fetchSongs();renderQueue();
      if(host && $('song-dialog').open)$('song-dialog').close();
      else {const feedback=results.closest('.search-results')||results;if(feedback.id==='search-results')makeSearchMessage(feedback,'💚 Entrou na fila! Pode escolher outro hit se quiser.');}
      toast('🎤 '+item.title.slice(0,65)+' entrou na fila. VOX tá de olho!');
    }catch(err){toast(humanError(err),true);}
    finally{setLoading(button,false);}
  }
  function renderYoutubeResults(hits,results,host){
    results.replaceChildren();
    if(!hits.length){makeSearchMessage(results,'Nenhum karaokê encontrado. Tente outro nome ou artista.');return;}
    const caption=document.createElement('div');caption.className='search-count';
    caption.textContent=`🎶 ${hits.length} sugestões do YouTube · a reprodução pode ter restrições`;
    results.append(caption);
    hits.forEach(hit=>{
      const videoId=youtubeId(hit.id);
      if(!videoId)return;
      const card=document.createElement('div');card.className='youtube-result-card';
      const image=document.createElement('img');
      image.src='https://i.ytimg.com/vi/'+videoId+'/mqdefault.jpg';
      image.loading='lazy';image.alt='Capa do vídeo '+hit.title;image.width=120;image.height=68;
      const info=document.createElement('div');info.className='youtube-result-info';
      const title=document.createElement('strong');title.textContent=decodedYouTubeText(hit.title);
      const channel=document.createElement('small');channel.textContent=decodedYouTubeText(hit.channel||'Canal no YouTube');
      info.append(title,channel);
      const button=document.createElement('button');button.type='button';
      button.className='button button-primary youtube-add';
      button.textContent='+ FILA';button.setAttribute('aria-label','Adicionar '+hit.title+' à fila');
      button.addEventListener('click',()=>addSearchedVideo({id:videoId,title:decodedYouTubeText(hit.title)},host,button,results));
      card.append(image,info,button);results.append(card);
    });
  }
  async function searchYoutube(host,forceExternal=false) {
    const search=$(host?'host-search':'youtube-search');
    const results=$(host?'host-results':'search-results');
    const button=$(host?'host-search-button':'search-youtube');
    const query=search.value.trim().replace(/\s+/g,' ');
    if(query.length<2){makeSearchMessage(results,'Escreva o nome da música ou artista para buscar.');search.focus();return;}
    if(!state.client||!state.room){makeSearchMessage(results,'Entre numa festa antes de buscar músicas.','error');return;}
    if(!forceExternal){
      setLoading(button,true,'Consultando nosso acervo...');
      try{
        const found=await queryLocalCatalog(query);
        results.replaceChildren();
        const label=document.createElement('div');label.className='search-count';
        label.textContent=found.length?`💚 ${found.length} hit(s) do acervo — não consomem buscas!`:'O acervo ainda não tem essa música. 💅';
        results.append(label);
        found.forEach(item=>{const card=catalogCard(item,host);if(card)results.append(card);});
        showMoreExternal(results,host,query);
        return;
      }catch(err){
        makeSearchMessage(results,'Acervo ainda não instalado no banco. Você pode buscar externamente.');
        showMoreExternal(results,host,query);
        return;
      }finally{setLoading(button,false);}
    }
    const key=query.toLocaleLowerCase('pt-BR');
    const cached=searchMemory.get(key);
    if(cached&&Date.now()-cached.date<5*60*1000){renderYoutubeResults(cached.items,results,host);return;}
    setLoading(button,true,'Buscando...');
    makeSearchMessage(results,'🔎 Procurando o hino perfeito no YouTube...');
    try {
      const {data,error}=await state.client.functions.invoke('youtube-search',{
        body:{ query,roomId:state.room.id }
      });
      if(error){
        // As mensagens do backend podem vir em Response; o fallback orienta a configuração.
        let detail='Busca externa indisponível. Configure SERPAPI_KEY no Supabase ou escolha um hit do acervo.';
        try{const j=await error.context?.json?.();if(j?.error)detail=j.error;}catch{}
        throw new Error(detail);
      }
      if(data?.error)throw new Error(data.error);
      if(!Array.isArray(data?.items))throw new Error('Resposta inválida da busca. Tente novamente.');
      const hits=data.items.filter(i=>i&&youtubeId(i.id)&&typeof i.title==='string').slice(0,8);
      searchMemory.set(key,{date:Date.now(),items:hits});
      if(searchMemory.size>30)searchMemory.delete(searchMemory.keys().next().value);
      renderYoutubeResults(hits,results,host);
    }catch(err){
      makeSearchMessage(results,humanError(err)+' Você ainda pode usar a opção “Tenho um link” abaixo.','error');
    }finally{setLoading(button,false);}
  }
  function openScoreboard(){
    const rankings=new Map();
    state.scores.forEach(row=>{
      const current=rankings.get(row.user_id)||{total:0,best:0,count:0};
      current.total+=row.score;current.count++;current.best=Math.max(current.best,row.score);
      rankings.set(row.user_id,current);
    });
    const sorted=[...rankings.entries()].sort((a,b)=>(b[1].total/b[1].count)-(a[1].total/a[1].count));
    $('score-list').innerHTML=sorted.length?sorted.map(([uid,data],i)=>`<div class="score-row"><span class="score-rank">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span><div class="score-detail"><strong>${escapeHTML(memberName(uid))}</strong><small>${data.count} música(s) • melhor nota: ${data.best} • ${'★'.repeat(Math.ceil(data.best/20))}</small></div><strong class="score-value">${Math.round(data.total/data.count)}</strong></div>`).join(''):'<p class="subtle">O ranking começa depois da primeira música completa. 🎤</p>';
    $('score-dialog').showModal();
  }
  async function unlockWakeLock(){
    if('wakeLock' in navigator&&document.visibilityState==='visible'){
      try{state.wakeLock=await navigator.wakeLock.request('screen');}catch{}
    }
  }
  function startTicker(){
    clearInterval(state.ticker);let cycles=0;
    state.ticker=setInterval(()=>{
      if(!state.room)return;
      sampleAudio();cycles++;
      if(cycles%7===0){updateVideoProgress();if(state.role==='host')renderMics();}
    },140);
  }
  async function stopSession(){
    clearInterval(state.ticker);state.ticker=null;
    clearInterval(state.signalCleaner);state.signalCleaner=null;
    clearInterval(state.memberVerifier);state.memberVerifier=null;
    clearInterval(state.roomPoller);state.roomPoller=null;clearInterval(state.signalPoller);state.signalPoller=null;state.realtimeOk=false;state.syncQueued=false;
    clearTimeout(state.roomReloadTimer);clearTimeout(state.scoreOverlayTimer);
    if(state.localStream)await stopMicrophone(true);
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
    state.peers.clear();state.candidateBuffer.clear();state.processedSignals.clear();
    state.songFrames=0;state.micStats.clear();state.playMetrics=null;state.catalog=[];state.catalogFetchedAt=0;state.currentSong=null;state.room=null;state.role=null;
    state.songs=[];state.members=[];state.scores=[];state.lastMySong=null;state.isPlaying=false;state.finishing=false;
    hideFinal();$('video-placeholder').hidden=false;$('qr-bubble').classList.remove('qr-expanded');
  }
  async function leaveGuest(){
    if(state.role!=='guest')return;
    const room=state.room?.id,user=state.user?.id;
    await stopSession();
    if(room&&user)state.client.from('karaoke_members').delete().eq('room_id',room).eq('user_id',user).then(({error})=>{if(error)console.warn(error);});
    history.replaceState(null,'',new URL('./',location.href).href);
    localStorage.removeItem('tem-gogo-pending-room');
    if(state.user)await openLobby();else showPinEntry('');
  }
  async function exitStage(){
    if(state.role!=='host')return;
    const agreed=window.confirm('Encerrar a festa para todas as pessoas? A fila deixa de aceitar músicas.');
    if(!agreed)return;
    const id=state.room?.id;
    try{await callRPC('karaoke_close_room',{p_room:id});await stopSession();await openLobby();toast('Festa encerrada. Até o próximo show! 👑');}
    catch(err){toast(humanError(err),true);}
  }
  async function logout(){
    if(state.client){const {error}=await state.client.auth.signOut();if(error){toast(humanError(error),true);return;}}
    await stopSession();state.user=null;show('landing');toast('Saiu da sua conta.');
  }
  async function changeRoomPin(event){
    event.preventDefault();
    if(state.role!=='host'||!state.room)return;
    const pin=$('new-room-pin').value.trim();
    if(!/^[0-9]{6}$/.test(pin)){toast('Use uma senha com seis números.',true);return;}
    const button=event.target.querySelector('[type=submit]');setLoading(button,true,'Protegendo...');
    try{
      if(!window.confirm('Trocar a senha? Os convidados atuais perderão acesso e precisarão entrar novamente.'))return;
      await callRPC('karaoke_change_pin',{p_room:state.room.id,p_pin:pin});
      for(const id of [...state.peers.keys()])closePeer(id);
      $('new-room-pin').value='';$('pin-dialog').close();
      toast('Senha trocada! Repasse apenas aos convidados. 🔐');
      await fetchMembers();renderAll();
    }catch(err){toast(humanError(err),true);}finally{setLoading(button,false);}
  }
  function attachEvents(){
    $('invite-install').addEventListener('click',installFromInvite);
    $('invite-continue').addEventListener('click',()=>showPinEntry(state.inviteRoom));
    $('regen-pin').addEventListener('click',()=>{$('new-room-pin').value=sixDigitPin();});
    $('change-pin').addEventListener('click',()=>{$('pin-dialog').showModal();});
    $('pin-close').addEventListener('click',()=>$('pin-dialog').close());
    $('pin-change-form').addEventListener('submit',changeRoomPin);
    $('hub-join-room').addEventListener('click',()=>showPinEntry(''));
    $('guest-switch').addEventListener('click',goToMyRooms);
    $('stage-switch').addEventListener('click',goToMyRooms);
    $('copy-room-invite').addEventListener('click',async()=>{
      if(!state.readyRoom)return;
      const {room,pin}=state.readyRoom;
      const text=`🎤 Tem Gogó — ${room.title}\nConvite: ${currentURL(room.code)}\nCódigo: ${room.code}\nSenha da festa: ${pin}\n(Não é a senha da sua conta.)`;
      try{await navigator.clipboard.writeText(text);toast('Convite copiado! Envie só para quem foi chamado. 🎟️');}
      catch{toast('Copiar indisponível; copie o código e a senha mostrados na tela.',true);}
    });
    $('ready-open-stage').addEventListener('click',async()=>{
      const saved=state.readyRoom;
      $('room-ready-dialog').close();state.readyRoom=null;
      $('ready-pin').textContent='••••••';
      if(saved)await enterRoomAsHost(saved.room);
    });
    $('room-ready-dialog').addEventListener('cancel',e=>{e.preventDefault();toast('Use Abrir palco para continuar. A senha só aparece agora.');});
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
    $('signup-form').addEventListener('submit',signup);
    $('signup-close').addEventListener('click',closeSignup);
    $('signup-back-login').addEventListener('click',()=>{closeSignup();$('auth-email').focus();});
    $('signup-show-password').addEventListener('change',event=>{
      ['signup-password','signup-confirm'].forEach(id=>$(id).type=event.target.checked?'text':'password');
    });
    $('guest-entry-form').addEventListener('submit',joinParty);$('create-room-form').addEventListener('submit',makeRoom);
    $('logout-button').addEventListener('click',logout);
    $('stage-exit').addEventListener('click',exitStage);
    $('start-audio').addEventListener('click',unlockSound);
    $('play-pause').addEventListener('click',togglePlayback);
    $('skip-track').addEventListener('click',advanceSong);
    $('theme-cycle').addEventListener('click',themeCycle);
    document.querySelectorAll('.open-settings').forEach(button=>button.addEventListener('click',()=>{$('settings-dialog').showModal();}));
    $('settings-close').addEventListener('click',()=>$('settings-dialog').close());
    $('settings-done').addEventListener('click',()=>{$('settings-dialog').close();toast('Tá TUDO, Brasil! Seu Tem Gogó tá pronto. 💅');});
    document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>applyTheme(button.dataset.themeChoice,true)));
    $('humor-mode').addEventListener('change',e=>{state.humorMode=e.target.value;localStorage.setItem('tem-gogo-humor',state.humorMode);toast('VOX atualizado. O deboche tem direção de arte!');});
    $('gifs-enabled').addEventListener('change',e=>{state.gifsEnabled=e.target.checked;localStorage.setItem('tem-gogo-gifs',String(state.gifsEnabled));});
    $('effects-enabled').addEventListener('change',e=>{state.effectsEnabled=e.target.checked;localStorage.setItem('tem-gogo-effects',String(state.effectsEnabled));document.body.classList.toggle('effects-off',!state.effectsEnabled);});
    $('settings-contrast').addEventListener('change',e=>toggleContrast(e.target.checked));
    $('contrast-toggle').addEventListener('click',()=>toggleContrast(!document.body.classList.contains('high-contrast')));
    $('fullscreen-button').addEventListener('click',async()=>{
      try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
      catch{toast('Tela cheia não disponível neste navegador.',true);}
    });
    $('volume-range').addEventListener('input',event=>{
      state.masterGain=Number(event.target.value)/100;
      $('volume-label').textContent=event.target.value+'%';
      state.peers.forEach(record=>{if(record.gain)record.gain.gain.value=state.masterGain;});
    });
    $('queue-list').addEventListener('click',e=>{
      const remove=e.target.closest('[data-remove-song]');
      if(remove){
        const target=state.songs.find(s=>s.id===remove.dataset.removeSong);
        if(!target||!window.confirm('Tirar esta música da fila?'))return;
        callRPC('karaoke_remove_song',{p_room:state.room.id,p_song:target.id})
          .then(()=>{toast('Música retirada da fila.');queueChanged();})
          .catch(err=>toast(humanError(err),true));
        return;
      }
      const button=e.target.closest('[data-play-song]');if(button){const song=state.songs.find(s=>s.id===button.dataset.playSong);if(song)startSong(song);}
    });
    $('open-add-song').addEventListener('click',()=>$('song-dialog').showModal());
    $('open-scoreboard').addEventListener('click',openScoreboard);
    document.querySelectorAll('[data-close-score]').forEach(btn=>btn.addEventListener('click',()=>$('score-dialog').close()));
    $('host-song-form').addEventListener('submit',e=>{e.preventDefault();enqueue(e.target,true);});
    $('guest-song-form').addEventListener('submit',e=>{e.preventDefault();enqueue(e.target,false);});
    $('search-youtube').addEventListener('click',()=>searchYoutube(false));
    $('host-search-button').addEventListener('click',()=>searchYoutube(true));
    $('youtube-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchYoutube(false);}});
    $('host-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchYoutube(true);}});
    $('mic-toggle').addEventListener('click',toggleMic);
    $('mic-confirm-permission').addEventListener('click',()=>{$('mic-permission-dialog').close();void startMicrophone();});
    $('mic-cancel-permission').addEventListener('click',()=>$('mic-permission-dialog').close());
    $('go-mic-now').addEventListener('click',()=>{switchMobileTab('mic');$('mic-toggle').focus({preventScroll:true});});
    $('leave-party').addEventListener('click',leaveGuest);
    $('mobile-tab-mic').addEventListener('click',()=>switchMobileTab('mic'));
    $('mobile-tab-queue').addEventListener('click',()=>switchMobileTab('queue'));
    $('final-close').addEventListener('click',advanceSong);
    $('qr-bubble').addEventListener('click',()=> $('qr-bubble').classList.toggle('qr-expanded'));
    $('qr-bubble').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('qr-bubble').classList.toggle('qr-expanded');}});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(state.role==='host'&&!state.wakeLock)unlockWakeLock();void refreshRoomSnapshot();}});
    window.addEventListener('online',()=>{toast('Internet conectada novamente. ✅');void refreshRoomSnapshot();void fetchRecentSignals();});
    window.addEventListener('offline',()=>{setSyncStatus('offline');toast('Sem internet: o palco e a fila podem parar.',true);});
  }
  function switchMobileTab(tab){
    const mic=tab==='mic';$('guest-mic-panel').hidden=!mic;$('guest-queue-panel').hidden=mic;
    $('mobile-tab-mic').classList.toggle('active',mic);$('mobile-tab-queue').classList.toggle('active',!mic);
    $('mobile-tab-mic').setAttribute('aria-selected',String(mic));
    $('mobile-tab-queue').setAttribute('aria-selected',String(!mic));
  }

  init().catch(err=>{console.error(err);toast(humanError(err),true);});
})();
