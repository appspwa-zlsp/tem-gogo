/* Tem Gogó V7.5 — painel operacional isolado; disponível só quando API e release aprovados.
 * Sem dados falsos no aplicativo principal. Simulador de QA vive fora da pasta pública.
 */
(function(){'use strict';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bridge=window.TGBattleBridge?.createBridge({
 getClient:()=>window.TG_APP_CONTEXT?.getClient(),getUser:()=>window.TG_APP_CONTEXT?.getUser(),
 allowRelease:()=>window.TEM_GOGO_CONFIG?.BATTLE_API_RELEASE_ALLOWED===true
});
if(!bridge)return;
let activeTab='inicio',festivalId=null,snapshot=null,festivals=[],busy=false,timer=null;
const dialog=$('tg75-battle-panel'),content=$('tg75-battle-content'),feedback=$('tg75-feedback');
if(!dialog||!content)return;
const TABS=['inicio','elenco','classificatoria','chave','votacao','recuperacao'];
const labels={inicio:'Visão geral',elenco:'Participantes',classificatoria:'Classificatória',chave:'Confrontos',votacao:'Votação',recuperacao:'Recuperação'};
function message(m){if(feedback)feedback.textContent=m||'';}
function button(name,text,data={},other=''){
 return `<button type="${['create','join'].includes(name)?'submit':'button'}" class="tg75-button ${other}" data-tg75-action="${esc(name)}" ${Object.entries(data).map(([k,v])=>`data-${esc(k)}="${esc(v)}"`).join(' ')} ${!bridge.current().enabled?'disabled title="Aguardando backend seguro"':''}>${esc(text)}</button>`;
}
function timeRemaining(date){const ms=Date.parse(date)-Date.now();if(!Number.isFinite(ms))return '—';const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function empty(text){return `<p class="tg75-muted">${esc(text)}</p>`;}
function statusCard(){const s=bridge.current();return `<div class="tg75-note" ${!s.enabled?'role="alert"':''}>${esc(s.message)}${!s.enabled?'<p>Não há competição nem votos em execução. A Batalha só será ativada após os testes e aprovação do proprietário.</p>':''}</div>`;}
function head(){return `${statusCard()}<div class="tg75-card"><strong>Festival selecionado</strong><p>${snapshot?esc(snapshot.festival?.title||'Festival'):festivalId?esc(festivalId):'Nenhum festival ativo'}</p>${snapshot?`<span class="tg75-number">${esc(snapshot.festival?.state||'rascunho')}</span> ${esc(snapshot.festival?.participants_count||0)} inscritos`:''}</div>`;}
function info(){return `<div class="tg75-stack">${head()}<div class="tg75-grid"><form class="tg75-card" id="tg75-create"><h3>Criar festival</h3><p>Para contas permanentes. Inscrições e apresentações só começam quando o backend liberar.</p><label for="tg75-title">Nome do festival</label><input id="tg75-title" name="title" minlength="3" maxlength="120" required placeholder="Ex.: Festival de domingo"/>${button('create','Criar festival')}</form><form class="tg75-card" id="tg75-join"><h3>Entrar em um festival</h3><label for="tg75-festival-id">Código do festival (UUID)</label><input id="tg75-festival-id" name="festival" required placeholder="Cole o identificador recebido"/><label for="tg75-name">Seu nome de palco</label><input id="tg75-name" name="name" maxlength="70" minlength="1" required placeholder="Como vamos te chamar?"/><label for="tg75-role">Participação</label><select id="tg75-role" name="role"><option value="competitor">Competidor</option><option value="spectator">Plateia</option><option value="guest_voter">Votante temporário</option></select>${button('join','Pedir participação')}</form></div><div class="tg75-card"><h3>Meus festivais</h3>${festivals.length?`<ul class="tg75-list">${festivals.map(f=>`<li><strong>${esc(f.title)}</strong> · ${esc(f.state)} ${button('select','Abrir',{id:f.id},'alt')}</li>`).join('')}</ul>`:empty('Nenhum festival carregado; quando o backend estiver liberado, suas inscrições aparecerão aqui.')}${button('refresh','Atualizar',{},'alt')}</div></div>`;}
function elenco(){const members=snapshot?.members||[];const isController=Boolean(snapshot?.permissions?.controller);
 return `<div class="tg75-stack">${head()}<div class="tg75-card"><h3>Elenco e solicitações</h3>${members.length?`<ul class="tg75-list">${members.map(m=>`<li><strong>${esc(m.display_name)}</strong> · ${esc(m.member_role)} · ${esc(m.status)} ${isController&&m.status==='pending'?button('decide_member','Aprovar',{member:m.id,approved:'true'})+button('decide_member','Recusar',{member:m.id,approved:'false'},'alt'):''}</li>`).join('')}</ul>`:empty('Ainda não há membros no festival.')}${isController?button('open_registration','Abrir inscrições')+button('host_competes','Anfitrião também compete')+button('lock_roster','Fechar inscrições e preparar solos'):''}</div></div>`;}
function classif(){const list=(snapshot?.matches||[]).filter(m=>m.kind==='qualifier');const isController=Boolean(snapshot?.permissions?.controller);
 return `<div class="tg75-stack">${head()}<div class="tg75-card"><h3>Apresentações individuais</h3><p>A Diva e cada participante elegível avaliam conforme as regras. Notas oficiais só vêm do servidor.</p>${list.length?`<ul class="tg75-list">${list.map(m=>`<li><strong>${esc(m.name_a||m.contestant_a_member_id)}</strong> · ${esc(m.state)} ${m.average_2_to_10!==undefined?`· média ${esc(m.average_2_to_10)}`:''}${isController&&m.state==='result_pending'?button('open_vote','Abrir votação',{match:m.id}):''}</li>`).join('')}</ul>`:empty('A classificatória será criada quando o elenco estiver fechado.')}${isController?button('freeze_seeds','Congelar classificação e realizar sorteio'):''}</div></div>`;}
function chave(){const matches=(snapshot?.matches||[]).filter(m=>m.kind!=='qualifier');const shape=snapshot?.bracket_shape;const isController=Boolean(snapshot?.permissions?.controller);
 return `<div class="tg75-stack">${head()}<div class="tg75-card"><h3>Chave e duelos</h3><p>Avanços diretos não são vitórias. Os vencedores só aparecem após apuração registrada.</p>${shape?`<p>${esc(shape.competitors)} competidores · ${esc(shape.byes)} avanços diretos · bronze: ${esc(shape.bronze_policy)}</p>`:''}${matches.length?`<ul class="tg75-list">${matches.map(m=>`<li><strong>${esc(m.name_a||'Aguardando A')} × ${esc(m.name_b||'Aguardando B')}</strong><p>${esc(m.kind)} · ${esc(m.state)}</p>${m.winner_name?`<span class="tg75-number">Vencedor: ${esc(m.winner_name)}</span>`:''}${isController&&m.state==='ready'?button('prepare_match','Preparar apresentação',{match:m.id}):''}${isController&&m.state==='result_pending'?button('open_vote','Abrir votação',{match:m.id}):''}</li>`).join('')}</ul>`:empty('A chave será revelada após a classificatória.')}${isController?button('freeze_bracket','Congelar a chave')+button('prepare_stage','Preparar etapa seguinte')+button('complete_stage','Concluir etapa verificada'):''}</div></div>`;}
function votacao(){const windows=snapshot?.voting_windows||[], user=window.TG_APP_CONTEXT?.getUser();const active=windows.find(w=>w.state==='open');const closed=windows.filter(w=>w.state==='closed'&&!w.result_confirmed);const eligible=Boolean(active?.eligible),submitted=Boolean(active?.my_ballot_submitted);
 return `<div class="tg75-stack">${head()}<div class="tg75-card"><h3>Votação ao vivo</h3>${active?`<div class="tg75-timer" data-tg75-deadline="${esc(active.deadline_at)}">${esc(timeRemaining(active.deadline_at))}</div><p>${esc(active.title||'Apresentação')} · ${esc(active.votes_count||0)} cédulas registradas</p><p>${eligible?'Seu voto está habilitado para esta janela.':'Sua conta não está no eleitorado desta janela.'}</p>${submitted?'<strong>Seu voto já foi registrado. Obrigada!</strong>':`<form id="tg75-vote" data-window="${esc(active.id)}">${stars('a',active.name_a||'Cantor A')}${active.has_b?stars('b',active.name_b||'Cantor B'):''}<button class="tg75-button" type="submit" ${!eligible||!bridge.current().enabled?'disabled':''}>Confirmar meu voto</button></form>`}${snapshot?.permissions?.controller?button('extend_vote','Prorrogar 30 s',{window:active.id})+button('close_vote','Encerrar no prazo',{window:active.id}):''}`:empty('Nenhuma votação aberta no momento.')}<p class="tg75-muted">Prazo de 150 segundos, com uma única prorrogação possível de 30 segundos. A validade é determinada pelo servidor, nunca pelo relógio do celular.</p>${snapshot?.permissions?.controller&&closed.length?`<h3>Apurações aguardando confirmação</h3>${closed.map(w=>`<p>${esc(w.name_a||'Apresentação')} ${button('commit_result','Confirmar apuração',{window:w.id})}</p>`).join('')}`:''}</div></div>`;}
function stars(slot,label){return `<fieldset><legend>${esc(label)}</legend><div class="tg75-stars">${[1,2,3,4,5].map(v=>`<label><input type="radio" name="stars_${slot}" value="${v}" required/>${v} ★</label>`).join('')}</div></fieldset>`;}
function recover(){return `<div class="tg75-stack">${head()}<div class="tg75-card"><h3>Intervalo e recuperação</h3><p>A Batalha persiste entre dias, independente da sala de karaokê. O anfitrião deve indicar alguém previamente e o indicado precisa aceitar.</p><p>Recuperar o comando exige confirmações independentes, ausência verificada e registro de auditoria. Nenhuma transferência é automática.</p>${snapshot?.permissions?.controller?button('nominate_delegate','Indicar delegado'):''}${button('request_recovery','Solicitar análise de recuperação',{},'alt')}<p class="tg75-muted">O painel não oferece transferência direta de controle nem libera resultados sem o quorum.</p></div></div>`;}
const screens={inicio:info,elenco,classificatoria:classif,chave,votacao,recuperacao:recover};
function render(){content.innerHTML=(screens[activeTab]||screens.inicio)();dialog.querySelectorAll('[data-tg75-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tg75Tab===activeTab)));}
async function reload(){if(!bridge.current().enabled){festivals=[];snapshot=null;render();return;}busy=true;try{festivals=await bridge.list();if(festivalId)snapshot=await bridge.snapshot(festivalId);render();}catch(err){message(err.message||'Não foi possível atualizar.');}finally{busy=false;}}
async function open(){message('');activeTab='inicio';dialog.showModal();await bridge.capabilities();await reload();if(!timer)timer=setInterval(()=>{if(dialog.open)dialog.querySelectorAll('[data-tg75-deadline]').forEach(el=>{el.textContent=timeRemaining(el.dataset.tg75Deadline);});},1000);}
function close(){dialog.close();clearInterval(timer);timer=null;}
$('tg75-open-workspace')?.addEventListener('click',()=>{const g=$('tg70-battle-guide');if(g?.open)g.close();void open();});
$('tg75-battle-close')?.addEventListener('click',close);
dialog.addEventListener('close',()=>{clearInterval(timer);timer=null;});
dialog.addEventListener('click',event=>{const b=event.target.closest('[data-tg75-tab]');if(b){activeTab=b.dataset.tg75Tab;if(TABS.includes(activeTab))render();return;}
 const action=event.target.closest('[data-tg75-action]');if(!action)return;
 if(['create','join'].includes(action.dataset.tg75Action))return;
 if(action.dataset.tg75Action==='select'){festivalId=action.dataset.id;void reload();return;}
 if(action.dataset.tg75Action==='refresh'){void reload();return;}
 if(busy)return;
 const name=action.dataset.tg75Action;
 let payload={festival_id:festivalId};
 if(name==='decide_member')payload={festival_id:festivalId,member_id:action.dataset.member,approved:action.dataset.approved==='true'};
 if(['extend_vote','close_vote'].includes(name))payload={window_id:action.dataset.window};
 if(name==='prepare_match'){message('Uma apresentação exige integração real de sala, microfones e telemetria. Não se inicia pelo painel isolado.');return;}
 if(name==='nominate_delegate'||name==='request_recovery'){message('Recuperação exige a etapa de verificação de identidade, ausência e auditoria. Operação bloqueada nesta candidata.');return;}
 if(name==='open_vote')payload={festival_id:festivalId,match_id:action.dataset.match};
 if(name==='commit_result')payload={window_id:action.dataset.window};
 if(name==='prepare_stage')payload.stage_order=Number(snapshot?.next_stage_order)||2;
 if(name==='complete_stage')payload.stage_order=Number(snapshot?.active_stage_order)||2;
 void invoke(name,payload);
});
dialog.addEventListener('submit',event=>{event.preventDefault();if(busy)return;
 const form=event.target;if(form.id==='tg75-create')void invoke('create',{title:form.elements.namedItem('title').value});
 if(form.id==='tg75-join'){const selected=form.querySelector('[name="role"]');void invoke('join',{festival_id:form.elements.namedItem('festival').value,name:form.elements.namedItem('name').value,role:selected?.value});}
 if(form.id==='tg75-vote'){const d=new FormData(form);const a=Number(d.get('stars_a'));const b=d.get('stars_b');void invoke('cast_vote',{window_id:form.dataset.window,stars_a:a,stars_b:b===null?null:Number(b)});}
});
async function invoke(name,payload){busy=true;message('Verificando solicitação…');try{const result=await bridge.execute(name,payload);if(name==='create'&&typeof result==='string')festivalId=result;if(name==='join'&&payload.festival_id)festivalId=payload.festival_id;message('Ação confirmada pelo servidor.');await reload();}catch(err){message(err.message||'Ação não concluída.');}finally{busy=false;}}

window.TG75_BATTLE_PANEL=Object.freeze({open,close,bridge});
})();
