import {StoryHtml} from './StoryHtml';
import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import {currentEditorReturn} from '../workspace/editor-return';
import { ArrowLeft, Check, ChevronRight, Save } from 'lucide-react';
import { Button, Logo, toast } from '../../components/ui';
import { useMedia } from '../../domain/upload';
import type { SceneNode, ScenePage, Work } from '../../domain/types';
import {nodeTypographyStyle,textRoleStyle} from '../../domain/text-style';
import {movePresentationElement,resizePresentationElement,type ResizeCorner} from './presentation-element-geometry';
import './presentation-editing.css';
import { navigateInWorkspace } from '../workspace/output-navigation';

export function StudioTopbar({title,back,saved,onSave,children,workspaceId,onTitle,titleLabel}:{onTitle?:(value:string)=>void;titleLabel?:string;title:string;back:string;workspaceId?:string;saved:boolean;onSave:()=>void|boolean;children?:ReactNode}) {
 const navigate=useNavigate(),{id}=useParams();
 const leave=(destination:string)=>{
  try { if(!saved&&onSave()===false)return; navigateInWorkspace(navigate,workspaceId,destination); }
  catch(error) { toast(error instanceof Error?error.message:'保存失败，请重试',true); }
 };
 return <header className="studio-topbar"><button className="studio-back" aria-label="返回" onClick={()=>leave(currentEditorReturn(id||'',back))}><ArrowLeft size={18}/></button><button className="studio-home-logo" aria-label="智创首页" title="保存并返回首页" onClick={()=>leave('/')}><Logo small/></button><span className="studio-breadcrumb">创作工作台 <ChevronRight size={14}/></span>{onTitle?<input className="editor-document-title" aria-label={titleLabel||"作品名称"} maxLength={80} value={title} onChange={e=>onTitle(e.target.value)}/>:<strong>{title}</strong>}<span className={`studio-save-state ${saved?'is-saved':''}`}>{saved?<><Check size={13}/>已保存</>:'有未保存修改'}</span><div className="studio-top-actions"><Button onClick={onSave}><Save size={14}/>保存</Button>{children}</div></header>;
}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}) { const id=useId();const items=Children.toArray(children);const control=items.find(child=>isValidElement(child)&&['input','textarea','select'].includes(String(child.type)));return <label htmlFor={control?id:undefined} className="studio-field"><span>{label}</span>{items.map(child=>child===control?cloneElement(child as ReactElement<{id?:string;'aria-label'?:string}>,{id,'aria-label':label}):child)}{hint&&<small>{hint}</small>}</label>; }
export function Stepbar({steps,current}:{steps:string[];current:number}) { return <div className="studio-steps">{steps.map((s,i)=><div key={s} className={i<=current?'active':''}><span>{i<current?<Check size={13}/>:i+1}</span>{s}{i<steps.length-1&&<i/>}</div>)}</div>; }
export function StudioMediaPlaceholder({failed=false,className='',style}:{failed?:boolean;className?:string;style?:CSSProperties}) {
 return <div className={`studio-media-placeholder ${className}`} style={style} role="status"><span>{failed?'画面加载失败':'待补充画面'}</span><small>{failed?'请重新选择或上传素材':'请添加图片或视频素材'}</small></div>;
}
export function StudioImage({src,alt,...rest}:{src:string;alt:string;className?:string;style?:CSSProperties}) {
 const resolved=useMedia(src),[failed,setFailed]=useState('');
 if(!resolved||failed===resolved)return <StudioMediaPlaceholder {...rest} failed={Boolean(resolved)&&failed===resolved}/>;
 return <img {...rest} key={resolved} src={resolved} alt={alt} onError={()=>setFailed(resolved)}/>;
}
export function StudioVideo({src,poster,playing,volume,...rest}:{src:string;volume?:number;poster?:string;className?:string;controls?:boolean;autoPlay?:boolean;muted?:boolean;loop?:boolean;playing?:boolean;onEnded?:()=>void}) {
 const resolved=useMedia(src),ref=useRef<HTMLVideoElement>(null),[failed,setFailed]=useState('');
 useEffect(()=>{if(ref.current&&volume!==undefined&&Number.isFinite(volume))ref.current.volume=Math.max(0,Math.min(1,volume));},[volume,resolved]);
 useEffect(()=>{if(playing===undefined)return;if(playing)void ref.current?.play().catch(()=>{});else ref.current?.pause()},[playing,resolved]);
 if(!resolved||failed===resolved)return <StudioMediaPlaceholder className={rest.className} failed={Boolean(resolved)&&failed===resolved}/>;
 return <video key={resolved} ref={ref} {...rest} src={resolved} poster={poster} playsInline onError={()=>setFailed(resolved)}/>;
}
export function SlideView({page,work,selected,selection,onSelect,onUpdate,onReplace}:{page:ScenePage;work:Work;selected?:string;selection?:string[];onSelect?:(id:string,extend?:boolean)=>void;onUpdate?:(id:string,patch:Partial<SceneNode>)=>void;onReplace?:(node:SceneNode)=>void}) {
 const ref=useRef<HTMLDivElement>(null),cleanup=useRef<(()=>void)|null>(null);const [width,setWidth]=useState(800);
 useEffect(()=>{if(!ref.current)return;const observer=new ResizeObserver(e=>setWidth(e[0].contentRect.width));observer.observe(ref.current);return()=>observer.disconnect();},[]);
 useEffect(()=>()=>cleanup.current?.(),[page.id]);
 const [editing,setEditing]=useState<string>();
 const scale=width/work.width;
 const gesture=(e:ReactPointerEvent<HTMLElement>,node:SceneNode,corner?:ResizeCorner)=>{
  if(!onSelect||e.button!==0)return;e.stopPropagation();e.preventDefault();onSelect(node.id,e.shiftKey&&!corner);
  if(!onUpdate||node.locked||scale<=0)return;
  cleanup.current?.();const target=e.currentTarget,startX=e.clientX,startY=e.clientY,pointerId=e.pointerId;
  target.setPointerCapture(pointerId);
  const move=(event:PointerEvent)=>{if(event.pointerId!==pointerId)return;const dx=event.clientX-startX,dy=event.clientY-startY;onUpdate(node.id,corner?resizePresentationElement(node,corner,dx,dy,scale,(node.type==='image'||node.type==='video')&&!event.shiftKey):movePresentationElement(node,dx,dy,scale));};
  const finish=()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',finish);target.removeEventListener('pointercancel',finish);target.removeEventListener('lostpointercapture',finish);if(target.hasPointerCapture(pointerId))target.releasePointerCapture(pointerId);cleanup.current=null;};
  cleanup.current=finish;target.addEventListener('pointermove',move);target.addEventListener('pointerup',finish);target.addEventListener('pointercancel',finish);target.addEventListener('lostpointercapture',finish);
 };
 return <div ref={ref} className="slide-surface" style={{aspectRatio:`${work.width}/${work.height}`,background:page.background}} onPointerDown={e=>{if(e.target===e.currentTarget)onSelect?.('')}}>
  {page.backgroundImage&&<StudioImage className="slide-background" src={page.backgroundImage} alt=""/>}
  <div className="slide-coordinate-space" style={{width:work.width,height:work.height,transform:`scale(${scale})`}} onPointerDown={e=>{if(e.target===e.currentTarget)onSelect?.('')}}>
   {page.nodes.filter(n=>!n.hidden).map(n=><div key={n.id} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-disabled={n.locked||undefined} aria-label={onSelect?`选择元素 ${n.name}`:undefined} onKeyDown={e=>{if(e.key==='Enter')onSelect?.(n.id)}} onDoubleClick={()=>{if(!onUpdate||n.locked)return;if(n.type==='text'&&!n.items?.length)setEditing(n.id);else if(n.type==='image'||n.type==='video')onReplace?.(n)}} onPointerDown={e=>{if(editing!==n.id)gesture(e,n)}} className={`slide-element ${(selected===n.id||selection?.includes(n.id))?'selected':''} slide-${n.type}`} style={{left:n.x,top:n.y,width:n.w,height:n.h,opacity:n.opacity,transform:`rotate(${n.rotation}deg)`,color:n.color,fontSize:n.fontSize,...nodeTypographyStyle(n),background:n.background,borderRadius:n.radius,cursor:onSelect?'move':'default',outlineWidth:2/scale,outlineOffset:0}}>
    {editing===n.id&&onUpdate?<textarea autoFocus aria-label="在画布编辑文字" style={{width:'100%',height:'100%',font:'inherit',textAlign:'inherit',color:'inherit',background:n.background,border:0}} defaultValue={n.content} onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')setEditing(undefined);if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))e.currentTarget.blur()}} onBlur={e=>{onUpdate(n.id,{content:e.target.value});setEditing(undefined)}}/>:n.type==='html'&&n.src?<div style={{width:'100%',height:'100%',pointerEvents:onSelect?'none':undefined}}><StoryHtml src={n.src} title={n.name}/></div>:n.type==='image'?<StudioImage src={n.src||''} alt={n.name} style={n.name.startsWith('品牌标识')?{objectFit:'contain'}:undefined}/>:n.type==='video'?<StudioVideo src={n.src||''} controls={!onSelect}/>:n.items?.length?<div className="slide-data-grid">{n.items.map((item,i)=><div key={item.id}><span style={textRoleStyle(n,'title')}>{item.year||String(i+1).padStart(2,'0')}</span><b style={textRoleStyle(n,'title')}>{item.title}</b><small style={textRoleStyle(n,'body')}>{item.description}</small></div>)}</div>:n.content}
    {selected===n.id&&onUpdate&&!n.locked&&(['nw','ne','sw','se'] as const).map(corner=><span key={corner} role="button" tabIndex={0} aria-label={`缩放 ${n.name} ${corner}`} className="slide-resize-handle" onPointerDown={e=>gesture(e,n,corner)} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();onUpdate(n.id,resizePresentationElement(n,corner,e.key==='ArrowLeft'?-10:e.key==='ArrowRight'?10:0,e.key==='ArrowUp'?-10:e.key==='ArrowDown'?10:0,1,n.type==='image'||n.type==='video'));}} style={{width:10/scale,height:10/scale,left:corner.endsWith('w')?-5/scale:undefined,right:corner.endsWith('e')?-5/scale:undefined,top:corner.startsWith('n')?-5/scale:undefined,bottom:corner.startsWith('s')?-5/scale:undefined,cursor:corner==='nw'||corner==='se'?'nwse-resize':'nesw-resize'}}/>) }
   </div>)}
  </div>
 </div>;
}
export function downloadJSON(value:unknown,name:string) { const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
export function useUnsavedWarning(dirty:boolean) { useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler)},[dirty]); }
