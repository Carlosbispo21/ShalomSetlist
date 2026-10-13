import {useEffect,useRef} from 'react';

// Gesture frames only move compositor layers; they never render the PDF again.
export function usePageSlide(page:number,width:number) {
  const stage=useRef<HTMLDivElement>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const state=useRef({page,width});state.current={page,width};
  function position(target:number,offset:number,animate:boolean) {
    const root=stage.current;if(!root)return;
    root.classList.toggle('dragging',!animate);
    root.classList.toggle('sliding',animate);
    clearTimeout(timer.current);
    if(animate)timer.current=setTimeout(()=>root.classList.remove('sliding'),220);
    root.querySelectorAll<HTMLElement>('.page-pane').forEach(pane=>{
      const number=Number(pane.dataset.sheet);
      pane.style.transform=`translate3d(${(number-target)*state.current.width+offset}px,0,0)`;
    });
  }
  return {stage,drag:(offset:number)=>position(state.current.page,Math.max(-width,Math.min(width,offset)),false),
    settle:(target=state.current.page)=>position(target,0,true)};
}
