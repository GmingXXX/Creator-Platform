import {useLayoutEffect,useRef,useState,type PointerEvent} from 'react';
import type {Work} from '../../domain/types';
import {lengthOf,type Sequence} from '../../domain/motion-sequence';
import {SceneRenderer} from './SceneRenderer';
import {posePlayer} from './motion-playback';

export function MotionScenePreview({work,pageId,sequence,time,onMove,recordTarget,onPick}:{work:Work;pageId:string;sequence:Sequence;time:number;onMove?:(dx:number,dy:number)=>void;recordTarget?:string;onPick?:(id:string)=>void}){
 const box=useRef<HTMLDivElement>(null),holder=useRef<HTMLDivElement>(null),[ratio,setRatio]=useState(.2),drag=useRef<{x:number;y:number;id:number}|null>(null);
 useLayoutEffect(()=>{const el=box.current;if(!el)return;const fit=()=>setRatio(el.clientWidth/work.width);fit();const o=new ResizeObserver(fit);o.observe(el);return()=>o.disconnect()},[work.width]);
 const player=useRef<ReturnType<typeof posePlayer>|null>(null);
 useLayoutEffect(()=>{if(holder.current){player.current=posePlayer(holder.current,pageId)}return()=>{player.current?.clear();player.current=null}},[pageId]);
 useLayoutEffect(()=>{player.current?.draw(sequence,Math.max(0,Math.min(lengthOf(sequence),time)))},[sequence,time,pageId]);
 function down(e:PointerEvent){if(!onMove)return;const el=(e.target as Element).closest<HTMLElement>('[data-node-id]');if(recordTarget!=='@page'&&el&&el.dataset.nodeId!==recordTarget){onPick?.(el.dataset.nodeId||'');return}e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,id:e.pointerId}}
 function up(e:PointerEvent){const d=drag.current;drag.current=null;if(d&&d.id===e.pointerId&&onMove){const dx=(e.clientX-d.x)/ratio,dy=(e.clientY-d.y)/ratio;if(Math.max(Math.abs(dx),Math.abs(dy))>1)onMove(Math.round(dx),Math.round(dy))}}
 return <div ref={box} className={'motion-scene-preview'+(onMove?' recording':'')} style={{aspectRatio:work.width+'/'+work.height}} onPointerDown={down} onPointerUp={up} onPointerCancel={()=>{drag.current=null}}>
  <div ref={holder} style={{width:work.width,height:work.height,transform:'scale('+ratio+')',transformOrigin:'top left'}}><SceneRenderer work={work} pageId={pageId}/></div>
 </div>;
}
