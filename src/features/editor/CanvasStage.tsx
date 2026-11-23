import {editorShortcutBlocked,editorTextInput} from './editor-keyboard';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Maximize, Minus, MousePointer2, Plus, RotateCw, Hand, ImagePlus, Film, Music2 } from 'lucide-react';
import type { NodeKind, SceneNode, Work } from '../../domain/types';
import { SceneRenderer } from './SceneRenderer';
import { isMediaContainer, nodeLabels, resizeNode, updatePageNodes } from './editor-domain';
interface Props{work:Work;pageId:string;selected:string[];onSelect:(ids:string[])=>void;onCommit:(w:Work)=>void;onDoubleClick:(node:SceneNode)=>void;zoom:number;setZoom:(n:number)=>void;pan:{x:number;y:number};setPan:React.Dispatch<React.SetStateAction<{x:number;y:number}>>;restoreView:boolean;fitSignal:number;onAddComponent:(type:NodeKind,point:{x:number;y:number})=>void;onDropMaterial:(assetId:string,point:{x:number;y:number},targetId?:string)=>void}
interface Gesture{mode:'move'|'resize'|'rotate'|'pan'|'box';startX:number;startY:number;snapshot:Work;ids:string[];direction?:string;node?:SceneNode;pan?:{x:number;y:number}}
export function CanvasStage({work,pageId,selected,onSelect,onCommit,onDoubleClick,zoom,setZoom,pan,setPan,restoreView,fitSignal,onAddComponent,onDropMaterial}:Props){
 const viewport=useRef<HTMLDivElement>(null);const board=useRef<HTMLDivElement>(null);const gesture=useRef<Gesture|null>(null);const finalWork=useRef<Work|null>(null);
 const [dropTarget,setDropTarget]=useState<string|null>(null),[dropKind,setDropKind]=useState('');
 const [live,setLive]=useState<Work|null>(null);const [box,setBox]=useState<{x:number;y:number;w:number;h:number}|null>(null);const [guides,setGuides]=useState<{x?:number;y?:number}>({});const [hand,setHand]=useState(false);
 const display=live||work;const page=display.pages.find(p=>p.id===pageId)!;
 const fit=()=>{const r=viewport.current?.getBoundingClientRect();if(r){setZoom(Math.max(.04,Math.min(.9,(r.width-112)/work.width,(r.height-120)/work.height)));setPan({x:0,y:0})}};
 const fittedDimensions=useRef(restoreView?`${work.width}×${work.height}`:'');
 useEffect(()=>{const dimensions=`${work.width}×${work.height}`;if(fittedDimensions.current!==dimensions){fit();fittedDimensions.current=dimensions}},[work.width,work.height]);
 useEffect(()=>{if(fitSignal>0)fit()},[fitSignal]);
 useEffect(()=>{const start=(e:KeyboardEvent)=>{if(e.code==='Space'&&!editorShortcutBlocked(e.target)&&!editorTextInput(e.target)&&(e.target as HTMLElement)?.tagName!=='BUTTON'){e.preventDefault();setHand(true)}};const end=(e:KeyboardEvent)=>{if(e.code==='Space')setHand(false)};window.addEventListener('keydown',start);window.addEventListener('keyup',end);return()=>{window.removeEventListener('keydown',start);window.removeEventListener('keyup',end)}},[]);
 function begin(e:ReactPointerEvent,mode:Gesture['mode'],node?:SceneNode,direction?:string){
  if(e.button!==0&&e.button!==1)return;e.preventDefault();e.stopPropagation();
  viewport.current?.focus({preventScroll:true});
  if(node?.locked)return;
  let ids=node?selected.includes(node.id)?selected:e.shiftKey?[...selected,node.id]:[node.id]:selected;
  if(node&&e.shiftKey&&selected.includes(node.id)){ids=selected.filter(id=>id!==node.id);onSelect(ids);return}
  if(node)onSelect(ids);
  gesture.current={mode,startX:e.clientX,startY:e.clientY,snapshot:work,ids,direction,node,pan};finalWork.current=null;
  if(mode==='box'){if(!e.shiftKey)onSelect([]);const r=viewport.current!.getBoundingClientRect();setBox({x:e.clientX-r.left,y:e.clientY-r.top,w:0,h:0})}
 }
 useEffect(()=>{
  function move(e:PointerEvent){const g=gesture.current;if(!g)return;const dx=(e.clientX-g.startX)/zoom,dy=(e.clientY-g.startY)/zoom;
   if(g.mode==='pan'){setPan({x:g.pan!.x+e.clientX-g.startX,y:g.pan!.y+e.clientY-g.startY});return}
   if(g.mode==='box'){const r=viewport.current!.getBoundingClientRect();setBox({x:Math.min(g.startX,e.clientX)-r.left,y:Math.min(g.startY,e.clientY)-r.top,w:Math.abs(e.clientX-g.startX),h:Math.abs(e.clientY-g.startY)});const b=board.current!.getBoundingClientRect();const x=(Math.min(g.startX,e.clientX)-b.left)/zoom,y=(Math.min(g.startY,e.clientY)-b.top)/zoom,w=Math.abs(e.clientX-g.startX)/zoom,h=Math.abs(e.clientY-g.startY)/zoom;onSelect(g.snapshot.pages.find(p=>p.id===pageId)!.nodes.filter(n=>!n.locked&&!n.hidden&&n.x<x+w&&n.x+n.w>x&&n.y<y+h&&n.y+n.h>y).map(n=>n.id));return}
   const next=updatePageNodes(g.snapshot,pageId,g.ids,n=>{
    if(n.locked)return n;
    if(g.mode==='resize')return resizeNode(n,g.direction!,dx,dy);
    if(g.mode==='rotate'){const rect=board.current!.getBoundingClientRect();const cx=rect.left+(n.x+n.w/2)*zoom,cy=rect.top+(n.y+n.h/2)*zoom;let rotation=Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI+90;if(e.shiftKey)rotation=Math.round(rotation/15)*15;return {...n,rotation:Math.round(rotation)}}
    let x=n.x+dx,y=n.y+dy;const found:{x?:number;y?:number}={};
    if(Math.abs(x+n.w/2-work.width/2)<8/zoom){x=work.width/2-n.w/2;found.x=work.width/2}
    if(Math.abs(y+n.h/2-work.height/2)<8/zoom){y=work.height/2-n.h/2;found.y=work.height/2}
    setGuides(found);return {...n,x:Math.round(x),y:Math.round(y)};
   });finalWork.current=next;setLive(next);
  }
  function end(){const g=gesture.current;if(!g)return;if(finalWork.current)onCommit(finalWork.current);gesture.current=null;finalWork.current=null;setLive(null);setGuides({});setBox(null)}
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end)};
 },[zoom,pageId,onCommit,onSelect,work]);
 return <div className={'editor-viewport '+(hand?'hand-mode':'')} ref={viewport} tabIndex={-1} aria-label="编辑画布" onPointerDown={e=>begin(e,hand||e.button===1?'pan':'box')} onWheel={e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();setZoom(Math.max(.04,Math.min(2,zoom*(e.deltaY<0?1.08:.92))))}else setPan(p=>({x:p.x-e.deltaX,y:p.y-e.deltaY}))}} onDragOver={e=>{
   if(!e.dataTransfer.types.some(type=>type.startsWith('application/zhichuang-')))return;
   e.preventDefault();const kind=e.dataTransfer.types.find(type=>type.startsWith('application/zhichuang-asset-'))?.slice('application/zhichuang-asset-'.length)||'';
   const targetId=(e.target as HTMLElement).closest('[data-hit-node]')?.getAttribute('data-hit-node');
   const target=page.nodes.find(node=>node.id===targetId);
   const matching=target&&target.type===kind&&['image','video','audio','html'].includes(kind);
   setDropTarget(matching?target.id:null);setDropKind(kind);
   e.dataTransfer.dropEffect=matching&&target.locked?'none':'copy';
  }} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node)){setDropTarget(null);setDropKind('')}}} onDrop={e=>{
   e.preventDefault();setDropTarget(null);setDropKind('');
   const r=board.current!.getBoundingClientRect(),point={x:Math.max(0,Math.round((e.clientX-r.left)/zoom)),y:Math.max(0,Math.round((e.clientY-r.top)/zoom))};
   const assetId=e.dataTransfer.getData('application/zhichuang-asset');
   if(assetId){const kind=e.dataTransfer.types.find(type=>type.startsWith('application/zhichuang-asset-'))?.slice('application/zhichuang-asset-'.length);const hitId=(e.target as HTMLElement).closest('[data-hit-node]')?.getAttribute('data-hit-node');const target=page.nodes.find(node=>node.id===hitId&&node.type===kind);onDropMaterial(assetId,point,target?.id);return;}
   const type=e.dataTransfer.getData('application/zhichuang-component') as NodeKind;if(type)onAddComponent(type,point);
  }}>
  <div className="canvas-page-caption">{page.name}<span>{work.width} × {work.height}</span></div>
  <div className="scene-board" ref={board} style={{width:work.width,height:work.height,transform:`translate(-50%,-50%) translate(${pan.x}px,${pan.y}px) scale(${zoom})`}}>
   <SceneRenderer work={display} pageId={pageId}/>
   <div className="canvas-hit-layer">{page.nodes.filter(n=>!n.hidden).map(n=><div key={n.id} data-hit-node={n.id} className={'node-hitbox '+(selected.includes(n.id)?'selected ':'')+(dropTarget===n.id?'material-drop-target ':'')+(n.locked?'locked':'')} style={{left:n.x,top:n.y,width:n.w,height:n.h,transform:`rotate(${n.rotation}deg)`,outlineWidth:selected.includes(n.id)?1.5/zoom:undefined}} onPointerDown={e=>begin(e,hand?'pan':'move',n)} onDoubleClick={e=>{e.stopPropagation();onSelect([n.id]);onDoubleClick(n)}}><span className="node-hover-label" style={{fontSize:11/zoom,padding:`${3/zoom}px ${6/zoom}px`,top:-24/zoom}}>{n.name}</span>{isMediaContainer(n.type)&&!n.src&&<MediaPlaceholder type={n.type}/>}{selected.includes(n.id)&&!n.locked&&<><div className="selection-label" style={{fontSize:11/zoom,padding:`${3/zoom}px ${7/zoom}px`,bottom:-28/zoom}}>{Math.round(n.w)} × {Math.round(n.h)}</div>{['nw','n','ne','e','se','s','sw','w'].map(d=><span key={d} className={'selection-handle handle-'+d} style={{width:8/zoom,height:8/zoom,borderWidth:1/zoom}} onPointerDown={e=>begin(e,'resize',n,d)}/>)}<span className="rotation-stem" style={{height:24/zoom,top:-24/zoom,width:1/zoom}}/><button aria-label="旋转组件" className="rotation-handle" style={{width:20/zoom,height:20/zoom,top:-42/zoom}} onPointerDown={e=>begin(e,'rotate',n)}><RotateCw style={{width:12/zoom,height:12/zoom}}/></button></>}</div>)}</div>
   {guides.x!==undefined&&<div className="canvas-guide vertical" style={{left:guides.x,width:1/zoom}}/>}{guides.y!==undefined&&<div className="canvas-guide horizontal" style={{top:guides.y,height:1/zoom}}/>}
  </div>
  {dropKind&&<div className="canvas-drop-message">{dropTarget?(page.nodes.find(node=>node.id===dropTarget)?.locked?'此组件已锁定，无法替换':`替换当前${dropKind==='image'?'图片':dropKind==='video'?'视频':dropKind==='audio'?'音频':'程序'}`):'松开添加到画布'}</div>}
  {box&&<div className="canvas-marquee" style={{left:box.x,top:box.y,width:box.w,height:box.h}}/>}
  <div className="canvas-float-tools" onPointerDown={e=>e.stopPropagation()}><button className={!hand?'active':''} onClick={()=>setHand(false)} title="选择"><MousePointer2 size={17}/></button><button className={hand?'active':''} onClick={()=>setHand(!hand)} title="平移（按住空格）"><Hand size={17}/></button><i/><button title="缩小" onClick={()=>setZoom(Math.max(.04,zoom-.05))}><Minus size={16}/></button><button className="zoom-readout" onClick={fit} title="适应画布">{Math.round(zoom*100)}%</button><button title="放大" onClick={()=>setZoom(Math.min(2,zoom+.05))}><Plus size={16}/></button><i/><button title="适应窗口" onClick={fit}><Maximize size={16}/></button></div>
  <span className="canvas-help">空格拖动 · Ctrl/⌘ + 滚轮缩放</span>
 </div>;
}

function MediaPlaceholder({type}:{type:'image'|'video'|'audio'}){
 const Icon=type==='image'?ImagePlus:type==='video'?Film:Music2;
 return <div className="scene-media-placeholder">
  <Icon aria-hidden="true"/>
  <span>添加{nodeLabels[type]}</span>
 </div>;
}
