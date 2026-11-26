import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import type {Work} from '../../domain/types';
import {lengthOf,type Sequence} from '../../domain/motion-sequence';
import {SceneRenderer} from './SceneRenderer';
import {posePlayer} from './motion-playback';

// Keep both pages visible for the transition even when the underlying navigation is immediate.
export function transitionPages(scene:HTMLElement,work:Work,from:string,to:string,seq:Sequence,navigate:()=>void){
 const host=document.createElement('div');host.className='motion-page-transition';
 Object.assign(host.style,{position:'absolute',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'15'});scene.appendChild(host);
 const root=createRoot(host),duration=lengthOf(seq),before=seq.when==='before';
 flushSync(()=>root.render(<><div data-outgoing=""><SceneRenderer work={work} pageId={from}/></div><div data-incoming="" style={{position:'absolute',inset:0}}><SceneRenderer work={work} pageId={to}/></div></>));
 const outgoing=host.querySelector<HTMLElement>('[data-outgoing]')!,incoming=host.querySelector<HTMLElement>('[data-incoming]')!,oldPage=posePlayer(outgoing,from),newPage=posePlayer(incoming,to);
 const targetsDestination=seq.clips.some(c=>c.target===to||work.pages.find(p=>p.id===to)?.nodes.some(n=>n.id===c.target));
 const start=performance.now();let frame=0,done=false;
 function stop(){if(done)return;done=true;cancelAnimationFrame(frame);oldPage.clear();newPage.clear();host.remove();queueMicrotask(()=>root.unmount())}
 function draw(now:number){
  if(!host.isConnected){stop();return}
  const time=Math.min(duration,(now-start)/1000);
  // Animate the incoming page including its background and preserve the outgoing snapshot below.
  outgoing.style.opacity='1';incoming.style.opacity=targetsDestination?String(time/duration):'0';
  oldPage.draw(seq,time);newPage.draw(seq,time);
  if(time<duration)frame=requestAnimationFrame(draw);else {stop();if(before)navigate()}
 }
 draw(start);if(!before)navigate();return stop;
}
