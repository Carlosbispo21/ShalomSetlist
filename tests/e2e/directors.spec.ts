import {test,expect} from '@playwright/test';
const base='https://vzccxwihuhcjydyjrzym.supabase.co',id='11111111-1111-4111-8111-111111111111',room='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('quem entrou pelo código tem envio e importação sem liberação de responsável',async({page})=>{
  const accessCalls:string[]=[];
  await page.routeWebSocket('wss://vzccxwihuhcjydyjrzym.supabase.co/**',ws=>ws.close());
  await page.route(`${base}/**`,async route=>{
    const url=new URL(route.request().url()),json=(data:unknown)=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    if(url.pathname==='/rest/v1/members')return json([{room_id:room,role:'musician',rooms:{id:room,name:'Banda Shalom',join_code:'A1B2C3D4E5F6',owner_id:'other'}}]);
    if(url.pathname.includes('shalom_director')||url.pathname.includes('list_shalom_members'))accessCalls.push(url.pathname);
    if(url.pathname==='/rest/v1/scores')return json([]);return json(null);
  });
  await page.addInitScript(({id})=>{
    const now=Math.floor(Date.now()/1000),b64=(value:object)=>btoa(JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    localStorage.setItem('sb-vzccxwihuhcjydyjrzym-auth-token',JSON.stringify({access_token:`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:id,role:'authenticated',is_anonymous:true,exp:now+3600})}.test`,refresh_token:'test',expires_at:now+3600,expires_in:3600,token_type:'bearer',user:{id,is_anonymous:true,app_metadata:{provider:'anonymous'},user_metadata:{},aud:'authenticated',created_at:new Date().toISOString()}}));
  },{id});
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Enviar partituras',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Importar programação',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Fechar programação',exact:true}).click();
  await page.getByRole('button',{name:/^(Nossa banda|Banda)$/}).click();
  await expect(page.getByText('Todos que entram pelo código podem enviar hinos.',{exact:false})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Responsáveis',exact:true})).toHaveCount(0);
  expect(accessCalls).toEqual([]);
});

test('entrada por código é padrão e criar outra banda exige escolha explícita',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/^(Nossa banda|Banda)$/}).click();
  await page.getByRole('button',{name:'Conectar à banda',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pelo código',exact:true})).toHaveClass(/active/);
  await expect(page.getByText('Use o código da banda para receber e enviar hinos, sem criar conta.')).toBeVisible();
  await page.getByRole('button',{name:'Com minha conta',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Criar uma nova banda'})).not.toBeChecked();
  await expect(page.getByLabel('Código da banda existente')).toBeVisible();
});
