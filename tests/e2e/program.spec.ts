import {test,expect,type Page} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';
const base='https://vzccxwihuhcjydyjrzym.supabase.co',id='11111111-1111-4111-8111-111111111111',room='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const message='A paz a todos, segue programação do final de semana!\nAdolescentes:\nEu Creio - Sarah Beatriz\nMocidade:\nEm Tua Presença - Diante do Trono\nVarões:\nVisitando um Amigo - Canção e Louvor\nIrmãs:\nEsse Adorador - Shirley Carvalhaes\nGrupo de louvor:\nMeu Deus é Grande';
const names=['Eu Creio - Sarah Beatriz','Em Tua Presença - Diante do Trono','Visitando um Amigo - Canção e Louvor','Esse Adorador - Shirley Carvalhaes','Meu Deus é Grande'];
const groups=['Adolescentes','Jovens','Varões','Irmãs','Grupo de louvor'];
async function mock(page:Page,ambiguous=false,failSecond=false){
  const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());
  const rows:Record<string,unknown>[]=[],downloads:string[]=[];let attempts=0;
  await page.routeWebSocket('wss://vzccxwihuhcjydyjrzym.supabase.co/**',ws=>ws.close());
  await page.route(`${base}/**`,async route=>{
    const url=new URL(route.request().url()),json=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(route.request().method()==='OPTIONS')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'}});
    if(url.pathname==='/rest/v1/members')return json([{room_id:room,role:'director',rooms:{id:room,name:'Banda Shalom',join_code:'A1B2C3D4E5F6',owner_id:id}}]);
    if(url.pathname==='/rest/v1/scores'){if(route.request().method()==='POST'){rows.push(route.request().postDataJSON());return json(null,201);}return json(rows);}
    if(url.pathname.startsWith('/storage/v1/object/scores/')&&route.request().method()==='POST'){
      attempts++;if(failSecond&&attempts===2)return route.abort('failed');return json({Key:url.pathname});
    }
    return json(null);
  });
  await page.route('**/api/drive',async route=>{
    const input=route.request().postDataJSON();
    if(input.action==='file'){downloads.push(input.id);return route.fulfill({contentType:'application/json',body:JSON.stringify({name:`${names[Number(input.id.slice(-1))]}.pdf`,base64:bytes.toString('base64')})});}
    const files=names.map((name,i)=>({id:`drive-file-${i}`,name:`${name}.pdf`,path:`shalom/${i===4?'Avulsos':i===1?'Mocidade':groups[i]}/${name}/PDF/${name}.pdf`,group:groups[i],aliases:[name],size:bytes.length}));
    if(ambiguous)files.push({...files[0],id:'drive-alternate-0',path:'shalom/Adolescentes/Eu Creio/Outra versão.pdf'});
    return route.fulfill({contentType:'application/json',body:JSON.stringify({files})});
  });
  await page.addInitScript(({id})=>{const now=Math.floor(Date.now()/1000),b64=(value:object)=>btoa(JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');localStorage.setItem('sb-vzccxwihuhcjydyjrzym-auth-token',JSON.stringify({access_token:`${b64({alg:'HS256'})}.${b64({sub:id,role:'authenticated',exp:now+3600})}.test`,refresh_token:'test',expires_at:now+3600,user:{id,email:'owner@example.test',app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated'}}));},{id});
  return {rows,downloads};
}
test('mensagem seleciona os PDFs, exige dia e publica ambos sem duplicar importação',async({page})=>{
  const calls=await mock(page);await page.goto('/');await page.getByRole('button',{name:'Importar programação',exact:true}).click();
  await page.getByLabel('Mensagem da programação').fill(message);await page.getByRole('button',{name:'Buscar PDFs no Drive'}).click();
  await expect(page.getByLabel('PDF de Meu Deus é Grande')).toHaveValue('drive-file-4');
  await expect(page.getByRole('button',{name:'Enviar programação para a banda'})).toBeDisabled();
  await page.getByLabel('Dia da programação',{exact:true}).selectOption('both');
  await page.getByLabel('Dia de Eu Creio',{exact:true}).selectOption('saturday');
  await page.getByRole('button',{name:'Enviar programação para a banda'}).click();await expect(page.getByRole('dialog',{name:'Importar programação'})).toHaveCount(0);
  expect(calls.rows).toHaveLength(9);expect(calls.downloads).toHaveLength(5);expect(calls.rows.filter(row=>row.group_name==='Jovens')).toHaveLength(2);expect(calls.rows.filter(row=>row.group_name==='Grupo de louvor')).toHaveLength(2);
  await page.getByRole('button',{name:'Importar programação',exact:true}).click();await page.getByLabel('Mensagem da programação').fill(message);await page.getByLabel('Dia da programação',{exact:true}).selectOption('both');await page.getByLabel('Dia de Eu Creio',{exact:true}).count();
  await page.getByRole('button',{name:'Buscar PDFs no Drive'}).click();await page.getByLabel('Dia de Eu Creio',{exact:true}).selectOption('saturday');
  await page.getByRole('button',{name:'Enviar programação para a banda'}).click();await expect(page.getByRole('dialog',{name:'Importar programação'})).toHaveCount(0);expect(calls.rows).toHaveLength(9);expect(calls.downloads).toHaveLength(5);
});
test('duas versões exigem escolha e falha parcial permite continuar sem repetir o primeiro hino',async({page})=>{
  const calls=await mock(page,true,true);await page.goto('/');await page.getByRole('button',{name:'Importar programação',exact:true}).click();await page.getByLabel('Mensagem da programação').fill(message);await page.getByLabel('Dia da programação',{exact:true}).selectOption('sunday');await page.getByRole('button',{name:'Buscar PDFs no Drive'}).click();
  await expect(page.getByLabel('PDF de Eu Creio')).toHaveValue('');await expect(page.getByRole('button',{name:'Enviar programação para a banda'})).toBeDisabled();await page.getByLabel('PDF de Eu Creio').selectOption('drive-file-0');await page.getByRole('button',{name:'Enviar programação para a banda'}).click();
  await expect(page.getByRole('alert')).toContainText('hinos já enviados serão preservados');expect(calls.rows).toHaveLength(1);await page.getByRole('button',{name:'Enviar programação para a banda'}).click();await expect(page.getByRole('dialog',{name:'Importar programação'})).toHaveCount(0);expect(calls.rows).toHaveLength(5);expect(calls.rows.filter(row=>row.title==='Eu Creio')).toHaveLength(1);
  await page.getByRole('button',{name:'Importar programação',exact:true}).click();await page.getByLabel('Mensagem da programação').fill(message);await page.getByRole('button',{name:'Buscar PDFs no Drive'}).click();await expect(page.getByLabel('PDF de Eu Creio')).toHaveValue('drive-file-0');
});
test('APK recebe texto compartilhado e preserva a programação nova enquanto envia a anterior',async({page})=>{
  const calls=await mock(page);
  await page.addInitScript(({message})=>{
    const win=window as unknown as typeof window & {androidBridge:object;Capacitor:object;pendingProgram:string;programCalls:{method:string;options:Record<string,unknown>}[]};
    win.androidBridge={};win.pendingProgram=message;win.programCalls=[];
    const methods=(names:string[])=>names.map(name=>({name,rtype:'promise'}));
    win.Capacitor={PluginHeaders:[{name:'Programs',methods:methods(['pending','clear'])}],nativePromise:(plugin:string,method:string,options:Record<string,unknown>)=>{
      if(plugin==='Programs'){win.programCalls.push({method,options});if(method==='pending')return Promise.resolve({text:win.pendingProgram});if(method==='clear'&&options.text===win.pendingProgram)win.pendingProgram='';}
      return Promise.resolve({});
    }};
  },{message});
  await page.goto('/');await expect(page.getByText('Programação recebida. Confira os PDFs e os dias.')).toBeVisible();
  await page.getByRole('button',{name:'Importar programação',exact:true}).click();await expect(page.getByLabel('Mensagem da programação')).toHaveValue(message);await page.getByLabel('Dia da programação',{exact:true}).selectOption('sunday');await page.getByRole('button',{name:'Buscar PDFs no Drive'}).click();
  const latest='Domingo\nAvulsos:\nMeu Deus é Grande';
  await page.evaluate(latest=>{Object.assign(window,{pendingProgram:latest});window.dispatchEvent(new Event('shalom-program-received'));},latest);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('shalom-program-draft'))).toBe(latest);await expect(page.getByLabel('Mensagem da programação')).toHaveValue(message);
  await page.getByRole('button',{name:'Enviar programação para a banda'}).click();await expect(page.getByRole('dialog',{name:'Importar programação'})).toHaveCount(0);expect(calls.rows).toHaveLength(5);
  await page.getByRole('button',{name:'Importar programação',exact:true}).click();await expect(page.getByLabel('Mensagem da programação')).toHaveValue(latest);
  await expect(page.getByText('Copie e cole a mensagem aqui ou use Compartilhar → Shalom')).toBeVisible();
  await expect(page.getByRole('button',{name:'Configurar recebimento automático'})).toHaveCount(0);
  expect(await page.evaluate(()=>(window as unknown as {programCalls:{method:string}[]}).programCalls.some(call=>call.method==='settings'||call.method==='status'))).toBe(false);
});
