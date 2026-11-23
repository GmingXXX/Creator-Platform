import {textRoleStyle} from '../../domain/text-style';
import {useRef,useState,type CSSProperties,type PointerEvent} from 'react';
import type {ContentItem,SceneNode} from '../../domain/types';
import {useMedia} from '../../domain/upload';
import '../../styles/fishbone.css';

function EventImage({src,title}:{src?:string;title:string}){
 const url=useMedia(src);const [failed,setFailed]=useState('');
 return url&&url!==failed?<img src={url} alt={title} draggable={false} onError={()=>setFailed(url)}/>:<span className="fishbone-missing">暂无配图</span>;
}
export function FishboneTimeline({node,interactive,onItemClick}:{node:SceneNode;interactive:boolean;onItemClick:(item:ContentItem)=>void}){
 const viewport=useRef<HTMLDivElement>(null);
 const drag=useRef<{id:number;x:number;left:number;scale:number;moved:boolean}|null>(null);
 const suppress=useRef(false);
 const scroll=(direction:number)=>{const target=viewport.current;if(target)target.scrollBy({left:direction*Math.max(310,target.clientWidth*.65),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 const down=(event:PointerEvent<HTMLDivElement>)=>{
  if(!interactive||event.button!==0)return;
  event.stopPropagation();suppress.current=false;
  const el=event.currentTarget;
  drag.current={id:event.pointerId,x:event.clientX,left:el.scrollLeft,scale:el.getBoundingClientRect().width/el.clientWidth||1,moved:false};
 };
 const move=(event:PointerEvent<HTMLDivElement>)=>{
  const current=drag.current;if(!current||current.id!==event.pointerId)return;
  const delta=(event.clientX-current.x)/current.scale;
  if(Math.abs(delta)>7){current.moved=true;suppress.current=true;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.classList.add('is-dragging');}
  if(current.moved){event.preventDefault();event.stopPropagation();event.currentTarget.scrollLeft=current.left-delta;}
 };
 const end=(event:PointerEvent<HTMLDivElement>)=>{
  if(drag.current?.id!==event.pointerId)return;
  drag.current=null;event.currentTarget.classList.remove('is-dragging');
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  window.setTimeout(()=>{suppress.current=false;},0);
 };
 const style={'--fishbone-card-height':`${Math.max(90,Math.min(240,(node.h-130)/2))}px`,'--fishbone-size':`${Math.max(16,Math.min(30,node.fontSize))}px`} as CSSProperties;
 return <div className="fishbone" data-interactive={interactive} style={style}>
  <div className="fishbone-viewport" ref={viewport} role="region" aria-label="企业鱼骨时间轴" tabIndex={interactive?0:-1} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onClickCapture={event=>{if(suppress.current){event.preventDefault();event.stopPropagation();suppress.current=false;}}} onKeyDown={event=>{if(interactive&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();event.stopPropagation();scroll(event.key==='ArrowLeft'?-1:1);}}}>
   <div className="fishbone-track">{(node.items||[]).map((item,index)=><div className={`fishbone-event ${index%2?'is-lower':'is-upper'}`} key={item.id}>
    <span className="fishbone-stem"/><span className="fishbone-dot"/>
    <strong className="fishbone-year" style={textRoleStyle(node,'title')}>{item.year||'日期待补'}</strong>
    <button className="fishbone-card" type="button" tabIndex={interactive?0:-1} aria-label={`${item.year||''} ${item.title}`} onClick={event=>{event.stopPropagation();if(interactive)onItemClick(item);}}>
     <EventImage src={item.image} title={item.title}/><span className="fishbone-copy"><strong style={textRoleStyle(node,'title')}>{item.title}</strong><p style={textRoleStyle(node,'body')}>{item.description}</p><small>查看事件详情 ↗</small></span>
    </button>
   </div>)}</div>
   {!node.items?.length&&<div className="fishbone-empty">添加企业事件，开始编排时间轴</div>}
  </div>
  <div className="fishbone-controls"><button type="button" tabIndex={interactive?0:-1} aria-label="向前浏览时间轴" onClick={event=>{event.stopPropagation();scroll(-1);}}>←</button><span>拖动浏览 · 点击事件查看详情</span><button type="button" tabIndex={interactive?0:-1} aria-label="向后浏览时间轴" onClick={event=>{event.stopPropagation();scroll(1);}}>→</button></div>
 </div>;
}
