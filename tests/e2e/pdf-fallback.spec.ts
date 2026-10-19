import {test,expect} from '@playwright/test';
import {PDFDocument,StandardFonts} from 'pdf-lib';
test.use({serviceWorkers:'block'});
test('worker que não responde deixa de carregar e abre pelo modo compatível',async({page})=>{
  await page.addInitScript(()=>{
    window.Worker=class {addEventListener(){} terminate(){}} as unknown as typeof Worker;
  });
  await page.goto('/');await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible({timeout:20000});
  await page.locator('.pdf-page[data-active=true] .page-loading').waitFor({state:'hidden',timeout:20000});
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
});
test('abre o PDF sem worker quando a criação do processo em segundo plano falha',async({page})=>{
  await page.addInitScript(()=>{
    window.Worker=class {constructor(){throw new Error('Worker indisponível neste navegador');}} as unknown as typeof Worker;
  });
  await page.goto('/');await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await page.locator('.pdf-page[data-active=true] .page-loading').waitFor({state:'hidden'});
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await page.getByRole('button',{name:'Próxima página'}).click();
  await expect(page.getByLabel('Partitura, página 2')).toBeVisible();
});

test('falha de renderização mostra erro e permite tentar novamente sem perder o PDF',async({page})=>{
  await page.addInitScript(()=>{
    const prototype=HTMLCanvasElement.prototype,original=prototype.getContext;
    Object.assign(window,{failPdfRender:false});
    prototype.getContext=function(this:HTMLCanvasElement,...args:unknown[]) {
      if((window as unknown as {failPdfRender:boolean}).failPdfRender)throw new Error('Não foi possível preparar esta página.');
      return (original as (...args:unknown[])=>void).apply(this,args);
    } as typeof original;
  });
  await page.goto('/');await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.evaluate(()=>Object.assign(window,{failPdfRender:true}));
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível preparar esta página.');
  await expect(page.locator('.pdf-page[data-active=true] .page-loading .spin')).toHaveCount(0);
  await page.evaluate(()=>Object.assign(window,{failPdfRender:false}));
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await page.locator('.pdf-page[data-active=true] .page-loading').waitFor({state:'hidden'});
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
});

test('recarrega offline mantendo a página, os marcadores e o PDF salvo',async({page,context})=>{
  await page.goto('/');await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await page.getByRole('button',{name:'Próxima página'}).click();
  await expect(page.getByLabel('Partitura, página 2')).toBeVisible();
  await page.getByRole('button',{name:'Marcadores',exact:true}).click();
  await page.getByLabel('Nome do marcador').fill('Retorno');
  await page.getByRole('button',{name:'Marcar página atual'}).click();
  await page.getByRole('button',{name:'Fechar marcadores'}).click();
  await context.setOffline(true);
  await page.getByRole('button',{name:'Recarregar partitura',exact:true}).click();
  await expect(page.getByLabel('Partitura, página 2')).toBeVisible();
  await page.getByRole('button',{name:'Marcadores',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Retorno Pág\./})).toBeVisible();
});

for(const corrupted of [false,true])test(corrupted?'recupera automaticamente um PDF local corrompido pela rede':'recarregar baixa uma cópia nova mesmo com PDF em cache',async({page})=>{
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText('Nova copia da partitura',{x:30,y:300,size:22,font});
  const bytes=Buffer.from(await pdf.save()),downloads:string[]=[];
  await page.route('**/storage/v1/object/scores/**',async route=>{
    downloads.push(route.request().url());
    await route.fulfill({contentType:'application/pdf',body:bytes});
  });
  await page.goto('/');await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.evaluate(async corrupted=>{
    const request=indexedDB.open('shalom-v1');
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(['scores','pdfs','annotations'],'readwrite'),store=tx.objectStore('scores'),get=store.get('demo-0');
      get.onsuccess=()=>store.put({...get.result,storagePath:'test/current/recovery.pdf'});
      tx.objectStore('annotations').put({bookmarks:[{id:'saved',page:1,label:'Anotação salva'}]},'demo-0');
      if(corrupted)tx.objectStore('pdfs').put(new TextEncoder().encode('Arquivo danificado').buffer,'demo-0');
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
    });db.close();
  },corrupted);
  await page.reload();
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  if(!corrupted){
    expect(downloads).toHaveLength(0);
    // Simulate a canvas that Safari discarded while retaining the PDF bytes.
    await page.getByLabel('Partitura, página 1').evaluate(canvas=>(canvas as HTMLCanvasElement).width=0);
    await page.getByRole('button',{name:'Recarregar partitura',exact:true}).click();
  }
  await expect.poll(()=>downloads.length).toBe(1);
  expect(new URL(downloads[0]).searchParams.has('cacheNonce')).toBe(true);
  await page.locator('.pdf-page[data-active=true] .page-loading').waitFor({state:'hidden'});
  const canvas=page.getByLabel('Partitura, página 1');
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate(element=>{const c=element as HTMLCanvasElement;return c.width*c.height;})).toBeLessThanOrEqual(2000000);
  await page.getByRole('button',{name:'Marcadores',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Anotação salva Pág\./})).toBeVisible();
});
