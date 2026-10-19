import type {PDFDocumentProxy} from 'pdfjs-dist';
import {pdfDeadline} from './pdfEngine';
type Raster={canvas:HTMLCanvasElement;ratio:number;width:number};
const documents=new WeakMap<PDFDocumentProxy,Map<string,Promise<Raster>>>();
const queues=new WeakMap<PDFDocumentProxy,Promise<void>>();
const canvases=new WeakMap<PDFDocumentProxy,Set<HTMLCanvasElement>>();
const rasterKeys=new WeakMap<HTMLCanvasElement,string>();
const released=new WeakSet<PDFDocumentProxy>();
const generations=new WeakMap<PDFDocumentProxy,number>();
const tasks=new WeakMap<PDFDocumentProxy,Set<{cancel:()=>void}>>();
export function resetRasters(pdf:PDFDocumentProxy) {
  generations.set(pdf,(generations.get(pdf)??0)+1);
  for(const task of tasks.get(pdf)??[])task.cancel();
  tasks.delete(pdf);
  for(const canvas of canvases.get(pdf)??[]){canvas.width=0;canvas.height=0;}
  canvases.delete(pdf);documents.delete(pdf);queues.delete(pdf);
}
export function releaseRasters(pdf:PDFDocumentProxy) {
  released.add(pdf);resetRasters(pdf);
}
export function pruneRasters(pdf:PDFDocumentProxy) {
  const owned=canvases.get(pdf),cache=documents.get(pdf);
  for(const canvas of owned??[])if(!canvas.isConnected&&!cache?.has(rasterKeys.get(canvas)??'')){
    canvas.width=0;canvas.height=0;owned!.delete(canvas);
  }
}
export function renderPage(pdf:PDFDocumentProxy,number:number,width:number):Promise<Raster> {
  if(released.has(pdf))return Promise.reject(new Error('A partitura foi recarregada.'));
  const generation=generations.get(pdf)??0;
  const obsolete=()=>released.has(pdf)||(generations.get(pdf)??0)!==generation;
  let cache=documents.get(pdf);if(!cache){cache=new Map();documents.set(pdf,cache);}
  const density=Math.min(devicePixelRatio||1,'PointerEvent' in window?2:1);
  // Match clientWidth's CSS-pixel rounding for both preflight and mounted
  // sheets. A fractional fit width must not create a second Retina raster.
  const pixels=Math.max(1,Math.round(Math.round(width)*density));
  const key=`${number}:${pixels}`;
  const existing=cache.get(key);if(existing){cache.delete(key);cache.set(key,existing);return existing;}
  // Serialize within a document; a stuck old document cannot block a reload.
  const rendered=(queues.get(pdf)??Promise.resolve()).then(async()=>{
    const page=await pdfDeadline(pdf.getPage(number),30000,'Não foi possível preparar esta página. Tente novamente.'),original=page.getViewport({scale:1});
    // Bound bitmap memory even with Retina, zoom or very large PDF pages.
    const scale=Math.min(pixels/original.width,Math.sqrt(2000000/(original.width*original.height)),4096/Math.max(original.width,original.height));
    const viewport=page.getViewport({scale});
    if(obsolete())throw new Error('A partitura foi recarregada.');
    const canvas=document.createElement('canvas');canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);
    let owned=canvases.get(pdf);if(!owned){owned=new Set();canvases.set(pdf,owned);}owned.add(canvas);
    rasterKeys.set(canvas,key);
    let task:ReturnType<typeof page.render>|undefined;
    let active=tasks.get(pdf);if(!active){active=new Set();tasks.set(pdf,active);}
    try{
      const context=canvas.getContext('2d');
      if(!context)throw new Error('Sem memória para exibir a página. Recarregue a partitura.');
      task=page.render({canvasContext:context,viewport});
      active.add(task);
      await pdfDeadline(task.promise,45000,'A página demorou para responder. Recarregue a partitura.');
      if(obsolete())throw new Error('A partitura foi recarregada.');
    }
    catch(error){task?.cancel();canvas.width=0;canvas.height=0;owned.delete(canvas);throw error;}
    finally{if(task)active.delete(task);}
    return {canvas,ratio:original.height/original.width,width:original.width};
  });
  queues.set(pdf,rendered.then(()=>{},()=>{}));
  cache.set(key,rendered);void rendered.catch(()=>{if(cache!.get(key)===rendered)cache!.delete(key);});
  while(cache.size>3)cache.delete(cache.keys().next().value!);
  return rendered;
}
