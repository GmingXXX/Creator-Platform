import {useRef} from 'react';

export function StoryInspectorResize({value,onResize}:{value?:number;onResize:(next:number)=>void}){
 const drag=useRef<{x:number;width:number}|null>(null);
 const clamp=(n:number)=>Math.max(238,Math.min(Math.min(window.innerWidth*.48,560),n));
 return <div className="story-inspector-resize" role="separator" aria-label="调整节点属性栏宽度" aria-orientation="vertical" tabIndex={0}
  aria-valuemin={238} aria-valuemax={Math.round(Math.min(window.innerWidth*.48,560))} aria-valuenow={Math.round(value||280)}
  onPointerDown={e=>{
   const rect=e.currentTarget.nextElementSibling?.getBoundingClientRect();
   if(!rect)return;
   e.preventDefault();drag.current={x:e.clientX,width:rect.width};e.currentTarget.setPointerCapture(e.pointerId);
  }}
  onPointerMove={e=>{if(drag.current)onResize(clamp(drag.current.width+drag.current.x-e.clientX));}}
  onLostPointerCapture={()=>{drag.current=null;}}
  onKeyDown={e=>{
   if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
   const width=e.currentTarget.nextElementSibling?.getBoundingClientRect().width||280;
   e.preventDefault();onResize(clamp(width+(e.key==='ArrowLeft'?20:-20)));
  }}/>;
}
