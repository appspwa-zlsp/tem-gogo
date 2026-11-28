/* C08 — painel de festival. Autoridade: RPCs autenticadas e gate no servidor. */
(()=>{'use strict';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ctx=()=>window.TG_APP_CONTEXT,api=window.TGBattleBridge;
const bridge=api?.createBridge({getClient:()=>ctx()?.getClient(),getUser:()=>ctx()?.getUser(),allowRelease:()=>window.TEM_GOGO_CONFIG?.BATTLE_API_RELEASE_ALLOWED===true});
const dialog=$('tg75-battle-panel'),content=$('tg75-battle-content'),feedback=$('tg75-feedback');if(!bridge||!dialog||!content)return;
let reloadSeq=0,entryChoice='',menuOpen=false,lastStage=null,introShown=false;
let festivalId=null,snap=null,festivals=[],tab='inicio',busy=false,timer=null,uid=null,gen=0,lastPoll=0,lastHeartbeat=0,dirty=false,factor=null,cancelIntent=null,voteVerifiedAt=null,voteEpoch=0;
const tabs=['inicio','elenco','playlist','classificatoria','chave','votacao','recuperacao','premios','seguranca'];
const ctrl=()=>snap?.permissions?.controller===true,owner=()=>snap?.permissions?.owner===true, me=()=>snap?.members?.find(m=>m.user_id===uid), approved=()=>ctrl()||owner()||me()?.status==='approved';
const state=()=>snap?.festival?.state, online=()=>window.TEM_GOGO_CONFIG?.BATTLE_API_RELEASE_ALLOWED===true&&bridge.current().enabled, data=(v)=>esc(JSON.stringify(v));
const message=m=>{feedback.textContent=m||'';};
const card=(title,body)=>`<section class="tg75-card"><h3>${esc(title)}</h3>${body}</section>`;
const empty=t=>`<p class="tg75-muted">${esc(t)}</p>`;
function btn(label,action,p={},kind='execute',disabled=false){return `<button type="button" class="tg75-button" data-action="${esc(action)}" data-kind="${esc(kind)}" data-payload="${data(p)}" ${!online()||disabled?'disabled':''}>${esc(label)}</button>`;}
const F=()=>({festival_id:festivalId});const reason=(id,label='Justificativa')=>`<label for="${id}">${label}</label><textarea id="${id}" minlength="20" maxlength="500" rows="3" required placeholder="20 a 500 caracteres"></textarea>`;
const reasonForm=(label,action,p,kind='execute')=>`<form data-reason-action="${esc(action)}" data-kind="${esc(kind)}" data-payload="${data(p)}"><label>Justificativa<textarea name="reason" minlength="20" maxlength="500" rows="2" required></textarea></label><button class="tg75-button" ${!online()?'disabled':''}>${esc(label)}</button></form>`;
const technicalReasons={microphone_failure:'Falha de microfone',playback_failure:'Falha de reprodução',connection_failure:'Falha de conexão',skipped:'Apresentação pulada',technical_failure:'Outra falha técnica'};
const technicalForm=p=>`<form data-reason-action="invalidate_performance" data-kind="execute" data-payload="${data(p)}"><p class="tg75-muted">Primeiro interrompa a música sem gerar nota. A invalidação não atribui W.O. e a nova tentativa exige a mesma faixa.</p><label>Motivo técnico<select name="reason" required><option value="">Selecione</option>${api.INVALIDATION_REASONS.map(k=>`<option value="${esc(k)}">${esc(technicalReasons[k])}</option>`).join('')}</select></label><button class="tg75-button" ${!online()?'disabled':''}>Invalidar tentativa técnica</button></form>`;
const mfaNote=()=>empty('Ações críticas exigem autenticação de dois fatores (MFA). Use a aba Segurança antes de confirmar.');
const version=()=>snap?.festival?.state_version;function lifecyclePayload(){return {...F(),request_id:crypto.randomUUID(),expected_version:version()};}
const tg115PhaseLabels={draft:'Preparação',registration:'Camarim aberto',qualifying:'Classificatória',bracket:'Duelos',intermission:'Intervalo',technical_intermission:'Pausa técnica',completed:'Grande final',cancelled:'Encerrado',completed_no_champion:'Encerrado sem campeão'};
function head(){return (!online()?'<div class="tg75-note" role="status">'+esc(bridge.current().message)+'<p>Prévia: nenhuma disputa, votação ou premiação pode ser executada.</p></div>':'')+(snap?'<div class="tg115-festival"><div><strong>'+esc(snap.festival.title)+'</strong><small>'+esc(tg115PhaseLabels[state()]||state())+' · '+esc(snap.festival.participants_count??0)+' competidores</small></div>'+(window.TG115_UI?.enabled()&&ctrl()&&['registration','qualifying','bracket'].includes(state())&&!(snap?.matches||[]).some(m=>m.state==='singing')?'<button type="button" class="tg75-button" data-tg115b-invite>'+ (state()==='registration'?'🎟️ Convite QR':'+Votantes')+'</button>':'')+btn('↻ Atualizar','refresh',{},'local')+'</div>':'');}
function choice(label,key){return '<button type="button" class="tg75-button tg113-choice" data-tg113-choice="'+esc(key)+'">'+esc(label)+'</button>';}
function inicio(){
 if(!snap)return '<section class="tg113-hero"><img src="./diva-busto.png" alt=""><div><p class="tg75-kicker">O palco é de vocês</p><h3>Que comece a Batalha!</h3><p>Crie um festival ou '+(window.TG115_UI?.enabled()?'abra o convite recebido':'entre com o código recebido')+'. A Diva acompanha cada etapa.</p></div></section>'+card('Como quer participar?',choice('🎤 Criar minha Batalha','create')+choice(window.TG115_UI?.enabled()?'Entrar com convite':'Entrar com código','join')+choice('Meus festivais','list')+btn('Rever apresentação','guide',{},'local'))+(entryChoice==='create'?card('Qual vai ser o nome do show?',`<form id="tg08-create"><label>Nome da Batalha<input name="title" minlength="3" maxlength="120" required></label><button class="tg75-button" ${!online()?'disabled':''}>Bora começar!</button></form>`):entryChoice==='join'?card('Entrar em festival',`<form id="tg08-join"><label>Código do festival<input name="festival_id" required placeholder="UUID recebido"></label><label>Nome de palco<input name="name" maxlength="70" required></label><label>Papel<select name="role"><option value="competitor">Competidor</option><option value="spectator">Plateia</option><option value="guest_voter">Votante temporário</option></select></label><button class="tg75-button" ${!online()?'disabled':''}>Solicitar participação</button></form>`):entryChoice==='list'?card('Meus festivais',festivals.length?festivals.map(f=>`<p>${esc(f.title)} · ${esc(f.state)} ${btn('Abrir','select',{id:f.id},'local')}</p>`).join(''):empty('Nenhum festival disponível.')):'');
 return head()+card('Seu festival',stepButton('Continuar de onde parei',suggestedTab(snap))+choice('Trocar festival','reset')+btn('Rever apresentação','guide',{},'local'))+(ctrl()?card('Ciclo do festival',(['registration','qualifying','bracket'].includes(state())?reasonForm('Salvar e entrar em intervalo','save_battle',{},'lifecycle'):'')+(state()==='intermission'?reasonForm('Retomar após reconfirmação','resume_battle',{},'lifecycle'):'')+(!['completed','cancelled'].includes(state())?reasonForm('Preparar encerramento definitivo','prepare_cancel',{},'lifecycle'):'')+(cancelIntent?`<p>Encerramento preparado; não altera o estado até a confirmação final.</p>${btn('Confirmar encerramento sem conclusão','cancel_battle',{confirmation_id:cancelIntent.id},'lifecycle')}`:'')+mfaNote()):'');
}
// R74 — contrato SQL35 instalado. Sem autoridade local sobre sorteio, fila ou nota.
let music=null,musicResults=[],musicQuery='',musicPage=0,musicMore=false,musicCategory='all',musicLoaded=false,musicSearchOpen=false,musicDraft=null,musicCatalogCache=null,musicFavorites=new Map(),musicFavoritesReady=false,musicAutoAt=0;const MUSIC_PAGE_SIZE=8;
const musicRole=s=>!!s&&(s.permissions?.controller===true||s.members?.some(m=>m.user_id===uid&&m.status==='approved'&&m.is_competitor===true&&m.account_kind==='permanent'));
const mediaId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{11}$/.test(v);
const titleValid=v=>typeof v==='string'&&v.trim().length>=3&&v.trim().length<=120;
const mediaValid=v=>v&&mediaId(v.video_id)&&titleValid(v.title);
const mediaReady=()=>voteFresh()&&music?.festival_id===festivalId&&music.state_version===version()&&music.state===state();
const ownCompetitor=()=>me()?.status==='approved'&&me()?.is_competitor===true&&ctx()?.getUser()?.is_anonymous!==true;
const musicEdit=()=>mediaReady()&&ctrl()&&!music.locked&&['draft','registration'].includes(state());
const personalEdit=()=>mediaReady()&&ownCompetitor()&&['registration','qualifying'].includes(state())&&!(music.media||[]).some(z=>{const m=snap.matches?.find(x=>x.id===z.match_id);return m?.kind==='qualifier'&&m.contestant_a_member_id===me()?.id;});
const mediaFor=m=>mediaReady()?music.media.find(z=>z.match_id===m.id&&z.attempt_no===m.attempt_no):null;
const resetMusicView=()=>{musicResults=[];musicQuery='';musicPage=0;musicMore=false;musicCategory='all';musicLoaded=false;musicSearchOpen=false;musicDraft=null;musicAutoAt=0;};
const musicReset=()=>{music=null;resetMusicView();musicCatalogCache=null;musicFavorites=new Map();musicFavoritesReady=false;};
function musicValid(d,s,id){return d?.version===1&&d.festival_id===id&&d.state===s.festival.state&&d.state_version===s.festival.state_version&&typeof d.locked==='boolean'&&Number.isInteger(d.approved_competitors)&&d.approved_competitors>=0&&d.approved_competitors<=12&&Array.isArray(d.tracks)&&d.tracks.length<=60&&d.tracks.every(t=>mediaValid(t)&&typeof t.available==='boolean')&&Array.isArray(d.choices)&&d.choices.every(mediaValid)&&Array.isArray(d.media)&&d.media.every(m=>mediaValid(m)&&api.UUID.test(m.match_id)&&Number.isSafeInteger(m.attempt_no)&&m.attempt_no>=1)&& (d.my_choice===null||mediaValid(d.my_choice));}
async function musicRPC(action,payload,id=festivalId){
 if(!online()||!id||uid!==ctx()?.getUser()?.id||!dialog.open)throw Error('Sessão ou Batalha indisponível.');
 const token=gen,user=uid,client=ctx()?.getClient();
 if(!client)throw Error('Conexão indisponível.');
 const {data,error}=await client.rpc('tg34_battle_playlist',{p_action:action,p_festival:id,p_payload:payload});
 if(token!==gen||user!==ctx()?.getUser()?.id||id!==festivalId||!online()||!dialog.open)throw Error('Sessão alterada. Atualize.');
 if(error){const msg=String(error.message||'');const hints={TG35_CANDIDATE_CHOICE_MISSING:'O candidato ainda precisa escolher a música.',TG35_MEDIA_INVALID_OR_BLOCKED:'Esta faixa está indisponível. Escolha outra quando autorizado.',TG35_RESERVE_OR_UNUSED_TRACK_REQUIRED:'Não há faixa de reserva disponível.',TG35_WRONG_SINGERS:'Confira os cantores da fila.',TG35_WRONG_QUEUED_MEDIA:'A música da fila mudou.',TG35_MATCH_NOT_READY_OR_STALE:'A tentativa mudou. Atualize.'};throw Error(Object.entries(hints).find(([k])=>msg.includes(k))?.[1]||'A seleção musical não foi autorizada. Atualize e confira a etapa.');}
 return data;
}
const musicCover=Object.freeze({pop:'pop',rock:'rock',funk:'funk',sertanejo:'sertanejo',pagode:'pagode-samba',samba:'pagode-samba',forro:'forro',rap:'rap-trap',mpb:'mpb',internacional:'internacional',outros:'outras'});
const musicCategories=[['all','Todas'],['favorites','♥ Favoritas'],['pop','Pop'],['funk','Funk'],['rock','Rock'],['sertanejo','Sertanejo'],['pagode','Pagode'],['samba','Samba'],['mpb','MPB'],['forro','Forró'],['rap','Rap'],['internacional','Internacional'],['outros','Outras']];
const searchPayload=(page,category=musicCategory,query=musicQuery)=>({page,category,query});
function musicPicker(kind){
 const allow=kind==='choose'?personalEdit():musicEdit();if(!allow)return '';
 const chips='<div class="tg120-categories" aria-label="Categorias">'+musicCategories.map(([c,label])=>'<button type="button" class="tg75-button" data-action="music_search" data-kind="local" data-payload="'+data(searchPayload(0,c))+'" aria-pressed="'+(c===musicCategory)+'">'+esc(label)+'</button>').join('')+'</div>';
 const rows=musicResults.map(t=>{const cover=Object.hasOwn(musicCover,t.genre)?musicCover[t.genre]:'outras';const selected=kind==='choose'?musicDraft?.video_id===t.video_id:music.tracks.some(x=>x.video_id===t.video_id);const payload={video_id:t.video_id,title:t.title};return '<div class="tg74-music-row"><img src="./capa-'+esc(cover)+'.webp" alt="" width="48" height="48"><strong>'+esc(t.title)+'</strong>'+(musicFavoritesReady?btn(musicFavorites.has(t.video_id)?'♥':'♡','music_favorite',payload,'local'):'')+btn(selected?'✓':kind==='choose'?'Escolher':'+',kind==='choose'?'music_draft':selected?'music_remove':'music_add',payload,'local')+'</div>';}).join('');
 return chips+(musicPage>0?btn('↑ Anteriores','music_search',searchPayload(musicPage-1),'local'):'')+'<div class="tg74-music-results tg115b-music-list" tabindex="0" aria-label="Acervo musical">'+(rows||empty(musicLoaded?'Nenhuma música nesta seleção.':'Carregando sugestões do acervo…'))+'</div>'+(musicMore?btn('Mais músicas ↓','music_search',searchPayload(musicPage+1),'local'):'')+(musicLoaded?'<small class="tg75-muted">Bloco '+(musicPage+1)+'</small>':'')+'<details class="tg120-search" '+(musicSearchOpen?'open':'')+'><summary>Não encontrou? Busque aqui</summary><form id="tg74-music-search"><label>Música ou artista<input type="search" name="query" maxlength="80" value="'+esc(musicQuery)+'"></label><button class="tg75-button">Buscar</button></form>'+(musicQuery?btn('Limpar busca','music_search',searchPayload(0,musicCategory,''),'local'):'')+'</details>'+(kind==='choose'&&musicDraft?card('Seu hit',empty(musicDraft.title)+btn('Confirmar minha música','music_choose',musicDraft,'local')):'');
}
async function musicFavoriteRead(l){const r=await ctx().getClient().rpc('tg26_favorites_list',{});if(!liveLease(l))throw Error('Sessão alterada.');if(r.error||!Array.isArray(r.data)||r.data.some(x=>!x||!mediaId(x.video_id)||typeof x.title!=='string'))throw Error('Favoritas indisponíveis.');musicFavorites=new Map(r.data.map(t=>[t.video_id,t.title]));musicFavoritesReady=true;}
async function musicClassify(rows,l,strict=false){if(!rows.length)return [];const g=await ctx().getClient().rpc('tg30_music_genres',{p_ids:rows.map(t=>t.video_id)});if(!liveLease(l))throw Error('Sessão alterada.');if(strict&&(g.error||!g.data?.classified||!Array.isArray(g.data?.genres)))throw Error('Categorias indisponíveis. Consulte Todas ou Favoritas.');const classified=g.error?{}:g.data?.classified||{};return rows.filter(mediaValid).map(t=>({...t,genre:typeof classified[t.video_id]==='string'&&classified[t.video_id]!=='gospel'?classified[t.video_id]:'outros'}));}
async function musicBrowse(p,l){
 const q=String(p.query||'').trim().slice(0,80),page=p.page??0,category=p.category||musicCategory;
 if(!Number.isSafeInteger(page)||page<0||page>100||/[\\%_]/.test(q)||!musicCategories.some(c=>c[0]===category))throw Error('Busca inválida.');
 if(!musicFavoritesReady)try{await musicFavoriteRead(l);}catch(e){if(!liveLease(l)||category==='favorites')throw e;}
 const client=ctx().getClient();let rows,more=false;
 const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(category==='favorites'){
  if(!musicFavoritesReady)throw Error('Não foi possível carregar suas favoritas.');
  const list=[...musicFavorites].map(([video_id,title])=>({video_id,title})).filter(t=>mediaValid(t)&&normalize(t.title).includes(normalize(q))).sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
  rows=await musicClassify(list.slice(page*8,page*8+8),l);more=(page+1)*8<list.length;
 }else if(category==='all'){
  let req=client.from('tg_official_catalog').select('video_id,title,plays').order('plays',{ascending:false}).order('video_id',{ascending:true}).range(page*8,page*8+8);
  if(q)req=req.ilike('title','%'+q+'%');const r=await req;if(r.error||!Array.isArray(r.data)||!liveLease(l))throw Error('Acervo indisponível.');
  more=r.data.length>8;rows=await musicClassify(r.data.slice(0,8),l);
 }else{
  if(!musicCatalogCache){const list=[];let complete=false;for(let offset=0;offset<5000;offset+=200){const r=await client.from('tg_official_catalog').select('video_id,title,plays').order('plays',{ascending:false}).order('video_id',{ascending:true}).range(offset,offset+199);if(r.error||!Array.isArray(r.data)||!liveLease(l))throw Error('Acervo indisponível.');list.push(...await musicClassify(r.data,l,true));if(r.data.length<200){complete=true;break;}}if(!complete)throw Error('Acervo muito extenso para este filtro. Use Todas ou a busca por título.');musicCatalogCache=list;}
  const list=musicCatalogCache.filter(t=>t.genre===category&&normalize(t.title).includes(normalize(q)));rows=list.slice(page*8,page*8+8);more=(page+1)*8<list.length;
 }
 if(!liveLease(l))return;musicResults=rows;musicMore=more;musicPage=page;musicQuery=q;musicCategory=category;musicLoaded=true;render();message('');
}

function musicHost(){
 if(!ctrl())return '';
 if(!mediaReady())return card('Playlist da Batalha',empty('Aguardando leitura confirmada da playlist.')+btn('Atualizar','refresh',{},'local'));
 const n=music.approved_competitors,min=n>=2&&n<=12?window.TGBattleCore?.shape(n)?.minimum_playlist_songs:null,available=music.tracks.filter(t=>t.available).length;
 return card('Músicas para os duelos','<p><strong>'+available+' disponíveis</strong> · '+music.tracks.length+' selecionadas'+(min!=null?' · mínimo '+min:' · aprove ao menos 2 competidores')+'</p><p class="tg75-muted">'+(music.locked?'Playlist fechada pelo servidor.':music.tracks.some(t=>!t.available)?'Remova as faixas indisponíveis antes de fechar.':'Selecione durante as inscrições. Uma faixa extra é recomendada.')+'</p>'+(music.tracks.length?'<div class="tg115b-music-list" role="region" aria-label="Músicas selecionadas" tabindex="0">'+music.tracks.map(t=>'<div class="tg74-music-row"><strong>'+esc(t.title)+(t.available?'':' · indisponível')+'</strong>'+(musicEdit()?btn('Remover','music_remove',{video_id:t.video_id},'local'):'')+'</div>').join('')+'</div>':'')+(musicEdit()&&n>=2?btn('Montar playlist sugerida','music_suggest',{},'local')+(musicFavoritesReady&&musicFavorites.size?btn('Usar minhas favoritas','music_suggest',{favorites:true},'local'):''):'')+musicPicker('add')+(ownCompetitor()?'<p class="tg75-muted">Sua música individual será escolhida na Classificatória.</p>':''));
}
function musicPersonal(){
 if(!ownCompetitor())return '';
 return card('Minha música · primeira rodada',!mediaReady()?empty('Aguardando leitura confirmada.'):(music.my_choice&&!musicDraft?'<div class="tg120-wait"><img src="./diva-busto.png" alt=""><h3>Se aqueça!</h3><p>Seu hit: <strong>'+esc(music.my_choice.title)+'</strong></p><p>Aguarde a chamada da Diva.</p>'+(personalEdit()?btn('Alterar minha música','music_edit_choice',{},'local'):'')+'</div>':empty('Escolha seu hit individual.')+musicPicker('choose')));
}
const musicCanLock=()=>musicEdit()&&music.approved_competitors>=2&&music.approved_competitors<=12&&music.tracks.every(t=>t.available===true)&&music.tracks.length>=(window.TGBattleCore?.shape(music.approved_competitors)?.minimum_playlist_songs??Infinity);
function queuedFor(m,z){if(!z||!ctrl())return [];const singers=[m.contestant_a_member_id,m.contestant_b_member_id].filter(Boolean).map(id=>snap?.members?.find(x=>x.id===id)?.user_id);if(singers.some(x=>!x))return [];return (ctx()?.getBattleQueue?.()||[]).filter(q=>q.video_id===z.video_id&&q.singers.length===singers.length&&singers.every(x=>q.singers.includes(x)));}
function musicMatch(m){
 if(!mediaReady())return empty('Aguardando playlist confirmada.');
 const z=mediaFor(m),mine=[m.contestant_a_member_id,m.contestant_b_member_id].includes(me()?.id);
 if(!ctrl()&&!mine)return '';
 if(!z)return ctrl()&&m.state==='ready'?btn(m.kind==='qualifier'?'Confirmar escolha do candidato':'Sortear música','music_resolve',{match_id:m.id,attempt_no:m.attempt_no},'local'):'';
 let html='<p class="tg74-match-title">♫ '+esc(z.title)+'</p>';
 if(z.song_id)html+=empty('Mídia vinculada à fila: '+(z.song_status||'consulte o palco'));
 if(ctrl()&&m.state==='ready'){
 const qs=queuedFor(m,z);html+=qs.length?qs.map(q=>btn('Preparar faixa na fila','music_prepare',{match_id:m.id,attempt_no:m.attempt_no,room_id:q.room_id,song_id:q.id},'local',z.song_id===q.id)).join(''):empty('Os cantores devem adicionar a faixa confirmada no palco reservado; depois atualize e prepare. Não inicie antes da reserva.');
 }
 return html;
}
async function musicAction(action,p,l){
 if(!liveLease(l)||!mediaReady())throw Error('Atualize a playlist antes de continuar.');
 const target=action.slice(6);
 if(target==='search'){if(!musicEdit()&&!personalEdit())throw Error('Seleção indisponível nesta etapa.');await musicBrowse(p,l);return;}
 if(target==='draft'||target==='edit_choice'){if(!personalEdit())throw Error('Escolha indisponível.');musicDraft=target==='edit_choice'?{video_id:music.my_choice.video_id,title:music.my_choice.title}:mediaValid(p)?{video_id:p.video_id,title:p.title}:null;render();return;}
 if(target==='favorite'){if(!musicFavoritesReady||(!musicEdit()&&!personalEdit())||!mediaValid(p))throw Error('Favoritas indisponíveis.');const save=!musicFavorites.has(p.video_id),r=await ctx().getClient().rpc('tg26_favorite_set',{p_video:p.video_id,p_title:p.title,p_saved:save});if(r.error||r.data!==save||!liveLease(l))throw Error('Favorito não confirmado.');if(save)musicFavorites.set(p.video_id,p.title);else musicFavorites.delete(p.video_id);if(musicCategory==='favorites')await musicBrowse(searchPayload(0),l);else render();return;}
 if(target==='suggest'){if(!musicEdit())throw Error('Playlist indisponível.');const min=window.TGBattleCore?.shape(music.approved_competitors)?.minimum_playlist_songs;if(!Number.isInteger(min))throw Error('Aprove o elenco primeiro.');const goal=Math.min(60,min+1),scope=()=>dialog.open&&gen===l.g&&uid===l.u&&uid===ctx()?.getUser()?.id&&festivalId===l.f&&online();let candidates;if(p.favorites===true){await musicFavoriteRead(l);candidates=[...musicFavorites].map(([video_id,title])=>({video_id,title}));}else{const r=await ctx().getClient().from('tg_official_catalog').select('video_id,title,plays').order('plays',{ascending:false}).order('video_id',{ascending:true}).range(0,79);if(r.error||!Array.isArray(r.data)||!liveLease(l))throw Error('Acervo indisponível.');candidates=r.data;}let added=0;try{for(const t of candidates.filter(mediaValid)){if(!scope()||!musicEdit()||music.tracks.filter(x=>x.available).length>=goal)break;if(music.tracks.some(x=>x.video_id===t.video_id))continue;const response=await musicRPC('add',{video_id:t.video_id,title:t.title});if(response?.ok!==true)throw Error('Adição não confirmada.');added++;await reload({paint:false});if(!scope()||!mediaReady())break;}}finally{if(scope()){await reload();if(scope()){render();message(added+' músicas adicionadas; confira a seleção confirmada.');}}}return;}

 if(target==='add'||target==='remove'){if(!musicEdit())throw Error('Playlist fechada ou indisponível.');if(target==='remove')p={video_id:p.video_id};}
 else if(target==='choose'){if(!personalEdit())throw Error('Escolha indisponível nesta etapa.');}
 else if(['resolve','prepare'].includes(target)){
  const m=snap.matches?.find(x=>x.id===p.match_id&&x.attempt_no===p.attempt_no&&x.state==='ready');if(!ctrl()||!m)throw Error('Tentativa alterada.');
  if(target==='prepare'&&!queuedFor(m,mediaFor(m)).some(q=>q.id===p.song_id&&q.room_id===p.room_id))throw Error('A fila mudou. Atualize.');
 }else throw Error('Ação musical inválida.');
 const result=await musicRPC(target,p);
 if(result?.ok!==true||!liveLease(l))throw Error('Ação ainda não confirmada. Atualize.');
 if(target==='resolve'&&(!mediaValid(result)||result.attempt_no!==p.attempt_no))throw Error('Resposta de sorteio incompatível.');
 if(target==='prepare'&&(result.prepared!==true||result.match_id!==p.match_id||result.song_id!==p.song_id||result.room_id!==p.room_id||result.attempt_no!==p.attempt_no))throw Error('Reserva não confirmada.');
 await reload();if(target==='choose')musicDraft=null;render();message('Seleção confirmada pelo servidor.');
}
const tg115RoleLabels={competitor:'Cantor(a)',spectator:'Plateia',guest_voter:'Votante',owner:'Anfitrião',host:'Anfitrião',controller:'Controle'};
const tg115MemberLabels={pending:'Quer entrar',approved:'Confirmado',rejected:'Recusado',withdrawn:'Saiu'};
function elenco(){
 const members=snap?.members||[],pending=members.filter(m=>m.status==='pending'),others=members.filter(m=>m.status!=='pending');
 const person=m=>'<div class="tg115-person"><span class="tg115-person-icon" aria-hidden="true">'+(m.is_competitor?'🎤':m.status==='pending'?'👋':'⭐')+'</span><div class="tg115-person-name"><strong>'+esc(m.display_name)+'</strong><small>'+esc(tg115RoleLabels[m.member_role]||m.member_role)+' · '+esc(tg115MemberLabels[m.status]||m.status)+'</small></div>'+(ctrl()&&m.status==='pending'?'<div class="tg115-person-actions">'+(window.TG115_UI?.enabled()?((m.account_kind==='permanent'&&state()==='registration'?btn('Competidor','access_decision',{...F(),member_id:m.id,decision:'competitor'},'access'):'')+btn('Votante','access_decision',{...F(),member_id:m.id,decision:'voter'},'access')+btn('Recusar','access_decision',{...F(),member_id:m.id,decision:'refused'},'access')):btn('Aceitar','decide_member',{...F(),member_id:m.id,approved:true})+btn('Recusar','decide_member',{...F(),member_id:m.id,approved:false}))+'</div>':'')+'</div>';
 const invite=!window.TG115_UI?.enabled()&&ctrl()&&festivalId?'<details class="tg115-invite" data-festival="'+esc(festivalId)+'"><summary>🎟️ Convite por código</summary><p>Compartilhe o código atual do festival.</p><code>'+esc(festivalId)+'</code><button type="button" class="tg75-button" data-tg113-copy>Copiar convite</button></details>':'';
 const host=ctrl()&&state()==='registration'?card('Você também vai cantar?',me()?.is_competitor===true?'<p>🎤 Você está inscrito para cantar.</p>':btn('🎤 Também vou cantar','host_competes',F())+'<small>Se quiser só comandar, siga sem se inscrever.</small>'):'';
 return head()+(ctrl()&&state()==='draft'?card('Chame a galera',btn('🎟️ Abrir inscrições','open_registration',F())):'')+invite+host+card('Camarim · '+pending.length+' pedidos',pending.length?pending.map(person).join(''):empty('Nenhum pedido aguardando.'))+card('Quem já chegou',others.length?others.map(person).join(''):empty('A galera aparece aqui.'))+(!ctrl()?musicPersonal():'');
}
function playlistProgress(){if(!mediaReady())return 'Atualize para conferir o elenco e as músicas.';const n=music.approved_competitors;if(n<2)return 'Falta aprovar '+(2-n)+' cantor(es). O anfitrião pode cantar também.';if(n>12)return 'O limite é de 12 cantores.';const min=window.TGBattleCore?.shape(n)?.minimum_playlist_songs??Infinity,available=music.tracks.filter(t=>t.available===true).length;if(music.tracks.some(t=>!t.available))return 'Remova as faixas indisponíveis.';if(available<min)return 'Faltam '+(min-available)+' música(s) para os duelos. Uma reserva extra é recomendada.';return 'Tudo pronto para fechar o elenco. Cada cantor escolherá seu hit individual na Classificatória.';}
function playlist(){return head()+(ctrl()&&state()==='registration'?card('Próxima etapa',empty(playlistProgress())+btn('Continuar · Classificatória','lock_roster',F(),'execute',!musicCanLock())+stepButton('Rever camarim','elenco')):'')+musicHost()+(!ctrl()?musicPersonal():'');}
function matchRow(m){const binding=(snap?.bindings||[]).find(b=>b.match_id===m.id&&b.attempt_no===m.attempt_no);let actions=musicMatch(m);if(ctrl()){
 if(['ready','singing'].includes(m.state)&&!binding){const room=ctx()?.getCompetitiveRoom?.(),live=ctx()?.getBattlePerformance?.();actions+=room?.reserved?btn('Vincular música em execução','bind_live',{match_id:m.id,_attempt:m.attempt_no,_room:live?.room_id??null,_song:live?.song_id??null},'local',!live||!mediaFor(m)||mediaFor(m).song_id!==live.song_id||mediaFor(m).room_id!==live.room_id):empty('Antes de enfileirar músicas ou compartilhar o QR, reserve um palco novo e vazio para este festival.');}
 if(binding?.state==='bound'){actions+=btn('Capturar notas oficiais após finalizar','capture_performance',{binding_id:binding.id,_match:m.id,_attempt:m.attempt_no})+technicalForm({binding_id:binding.id,_match:m.id,_attempt:m.attempt_no});}
 if(binding?.state==='invalidated')actions+=btn('Preparar nova tentativa','retry_invalidated',{binding_id:binding.id,_match:m.id,_attempt:m.attempt_no});
 if(m.state==='result_pending'&&binding?.state==='captured')actions+=btn('Abrir votação','open_vote',{...F(),match_id:m.id,_attempt:m.attempt_no,_binding:binding.id});
 }
 if(me()?.is_competitor&&[m.contestant_a_member_id,m.contestant_b_member_id].includes(me()?.id)&&['ready','singing'].includes(m.state))actions+=reasonForm('Solicitar desistência formal','request_withdrawal',{match_id:m.id});
 const official=['completed','resolved'].includes(m.state)||Boolean(m.winner_name);return `<article class="tg75-card"><strong>${esc(m.name_a||'A definir')}${m.name_b?' × '+esc(m.name_b):''}</strong><p>${esc(m.kind)} · ${esc(m.state)} · tentativa ${esc(m.attempt_no)}</p>${binding?`<p>Vínculo: ${esc(binding.state)} · ${binding.performance_mode==='duel_simultaneous'?'2 cantores':'1 cantor'}</p>`:''}${official&&m.winner_name?`<p>Vencedor confirmado: ${esc(m.winner_name)}</p>`:''}${m.average_2_to_10!=null?`<p>Média classificatória oficial: ${esc(m.average_2_to_10)}</p>`:''}${actions}</article>`;}
function matchScreen(qualifier){if(!voteFresh())return head()+card('Apresentações',empty('Aguardando confirmação atual do servidor. Nenhuma apresentação será vinculada, capturada ou reiniciada.')+btn('Atualizar estado','refresh',{},'local'));let ms=(snap?.matches||[]).filter(m=>qualifier?m.kind==='qualifier':m.kind!=='qualifier');return head()+(qualifier?musicPersonal():'')+card(qualifier?'Classificatória individual':'Confrontos',empty('O vínculo utiliza a apresentação real em andamento no palco do anfitrião. As notas são capturadas pelo servidor após o fim; nenhuma nota digitada é aceita.')+(ctrl()?(snap?.next_stage_order!=null?btn('Preparar próxima etapa','prepare_stage',{...F(),stage_order:snap.next_stage_order}):'')+(snap?.active_stage_order!=null?btn('Concluir etapa','complete_stage',{...F(),stage_order:snap.active_stage_order}):'')+(qualifier?btn('Congelar classificação','freeze_seeds',F()):btn('Congelar chave','freeze_bracket',F())):''))+(ms.length?ms.map(matchRow).join(''):empty('Nenhum confronto gerado.'))+(ctrl()&&!qualifier?card('W.O. formal',empty('Apenas desistência voluntária ou ausência verificada. Falha técnica nunca é W.O.')+(snap?.withdrawals||[]).map(w=>reasonForm('Confirmar W.O. por desistência: '+(snap.members.find(m=>m.id===w.member_id)?.display_name||'competidor'),'apply_walkover',{match_id:w.match_id,loser_member_id:w.member_id,basis:'voluntary_withdrawal',evidence_id:w.id,ack:api.ACK.apply_walkover})).join('')+((snap?.reentry?.state==='closed')?ms.filter(m=>m.state==='ready').map(m=>[m.contestant_a_member_id,m.contestant_b_member_id].filter(id=>id&&!snap.reentry.responses?.some(r=>r.member_id===id&&r.approved===true)).map(id=>reasonForm('Analisar W.O. por ausência: '+(snap.members.find(p=>p.id===id)?.display_name||'competidor'),'apply_walkover',{match_id:m.id,loser_member_id:id,basis:'verified_absence',evidence_id:snap.reentry.id,ack:api.ACK.apply_walkover})).join('')).join(''):'')+mfaNote()):'');}
// C27: snapshots are informational; the backend remains authoritative. Never submit a stale ballot.
const voteFingerprint=s=>JSON.stringify([s?.festival?.id,s?.festival?.state,s?.festival?.state_version,s?.permissions?.controller,(s?.voting_windows||[]).map(w=>[w.id,w.match_id,w.state,w.deadline_at,w.eligible,w.my_ballot_submitted,w.has_b,w.name_a,w.name_b,w.result_confirmed]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
const voteFresh=()=>navigator.onLine!==false&&online()&&voteVerifiedAt!==null&&performance.now()-voteVerifiedAt<=12000&&performance.now()>=voteVerifiedAt&&uid===ctx()?.getUser()?.id&&snap?.festival?.id===festivalId;
// C29: identidade da tentativa e do palco é metadado local, nunca altera o contrato RPC.
const matchTab=()=>tab==='classificatoria'||tab==='chave';
const matchActions=new Set(['bind_live','capture_performance','invalidate_performance','retry_invalidated','open_vote']);
const matchFingerprint=s=>JSON.stringify([s?.festival?.id,s?.festival?.state,s?.festival?.state_version,s?.permissions?.controller,(s?.matches||[]).map(m=>[m.id,m.attempt_no,m.state,m.contestant_a_member_id,m.contestant_b_member_id]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),(s?.bindings||[]).map(b=>[b.id,b.match_id,b.attempt_no,b.state,b.room_id,b.song_id]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),(s?.members||[]).map(m=>[m.id,m.user_id,m.status]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
function mayMatchAction(action,p){
 if(!matchActions.has(action))return true;
 if(!voteFresh()||!ctrl()||!['qualifying','bracket'].includes(state())||!Number.isSafeInteger(p._attempt)||p._attempt<1)return false;
 const m=(snap?.matches||[]).find(x=>x.id===(p._match??p.match_id));
 if(!m||m.attempt_no!==p._attempt)return false;
 const bindings=(snap?.bindings||[]).filter(x=>x.match_id===m.id&&x.attempt_no===m.attempt_no);
 if(bindings.length>1)return false;
 const b=bindings[0];
 if(action==='bind_live'){
  const live=ctx()?.getBattlePerformance?.(),room=ctx()?.getCompetitiveRoom?.();
  return !b&&['ready','singing'].includes(m.state)&&!!p._song&&!!p._room&&room?.reserved===true&&room.id===p._room&&live?.room_id===p._room&&live.song_id===p._song;
 }
 if(action==='open_vote')return p.festival_id===festivalId&&m.state==='result_pending'&&b?.state==='captured'&&b.id===p._binding;
 if(!b||b.id!==p.binding_id)return false;
 if(action==='retry_invalidated')return m.state==='postponed'&&b.state==='invalidated';
 if(action==='invalidate_performance')return ['singing','postponed'].includes(m.state)&&b.state==='bound'&&api.INVALIDATION_REASONS.includes(p.reason);
 return m.state==='singing'&&b.state==='bound';
}
// SQL58: rotas F03, sem ler cedulas individuais.
let f03Cases=new Map();
const f03Windows=s=>(s?.voting_windows||[]).filter(w=>['paused','closed'].includes(w.state)&&!w.result_confirmed&&(s?.matches||[]).some(m=>m.id===w.match_id&&['voting','result_pending'].includes(m.state)&&(w.attempt_no==null||m.attempt_no===w.attempt_no)));
async function f03Read(id){
 const {data,error}=await ctx().getClient().rpc('tg57_f03_incident',{p_action:'status',p_payload:{window_id:id}});
 if(error||data?.individual_ballots_visible!==false||!Object.prototype.hasOwnProperty.call(data,'case'))throw Error('Não foi possível confirmar o incidente. Atualize a votação.');
 return f03Normalize(data,id);
}
// C109: somente o caso vigente autoriza ações. Histórico exclusivamente informativo.
function f03Normalize(data,id){
 const valid=c=>!!c&&typeof c.case_id==='string'&&api.UUID.test(c.case_id)&&typeof c.authorized==='boolean'&&['reported','needs_admin_review','resume_authorized','rejected'].includes(c.status)&&Number.isSafeInteger(c.attempt_no)&&c.attempt_no>=1&&(c.pause_id===null||(typeof c.pause_id==='string'&&api.UUID.test(c.pause_id)));
 const c=data.case,h=data.last_case,n=data.history_count;
 if((c!==null&&(!valid(c)||c.window_id!==id||typeof c.full_revote_callable!=='boolean'))||
    !Number.isSafeInteger(n)||n<0||(n===0&&(h!==null||c!==null))||(n>0&&!valid(h))||
    (c!==null&&n===1&&h.case_id!==c.case_id))throw Error('Estado ou histórico do incidente não reconhecido.');
 return {current:c===null?null:{case_id:c.case_id,status:c.status,window_id:c.window_id,attempt_no:c.attempt_no,pause_id:c.pause_id,authorized:c.authorized,full_revote_callable:c.full_revote_callable},historyCount:n,last:h===null?null:{case_id:h.case_id,status:h.status,attempt_no:h.attempt_no,pause_id:h.pause_id,authorized:h.authorized}};
}
function f03History(entry){
 if(!entry.historyCount)return '';
 const previous=entry.historyCount-(entry.current?1:0);
 if(!previous)return '';
 const names={reported:'registrado',needs_admin_review:'encaminhado para revisão',resume_authorized:'retomada autorizada',rejected:'rejeitado'};
 const last=entry.last&&entry.last.case_id!==entry.current?.case_id?entry.last:null;
 return '<details><summary>Histórico de incidentes ('+esc(previous)+')</summary>'+empty('Registros anteriores: somente consulta, sem autorização para esta ocorrência.')+(last?empty('Último registro anterior: '+(last.authorized?'nova tentativa autorizada':names[last.status])+' · tentativa '+last.attempt_no):empty('O registro mais recente corresponde à ocorrência atual.'))+'</details>';
}
function f03Allowed(action,p,cases=f03Cases){
 if(!voteFresh()||!ctrl()||!f03Windows(snap).some(w=>w.id===p.window_id)||!cases.has(p.window_id))return false;
 const c=cases.get(p.window_id).current;
 if(action==='report')return c===null;
 if(!c||c.case_id!==p.case_id||c.authorized)return false;
 if(action==='escalate')return c.status==='reported';
 if(action==='resume_recovered')return c.status==='reported'&&['qualifying','bracket'].includes(snap?.festival?.state)&&f03Windows(snap).some(w=>w.id===p.window_id&&w.state==='paused');
 if(action==='authorize_full_revote')return c.status==='needs_admin_review'&&c.full_revote_callable===true;
 return false;
}
function f03ReportForm(w){return '<form data-reason-action="report" data-kind="incident" data-payload="'+data({window_id:w.id})+'"><label>Motivo da falha<textarea name="reason" minlength="20" maxlength="500" rows="2" required></textarea></label><label>Referência do ocorrido<input name="evidence_reference" minlength="10" maxlength="300" required placeholder="Ex.: protocolo ou horário da ocorrência"></label>'+empty('Não inclua senhas, dados pessoais ou votos individuais.')+'<button class="tg75-button">Registrar incidente</button></form>';}
function f03Panel(w){
 if(!ctrl()||!f03Windows(snap).some(x=>x.id===w.id))return '';
 if(!f03Cases.has(w.id))return empty('Incidente: confirmação indisponível. Atualize antes de retomar ou apurar.')+btn('Atualizar estado','refresh',{},'local');
 const entry=f03Cases.get(w.id);return f03CurrentPanel(w,entry.current)+f03History(entry);
}
function f03CurrentPanel(w,c){
 if(c===null)return '<details><summary>Falha de votação</summary>'+f03ReportForm(w)+'</details>';
 if(c.authorized)return empty('Nova tentativa já autorizada. Confira a etapa atual.');
 if(c.status==='reported')return empty('Incidente registrado. Votos preservados.')+(['qualifying','bracket'].includes(state())&&w.state==='paused'?reasonForm('Falha resolvida · retomar votação','resume_recovered',{window_id:w.id,case_id:c.case_id},'incident'):'')+reasonForm('Encaminhar para revisão','escalate',{window_id:w.id,case_id:c.case_id},'incident');
 if(c.status==='resume_authorized')return empty('Incidente anterior resolvido. A votação original foi preservada. Se surgir uma nova falha nesta janela, consulte a Central antes de prosseguir.');
 if(c.status==='needs_admin_review')return empty(c.full_revote_callable?'Parecer e prontidão confirmados.':'Aguardando revisão independente ou validação MFA.')+(c.full_revote_callable?reasonForm('Autorizar nova apresentação e votação','authorize_full_revote',{window_id:w.id,case_id:c.case_id},'incident'):mfaNote());
 return empty('Incidente em revisão. Consulte a Central.');
}
const f03ContinuationAllowed=(w,cases=f03Cases)=>cases.has(w.id)&&(cases.get(w.id).current===null||(!cases.get(w.id).current?.authorized&&cases.get(w.id).current?.status==='resume_authorized'));
const voteActions=new Set(['cast_vote','extend_vote','close_vote','finalize_due','pause_vote','resume_vote','commit_result','start_rematch']);
function mayVoteAction(action,p){if(!voteActions.has(action))return true;if(!voteFresh())return false;const w=(snap?.voting_windows||[]).find(x=>x.id===p.window_id);if(!w)return false;const deadline=Date.parse(w.deadline_at);if(action==='cast_vote')return w.state==='open'&&w.eligible===true&&w.my_ballot_submitted===false&&Number.isFinite(deadline)&&Date.now()<deadline&&(!w.has_b?p.stars_b===null:p.stars_b!==null);if(!ctrl())return false;if(action==='resume_vote')return w.state==='paused'&&f03ContinuationAllowed(w);if(action==='commit_result'||action==='start_rematch')return w.state==='closed'&&!w.result_confirmed&&f03ContinuationAllowed(w);if(action==='extend_vote')return w.state==='open'&&Number.isFinite(deadline)&&Date.now()<deadline;return w.state==='open';}
const lease=()=>({g:gen,u:uid,f:festivalId,v:version()});
const liveLease=l=>dialog.open&&l.g===gen&&l.u===uid&&l.u===ctx()?.getUser()?.id&&l.f===festivalId&&l.v===version()&&online();
function invalidateVote(){f03Cases.clear();voteEpoch++;voteVerifiedAt=null;if(tab==='votacao'||matchTab()){dirty=false;render();}tg95PaintShow();}
function remaining(deadline){const ms=Date.parse(deadline)-Date.now();if(!Number.isFinite(ms))return '—';const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function stars(k,name){return `<fieldset><legend>${esc(name)}</legend><div class="tg75-stars">${[1,2,3,4,5].map(v=>`<label><input type="radio" name="${k}" value="${v}" required aria-label="${v} ${v===1?'estrela':'estrelas'}"><span>${v} ★</span></label>`).join('')}</div></fieldset>`;}
function votacao(){if(!voteFresh())return head()+card('Votação',empty('Aguardando confirmação atual do servidor. Nenhuma cédula ou retomada pode ser enviada.')+btn('Atualizar estado','refresh',{},'local'));const ws=snap?.voting_windows||[];const current=ws.filter(w=>['open','paused','closed'].includes(w.state)&&!w.result_confirmed);return head()+card('Votação',empty('150 segundos, uma prorrogação de 30 s. Eleitorado congelado. O relógio local é apenas informativo. Nenhum total de estrelas é exibido antes da apuração.'))+(current.length?current.map(w=>card(`${w.name_a||'Apresentação'}${w.has_b?' × '+w.name_b:''}`,`<p>${esc(({open:'Aberta',paused:'Pausada',closed:'Em apuração'})[w.state]||'Aguardando')} · ${esc(w.votes_count??0)} votos</p>`+(w.state==='open'?`<div class="tg75-timer" data-deadline="${esc(w.deadline_at)}">${remaining(w.deadline_at)}</div>${w.my_ballot_submitted?'<p>Voto registrado pelo servidor.</p>':w.eligible&&Number.isFinite(Date.parse(w.deadline_at))&&Date.now()<Date.parse(w.deadline_at)?`<form data-vote="${esc(w.id)}">${stars('stars_a',w.name_a)}${w.has_b?stars('stars_b',w.name_b):''}<button class="tg75-button" ${!online()?'disabled':''}>Confirmar voto</button></form>`:empty(w.eligible?'Prazo local esgotado. Aguarde o estado confirmado pelo servidor.':'Aguarde o resultado desta apresentação.')}${ctrl()?btn('Prorrogar 30 segundos','extend_vote',{window_id:w.id})+btn('Encerrar se prazo atingido','finalize_due',{window_id:w.id})+reasonForm('Pausar por falha técnica','pause_vote',{window_id:w.id}):''}`:w.state==='paused'?(empty('Relógio pausado pelo servidor. Cédulas já confirmadas permanecem registradas. Nenhuma contagem regressiva local.')+(ctrl()?((f03ContinuationAllowed(w)?reasonForm('Retomar votação preservada','resume_vote',{window_id:w.id}):'')+f03Panel(w)):empty('Aguardando retomada segura.'))):ctrl()&&!w.result_confirmed?((f03ContinuationAllowed(w)?btn('Confirmar apuração','commit_result',{window_id:w.id})+btn('Preparar revanche se empate absoluto','start_rematch',{window_id:w.id}):'')+f03Panel(w)):empty(w.result_confirmed?'Resultado oficial registrado.':'Aguardando apuração.')))).join(''):empty('Nenhuma janela de votação.'));}
function recovery(){const r=snap?.recovery?.active_request, re=snap?.reentry, p=snap?.permissions;return head()+card('Intervalo e reconfirmação',empty('Tolerância inicial de 15 minutos; nunca elimina automaticamente.')+(ctrl()&&['registration','qualifying','bracket'].includes(state())?reasonForm('Entrar em intervalo técnico','enter_technical',F()):'')+(ctrl()&&state()==='technical_intermission'?reasonForm('Sair do intervalo técnico','exit_technical',F()):'')+(ctrl()&&['intermission','technical_intermission'].includes(state())&&re?.state!=='open'?reasonForm('Convocar reentrada','open_reentry',F()):'')+(re?`<p>Convocação ${esc(re.state)} · tolerância até ${esc(new Date(re.grace_until).toLocaleString('pt-BR'))}</p>${re.state==='open'&&me()?.is_competitor&&me()?.account_kind==='permanent'?btn('Confirmar minha presença','confirm_reentry',{call_id:re.id}):''}${ctrl()&&re.state==='open'?(re.responses||[]).filter(x=>x.approved==null).map(x=>`<p>${esc(snap.members.find(m=>m.id===x.member_id)?.display_name||'Participante')}</p>${reasonForm('Validar presença','verify_reentry',{call_id:re.id,member_id:x.member_id,approved:true})}${reasonForm('Recusar presença','verify_reentry',{call_id:re.id,member_id:x.member_id,approved:false})}`).join('')+reasonForm('Fechar convocação','close_reentry',{call_id:re.id}):''}`:''))+card('Delegação e recuperação',empty('O pedido exige aceite do delegado, confirmações independentes e aviso verificado ao titular. A transferência não é automática.')+(owner()&&state()==='intermission'?(snap.members||[]).filter(m=>m.status==='approved'&&m.account_kind==='permanent'&&m.user_id!==uid).map(m=>btn('Indicar '+m.display_name,'nominate_delegate',{...F(),member_id:m.id})).join(''):'')+(p?.delegate_nominee&&!p.delegate_accepted?btn('Aceitar delegação','accept_delegate',F()):'')+(p?.delegate_accepted&&state()==='intermission'&&!r?btn('Solicitar recuperação','request_recovery',F()):'')+(r?`<p>${esc(r.state)} · ${esc(r.approvals)}/${esc(r.required_confirmations)} aprovações</p>${r.my_eligible?btn('Confirmar recuperação','confirm_recovery',{request_id:r.id,approve:true})+btn('Rejeitar recuperação','confirm_recovery',{request_id:r.id,approve:false}):''}${btn('Consultar condições','recovery_status',{request_id:r.id})}${owner()?reasonForm('Contestar recuperação','owner_contest',{request_id:r.id})+reasonForm('Rejeitar recuperação','owner_reject',{request_id:r.id}):''}${p?.delegate_accepted?reasonForm('Concluir transferência após validação','complete_transfer',{request_id:r.id}):''}`:'')+(owner()&&snap?.last_transfer_id?reasonForm('Solicitar retomada do controle pelo titular','owner_reclaim',{request_id:snap.last_transfer_id}):'')+(approved()&&state()==='intermission'?reasonForm('Encaminhar exceção para revisão','request_exception',F()):'')+mfaNote())+(ctrl()?card('Incidentes de votação — F03',empty('A revotação integral só é permitida após revisão independente AAL2 e integridade comprovada. Não recicla votos nem notas.')+empty('Consulte a votação pausada ou pendente para registrar, encaminhar e acompanhar o incidente.')+mfaNote()):'');}
function premios(){const p=snap?.festival_podium;return head()+card('Pódio oficial',p?.status==='awarded'?`<p>🥇 ${esc(p.gold||'—')}</p><p>🥈 ${esc(p.silver||'—')}</p>${(p.bronze||[]).map(n=>`<p>🥉 ${esc(n)}</p>`).join('')}`:p?.status==='no_champion'?empty('Festival encerrado sem campeão; nenhum troféu fictício.'):empty('Nenhum pódio oficial registrado.'))+(ctrl()?card('Premiação auditada',btn('Consolidar pódio após resultados','finalize_podium',{...F(),ack:api.ACK.finalize_podium})+reasonForm('Encerrar sem campeão','close_no_champion',{...F(),outcome:'completed_no_champion',ack:api.ACK.close_no_champion})+(['completed','cancelled'].includes(state())?(snap?.reserved_rooms||[]).filter(r=>r.status==='open').map(r=>btn('Encerrar palco: '+r.title,'close_battle_room',{room_id:r.id},'local')).join(''):'')+mfaNote()):'');}
// R85 — preparação de MFA real antes do release. Apenas Auth, sem acesso competitivo.
const previewMfaAccount=()=>{const u=ctx()?.getUser();return !!u?.id&&u.id===uid&&u.is_anonymous!==true&&u.app_metadata?.provider!=='anonymous'&&!!ctx()?.getClient()?.auth?.mfa;};
function previewSecurity(){return card('Segurança da conta',empty('A competição continua bloqueada. Prepare e valide o autenticador da sua própria conta. Nenhum festival, voto ou prêmio será criado.')+(previewMfaAccount()?'<button type="button" class="tg75-button" data-preview-mfa="status">Consultar nível de segurança</button><button type="button" class="tg75-button" data-preview-mfa="factors">Usar autenticador cadastrado</button><button type="button" class="tg75-button" data-preview-mfa="enroll">Cadastrar autenticador</button><div id="tg08-mfa"></div>':empty('Entre com uma conta cadastrada para configurar MFA.')));}
async function previewMfa(action,form=null){
 if(busy||online()||tab!=='seguranca'||!dialog.open||!previewMfaAccount()||navigator.onLine===false)return;
 const client=ctx().getClient(),actor=uid,run=gen;const current=()=>run===gen&&actor===uid&&previewMfaAccount()&&client===ctx()?.getClient()&&dialog.open&&tab==='seguranca'&&!online();
 busy=true;message('Verificando segurança da conta…');
 try{
  const auth=client.auth.mfa;
  if(action==='status'){const {data,error}=await auth.getAuthenticatorAssuranceLevel();if(!current())return;if(error)throw Error('Não foi possível consultar o nível de segurança.');message(data?.currentLevel==='aal2'?'MFA validado nesta sessão (AAL2).':'Sessão ainda sem MFA validado (AAL1).');return;}
  if(action==='factors'){const {data,error}=await auth.listFactors();if(!current())return;if(error)throw Error('Não foi possível consultar autenticadores.');const fs=(data?.totp||[]).filter(f=>f.status==='verified'&&api.UUID.test(f.id));if(!fs.length){message('Nenhum autenticador TOTP validado. Cadastre um primeiro.');return;}renderMfa(fs[0].id);message('Informe o código do autenticador.');return;}
  if(action==='enroll'){
   if(!await window.TG_UI.confirm('Cadastrar um autenticador nesta conta? Guarde o acesso ao autenticador para não perder o acesso futuro.',{title:'Preparar autenticação de dois fatores',confirmText:'Cadastrar'}))return;
   if(!current())return;
   const {data:existing,error:lookupError}=await auth.listFactors();if(!current())return;if(lookupError)throw Error('Não foi possível consultar os autenticadores existentes.');
   if((existing?.totp||[]).some(f=>f.status==='verified')){message('Já existe autenticador validado. Use a opção correspondente.');return;}
   const {data,error}=await auth.enroll({factorType:'totp',friendlyName:'Tem Gogó'});if(!current())return;if(error||!api.UUID.test(data?.id)||!data?.totp?.secret)throw Error('Não foi possível cadastrar o autenticador. Confira os fatores no Supabase.');
   renderMfa(data.id,data.totp.secret);message('Adicione a chave ao autenticador e informe o código. Não compartilhe a chave.');return;
  }
  if(action==='verify'){
   const id=form?.dataset.factor,code=String(new FormData(form).get('code')||'');
   if(!api.UUID.test(id)||!/^\d{6}$/.test(code))throw Error('Confira o código de seis dígitos.');
   const {error}=await auth.challengeAndVerify({factorId:id,code});if(!current())return;if(error)throw Error('Código inválido ou expirado.');
   const {data,error:readError}=await auth.getAuthenticatorAssuranceLevel();if(!current())return;
   render();message(!readError&&data?.currentLevel==='aal2'?'MFA validado com sucesso nesta sessão (AAL2).':'A validação do nível de segurança ainda não foi confirmada.');return;
  }
 }catch(e){if(current())message(e.message||'Não foi possível verificar a segurança.');}finally{if(run===gen)busy=false;}
}
function seguranca(){return head()+card('Autenticação de dois fatores',empty('Use um autenticador TOTP. A validação real é feita pelo Supabase; códigos e chave de configuração nunca são enviados à Central.')+btn('Consultar nível de segurança','mfa_status',{},'local')+btn('Cadastrar autenticador','mfa_enroll',{},'local')+btn('Usar autenticador já cadastrado','mfa_factors',{},'local')+'<div id="tg08-mfa"></div>');}
const screens={inicio,elenco,playlist,classificatoria:()=>matchScreen(true),chave:()=>matchScreen(false),votacao,recuperacao:recovery,premios,seguranca};
const previewPages=Object.freeze({
 inicio:['Festival','A organização começa por um festival e seu elenco.','Criar festival','Solicitar participação','Consultar meus festivais'],
 elenco:['Participantes','De dois a doze competidores aprovados pelo anfitrião.','Abrir inscrições de cantores e votantes','Aprovar participantes','Seguir para a playlist'],
 playlist:['Playlist','Selecione as faixas dos confrontos e confira as escolhas individuais.','Buscar no acervo','Conferir músicas disponíveis','Fechar elenco e playlist quando estiverem prontos'],
 classificatoria:['Classificatória','Cada candidato escolhe sua própria música. As notas oficiais são confirmadas pelo servidor.','Escolher música pessoal','Capturar resultado oficial','Congelar classificação'],
 chave:['Confrontos','O sistema escolhe a música dentre as opções da playlist fechada pelo anfitrião.','Escolher música pelo sistema','Validar apresentação','Confirmar avanço'],
 votacao:['Votação','Eleitorado congelado; voto de 1 a 5 estrelas, prazo de 150 segundos e uma possível extensão de 30 segundos.','Ver cédula habilitada','Confirmar voto uma única vez','Aguardar apuração'],
 recuperacao:['Recuperação','Intervalos, reconfirmação e delegação seguem as regras de segurança; falha técnica não é W.O.','Intervalo técnico','Reconfirmar presença','Recuperar controle com validação'],
 premios:['Premiações','O pódio só é registrado após resultados válidos. Pode haver encerramento sem campeão.','Consultar resultados oficiais','Validar premiação','Consultar conquistas'],
 seguranca:['Segurança','Ações críticas exigem validação por dois fatores. O servidor decide as permissões.','Consultar nível de segurança','Validar autenticador','Confirmar ações críticas']
});
// R68: ensaio local explicitamente fictício, sem acesso ao banco. A playlist competitiva real exige contrato autorizado.
const tg68Tracks=Object.freeze(['Pop · faixa A','Rock · faixa B','Funk · faixa C','MPB · faixa D','Sertanejo · faixa E','Pagode · faixa F','Samba · faixa G','Forró · faixa H','Rap · faixa I','Internacional · faixa J','Reggae · faixa K','Axé · faixa L','Eletrônica · faixa M','Escolha pessoal · faixa N']);
const tg68New=()=>({n:4,selected:new Set(),locked:false,personal:'',drawn:[]});
let tg68Demo=tg68New();
const tg68Minimum=()=>window.TGBattleCore?.shape(tg68Demo.n)?.minimum_playlist_songs??null;
function tg68Playlist(){
 const d=tg68Demo,min=tg68Minimum(),count=d.selected.size;
 const checks=tg68Tracks.slice(0,13).map((name,i)=>'<label class="tg68-song"><input type="checkbox" data-tg68-track="'+i+'" '+(d.selected.has(i)?'checked ':'')+(d.locked?'disabled':'')+'><span>'+esc(name)+'</span></label>').join('');
 return card('Playlist da Batalha · ensaio local','<p class="tg75-muted">O anfitrião monta a playlist enquanto recebe inscrições de cantores e votantes, antes do início. Estas faixas são fictícias.</p><label>Competidores <select data-tg68-count '+(d.locked?'disabled':'')+'>'+Array.from({length:11},(_,i)=>i+2).map(n=>'<option value="'+n+'" '+(n===d.n?'selected':'')+'>'+n+'</option>').join('')+'</select></label><p role="status"><strong>'+count+' selecionadas</strong> · mínimo '+(min??'indisponível')+' para confrontos</p><div class="tg68-song-grid">'+checks+'</div><button type="button" class="tg75-button" data-tg68-lock '+(d.locked||min===null||count<min?'disabled':'')+'>'+(d.locked?'Playlist fechada no ensaio':'Fechar playlist (ensaio)')+'</button> <button type="button" class="tg75-button" data-tg68-reset>Reiniciar ensaio</button>');
}
function tg68Personal(){
 const d=tg68Demo;
 return card('Escolha pessoal · primeira rodada','<p class="tg75-muted">No ensaio, você representa um candidato. Sua música individual não precisa pertencer à playlist do host.</p><label>Minha música <select data-tg68-personal '+(!d.locked?'disabled':'')+'><option value="">Escolher música</option>'+tg68Tracks.map((name,i)=>'<option value="'+i+'" '+(d.personal===String(i)?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label><p role="status">'+(!d.locked?'Feche primeiro a playlist na aba Elenco.':d.personal===''?'Selecione a música da classificatória.':'Escolha pessoal: '+esc(tg68Tracks[Number(d.personal)]))+'</p>');
}
function tg68Draw(){
 const d=tg68Demo,remaining=[...d.selected].filter(x=>!d.drawn.includes(x));
 return card('Escolha do sistema · confrontos','<p class="tg75-muted">Demonstração: sorteio entre as opções fechadas pelo anfitrião, sem repetição neste ensaio. Não atribui notas, vitórias ou prêmios.</p><button type="button" class="tg75-button" data-tg68-draw '+(!d.locked||d.personal===''||!remaining.length?'disabled':'')+'>Sortear próxima música (ensaio)</button><p role="status">'+(d.drawn.length?'Última sorteada: '+esc(tg68Tracks[d.drawn[d.drawn.length-1]]):'Nenhum sorteio.')+'</p><p>'+remaining.length+' faixas restantes</p>'+d.drawn.map(x=>'<p>'+esc(tg68Tracks[x])+'</p>').join(''));
}
function previewScreen(key){if(key==='seguranca')return previewSecurity();const page=previewPages[key]||previewPages.inicio;return '<div class="tg75-note tg33-preview-note" role="status"><strong>Prévia educativa · competição indisponível</strong><p>'+esc(bridge.current().message)+'</p><p>Explore as etapas sem criar festival, enviar votos ou gerar prêmios. A aba Segurança permite preparar o MFA da conta.</p></div>'+card(page[0],empty(page[1])+'<ol class="tg33-preview-steps">'+page.slice(2).map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol>')+(key==='playlist'?tg68Playlist():key==='classificatoria'?tg68Personal():key==='chave'?tg68Draw():'');}
function voterView(){return online()&&!!snap&&!ctrl()&&!owner()&&['guest_voter','spectator'].includes(me()?.member_role);}
function voterHome(){const anon=ctx()?.getUser()?.is_anonymous===true||ctx()?.getUser()?.app_metadata?.provider==='anonymous';return card('Meu perfil',`<p><strong>${esc(me()?.display_name||'Votante')}</strong></p><p>${anon?'Identidade temporária neste festival.':'Conta Tem Gogó conectada.'}</p>`)+card('Meus festivais',festivals.length?festivals.map(f=>`<p>${esc(f.title)} ${btn('Abrir','select',{id:f.id},'local')}</p>`).join(''):empty('Nenhum festival disponível.'))+card('Participação',empty('Para entrar em outro festival, volte às opções.')+'<button type="button" class="tg75-button" data-r62-voter-back>Voltar às opções</button>');}
// R95: the editorial strip uses only already authorized, fresh workspace fields.
// No writes, scores, early winner, assumed next match, audio, or actions.
function tg95ShowMoment(s,fresh,now){
 if(!fresh||!s?.festival)return {title:'Aguardando confirmação',line:'A produção está conferindo o festival.'};
 const state=s.festival.state,ms=Array.isArray(s.matches)?s.matches:[],ws=Array.isArray(s.voting_windows)?s.voting_windows:[],bs=Array.isArray(s.bindings)?s.bindings:[];
 const active=ms.filter(m=>m.state==='singing');
 const names=m=>[m?.name_a,m?.name_b].filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim().slice(0,70)).join(' × ');
 if(state==='cancelled')return {title:'Festival encerrado',line:'O festival foi encerrado sem conclusão.'};
 if(state==='completed')return {title:'Grande final concluída',line:'Confira a premiação oficial na aba Prêmios.'};
 if(state==='intermission'||ws.some(w=>w.state==='paused'))return {title:'Intervalo',line:'A produção vai orientar a retomada. Aguarde a confirmação.'};
 if(state==='draft')return {title:'Preparativos',line:'Arrume o camarim! A produção está preparando o festival.'};
 if(state==='registration')return {title:'Inscrições abertas',line:'É hora de montar o elenco e preparar os hits.'};
 if(!['qualifying','bracket'].includes(state))return {title:'Aguardando etapa',line:'A produção vai confirmar o próximo momento.'};
 const open=ws.filter(w=>w.state==='open');
 if(open.length===1){const w=open[0],end=Date.parse(w.deadline_at);return Number.isFinite(end)&&end>now?{title:'Votação aberta',line:names(w)||'A plateia pode conferir a votação.'}:{title:'Aguardando encerramento',line:'O prazo terminou. Aguarde a confirmação do servidor.'};}
 if(open.length>1||active.length>1)return {title:'Festival em andamento',line:'Confira a etapa atual no painel.'};
 if(active.length===1){const m=active[0];return {title:m.kind==='qualifier'?'Classificatória no palco':'Confronto no palco',line:names(m)||'Apresentação em andamento.'};}
 const pending=ms.filter(m=>m.state==='result_pending'&&!ws.some(w=>w.match_id===m.id&&w.result_confirmed===true));
 if(pending.length){const m=pending.length===1?pending[0]:null,w=m?ws.find(w=>w.match_id===m.id&&w.state==='closed'):null,b=m?bs.find(b=>b.match_id===m.id&&b.attempt_no===m.attempt_no):null;return {title:w?'Apuração em andamento':b?.state==='captured'?'Apresentação avaliada':'Aguardando avaliação oficial',line:w?'A produção está conferindo o resultado.':b?.state==='captured'?'Aguarde a abertura oficial da votação.':'Nenhuma nota ou resultado será antecipado.'};}
 const invalid=bs.some(b=>b.state==='invalidated'&&ms.some(m=>m.id===b.match_id&&m.attempt_no===b.attempt_no));
 if(invalid)return {title:'Pausa técnica',line:'A produção vai orientar a nova tentativa. Falha técnica não é derrota.'};
 const ready=ms.filter(m=>m.state==='ready');
 if(ready.length===1){const m=ready[0];return {title:m.attempt_no>1?'Nova tentativa confirmada':m.kind==='qualifier'?'Classificatória disponível':'Confronto disponível',line:names(m)||'Aguarde a chamada oficial.'};}
 if(ready.length>1)return {title:'Apresentações disponíveis',line:'Aguarde a chamada oficial da produção.'};
 return {title:'Aguardando próxima etapa',line:'O festival segue conforme a confirmação da produção.'};
}
// R96 — voice authorization is independent of UI wording and cannot write festival state.
function tg96Intents(s,media,fresh,now){
 if(!fresh||!s?.festival||s.permissions?.controller!==true)return [];
 const fid=s.festival.id,fs=s.festival.state,ms=s.matches||[],ws=s.voting_windows||[];
 const item=(event,id,m=null,w=null,key=null)=>({event,id,match:m?.id??null,attempt:m?.attempt_no??null,window:w?.id??null,key:fid+':'+(key||event+':'+(w?.id||m?.id||'festival')+':'+(m?.attempt_no||0))});
 if(fs==='registration')return [item('battle_abertura','voz-12')];
 if(!['qualifying','bracket'].includes(fs)||ms.some(m=>m.state==='singing')||ws.some(w=>w.state==='paused'))return [];
 const open=ws.filter(w=>w.state==='open');
 if(open.length){if(open.length!==1||!(Date.parse(open[0].deadline_at)>now))return [];const m=ms.find(m=>m.id===open[0].match_id);return m?[item('battle_votacao','voz-30',m,open[0])]:[];}
 const closed=ws.filter(w=>w.state==='closed'&&w.result_confirmed!==true);
 if(closed.length){if(closed.length!==1)return [];const m=ms.find(m=>m.id===closed[0].match_id);return m?[item('battle_apuracao','voz-26',m,closed[0])]:[];}
 if(ms.some(m=>['voting','result_pending'].includes(m.state)))return [];
 const ready=ms.filter(m=>m.state==='ready');
 if(fs==='qualifying'&&ready.some(m=>m.kind==='qualifier')&&!ms.some(m=>m.kind==='qualifier'&&['completed','resolved'].includes(m.state)))return [item('battle_classificatoria','voz-21',ready.find(m=>m.kind==='qualifier'),null,'classificatoria')];
 if(fs!=='bracket'||ready.length!==1)return [];
 const m=ready[0];if(m.kind==='qualifier'||!m.contestant_b_member_id)return [];
 const out=[];if(m.kind==='final'&&m.attempt_no===1)out.push(item('battle_final','voz-22',m));
 const z=media?.media?.find(z=>z.match_id===m.id&&z.attempt_no===m.attempt_no&&['duel_initial','rematch'].includes(z.origin));if(z)out.push(item('battle_sorteio','voz-25',m));
 out.push(item('battle_confronto','voz-29',m));return out;
}
let tg96Job=null,tg96Caption='',tg96Seen=new Set(),tg97CueRetry=new Map();
const tg96Scope=()=>ctx()?.getBattleShowAudio?.();
const tg96CurrentIntents=()=>tg96Intents(snap,mediaReady()?music:null,voteFresh(),Date.now());
function tg96Key(u,k){return 'tg96-cue:'+u+':'+k;}
function tg96WasSeen(u,k){if(tg96Seen.has(tg96Key(u,k)))return true;try{return sessionStorage.getItem(tg96Key(u,k))==='1';}catch{return false;}}
function tg96Mark(u,k){const key=tg96Key(u,k);tg96Seen.add(key);if(tg96Seen.size>240)tg96Seen.delete(tg96Seen.values().next().value);try{sessionStorage.setItem(key,'1');}catch{}}
function tg96JobValid(j){const s=tg96Scope();return tg96Job===j&&dialog.open&&tab!=='seguranca'&&!document.hidden&&online()&&voteFresh()&&ctrl()&&!!s&&s.room===j.scope.room&&s.uid===j.scope.uid&&s.epoch===j.scope.epoch&&gen===j.gen&&festivalId===j.fid&&window.TG74_DIVA_STUDIO?.getAuto()===true&&tg96CurrentIntents().some(x=>x.key===j.intent.key);}
function tg96StopShow(){
 const j=tg96Job;tg96Job=null;tg96Caption='';
 if(j){clearTimeout(j.timer);try{j.audio?.pause();j.audio?.removeAttribute('src');j.audio?.load();}catch{}}
}
function tg96GuardShow(){
 if(!tg96Job)return;
 const j=tg96Job,studio=window.TG74_DIVA_STUDIO;
 if(!tg96JobValid(j)){tg96StopShow();return;}
 if(j.audio){const v=j.kind==='pop'?studio?.getPopVolume():studio?.getVolume();if(!(v>0)||(j.kind==='voice'&&document.body.classList.contains('tg93-voice-previews-off'))||(j.kind==='pop'&&document.body.classList.contains('effects-off'))){try{j.audio.pause();j.audio.removeAttribute('src');j.audio.load();}catch{}j.audio=null;clearTimeout(j.timer);j.timer=setTimeout(tg96StopShow,3500);}else j.audio.volume=v/100;}
}
async function tg96TryShow(){
 tg96GuardShow();
 const studio=window.TG74_DIVA_STUDIO,s=tg96Scope();if(tg96Job||!dialog.open||tab==='seguranca'||!online()||!voteFresh()||!ctrl()||!s||studio?.getAuto()!==true)return;
 const intent=tg96CurrentIntents().find(x=>!tg96WasSeen(s.uid,x.key)&&(tg97CueRetry.get(tg96Key(s.uid,x.key))||0)<=Date.now());if(!intent)return;
 const j={scope:s,gen,fid:festivalId,intent,audio:null,timer:null,kind:'voice'};tg96Job=j;
 const retryKey=tg96Key(s.uid,intent.key);tg97CueRetry.set(retryKey,Date.now()+12000);if(tg97CueRetry.size>240)tg97CueRetry.delete(tg97CueRetry.keys().next().value);
 let cue,timeout;
 try{const r=await Promise.race([ctx().getClient().rpc('tg48_battle_cue',{p_room:s.room,p_festival:j.fid,p_event:intent.event,p_match:intent.match,p_attempt:intent.attempt,p_window:intent.window}),new Promise(resolve=>{timeout=setTimeout(()=>resolve({error:true}),2300);})]);if(r?.error||!tg96JobValid(j)){if(tg96Job===j)tg96StopShow();return;}cue=r.data;}catch{if(tg96Job===j)tg96StopShow();return;}finally{clearTimeout(timeout);}
 const v=window.TG74_VOICES?.find(v=>v.id===intent.id&&v.id===cue?.id);
 if(!tg96JobValid(j)||!v||typeof cue.caption!=='string'||cue.caption.trim().length<3||cue.caption.length>600){if(tg96Job===j)tg96StopShow();return;}
 tg97CueRetry.delete(retryKey);tg96Mark(s.uid,intent.key);tg96Caption=cue.caption.trim();tg95PaintShow();
 const finish=()=>{if(tg96Job!==j)return;tg96StopShow();tg95PaintShow();};
 const effect=()=>{if(tg96Job!==j)return;clearTimeout(j.timer);try{j.audio?.pause();j.audio?.removeAttribute('src');j.audio?.load();}catch{}j.audio=null;if(!tg96JobValid(j)||!['battle_apuracao','battle_sorteio','battle_confronto','battle_final'].includes(intent.event)||studio.isUnlocked()!==true||!(studio.getPopVolume()>0)||document.body.classList.contains('effects-off')){finish();return;}tg96Caption='';try{const effectFile=({battle_apuracao:'./pop-suspense.wav',battle_sorteio:'./whoosh.mp3',battle_confronto:'./transition.mp3',battle_final:'./pop-vinheta.wav'})[intent.event];const clip=new Audio(new URL(effectFile,document.baseURI).href);j.audio=clip;j.kind='pop';clip.volume=studio.getPopVolume()/100;clip.onended=finish;clip.onerror=finish;j.timer=setTimeout(finish,7800);Promise.resolve(clip.play()).catch(finish);}catch{finish();}};
 if(studio.isUnlocked()!==true||!(studio.getVolume()>0)||document.body.classList.contains('tg93-voice-previews-off')){j.timer=setTimeout(finish,5500);return;}
 try{const clip=new Audio(new URL(v.file,document.baseURI).href);j.audio=clip;clip.volume=studio.getVolume()/100;const cut=studio.getTrimEnd?.(v.id);clip.ontimeupdate=()=>{if(!tg96JobValid(j)){if(tg96Job===j)finish();return;}if(Number.isFinite(cut)&&clip.currentTime>=cut)effect();};clip.onended=effect;clip.onerror=()=>{if(tg96Job===j){try{clip.pause();}catch{}j.audio=null;clearTimeout(j.timer);j.timer=setTimeout(finish,5000);}};j.timer=setTimeout(finish,Math.min(18000,Math.ceil((v.duration_seconds+3)*1000)));await clip.play();if(!tg96JobValid(j)){try{clip.pause();clip.removeAttribute('src');clip.load();}catch{}if(tg96Job===j)finish();}}catch{if(tg96Job===j){try{j.audio?.pause();}catch{}j.audio=null;clearTimeout(j.timer);j.timer=setTimeout(finish,5000);}}
}
function tg95PaintShow(){
 tg96GuardShow();const el=$('tg95-battle-show');if(!el)return;
 const guide=content.querySelector('[data-tg120-guide-line]');if(guide)guide.textContent=tg96Caption||guide.dataset.tg120GuideLine;const live=dialog.open&&online()&&approved()&&!!snap&&tab!=='seguranca'&&!!tg96Caption&&!guide;
 el.hidden=!live;if(!live)return;
 const cue=tg95ShowMoment(snap,voteFresh(),Date.now());
 const title=$('tg95-battle-moment'),line=$('tg95-battle-line');
 if(title.textContent!==cue.title)title.textContent=cue.title;const words=tg96Caption||cue.line;if(line.textContent!==words)line.textContent=words;
}
const stepLabels={inicio:'Bora de Batalha',elenco:'Camarim',playlist:'Escolher os hits',classificatoria:'Mostre seu gogó',chave:'Duelo de estrelas',votacao:'Hora das estrelas',premios:'Grande final',recuperacao:'Recuperação',seguranca:'Segurança'};
const journey=['inicio','elenco','playlist','classificatoria','chave','votacao','premios'];
function suggestedTab(s){
 if(!s?.festival)return 'inicio';
 const phase=s.festival.state;
 if(['completed','completed_no_champion','cancelled'].includes(phase))return 'premios';
 if(['intermission','technical_intermission'].includes(phase))return 'recuperacao';
 if((s.voting_windows||[]).some(w=>['open','paused','closed'].includes(w.state)&&!w.result_confirmed))return 'votacao';
 if(phase==='qualifying')return 'classificatoria';
 if(phase==='bracket')return 'chave';
 return 'elenco';
}
function stepButton(label,next){return '<button type="button" class="tg75-button tg113-step-button" data-tg113-step="'+esc(next)+'">'+esc(label)+'</button>';}
function syncMenu(){const b=$('tg113-battle-menu'),nav=$('tg113-battle-tabs');if(!b||!nav)return;b.hidden=online()&&!!snap&&!ctrl()&&!owner();if(b.hidden)menuOpen=false;nav.hidden=!menuOpen;b.setAttribute('aria-expanded',String(menuOpen));b.textContent=menuOpen?'✕ Etapas':'☰ Etapas';}
function tg115Guide(voter){
 if(['recuperacao','seguranca'].includes(tab))return '';
 let line='',action='';
 if(!online())line='O show precisa de conexão. Confira a internet para continuar de verdade.';
 else if(voter)line=me()?.status==='pending'?'Você chegou! Aguarde o anfitrião confirmar sua entrada.':'A hora do seu voto chega quando a produção liberar. Fica de olho!';
 else if(tab==='inicio'){line=snap?'Vamos continuar de onde paramos?':'Dê um nome à sua Batalha e chame a galera!';if(snap)action=stepButton('Continuar',suggestedTab(snap));}
 else if(tab==='elenco'){const pending=(snap?.members||[]).filter(m=>m.status==='pending').length,n=(snap?.members||[]).filter(m=>m.status==='approved'&&m.is_competitor).length;line=state()==='draft'?'Primeiro, abra as inscrições para convidar a galera!':pending?'Olha quem chegou! Aprove ou recuse '+pending+' pedido(s) no camarim.':n<2?'Temos '+n+' cantor(es). Convide a galera e aprove pelo menos dois. Se quiser cantar, inscreva-se também!':'Já temos '+n+' cantores. Agora vamos escolher os hits dos duelos!';if(ctrl()&&state()==='registration'&&n>=2)action=stepButton('Continuar · Músicas','playlist');}
 else if(tab==='playlist'){line=ctrl()?playlistProgress():'Escolha seu hit individual para a primeira rodada.';}
 else if(tab==='classificatoria')line=ctrl()&&!ctx()?.getCompetitiveRoom?.()?.reserved?'Agora abra o palco da própria Batalha para preparar áudio, microfones e apresentações.':ownCompetitor()&&!music?.my_choice?'Escolha seu hit individual antes de cantar!':'Mostra seu gogó! Confira a faixa confirmada e prepare a apresentação.';
 else if(tab==='chave')line='Chegou a hora do duelo! Acompanhe o confronto e os resultados confirmados.';
 else if(tab==='votacao')line='É hora das estrelas! Só vote quando a cédula estiver liberada para você.';
 else if(tab==='premios')line='Vamos conferir o resultado oficial? O pódio depende das etapas confirmadas.';
 return line?'<aside class="tg115-diva-guide"><img src="./diva-busto.png" alt=""><div class="tg115-bubble"><strong>Diva Gogó</strong><p data-tg120-guide-line="'+esc(line)+'">'+esc(line)+'</p>'+action+'</div></aside>':'';
}
function journeyHeader(voter){const i=journey.indexOf(tab);const previous=i>0?journey[i-1]:null;const suggested=suggestedTab(snap);const back=voter?(tab==='votacao'?stepButton('← Festival','inicio'):''):(previous&&snap?stepButton('← '+stepLabels[previous],previous):tab!=='inicio'?stepButton('← Festival','inicio'):'');
 return '<section class="tg113-journey"><div class="tg113-step-top"><span>'+esc(voter?'Sua participação':i>=0?'Etapa '+(i+1)+' de '+journey.length:'Opções do festival')+'</span>'+back+'</div><h3 id="tg113-step-heading">'+esc(stepLabels[tab]||'Festival')+'</h3>'+(!voter&&i>=0?'<progress max="'+journey.length+'" value="'+(i+1)+'" aria-label="Etapa atual"></progress>':'')+(!voter&&snap&&suggested!==tab&&!(state()==='registration'&&['elenco','playlist'].includes(tab))?stepButton('Ir para etapa atual: '+stepLabels[suggested],suggested):'')+'</section>';}
function stageCard(){if(!ctrl()||!snap||!['draft','registration','qualifying','bracket','intermission','technical_intermission'].includes(state()))return '';
 const room=ctx()?.getCompetitiveRoom?.(),rooms=(snap.reserved_rooms||[]).filter(r=>r.status==='open'&&r.owner_is_controller===true),existing=rooms[0];
 if(room?.reserved&&rooms.some(r=>r.id===room.id))return card('Palco da Batalha',empty('A mesma Batalha, com a tela de canto, microfones e fila.')+'<button type="button" class="tg75-button" data-tg113-stage-back>Voltar ao palco</button>');
 if(ctx()?.getRoomId())return card('Palco competitivo',empty('Volte ao menu principal para abrir o palco deste festival. Nenhuma sala em uso será convertida.'));
 return card('Palco da Batalha',empty(existing?'Retome o palco deste festival.':'Ative a tela de canto e os microfones deste festival. Não é uma segunda festa.')+btn(existing?'Retomar palco':'Abrir palco da Batalha','open_competitive_stage',{room_id:existing?.id||null},'local'));
}

function tg120Wait(title,line,extra=''){return '<section class="tg120-wait"><img src="./diva-busto.png" alt="Diva Gogó"><h3 id="tg113-step-heading">'+esc(title)+'</h3><p>'+esc(line)+'</p>'+extra+'</section>';}
function tg120Participant(){
 const m=me();if(!m||m.status==='pending')return tg120Wait('Você chegou!','Aguarde a produção confirmar sua entrada.');
 if(m.status!=='approved')return tg120Wait('Entrada não confirmada','Converse com o anfitrião.');
 if(!voteFresh())return tg120Wait('Aguarde um instante','Estamos conferindo a conexão.');
 const w=(snap.voting_windows||[]).find(w=>['open','paused','closed'].includes(w.state)&&!w.result_confirmed);
 if(['intermission','technical_intermission'].includes(state())&&(snap.permissions?.delegate_nominee||snap.permissions?.delegate_accepted||snap.recovery?.active_request?.my_eligible||snap.reentry?.state==='open'))return recovery();
 if(w){if(w.state==='open'&&w.eligible&&!w.my_ballot_submitted&&Date.parse(w.deadline_at)>Date.now())return '<section class="tg120-wait"><h3 id="tg113-step-heading">Hora das estrelas!</h3><div class="tg75-timer" data-deadline="'+esc(w.deadline_at)+'">'+remaining(w.deadline_at)+'</div><form data-vote="'+esc(w.id)+'">'+stars('stars_a',w.name_a)+(w.has_b?stars('stars_b',w.name_b):'')+'<button class="tg75-button">Confirmar meu voto</button></form></section>';return tg120Wait(w.my_ballot_submitted?'Voto registrado!':'Aguarde a apuração','Segura essa ansiedade, meu amor! O resultado vem aí.');}
 if(['completed','completed_no_champion','cancelled'].includes(state()))return premios();
 if(ownCompetitor()){
  const mine=(snap.matches||[]).find(x=>['ready','singing'].includes(x.state)&&[x.contestant_a_member_id,x.contestant_b_member_id].includes(m.id));
  if(mine&&mine.state==='singing')return tg120Wait('É sua vez!','Use o microfone no palco autorizado e acompanhe a letra.',mediaFor(mine)?empty(mediaFor(mine).title):'');
  if(['registration','qualifying'].includes(state())&&mediaReady()&&(!music.my_choice||musicDraft))return '<h3 id="tg113-step-heading">Qual é o seu hit?</h3>'+musicPersonal();
  return tg120Wait(mine?'Prepare seu gogó!':'Se aqueça!',mine?'Aguarde a chamada para a sua apresentação.':'A Diva vai chamar você na sua vez.',(music?.my_choice?empty('Seu hit: '+music.my_choice.title):'')+(personalEdit()&&music?.my_choice?btn('Alterar minha música','music_edit_choice',{},'local'):''));
 }
 return tg120Wait(['qualifying','bracket'].includes(state())?'Acompanhe o espetáculo!':'O show vai começar!','Pega sua bebida favorita e prepara as estrelas! Avisaremos quando for a hora de votar.');
}
let tg120SceneKey='',tg120Scene=null;
function tg120ClearScene(){tg120Scene?.remove();tg120Scene=null;tg120SceneKey='';}
function tg120Avatar(name,id){const m=(snap?.members||[]).find(m=>m.id===id),key=m?.avatar_key;const avatars={urbano:'cantor-urbano.png',esporte:'cantor-esporte.png',ruiva:'cantora-ruiva.png',oculos:'cantora-oculos.png'},file=Object.hasOwn(avatars,key)?avatars[key]:null;return '<div class="tg120-fighter">'+(file?'<img src="./'+file+'" alt="">':'<span class="tg120-avatar">'+esc(String(name||'?').slice(0,1))+'</span>')+'<strong>'+esc(name||'A definir')+'</strong></div>';}

/* Read-only seeded bracket. The layout mirrors SQL10; actual match names/results are always server-sourced. */
function tg120Bracket(){
 const matches=(snap?.matches||[]).filter(m=>m.kind!=='qualifier'),n=snap?.festival?.participants_count;
 if(!matches.length)return '';
 const fallback=()=>'<div class="tg120-bracket">'+matches.map(m=>'<article><small>'+esc(({final:'Final',bronze:'Bronze'})[m.kind]||'Duelo')+'</small><div>'+esc(m.name_a||'A definir')+'</div><div>'+esc(m.name_b||'A definir')+'</div>'+(['completed','resolved'].includes(m.state)&&m.winner_name?'<strong>★ '+esc(m.winner_name)+'</strong>':'<small>Aguardando resultado</small>')+'</article>').join('')+'</div>';
 if(!Number.isInteger(n)||n<2||n>12||!window.TGBattleCore?.layout)return fallback();
 let plan;try{plan=window.TGBattleCore.layout(n);}catch{return fallback();}
 const byKey=new Map(matches.filter(m=>typeof m.fixture_key==='string').map(m=>[m.fixture_key,m]));
 if(byKey.size!==matches.length||matches.some(m=>!plan.fixtures.some(f=>f.key===m.fixture_key&&f.round===m.round&&f.pair===m.pair)))return fallback();
 const seeds=new Map();for(const m of snap.matches||[]){for(const [seed,name] of [[m.seed_a,m.name_a],[m.seed_b,m.name_b]])if(Number.isInteger(seed)&&seed>=1&&seed<=n&&name){if(seeds.has(seed)&&seeds.get(seed)!==name)return fallback();seeds.set(seed,name);}}
 const roundName=r=>r===plan.rounds?'Final':r===plan.rounds-1?'Semifinais':r===plan.rounds-2?'Quartas':'Preliminares';
 const pos=f=>({x:12+(f.round-1)*232,y:40+(f.pair-.5)*Math.pow(2,f.round-1)*88-36});
 const nodes=plan.fixtures.filter(f=>f.kind!=='bronze'),w=plan.rounds*232+8,h=plan.bracket_size*44+58;
 const sourceText=src=>src.kind==='seed'?(seeds.get(src.seed_no)||'Classificado '+src.seed_no):'A definir';
 const connectors=nodes.flatMap(f=>[f.left,f.right].filter(src=>src.kind==='winner').map(src=>{const prior=nodes.find(x=>x.key===src.fixture);if(!prior)return '';const a=pos(prior),b=pos(f),x=a.x+210,y=a.y+36;return '<path d="M'+x+' '+y+' H'+(x+11)+' V'+(b.y+36)+' H'+b.x+'" fill="none" stroke="#b57ad4" stroke-width="2"/>';})).join('');
 const shorten=name=>Array.from(String(name||'A definir')).slice(0,19).join('')+(Array.from(String(name||'')).length>19?'…':'');
 const cards=nodes.map(f=>{const m=byKey.get(f.key),{x,y}=pos(f),done=m&&['completed','resolved'].includes(m.state)&&m.winner_name,names=[m?.name_a||sourceText(f.left),m?.name_b||sourceText(f.right)];return '<g><rect x="'+x+'" y="'+y+'" width="210" height="72" rx="9" fill="#342145" stroke="'+(m?.state==='singing'?'#f3a2e7':done?'#e9bd69':'#8e61aa')+'" stroke-width="2"/>'+names.map((name,i)=>'<g><title>'+esc(name)+'</title><rect x="'+(x+5)+'" y="'+(y+5+i*31)+'" width="200" height="29" rx="5" fill="'+(done&&names[0]!==names[1]&&name===m.winner_name?'#78532e':'#291b3a')+'"/><text x="'+(x+14)+'" y="'+(y+25+i*31)+'" font-size="15" fill="#fff">'+esc(shorten(name))+'</text>'+(done&&names[0]!==names[1]&&name===m.winner_name?'<text x="'+(x+194)+'" y="'+(y+25+i*31)+'" fill="#ffe09d" text-anchor="end">★</text>':'')+'</g>').join('')+'</g>';}).join('');
 const headers=Array.from({length:plan.rounds},(_,i)=>'<text x="'+(12+i*232)+'" y="21" fill="#efcafb" font-weight="700" font-size="15">'+esc(roundName(i+1))+'</text>').join('');
 const bronze=plan.fixtures.find(f=>f.kind==='bronze'),bm=bronze?byKey.get(bronze.key):null;
 return '<div class="tg120-tree-scroll"><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Chave de duelos" style="min-width:'+Math.max(320,w)+'px">'+headers+connectors+cards+'</svg></div>'+(bronze?'<div class="tg120-bronze"><strong>Disputa pelo bronze</strong><p>'+esc(bm?.name_a||'A definir')+' × '+esc(bm?.name_b||'A definir')+'</p>'+((bm&&['completed','resolved'].includes(bm.state)&&bm.winner_name)?'<strong>🥉 '+esc(bm.winner_name)+'</strong>':'')+'</div>':'')+'<small>Vagas futuras são preenchidas somente pelos confrontos confirmados.</small>';
}

function tg120PaintScene(){
 if(!voteFresh()){tg120ClearScene();return;}const matches=snap.matches||[],active=matches.filter(m=>m.state==='singing'),w=(snap.voting_windows||[]).find(w=>['open','paused','closed'].includes(w.state)&&!w.result_confirmed),ready=matches.filter(m=>m.state==='ready'),last=matches.filter(m=>['completed','resolved'].includes(m.state)&&m.winner_name).at(-1),pod=snap.festival_podium;
 if(active.length){tg120ClearScene();return;}let key='',html='';
 if(pod?.status==='awarded'){key='podium:'+JSON.stringify([pod.gold,pod.silver,pod.bronze]);html='<h3>Grande premiação</h3><div class="tg120-podium">'+[['🥈',pod.silver],['🥇',pod.gold],...(pod.bronze||[]).map(n=>['🥉',n])].filter(x=>x[1]).map(([medal,name])=>'<div><b>'+medal+'</b><strong>'+esc(name)+'</strong></div>').join('')+'</div>';}
 else if(w){key='vote:'+w.id+':'+w.state;html='<h3>'+ (w.state==='open'?'Hora das estrelas!':w.state==='paused'?'Votação pausada':'E quem vai avançar?')+'</h3><p>'+esc(w.name_a||'')+(w.has_b?' × '+esc(w.name_b||''):'')+'</p>';}
 else if(ready.length===1){const m=ready[0],z=mediaFor(m);key='ready:'+m.id+':'+m.attempt_no+':'+(z?.video_id||'');html='<small>'+esc(({final:'Grande final',bronze:'Disputa pelo bronze',qualifier:'Classificatória'})[m.kind]||'Duelo de estrelas')+'</small><div class="tg120-versus">'+tg120Avatar(m.name_a,m.contestant_a_member_id)+(m.contestant_b_member_id?'<b>VS</b>'+tg120Avatar(m.name_b,m.contestant_b_member_id):'')+'</div>'+(z?'<div class="tg120-hit"><small>'+ (m.kind==='qualifier'?'O hit escolhido é…':'O hit sorteado é…')+'</small><h3>'+esc(z.title)+'</h3></div>':'');}
 else if(last){key='result:'+last.id+':'+last.attempt_no+':'+last.winner_name;html='<small>Resultado confirmado · E quem avança é…</small><div class="tg120-winner"><h3>'+esc(last.winner_name)+'!</h3><p>Uma estrela avançou!</p></div>';}
 const duels=matches.filter(m=>m.kind!=='qualifier');if(duels.length)html+='<details class="tg120-grid" '+(tab==='chave'?'open':'')+'><summary>Chave da Batalha</summary>'+tg120Bracket()+'</details>';
 if(!html){tg120ClearScene();return;}key=festivalId+':'+key+':'+JSON.stringify(duels.map(m=>[m.id,m.state,m.winner_name]));if(tg120SceneKey===key&&tg120Scene?.isConnected)return;tg120ClearScene();tg120SceneKey=key;tg120Scene=document.createElement('section');tg120Scene.className='tg120-cinema';tg120Scene.setAttribute('aria-label','Espetáculo da Batalha');tg120Scene.innerHTML=html;content.before(tg120Scene);
}


/* R120 — one visible step, legacy recovery and integrity routes remain available in Etapas. */
let tg121Personal=false,tg121Review=false,tg121SeenPhase=null;
const tg121Terminal=m=>['completed','resolved','cancelled'].includes(m.state);
const tg121H=(title,subtitle='')=>'<header class="tg121-heading"><small>Tem Gogó · '+esc(snap?.festival?.title||'Batalha de Estrelas')+'</small><h2 id="tg113-step-heading">'+esc(title)+'</h2>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</header>';
const tg121Diva=line=>'<aside class="tg115-diva-guide"><img src="./diva-busto.png" alt=""><div class="tg115-bubble"><strong>Diva Gogó</strong><p data-tg120-guide-line="'+esc(line)+'">'+esc(line)+'</p></div></aside>';
const tg121Next=(label,action,p={},kind='execute',disabled=false)=>'<div class="tg121-next">'+btn(label,action,p,kind,disabled)+'</div>';
const tg121Details=(label,html)=>html?'<details class="tg121-secondary"><summary>'+esc(label)+'</summary>'+html+'</details>':'';
function tg121Entry(){
 if(entryChoice==='create')return tg121H('Qual vai ser o nome do show?')+tg121Diva('Hoje é dia de brilhar! Vamos dar um nome ao nosso espetáculo.')+'<form class="tg121-form" id="tg08-create"><label>Nome da Batalha<input name="title" minlength="3" maxlength="120" required placeholder="Minha Batalha"></label><button class="tg75-button" '+(!online()?'disabled':'')+'>Criar Batalha</button></form>'+choice('← Voltar','list');
 if(entryChoice==='list')return tg121H('Minhas Batalhas')+((festivals||[]).length?festivals.map(x=>'<div class="tg121-row"><strong>'+esc(x.title)+'</strong><small>'+esc(tg115PhaseLabels[x.state]||'Consultar')+'</small>'+btn('Abrir','select',{id:x.id},'local')+'</div>').join(''):empty('Nenhuma Batalha disponível.'))+choice('Criar Batalha','create')+choice('Entrar com convite','join');
 return tg121H('Batalha de Estrelas')+tg121Diva('O palco é de vocês!')+'<div class="tg121-home">'+choice('Criar minha Batalha','create')+choice('Entrar com convite','join')+choice('Minhas Batalhas','list')+'</div>';
}
function tg121Camarim(){
 const members=snap.members||[],approved=members.filter(m=>m.status==='approved'),pending=members.filter(m=>m.status==='pending'),n=approved.filter(m=>m.is_competitor).length;
 if(state()==='draft')return tg121H('Chame a galera!')+tg121Diva('Abra o camarim e convide suas estrelas.')+tg121Next('Abrir camarim','open_registration',F());
 const member=m=>'<div class="tg121-row"><span>'+ (m.is_competitor?'🎤':'⭐')+'</span><strong>'+esc(m.display_name)+'</strong><small>'+esc(m.is_competitor?'Cantor':'Plateia')+'</small></div>';
 const pendingHtml=pending.map(m=>'<article class="tg121-request"><strong>'+esc(m.display_name)+'</strong><div>'+((m.account_kind==='permanent'&&state()==='registration')?btn('Cantor','access_decision',{...F(),member_id:m.id,decision:'competitor'},'access'):'')+btn('Votante','access_decision',{...F(),member_id:m.id,decision:'voter'},'access')+btn('Recusar','access_decision',{...F(),member_id:m.id,decision:'refused'},'access')+'</div></article>').join('');
 return tg121H('Todo mundo no camarim!')+tg121Diva(pending.length?'Olha quem chegou! Escolha como cada pessoa vai participar.':n<2?'Precisamos de pelo menos duas estrelas para cantar.':'Já temos estrelas para o show!')+'<div class="tg121-counts"><div><b>'+n+'</b><small>Cantores</small></div><div><b>'+approved.filter(m=>!m.is_competitor).length+'</b><small>Plateia e produção</small></div></div><button class="tg75-button tg121-invite" type="button" data-tg115b-invite>🎟️ Mostrar convite QR</button>'+ (pending.length?'<section><h3>Pedidos de entrada ('+pending.length+')</h3>'+pendingHtml+'</section>':empty('Nenhum pedido pendente.'))+tg121Details('Quem já chegou',approved.map(member).join(''))+(me()?.is_competitor?empty('Você também vai cantar.'):btn('Também vou cantar','host_competes',F()))+'<div class="tg121-next">'+(n>=2&&!pending.length?stepButton('Continuar · Músicas','playlist'):empty(n<2?'Aguardando mais cantores.':'Confira os pedidos antes de continuar.'))+'</div>';
}
function tg121Playlist(){
 if(!mediaReady())return tg121H('Escolher os hits')+tg121Diva('Aguarde a confirmação do acervo.');
 const n=music.approved_competitors,min=n>=2?window.TGBattleCore.shape(n).minimum_playlist_songs:0,available=music.tracks.filter(t=>t.available).length;
 return tg121H('Escolher os hits')+tg121Diva('Escolha as músicas dos duelos. Você pode usar suas favoritas!')+'<div class="tg121-counts"><div><b>'+available+'</b><small>Disponíveis</small></div><div><b>'+min+'</b><small>Mínimo</small></div></div>'+(musicEdit()&&n>=2?'<div class="tg121-actions">'+btn('Montar playlist sugerida','music_suggest',{},'local')+(musicFavoritesReady&&musicFavorites.size?btn('Usar minhas favoritas','music_suggest',{favorites:true},'local'):'')+'</div>':'')+musicPicker('add')+tg121Details('Minha seleção · '+music.tracks.length,music.tracks.map(t=>'<div class="tg121-row"><strong>'+esc(t.title)+'</strong>'+(!t.available?'<small>Indisponível</small>':'')+(musicEdit()?btn('Remover','music_remove',{video_id:t.video_id},'local'):'')+'</div>').join(''))+empty(playlistProgress())+tg121Next('Continuar · Conferir prontidão','review_ready',{},'local',!musicCanLock());
}
function tg121Readiness(){
 const people=(snap?.members||[]).filter(m=>m.status==='approved'&&m.is_competitor),choices=music?.choices||[],ready=people.filter(m=>choices.some(c=>c.member_id===m.id)).length;
 return tg121H('Vamos começar o show?')+tg121Diva(ready===people.length?'Tudo pronto, meu amor!':'Cada estrela está escolhendo seu hit individual.')+'<div class="tg121-counts"><div><b>'+ready+'/'+people.length+'</b><small>Músicas individuais</small></div><div><b>'+ (music?.tracks?.filter(t=>t.available).length||0)+'</b><small>Hits dos duelos</small></div></div>'+people.map(m=>'<div class="tg121-row"><strong>'+esc(m.display_name)+'</strong><small>'+ (choices.some(c=>c.member_id===m.id)?'✓ Confirmada':'Escolhendo')+'</small></div>').join('')+(ownCompetitor()&&!music?.my_choice?btn('Escolher minha música','personal_view',{},'local'):'')+tg121Next('Iniciar classificatória','lock_roster',F(),'execute',!(musicCanLock()&&people.length>=2&&ready===people.length&&!(snap?.members||[]).some(m=>m.status==='pending')));
}

function tg121Performance(m){
 const binding=(snap?.bindings||[]).find(b=>b.match_id===m.id&&b.attempt_no===m.attempt_no),z=mediaFor(m),live=ctx()?.getBattlePerformance?.(),room=ctx()?.getCompetitiveRoom?.();
 const status=({ready:'Preparando',singing:'No palco',result_pending:'Aguardando avaliação',voting:'Votação',postponed:'Pausado'})[m.state]||'Aguardando';
 let primary='';
 if(m.state==='postponed'&&binding?.state==='invalidated')primary=tg121Next('Preparar nova tentativa','retry_invalidated',{binding_id:binding.id,_match:m.id,_attempt:m.attempt_no});
 else if(m.state==='result_pending'&&binding?.state==='captured')primary=tg121Next('Abrir votação','open_vote',{...F(),match_id:m.id,_attempt:m.attempt_no,_binding:binding.id});
 else if(m.state==='singing'&&binding?.state==='bound')primary=tg121Next('Confirmar avaliação após o canto','capture_performance',{binding_id:binding.id,_match:m.id,_attempt:m.attempt_no},'execute',!!live);
 else if(m.state==='ready'&&!z)primary=tg121Next(m.kind==='qualifier'?'Confirmar hit individual':'Sortear o hit','music_resolve',{match_id:m.id,attempt_no:m.attempt_no},'local');
 else if(m.state==='ready'&&z&&!binding&&live&&z.song_id===live.song_id&&z.room_id===live.room_id)primary=tg121Next('Confirmar apresentação em andamento','bind_live',{match_id:m.id,_attempt:m.attempt_no,_room:live.room_id,_song:live.song_id},'local');
 else if(m.state==='ready'&&z&&!z.song_id){const qs=queuedFor(m,z);primary=qs.length?tg121Next('Preparar música','music_prepare',{match_id:m.id,attempt_no:m.attempt_no,room_id:qs[0].room_id,song_id:qs[0].id},'local'):empty('A faixa está definida. Prepare a música e os cantores no palco.');}
 const stage=room?.reserved?'<button type="button" class="tg75-button tg121-stage-link" data-tg113-stage-back>Voltar à telona</button>':'';
 return '<section class="tg121-performance"><small>'+esc(status)+'</small><h3>'+esc(m.name_a||'A definir')+(m.name_b?' × '+esc(m.name_b):'')+'</h3>'+(z?'<p>♫ '+esc(z.title)+'</p>':'')+primary+stage+tg121Details('Ações da apresentação',matchRow(m))+'</section>';
}

function tg121Match(qualifier){
 const ms=(snap?.matches||[]).filter(m=>qualifier?m.kind==='qualifier':m.kind!=='qualifier'),active=ms.filter(m=>['singing','result_pending','voting','postponed'].includes(m.state)),next=ms.find(m=>m.state==='ready'),m=active[0]||next,room=ctx()?.getCompetitiveRoom?.();
 if(!voteFresh())return tg121H('Aguarde um instante')+tg121Diva('Estamos confirmando a conexão.');
 let html=tg121H(qualifier?'Classificatória':'Duelo de estrelas');
 if(!room?.reserved)return html+tg121Diva('Vamos preparar o palco para cantar.')+stageCard();
 if(m){html+=tg121Diva(m.state==='singing'?'A estrela está no palco!':'Vamos preparar a próxima apresentação.');html+=tg121Performance(m);}
 else if(snap?.active_stage_order!=null)html+=tg121Diva('Apresentações concluídas. Confira a etapa.')+tg121Next('Concluir etapa','complete_stage',{...F(),stage_order:snap.active_stage_order});
 else if(snap?.next_stage_order!=null)html+=tg121Diva('Preparados para a próxima etapa?')+tg121Next('Preparar próxima etapa','prepare_stage',{...F(),stage_order:snap.next_stage_order});
 else html+=tg121Diva(qualifier?'Vamos descobrir a classificação!':'Vamos conferir o resultado oficial!')+tg121Next(qualifier?'Revelar classificação':'Confirmar chave',qualifier?'freeze_seeds':'freeze_bracket',F());
 if(ms.length)html+=tg121Details('Apresentações e resultados',ms.filter(x=>x.id!==m?.id).map(matchRow).join(''));
 return html+tg121Details('Opções avançadas',matchScreen(qualifier));
}
function tg121Host(){
 if(!snap)return tg121Entry();
 if(!voteFresh())return tg121H('Aguarde um instante')+tg121Diva('Estamos conferindo a conexão com a Batalha.');
 if(tg121Personal&&approved())return tg120Participant();
 if(['recuperacao','seguranca'].includes(tab))return tg121H(stepLabels[tab])+screens[tab]();
 if(tab==='inicio')return tg121H('Minha Batalha')+tg121Next('Continuar de onde parei','current_step',{},'local')+tg121Details('Pausa, saída e encerramento',inicio());
 if(tab==='elenco')return tg121Camarim();
 if(tab==='playlist')return tg121Review?tg121Readiness():tg121Playlist();
 if(tab==='classificatoria'||tab==='chave')return tg121Match(tab==='classificatoria');
 if(tab==='votacao')return tg121H('Hora das estrelas!')+tg121Diva('A galera está votando. Vamos aguardar a apuração!')+votacao();
 return tg121H('Grande premiação')+premios();
}
function tg121Paint(){
 const live=online(),controller=live&&!!snap&&ctrl(),ownerOnly=live&&!!snap&&owner()&&!ctrl(),participant=live&&!!snap&&!controller&&!ownerOnly;
 dialog.dataset.tg121=live?'journey':'preview';dialog.dataset.tg33Mode=live?'live':'preview';dialog.dataset.tg62Audience=participant&&voterView()?((ctx()?.getUser()?.is_anonymous===true||ctx()?.getUser()?.app_metadata?.provider==='anonymous')?'temporary':'account'):'';
 const phase=state(),w=(snap?.voting_windows||[]).find(w=>['open','paused','closed'].includes(w.state)&&!w.result_confirmed),key=phase+':'+(w?.id||'')+':'+(w?.state||'');
 if(snap&&controller&&tg121SeenPhase!==key){if(tg121SeenPhase!==null&&phase!=='registration'){tab=suggestedTab(snap);tg121Review=false;}tg121SeenPhase=key;}
 if(participant)tab=suggestedTab(snap);
 if(ownerOnly&&!['recuperacao','seguranca'].includes(tab)&&!tg121Personal)tab='recuperacao';
 const tabs=$('tg113-battle-tabs'),menu=$('tg113-battle-menu');menu.hidden=participant||!snap;if(menu.hidden)menuOpen=false;tabs.hidden=!menuOpen;
 menu.setAttribute('aria-expanded',String(menuOpen));menu.textContent=menuOpen?'✕ Etapas':'☰ Etapas';
 const personal=controller&&!!me()&&me().status==='approved',nav=personal?'<nav class="tg121-personal-tabs" aria-label="Participação"><button type="button" class="tg75-button" data-action="production_view" data-kind="local" data-payload="{}" aria-pressed="'+(!tg121Personal)+'">Controle</button><button type="button" class="tg75-button" data-action="personal_view" data-kind="local" data-payload="{}" aria-pressed="'+tg121Personal+'">'+(ownCompetitor()?'Meu canto':'Meu voto')+'</button></nav>':'';
 const expanded=new Set([...content.querySelectorAll('details[open]')].map(x=>x.querySelector('summary')?.textContent).filter(Boolean));
 content.innerHTML=(live?(participant?tg120Participant():tg121Host()):previewScreen(tab))+nav;
 for(const d of content.querySelectorAll('details'))if(expanded.has(d.querySelector('summary')?.textContent))d.open=true;
 for(const b of tabs.querySelectorAll('[data-tg75-tab]')){const k=b.dataset.tg75Tab;b.hidden=participant||!snap||(!controller&&!['recuperacao','seguranca'].includes(k))||(controller&&(['draft','registration'].includes(state())?['classificatoria','chave','votacao','premios'].includes(k):['elenco','playlist'].includes(k)));b.setAttribute('aria-selected',String(k===tab));b.tabIndex=k===tab?0:-1;}
 content.setAttribute('aria-labelledby',content.querySelector('#tg113-step-heading')?'tg113-step-heading':'tg75-battle-title');
 $('tg75-battle-title').textContent='Batalha de Estrelas';$('tg63-voter-profile').hidden=true;
 if(controller&&!tg121Personal&&['classificatoria','chave','votacao','premios'].includes(tab))tg120PaintScene();else tg120ClearScene();
 dirty=false;tg95PaintShow();
}

function renderLegacy(){const oldInvite=content.querySelector('.tg115-invite[open]');const openInvite=oldInvite?.dataset.festival===festivalId;const live=online(),voter=voterView();dialog.dataset.tg33Mode=live?'live':'preview';dialog.dataset.tg62Audience=voter?((ctx()?.getUser()?.is_anonymous===true||ctx()?.getUser()?.app_metadata?.provider==='anonymous')?'temporary':'account'):'';const participant=live&&!!snap&&!ctrl()&&!owner()&&!!me();if(participant)tab=suggestedTab(snap);const profileButton=$('tg63-voter-profile');if(profileButton){profileButton.hidden=true;profileButton.disabled=voter&&(snap?.voting_windows||[]).some(w=>['open','paused'].includes(w.state)&&w.eligible===true&&w.my_ballot_submitted!==true);profileButton.title=profileButton.disabled?'Disponível depois de confirmar o voto.':'';}$('tg75-battle-title').textContent=voter?'Votação · Batalha de Estrelas':'Batalha de Estrelas';const stage=live&&!voter&&['classificatoria','chave'].includes(tab)?stageCard():'';const first=matchTab()&&!ctx()?.getCompetitiveRoom?.()?.reserved;content.innerHTML=participant?tg120Participant():journeyHeader(voter)+tg115Guide(voter)+(first?stage:'')+(live?screens[tab]():previewScreen(tab))+(first?'':stage);if(live&&snap&&ctrl()&&['classificatoria','chave','votacao','premios'].includes(tab))tg120PaintScene();else tg120ClearScene();if(openInvite){const invite=content.querySelector('.tg115-invite');if(invite&&invite.dataset.festival===festivalId)invite.open=true;}syncMenu();dialog.querySelectorAll('[data-tg75-tab]').forEach(b=>{b.hidden=participant;const active=b.dataset.tg75Tab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active)content.setAttribute('aria-labelledby',menuOpen?b.id:'tg113-step-heading');});dirty=false;tg95PaintShow();}
function render(){if(online()){tg121Paint();return;}renderLegacy();}
function selectTab(next){if(busy||!tabs.includes(next)||(online()&&snap&&!ctrl()&&!owner()))return false;if(tab!==next){resetMusicView();tg121Review=false;}tg121Personal=false;tab=next;factor=null;menuOpen=false;render();dialog.querySelector('.tg75-scroll')?.scrollTo({top:0,behavior:'instant'});return true;}
function clear(){tg121Personal=false;tg121Review=false;tg121SeenPhase=null;tg120ClearScene();entryChoice='';menuOpen=false;introShown=false;f03Cases.clear();tg96StopShow();tg97CueRetry.clear();musicReset();tg68Demo=tg68New();gen++;reloadSeq++;voteVerifiedAt=null;busy=false;lastPoll=0;lastHeartbeat=0;bridge.reset();festivalId=null;snap=null;festivals=[];cancelIntent=null;factor=null;uid=null;dirty=false;message('');}
async function reload({paint=true}={}){if(!online()){invalidateVote();return;}if(uid!==ctx()?.getUser()?.id){clear();render();return;}const t=gen,id=festivalId,ve=voteEpoch,seq=++reloadSeq,started=performance.now();const before=voteFingerprint(snap),matchBefore=matchFingerprint(snap),wasFresh=voteFresh();try{const list=await bridge.list();const next=id?await bridge.snapshot(id):null;let nextMusic=null;const nextCases=new Map();if(id&&next?.permissions?.controller===true){await Promise.all(f03Windows(next).map(async w=>{try{nextCases.set(w.id,await f03Read(w.id));}catch{}}));}if(id&&musicRole(next)){try{const d=await musicRPC('read',{},id);if(musicValid(d,next,id))nextMusic=d;}catch{nextMusic=null;}}if(t!==gen||id!==festivalId||uid!==ctx()?.getUser()?.id||ve!==voteEpoch||seq!==reloadSeq)return;if(performance.now()-started>12000){invalidateVote();return;}const wasVoter=voterView();festivals=list;snap=next;const changedCases=JSON.stringify([...f03Cases].sort())!==JSON.stringify([...nextCases].sort());f03Cases=nextCases;const changedMusic=JSON.stringify(music)!==JSON.stringify(nextMusic);music=nextMusic;if(!wasVoter&&voterView())tab='votacao';voteVerifiedAt=next&&navigator.onLine!==false?performance.now():null;if(cancelIntent&&(cancelIntent.festival!==festivalId||cancelIntent.version!==version()))cancelIntent=null;const criticalChange=(!!next&&!next.permissions?.controller&&!next.permissions?.owner&&(before!==voteFingerprint(next)||matchBefore!==matchFingerprint(next)||changedMusic))||(tab==='votacao'&&(!wasFresh||before!==voteFingerprint(next)||changedCases))||(matchTab()&&(!wasFresh||matchBefore!==matchFingerprint(next)||changedMusic));if(criticalChange){dirty=false;render();}else if(paint&&!dirty&&tab!=='seguranca')render();tg95PaintShow();}catch(e){if(t===gen&&id===festivalId&&seq===reloadSeq){invalidateVote();}throw e;}}
async function open(options={}){if(dialog.open&&options.festival){if(!online()||busy)return;festivalId=options.festival;await reload();tab=suggestedTab(snap);render();return;}if(dialog.open)return;if(window.TG115_UI?.enabled()&&!await window.TG115_UI.ensure())return;clear();const t=gen;uid=ctx()?.getUser()?.id;tab='inicio';dialog.showModal();render();try{await bridge.capabilities();if(t!==gen||!dialog.open)return;await reload();if(options.festival&&festivals.some(f=>f.id===options.festival)){festivalId=options.festival;await reload();tab=suggestedTab(snap);}const room=ctx()?.getCompetitiveRoom?.();if(t!==gen||!dialog.open)return;if(online()&&room?.reserved&&lastStage?.uid===uid&&lastStage.room===room.id&&festivals.some(f=>f.id===lastStage.festival)){festivalId=lastStage.festival;await reload();if(t!==gen||!dialog.open)return;if(snap?.reserved_rooms?.some(r=>r.id===room.id)){tab=suggestedTab(snap);}else{festivalId=null;snap=null;voteVerifiedAt=null;entryChoice='list';}}else if(room?.reserved)entryChoice='list';}catch(e){if(t===gen)message(e.message);}if(t!==gen||!dialog.open)return;render();if(!timer)timer=setInterval(tick,1000);if(options.intro===true&&online()&&!ctx()?.getRoomId()&&!festivalId&&safeGuide()){introShown=window.TG82_BATTLE_GUIDE?.open({fromPanel:true})===true;}}
function close(){if(dialog.open)dialog.close();}
function tick(){if(!dialog.open)return;tg95PaintShow();if(!busy)void tg96TryShow();if((uid!==null&&uid!==ctx()?.getUser()?.id)||(bridge.current().enabled&&!online())){clear();render();return;}if((tab==='votacao'||matchTab())&&voteVerifiedAt!==null&&!voteFresh())invalidateVote();dialog.querySelectorAll('[data-deadline]').forEach(e=>e.textContent=remaining(e.dataset.deadline));dialog.querySelectorAll('form[data-vote]').forEach(f=>{const w=(snap?.voting_windows||[]).find(x=>x.id===f.dataset.vote);const expired=!w||!Number.isFinite(Date.parse(w.deadline_at))||Date.now()>=Date.parse(w.deadline_at);if(expired){f.querySelectorAll('input,button').forEach(b=>b.disabled=true);}});if(!online()||busy)return;const now=Date.now();if(!musicLoaded&&now>=musicAutoAt&&content.querySelector('.tg120-categories')&&mediaReady()&&(musicEdit()||personalEdit())){musicAutoAt=now+15000;void invoke('music_search',searchPayload(0),'local');return;}if(now-lastPoll>=5000){lastPoll=now;const run=gen;busy=true;(async()=>{try{if(festivalId&&approved()&&now-lastHeartbeat>=20000){lastHeartbeat=now;await bridge.execute('heartbeat',F());}if(run===gen)await reload();}catch(e){if(run===gen){invalidateVote();message(e.message);}}finally{if(run===gen)busy=false;}})();}}
function payload(el){return JSON.parse(el.dataset.payload||'{}');}
const guideSeen=new Set();
function safeGuide(){return dialog.open&&!document.body.classList.contains('tg103-mic-focus')&&!document.body.classList.contains('tg103-remote-mic-focus')&&!document.body.classList.contains('tg18-singing')&&!(snap?.voting_windows||[]).some(w=>['open','paused'].includes(w.state))&&!(snap?.matches||[]).some(m=>m.state==='singing');}
function maybeGuide(){if(introShown||!online()||!voteFresh()||!safeGuide()||!['draft','registration'].includes(state())||!festivalId||!uid)return;const key=uid+':'+festivalId;if(guideSeen.has(key))return;try{if(sessionStorage.getItem('tg82-guide:'+key)==='1')return;}catch{}if(window.TG82_BATTLE_GUIDE?.open({fromPanel:true})){guideSeen.add(key);try{sessionStorage.setItem('tg82-guide:'+key,'1');}catch{}}}
async function invoke(action,p={},kind='execute',l=lease()){if(busy||!liveLease(l))return;if(window.TG115_UI?.enabled()&&action==='join'){message('Use o convite atualizado.');return;}if(action==='lock_roster'&&(!musicCanLock()||(tg121Review&&((snap?.members||[]).some(m=>m.status==='pending')||(snap?.members||[]).filter(m=>m.status==='approved'&&m.is_competitor).some(m=>!music?.choices?.some(c=>c.member_id===m.id)))))){message('Confira a playlist e o elenco antes de fechar.');return;}if(!mayVoteAction(action,p)){message('O estado da votação mudou. Atualize antes de confirmar.');return;}if(!mayMatchAction(action,p)){message('A apresentação ou tentativa mudou. Atualize antes de confirmar.');return;}const run=gen;busy=true;message('Verificando com o servidor…');try{let result;
 if(matchActions.has(action)){
  // Nova leitura antes da escrita; o banco ainda precisa rejeitar corridas entre RPCs.
  const seq=reloadSeq+1;
  await reload({paint:false});
  if(seq!==reloadSeq||!liveLease(l)||!mayMatchAction(action,p))throw Error('A apresentação ou tentativa mudou. Atualize antes de confirmar.');
  // Guardas locais não fazem parte da lista de argumentos públicos.
  if(action!=='bind_live'){p={...p};if(action==='open_vote'){p.expected_attempt=p._attempt;p.expected_binding_id=p._binding;}delete p._match;delete p._attempt;delete p._binding;}
 }

 if(kind==='incident'){
   const reason=String(p.reason??'').trim();if(reason.length<20||reason.length>500)throw Error('Informe uma justificativa de 20 a 500 caracteres.');p={...p,reason};
   if(!f03Allowed(action,p))throw Error('Incidente ou permissão mudou. Atualize antes de confirmar.');
   const fresh=await f03Read(p.window_id);
   if(!liveLease(l)||!f03Allowed(action,p,new Map([[p.window_id,fresh]])))throw Error('Incidente ou permissão mudou. Atualize antes de confirmar.');
   if(action==='authorize_full_revote'){
    result=await bridge.execute(action,{case_id:p.case_id,reason:p.reason});
    if(result?.authorized!==true||result?.source_window_id!==p.window_id||result?.original_ballots_preserved!==true||result?.new_performance_required!==true||result?.new_vote_required!==true)throw Error('Autorização não confirmada. Atualize antes de repetir.');
   }else{
    const payload=action==='report'?{window_id:p.window_id,reason:p.reason,evidence_reference:p.evidence_reference}:{case_id:p.case_id,reason:p.reason};
    const response=await ctx().getClient().rpc('tg57_f03_incident',{p_action:action,p_payload:payload});
    if(response.error)throw Error('Não foi possível concluir o incidente. Atualize e confira o estado.');
    result=response.data;
    if(action==='resume_recovered'){
     if(result?.resumed!==true||result?.voting_window_id!==p.window_id||result?.ballots_preserved!==true||result?.voter_snapshot_preserved!==true||!Number.isFinite(Date.parse(result.deadline_at)))throw Error('Retomada não confirmada. Atualize antes de repetir.');
    }else if(action==='report'?(result?.status!=='reported'||!api.UUID.test(result.case_id)):result?.pending_admin_review!==true)throw Error('Registro não confirmado. Atualize antes de repetir.');
   }
   if(!liveLease(l))return;
  }else if(kind==='local'){
   if(action==='review_ready'){if(!ctrl()||!musicCanLock())return;tg121Review=true;render();return;}
  if(action==='personal_view'||action==='production_view'){if(!ctrl()&&!owner())return;tg121Personal=action==='personal_view';resetMusicView();render();return;}
  if(action==='current_step'){if(!ctrl())return;tab=suggestedTab(snap);tg121Review=false;render();return;}
  if(action.startsWith('music_')){await musicAction(action,p,l);return;}
  if(action==='guide'){if(!safeGuide())throw Error('A apresentação não está disponível durante sua vez ou votação.');window.TG82_BATTLE_GUIDE?.open({fromPanel:true});return;}
  if(action==='select'){tg121Personal=false;tg121Review=false;tg121SeenPhase=null;f03Cases.clear();musicReset();festivalId=p.id;snap=null;voteVerifiedAt=null;cancelIntent=null;dirty=false;await reload();tab=suggestedTab(snap);render();return;}
  if(action==='refresh'){dirty=false;await reload();render();return;}
  if(action==='open_competitive_stage'){if(!ctrl()||!voteFresh()||!ctx()?.openCompetitiveStage||ctx()?.getRoomId())throw Error('Atualize o festival no menu principal.');const id=festivalId,room=p.room_id;if(room!==null&&!(snap?.reserved_rooms||[]).some(r=>r.id===room&&r.status==='open'&&r.owner_is_controller===true))throw Error('Palco não confirmado.');if(!await window.TG_UI.confirm(room?'Retome somente após fechar o palco anterior neste ou em outro aparelho.':'O palco desta Batalha ficará pronto para as apresentações e microfones. Não será criada outra Batalha.',{title:room?'Retomar palco':'Abrir palco da Batalha',confirmText:room?'Palco anterior fechado · Abrir':'Abrir palco'}))return;if(!liveLease(l)||!voteFresh())throw Error('Atualize o festival antes de abrir o palco.');window.TG74_DIVA_STUDIO?.unlock();const opened=await ctx().openCompetitiveStage(id,room,()=>liveLease(l));if(opened?.reserved!==true||!liveLease(l))return;lastStage={uid,room:opened.room_id,festival:id};close();return;}
  if(action==='reserve_room'){if(!ctrl()||!ctx()?.reserveCompetitiveRoom)throw Error('Abra o palco como anfitrião.');if(!await window.TG_UI.confirm('Este palco ficará permanentemente separado do placar recreativo. Reserve somente uma sala nova e vazia.',{title:'Reservar palco competitivo',confirmText:'Reservar',danger:true}))return;if(!liveLease(l))return;result=await ctx().reserveCompetitiveRoom(festivalId);}
  else if(action==='close_battle_room'){const room=(snap?.reserved_rooms||[]).find(r=>r.id===p.room_id&&r.status==='open'),f=festivalId,u=uid;if(!ctrl()||!room||!['completed','cancelled'].includes(state()))throw Error('Conclua o festival e selecione um palco reservado.');if(!await window.TG_UI.confirm('Encerrar o palco sem gerar placar recreativo? As notas técnicas e os troféus serão preservados.',{title:'Encerrar palco competitivo',confirmText:'Encerrar palco',danger:true}))return;if(!liveLease(l)||f!==festivalId||u!==ctx()?.getUser()?.id||!(snap?.reserved_rooms||[]).some(r=>r.id===room.id&&r.status==='open'))throw Error('Sessão ou palco alterado.');result=await bridge.closeRoom(room.id,f);try{if(ctx()?.getCompetitiveRoom?.()?.id===room.id)await ctx()?.refreshCompetitiveRoom?.(room.id);}catch{message('Palco encerrado no banco. Atualize a tela para sair.');return;}}
  else if(action==='bind_live'){const live=ctx()?.getBattlePerformance?.();if(!live||!ctrl())throw Error('Abra o palco como anfitrião e inicie a música correta antes de vincular.');const match=snap.matches.find(m=>m.id===p.match_id), expected=[match?.contestant_a_member_id,match?.contestant_b_member_id].filter(Boolean).map(id=>snap.members.find(m=>m.id===id)?.user_id);if(!match||expected.some(x=>!x)||expected.length!==live.singers.length||!expected.every(x=>live.singers.includes(x)))throw Error('Os cantores desta música não correspondem ao confronto.');result=await bridge.execute('bind_performance',{...F(),match_id:match.id,room_id:live.room_id,song_id:live.song_id,expected_attempt:match.attempt_no});}
  else if(action==='mfa_status'){message((await bridge.assurance())==='aal2'?'MFA validado nesta sessão.':'Sessão sem MFA validado.');return;}
  else if(action==='mfa_enroll'){factor=await bridge.enroll();if(tab!=='seguranca'||!dialog.open){factor=null;return;}renderMfa(factor.id,factor.secret);message('Adicione a chave no seu autenticador e valide o código.');return;}
  else if(action==='mfa_factors'){const fs=await bridge.factors();if(!fs.length)throw Error('Nenhum autenticador validado. Cadastre um primeiro.');factor=null;renderMfa(fs[0].id);message('Informe o código do autenticador.');return;}
  else throw Error('Ação local inválida');
 }else if(kind==='access'){if(!window.TG115_UI?.enabled()||!ctrl())throw Error('Ação indisponível.');result=await window.TG115_UI.decide(p.festival_id,p.member_id,p.decision);if(!liveLease(l))return;}else if(kind==='lifecycle'){const base=lifecyclePayload();if(action==='cancel_battle'){if(!cancelIntent||cancelIntent.festival!==festivalId||cancelIntent.version!==version()||cancelIntent.id!==p.confirmation_id)throw Error('Prepare novamente o encerramento.');p={...base,...p,ack:api.ACK[action]};}else p={...base,...p,...(api.ACK[action]?{ack:api.ACK[action]}:{})};result=await bridge.lifecycle(action,p);if(!liveLease(l))return;if(action==='prepare_cancel'&&result?.prepared===true)cancelIntent={id:result.confirmation_id,festival:festivalId,version:version()};else cancelIntent=null;}
 else {if(['resume_vote','commit_result','start_rematch'].includes(action)){const w=(snap?.voting_windows||[]).find(x=>x.id===p.window_id),c=await f03Read(p.window_id);if(!w||!liveLease(l)||!mayVoteAction(action,p)||!f03ContinuationAllowed(w,new Map([[p.window_id,c]])))throw Error('A situação do incidente mudou. Atualize antes de continuar.');}result=await bridge.execute(action,p);if(!liveLease(l))return;if(action==='create'&&typeof result==='string')festivalId=result;if(action==='join')festivalId=p.festival_id;}
 if(run!==gen||uid!==ctx()?.getUser()?.id||!dialog.open)return;if(action==='recovery_status'){message(`Confirmações: ${result.approved_confirmations}/${result.required_confirmations}; aviso verificado: ${result.notice_attested?'sim':'não'}; observação concluída: ${result.observation_finished?'sim':'não'}.`);}else message(action==='resume_recovered'?'Votação original retomada. Votos e eleitorado preservados.':'Solicitação confirmada pelo servidor.');dirty=false;await reload();if(['create','join','lock_roster','freeze_seeds','freeze_bracket','open_vote','save_battle','resume_battle','finalize_podium'].includes(action))tab=suggestedTab(snap);render();
 }catch(e){if(run===gen&&uid===ctx()?.getUser()?.id){if(kind==='incident'||voteActions.has(action)||matchActions.has(action))invalidateVote();message(e.message||'Ação não concluída.');}}finally{if(run===gen)busy=false;}}
function renderMfa(id,secret){const root=$('tg08-mfa');if(!root)return;root.innerHTML=`${secret?`<p>Chave de configuração (não compartilhe): <code>${esc(secret)}</code></p>`:''}<form id="tg08-mfa-form" data-factor="${esc(id)}"><label>Código de seis dígitos<input name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" maxlength="6" required></label><button class="tg75-button">Validar MFA</button></form>`;}
$('tg75-open-workspace')?.addEventListener('click',()=>{const g=$('tg70-battle-guide');if(g?.open)g.close();void open({intro:false});});$('tg08-stage-battle')?.addEventListener('click',()=>{if(ctx()?.getCompetitiveRoom?.()?.reserved===true)void open({intro:false});});$('tg75-battle-close')?.addEventListener('click',close);dialog.addEventListener('close',()=>{clearInterval(timer);timer=null;clear();tg95PaintShow();content.replaceChildren();});
dialog.querySelector('.tg75-tabs')?.addEventListener('keydown',e=>{const b=e.target.closest('[data-tg75-tab]');if(!b||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=tabs.indexOf(b.dataset.tg75Tab);if(i<0||busy)return;const j=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;if(selectTab(tabs[j]))content.focus({preventScroll:true});});
content.addEventListener('toggle',e=>{if(e.target.matches?.('.tg120-search'))musicSearchOpen=e.target.open;},true);content.addEventListener('input',()=>{dirty=true;});content.addEventListener('change',()=>{dirty=true;});
content.addEventListener('change',e=>{if(online()||dialog.dataset.tg33Mode!=='preview')return;const t=e.target,d=tg68Demo;if(t.matches('[data-tg68-count]')&&!d.locked){const n=Number(t.value);if(Number.isInteger(n)&&n>=2&&n<=12){d.n=n;render();}}else if(t.matches('[data-tg68-track]')&&!d.locked){const i=Number(t.dataset.tg68Track);if(Number.isInteger(i)&&i>=0&&i<13){if(t.checked)d.selected.add(i);else d.selected.delete(i);render();}}else if(t.matches('[data-tg68-personal]')&&d.locked){const v=t.value;if(v===''||(/^\d+$/.test(v)&&Number(v)<tg68Tracks.length)){d.personal=v;d.drawn=[];render();}}});
dialog.addEventListener('click',async e=>{if(e.target.closest('#tg113-battle-menu')){if(busy)return;menuOpen=!menuOpen;syncMenu();content.setAttribute('aria-labelledby',menuOpen?'tg33-tab-'+tab:'tg113-step-heading');return;}const step=e.target.closest('[data-tg113-step]');if(step){if(selectTab(step.dataset.tg113Step))content.focus({preventScroll:true});return;}const pick=e.target.closest('[data-tg113-choice]');if(pick){if(busy)return;const key=pick.dataset.tg113Choice;if(key==='reset'){f03Cases.clear();musicReset();reloadSeq++;festivalId=null;snap=null;voteVerifiedAt=null;cancelIntent=null;entryChoice='list';}else if(key==='join'&&window.TG115_UI?.enabled()){void window.TG115_UI.startInvite();return;}else if(['create','join','list'].includes(key))entryChoice=key;render();return;}if(e.target.closest('[data-tg113-stage-back]')){if(!busy&&ctx()?.getCompetitiveRoom?.()?.reserved===true&&snap?.reserved_rooms?.some(r=>r.id===ctx().getRoomId()&&r.status==='open'&&r.owner_is_controller===true)){lastStage={uid,room:ctx().getRoomId(),festival:festivalId};close();}return;}if(e.target.closest('[data-tg115b-invite]')){if(!busy&&ctrl()&&festivalId&&window.TG115_UI?.enabled()&&!(snap?.matches||[]).some(m=>m.state==='singing')){const p=state()==='registration'?'general':['qualifying','bracket'].includes(state())?'voter':null;if(p)void window.TG115_UI.showInvite(festivalId,p);}return;}if(e.target.closest('[data-tg113-copy]')){if(window.TG115_UI?.enabled())return;try{await navigator.clipboard.writeText(festivalId);message('Código copiado.');}catch{message('Selecione e copie o código exibido.');}return;}const mfa=e.target.closest('[data-preview-mfa]');if(mfa){void previewMfa(mfa.dataset.previewMfa);return;}const demoButton=e.target.closest('[data-tg68-lock],[data-tg68-reset],[data-tg68-draw]');if(demoButton){if(online()||dialog.dataset.tg33Mode!=='preview'||demoButton.disabled)return;const d=tg68Demo;if(demoButton.matches('[data-tg68-reset]'))tg68Demo=tg68New();else if(demoButton.matches('[data-tg68-lock]')){const min=tg68Minimum();if(!d.locked&&min!==null&&d.selected.size>=min)d.locked=true;}else if(demoButton.matches('[data-tg68-draw]')&&d.locked&&d.personal!==''){const remaining=[...d.selected].filter(x=>!d.drawn.includes(x));if(remaining.length)d.drawn.push(remaining[crypto.getRandomValues(new Uint32Array(1))[0]%remaining.length]);}render();return;}const profileButton=e.target.closest('#tg63-voter-profile');if(profileButton){if(!profileButton.disabled&&voterView()&&!busy&&uid===ctx()?.getUser()?.id){const user=ctx()?.getUser();if(user?.is_anonymous===true||user?.app_metadata?.provider==='anonymous')selectTab('inicio');else window.TG_BETA_OPEN_TAB?.('profile');}return;}if(e.target.closest('[data-r62-voter-back]')){if(!busy&&voterView()){musicReset();reloadSeq++;festivalId=null;snap=null;voteVerifiedAt=null;tab='inicio';render();}return;}const personal=e.target.closest('[data-tg77-go-personal]');if(personal){if(!busy&&online()&&ownCompetitor())selectTab('classificatoria');return;}const t=e.target.closest('[data-tg75-tab]');if(t){if(selectTab(t.dataset.tg75Tab))content.focus({preventScroll:true});return;}const b=e.target.closest('[data-action]');if(!b||b.disabled||busy)return;const name=b.dataset.action;let p=payload(b);const l=lease();if(api.MFA.has(name)&&!await window.TG_UI.confirm('Esta ação é crítica e ficará registrada. Confirma?',{title:'Confirmação de segurança',confirmText:'Confirmar',danger:true}))return;if(!liveLease(l)||!b.isConnected)return;void invoke(name,p,b.dataset.kind,l);});
content.addEventListener('submit',async e=>{e.preventDefault();const f=e.target;if(f.id==='tg08-mfa-form'&&!online()){void previewMfa('verify',f);return;}if(busy||!online())return;const d=new FormData(f);if(f.id==='tg74-music-search')return void invoke('music_search',searchPayload(0,musicCategory,String(d.get('query')||'')),'local');if(f.id==='tg08-create')return void invoke('create',{title:d.get('title')});if(f.id==='tg08-join')return void invoke('join',{festival_id:d.get('festival_id'),name:d.get('name'),role:d.get('role')});if(f.dataset.vote)return void invoke('cast_vote',{window_id:f.dataset.vote,stars_a:Number(d.get('stars_a')),stars_b:d.has('stars_b')?Number(d.get('stars_b')):null});if(f.id==='tg08-mfa-form'){busy=true;try{const level=await bridge.verify(f.dataset.factor,String(d.get('code')));factor=null;render();message(level==='aal2'?'MFA validado com sucesso.':'Validação pendente.');}catch(err){message(err.message);}finally{busy=false;}return;}if(f.dataset.reasonAction){const name=f.dataset.reasonAction,p={...payload(f),reason:String(d.get('reason')||'')},l=lease();if(f.dataset.kind==='incident'&&name==='report')p.evidence_reference=String(d.get('evidence_reference')||'').trim();if(name==='resume_recovered'&&!await window.TG_UI.confirm('A falha foi resolvida? A votação original será retomada com os votos e o tempo preservados.',{title:'Retomar votação',confirmText:'Retomar'}))return;if(api.MFA.has(name)&&!await window.TG_UI.confirm('Confirma esta ação crítica e sua justificativa?',{title:'Confirmação de segurança',confirmText:'Confirmar',danger:true}))return;if(!liveLease(l)||!f.isConnected)return;void invoke(name,p,f.dataset.kind,l);}});
window.addEventListener('offline',()=>{if(dialog.open)invalidateVote();});document.addEventListener('visibilitychange',()=>{if(dialog.open&&!document.hidden){invalidateVote();lastPoll=0;tick();}});window.addEventListener('pagehide',tg96StopShow);window.addEventListener('offline',tg96StopShow);document.addEventListener('visibilitychange',()=>{if(document.hidden)tg96StopShow();});window.TG75_BATTLE_PANEL=Object.freeze({open,close,stopShowAudio:tg96StopShow,guardShowAudio:tg96GuardShow});
})();
