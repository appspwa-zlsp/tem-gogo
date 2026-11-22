/* Tem Gogó V7.4 — estúdio de prévia local de vozes da Diva.
 * SOMENTE host no palco, manual e não automático. Nenhum microfone/SQL tocado.
 * O áudio aguarda revisão editorial e licença antes de qualquer publicação. */
(function(root){ 'use strict';
  const all=Array.isArray(root.TG74_VOICES)?root.TG74_VOICES:[];
  const byId=new Map(all.map(v=>[v.id,v]));
  const STORE='tem-gogo-diva-preview-volume';
  let current=null, mounted=false;
  function stage(){return document.getElementById('stage');}
  function hostAllowed(){
    const b=typeof root.TG_BETA_BRIDGE==='function'?root.TG_BETA_BRIDGE():null;
    return !!(b && b.role==='host' && typeof b.canPreviewVoices==='function' && b.canPreviewVoices() && stage() && !stage().hidden && !document.hidden);
  }
  function ui(){return document.getElementById('tg74-voice-preview');}
  function status(message){const e=document.getElementById('tg74-voice-status');if(e)e.textContent=message;}
  function stop(){
    const clip=current;current=null;
    if(clip){clip.pause();clip.removeAttribute('src');clip.load();}
    const b=document.getElementById('tg74-voice-play');if(b)b.textContent='Ouvir prévia';
  }
  function getVolume(){
    let raw='40';try{raw=root.localStorage.getItem(STORE)||'40';}catch{}
    return Math.min(75,Math.max(0,Number(raw)||0));
  }
  async function play(){
    if(!hostAllowed()){stop();status('Prévia disponível apenas para o anfitrião, com o palco parado e sem chamada em andamento.');return false;}
    const id=document.getElementById('tg74-voice-select')?.value;
    const voice=byId.get(id);if(!voice){status('Escolha uma fala válida.');return false;}
    stop();
    let clip;
    try{clip=new Audio(new URL(voice.file,document.baseURI).href);}
    catch(err){status('Não foi possível localizar o arquivo da prévia neste ambiente.');return false;}
    clip.preload='none';clip.volume=getVolume()/100;
    current=clip;
    clip.onended=()=>{if(current===clip){current=null;status('Prévia concluída.');document.getElementById('tg74-voice-play').textContent='Ouvir prévia';}};
    clip.onerror=()=>{if(current===clip){stop();status('Não foi possível reproduzir este arquivo local.');}};
    try{
      await clip.play();
      if(current!==clip){clip.pause();return false;}
      document.getElementById('tg74-voice-play').textContent='Reproduzindo…';
      status('Prévia local · '+voice.group+' · não é anúncio automático.');
      return true;
    }catch(err){stop();status('Áudio bloqueado pelo navegador. Toque em “Ouvir prévia” novamente após autorizar o som.');return false;}
  }
  function make(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
  function mount(){
    if(mounted)return;
    const target=document.querySelector('#tg104-cockpit .tg104-room-panel');if(!target||!all.length)return;
    mounted=true;
    const outer=make('section','tg74-studio');outer.id='tg74-voice-preview';
    outer.setAttribute('aria-label','Estúdio da Diva: conferência local de gravações');
    const details=make('details','tg74-studio-details');
    details.append(make('summary','', '🎙️ Estúdio da Diva · 40 prévias locais'));
    details.append(make('p','tg74-studio-hint','Ouça antes de associar a falas e eventos. Somente no aparelho do anfitrião, fora de apresentações. Gravações ainda sem licença e legenda conferidas: NÃO publicar.'));
    const field=make('label','tg74-studio-label','Escolher gravação');
    const select=make('select');select.id='tg74-voice-select';
    const groups=[...new Set(all.map(x=>x.group))];
    for(const name of groups){const group=make('optgroup');group.label=name;
      all.filter(x=>x.group===name).forEach(v=>{const opt=make('option','',v.title);opt.value=v.id;group.append(opt);});select.append(group);
    }
    field.append(select);details.append(field);
    const voiceDuration=make('p','tg74-studio-duration');voiceDuration.id='tg74-voice-duration';
    const update=()=>{stop();const voice=byId.get(select.value);voiceDuration.textContent=voice?`Arquivo ${voice.id} · ${Math.round(voice.duration_seconds)} s · legenda ainda não verificada`:'';status('Prévia pausada.');};
    select.addEventListener('change',update);details.append(voiceDuration);
    const volumeLabel=make('label','tg74-studio-label','Volume da prévia (máximo 75%)');
    const volume=make('input');volume.type='range';volume.id='tg74-voice-volume';volume.min='0';volume.max='75';volume.step='5';volume.value=String(getVolume());
    const volDisplay=make('span','',volume.value+'%');volumeLabel.append(volume,volDisplay);
    volume.addEventListener('input',()=>{volDisplay.textContent=volume.value+'%';try{root.localStorage.setItem(STORE,volume.value);}catch{}if(current)current.volume=Number(volume.value)/100;});
    details.append(volumeLabel);
    const actions=make('div','tg74-studio-actions');
    const playButton=make('button','button button-soft','Ouvir prévia');playButton.type='button';playButton.id='tg74-voice-play';playButton.addEventListener('click',()=>{if(current){stop();status('Prévia interrompida.');}else void play();});
    const stopButton=make('button','button button-outline','Parar som');stopButton.type='button';stopButton.addEventListener('click',()=>{stop();status('Prévia interrompida.');});
    actions.append(playButton,stopButton);details.append(actions);
    const msg=make('p','tg74-studio-status','Prévia pausada.');msg.id='tg74-voice-status';msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');details.append(msg);
    outer.append(details);target.append(outer);update();
    details.addEventListener('toggle',()=>{if(!details.open)stop();});
  }
  root.addEventListener('temgogo:view',e=>{if(e.detail?.view!=='stage')stop();});
  root.addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  // Observa o campo hidden do palco e interrompe prévia na saída.
  function ready(){
    mount();const s=stage();if(s)new MutationObserver(()=>{if(s.hidden)stop();}).observe(s,{attributes:true,attributeFilter:['hidden']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
  else ready();
  root.addEventListener('temgogo:host-cockpit-ready',mount);
  root.TG74_DIVA_STUDIO=Object.freeze({mount,stop,/* sem método para tocar por evento: escolha editorial pendente */ catalogLength:all.length});
})(window);
