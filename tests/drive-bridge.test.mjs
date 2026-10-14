import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/drive.js';
const env={VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_ANON_KEY:'public',SHALOM_DRIVE_ROOM_ID:'room',SHALOM_DRIVE_KEY:'private',SHALOM_DRIVE_URL:'https://script.google.com/macros/s/test/exec'};
function request(body={action:'catalog',songs:[{group:'Grupo de louvor',title:'Meu Deus é Grande'}]}){return new Request('https://shalomsetlist.pages.dev/api/drive',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify(body)});}
test('integração sem configuração não acessa o Drive',async()=>{const result=await onRequest({request:request(),env:{}});assert.equal(result.status,503);});
test('músico ou responsável de outra banda não acessa a pasta compartilhada',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify(calls===1?{id:'user',is_anonymous:false}:[]),{headers:{'Content-Type':'application/json'}});};
  try{const result=await onRequest({request:request(),env});assert.equal(result.status,403);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
test('diretor da banda recebe o catálogo sem expor a chave privada',async()=>{
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url:String(url),options});return new Response(JSON.stringify(calls.length===1?{id:'user'}:calls.length===2?[{room_id:'room',role:'director'}]:{files:[]}),{headers:{'Content-Type':'application/json'}});
  };
  try{const result=await onRequest({request:request(),env});assert.equal(result.status,200);assert.deepEqual(await result.json(),{files:[]});assert.ok(calls[1].url.includes('room_id=eq.room'));assert.equal(JSON.parse(calls[2].options.body).key,'private');assert.equal(result.headers.get('Cache-Control'),'no-store');}finally{globalThis.fetch=original;}
});
test('pedido inválido não é encaminhado para Google',async()=>{
  const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify(calls===1?{id:'user'}:[{role:'director'}]));};
  try{const result=await onRequest({request:request({action:'file',id:'../../other'}),env});assert.equal(result.status,400);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
