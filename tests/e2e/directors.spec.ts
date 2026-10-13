import {test,expect} from '@playwright/test';
const base='https://vzccxwihuhcjydyjrzym.supabase.co',id='11111111-1111-4111-8111-111111111111',room='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('libera uma conta da lista com um toque e atualiza seu papel',async({page})=>{
  const members=[{user_id:id,email:'owner@example.test',role:'director',is_owner:true,is_anonymous:false},{user_id:'22222222-2222-4222-8222-222222222222',email:'musician@example.test',role:'musician',is_owner:false,is_anonymous:false}];
  const grants:string[]=[];
  await page.routeWebSocket('wss://vzccxwihuhcjydyjrzym.supabase.co/**',ws=>ws.close());
  await page.route(`${base}/**`,async route=>{
    const url=new URL(route.request().url()),json=(data:unknown)=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    if(url.pathname==='/rest/v1/members')return json([{room_id:room,role:'director',rooms:{id:room,name:'Banda Shalom',join_code:'A1B2C3D4E5F6',owner_id:id}}]);
    if(url.pathname==='/rest/v1/rpc/list_shalom_members')return json(members);
    if(url.pathname==='/rest/v1/rpc/grant_shalom_director'){
      const email=route.request().postDataJSON().target_email;grants.push(email);
      members.find(member=>member.email===email)!.role='director';return json(null);
    }
    if(url.pathname==='/rest/v1/scores')return json([]);return json(null);
  });
  await page.addInitScript(({id})=>{
    const now=Math.floor(Date.now()/1000),b64=(value:object)=>btoa(JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    localStorage.setItem('sb-vzccxwihuhcjydyjrzym-auth-token',JSON.stringify({access_token:`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:id,role:'authenticated',is_anonymous:false,exp:now+3600})}.test`,refresh_token:'test',expires_at:now+3600,expires_in:3600,token_type:'bearer',user:{id,email:'owner@example.test',app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated',created_at:new Date().toISOString()}}));
  },{id});
  await page.goto('/');await expect(page.getByRole('button',{name:'Enviar partituras',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/^(Nossa banda|Banda)$/}).click();
  await page.getByRole('button',{name:'Tornar musician@example.test responsável',exact:true}).click();
  await expect(page.getByRole('button',{name:'Remover permissão de musician@example.test'})).toBeVisible();
  expect(grants).toEqual(['musician@example.test']);
});
