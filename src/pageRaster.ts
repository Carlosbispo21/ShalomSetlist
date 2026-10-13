import type {PDFDocumentProxy} from 'pdfjs-dist';
import {pdfDeadline} from './pdfEngine';
type Raster={canvas:HTMLCanvasElement;ratio:number;width:number};
const documents=new WeakMap<PDFDocumentProxy,Map<string,Promise<Raster>>>();
export function renderPage(pdf:PDFDocumentProxy,number:number,width:number):Promise<Raster> {
  let cache=documents.get(pdf);if(!cache){cache=new Map();documents.set(pdf,cache);}
  const pixels=Math.max(1,Math.round(width*Math.min(devicePixelRatio||1,'PointerEvent' in window?2:1)));
  const key=`${number}:${pixels}`;
  const existing=cache.get(key);if(existing)return existing;
  const rendered=(async()=>{
    const page=await pdfDeadline(pdf.getPage(number),30000,'Não foi possível preparar esta página. Tente novamente.'),original=page.getViewport({scale:1}),viewport=page.getViewport({scale:pixels/original.width});
    const canvas=document.createElement('canvas');canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);
    const task=page.render({canvasContext:canvas.getContext('2d')!,viewport});
    try{await pdfDeadline(task.promise,45000,'A página demorou para responder. Tente novamente.');}
    catch(error){task.cancel();throw error;}
    return {canvas,ratio:original.height/original.width,width:original.width};
  })();
  cache.set(key,rendered);void rendered.catch(()=>cache!.delete(key));
  while(cache.size>4)cache.delete(cache.keys().next().value!);
  return rendered;
}
