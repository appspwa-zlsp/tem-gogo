/**
 * Tem Gogó v9 | Supabase Edge Function: youtube-search
 * Secret privado: SERPAPI_KEY (apenas no Supabase).
 * Sem senha da sala. Usuário precisa ser membro OU anfitrião de sala aberta,
 * validado com JWT e RLS. Busca externa bloqueada pelo saldo mensal da SerpApi.
 * Usar no editor Supabase de Edge Functions com nome EXATO youtube-search.
 */
const ORIGIN='https://appspwa-zlsp.github.io';
const reRoom=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{12}$/i;
const reVid=/^[A-Za-z0-9_-]{11}$/;
type Item={id:string;title:string;channel:string};
const calls=new Map<string,number[]>();
const hitsCache=new Map<string,{at:number;items:Item[]}>();
let quota:{at:number;remaining:number;reset:string|null}|null=null;
const MAX_FREE=250; // nunca consumir buscas além do orçamento gratuito escolhido
function publishable(req:Request):string {
  try{const keys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');if(typeof keys.default==='string')return keys.default;}catch{}
  return Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||Deno.env.get('SUPABASE_ANON_KEY')||req.headers.get('apikey')||'';
}
function cors(origin:string):HeadersInit{
  return {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',
    ...((origin===ORIGIN||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))?{
      'Access-Control-Allow-Origin':origin,
      'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
      'Access-Control-Allow-Methods':'POST,OPTIONS'
    }:{})};
}
function errorMessage(raw:unknown, def='Serviço de busca indisponível'){
  return typeof raw==='string'&&raw.length<220?raw:def;
}
async function readQuota(secret:string){
  if(quota && Date.now()-quota.at<20000)return quota;
  // Account API não consome buscas da franquia.
  const url='https://serpapi.com/account.json?'+new URLSearchParams({api_key:secret});
  const response=await fetch(url,{signal:AbortSignal.timeout(8500)});
  if(!response.ok)throw new Error('Falha ao conferir o saldo da SerpApi');
  const a=await response.json();
  if(typeof a.searches_per_month!=='number'||typeof a.this_month_usage!=='number')
    throw new Error('Resposta inesperada da conta SerpApi');
  const plan=Number(a.plan_searches_left);
  const remaining=Math.max(0,Math.min(
    Number.isFinite(plan)?plan:MAX_FREE,
    Number(a.total_searches_left??MAX_FREE),
    MAX_FREE-Number(a.this_month_usage)
  ));
  quota={at:Date.now(),remaining,reset:String(a.plan_renewal_date||'')||null};
  return quota;
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin')||'';const h=cors(origin);
  const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:h});
  if(req.method==='OPTIONS')return new Response(null,{status:!origin||(origin===ORIGIN||origin.startsWith('http://localhost')||origin.startsWith('http://127.0.0.1'))?204:403,headers:h});
  if(origin && origin!==ORIGIN&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))return reply({error:'Origem não autorizada.'},403);
  if(req.method!=='POST')return reply({error:'Use POST.'},405);
  const base=Deno.env.get('SUPABASE_URL')||'';
  const pub=publishable(req);
  const auth=req.headers.get('authorization')||'';
  if(!base||!pub)return reply({error:'Credenciais públicas do Supabase indisponíveis no servidor.'},503);
  if(!/^Bearer\s+[^\s]+$/i.test(auth))return reply({error:'Entre na festa antes de buscar músicas.',code:'AUTH_REQUIRED'},401);
  try{
    const payload=await req.json().catch(()=>null);
    const roomId=String(payload?.roomId||'');
    const action=payload?.action==='check'?'check':'search';
    const query=String(payload?.query||'').normalize('NFKC').replace(/\s+/g,' ').trim();
    if(!reRoom.test(roomId))return reply({error:'Identificador da sala inválido.'},400);
    if(action==='search'&&(query.length<2||query.length>100))return reply({error:'Digite entre 2 e 100 caracteres.'},400);
    if(action==='check'&&!reVid.test(String(payload?.videoId||'')))return reply({error:'ID do vídeo inválido.'},400);
    const headers={'apikey':pub,'Authorization':auth};
    // Verifica o JWT no serviço Auth, sem confiar somente em apikey publicável.
    const logged=await fetch(`${base}/auth/v1/user`,{headers,signal:AbortSignal.timeout(7000)});
    if(!logged.ok)return reply({error:'Sessão expirada. Reabra a festa e entre novamente.',code:'AUTH_EXPIRED'},401);
    const user=await logged.json();if(!user?.id)return reply({error:'Sessão inválida.',code:'AUTH_INVALID'},401);
    // RLS aplicada ao token do usuário: só anfitrião ou membro lê esta sala.
    const url=new URL(`${base}/rest/v1/karaoke_rooms`);
    url.searchParams.set('select','id');url.searchParams.set('id','eq.'+roomId);
    url.searchParams.set('status','eq.open');url.searchParams.set('expires_at','gt.'+new Date().toISOString());
    const access=await fetch(url,{headers,signal:AbortSignal.timeout(7000)});
    if(!access.ok)return reply({error:'Falha ao confirmar a participação nesta festa.',code:'ROOM_CHECK_FAILED'},403);
    const rooms=await access.json();
    if(!Array.isArray(rooms)||rooms.length===0)return reply({error:'Você ainda não está vinculado a uma festa ativa. Reabra o QR para entrar.',code:'ROOM_ACCESS_DENIED'},403);
    if(action==='check')return reply({playable:null,verified:false,reason:'Somente o player YouTube pode confirmar a reprodução.'});
    const q=query.toLocaleLowerCase('pt-BR');
    const cached=hitsCache.get(q);
    if(cached && Date.now()-cached.at<15*60*1000)return reply({items:cached.items,cached:true,source:'serpapi'});
    const last=(calls.get(user.id)||[]).filter(t=>Date.now()-t<60000);
    if(last.length>=3||(last.length && Date.now()-last.at(-1)!<9000))return reply({error:'Espere alguns segundos entre as buscas externas.',code:'SEARCH_COOLDOWN'},429);
    const secret=Deno.env.get('SERPAPI_KEY');
    if(!secret)return reply({error:'SerpApi não configurada. Use o histórico ou informe um link do YouTube.',code:'QUOTA_UNAVAILABLE'},503);
    let available;
    try{available=await readQuota(secret);}catch{
      return reply({error:'Não foi possível conferir o saldo da SerpApi. Busca bloqueada preventivamente: use o histórico ou um link.',code:'QUOTA_UNAVAILABLE'},503);
    }
    if(available.remaining<1)return reply({error:'A cota gratuita de buscas foi atingida. Use as mais pedidas ou um link do YouTube.',code:'QUOTA_EXHAUSTED',reset:available.reset},429);
    // Reserva local de uma consulta para reduzir colisões. O saldo oficial
    // é reconferido a cada 20s; múltiplas instâncias podem ter caches distintos.
    available.remaining-=1;
    last.push(Date.now());calls.set(user.id,last);
    if(calls.size>2500)calls.clear();if(hitsCache.size>220)hitsCache.clear();
    const searchUrl=new URL('https://serpapi.com/search.json');
    searchUrl.search=new URLSearchParams({engine:'youtube',search_query:/karaok[eê]/i.test(query)?query:query+' karaokê',hl:'pt',gl:'br',api_key:secret}).toString();
    const resp=await fetch(searchUrl,{signal:AbortSignal.timeout(13000)});
    if(resp.status===429)return reply({error:'SerpApi limitou as buscas. Escolha o acervo ou cole o link do YouTube.',code:'QUOTA_EXHAUSTED'},429);
    if(!resp.ok)return reply({error:'A SerpApi está indisponível. Use os hits do histórico ou um link direto.'},503);
    const data=await resp.json();
    if(data?.error){
      const msg=errorMessage(data.error).toLowerCase();
      if(/limit|credit|quota|searches|monthly/.test(msg))return reply({error:'A franquia de pesquisas acabou. Use o acervo ou cole um link.',code:'QUOTA_EXHAUSTED'},429);
      return reply({error:'A busca externa não conseguiu retornar músicas. Tente outro nome.'},503);
    }
    const items:Item[]=[];const seen=new Set<string>();
    for(const hit of Array.isArray(data.video_results)?data.video_results:[]){
      const id=String(hit.video_id||'');if(!reVid.test(id)||seen.has(id))continue;
      const duration=String(hit.length||'');if(/^\d+:\d\d:\d\d$/.test(duration))continue;
      const title=String(hit.title||'').trim().slice(0,120);
      if(!title)continue;seen.add(id);
      items.push({id,title,channel:String(hit.channel?.name||'Canal YouTube').slice(0,80)});
      if(items.length>=8)break;
    }
    hitsCache.set(q,{at:Date.now(),items});
    return reply({items,source:'serpapi',verifiedEmbeddable:false});
  }catch(e){console.error('youtube-search:',e);return reply({error:'Falha na busca. O histórico e a opção de link continuam disponíveis.'},503);}
});
