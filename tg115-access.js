/* Tem Gogó R115B: adaptador candidato, ainda não carregado no app. */
(function(root){
'use strict';
const version='r115-2026-11-27-v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const token=/^[0-9a-f]{64}$/;
const kind=u=>u?.is_anonymous===true?'temporary':u?.is_anonymous===false?'permanent':null;
function need(ok,msg='Dados inválidos.'){if(!ok)throw Error(msg);}
function captureFragment(hash){return /^#tg115-invite=([0-9a-f]{64})$/.exec(hash||'')?.[1]||null;}
function make({getClient,getUser,getScope,allowRelease=()=>false}){
 let epoch=0,busy=false;
 function reset(){epoch++;}
 function capture(){const u=getUser(),c=getClient(),s=getScope();need(u?.id&&kind(u)&&c&&s!=null,'Entre para continuar.');return {id:u.id,k:kind(u),c,s,e:epoch};}
 function current(a){const u=getUser();need(a.e===epoch&&a.c===getClient()&&a.id===u?.id&&a.s===getScope()&&a.k===kind(u),'Sessão alterada.');need(allowRelease()===true,'Recursos em preparação.');}
 async function rpc(a,n,p={}){current(a);let r;try{r=await a.c.rpc(n,p);}catch{throw Error('Falha de comunicação.');}current(a);need(r&&!r.error,'Operação não autorizada pelo servidor.');return r.data;}
 async function run(fn){need(!busy,'Operação em andamento.');busy=true;try{const a=capture();const d=await rpc(a,'tg115_access_status');need(d?.api_version===1,'Versão de acesso incompatível.');need(d.release_enabled===true,'A homologação está suspensa.');need(d.available===true,d.reason==='maintenance'?'Tem Gogó em manutenção.':d.reason==='qa_restricted'?'Esta conta não está autorizada para a homologação.':'Acesso temporariamente indisponível.');const v=await fn(a);current(a);return v;}finally{busy=false;}}
 function access(a,d){need(d?.account_kind===a.k&&d.doc_version===version&&typeof d.recreation_allowed==='boolean'&&typeof d.social_allowed==='boolean'&&(!d.social_allowed||(a.k==='permanent'&&d.recreation_allowed)),'Estado de acesso incompatível.');return {account_kind:a.k,doc_version:version,recreation_allowed:d.recreation_allowed,social_allowed:d.social_allowed};}
 async function mine(a){const d=await rpc(a,'tg115_my_access');need(d?.release_enabled===true,'Recursos em preparação.');return access(a,d);}
 async function eligible(a,permanent=false){const d=await mine(a);need(d.recreation_allowed&&(!permanent||a.k==='permanent'),'Acesso não autorizado.');}
 const purpose=p=>['general','voter'].includes(p);
 const time=t=>typeof t==='string'&&Number.isFinite(Date.parse(t));
 function denial(d){const codes=['rate_limited','unavailable','invalid_or_expired','unavailable_or_declaration_required','membership_review_required','profile_required'];return {ok:false,error:codes.includes(d?.error)?d.error:'unavailable'};}
 return Object.freeze({
 reset,status:()=>run(mine),
 declare:({birth=null,age16,age18=false,accept,docVersion}={})=>run(async a=>{
  need(docVersion===version&&age16===true&&accept===true&&typeof age18==='boolean','Confirme a idade e os documentos vigentes.');
  need(a.k==='temporary'?birth===null&&age18===false:typeof birth==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(birth),'Dados etários inválidos.');
  return access(a,await rpc(a,'tg115_declare_access',{p_birth:birth,p_16:true,p_18:age18,p_accept:true,p_version:version}));
 }),
 issue:(f,p)=>run(async a=>{
  need(uuid.test(f)&&purpose(p));await eligible(a,true);
  const d=await rpc(a,'tg115_issue_invite',{p_festival:f,p_purpose:p});
  need(uuid.test(d?.invite_id)&&token.test(d?.token)&&d.purpose===p&&time(d.expires_at));
  return {invite_id:d.invite_id,token:d.token,purpose:p,expires_at:d.expires_at};
 }),
 preview:t=>run(async a=>{
  need(token.test(t));const d=await rpc(a,'tg115_preview_invite',{p_token:t});
  if(d?.ok!==true)return denial(d);
  need(typeof d.title==='string'&&purpose(d.purpose)&&time(d.expires_at));
  return {ok:true,title:d.title,purpose:d.purpose,expires_at:d.expires_at};
 }),
 request:t=>run(async a=>{
  need(token.test(t));await eligible(a);const d=await rpc(a,'tg115_request_entry',{p_token:t});
  if(d?.ok!==true)return denial(d);
  need(uuid.test(d.festival_id)&&uuid.test(d.member_id)&&['pending','approved'].includes(d.status)&&typeof d.existing==='boolean');
  return {ok:true,festival_id:d.festival_id,member_id:d.member_id,status:d.status,existing:d.existing};
 }),
 decide:(f,m,p)=>run(async a=>{
  need(uuid.test(f)&&uuid.test(m)&&['competitor','voter','refused'].includes(p));await eligible(a,true);
  const d=await rpc(a,'tg115_decide_entry',{p_festival:f,p_member:m,p_decision:p});
  need(d?.ok===true&&d.member_id===m&&d.decision===p&&d.status===(p==='refused'?'rejected':'approved'));
  return {ok:true,member_id:m,decision:p,status:d.status};
 }),
 revokeCurrent:(f,p)=>run(async a=>{
  need(uuid.test(f)&&purpose(p));need(a.k==='permanent');const d=await rpc(a,'tg115_revoke_current',{p_festival:f,p_purpose:p});need(d?.revoked===true&&Number.isInteger(d.count)&&d.count>=0&&d.count<=1,'Revogação não confirmada.');return {revoked:true,count:d.count};
 }),
 revoke:(f,i)=>run(async a=>{
  need(uuid.test(f)&&uuid.test(i));need(a.k==='permanent');const d=await rpc(a,'tg115_revoke_invite',{p_festival:f,p_invite:i});need(typeof d==='boolean');return d;
 })
 });
}
const api=Object.freeze({version,make,captureFragment});
if(typeof module==='object'&&module.exports)module.exports=api;else root.TG115_ACCESS=api;
})(typeof window==='object'?window:globalThis);
