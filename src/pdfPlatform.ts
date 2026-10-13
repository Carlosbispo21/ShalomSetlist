import 'core-js/stable';
import {ReadableStream,WritableStream,TransformStream} from 'web-streams-polyfill';
// Worker globals are a different environment from the browser window. Vite's
// window polyfills do not supply Streams/clone APIs inside the PDF worker.
if(typeof globalThis.ReadableStream==='undefined')Object.assign(globalThis,{ReadableStream,WritableStream,TransformStream});
export function allowCopyTransfers() {
  // The in-window PDF fallback does not need to detach buffers. Safari 12
  // cannot implement synchronous transferable cloning; copying is sufficient.
  const clone=globalThis.structuredClone;
  globalThis.structuredClone=(value,options)=>{
    try{return clone(value,options??undefined);}
    catch(error){
      if(options?.transfer?.every(item=>item instanceof ArrayBuffer))return clone(value);
      throw error;
    }
  };
}
