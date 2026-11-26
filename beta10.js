/* Tem Gogó Beta 1.0 — camada social opt-in, informações mínimas, sem tocar no motor de karaokê. */
(()=>{'use strict';
const AV={urbano:'./cantor-urbano.png',esporte:'./cantor-esporte.png',ruiva:'./cantora-ruiva.png',oculos:'./cantora-oculos.png'};
const $=id=>document.getElementById(id);let active='profile',profile=null,profileOwner=null,profileEpoch=0,picture=null,crop={zoom:1,x:0,y:0},drag=null,lastTicketReply='';
const bridge=()=>window.TG_BETA_BRIDGE?.();const err=e=>String(e?.message||e||'Falha inesperada').replace(/^.*(relation .*does not exist).*$/i,'Módulo ainda não instalado no Supabase.');
function status(msg){$('tg-beta-feedback').textContent=msg;}
function account(){const b=bridge();return b?.user&&!b.isAnonymous(b.user)&&b.client?b:null;}
function showDialog(tab='profile'){const d=$('tg-beta-dialog');if(!account()){showAccountGate(tab);return;}if(!d.open)d.showModal();}
function showAccountGate(){
 const gate=$('tg-beta-gate-dialog');if(!gate)return;
 $('tg-beta-gate-title').textContent='Seu miniperfil Tem Gogó';
 $('tg-beta-gate-copy').textContent='Você não precisa criar conta para cantar. O cadastro permite guardar sua identidade e suas conquistas oficiais quando disponíveis.';
 if(!gate.open)gate.showModal();
}
const text=(el,content)=>{el.textContent=String(content??'');return el;};
function openTab(tab='profile'){
 if(document.body.classList.contains('tg103-mic-focus')||document.body.classList.contains('tg103-remote-mic-focus'))return;
 if(tab==='galera'||(tab==='rank'&&bridge()?.room))tab='profile';
 profileEpoch++; rankedProfileIds.clear(); active=tab;showDialog(tab);const dlg=$('tg-beta-dialog');if(!dlg?.open)return;
 $('tg-beta-person-view').hidden=true;
 document.querySelectorAll('[data-tg-beta-tab]').forEach(x=>{if(x.dataset.tgBetaTab==='rank')x.hidden=!!bridge()?.room;x.classList.toggle('active',x.dataset.tgBetaTab===tab);x.setAttribute('aria-selected',String(x.dataset.tgBetaTab===tab));});
 document.querySelectorAll('[data-tg-beta-panel]').forEach(x=>x.hidden=x.dataset.tgBetaPanel!==tab);
 status('');
 if(tab==='profile'){void loadProfile();void loadBoraLink();loadRoomParticipants();}
 if(tab==='rank')void loadRanking();
 if(tab==='notices')void loadNotices();
 if(tab==='moderate'){const b=bridge();document.querySelector('.tg-beta-host-tools').hidden=b?.role!=='remote';void loadPartyMessages();}
}
// R63: SQL33 R45, existing table and authenticated owner's consent.
const boraFields='user_id,bora_handle,profile_url,is_visible';
const boraHandle=v=>String(v||'').trim().replace(/^@/,'');
const validBoraHandle=v=>/^[A-Za-z0-9_.-]{2,40}$/.test(v);
const validBoraURL=v=>/^https:\/\/airamdazl\.github\.io\/boraprorole\/index\.html\?perfil=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
let boraOwner=null,boraEpoch=0,boraRecord=null,boraBusy=false;
function boraMessage(msg){const n=$('tg63-bora-feedback');if(n)n.textContent=msg;}
function boraChip(node,p){if(!node)return;node.hidden=true;node.removeAttribute('href');node.replaceChildren();if(!p?.is_visible||!validBoraHandle(p.bora_handle)||!validBoraURL(p.profile_url))return;const icon=document.createElement('img');icon.src='./bora-pro-role-logo.png';icon.alt='Bora de Rolê';node.append(icon,document.createTextNode('@'+p.bora_handle));node.href=p.profile_url;node.target='_blank';node.rel='noopener noreferrer';node.referrerPolicy='no-referrer';node.hidden=false;}
function clearBora(){boraEpoch++;boraOwner=null;boraRecord=null;boraBusy=false;const form=$('tg63-bora-form');if(!form)return;form.reset();for(const id of ['tg63-bora-save','tg63-bora-remove','tg63-bora-handle','tg63-bora-url','tg63-bora-visible'])$(id).disabled=true;boraChip($('tg63-bora-own'),null);boraMessage('');}
const boraCurrent=(b,epoch,pe)=>boraEpoch===epoch&&profileEpoch===pe&&account()?.user.id===b.user.id&&bridge()?.sessionEpoch===b.sessionEpoch&&$('tg-beta-dialog')?.open&&!$('tg63-bora-form')?.closest('[hidden]');
function boraEnable(){for(const id of ['tg63-bora-save','tg63-bora-handle','tg63-bora-url','tg63-bora-visible'])$(id).disabled=false;$('tg63-bora-remove').disabled=!boraRecord;}
async function loadBoraLink(){clearBora();const b=account(),epoch=boraEpoch,pe=profileEpoch;if(!b||!$('tg63-bora-form'))return;boraMessage('Carregando vínculo…');try{const {data,error}=await b.client.from('tg_bora_profile_links').select(boraFields).eq('user_id',b.user.id).maybeSingle();if(!boraCurrent(b,epoch,pe))return;if(error||data&&data.user_id!==b.user.id)throw Error('Link indisponível');boraOwner=b.user.id;boraRecord=data||null;$('tg63-bora-handle').value=data?.bora_handle||'';$('tg63-bora-url').value=data?.profile_url||'';$('tg63-bora-visible').checked=data?.is_visible===true;boraChip($('tg63-bora-own'),data);boraEnable();boraMessage(data?'Vínculo carregado.':'Vínculo opcional.');}catch{if(boraCurrent(b,epoch,pe))boraMessage('Vínculo indisponível. Nenhuma alteração foi salva.');}}
async function writeBora(remove=false){const b=account(),epoch=boraEpoch,pe=profileEpoch;if(!b||boraOwner!==b.user.id||boraBusy||!boraCurrent(b,epoch,pe))return;const handle=boraHandle($('tg63-bora-handle').value),url=$('tg63-bora-url').value.trim(),visible=$('tg63-bora-visible').checked;
 if(!remove&&(!validBoraHandle(handle)||!validBoraURL(url))){boraMessage('Confira o @ e cole o link pessoal compartilhado pelo Bora de Rolê.');return;}
 if(!remove&&!visible&&!boraRecord){boraMessage('Autorize a exibição para cadastrar o vínculo.');return;}
 if(remove&&!boraRecord)return;
 boraBusy=true;for(const id of ['tg63-bora-save','tg63-bora-remove','tg63-bora-handle','tg63-bora-url','tg63-bora-visible'])$(id).disabled=true;boraMessage(remove?'Removendo…':'Salvando vínculo…');
 try{const table=b.client.from('tg_bora_profile_links');const payload={user_id:b.user.id,bora_handle:handle,profile_url:url,is_visible:visible};
 const query=remove?table.delete().eq('user_id',b.user.id).select('user_id').maybeSingle():boraRecord?table.update(payload).eq('user_id',b.user.id).select(boraFields).single():table.insert(payload).select(boraFields).single();
 const {data,error}=await query;if(!boraCurrent(b,epoch,pe))return;if(error||data?.user_id!==b.user.id)throw Error('Não confirmado');
 boraRecord=remove?null:data;if(remove)$('tg63-bora-form').reset();boraChip($('tg63-bora-own'),boraRecord);boraMessage(remove?'Vínculo removido.':visible?'Vínculo salvo e visível conforme permissões.':'Vínculo salvo sem exibição.');
 }catch{if(boraCurrent(b,epoch,pe))boraMessage('Não foi possível confirmar a alteração. Reabra o perfil para conferir.');}finally{if(boraCurrent(b,epoch,pe)){boraBusy=false;boraEnable();}}}
const rankedProfileIds=new Set();
let cardReturnTab='profile';
function inCurrentParty(id){
 const b=bridge();
 return !!(id&&b?.room?.id&&['host','remote','guest'].includes(b.role)&&((b.members||[]).some(m=>m.user_id===id)||b.room.owner_id===id));
}
function loadRoomParticipants(){
 const root=$('tg95-room-list'),panel=$('tg95-room-members');if(!root||!panel)return;
 const b=bridge(),valid=!!(b?.room?.id&&b.room.room_mode!=='solo'&&['host','remote','guest'].includes(b.role));
 root.replaceChildren();panel.hidden=!valid;if(!valid)return;
 const members=[...(b.members||[])];
 if(b.room.owner_id&&!members.some(m=>m.user_id===b.room.owner_id))members.unshift({user_id:b.room.owner_id,display_name:'Anfitrião'});
 const ids=new Set();
 for(const m of members){
  if(!m.user_id||ids.has(m.user_id)||m.user_id===b.user?.id)continue;
  ids.add(m.user_id);
  const row=document.createElement('div');row.className='tg95-room-row';
  const name=document.createElement('span');name.textContent=String(m.display_name||'Artista');
  const action=document.createElement('button');action.type='button';action.className='button button-outline';action.textContent='Ver miniperfil';
  action.addEventListener('click',()=>void openPerson(m.user_id,'party'));
  row.append(name,action);root.append(row);
 }
 if(!ids.size)root.textContent='Nenhum outro participante disponível nesta festa.';
}
function authUser(){return account()?.user.id;}
function makeAvatar(key){const img=document.createElement('img');img.src=AV[key]||AV.urbano;img.alt='Personagem original do Tem Gogó';img.loading='lazy';return img;}
function appendPerson(node,p,desc,handler){const row=document.createElement('div');row.className='tg-beta-person';row.append(makeAvatar(p.avatar_key));const info=document.createElement('div');info.append(text(document.createElement('strong'),p.nickname||'Cantor(a)'),text(document.createElement('small'),(p.handle?'@'+p.handle+' · ':'')+(desc||'')));row.append(info);const b=document.createElement('button');b.type='button';b.className='button button-outline';b.textContent='Ver perfil';b.addEventListener('click',()=>handler(p.user_id));row.append(b);node.append(row);}
async function ensureProfile(){const b=account();if(!b)return;const id=b.user.id,epoch=profileEpoch;let {data,error}=await b.client.from('tg_profiles').select('*').eq('user_id',id).maybeSingle();if(error)throw error;if(account()?.user.id!==id||epoch!==profileEpoch)throw Error('Sessão alterada.');if(!data){const nick=String(b.user.user_metadata?.display_name||'Cantor(a)').trim()||'Cantor(a)';({data,error}=await b.client.from('tg_profiles').insert({user_id:id,nickname:nick.slice(0,30),avatar_key:b.avatar}).select().single());if(error)throw error;}if(account()?.user.id!==id||epoch!==profileEpoch)throw Error('Sessão alterada.');profile=data;profileOwner=id;return data;}
function val(id){return $(id).value.trim();}
async function loadProfile(){const b=account();if(!b)return;const epoch=profileEpoch;profile=null;profileOwner=null;picture=null;$('tg-p-save').disabled=true;status('Carregando perfil…');try{const p=await ensureProfile();if(account()?.user.id!==b.user.id||epoch!==profileEpoch)return;$('tg-p-handle').value=p.handle||'';$('tg-p-handle').readOnly=!!p.handle;$('tg-p-save').disabled=false;$('tg-p-nick').value=p.nickname;$('tg-p-insta').value=p.instagram_visibility==='public'?(p.instagram||''):'';$('tg-p-score-vis').value=p.score_visibility==='public'?'public':'private';$('tg-p-rank').checked=p.ranking_opt_in;$('tg-p-age').checked=p.age_18_plus_declared;$('tg-p-best').checked=p.best_scores_opt_in===true;$('tg-p-legal').checked=false;
 $('tg-beta-avatar-picker').replaceChildren();for(const [key,path] of Object.entries(AV)){const option=document.createElement('label');option.className='tg-beta-avatar-option';const input=document.createElement('input');input.type='radio';input.name='tg-avatar';input.value=key;input.checked=p.avatar_key===key;const img=document.createElement('img');img.src=path;img.alt='Avatar '+key;option.append(input,img);$('tg-beta-avatar-picker').append(option);}
 loadAvatar(p);if(account()?.user.id!==b.user.id||epoch!==profileEpoch)return;const {data:scores}=await b.client.from('karaoke_scores').select('score,created_at').eq('user_id',b.user.id).order('created_at',{ascending:false}).limit(100);if(account()?.user.id!==b.user.id||epoch!==profileEpoch)return;const last=(scores||[]).filter(s=>Number.isFinite(Number(s.score))).slice(0,10);const avg=last.length?last.reduce((a,s)=>a+Number(s.score),0)/last.length:null;$('tg-beta-my-stars').textContent=avg===null?'Ainda sem notas':`${(avg/20).toFixed(1)} ★ · ${last.length} notas recentes (máx. 10)`;status('Perfil carregado. Alterações só são aplicadas ao salvar.');}catch(e){if(account()?.user.id===b.user.id&&epoch===profileEpoch)status('⚠ '+err(e));}}
function loadAvatar(p){$('tg-beta-photo').replaceChildren(makeAvatar(p.avatar_key));}
async function saveProfile(){
 const b=account();if(!b||!profile||profileOwner!==b.user.id||$('tg-p-save').disabled)return;
 const epoch=profileEpoch,uid=b.user.id,nick=val('tg-p-nick');
 const current=()=>account()?.user.id===uid&&profileEpoch===epoch&&bridge()?.sessionEpoch===b.sessionEpoch;
 const checked=document.querySelector('input[name="tg-avatar"]:checked');
 const avatar=checked?.value||profile.avatar_key||'urbano';
 const handle=String(profile.handle||val('tg-p-handle')).replace(/^@/,'').toLowerCase(),insta=val('tg-p-insta').replace(/^@/,'');
 if(nick.length<2||nick.length>24||!AV[avatar]){status('Use um apelido de 2 a 24 caracteres e escolha um avatar.');return;}
 const social={handle:handle||null,instagram:insta||(profile.instagram_visibility!=='public'?profile.instagram||null:null),instagram_visibility:insta?'public':'private',photo_visibility:'private',score_visibility:$('tg-p-score-vis').value,ranking_opt_in:$('tg-p-rank').checked,age_18_plus_declared:$('tg-p-age').checked,best_scores_opt_in:$('tg-p-best').checked};
 const norm=(k,v)=>['ranking_opt_in','age_18_plus_declared','best_scores_opt_in'].includes(k)?v===true:k.endsWith('_visibility')?(v==='public'?'public':'private'):v||null;
 const socialChanged=Object.keys(social).some(k=>norm(k,social[k])!==norm(k,profile[k]));
 if(socialChanged){
   if(!/^[a-z0-9._]{3,24}$/.test(handle)||(insta&&!/^[a-zA-Z0-9._]{1,30}$/.test(insta))){status('Confira @Tem Gogó e Instagram nas opções sociais.');return;}
   if(social.ranking_opt_in&&!social.age_18_plus_declared){status('Para optar pelo ranking público, confirme que tem 18 anos ou mais.');return;}
   if(!$('tg-p-legal').checked){status('Confirme os termos antes de salvar mudanças sociais.');return;}
 }
 $('tg-p-save').disabled=true;status('Salvando…');let committed=false;
 try{
   if(socialChanged){
     const p={nickname:nick,avatar_key:avatar,...social};
     const {data,error}=await b.client.rpc('tg30_save_social_profile',{p_profile:p,p_accept:true});
     if(error)throw error;if(data?.user_id!==uid)throw Error('Perfil não confirmado.');
     committed=true;if(!current())return;profile={...profile,...p};$('tg-p-handle').readOnly=!!profile.handle;
   }else{
     // Narrow existing own-profile update; no social fields, no consent mutation.
     if(nick!==profile.nickname||avatar!==profile.avatar_key){
       const {data,error}=await b.client.from('tg_profiles').update({nickname:nick,avatar_key:avatar}).eq('user_id',uid).select('user_id,nickname,avatar_key');
       if(error)throw error;if(data?.length!==1||data[0].user_id!==uid||data[0].nickname!==nick||data[0].avatar_key!==avatar)throw Error('Identidade básica não confirmada pelo banco.');
       committed=true;if(!current())return;profile={...profile,nickname:nick,avatar_key:avatar};
     }else committed=true;
   }
   loadAvatar(profile);
   const result=await b.tg60SyncIdentity(nick,avatar,{uid,epoch:b.sessionEpoch});
   if(!current())return;
   status(result.ok?'Perfil salvo e identidade sincronizada.':'Perfil salvo; sincronização pendente: '+result.failures.join(', ')+'. Salve novamente para tentar.');
 }catch(e){if(current())status(committed?'Perfil salvo; sincronização pendente. Reabra e tente novamente.':e.code==='23505'?'Este @ já está em uso.':'Não foi possível salvar: '+err(e));}
 finally{if(current())$('tg-p-save').disabled=false;}
}
async function openPerson(id,origin){
 const ctx=bridge();const epoch=++profileEpoch;const allowed=origin==='party'?inCurrentParty(id):(origin==='ranking'&&rankedProfileIds.has(id));
 if(!allowed){status('Miniperfil disponível somente na mesma festa ou em ranking público autorizado.');return;}
 const dlg=$('tg-beta-dialog'),box=$('tg-beta-person-view');if(!dlg||!box)return;
 cardReturnTab=origin==='ranking'?'rank':'profile';
 document.querySelectorAll('[data-tg-beta-panel]').forEach(el=>el.hidden=true);
 box.hidden=false;if(!dlg.open)dlg.showModal();
 const name=$('tg-beta-person-name'),avatar=$('tg-beta-person-avatar');
 const insta=$('tg-beta-person-instagram'),bora=$('tg95-person-bora');
 insta.hidden=true;insta.removeAttribute('href');bora.hidden=true;bora.removeAttribute('href');
 const known=(ctx?.members||[]).find(m=>m.user_id===id);
 name.textContent=known?.display_name||'Artista';avatar.src=AV.urbano;$('tg-beta-person-handle').hidden=true;$('tg-beta-person-handle').textContent='';
 $('tg-beta-person-score').textContent='Conquistas oficiais da Batalha: consulta pendente de ativação.';
 const b=account();
 if(!b){status('Você pode participar sem cadastro. Links e dados pessoais não serão exibidos.');return;}
 status('Consultando dados autorizados do miniperfil…');
 try{
  const {data,error}=await b.client.rpc('tg30_miniprofile',{p_target:id,p_room:origin==='party'?ctx.room.id:null,p_origin:origin});if(error)throw error;
  if(profileEpoch!==epoch||account()?.user.id!==b.user.id||(origin==='party'&&(!inCurrentParty(id)||bridge()?.room?.id!==ctx?.room?.id)))return;const p=data;if(!p){status('Perfil não disponível ou não autorizado.');return;}
  name.textContent=p.nickname||name.textContent;const tag=$('tg-beta-person-handle');tag.textContent=p.handle?'@'+p.handle:'';tag.hidden=!p.handle;const notes=Array.isArray(p.best_scores)?p.best_scores.filter(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100).slice(0,3):[];$('tg-beta-person-score').textContent=p.best_scores_opt_in===true&&notes.length?'Melhores notas recreativas: '+notes.join(' · '):'Conquistas oficiais da Batalha: consulta pendente de ativação.';
  avatar.src=AV[p.avatar_key]||AV.urbano;
  const handle=String(p.instagram||'').replace(/^@/,'');
  if((p.instagram_visibility==='public'||p.instagram_public===true)&&/^[A-Za-z0-9._]{1,30}$/.test(handle)){
   insta.textContent='Instagram: @'+handle;
   insta.href='https://www.instagram.com/'+encodeURIComponent(handle)+'/';
   insta.hidden=false;
  }
  // Only after the existing miniprofile authorization succeeds; never use a banner as a profile.
  status('');
  try{const {data:link,error:linkError}=await b.client.from('tg_bora_profile_links').select(boraFields).eq('user_id',id).eq('is_visible',true).maybeSingle();if(!linkError&&link?.user_id===id&&profileEpoch===epoch&&account()?.user.id===b.user.id&&$('tg-beta-dialog').open&&!box.hidden&&(origin==='ranking'?!bridge()?.room:inCurrentParty(id)&&bridge()?.room?.id===ctx?.room?.id))boraChip(bora,link);}catch{/* Optional link: fail closed. */}
 }catch(e){if(profileEpoch===epoch&&account()?.user.id===b.user.id)status('Miniperfil não disponível: '+err(e));}
}
async function loadRanking(){const b=account();if(!b||b.room)return;const epoch=profileEpoch;const root=$('tg-beta-rank-list');root.replaceChildren();status('Consultando ranking público…');try{const {data,error}=await b.client.rpc('tg_rankings_public');if(error)throw error;if(epoch!==profileEpoch||account()?.user.id!==b.user.id||bridge()?.room)return;rankedProfileIds.clear();(data||[]).forEach((p,i)=>{if(p.user_id)rankedProfileIds.add(p.user_id);appendPerson(root,p,`#${i+1} · ${(Number(p.average_score)/20).toFixed(1)} ★ · ${p.performances} apresentações recentes`,id=>openPerson(id,'ranking'));});if(!data?.length)text(root,'Ainda não existem participantes elegíveis com pelo menos três apresentações.');status('');}catch(e){status('⚠ '+err(e));}}
async function loadNotices(){const b=account();if(!b)return;const {data,error}=await b.client.from('tg_maintenance').select('mode,message,updated_at').eq('id',true).maybeSingle();if(error){status('⚠ '+err(error));return;}$('tg-beta-maint-info').textContent=data?.mode==='normal'?'Sistema em operação normal.':`Estado: ${data?.mode||'não verificado'} · ${data?.message||'Sem observação'}`;status('');}
async function loadPartyMessages(){const b=account(),root=$('tg-beta-recent-messages');if(!b?.room){root.textContent='Entre em uma festa para consultar os recados.';return;}root.textContent='Consultando recados…';const {data,error}=await b.client.from('tg_party_messages').select('id,nickname,body,status,created_at').eq('room_id',b.room.id).order('created_at',{ascending:false}).limit(30);if(error){root.textContent='Histórico não disponível: '+err(error);return;}root.replaceChildren();for(const m of data||[]){const row=document.createElement('div');row.className='tg-beta-request';const info=document.createElement('div');info.append(text(document.createElement('strong'),m.nickname),text(document.createElement('p'),m.body));row.append(info);const btn=document.createElement('button');btn.type='button';btn.textContent='Denunciar';btn.addEventListener('click',()=>{$('tg-beta-report-message').value=m.id;$('tg-beta-report-reason').focus();});row.append(btn);root.append(row);}if(!data?.length)root.textContent='Ainda não há recados registrados nesta festa.';}
let maintenanceWasBlocked=false,maintenanceSerial=0;
async function checkMaintenance(){
 const b=bridge(),serial=++maintenanceSerial;if(!b?.client)return;
 try{
  const {data,error}=await b.client.from('tg_maintenance').select('mode,message').eq('id',true).maybeSingle();const now=bridge();if(error||!data||serial!==maintenanceSerial||now?.client!==b.client||now?.user?.id!==b.user?.id||now?.sessionEpoch!==b.sessionEpoch)return;
  const banner=$('tg-beta-global-maintenance'),info=$('tg-beta-maint-info');if(!banner)return;
  const config={aviso:{badge:'AVISO',title:'A Diva está preparando novidades',detail:'Estamos atualizando os bastidores. Você pode continuar cantando normalmente.'},sem_novas_salas:{badge:'NOVAS SALAS',title:'Novas festas em pausa',detail:'Quem já está em uma festa pode continuar normalmente.'},emergencia:{badge:'PAUSA GERAL',title:'O show está temporariamente pausado',detail:'A manutenção está ativa. A apresentação e os controles ficam indisponíveis por enquanto.'}};
  const c=config[data.mode];const raw=String(data.message||'').trim();
  const generic=/^(?:Aviso de atualização:\s*)?Estamos trabalhando para melhorar sua festa\.?$/i.test(raw);
  const msg=!raw||generic?(c?.detail||'O Tem Gogó está em manutenção.'):raw;
  if(data.mode==='emergencia'){
    banner.hidden=true;const d=$('tg-beta-emergency');if(!d)return;
    $('tg-beta-emergency-message').textContent=msg;
    if(!d.open){
      document.querySelectorAll('dialog[open]').forEach(other=>{if(other!==d)other.close();});
      try{d.showModal();}catch(err){console.warn('Tela de manutenção:',err);d.setAttribute('open','');}
    }
    if(!maintenanceWasBlocked){maintenanceWasBlocked=true;void window.TG_MAINTENANCE_STOP?.();}
    if(info)info.textContent='Manutenção geral: todas as telas estão bloqueadas.';
    return;
  }
  if(maintenanceWasBlocked){maintenanceWasBlocked=false;const d=$('tg-beta-emergency');if(d?.open)d.close();window.location.reload();return;}
  if(data.mode==='normal'||!c){banner.hidden=true;if(info)info.textContent='Sem manutenção ativa.';return;}
  banner.hidden=false;banner.dataset.mode=data.mode;banner.replaceChildren();
  const badge=document.createElement('span');badge.className='tg-beta-maint-badge';badge.textContent=c.badge;
  const copy=document.createElement('div');copy.className='tg-beta-maint-copy';
  const title=document.createElement('strong');title.textContent=c.title;
  const para=document.createElement('p');para.textContent=msg;copy.append(title,para);banner.append(badge,copy);
  const detail=document.createElement('span');detail.className='tg103-continue';detail.textContent=data.mode==='aviso'?'✓ Karaokê liberado':'✓ Festas abertas seguem funcionando';banner.append(detail);
  if(data.mode==='aviso'){
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='tg-beta-maint-dismiss';dismiss.textContent='✕';dismiss.setAttribute('aria-label','Dispensar comunicado');dismiss.onclick=()=>banner.hidden=true;banner.append(dismiss);
  }
  if(info)info.textContent=c.title+': '+msg;
 }catch(e){console.warn('Estado de manutenção temporariamente indisponível:',err(e));}
}
async function reportMessage(){const b=account();if(!b)return;const cat=$('tg-beta-report-type').value,reason=val('tg-beta-report-reason'),messageId=val('tg-beta-report-message');if(reason.length<10){status('Informe pelo menos dez caracteres sobre a ocorrência.');return;}try{const payload={reporter_id:b.user.id,category:cat,reason};if(selectedTarget)payload.target_id=selectedTarget.user_id;if(messageId)payload.message_id=messageId;const {error}=await b.client.from('tg_moderation_reports').insert(payload);if(error)throw error;status('✅ Denúncia recebida para análise da Central.');$('tg-beta-report-reason').value='';$('tg-beta-report-message').value='';$('tg-beta-report-type').selectedIndex=0;}catch(e){status('⚠ '+err(e));}}
async function banParty(){const b=account();if(!b||b.role!=='remote'||!b.room)return;const id=$('tg-beta-ban-user').value,reason=val('tg-beta-ban-reason');if(!id||reason.length<8){status('Escolha um participante e descreva o motivo (mínimo 8 caracteres).');return;}if(!await window.TG_UI.confirm('O participante será removido desta festa. Isso não suspende a conta inteira.',{title:'Bloquear nesta festa',confirmText:'Confirmar bloqueio',danger:true}))return;const {error}=await b.client.rpc('tg_block_in_room',{p_room:b.room.id,p_user:id,p_reason:reason,p_report:$('tg-beta-ban-report').checked});if(error){status('⚠ '+err(error));return;}$('tg-beta-ban-reason').value='';$('tg-beta-ban-report').checked=false;status('✅ Bloqueio gravado; a Central poderá consultar a denúncia quando selecionada.');}
function showHostModeration(){const b=account();if(!b||b.role!=='remote'){status('Esta ação é exclusiva do anfitrião no controle móvel.');return;}openTab('moderate');const s=$('tg-beta-ban-user');s.replaceChildren();for(const m of b.members||[]){if(m.user_id===b.user.id)continue;const opt=document.createElement('option');opt.value=m.user_id;opt.textContent=m.display_name||'Cantor(a)';s.append(opt);} }
async function inspectSupport(){const b=account();if(!b)return;try{const {data,error}=await b.client.from('tg_support_tickets').select('id,number,updated_at').eq('user_id',b.user.id).order('updated_at',{ascending:false}).limit(15);if(error)return;const ids=(data||[]).map(t=>t.id);if(!ids.length)return;const res=await b.client.from('tg_support_replies').select('created_at,ticket_id').in('ticket_id',ids).eq('is_staff',true).order('created_at',{ascending:false}).limit(1);if(res.error||!res.data?.length)return;const latest=res.data[0].created_at;const key='tg-beta-last-reply:'+b.user.id;const seen=localStorage.getItem(key);if(!seen){localStorage.setItem(key,latest);return;}if(Date.parse(latest)>Date.parse(seen)&&latest!==lastTicketReply){lastTicketReply=latest;const btn=$('tg-beta-support-alert');btn.hidden=false;btn.textContent='💬 Nova resposta do suporte';btn.onclick=()=>{localStorage.setItem(key,latest);btn.hidden=true;$('tg193-support-tab-list')?.click();$('tg193-support-dialog')?.showModal();};}}catch(e){console.warn('Atendimento: atualização pendente',e);}}
let tg19ContextKey=null;
function updateContext(){const b=bridge();const key=JSON.stringify([b?.user?.id||null,b?.room?.id||null,b?.sessionEpoch||0]);if(tg19ContextKey!==null&&tg19ContextKey!==key){profileEpoch++;profile=null;profileOwner=null;picture=null;rankedProfileIds.clear();const dialog=$('tg-beta-dialog');if(dialog?.open)dialog.close();}tg19ContextKey=key;const guest=b?.role==='guest',remote=b?.role==='remote';const guestNav=$('tg-beta-guest-nav');if(guestNav)guestNav.hidden=true;document.querySelectorAll('#guest .tg-beta-unified-tab').forEach(button=>button.hidden=!guest);$('tg-beta-remote-nav').hidden=!remote;$('tg-beta-host-moderate').hidden=!remote;}
function makeUI(){const root=document.createElement('div');root.id='tg-beta-root';root.innerHTML=`
 <nav id="tg-beta-guest-nav" class="tg-beta-mobile-nav" aria-label="Meu perfil Tem Gogó" hidden><button data-tg-beta-open="profile" type="button">👤 Meu perfil</button></nav>
 <nav id="tg-beta-remote-nav" class="tg-beta-mobile-nav" aria-label="Perfil e segurança" hidden><button data-tg-beta-open="profile" type="button">👤 Perfil</button><button id="tg-beta-host-moderate" type="button">🛡️ Segurança</button></nav>
 <aside id="tg-beta-global-maintenance" class="tg-beta-maint-banner" role="status" hidden></aside><dialog id="tg-beta-emergency" class="tg103-emergency" aria-labelledby="tg-beta-emergency-title" aria-modal="true"><div class="tg103-emergency-inner"><img src="./diva-busto.png" alt="Diva Gogó nos bastidores"><span class="tg103-emergency-tag">TEM GOGÓ · AVISO DA PRODUÇÃO</span><h2 id="tg-beta-emergency-title">A Diva pediu uma pausa no show</h2><p id="tg-beta-emergency-message">Estamos cuidando do palco. Volte em breve.</p><small>Seu acesso ficará liberado novamente quando a administração encerrar a manutenção.</small></div></dialog><button id="tg-beta-support-alert" class="tg-beta-support-alert" type="button" hidden>Nova resposta do suporte</button>
 <dialog id="tg-beta-gate-dialog" class="modal tg-beta-gate-dialog" aria-labelledby="tg-beta-gate-title"><div class="tg-beta-gate-shell"><button type="button" id="tg-beta-gate-close" class="tg-beta-gate-close" aria-label="Fechar">✕</button><small>TEM GOGÓ · MINIPERFIL</small><h2 id="tg-beta-gate-title">Seu perfil merece um camarim próprio</h2><p id="tg-beta-gate-copy">Seu cadastro é opcional para cantar; ele permite conservar sua identidade.</p><div class="tg-beta-gate-actions"><button id="tg-beta-gate-account" class="button button-primary" type="button">Criar conta / entrar com e-mail</button><button id="tg-beta-gate-later" class="button button-outline" type="button">Continuar sem cadastro</button></div><p class="tg-beta-gate-footnote">Você pode continuar cantando sem cadastro. O perfil é opcional.</p></div></dialog>
 <dialog id="tg-beta-dialog" class="modal tg-beta-dialog" aria-labelledby="tg-beta-title"><div class="tg-beta-shell"><header><div><small>TEM GOGÓ · MEU PALCO</small><h2 id="tg-beta-title">Meu perfil</h2></div><button type="button" id="tg-beta-close" aria-label="Fechar">✕</button></header><nav class="tg-beta-tabs"><button data-tg-beta-tab="profile" class="active" type="button">Perfil</button><button data-tg-beta-tab="rank" type="button">Ranking público</button><button data-tg-beta-tab="notices" type="button">Ajuda</button><button data-tg-beta-tab="moderate" type="button">Moderação</button></nav>
 <section data-tg-beta-panel="profile"><div class="tg-beta-heading"><div id="tg-beta-photo" aria-label="Seu avatar de palco"></div><div><h3>Minha identidade</h3><p>Seu avatar e seus dados de palco.</p><span id="tg-beta-my-stars"></span></div></div>
 <label>Apelido no palco <input id="tg-p-nick" maxlength="24" minlength="2" autocomplete="nickname" required></label><label>@Tem Gogó exclusivo <input id="tg-p-handle" maxlength="24" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="seu.nome"></label><p>Escolha 3 a 24 letras, números, pontos ou _. A troca de um @ já definido aguarda a regra definitiva.</p><p>Escolha seu personagem do karaokê (nenhuma imagem será modificada).</p><div id="tg-beta-avatar-picker" class="tg-beta-avatars"></div>
 <label>Instagram (opcional)<input id="tg-p-insta" maxlength="30" placeholder="seu.instagram" autocomplete="off" autocapitalize="none" spellcheck="false"><small>Preencha apenas se quiser exibir nos miniperfis permitidos. Deixe em branco para não exibir.</small></label>
 <label>Quem pode ver meu histórico?<select id="tg-p-score-vis"><option value="private">Somente eu</option><option value="public">Público</option></select></label>
 <label class="tg-beta-check"><input id="tg-p-legal" type="checkbox"> Li os <a href="./termos.html" target="_blank" rel="noopener">Termos</a> e o <a href="./privacidade.html" target="_blank" rel="noopener">Aviso de Privacidade</a> do Tem Gogó.</label><label class="tg-beta-check"><input id="tg-p-age" type="checkbox"> Declaro ter 18 anos ou mais caso escolha participar do ranking público.</label>
 
 <label class="tg-beta-check"><input id="tg-p-best" type="checkbox"> Mostrar até três melhores notas recreativas no meu miniperfil autorizado (opcional e independente do ranking).</label><label class="tg-beta-check"><input id="tg-p-rank" type="checkbox"> Participar do ranking público geral (mínimo 3 apresentações).</label><button type="button" id="tg-p-save" class="tg-beta-primary">Salvar perfil</button>
 <details id="tg95-room-members" hidden><summary>🎤 Pessoas desta festa</summary><p>Ver apenas participantes da mesma sala. Os links respeitam o consentimento do proprietário.</p><div id="tg95-room-list"></div></details>
 <section class="tg95-achievements"><h3>🏆 Minhas conquistas</h3><p>Somente troféus oficiais de festivais da Batalha. A integração será liberada após os testes do banco; Clássico e Solo não geram medalhas permanentes.</p></section>
 <section class="tg95-bora"><p class="tg63-bora-note">Opcional · Bora de Rolê é para maiores de 18 anos. As contas não são conectadas.</p><a href="https://airamdazl.github.io/boraprorole/" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Conhecer Bora de Rolê (18+)</a><form id="tg63-bora-form" class="tg63-bora-form"><label>@Bora de Rolê<input id="tg63-bora-handle" maxlength="41" autocomplete="off" placeholder="@seu.usuario" disabled></label><label>Link pessoal compartilhado<input id="tg63-bora-url" type="url" maxlength="450" placeholder="Cole o link do seu perfil" disabled></label><label><input type="checkbox" id="tg63-bora-visible" disabled> Autorizo exibir meu @ e link pessoal nos miniperfis permitidos.</label><a id="tg63-bora-own" class="tg63-bora-chip" hidden></a><div class="tg63-bora-actions"><button type="submit" id="tg63-bora-save" class="button button-primary" disabled>Salvar vínculo</button><button type="button" id="tg63-bora-remove" class="button button-outline" disabled>Remover vínculo</button></div><p id="tg63-bora-feedback" role="status" aria-live="polite"></p></form></section>
 </section>
 <section data-tg-beta-panel="rank" hidden><h3>Ranking geral opcional</h3><p>Média das últimas 10 apresentações (mínimo de 3), baseada em tempo e volume — não em afinação.</p><div id="tg-beta-rank-list"></div></section>
 <section data-tg-beta-panel="notices" hidden><h3>Orientações</h3><p id="tg-beta-maint-info">Verificando manutenção…</p><p>O cadastro é opcional para cantar. Miniperfis e rankings respeitam permissões e consentimento.</p><p>Para denunciar um recado, utilize a seção Segurança. O suporte fica disponível em Ajuda.</p><div class="tg-beta-legal"><a href="./termos.html" target="_blank" rel="noopener">Termos de Uso</a> · <a href="./privacidade.html" target="_blank" rel="noopener">Privacidade</a></div></section>
 <section data-tg-beta-panel="moderate" hidden><h3>Segurança e recados</h3><p>Denúncias vão para a Central. Apenas o anfitrião pode bloquear alguém na festa.</p><label>Tipo de denúncia<select id="tg-beta-report-type"><option value="spam">Spam</option><option value="ofensa">Ofensas</option><option value="assedio">Assédio</option><option value="ameaca">Ameaças</option><option value="menores">Suspeita envolvendo menores</option><option value="outros">Outro</option></select></label><label>ID do recado (quando existir)<input id="tg-beta-report-message" placeholder="UUID do recado denunciado"></label><label>Descreva o que aconteceu<textarea id="tg-beta-report-reason" rows="3" maxlength="1000"></textarea></label><button id="tg-beta-report" type="button">Enviar denúncia à Central</button>
 <h3>Recados recentes da festa</h3><div id="tg-beta-recent-messages"></div><div class="tg-beta-host-tools"><h3>Bloquear nesta festa (anfitrião)</h3><label>Participante<select id="tg-beta-ban-user"></select></label><label>Motivo<textarea id="tg-beta-ban-reason" rows="2" maxlength="500"></textarea></label><label class="tg-beta-check"><input id="tg-beta-ban-report" type="checkbox"> Encaminhar também para análise da Central</label><button id="tg-beta-ban" type="button" class="tg-beta-danger">Confirmar bloqueio na festa</button></div></section>
 <section id="tg-beta-person-view" hidden><h3>Miniperfil do artista</h3><div class="tg-beta-heading"><img id="tg-beta-person-avatar" src="./cantor-urbano.png" alt="Avatar"><div><strong id="tg-beta-person-name"></strong><small id="tg-beta-person-handle" hidden></small><p id="tg-beta-person-score"></p></div></div><div class="tg95-links"><a id="tg-beta-person-instagram" hidden target="_blank" rel="noopener noreferrer"></a><a id="tg95-person-bora" hidden target="_blank" rel="noopener noreferrer"></a></div><button id="tg-beta-person-back" type="button" class="button button-outline">← Voltar</button></section>
 <p id="tg-beta-feedback" role="status" aria-live="polite"></p></div></dialog>
 <dialog id="tg96-party-people" class="modal tg96-party-people" aria-labelledby="tg96-party-title">
 <div class="tg96-party-inner"><header><h2 id="tg96-party-title">🎤 Pessoas nesta festa</h2><button type="button" id="tg96-party-close" class="button button-outline">Fechar</button></header>
 <p>Selecione um participante desta mesma festa para ver o miniperfil permitido. Sem busca geral, chat ou seguidores.</p>
 <div id="tg96-party-list"></div></div></dialog>`;document.body.append(root);
 document.querySelectorAll('[data-tg-beta-open]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.tgBetaOpen)));document.querySelectorAll('[data-tg-beta-tab]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.tgBetaTab)));
 $('tg-beta-emergency').addEventListener('cancel',e=>e.preventDefault());
 $('tg-beta-dialog').addEventListener('close',()=>{profileEpoch++;profile=null;profileOwner=null;picture=null;rankedProfileIds.clear();clearBora();});$('tg63-bora-form').addEventListener('submit',e=>{e.preventDefault();void writeBora();});$('tg63-bora-remove').addEventListener('click',()=>void writeBora(true));$('tg-beta-close').onclick=()=>$('tg-beta-dialog').close();$('tg-beta-gate-close').onclick=()=>$('tg-beta-gate-dialog').close();$('tg-beta-gate-later').onclick=()=>$('tg-beta-gate-dialog').close();$('tg-beta-gate-account').onclick=()=>{$('tg-beta-gate-dialog').close();$('tg18-account-cta')?.click();};$('tg-p-save').onclick=saveProfile;$('tg-beta-report').onclick=reportMessage;$('tg-beta-ban').onclick=banParty;$('tg-beta-host-moderate').onclick=showHostModeration;
 $('tg-beta-person-back').onclick=()=>{ profileEpoch++; $('tg-beta-person-view').hidden=true;document.querySelectorAll('[data-tg-beta-panel]').forEach(el=>el.hidden=el.dataset.tgBetaPanel!==cardReturnTab);if(cardReturnTab==='profile')void loadBoraLink();status('');};
 const partyButton=document.createElement('button');partyButton.id='tg96-party-open';partyButton.type='button';
 partyButton.className='button button-outline tg96-party-open';partyButton.textContent='👥 Pessoas desta festa';
 $('guest')?.querySelector('.guest-room-info')?.append(partyButton);
 const partyDlg=$('tg96-party-people'),partyList=$('tg96-party-list');
 $('tg96-party-close').addEventListener('click',()=>partyDlg.close());
 partyButton.addEventListener('click',()=>{
   const ctx=bridge();partyList.replaceChildren();
   if(ctx?.role!=='guest'||!ctx.room?.id){partyList.textContent='Entre em uma festa para consultar os participantes.';partyDlg.showModal();return;}
   const seen=new Set(),members=[...(ctx.members||[])];
   if(ctx.room.owner_id&&!members.some(x=>x.user_id===ctx.room.owner_id))members.unshift({user_id:ctx.room.owner_id,display_name:'Anfitrião'});
   for(const item of members){
     if(!item.user_id||seen.has(item.user_id))continue;seen.add(item.user_id);
     const row=document.createElement('div');row.className='tg96-party-member';
     const name=document.createElement('span');name.textContent=String(item.display_name||'Artista');
     const open=document.createElement('button');open.type='button';open.textContent='Ver miniperfil';open.className='button button-outline';
     open.addEventListener('click',()=>{partyDlg.close();void openPerson(item.user_id,'party');});
     row.append(name,open);partyList.append(row);
   }
   if(!partyList.childElementCount)partyList.textContent='Ainda não há participantes para mostrar.';
   partyDlg.showModal();
 });
 const guest=$('guest');if(guest){
  const bar=guest.querySelector('.mobile-switch');const social=$('tg-beta-guest-nav');
  if(bar&&social){
    bar.setAttribute('aria-label','Navegação principal da festa');bar.removeAttribute('role');
    const options={profile:['👤','Perfil']};
    const oldScore=$('mobile-tab-score');if(oldScore)oldScore.hidden=false;
    /* O microfone original só aparece quando a vez for autorizada pelo motor. */
    for(const btn of [...social.querySelectorAll('button[data-tg-beta-open]')]){
      const [emoji,label]=options[btn.dataset.tgBetaOpen]||['✦','Perfil'];
      btn.replaceChildren();const icon=document.createElement('span');icon.textContent=emoji;icon.setAttribute('aria-hidden','true');const caption=document.createElement('span');caption.textContent=label;
      btn.append(icon,caption);btn.classList.add('mobile-tab','tg-beta-unified-tab');bar.append(btn);
    }
    social.remove();
  }
  const rankPanel=$('tg-beta-rank-list')?.parentElement;
  if(rankPanel&&!$('tg103-festa-ranking')){
    const b=document.createElement('button');b.id='tg103-festa-ranking';b.type='button';b.className='button button-outline';b.textContent='🏆 Ver notas e placar desta festa';
    b.addEventListener('click',()=>{$('tg-beta-dialog').close();$('mobile-tab-score')?.click();});
    rankPanel.insertBefore(b,$('tg-beta-rank-list'));
  }
  // Catálogo em destaque; a busca externa só aparece por escolha explícita.
  const queue=$('guest-queue-panel'),hits=guest.querySelector('.guest-hit-library'),search=guest.querySelector('.guest-song-search-card');
  if(queue&&hits&&search){queue.insertBefore(hits,search);
    const row=search.querySelector('.search-row');if(row){const details=document.createElement('details');details.className='tg103-external-search';details.innerHTML='<summary>Não achou aqui? Pesquisar no YouTube</summary><p>Pesquisa externa limitada: primeiro confira as músicas da biblioteca. Sua busca consome a cota compartilhada.</p>';row.parentNode.insertBefore(details,row);details.append(row);const res=$('search-results');if(res)details.append(res);}
    const m=$('tg17-guest-message');if(m)queue.append(m);
    const ad=document.querySelector('#guest .tg192-bora-ad');if(ad){const wrapper=document.createElement('div');wrapper.className='tg103-bora';queue.append(wrapper);wrapper.append(ad);}
  }
  // Avatar superior vira a entrada para editar foto e apelido, com fallback para perfis anônimos.
  const avatar=$('guest-profile-avatar');if(avatar){avatar.tabIndex=0;avatar.setAttribute('role','button');avatar.setAttribute('aria-label','Editar meu perfil, avatar e apelido');const open=()=>{if(account())openTab('profile');else $('edit-guest-profile')?.click();};avatar.addEventListener('click',open);avatar.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});}
  const help=$('open-guest-faq');const profileRow=guest.querySelector('.guest-profile-row');if(help&&profileRow)profileRow.append(help);
  }const remote=$('tg18-remote');if(remote)remote.append($('tg-beta-remote-nav'));
 const lobby=$('lobby');if(lobby){const header=lobby.querySelector('.simple-header .header-control-group');if(header&&!$('tg-beta-lobby-profile')){const profileBtn=document.createElement('button');profileBtn.id='tg-beta-lobby-profile';profileBtn.className='button button-outline tg-beta-host-profile';profileBtn.type='button';profileBtn.textContent='👤 Meu perfil';profileBtn.addEventListener('click',()=>openTab('profile'));header.prepend(profileBtn);}
 const roomHub=$('room-hub');if(roomHub){roomHub.classList.add('tg-beta-room-hub');const actions=document.createElement('div');actions.className='tg-beta-hub-actions';const scanBtn=roomHub.querySelector('[data-scan-qr]');[$('hub-join-room'),scanBtn,$('reopen-recap')].filter(Boolean).forEach(el=>actions.append(el));const security=$('room-hub').querySelector('.hub-security');roomHub.insertBefore(actions,security);}}
 const stageActions=document.querySelector('#stage .stage-header .stage-actions');if(stageActions&&!$('tg-beta-stage-profile')){const profileBtn=document.createElement('button');profileBtn.id='tg-beta-stage-profile';profileBtn.className='button button-outline tg-beta-stage-profile';profileBtn.type='button';profileBtn.textContent='👤 Perfil';profileBtn.title='Editar seu perfil sem interromper a TV';profileBtn.addEventListener('click',()=>openTab('profile'));stageActions.prepend(profileBtn);}
 const remoteHead=$('tg18-remote')?.querySelector('.tg18-remote-header');if(remoteHead&&!$('tg-beta-remote-profile')){const profileBtn=document.createElement('button');profileBtn.id='tg-beta-remote-profile';profileBtn.className='button button-outline tg-beta-host-profile';profileBtn.type='button';profileBtn.textContent='👤 Perfil';profileBtn.addEventListener('click',()=>openTab('profile'));remoteHead.append(profileBtn);}
 for(const inp of document.querySelectorAll('input[type=password]')){
  if(inp.closest('.tg-beta-eye-wrap'))continue;const wrap=document.createElement('span');wrap.className='tg-beta-eye-wrap';inp.parentNode.insertBefore(wrap,inp);wrap.append(inp);
  const toggle=document.createElement('button');toggle.type='button';toggle.textContent='◉';toggle.setAttribute('aria-label','Mostrar senha');toggle.setAttribute('aria-pressed','false');toggle.title='Mostrar senha';
  toggle.addEventListener('click',()=>{const visible=inp.type==='password';inp.type=visible?'text':'password';toggle.textContent=visible?'◎':'◉';toggle.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');toggle.setAttribute('aria-pressed',String(visible));});wrap.append(toggle);
 }
 setInterval(updateContext,1800);setInterval(inspectSupport,60000);setInterval(checkMaintenance,12000);setTimeout(checkMaintenance,300);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkMaintenance();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)void inspectSupport();});updateContext();
}
window.TG_BETA_OPEN_TAB=openTab;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',makeUI,{once:true});else makeUI();
})();
