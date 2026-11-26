import {useEffect,useRef,type RefObject} from 'react';
import {lengthOf,makeClip,sampleStyle,type Sequence} from '../../domain/motion-sequence';
import {transitionPages} from './motion-page-transition';
import type {Interaction,SceneNode,ScenePage,Work} from '../../domain/types';

export function sequenceStyles(sequence:Sequence,time:number){
 const styles=new Map<string,Record<string,string>>();
 for(const c of [...sequence.clips].sort((a,b)=>a.start-b.start)){
  if(c.start>time)continue;
  styles.set(c.target,sampleStyle(c,Math.min(c.duration,time-c.start)));
 }
 for(const j of sequence.joins){
  const a=sequence.clips.find(c=>c.id===j.left),b=sequence.clips.find(c=>c.id===j.right);
  if(!a||!b)continue;
  const span=Math.min(.45,b.duration);
  if(time<b.start||time>b.start+span)continue;
  const fraction=(time-b.start)/span, effect=makeClip(b.target,j.preset,span);
  styles.set(b.target,{...styles.get(b.target),...sampleStyle(effect,time-b.start)});
  if(a.target!==b.target)styles.set(a.target,{...styles.get(a.target),opacity:String(1-fraction)});
 }
 return styles;
}
function elementFor(scene:HTMLElement,target:string,pageId:string){
 if(target==='@page'||target===pageId)return scene.querySelector<HTMLElement>('.scene-page-content');
 return Array.from(scene.querySelectorAll<HTMLElement>('[data-node-id]')).find(el=>el.dataset.nodeId===target)?.querySelector<HTMLElement>('.scene-node-inner');
}
export function posePlayer(scene:HTMLElement,pageId:string){
 const attached=new Map<HTMLElement,Animation>();
 function draw(seq:Sequence,time:number){
  const touched=new Set<HTMLElement>();
  for(const [target,style] of sequenceStyles(seq,time)){
   const el=elementFor(scene,target,pageId);if(!el)continue;
   touched.add(el);let anim=attached.get(el);
   if(!anim){anim=el.animate([style,style],{duration:1,fill:'both'});anim.pause();anim.currentTime=0;attached.set(el,anim)}
   else (anim.effect as KeyframeEffect).setKeyframes([style,style]);
  }
  for(const [el,a] of attached)if(!touched.has(el)){a.cancel();attached.delete(el)}
 }
 return {draw,clear(){for(const a of attached.values())a.cancel();attached.clear()}};
}
export function useSceneMotions(ref:RefObject<HTMLDivElement|null>,page:ScenePage|undefined,enabled:boolean,work:Work){
 const navCleanup=useRef<(()=>void)|undefined>(undefined);useEffect(()=>()=>navCleanup.current?.(),[]);
 const running=useRef(new Map<string,()=>void>()),active=useRef(true);
 const timers=useRef(new Set<ReturnType<typeof setTimeout>>());
 function later(action:()=>void,ms:number){const timer=setTimeout(()=>{timers.current.delete(timer);if(active.current)action()},ms);timers.current.add(timer)}
 function play(owner:SceneNode,s:Sequence,media?:HTMLMediaElement){
  if(!ref.current||!page||!s.clips.length)return;
  const key=owner.id+'/'+s.binding;running.current.get(key)?.();
  const player=posePlayer(ref.current,page.id),start=performance.now(),end=lengthOf(s);
  const total=media&&s.mediaAuto&&Number.isFinite(media.duration)?media.duration:end;
  let frame=0,tailStart:number|undefined,stopped=false;
  function resume(){cancelAnimationFrame(frame);if(!stopped)frame=requestAnimationFrame(tick)}
  const mediaEvents=['playing','seeked','pause','ended'];
  for(const e of mediaEvents)media?.addEventListener(e,resume);
  function stop(){stopped=true;cancelAnimationFrame(frame);for(const e of mediaEvents)media?.removeEventListener(e,resume);player.clear();running.current.delete(key)}
  running.current.set(key,stop);
  function tick(now:number){
   if(stopped)return;
   let t=(now-start)/1000;
   if(media){t=media.currentTime;if(media.ended){tailStart??=now;t+=(now-tailStart)/1000}else tailStart=undefined}
   player.draw(s,Math.min(end,t*end/Math.max(.01,total)));
   if(media?.paused&&!media.ended)return;
   if(t<total||Boolean(media&&!media.ended)){frame=requestAnimationFrame(tick)}else if(!s.hold)stop();
  }
  frame=requestAnimationFrame(tick);
 }
 useEffect(()=>{
  active.current=true;const scene=ref.current;
  function event(e:Event){
   if(!enabled||!page||!(e.target instanceof Element))return;
   const id=e.target.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId,owner=page.nodes.find(n=>n.id===id);if(!owner)return;
   const media=e.target instanceof HTMLMediaElement?e.target:undefined;
   const bind=e.type==='playing'?'videoStart':e.type==='ended'?'videoEnd':'click';
   for(const s of owner.motion?.sequences||[])if(s.binding===bind){
    if(media&&bind==='videoStart'&&running.current.has(id+'/'+bind)&&media.currentTime>0)continue;
    play(owner,s,bind==='videoStart'?media:undefined);
   }
  }
  const events=['click','playing','ended'];events.forEach(e=>scene?.addEventListener(e,event,true));
  return ()=>{active.current=false;events.forEach(e=>scene?.removeEventListener(e,event,true));for(const stop of [...running.current.values()])stop();for(const t of timers.current)clearTimeout(t);timers.current.clear()};
 },[ref,page?.id,enabled]);
 return (owner:SceneNode,rule:Interaction,act:()=>void)=>{
  const seq=owner.motion?.sequences?.find(s=>s.binding===rule.id);
  if(!seq||!enabled){act();return}
  if(rule.action==='navigate'&&rule.targetId&&ref.current&&page&&work.pages.some(p=>p.id===rule.targetId)){
   navCleanup.current?.();navCleanup.current=transitionPages(ref.current,work,page.id,rule.targetId,seq,act);return;
  }
  if(rule.action==='detail'&&seq.when!=='before'){
   act();later(()=>{const popup=ref.current?.querySelector<HTMLElement>('.scene-detail');if(!popup)return;
    const clip=seq.clips[0];if(!clip)return;
    const frames=Array.from({length:25},(_,i)=>sampleStyle(clip,clip.duration*i/24));
    popup.animate(frames,{duration:clip.duration*1000,delay:clip.start*1000,fill:seq.hold?'both':'backwards'});
    const others={...seq,clips:seq.clips.slice(1)};if(others.clips.length)play(owner,others);
   },0);return;
  }
  if(seq.when==='before'){play(owner,seq);later(act,lengthOf(seq)*1000)}
  else if(seq.when==='after'){act();later(()=>play(owner,seq),0)}
  else {play(owner,seq);act()}
 };
}
