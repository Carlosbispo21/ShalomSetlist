import {test,expect} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';

test.beforeEach(async({page},info)=>{
  if(info.project.name==='ipad-legacy-apis')await page.route('**/*',async route=>{
    if(route.request().resourceType()!=='document')return route.continue();
    const response=await route.fetch();
    // Safari 12 runs Vite's SystemJS bundle. Removing APIs alone from a
    // modern module browser does not exercise that separate build.
    const html=(await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/\snomodule\b/g,'');
    await route.fulfill({response,body:html});
  });
  if(info.project.name==='ipad-legacy-apis')await page.addInitScript(()=>{
    delete (window as unknown as Record<string,unknown>).PointerEvent;
    delete (window as unknown as Record<string,unknown>).IntersectionObserver;
    delete (window as unknown as Record<string,unknown>).IntersectionObserverEntry;
    Object.defineProperty(window,'ReadableStream',{value:undefined,configurable:true,writable:true});
    Object.defineProperty(window,'structuredClone',{value:undefined,configurable:true,writable:true});
    Object.defineProperty(window,'Worker',{value:undefined,configurable:true,writable:true});
    Object.defineProperty(window,'ResizeObserver',{value:undefined,configurable:true,writable:true});
    Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true,writable:true});
    Object.defineProperty(Blob.prototype,'arrayBuffer',{value:undefined,configurable:true,writable:true});
    Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true,writable:true});
  });
});

test('folha acompanha o dedo, cancela gesto curto e reutiliza as telas preparadas',async({page},info)=>{
  await page.goto('/');await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await expect(page.locator('.pdf-page canvas')).toHaveCount(2);
  await page.locator('[data-page="1"] canvas').evaluate(element=>(element as HTMLElement).dataset.buffer='first');
  await page.locator('[data-page="2"] canvas').evaluate(element=>(element as HTMLElement).dataset.buffer='second');
  await page.evaluate(()=>{
    const original=document.createElement;
    Object.assign(window,{turnCanvases:0});
    document.createElement=function(...args:unknown[]){if(args[0]==='canvas')(window as unknown as {turnCanvases:number}).turnCanvases++;return (original as (...args:unknown[])=>HTMLElement).apply(document,args);} as typeof original;
  });
  const size=page.viewportSize()!;
  const dispatch=async(type:string,x:number,end=false)=>page.locator('.reader-scroll').evaluate((element,{type,x,end})=>{
    const finger={identifier:3,target:element,clientX:x,clientY:window.innerHeight*.5};
    const event=new Event(type,{bubbles:true,cancelable:true});
    Object.defineProperties(event,{touches:{value:end?[]:[finger]},changedTouches:{value:[finger]}});element.dispatchEvent(event);
  },{type,x,end});
  await dispatch('touchstart',size.width*.7);
  await dispatch('touchmove',size.width*.7-18);
  await expect(page.locator('.page-stage')).toHaveClass(/dragging/);
  await expect(page.locator('[data-sheet="1"]')).toHaveCSS('transform',/matrix.*-18/);
  await page.screenshot({path:`artifacts/${info.project.name}-page-drag.png`});
  await dispatch('touchend',size.width*.7-18,true);
  await expect(page.locator('[data-sheet="1"]')).not.toHaveAttribute('aria-hidden','true');
  await page.getByRole('button',{name:'Próxima página'}).click();
  await expect(page.locator('[data-sheet="2"]')).not.toHaveAttribute('aria-hidden','true');
  await expect(page.locator('[data-page="2"] canvas')).toHaveAttribute('data-buffer','second');
  await page.getByRole('button',{name:'Página anterior'}).click();
  await expect(page.locator('[data-sheet="1"]')).not.toHaveAttribute('aria-hidden','true');
  await expect(page.locator('[data-page="1"] canvas')).toHaveAttribute('data-buffer','first');
  await expect(page.locator('.pdf-page canvas')).toHaveCount(2);
  expect(await page.evaluate(()=>(window as unknown as {turnCanvases:number}).turnCanvases)).toBe(0);
});

test('marcador retorna à página e continua salvo ao reabrir offline',async({page,context})=>{
  await page.goto('/');await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await page.getByRole('button',{name:'Próxima página'}).click();
  await expect(page.locator('[data-sheet="2"]')).not.toHaveAttribute('aria-hidden','true');
  await page.getByRole('button',{name:'Marcadores',exact:true}).click();
  await page.getByLabel('Nome do marcador').fill('Refrão');
  await page.getByRole('button',{name:'Marcar página atual'}).click();
  await page.getByRole('button',{name:'Fechar marcadores'}).click();
  await page.getByRole('button',{name:'Página anterior'}).click();
  await expect(page.locator('[data-sheet="1"]')).not.toHaveAttribute('aria-hidden','true');
  await page.getByRole('button',{name:'Marcadores',exact:true}).click();
  await page.getByRole('button',{name:'Refrão Pág. 2'}).click();
  await expect(page.locator('[data-sheet="2"]')).not.toHaveAttribute('aria-hidden','true');
  await page.getByRole('button',{name:'Voltar ao repertório'}).click();
  await context.setOffline(true);
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await page.getByRole('button',{name:'Marcadores',exact:true}).click();
  await page.getByRole('button',{name:'Refrão Pág. 2'}).click();
  await expect(page.locator('[data-sheet="2"]')).not.toHaveAttribute('aria-hidden','true');
  await page.getByRole('button',{name:'Marcadores',exact:true}).click();
  await page.getByRole('button',{name:'Excluir marcador Refrão'}).click();
  await expect(page.getByRole('button',{name:'Refrão Pág. 2'})).toHaveCount(0);
});

test('PDF longo mantém somente a folha atual e vizinhas e centraliza a partitura',async({page})=>{
  const document=await PDFDocument.create();for(let i=0;i<8;i++)document.addPage([595,842]);
  await page.goto('/');await page.getByRole('button',{name:'Adicionar partituras',exact:true}).click();
  await page.getByLabel('Selecionar PDFs').setInputFiles({name:'Oito páginas.pdf',mimeType:'application/pdf',buffer:Buffer.from(await document.save())});
  await page.getByRole('button',{name:'Salvar neste aparelho'}).click();
  await page.getByRole('button',{name:/^Oito páginas/}).click();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  const width=page.viewportSize()!.width;
  await expect.poll(async()=>{const box=(await page.locator('.pdf-page[data-active=true]').boundingBox())!;return Math.abs(box.x+box.width/2-width/2);}).toBeLessThan(1);
  for(let number=2;number<=8;number++){
    await page.getByRole('button',{name:'Próxima página'}).click();
    await expect(page.locator(`[data-sheet="${number}"]`)).not.toHaveAttribute('aria-hidden','true');
    expect(await page.locator('.pdf-page canvas').count()).toBeLessThanOrEqual(3);
  }
  await page.getByRole('button',{name:'Página anterior'}).click();
  await expect(page.locator('[data-sheet="7"]')).not.toHaveAttribute('aria-hidden','true');
  await expect(page.locator('[data-page="7"] canvas')).toHaveCount(1);
});
async function touch(page:import('@playwright/test').Page,selector:string,from:{x:number;y:number},to:{x:number;y:number}) {
  await page.locator(selector).evaluate((element,{from,to})=>{
    const dispatch=(type:string,point:{x:number;y:number},end=false)=>{
      const finger={identifier:7,target:element,clientX:point.x,clientY:point.y,pageX:point.x,pageY:point.y,screenX:point.x,screenY:point.y};
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperties(event,{touches:{value:end?[]:[finger]},changedTouches:{value:[finger]},targetTouches:{value:end?[]:[finger]}});
      element.dispatchEvent(event);
    };
    dispatch('touchstart',from);dispatch('touchmove',to);dispatch('touchend',to,true);
  },{from,to});
}
test('toque desenha, persiste, desfaz e não troca a folha enquanto a caneta está ativa',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await page.locator('.pdf-page[data-active=true] .page-loading').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Caneta',exact:true}).click();
  await page.getByLabel('Espessura da caneta').selectOption('4');
  const bounds=(await page.locator('.pdf-page[data-active=true] .ink-layer').boundingBox())!;
  if(info.project.name!=='tablet'){
    await page.touchscreen.tap(bounds.x+bounds.width*.5,bounds.y+bounds.height*.35);
    await expect(page.locator('.ink-layer polyline')).toHaveCount(1);
    await page.getByRole('button',{name:'Desfazer último traço'}).click();
    await expect(page.locator('.ink-layer polyline')).toHaveCount(0);
  }
  await touch(page,'.pdf-page[data-active=true] .ink-layer',{x:bounds.x+bounds.width*.7,y:bounds.y+bounds.height*.4},{x:bounds.x+bounds.width*.3,y:bounds.y+bounds.height*.45});
  await expect(page.locator('.ink-layer polyline')).toHaveCount(1);
  await expect(page.locator('.ink-layer polyline')).toHaveAttribute('stroke-width','4');
  await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await page.getByRole('button',{name:'Voltar ao repertório'}).click();
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await expect(page.locator('.ink-layer polyline')).toHaveCount(1);
  await page.getByRole('button',{name:'Caneta',exact:true}).click();
  await page.getByRole('button',{name:'Desfazer último traço'}).click();
  await expect(page.locator('.ink-layer polyline')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('deslizar troca a página sem desmontar a folha e pedal PageDown/PageUp funciona',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Explorar com exemplos'}).click();
  await page.getByRole('button',{name:/^Exemplo 01/}).click();
  await page.locator('.pdf-page[data-active=true] .page-loading').waitFor({state:'hidden'});
  await expect(page.locator('[data-page="2"] canvas')).toHaveCount(1);
  await page.locator('[data-page="2"] canvas').evaluate(element=>(element as HTMLElement).dataset.retained='yes');
  const viewport=page.viewportSize()!;
  await touch(page,'.reader-scroll',{x:viewport.width*.8,y:viewport.height*.5},{x:viewport.width*.2,y:viewport.height*.5});
  await expect(page.getByLabel('Partitura, página 2')).toBeVisible();
  await expect(page.locator('[data-page="2"] canvas')).toHaveAttribute('data-retained','yes');
  await expect(page.locator('.page-loading')).toHaveCount(0);
  await page.getByRole('button',{name:'Ocultar controles'}).click();
  await page.keyboard.press('PageUp');await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await page.keyboard.press('PageDown');await expect(page.getByLabel('Partitura, página 2')).toBeVisible();
  await page.keyboard.press('PageDown');await expect(page.getByRole('heading',{name:'Exemplo 02'})).toBeVisible();
});
