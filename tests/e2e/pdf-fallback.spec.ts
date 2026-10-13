import {test,expect} from '@playwright/test';
test('worker que não responde deixa de carregar e abre pelo modo compatível',async({page})=>{
  await page.addInitScript(()=>{
    window.Worker=class {addEventListener(){} terminate(){}} as unknown as typeof Worker;
  });
  await page.goto('/');await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible({timeout:20000});
  await page.locator('.page-loading').waitFor({state:'hidden',timeout:20000});
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
});
test('abre o PDF sem worker quando a criação do processo em segundo plano falha',async({page})=>{
  await page.addInitScript(()=>{
    window.Worker=class {constructor(){throw new Error('Worker indisponível neste navegador');}} as unknown as typeof Worker;
  });
  await page.goto('/');await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await page.locator('.page-loading').waitFor({state:'hidden'});
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await page.getByRole('button',{name:'Próxima página'}).click();
  await expect(page.getByLabel('Partitura, página 2')).toBeVisible();
});

test('falha de renderização mostra erro e permite tentar novamente sem perder o PDF',async({page})=>{
  await page.addInitScript(()=>{
    const prototype=CanvasRenderingContext2D.prototype,original=prototype.drawImage;
    Object.assign(window,{failPdfRender:false});
    prototype.drawImage=function(this:CanvasRenderingContext2D,...args:unknown[]) {
      if((window as unknown as {failPdfRender:boolean}).failPdfRender)throw new Error('Não foi possível preparar esta página.');
      return (original as (...args:unknown[])=>void).apply(this,args);
    } as typeof original;
  });
  await page.goto('/');await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.evaluate(()=>Object.assign(window,{failPdfRender:true}));
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível preparar esta página.');
  await expect(page.locator('.page-loading .spin')).toHaveCount(0);
  await page.evaluate(()=>Object.assign(window,{failPdfRender:false}));
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await page.locator('.page-loading').waitFor({state:'hidden'});
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
});
