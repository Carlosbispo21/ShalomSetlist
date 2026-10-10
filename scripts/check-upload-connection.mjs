import { readFile } from 'node:fs/promises';
const lines = (await readFile(new URL('../.env', import.meta.url),'utf8')).split(/\r?\n/);
const env = Object.fromEntries(lines.filter(line => line.includes('=')).map(line => { const i=line.indexOf('='); return [line.slice(0,i),line.slice(i+1).trim()]; }));
const base = env.VITE_SUPABASE_URL;
for (const path of ['/storage/v1/status','/storage/v1/object/scores/connection-check.pdf']) {
  const method = path.endsWith('/status') ? 'GET' : 'OPTIONS';
  try {
    const response = await fetch(`${base}${path}`, { method, headers: method === 'OPTIONS' ? {
      Origin:'http://127.0.0.1:4173', 'Access-Control-Request-Method':'POST',
      'Access-Control-Request-Headers':'apikey,authorization,x-client-info,x-upsert'
    } : {apikey:env.VITE_SUPABASE_ANON_KEY}, signal:AbortSignal.timeout(20000) });
    console.log(JSON.stringify({path,method,status:response.status,allowOrigin:response.headers.get('access-control-allow-origin'),allowHeaders:response.headers.get('access-control-allow-headers'),body:(await response.text()).slice(0,500)}));
  } catch(error) {console.log(JSON.stringify({path,method,error:error.message}));}
}
