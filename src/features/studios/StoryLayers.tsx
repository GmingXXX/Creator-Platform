import {useRef,type PointerEvent} from 'react';
import {Image as ImageIcon,Film} from 'lucide-react';
import type {StoryLayer,StoryTrigger} from '../../domain/story-canvas';
import {resolveFontFamily} from '../../domain/text-style';
import {fitStoryLayer,storyLayerTitle,type LayerBounds} from '../../domain/story-layer-editing';
import {StoryHtml} from './StoryHtml';
import {StudioImage,StudioVideo} from './StudioShared';
import {StoryQr} from './StoryQr';
import '../../styles/story-layers.css';

interface Props{
 layers:StoryLayer[];clickableIds?:string[];selected?:string;editing?:boolean;snap?:boolean;audition?:boolean;
 resultMedia?:Partial<Record<'photo'|'faceImage'|'faceVideo',string>>;
 onSelect?:(id:string)=>void;onBounds?:(id:string,bounds:LayerBounds)=>void;
 onEdit?:(id:string)=>void;onEvent?:(trigger:StoryTrigger,id:string)=>void;
}
export function StoryLayers({layers,selected,editing=false,snap=false,audition=false,resultMedia={},clickableIds=[],onSelect,onBounds,onEdit,onEvent}:Props){
 const drag=useRef<{id:string;px:number;py:number;box:LayerBounds;w:number;h:number;resize:boolean}|null>(null);
 const down=(e:PointerEvent<HTMLElement>,l:StoryLayer,resize=false)=>{
  if(!editing||l.locked||e.button!==0)return;
  e.stopPropagation();onSelect?.(l.id);
  const rect=e.currentTarget.closest('.story-layer-plane')!.getBoundingClientRect();
  drag.current={id:l.id,px:e.clientX,py:e.clientY,box:l,w:rect.width,h:rect.height,resize};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const move=(e:PointerEvent<HTMLElement>,l:StoryLayer)=>{
  const d=drag.current;
  if(!d||!e.buttons||d.id!==l.id||!d.w||!d.h)return;
  const dx=(e.clientX-d.px)*100/d.w,dy=(e.clientY-d.py)*100/d.h;
  const b=d.box,delta=d.resize?{width:Math.min(100-b.x,b.width+dx),height:Math.min(100-b.y,b.height+dy)}:{x:b.x+dx,y:b.y+dy};
  onBounds?.(l.id,fitStoryLayer({...b,...delta},snap));
 };
 return <div className="story-layer-plane">{layers.map(l=>{
  if(editing&&l.hidden)return null;
  const active=editing&&selected===l.id,src=(l.resultSource?resultMedia[l.resultSource]:undefined)||l.src;
  const align=l.align||'center';
  const actionable=l.kind==='button'||clickableIds.includes(l.id);
  return <div key={l.id} tabIndex={editing||actionable?0:undefined} role={actionable?'button':undefined} aria-label={l.name}
   className={`story-layer kind-${l.variant||l.kind} ${editing?'editing':''} ${active?'selected':''} ${l.locked?'locked':''}`}
   style={{left:l.x+'%',top:l.y+'%',width:l.width+'%',height:l.height+'%',color:l.color,fontSize:l.size?l.size+'cqw':undefined,fontFamily:resolveFontFamily(l.fontFamily),fontWeight:l.weight,textAlign:align}}
   onPointerDown={e=>down(e,l)} onPointerMove={e=>move(e,l)} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}
   onClick={()=>editing?(!l.locked&&onSelect?.(l.id)):onEvent?.('layerClick',l.id)} onDoubleClick={()=>editing&&!l.locked&&onEdit?.(l.id)}
   onKeyDown={e=>{
    if(e.currentTarget!==e.target)return;
    if(editing){if(e.key==='Enter'&&!l.locked)onEdit?.(l.id);return;}
    if(actionable&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onEvent?.('layerClick',l.id);}
   }}>
   <div className="story-layer-content" style={{opacity:l.opacity??1,background:l.background,borderRadius:l.radius,justifyItems:align==='center'?'center':align==='left'?'start':'end','--story-layer-fit':l.fit||'contain'} as React.CSSProperties}>
    {l.variant==='qr'?<StoryQr value={l.qrText}/>:l.variant==='mask'?null:
     l.kind==='image'&&src?<StudioImage src={src} alt={l.name}/>:l.kind==='video'&&src?<StudioVideo src={src} controls={!editing} muted={editing&&!audition} autoPlay={editing?audition:l.autoplay!==false} volume={l.volume??1} loop={l.loop} onEnded={()=>onEvent?.('videoEnd',l.id)}/>:
     l.kind==='html'&&src?<StoryHtml src={src} title={l.name} onComplete={()=>onEvent?.('htmlComplete',l.id)}/>:
     l.resultSource?<span className="story-result-placeholder">{l.kind==='video'?<Film/>:<ImageIcon/>}{storyLayerTitle(l)}{editing?' · 结果位置':' · 等待生成'}</span>:l.text}
   </div>
   {!editing&&l.resultSource&&l.resultSource!=='photo'&&resultMedia[l.resultSource]&&<small className="story-template-sample-mark">模板样片</small>}
   {active&&!l.locked&&<button className="story-size-grip" aria-label={'缩放'+l.name} onPointerDown={e=>down(e,l,true)} onKeyDown={e=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();onBounds?.(l.id,fitStoryLayer({...l,width:l.width+(e.key==='ArrowLeft'?-2:e.key==='ArrowRight'?2:0),height:l.height+(e.key==='ArrowUp'?-2:e.key==='ArrowDown'?2:0)},snap));
   }}/>}
  </div>;
 })}</div>;
}
