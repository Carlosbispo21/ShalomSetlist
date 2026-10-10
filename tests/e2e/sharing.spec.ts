import {test,expect} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';

test('compartilha o PDF original pelo menu do navegador e respeita cancelamento',async({page})=>{
  await page.addInitScript(()=>{
    const win=window as typeof window & {shared:{name:string;type:string;size:number}[]}; win.shared=[];
    Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});
    Object.defineProperty(navigator,'share',{value:async(data:ShareData)=>{
      for(const file of data.files??[]) win.shared.push({name:file.name,type:file.type,size:file.size});
      throw new DOMException('Canceled','AbortError');
    },configurable:true});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await page.getByRole('button',{name:'Compartilhar PDF',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {shared:unknown[]}).shared.length)).toBe(1);
  const [shared]=await page.evaluate(()=>(window as unknown as {shared:{name:string;type:string;size:number}[]}).shared);
  expect(shared.type).toBe('application/pdf'); expect(shared.name).toMatch(/\.pdf$/); expect(shared.size).toBeGreaterThan(100);
  await expect(page.getByText('Não foi possível compartilhar o PDF. Tente novamente.')).toHaveCount(0);
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
});

test('APK importa PDF do provedor Drive, remove a cópia temporária e compartilha arquivo privado',async({page})=>{
  const pdf=await PDFDocument.create(); pdf.addPage(); const bytes=Buffer.from(await pdf.save());
  await page.addInitScript(()=>{
    const win=window as typeof window & {androidBridge:object;Capacitor:object;nativeCalls:{plugin:string;method:string;options:Record<string,unknown>}[]};
    win.androidBridge={}; win.nativeCalls=[];
    const methods=(names:string[])=>names.map(name=>({name,rtype:'promise'}));
    win.Capacitor={PluginHeaders:[{name:'ReaderDisplay',methods:methods(['setReading','openApk'])},{name:'ScoreFiles',methods:methods(['pickPdfs'])},{name:'Filesystem',methods:methods(['mkdir','readdir','writeFile','deleteFile'])},{name:'Share',methods:methods(['share'])}],
      nativePromise:(plugin:string,method:string,options:Record<string,unknown>)=>{
        win.nativeCalls.push({plugin,method,options});
        if(plugin==='ScoreFiles')return Promise.resolve({files:[{name:'Drive ensaio.pdf',uri:'file:///cache/shalom-import-test.pdf'}]});
        if(method==='readdir')return Promise.resolve({files:[]});
        if(method==='writeFile')return Promise.resolve({uri:'file:///cache/shalom-shared/test.pdf'});
        return Promise.resolve({});
      },convertFileSrc:(uri:string)=>`http://localhost:4173/_capacitor_file_${uri.replace('file://','')}`};
  });
  await page.route('**/_capacitor_file_/cache/shalom-import-test.pdf',route=>route.fulfill({contentType:'application/pdf',body:bytes}));
  await page.goto('/');
  await page.getByRole('button',{name:'Adicionar partituras',exact:true}).click();
  await page.getByRole('button',{name:'Importar do Google Drive',exact:true}).click();
  await expect(page.getByLabel('Nome do hino')).toHaveValue('Drive ensaio');
  await page.getByRole('button',{name:'Salvar neste aparelho'}).click();
  await page.getByRole('button',{name:/^Drive ensaio/}).click();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await page.getByRole('button',{name:'Compartilhar PDF',exact:true}).click();
  const calls=()=>page.evaluate(()=>(window as unknown as {nativeCalls:{plugin:string;method:string;options:Record<string,unknown>}[]}).nativeCalls);
  await expect.poll(async()=>(await calls()).filter(call=>call.plugin==='Share').length).toBe(1);
  expect(await calls()).toContainEqual({plugin:'Filesystem',method:'deleteFile',options:{path:'file:///cache/shalom-import-test.pdf'}});
  expect((await calls()).find(call=>call.method==='writeFile')?.options.data).toBe(bytes.toString('base64'));
  expect((await calls()).find(call=>call.plugin==='Share')?.options.files).toEqual(['file:///cache/shalom-shared/test.pdf']);
});
