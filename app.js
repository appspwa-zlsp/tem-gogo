/* Tem Gogó v3 — edição brasileira: palco, VOX e reações GIPHY (opcional) — aplicativo estático (PWA + Supabase + WebRTC + YouTube IFrame API).
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
    roomReloadTimer: null, memberVerifier: null, scoreOverlayTimer: null, humorMode: 'debochado', gifsEnabled: true, effectsEnabled: true, reactionToken: 0, voxIndex: 0
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
    $('room-pin').value=sixDigitPin();
    if (!configured()) {
      $('auth-state').textContent='⚙️ Configure assets/config.js e execute db/INSTALAR_TEM_GOGO.sql para ativar as salas.';
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
      }else if(state.user && !isAnonymous(state.user)) await openLobby();
      else if(isStandalone())showPinEntry('');
    }catch(err){toast(humanError(err),true);}
    state.client.auth.onAuthStateChange((_event,session)=>{state.user=session?.user||null;});
  }
  function isAnonymous(user) {return user?.is_anonymous===true || user?.app_metadata?.provider==='anonymous';}
  function checkBackend() {if (!state.client){toast('Antes de usar, configure o Supabase em assets/config.js.',true);return false;}return true;}
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
    show('lobby'); await loadMyRooms();
  }
  async function loadMyRooms() {
    if(!state.client || !state.user)return;
    const {data,error}=await state.client.from('karaoke_rooms').select('id,title,code,status,expires_at,created_at')
      .eq('owner_id',state.user.id).eq('status','open').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(5);
    if(error){console.warn(error);return;}
    $('existing-rooms').innerHTML=(data||[]).length?'<div class="field-label">Ou continue uma sala aberta:</div>':'';
    (data||[]).forEach(room=>{
      const button=document.createElement('button');button.className='existing-room-button';button.type='button';
      button.innerHTML=`<span>📺 ${escapeHTML(room.title)}</span><span>${escapeHTML(room.code)} ↗</span>`;
      button.addEventListener('click',()=>enterRoomAsHost(room));$('existing-rooms').append(button);
    });
  }
  async function login(event) {
    event.preventDefault();if(!checkBackend())return;
    const button=$('login-button');setLoading(button,true,'Entrando...');
    try {
      const {data,error}=await state.client.auth.signInWithPassword({email:$('auth-email').value.trim(),password:$('auth-password').value});
      if(error)throw error; state.user=data.user; await openLobby();
    }catch(err){$('auth-state').textContent=humanError(err);toast(humanError(err),true);}finally{setLoading(button,false);}
  }
  async function signup() {
    if(!checkBackend())return;
    const email=$('auth-email').value.trim(),password=$('auth-password').value;
    if(!email || password.length<10 || !/[A-Za-zÀ-ÿ]/.test(password) || !/[0-9]/.test(password)){toast('Para criar conta, use senha de 10 ou mais caracteres com letras e números.',true);return;}
    const button=$('signup-button');setLoading(button,true,'Criando sua conta...');
    try{
      const {data,error}=await state.client.auth.signUp({email,password,options:{emailRedirectTo:new URL('./',location.href).href}});
      if(error)throw error;
      if(data.session){state.user=data.user;await openLobby();}
      else {toast('Conta solicitada! Confira seu e-mail para confirmar o cadastro.');$('auth-state').textContent='📬 Confirme o cadastro por e-mail e depois entre com sua senha.';}
    }catch(err){toast(humanError(err),true);}finally{setLoading(button,false);}
  }
  async function makeRoom(event) {
    event.preventDefault();if(!checkBackend())return;
    const button=event.target.querySelector('[type=submit]');setLoading(button,true,'Criando...');
    try{
      const pin=$('room-pin').value.trim();
      if(!/^[0-9]{6}$/.test(pin))throw new Error('Crie uma senha de seis números para sua festa.');
      const data=await callRPC('karaoke_create_room',{p_title:$('room-title').value.trim(),p_pin:pin});
      $('room-pin').value=sixDigitPin();
      await enterRoomAsHost({id:data[0].room_id,code:data[0].room_code,title:data[0].room_title,owner_id:state.user.id});
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
    state.room=room;state.role='host';$('stage-room-title').textContent=room.title;
    $('room-code').textContent=room.code;show('stage');drawQR();
    try{await hydrateRoom();await subscribeRoom();startTicker();
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
    state.room=room;state.role='guest';$('guest-display-name').textContent=name;$('guest-room-code').textContent=room.code;
    $('guest-room-title').textContent=room.title;show('guest');updateVoxLine('opening');
    history.replaceState(null,'',currentURL(room.code));
    localStorage.setItem('tem-gogo-pending-room',room.code);
    switchMobileTab('queue');
    try{await hydrateRoom();await subscribeRoom();startTicker();startMemberVerifier();toast('Entrou! 🎉 Escolha um hit para sua fila.');}
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
  async function hydrateRoom() {await Promise.all([fetchRoom(),fetchSongs(),fetchMembers(),fetchScores()]);renderAll();}
  async function fetchRoom() {
    if(!state.room)return;
    const {data,error}=await state.client.from('karaoke_rooms').select('id,code,title,owner_id,status,current_song_id,expires_at')
      .eq('id',state.room.id).single();
    if(error)throw error;
    state.room={...state.room,...data};
    if(state.role==='guest' && (data.status!=='open'||new Date(data.expires_at)<new Date())) {toast('Esta sala foi encerrada.',true);await leaveGuest();return;}
    const found=state.songs.find(s=>s.id===data.current_song_id);
    if(state.role==='guest') setGuestNowPlaying(found||null);
  }
  async function fetchSongs() {
    if(!state.room)return;
    const {data,error}=await state.client.from('karaoke_songs').select('*').eq('room_id',state.room.id)
      .in('status',['queued','playing']).order('created_at',{ascending:true}).limit(150);
    if(error)throw error;
    state.songs=data||[];
    if(state.role==='guest')setGuestNowPlaying(state.songs.find(s=>s.id===state.room?.current_song_id)||null);
  }
  async function fetchMembers() {
    if(!state.room)return;
    const {data,error}=await state.client.from('karaoke_members').select('user_id,display_name,joined_at')
      .eq('room_id',state.room.id).order('joined_at',{ascending:true});if(error)throw error;
    state.members=data||[];
  }
  async function fetchScores(){if(!state.room)return;const {data,error}=await state.client.from('karaoke_scores').select('*').eq('room_id',state.room.id).order('created_at',{ascending:false}).limit(250);if(error)throw error;state.scores=data||[];}
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
    }
  }
  function setGuestNowPlaying(song){$('guest-now-playing').textContent=song?.title || 'O palco tá pronto pra você!';$('guest-now-singer').textContent=song?'Escolhida por '+memberName(song.user_id):'Escolha um hit na aba ao lado.';}
  function drawQR() {
    const holder=$('stage-qr');holder.replaceChildren();
    if(window.QRCode){new window.QRCode(holder,{text:currentURL(state.room.code),width:240,height:240,colorDark:'#171023',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});}
    else {holder.textContent='QR indisponível';toast('Biblioteca de QR Code não carregou. Compartilhe o código da sala.',true);}
  }
  function queueChanged(){clearTimeout(state.roomReloadTimer);state.roomReloadTimer=setTimeout(async()=>{if(!state.room)return;try{await Promise.all([fetchSongs(),fetchMembers(),fetchRoom(),fetchScores()]);renderAll();}catch(err){console.warn(err);}},220);}
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
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('O canal ao vivo não conectou. Verifique Realtime no Supabase.')),15000);
      state.channel.subscribe(status=>{
        if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){clearTimeout(timeout);reject(new Error('Erro no canal ao vivo (Realtime).'));}
      });
    });
    await fetchRecentSignals();
    if(state.role==='host'){
      state.signalCleaner=setInterval(()=>{callRPC('karaoke_clean_signals',{p_room:state.room?.id}).catch(console.warn);},180000);
    }
  }
  async function fetchRecentSignals(){
    if(!state.room)return;
    const since=new Date(Date.now()-25000).toISOString();
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
      else updateGuestMicState(pc.connectionState);
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
  async function toggleMic(){if(state.localStream)await stopMicrophone(true);else await startMicrophone();}
  async function startMicrophone(){
    if(!state.room||state.role!=='guest')return;
    if(!navigator.mediaDevices?.getUserMedia){toast('Microfone exige HTTPS (ou localhost) e navegador compatível.',true);return;}
    const btn=$('mic-toggle');btn.disabled=true;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:false,autoGainControl:false,channelCount:1},video:false});
      state.localStream=stream;
      stream.getAudioTracks().forEach(track=>track.onended=()=>{if(state.localStream)stopMicrophone(true);});
      const ctx=new (window.AudioContext||window.webkitAudioContext)();state.localAudioContext=ctx;
      const analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.65;
      ctx.createMediaStreamSource(stream).connect(analyser);state.localAnalyzer=analyser;
      await ctx.resume();
      const pc=makePeer(state.room.owner_id,false);state.localPeer=pc;
      stream.getTracks().forEach(track=>pc.addTrack(track,stream));
      const offer=await pc.createOffer();await pc.setLocalDescription(offer);
      await sendSignal(state.room.owner_id,'offer',pc.localDescription.toJSON());
      btn.classList.add('active');btn.setAttribute('aria-label','Desligar microfone');
      $('mic-headline').textContent='Seu mic tá no ar! 🔥';
      $('mic-description').textContent='Cante virado para a TV. Toque no microfone para desligar.';
      updateGuestMicState('connecting');
    }catch(err){console.error(err);toast(humanError(err),true);await stopMicrophone(false);}finally{btn.disabled=false;}
  }
  function updateGuestMicState(connection){
    const badge=$('mic-status');if(!badge)return;
    const text={new:'● Conectando',connecting:'● Conectando',connected:'● Conectado',disconnected:'● Sem conexão',failed:'● Falhou',closed:'● Desligado'};
    badge.textContent=text[connection]||'● '+connection;
    badge.classList.toggle('active',connection==='connected');
    if(connection==='failed')toast('WebRTC falhou. Tente reconectar ou configure um servidor TURN.',true);
  }
  async function stopMicrophone(notifyHost=true){
    if(notifyHost&&state.room&&state.user){sendSignal(state.room.owner_id,'bye').catch(console.warn);}
    try{state.localPeer?.close();}catch{}state.localPeer=null;
    state.localStream?.getTracks().forEach(track=>track.stop());state.localStream=null;
    try{await state.localAudioContext?.close();}catch{}
    state.localAudioContext=null;state.localAnalyzer=null;
    const btn=$('mic-toggle');btn.classList.remove('active');btn.setAttribute('aria-label','Ativar microfone');
    $('mic-headline').textContent='Preparado pro seu momento?';
    $('mic-description').textContent='Toque para permitir o microfone. O áudio vai direto para o palco pelo WebRTC.';
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
    const count=Math.round(Math.min(1,value/.16)*bars.length);
    Array.from(bars).forEach((bar,i)=>{bar.classList.toggle('lit',i<count);bar.style.height=(17+(i<count?Math.min(85,value*550)+Math.random()*15:Math.random()*10))+'%';});
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
      if(state.isPlaying&&state.currentSong){
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
  async function ensurePlayer(id) {
    await loadYouTubeAPI();
    if(state.playerReady&&state.player)return state.player;
    if(state.player)return new Promise(resolve=>{const it=setInterval(()=>{if(state.playerReady){clearInterval(it);resolve(state.player);}},50);});
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('O player de vídeo não carregou.')),14000);
      state.player=new window.YT.Player('youtube-player',{
        videoId:id,playerVars:{playsinline:1,controls:1,rel:0,origin:location.origin,cc_load_policy:0},
        events:{onReady:e=>{clearTimeout(timeout);state.playerReady=true;resolve(e.target);},onStateChange:onPlayerState,
          onError:e=>{const codes={2:'Link de vídeo inválido.',5:'Vídeo não pode ser reproduzido.',100:'Vídeo removido ou privado.',101:'O dono do vídeo proibiu incorporação.',150:'O dono do vídeo proibiu incorporação.'};toast(codes[e.data]||'O YouTube recusou este vídeo.',true);state.isPlaying=false;},
          onAutoplayBlocked:()=>toast('O navegador bloqueou o início automático. Clique em “Reproduzir”.')}
      });
    });
  }
  function onPlayerState(event) {
    if(state.role!=='host')return;
    state.isPlaying=event.data===window.YT.PlayerState.PLAYING;
    $('play-pause').textContent=state.isPlaying?'⏸ Pausar':'▶ Reproduzir';
    if(event.data===window.YT.PlayerState.ENDED&&!state.finishing&&state.currentSong)finishSong(false);
  }
  function resetSongMetrics(){state.micStats=new Map();state.songFrames=0;state.isPlaying=false;}
  function setNowPlaying(song){
    $('now-title').textContent=song?.title||'O palco tá esperando você! 🎶';
    $('now-by').textContent=song?'Escolhida por '+memberName(song.user_id):'Adicione a primeira música pelo celular ou pelo painel.';
    $('song-pill').textContent=song?'✦ Faça barulho!':'✦ Prontos para o show?';
    $('video-placeholder').hidden=!!song;
  }
  async function startSong(song) {
    if(!song||state.role!=='host'||state.finishing)return;
    try {
      if(state.currentSong)await finishSong(true,false);
      await callRPC('karaoke_start_song',{p_room:state.room.id,p_song:song.id});
      state.currentSong={...song,status:'playing'};state.room.current_song_id=song.id;
      resetSongMetrics();setNowPlaying(song);hideFinal();updateVoxLine('singing');
      const player=await ensurePlayer(song.video_id);
      player.loadVideoById(song.video_id);renderMics();queueChanged();
    }catch(err){toast('Não foi possível tocar: '+humanError(err),true);}
  }
  async function resumeExistingSong(){
    const song=state.songs.find(s=>s.id===state.room?.current_song_id);
    if(!song)return;
    state.currentSong=song;setNowPlaying(song);resetSongMetrics();
    try {const player=await ensurePlayer(song.video_id);player.cueVideoById(song.video_id);toast('Música recuperada. Clique em Reproduzir para continuar.');}
    catch(err){toast(humanError(err),true);}
  }
  function getScoreResults(){
    const uids=new Set([...state.micStats.keys()]);
    if(state.currentSong?.user_id)uids.add(state.currentSong.user_id);
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
      state.currentSong=null;state.room.current_song_id=null;
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
  function updateVideoProgress(){
    if(state.role!=='host'||!state.playerReady||!state.currentSong){$('time-now').textContent='0:00';$('time-all').textContent='0:00';$('progress-fill').style.width='0%';return;}
    try{const current=state.player.getCurrentTime(),duration=state.player.getDuration();$('time-now').textContent=formatTime(current);$('time-all').textContent=formatTime(duration);$('progress-fill').style.width=duration?Math.min(100,current/duration*100)+'%':'0%';}catch{}
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
      await callRPC('karaoke_enqueue',{p_room:state.room.id,p_video:video,p_title:title.value.trim()});
      input.value='';title.value='';await fetchSongs();renderQueue();
      if(host)$('song-dialog').close();
      toast('Música adicionada! Agora é só ensaiar o refrão. 🎶');
    }catch(err){toast(humanError(err),true);}finally{setLoading(button,false);}
  }
  async function searchYoutube(host){
    const search=$(host?'host-search':'youtube-search');const results=$(host?'host-results':'search-results');
    const query=search.value.trim();if(!query){toast('Digite o nome da música para buscar.',true);return;}
    const key=cfg.YOUTUBE_API_KEY?.trim();
    if(!key){
      window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(query+' karaokê'),'_blank','noopener,noreferrer');
      toast('A busca abriu no YouTube. Copie o link do vídeo desejado e cole aqui.');return;
    }
    results.innerHTML='<p class="subtle">Procurando hits... 🎧</p>';
    try{
      const url=new URL('https://www.googleapis.com/youtube/v3/search');
      url.search=new URLSearchParams({part:'snippet',type:'video',videoEmbeddable:'true',maxResults:'7',q:query+' karaoke',key}).toString();
      const response=await fetch(url.toString());const json=await response.json();
      if(!response.ok)throw new Error(json.error?.message||'Falha na API do YouTube.');
      const hits=(json.items||[]).filter(v=>youtubeId(v.id?.videoId));
      results.replaceChildren();
      if(!hits.length){results.innerHTML='<p class="subtle">Nenhum vídeo encontrado. Experimente outra busca.</p>';return;}
      hits.forEach(item=>{
        const videoId=youtubeId(item.id.videoId);
        const button=document.createElement('button');button.type='button';button.className='search-hit';
        const img=document.createElement('img');img.src='https://i.ytimg.com/vi/'+videoId+'/mqdefault.jpg';img.alt='Miniatura de vídeo';img.loading='lazy';
        const label=document.createElement('span');label.textContent=item.snippet.title;
        button.append(img,label);button.addEventListener('click',()=>{
          $(host?'host-url':'guest-video-url').value='https://www.youtube.com/watch?v='+videoId;
          $(host?'host-song-title':'guest-song-title').value=item.snippet.title.slice(0,120);
          results.replaceChildren();toast('Vídeo selecionado. Agora é só adicionar!');
        });results.append(button);
      });
    }catch(err){results.textContent='Não foi possível buscar no YouTube. Cole o link manualmente.';toast(humanError(err),true);}
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
    clearTimeout(state.roomReloadTimer);clearTimeout(state.scoreOverlayTimer);
    if(state.localStream)await stopMicrophone(true);
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
    state.songFrames=0;state.micStats.clear();state.currentSong=null;state.room=null;state.role=null;
    state.songs=[];state.members=[];state.scores=[];state.isPlaying=false;state.finishing=false;
    hideFinal();$('video-placeholder').hidden=false;$('qr-bubble').classList.remove('qr-expanded');
  }
  async function leaveGuest(){
    if(state.role!=='guest')return;
    const room=state.room?.id,user=state.user?.id;
    await stopSession();
    if(room&&user)state.client.from('karaoke_members').delete().eq('room_id',room).eq('user_id',user).then(({error})=>{if(error)console.warn(error);});
    history.replaceState(null,'',new URL('./',location.href).href);
    localStorage.removeItem('tem-gogo-pending-room');
    show('landing');showPinEntry('');
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
    $('generate-pin').addEventListener('click',()=>{$('room-pin').value=sixDigitPin();});
    $('regen-pin').addEventListener('click',()=>{$('new-room-pin').value=sixDigitPin();});
    $('change-pin').addEventListener('click',()=>{$('pin-dialog').showModal();});
    $('pin-close').addEventListener('click',()=>$('pin-dialog').close());
    $('pin-change-form').addEventListener('submit',changeRoomPin);
    $('tab-host').addEventListener('click',()=>{
      $('tab-host').classList.add('active');$('tab-guest').classList.remove('active');
      $('tab-host').setAttribute('aria-selected','true');$('tab-guest').setAttribute('aria-selected','false');
      $('host-access').hidden=false;$('guest-access').hidden=true;
      document.body.classList.remove('entry-active');
    });
    $('tab-guest').addEventListener('click',()=>openGuestEntry($('guest-code').value));
    $('auth-form').addEventListener('submit',login);$('signup-button').addEventListener('click',signup);
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
    $('leave-party').addEventListener('click',leaveGuest);
    $('mobile-tab-mic').addEventListener('click',()=>switchMobileTab('mic'));
    $('mobile-tab-queue').addEventListener('click',()=>switchMobileTab('queue'));
    $('final-close').addEventListener('click',advanceSong);
    $('qr-bubble').addEventListener('click',()=> $('qr-bubble').classList.toggle('qr-expanded'));
    $('qr-bubble').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('qr-bubble').classList.toggle('qr-expanded');}});
    document.addEventListener('visibilitychange',()=>{if(state.role==='host'&&document.visibilityState==='visible'&&!state.wakeLock)unlockWakeLock();});
    window.addEventListener('online',()=>toast('Internet conectada novamente. ✅'));
    window.addEventListener('offline',()=>toast('Sem internet: a fila e os vídeos podem parar.',true));
  }
  function switchMobileTab(tab){
    const mic=tab==='mic';$('guest-mic-panel').hidden=!mic;$('guest-queue-panel').hidden=mic;
    $('mobile-tab-mic').classList.toggle('active',mic);$('mobile-tab-queue').classList.toggle('active',!mic);
    $('mobile-tab-mic').setAttribute('aria-selected',String(mic));
    $('mobile-tab-queue').setAttribute('aria-selected',String(!mic));
  }

  init().catch(err=>{console.error(err);toast(humanError(err),true);});
})();
