import 'abortcontroller-polyfill/dist/polyfill-patch-fetch';
import 'intersection-observer';
import ResizeObserverPolyfill from 'resize-observer-polyfill';
// Platform APIs are separate from JavaScript syntax/polyfills in the build.
if (!window.ResizeObserver) window.ResizeObserver=ResizeObserverPolyfill;
if (!crypto.randomUUID) Object.defineProperty(crypto,'randomUUID',{value:()=>{
  const bytes=crypto.getRandomValues(new Uint8Array(16)); bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}});
if (!Blob.prototype.arrayBuffer) Blob.prototype.arrayBuffer=function() {
  return new Promise<ArrayBuffer>((resolve,reject)=>{
    const reader=new FileReader(); reader.onload=()=>resolve(reader.result as ArrayBuffer); reader.onerror=()=>reject(reader.error); reader.readAsArrayBuffer(this);
  });
};
if (!AbortSignal.timeout) AbortSignal.timeout=(milliseconds:number)=>{
  const controller=new AbortController(); setTimeout(()=>controller.abort(),milliseconds); return controller.signal;
};
// Safari 12 ignores aspect-ratio and dynamic viewport units; CSS supplies fallbacks.
document.documentElement.classList.toggle('legacy-touch',!('PointerEvent' in window));
if (!('PointerEvent' in window)) {
  // Text-note editing still uses Pointer Events. Synthesize those events only
  // on that SVG; ink and page turning use native Touch Events independently.
  const dispatch=(event:TouchEvent,type:string)=>{
    const target=event.target as Element;
    if(!target.closest?.('.text-layer.writing'))return;
    for(let i=0;i<event.changedTouches.length;i++){
      const finger=event.changedTouches[i];
      const pointer=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:finger.clientX,clientY:finger.clientY,button:0});
      Object.defineProperties(pointer,{pointerId:{value:finger.identifier+1},pointerType:{value:'touch'},isPrimary:{value:true}});
      if(!target.dispatchEvent(pointer)&&event.cancelable)event.preventDefault();
    }
  };
  document.addEventListener('touchstart',event=>dispatch(event,'pointerdown'),{passive:false});
  document.addEventListener('touchmove',event=>dispatch(event,'pointermove'),{passive:false});
  document.addEventListener('touchend',event=>dispatch(event,'pointerup'),{passive:false});
  document.addEventListener('touchcancel',event=>dispatch(event,'pointercancel'),{passive:false});
}
