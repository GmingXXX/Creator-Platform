import {useEffect,useRef,useState,type ReactNode,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {Bot,Maximize2,Minus,X} from 'lucide-react';
import type {EditTarget,Work} from '../../domain/types';
import {WorkConversation} from '../conversation/WorkConversation';
import '../../styles/floating-agent.css';
export interface FloatingWorkAgentProps {
 work:Work;pageId?:string;nodeId?:string;onBeforeApply?:()=>void;onApplied?:(work:Work)=>void;children?:ReactNode;
}
/** Hiding the assistant retains its composer and any running request until the editor is left. */
export function FloatingWorkAgent({work,pageId,nodeId,onBeforeApply,onApplied,children}:FloatingWorkAgentProps){
 const [open,setOpen]=useState(false),[minimized,setMinimized]=useState(false);
 const [position,setPosition]=useState({x:Math.max(12,window.innerWidth-470),y:110});
 const [target,setTarget]=useState<EditTarget>({scope:'work'});
 const panel=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
 useEffect(()=>{setTarget(nodeId?{scope:'node',pageId:pageId||(work.kind==='story'?'@story':work.kind==='video'?'@shots':work.pages[0]?.id),nodeId}:pageId?{scope:'page',pageId}:{scope:'work'})},[work.id,work.kind,pageId,nodeId]);
 useEffect(()=>{const fit=()=>setPosition(p=>({x:Math.max(8,Math.min(p.x,window.innerWidth-Math.min(panel.current?.offsetWidth||440,window.innerWidth-16)-8)),y:Math.max(8,Math.min(p.y,window.innerHeight-100))}));window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit)},[]);
 const close=()=>{setOpen(false);trigger.current?.focus()};
 const start=(e:PointerEvent<HTMLElement>)=>{if((e.target as HTMLElement).closest('button'))return;drag.current={x:e.clientX,y:e.clientY,left:position.x,top:position.y};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault()};
 const move=(e:PointerEvent<HTMLElement>)=>{if(!drag.current)return;setPosition({x:Math.max(8,Math.min(window.innerWidth-(panel.current?.offsetWidth||440)-8,drag.current.left+e.clientX-drag.current.x)),y:Math.max(8,Math.min(window.innerHeight-70,drag.current.top+e.clientY-drag.current.y))})};
 return <><button ref={trigger} type="button" className={`floating-agent-trigger ${open?'active':''}`} title="Agent 助手" aria-label="打开 Agent 助手" aria-expanded={open} onClick={()=>{setOpen(v=>!v);setMinimized(false)}}><Bot size={19}/></button>{createPortal(<div ref={panel} role="dialog" aria-label="Agent 助手" aria-modal="false" className={`floating-work-agent ${minimized?'is-minimized':''}`} style={{left:position.x,top:position.y,display:open?undefined:'none'}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close()}}}>
  <header onPointerDown={start} onPointerMove={move} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}><Bot size={18}/><div><strong>Agent 助手</strong><small>{work.kind==='story'?'故事策划与节点编辑':work.kind==='presentation'?'页面、讲解与互动':work.kind==='video'?'分镜与讲述':'页面与组件编辑'}</small></div><button aria-label={minimized?'展开 Agent 助手':'最小化 Agent 助手'} title={minimized?'展开':'最小化'} onClick={()=>setMinimized(v=>!v)}>{minimized?<Maximize2 size={15}/>:<Minus size={15}/>}</button><button aria-label="关闭 Agent 助手" title="关闭" onClick={close}><X size={16}/></button></header>
  <div className="floating-agent-body" style={{display:minimized?'none':undefined}}>{children||<WorkConversation work={work} target={target} onTargetChange={setTarget} onBeforeApply={onBeforeApply} onApplied={onApplied} compact/>}</div>
 </div>,document.body)}</>;
}
