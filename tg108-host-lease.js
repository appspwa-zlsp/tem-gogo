/* R108-B2 — transporte do palco piloto; nenhuma ativação automática. */
(function(root){
'use strict';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
const invalid=()=>Error('Autoridade do palco não confirmada.');
function create({rpc,context,clock=()=>performance.now(),random=b=>crypto.getRandomValues(b),timeout=4500,enabled=false,onStop=()=>{}}){
 let seq=0,ctx=null,mode='unknown',g=null,device=null,token=null,until=0,renewAt=0,requestId=null,tail=Promise.resolve(),queued=0,closed=false;
 const same=()=>{const c=context();return !!ctx&&c?.room===ctx.room&&c?.uid===ctx.uid&&c?.role===ctx.role&&c?.epoch===ctx.epoch;};
 const live=()=>same()&&!closed&&mode==='live'&&clock()<until;
 const legacy=()=>same()&&!closed&&['legacy','disabled'].includes(mode);
 const snap=()=>Object.freeze({mode,device,generation:g,live:live(),legacy:legacy(),remainingMs:Math.max(0,until-clock())});
 function reset(){++seq;ctx=null;mode='unknown';g=null;device=null;token=null;until=0;renewAt=0;requestId=null;tail=Promise.resolve();queued=0;closed=false;}
 function halt(){if(closed)return;closed=true;mode='blocked';token=null;requestId=null;until=0;++seq;onStop();}
 function ensure(s){if(s!==seq||!same()||closed)throw invalid();}
 async function invoke(name,args,s){ensure(s);let timer;try{const r=await Promise.race([Promise.resolve().then(()=>rpc(name,args)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(invalid()),timeout);})]);ensure(s);return r;}finally{clearTimeout(timer);}}
 function schedule(fn,{generation=false,critical=true}={}){const s=seq,old=g;if(queued>=64)return Promise.reject(invalid());queued++;const work=tail.then(async()=>{ensure(s);if(generation&&old!==g)throw invalid();try{return await fn(s);}catch(e){if(critical&&s===seq&&same())halt();throw e;}});tail=work.catch(()=>{});return work.finally(()=>{if(s===seq)queued--;});}
 function auth(){if(!live()||ctx.role!=='host'||device!=='host'||!token)throw invalid();return {p_room:ctx.room,p_token:token,p_generation:g};}
 function key(){return Array.from(random(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
 function accept(r,t,rotate=false){if(!uuid(r?.generation)||!Number.isFinite(Date.parse(r?.expires_at))||(!rotate&&g&&g!==r.generation)||clock()>=t+22000)throw invalid();g=r.generation;mode='live';device='host';until=t+22000;renewAt=t+8000;}
 async function renewInside(s){const t=clock(),r=await invoke('tg95_host_renew',auth(),s);accept(r,t);}
 async function statusInside(s){if(mode==='live'&&ctx.role==='host'&&clock()>=renewAt)await renewInside(s);const t=clock(),r=await invoke('tg95_room_lease_status',{p_room:ctx.room},s);
 if(r?.state==='legacy'&&r.protected===false&&r.pilot===false&&!g&&['unknown','legacy'].includes(mode)){mode='legacy';return snap();}
 if(r?.state==='awaiting_host'&&r.pilot===true&&r.protected===false&&!g){mode='awaiting_host';return snap();}
 if(r?.state==='expired'&&r.protected===true&&r.pilot===true&&uuid(r.generation)&&!token&&mode!=='live'){g=r.generation;mode='expired';device=r.device;until=0;return snap();}
 if(r?.state!=='live'||r.protected!==true||r.pilot!==true||!uuid(r.generation)||!Number.isFinite(Date.parse(r.expires_at)))throw invalid();
 const prior=mode;if(prior==='live'&&g!==r.generation)throw invalid();g=r.generation;device=r.device;
 if(!['host','remote','guest','unbound'].includes(device))throw invalid();
 if(ctx.role==='host'){if(!token||device!=='host'){if(prior==='live')throw invalid();mode='occupied';until=0;return snap();}if(!live())throw invalid();}
 else if(ctx.role==='remote'&&device!=='remote'){if(prior==='live')throw invalid();mode='unbound';until=0;return snap();}
 else if(ctx.role==='guest'&&device!=='guest')throw invalid();
 else{mode='live';until=t+5500;if(clock()>=until)throw invalid();}
 return snap();}
 async function begin(){reset();const c=context();if(!uuid(c?.room)||!uuid(c?.uid)||!['host','remote','guest'].includes(c.role))throw invalid();ctx={...c};if(!enabled||c.battle===true){mode='disabled';return snap();}return refresh();}
 function refresh(){if(mode==='ended'||legacy()&&mode==='disabled')return Promise.resolve(snap());return schedule(s=>mode==='ended'?snap():statusInside(s));}
 function claim(confirm){if(confirm!==true||ctx?.role!=='host'||mode!=='awaiting_host')return Promise.reject(invalid());return schedule(async s=>{const t=clock(),k=key();const r=await invoke('tg95_host_claim',{p_room:ctx.room,p_token:k},s);token=k;accept(r,t);return snap();});}
 function recover(confirm){if(confirm!==true||ctx?.role!=='host'||mode!=='expired')return Promise.reject(invalid());return schedule(async s=>{const t=clock(),k=key(),old=g,r=await invoke('tg95_host_recover',{p_room:ctx.room,p_token:k,p_previous_generation:old,p_confirm:true},s);if(r?.automatic_resume!==false||r.generation===old)throw invalid();token=k;accept(r,t,true);return {disposition:r.disposition,source_song:r.source_song,retry_song:r.retry_song,automatic_resume:false};});}
 function command(action,a={}){const withSong=['start','finish','remove','playback'].includes(action);if(!['start','finish','remove','playback','finalize','close','clean'].includes(action)||(withSong&&!uuid(a.song)))return Promise.reject(invalid());return schedule(async s=>{if(clock()>=renewAt)await renewInside(s);const r=await invoke('tg95_host_command',{...auth(),p_action:action,p_song:withSong?a.song:null,p_emergency_generation:['start','finish'].includes(action)?a.emergencyGeneration??null:null,p_skipped:action==='finish'?a.skipped??false:null,p_results:action==='finish'?a.results??[]:null,p_played:action==='playback'?a.played:null,p_duration:action==='playback'?a.duration:null},s);
 if(action==='finalize'){if(!r||typeof r!=='object'||Array.isArray(r))throw invalid();mode='ended';token=null;until=0;return r;}
 if(action==='playback'){if(typeof r?.qualified!=='boolean')throw invalid();return r.qualified;}
 if(action==='clean'){if(!Number.isInteger(r?.deleted))throw invalid();return r.deleted;}
 if(r?.ok!==true||r.action!==action)throw invalid();if(action==='close'){mode='ended';token=null;until=0;}return true;},{generation:true});}
 function signal(target,kind,payload){if(!uuid(target)||typeof kind!=='string'||!live())return Promise.reject(invalid());const p=JSON.parse(JSON.stringify(payload||{}));delete p._tg30Generation;delete p._tg86Generation;return schedule(async s=>{if(clock()>=renewAt)await renewInside(s);const r=await invoke('tg95_host_signal',{...auth(),p_target:target,p_kind:kind,p_payload:p},s);if(r!==true)throw invalid();return true;},{generation:true});}
 function issue(confirm){if(confirm!==true)return Promise.reject(invalid());return schedule(async s=>{const r=await invoke('tg96_pair_issue',{...auth(),p_confirm:true},s);if(!uuid(r?.request_id)||!/^[a-f0-9]{64}$/.test(r.code)||!Number.isFinite(Date.parse(r.expires_at)))throw invalid();requestId=r.request_id;return {code:r.code,expiresAt:r.expires_at};},{generation:true,critical:false});}
 function request(code){if(ctx?.role!=='remote'||!['unbound','occupied','live'].includes(mode)||!/^[a-f0-9]{64}$/.test(code))return Promise.reject(invalid());return schedule(async s=>{const r=await invoke('tg96_pair_request',{p_room:ctx.room,p_code:code},s);if(r?.state!=='pending'||!uuid(r.request_id))throw invalid();return true;},{critical:false});}
 function review(action,confirm){if(!requestId||!['status','approve','cancel'].includes(action)||action!=='status'&&confirm!==true)return Promise.reject(invalid());return schedule(async s=>{const r=await invoke('tg96_pair_review',{...auth(),p_request:requestId,p_action:action,p_confirm:confirm===true},s);if(action==='approve'){if(r?.state!=='approved'||r.automatic_resume!==false||r.remote_bound!==true||!uuid(r.generation)||!Number.isFinite(Date.parse(r.expires_at)))throw invalid();g=r.generation;requestId=null;}else if(action==='cancel'){if(r?.state!=='cancelled')throw invalid();requestId=null;}else if(!['waiting','pending'].includes(r?.state))throw invalid();return {state:r.state};},{generation:true,critical:action==='approve'});}
 function revoke(confirm){if(confirm!==true)return Promise.reject(invalid());return schedule(async s=>{const r=await invoke('tg96_remote_revoke',{...auth(),p_confirm:true},s);if(!uuid(r?.generation)||r.generation===g||r.automatic_resume!==false||r.remote_bound!==false||!Number.isFinite(Date.parse(r.expires_at)))throw invalid();g=r.generation;requestId=null;return snap();},{generation:true});}
 function accepts(p){return legacy()?p?._tg86Generation==null:live()&&p?._tg86Generation===g;}
 function decorate(p){const q={...p};delete q._tg86Generation;if(legacy())return q;if(!live()||!['remote','guest'].includes(ctx.role))throw invalid();q._tg86Generation=g;return q;}
 return Object.freeze({begin,refresh,claim,recover,command,signal,issue,request,review,revoke,accepts,decorate,reset,halt,snapshot:snap});
}
// O código de pareamento permanece no fragmento, nunca na query ou no armazenamento.
function pairFragment(code){if(typeof code!=='string'||!/^[a-f0-9]{64}$/.test(code))throw invalid();return '#tg108_pair='+code;}
function readPairFragment(hash,room,remote){if(remote!=='1'||typeof room!=='string'||!/^[A-F0-9]{8}([A-F0-9]{4})?$/.test(room)||typeof hash!=='string')return null;const match=/^#tg108_pair=([a-f0-9]{64})$/.exec(hash);return match?Object.freeze({room,code:match[1]}):null;}
const api=Object.freeze({create,pairFragment,readPairFragment});
if(typeof module==='object'&&module.exports)module.exports=api;else Object.defineProperty(root,'TG108_HOST_LEASE',{value:api,writable:false,configurable:false});
})(typeof globalThis==='object'?globalThis:this);
