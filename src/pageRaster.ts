import type {PDFDocumentProxy} from 'pdfjs-dist';
import {pdfDeadline} from './pdfEngine';
type Raster={canvas:HTMLCanvasElement;ratio:number;width:number};
const documents=new WeakMap<PDFDocumentProxy,Map<string,Promise<Raster>>>();
// Render one canvas at a time: the Safari 12 fallback shares the UI thread.
let rendering=Promise.resolve();
export function renderPage(pdf:PDFDocumentProxy,number:number,width:number):Promise<Raster> {
  let cache=documents.get(pdf);if(!cache){cache=new Map();documents.set(pdf,cache);}
  const density=Math.min(devicePixelRatio||1,'PointerEvent' in window?2:1);
  // Match clientWidth's CSS-pixel rounding for both preflight and mounted
  // sheets. A fractional fit width must not create a second Retina raster.
  const pixels=Math.max(1,Math.round(Math.round(width)*density));
  const key=`${number}:${pixels}`;
  const existing=cache.get(key);if(existing){cache.delete(key);cache.set(key,existing);return existing;}
  const rendered=rendering.then(async()=>{
    const page=await pdfDeadline(pdf.getPage(number),30000,'Não foi possível preparar esta página. Tente novamente.'),original=page.getViewport({scale:1}),viewport=page.getViewport({scale:pixels/original.width});
    const canvas=document.createElement('canvas');canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);
    const task=page.render({canvasContext:canvas.getContext('2d')!,viewport});
    try{await pdfDeadline(task.promise,45000,'A página demorou para responder. Tente novamente.');}
    catch(error){task.cancel();throw error;}
    return {canvas,ratio:original.height/original.width,width:original.width};
  });
  rendering=rendered.then(()=>{},()=>{});
  cache.set(key,rendered);void rendered.catch(()=>{if(cache!.get(key)===rendered)cache!.delete(key);});
  while(cache.size>3)cache.delete(cache.keys().next().value!);
  return rendered;
}
