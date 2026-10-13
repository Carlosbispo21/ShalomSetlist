import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {Stroke,Point} from './domain';

export function useInk({active,ratio,color,width,strokes,onChange}:{active:boolean;ratio:number;color:string;width:number;strokes:Stroke[];onChange:(strokes:Stroke[])=>void}) {
  const layer=useRef<SVGSVGElement>(null), current=useRef<Stroke|null>(null), pointer=useRef<number|null>(null);
  const [draft,setDraft]=useState<Stroke|null>(null);
  const state=useRef({active,ratio,color,width,strokes,onChange}); state.current={active,ratio,color,width,strokes,onChange};
  const touch=typeof window!=='undefined' && ('ontouchstart' in window || navigator.maxTouchPoints>0);
  function point(x:number,y:number):Point {
    const bounds=layer.current!.getBoundingClientRect();
    return {x:Math.max(0,Math.min(1000,(x-bounds.left)/bounds.width*1000)),y:Math.max(0,Math.min(1000*state.current.ratio,(y-bounds.top)/bounds.height*1000*state.current.ratio))};
  }
  function begin(x:number,y:number) {const stroke={id:crypto.randomUUID(),color:state.current.color,width:state.current.width,points:[point(x,y)]};current.current=stroke;setDraft(stroke);}
  function move(x:number,y:number) {if(!current.current)return;const stroke={...current.current,points:[...current.current.points,point(x,y)]};current.current=stroke;setDraft(stroke);}
  function finish() {
    const stroke=current.current;current.current=null;pointer.current=null;setDraft(null);
    if(!stroke)return;
    if(stroke.points.length===1)stroke.points.push({x:stroke.points[0].x+.1,y:stroke.points[0].y+.1});
    state.current.onChange([...state.current.strokes,stroke]);
  }
  useEffect(()=>{
    const svg=layer.current!;
    const start=(event:TouchEvent)=>{
      if(!state.current.active||event.touches.length!==1)return;
      event.preventDefault();event.stopPropagation();const finger=event.touches[0];pointer.current=finger.identifier;begin(finger.clientX,finger.clientY);
    };
    const moved=(event:TouchEvent)=>{
      if(!current.current)return;event.preventDefault();event.stopPropagation();
      for(let i=0;i<event.changedTouches.length;i++){const finger=event.changedTouches[i];if(finger.identifier===pointer.current)move(finger.clientX,finger.clientY);}
    };
    const ended=(event:TouchEvent)=>{
      if(!current.current)return;event.preventDefault();event.stopPropagation();
      for(let i=0;i<event.changedTouches.length;i++)if(event.changedTouches[i].identifier===pointer.current)finish();
    };
    svg.addEventListener('touchstart',start,{passive:false});svg.addEventListener('touchmove',moved,{passive:false});svg.addEventListener('touchend',ended,{passive:false});svg.addEventListener('touchcancel',ended,{passive:false});
    return()=>{svg.removeEventListener('touchstart',start);svg.removeEventListener('touchmove',moved);svg.removeEventListener('touchend',ended);svg.removeEventListener('touchcancel',ended);};
  },[]);
  return {layer,draft,handlers:{
    onPointerDown:(event:PointerEvent<SVGSVGElement>)=>{
      if(!active||(touch&&event.pointerType!=='mouse')||(event.pointerType==='mouse'&&event.button!==0))return;
      event.preventDefault();event.stopPropagation();pointer.current=event.pointerId;
      try{event.currentTarget.setPointerCapture?.(event.pointerId);}catch{/* Safari may reject SVG capture; in-sheet drawing still works. */}
      begin(event.clientX,event.clientY);
    },
    onPointerMove:(event:PointerEvent<SVGSVGElement>)=>{if(touch&&event.pointerType!=='mouse')return;if(pointer.current===event.pointerId&&current.current){event.preventDefault();event.stopPropagation();move(event.clientX,event.clientY);}},
    onPointerUp:(event:PointerEvent<SVGSVGElement>)=>{if(touch&&event.pointerType!=='mouse')return;if(pointer.current===event.pointerId){event.stopPropagation();finish();}},
    onPointerCancel:(event:PointerEvent<SVGSVGElement>)=>{if(touch&&event.pointerType!=='mouse')return;if(pointer.current===event.pointerId)finish();}
  }};
}
