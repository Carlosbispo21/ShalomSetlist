import './pdfPlatform';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import PdfWorker from './pdfWorker?worker';
import {allowCopyTransfers} from './pdfPlatform';
type PdfSession={document:pdfjs.PDFDocumentProxy;dispose:()=>Promise<void>};
let fallbackReady:Promise<void>|undefined;
export function pdfDeadline<T>(promise:Promise<T>,milliseconds:number,label:string):Promise<T> {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(label)),milliseconds);
    promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
}
async function windowEngine() {
  return fallbackReady??=(async()=>{
    allowCopyTransfers();
    const engine=await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    Object.assign(globalThis,{pdfjsWorker:engine});
  })().catch(error=>{fallbackReady=undefined;throw error;});
}
async function inWindow(bytes:Uint8Array):Promise<PdfSession> {
  await pdfDeadline(windowEngine(),20000,'Não foi possível carregar a leitura deste PDF. Tente novamente.');
  const task=pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false});
  try{
    const document=await pdfDeadline(task.promise,30000,'O Safari demorou para abrir o PDF. Tente novamente.');
    return {document,dispose:()=>task.destroy()};
  }catch(error){void task.destroy().catch(()=>{});throw error;}
}
export async function openPdf(bytes:Uint8Array):Promise<PdfSession> {
  if(document.documentElement.classList.contains('legacy-touch'))return inWindow(bytes);
  let worker:Worker|undefined,task:pdfjs.PDFDocumentLoadingTask|undefined,pdfWorker:pdfjs.PDFWorker|undefined;
  try{
    worker=new PdfWorker();
    await pdfDeadline(new Promise<void>((resolve,reject)=>{
      worker!.addEventListener('message',event=>{if(event.data?.shalomPdfReady)resolve();});
      worker!.addEventListener('error',()=>reject(new Error('Falha ao iniciar a leitura do PDF.')),{once:true});
    }),10000,'O processamento do PDF não iniciou.');
    pdfWorker=new pdfjs.PDFWorker({port:worker} as unknown as ConstructorParameters<typeof pdfjs.PDFWorker>[0]);
    task=pdfjs.getDocument({data:bytes.slice(),worker:pdfWorker,isEvalSupported:false});
    const document=await pdfDeadline(task.promise,20000,'O processamento do PDF não respondeu.');
    const loading=task,port=worker,bridge=pdfWorker;
    return {document,dispose:async()=>{try{await loading.destroy();}finally{bridge.destroy();port.terminate();}}};
  }catch{
    worker?.terminate();pdfWorker?.destroy();void task?.destroy().catch(()=>{});
    return inWindow(bytes);
  }
}
