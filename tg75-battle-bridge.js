/* Tem Gogó V7.5: única ponte do painel para a futura fachada RPC pública auditada.
 * ESCRITAS BLOQUEADAS: a config client e o gate do servidor devem concordar.
 * NUNCA acessa tg_battle_internal ou service_role do navegador.
 */
(function(root,factory){'use strict';const x=factory();if(typeof module==='object'&&module.exports)module.exports=x;else root.TGBattleBridge=Object.freeze(x);})(typeof window==='object'?window:globalThis,function(){
'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS=new Set(['create','join','decide_member','open_registration','host_competes','lock_roster','freeze_seeds','freeze_bracket','prepare_stage','complete_stage','open_vote','cast_vote','extend_vote','close_vote','commit_result','nominate_delegate','accept_delegate','request_recovery','confirm_recovery','cancel_unstarted','heartbeat']);
const FAILURE={ok:false,enabled:false,status:'aguardando_integracao',message:'A Batalha está em preparação. O karaokê Clássico e o Solo continuam disponíveis.'};
function error(err){const code=String(err?.message||err||'');if(code.includes('BATTLE_'))return 'Não foi possível concluir esta ação da Batalha. Confira sua participação, o estado da etapa e tente novamente.';return 'Não foi possível comunicar com a Batalha. Verifique sua conexão e tente novamente.';}
function createBridge({getClient=()=>null,getUser=()=>null,allowRelease=()=>false}={}){
 let status={...FAILURE};
 function client(){return getClient();}
 function user(){return getUser();}
 function checkAccess(){if(!status.enabled||!allowRelease())throw new Error('BATTLE_NOT_RELEASED');if(!client()||!user())throw new Error('BATTLE_AUTH_REQUIRED');}
 return Object.freeze({
  current:()=>({...status}),
  async capabilities(){
   status={...FAILURE};
   if(!allowRelease() || !client())return this.current();
   try {const {data,error:err}=await client().rpc('tg_battle_v1_capabilities');
    if(err)throw err;
    if(data?.enabled===true&&data?.api_version===1){status={ok:true,enabled:true,status:'operacional',message:'Batalha disponível no ambiente autorizado.'};}
    return this.current();
   } catch {return this.current();}
  },
  async list(){checkAccess();const {data,error:err}=await client().rpc('tg_battle_v1_list');if(err)throw new Error(error(err));return Array.isArray(data)?data:[];},
  async snapshot(festivalId){checkAccess();if(!UUID.test(String(festivalId)))throw new Error('Código de festival inválido');const {data,error:err}=await client().rpc('tg_battle_v1_snapshot',{p_festival:festivalId});if(err)throw new Error(error(err));return data;},
  async execute(action,payload={}){checkAccess();if(!ACTIONS.has(action))throw new Error('Ação não autorizada');if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Dados inválidos');
   const {data,error:err}=await client().rpc('tg_battle_v1_execute',{p_action:action,p_payload:payload});if(err)throw new Error(error(err));return data;}
 });
}
return {createBridge, UUID, ACTIONS, FAILURE};
});
