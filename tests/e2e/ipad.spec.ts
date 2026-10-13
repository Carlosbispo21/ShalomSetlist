import {test,expect} from '@playwright/test';

test.beforeEach(async({page},info)=>{
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
  await page.locator('.page-loading').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Caneta',exact:true}).click();
  await page.getByLabel('Espessura da caneta').selectOption('4');
  const bounds=(await page.locator('.ink-layer').boundingBox())!;
  if(info.project.name!=='tablet'){
    await page.touchscreen.tap(bounds.x+bounds.width*.5,bounds.y+bounds.height*.35);
    await expect(page.locator('.ink-layer polyline')).toHaveCount(1);
    await page.getByRole('button',{name:'Desfazer último traço'}).click();
    await expect(page.locator('.ink-layer polyline')).toHaveCount(0);
  }
  await touch(page,'.ink-layer',{x:bounds.x+bounds.width*.7,y:bounds.y+bounds.height*.4},{x:bounds.x+bounds.width*.3,y:bounds.y+bounds.height*.45});
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
  await page.locator('.page-loading').waitFor({state:'hidden'});
  await page.locator('.pdf-page').evaluate(element=>(element as HTMLElement).dataset.retained='yes');
  const viewport=page.viewportSize()!;
  await touch(page,'.reader-scroll',{x:viewport.width*.8,y:viewport.height*.5},{x:viewport.width*.2,y:viewport.height*.5});
  await expect(page.getByLabel('Partitura, página 2')).toBeVisible();
  await expect(page.locator('.pdf-page')).toHaveAttribute('data-retained','yes');
  await expect(page.locator('.page-loading')).toHaveCount(0);
  await page.getByRole('button',{name:'Ocultar controles'}).click();
  await page.keyboard.press('PageUp');await expect(page.getByLabel('Partitura, página 1')).toBeVisible();
  await page.keyboard.press('PageDown');await expect(page.getByLabel('Partitura, página 2')).toBeVisible();
  await page.keyboard.press('PageDown');await expect(page.getByRole('heading',{name:'Exemplo 02'})).toBeVisible();
});
