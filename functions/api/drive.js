export async function onRequest({request,env}) {
  const origin=request.headers.get('Origin')||'',site=new URL(request.url).origin;
  const allowed=!origin||origin===site||origin==='https://localhost'||origin==='capacitor://localhost';
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed&&origin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
  const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(!allowed)return reply({error:'Origem não autorizada.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'Método inválido.'},405);
  const supabase=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_ANON_KEY;
  const bridge=env.SHALOM_DRIVE_URL,secret=env.SHALOM_DRIVE_KEY,room=env.SHALOM_DRIVE_ROOM_ID;
  if(!supabase||!key||!bridge||!secret||!room)return reply({error:'A integração do Drive ainda não foi configurada. Veja o guia de automação.'},503);
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(bridge))return reply({error:'Endereço da integração inválido.'},503);
  const authorization=request.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer ')||authorization.length>5000)return reply({error:'Conecte este aparelho à banda.'},401);
  try{
    const authHeaders={apikey:key,Authorization:authorization};
    const userResponse=await fetch(`${supabase}/auth/v1/user`,{headers:authHeaders,signal:AbortSignal.timeout(10000)});
    if(!userResponse.ok)return reply({error:'Conecte este aparelho novamente à banda.'},401);
    const user=await userResponse.json();
    const membersUrl=new URL(`${supabase}/rest/v1/members`);
    membersUrl.search=new URLSearchParams({select:'room_id',user_id:`eq.${user.id}`,room_id:`eq.${room}`,limit:'1'}).toString();
    const members=await fetch(membersUrl,{headers:authHeaders,signal:AbortSignal.timeout(10000)});
    if(!members.ok||(await members.json()).length!==1)return reply({error:'Entre pelo código desta banda para acessar as partituras.'},403);
    if(Number(request.headers.get('Content-Length')||0)>20000)return reply({error:'Pedido muito grande.'},413);
    const raw=await request.text();if(raw.length>20000)return reply({error:'Pedido muito grande.'},413);
    const body=JSON.parse(raw);
    if(!['catalog','file'].includes(body.action)||(body.action==='file'&&!/^[a-zA-Z0-9_-]{10,200}$/.test(body.id||'')))return reply({error:'Pedido inválido.'},400);
    const groups=['Crianças','Adolescentes','Jovens','Varões','Irmãs','Grupo de louvor'];
    if(body.action==='catalog'&&(!Array.isArray(body.songs)||!body.songs.length||body.songs.length>50||body.songs.some(song=>!groups.includes(song.group)||typeof song.title!=='string'||!song.title.trim()||song.title.length>120)))return reply({error:'Informe até 50 hinos com título e grupo.'},400);
    const upstream=await fetch(bridge,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:secret,action:body.action,...(body.action==='file'?{id:body.id}:{songs:body.songs.map(song=>({title:song.title,group:song.group}))})}),signal:AbortSignal.timeout(190000)});
    if(!upstream.ok)return reply({error:'O Drive não respondeu. Tente novamente.'},502);
    // Pass JSON through without logging names, PDF contents or credentials.
    if(!upstream.headers.get('content-type')?.includes('application/json'))return reply({error:'Confira a publicação do script: executar como você, acesso para qualquer pessoa.'},502);
    return new Response(upstream.body,{status:200,headers});
  }catch{return reply({error:'Não foi possível consultar o Drive. Confira a conexão e a configuração.'},502);}
}
