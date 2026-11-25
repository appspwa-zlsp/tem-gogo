/* C05 — Diva e POP: canal único, somente palco; revisão local por gravação.
 * Nenhuma alteração dos MP3. Créditos: elevenlabs.io (plano gratuito).
 * Aprovação local não publica biblioteca nem substitui revisão da Central. */
(function(root){'use strict';
 const all=Array.isArray(root.TG74_VOICES)?root.TG74_VOICES:[];
 const byId=new Map(all.map(v=>[v.id,v]));
 const $=id=>document.getElementById(id);
 const VOICE='tem-gogo-diva-preview-volume', POP='tem-gogo-pop-volume', REVIEW='tg05-voice-reviewed-v1';
 const events=Object.freeze({recado:['voz-32'],avaliacao:['voz-19'],sem_sinal:['voz-34'],video_indisponivel:['voz-36'],abertura_classico:['voz-11'],elogio:['voz-13','voz-18','voz-33']});
 const effects=Object.freeze({suspense:'./pop-suspense.wav',palmas:'./pop-palmas.wav',recado:'./pop-recado.wav'});
 let current=null,mounted=false,unlocked=false,auto=false,review={},epoch=0,lookup=false,captionTimer=null,captionScope=null;
 const lastByEvent=new Map();
 const seen=new Set();
 try{const obj=JSON.parse(root.localStorage.getItem(REVIEW)||'{}');if(obj&&typeof obj==='object'&&!Array.isArray(obj))review=obj;}catch{}
 function volume(key,fallback,max){try{const raw=root.localStorage.getItem(key);const n=raw===null?fallback:Number(raw);return Number.isFinite(n)?Math.min(max,Math.max(0,n)):fallback;}catch{return fallback;}}
 const getVolume=()=>volume(VOICE,40,75),getPopVolume=()=>volume(POP,25,75);
 function allowed(){const b=typeof root.TG_BETA_BRIDGE==='function'?root.TG_BETA_BRIDGE():null;return !!(b&&b.role==='host'&&b.canPreviewVoices?.()&&$('stage')&&!$('stage').hidden&&!document.hidden);}
 const voiceMuted=()=>document.body.classList.contains('tg93-voice-previews-off');
 function status(s){for(const id of ['tg74-voice-status','tg05-voice-live'])if($(id))$(id).textContent=s;}
 function caption(s){const el=$('tg05-audio-caption');if(el){el.textContent=s;el.hidden=!s;}const result=$('tg05-result-narration');if(result&&$('final-overlay')?.dataset.phase==='announcing')result.textContent=s||'Segura o glitter! A nota já vem.';}
 function stop(){clearTimeout(captionTimer);captionTimer=null;captionScope=null;epoch++;const c=current;current=null;if(c){clearTimeout(c.timer);try{c.clip.pause();c.clip.removeAttribute('src');c.clip.load();}catch{}c.resolve(false);}caption('');if($('tg74-voice-play'))$('tg74-voice-play').textContent='Ouvir prévia';}
 function finish(c,ok){if(current!==c)return;current=null;clearTimeout(c.timer);try{c.clip.pause();c.clip.removeAttribute('src');c.clip.load();}catch{}caption('');if($('tg74-voice-play'))$('tg74-voice-play').textContent='Ouvir prévia';c.resolve(ok);}
 function fallbackCaption(words){if(!words||!allowed())return false;clearTimeout(captionTimer);const b=root.TG_BETA_BRIDGE?.();captionScope={room:b?.room?.id,uid:b?.user?.id,session:b?.sessionEpoch};caption(words);captionTimer=setTimeout(()=>{captionTimer=null;captionScope=null;caption('');},6500);return true;}
 function playClip(file,kind,words,limit=12000,contextual=false){
  if(!allowed()||(kind==='voice'&&(voiceMuted()||getVolume()===0))||(kind==='pop'&&getPopVolume()===0))return Promise.resolve(false);
  stop();return new Promise(resolve=>{
   let clip;try{clip=new Audio(new URL(file,document.baseURI).href);}catch{return resolve(contextual&&fallbackCaption(words));}
   clip.preload='auto';clip.volume=(kind==='voice'?getVolume():getPopVolume())/100;
   const scope=root.TG_BETA_BRIDGE?.();
   const c={clip,kind,resolve,timer:null,room:scope?.room?.id,uid:scope?.user?.id,session:scope?.sessionEpoch,contextual,words};
   const fail=()=>{if(current!==c)return;status('Áudio não reproduzido. Confira o som do navegador; legenda mantida quando disponível.');const b=root.TG_BETA_BRIDGE?.();const fallback=contextual&&allowed()&&b?.room?.id===c.room&&b?.user?.id===c.uid&&b?.sessionEpoch===c.session;finish(c,fallback);if(fallback)fallbackCaption(words);};current=c;
   if(words)caption(words);if(kind==='voice'&&$('tg74-voice-play'))$('tg74-voice-play').textContent='Parar voz';clip.onended=()=>finish(c,true);clip.onerror=fail;
   c.timer=setTimeout(fail,limit);
   try{Promise.resolve(clip.play()).then(()=>{if(current!==c)clip.pause();}).catch(fail);}catch{fail();}
  });
 }
 function reviewed(v){const r=review[v.id];return typeof r==='string'&&r.trim().length>=3&&r.length<=600?r.trim():null;}
 function saveReview(id,words){if(!byId.has(id)||typeof words!=='string'||words.trim().length<3||words.length>600)throw Error('Legenda inválida');const next={...review,[id]:words.trim()};root.localStorage.setItem(REVIEW,JSON.stringify(next));review=next;}
 function forgetReview(id){const next={...review};delete next[id];root.localStorage.setItem(REVIEW,JSON.stringify(next));review=next;}
 function unlock(){unlocked=true;if(auto)maybeWelcome();}
 function setAuto(v){epoch++;auto=!!v;if($('tg05-auto'))$('tg05-auto').checked=auto;if(!auto){stop();status('Falas automáticas desativadas.');}else{status('Falas autorizadas nesta sessão. Aguardando evento com gravação publicada.');maybeWelcome();}}
 function maybeWelcome(){const b=root.TG_BETA_BRIDGE?.();if(b?.canAnnounceOpening?.())void announce('abertura_classico','opening:'+b.room.id);}
 function claim(key){if(!key||seen.has(key))return false;seen.add(key);if(seen.size>200)seen.delete(seen.values().next().value);return true;}
 async function announce(event,key,song=null){
  if(!auto){status('Falas automáticas desativadas pelo anfitrião.');return false;}if(!allowed()||current||captionTimer||!Object.hasOwn(events,event))return false;
  if(lookup||!key||seen.has('voice:'+key))return false;
  const b=root.TG_BETA_BRIDGE?.(),room=b?.room?.id,uid=b?.user?.id,session=b?.sessionEpoch,generation=epoch;if(!b?.client||!room||!uid)return false;
  lookup=true;let cue,timer;try{const r=await Promise.race([b.client.rpc('tg30_editorial_cue_v2',{p_room:room,p_event:event,p_previous:lastByEvent.get(event)||null,p_song:song}),new Promise(resolve=>{timer=setTimeout(()=>resolve({error:true}),2500);})]);if(r.error){status('Consulta das falas indisponível; comentário escrito mantido.');return false;}cue=r.data;}catch{status('Não foi possível consultar a fala publicada.');return false;}finally{clearTimeout(timer);lookup=false;}
  const latest=root.TG_BETA_BRIDGE?.();if(generation!==epoch||latest?.room?.id!==room||latest?.user?.id!==uid||latest?.sessionEpoch!==session||!auto||!allowed()||current||captionTimer)return false;
  const v=events[event].includes(cue?.id)?byId.get(cue.id):null;const words=cue?.caption;
  if(!v||typeof words!=='string'||words.trim().length<3||words.length>600){status('Nenhuma gravação publicada para este evento; comentário escrito mantido.');return false;}if(!claim('voice:'+key))return false;
  lastByEvent.set(event,v.id);const text=words+' · elevenlabs.io';
  if(!unlocked||voiceMuted()||getVolume()===0){status(!unlocked?'Toque em Ativar som na TV.':voiceMuted()?'Voz silenciada nas preferências.':'Volume da Diva em zero.');return fallbackCaption(text);}
  status('Reproduzindo fala publicada · '+v.id);return playClip(v.file,'voice',text,Math.min(18000,Math.ceil((v.duration_seconds+3)*1000)),true);
 }
 async function pop(event,key){if(!unlocked||!allowed()||!effects[event]||getPopVolume()===0||current||captionTimer||!claim('pop:'+key))return false;return playClip(effects[event],'pop','',3500);}
 function reset(){epoch++;stop();unlocked=false;auto=false;seen.clear();lastByEvent.clear();if($('tg05-auto'))$('tg05-auto').checked=false;status('Falas automáticas desativadas nesta sessão.');}
 function stopVoice(){if(current?.kind==='voice'||captionTimer)stop();}
 async function waitForCaption(){const until=Date.now()+6800;while(captionTimer&&Date.now()<until&&allowed())await new Promise(resolve=>setTimeout(resolve,100));}
 function guard(){const b=root.TG_BETA_BRIDGE?.();const stale=c=>c&&(b?.room?.id!==c.room||b?.user?.id!==c.uid||b?.sessionEpoch!==c.session);if((current||lookup||captionTimer)&&(!allowed()||stale(current)||stale(captionScope))){stop();return;}if(current?.kind==='voice'&&voiceMuted()){const c=current;stop();if(c.contextual){const b=root.TG_BETA_BRIDGE?.();if(b?.room?.id===c.room&&b?.user?.id===c.uid&&b?.sessionEpoch===c.session)fallbackCaption(c.words);}}}
 function setLevel(key,value,max,kind,id){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)throw Error('Volume inválido');root.localStorage.setItem(key,String(value));if($(id))$(id).value=String(value);const out=$(kind==='voice'?'tg05-diva-level':'tg05-pop-level');if(out)out.textContent=value+'%';if(current?.kind===kind){current.clip.volume=value/100;if(value===0){const c=current;stop();if(c.contextual){const b=root.TG_BETA_BRIDGE?.();if(b?.room?.id===c.room&&b?.user?.id===c.uid&&b?.sessionEpoch===c.session)fallbackCaption(c.words);}}}}
 const setVolume=v=>setLevel(VOICE,v,75,'voice','tg74-voice-volume');
 const setPopVolume=v=>setLevel(POP,v,75,'pop','tg05-pop-volume');
 function make(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
 function button(text,fn){const b=make('button','button button-soft',text);b.type='button';b.addEventListener('click',fn);return b;}
 function mount(){
  if(mounted)return;const target=document.querySelector('#tg104-cockpit .tg104-room-panel');if(!target||!all.length)return;mounted=true;
  const outer=make('section','tg74-studio');outer.id='tg74-voice-preview';outer.setAttribute('aria-label','Áudio e estúdio da Diva');
  const details=make('details','tg74-studio-details');details.append(make('summary','','🎙️ Diva e POP · 40 gravações'));
  details.append(make('p','tg74-studio-hint','Gravações do proprietário · elevenlabs.io · uso recreativo não comercial. Confira o texto falado antes de aprovar uma legenda. Revisão local para prévia. Falas automáticas usam somente a publicação da Central.'));
  const field=make('label','tg74-studio-label','Gravação — elevenlabs.io');const select=make('select');select.id='tg74-voice-select';
  for(const name of new Set(all.map(v=>v.group))){const group=make('optgroup');group.label=name;all.filter(v=>v.group===name).forEach(v=>{const opt=make('option','',v.title+' · elevenlabs.io');opt.value=v.id;group.append(opt);});select.append(group);}field.append(select);details.append(field);
  const ref=make('p','tg74-studio-duration');ref.id='tg74-voice-duration';details.append(ref);
  const label=make('label','tg74-studio-label','Legenda literal (ouça e confira)');const words=make('textarea');words.rows=3;words.maxLength=600;words.id='tg05-voice-words';label.append(words);details.append(label);
  const update=()=>{stop();const v=byId.get(select.value);if(!v)return;words.value=reviewed(v)||v.title;ref.textContent=v.id+' · '+Math.round(v.duration_seconds)+' s · '+(reviewed(v)?'Revisada neste aparelho':'Texto de referência NÃO conferido');status('Prévia parada.');};
  select.addEventListener('change',update);
  const playButton=button('Ouvir prévia',async()=>{if(current){stop();return;}const v=byId.get(select.value);if(!v)return;if(!allowed()||voiceMuted()){status('Prévia somente no palco parado, sem microfones ativos.');return;}playButton.textContent='Parar prévia';const ok=await playClip(v.file,'voice',reviewed(v)?reviewed(v)+' · elevenlabs.io':'Prévia sem legenda conferida · elevenlabs.io',Math.ceil((v.duration_seconds+3)*1000));status(ok?'Prévia concluída.':'Prévia interrompida ou bloqueada.');});playButton.id='tg74-voice-play';
  const actions=make('div','tg74-studio-actions');actions.append(playButton,button('Parar som',stop),button('Confirmo que a legenda é fiel',()=>{try{if(!allowed())throw Error('Aguarde o palco ficar livre.');saveReview(select.value,words.value);update();status('Legenda confirmada localmente; não publicada.');}catch(e){status(e.message);}}),button('Retirar aprovação',()=>{try{forgetReview(select.value);update();}catch(e){status(e.message);}}));details.append(actions);
  // Os dois volumes e a autorização ficam visíveis na mesa, sem duplicar IDs.
  const voice=$('tg74-voice-volume'),popInput=$('tg05-pop-volume'),check=$('tg05-auto');
  if(voice&&popInput&&check){
    setVolume(getVolume());setPopVolume(getPopVolume());check.checked=auto;
    voice.addEventListener('input',()=>{try{setVolume(Number(voice.value));}catch{status('Não foi possível guardar o volume.');}});
    popInput.addEventListener('input',()=>{try{setPopVolume(Number(popInput.value));}catch{status('Não foi possível guardar o volume.');}});
    check.addEventListener('change',()=>{if(check.checked){unlock();setAuto(true);}else setAuto(false);});
    $('tg05-test-voice')?.addEventListener('click',async()=>{if(!allowed()){status('Teste somente no palco parado, sem microfones ativos.');return;}if(voiceMuted()||getVolume()===0){status('A voz está silenciada; confira o volume e as preferências.');return;}unlock();const v=byId.get('voz-19');if(!v)return;status('Teste manual de voz · não publica a gravação.');const ok=await playClip(v.file,'voice','',Math.ceil((v.duration_seconds+3)*1000));if(ok)status('Teste de voz concluído.');});
    $('tg05-stop-voice')?.addEventListener('click',()=>{stopVoice();status('Fala interrompida pelo anfitrião.');});
  }
  details.append(button('Testar POP',async()=>{if(!allowed()){status('Palco ocupado.');return;}unlock();const ok=await pop('recado','preview:'+Date.now());status(ok?'POP concluído.':'POP bloqueado ou silenciado.');}));
  details.append(make('p','tg74-studio-hint','Toque em Ativar som para liberar efeitos. Sem reprodução automática de falas não revisadas; sem voz ou POP sobre a música. Se o som estiver bloqueado ou silenciado, a legenda publicada continua disponível.'));
  const msg=make('p','tg74-studio-status','Prévia parada.');msg.id='tg74-voice-status';msg.setAttribute('role','status');details.append(msg);outer.append(details);target.append(outer);update();status(auto?'Falas autorizadas nesta sessão. Aguardando evento publicado.':'Falas automáticas desativadas. Autorize aqui e teste a voz; a reprodução contextual usa a publicação da Central.');
  details.addEventListener('toggle',()=>{if(!details.open&&current&&!current.contextual)stop();});
 }
 root.addEventListener('temgogo:view',e=>{if(e.detail?.view!=='stage')reset();});root.addEventListener('pagehide',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 function ready(){mount();if($('stage'))new MutationObserver(guard).observe($('stage'),{attributes:true,attributeFilter:['hidden']});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();root.addEventListener('temgogo:host-cockpit-ready',mount);
 root.TG74_DIVA_STUDIO=Object.freeze({mount,stop,stopVoice,reset,guard,unlock,announce,pop,waitForCaption,getVolume,setVolume,getPopVolume,setPopVolume,catalogLength:all.length});
})(window);
