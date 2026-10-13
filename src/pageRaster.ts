import type {PDFDocumentProxy} from 'pdfjs-dist';
type Raster={canvas:HTMLCanvasElement;ratio:number;width:number};
const documents=new WeakMap<PDFDocumentProxy,Map<string,Promise<Raster>>>();
export function renderPage(pdf:PDFDocumentProxy,number:number,width:number):Promise<Raster> {
  let cache=documents.get(pdf);if(!cache){cache=new Map();documents.set(pdf,cache);}
  const pixels=Math.max(1,Math.round(width*Math.min(devicePixelRatio||1,'PointerEvent' in window?2:1)));
  const key=`${number}:${pixels}`;
  const existing=cache.get(key);if(existing)return existing;
  const rendered=(async()=>{
    const page=await pdf.getPage(number),original=page.getViewport({scale:1}),viewport=page.getViewport({scale:pixels/original.width});
    const canvas=document.createElement('canvas');canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d')!,viewport}).promise;
    return {canvas,ratio:original.height/original.width,width:original.width};
  })();
  cache.set(key,rendered);void rendered.catch(()=>cache!.delete(key));
  while(cache.size>4)cache.delete(cache.keys().next().value!);
  return rendered;
}
