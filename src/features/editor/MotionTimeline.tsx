import {useRef,useState,type PointerEvent} from 'react';
import {ChevronDown,ChevronRight,Copy,Plus,Trash2} from 'lucide-react';
import {base,canJoin,lengthOf,moveClip,presetGroups,properties,resizeClip,sample,speeds,stamp,tidyJoins,uid,type Clip,type Property,type Sequence,type Speed} from '../../domain/motion-sequence';
import type {SceneNode,Work} from '../../domain/types';
import {MotionScenePreview} from './MotionScenePreview';
import {toast} from '../../components/ui';

export function MotionTimeline({work,pageId,sequence:s,clip:c,time,seek,save,select,add,play,playing,undo,redo}:{work:Work;pageId:string;sequence:Sequence;clip:Clip;time:number;seek:(t:number)=>void;save:(s:Sequence)=>void;select:(id:string)=>void;add:()=>void;play:(loop:boolean)=>void;playing:boolean;undo:()=>void;redo:()=>void}){
 const [zoom,setZoom]=useState(1),[snap,setSnap]=useState(true),[loop,setLoop]=useState(false),[lock,setLock]=useState(false),[expanded,setExpanded]=useState(true),[moreTracks,setMoreTracks]=useState(0);
 const [multi,setMulti]=useState<string[]>([]),[property,setProperty]=useState<Property>('x');const clipboard=useRef<{clips?:Clip[];frame?:{p:Property;v:number;ease?:Speed}}|null>(null);
 const total=Math.max(4,lengthOf(s)*1.25),tracks=Math.max(1,...s.clips.map(v=>v.track+1),moreTracks),local=Math.max(0,Math.min(c.duration,Math.round((time-c.start)*1000)/1000));
 const pose=sample(c,local),at=(p:Property)=>c.keys[p]?.find(f=>Math.abs(f.t-local)<.004),node=work.pages.flatMap(p=>p.nodes).find(n=>n.id===c.target);
 const label=(v:Clip)=>work.pages.flatMap(p=>p.nodes).find(n=>n.id===v.target)?.name||work.pages.find(p=>p.id===v.target)?.name||'整个页面';
 const shownPage=work.pages.find(p=>p.id===c.target||p.nodes.some(n=>n.id===c.target))?.id||pageId;
 const snapTime=(t:number)=>{
  if(!snap)return Math.max(0,Math.round(t*100)/100);
  const anchors=[0,time,...s.clips.flatMap(x=>[x.start,x.start+x.duration])],nearest=anchors.reduce((a,b)=>Math.abs(t-a)<=Math.abs(t-b)?a:b);
  return Math.max(0,Math.abs(nearest-t)<.065?nearest:Math.round(t*10)/10);
 };
 function setClips(clips:Clip[]){save({...s,clips,joins:tidyJoins(clips,s.joins)})}
 function replace(clip:Clip){const clips=s.clips.map(v=>v.id===clip.id?clip:v);if(moveClip(clips,clip.id,clip.start,clip.track)===clips&&clips.some(v=>v.id!==clip.id&&v.target===clip.target&&v.start<clip.start+clip.duration-.001&&clip.start<v.start+v.duration-.001)){toast('同一对象的两个片段不能重叠');return}setClips(clips)}
 function edit(p:Property,v:number){
  let next=stamp(c,p,local,v);if(lock&&node&&(p==='width'||p==='height')){const ratio=node.w/Math.max(1,node.h);next=stamp(next,p==='width'?'height':'width',local,p==='width'?v/ratio:v*ratio)}replace(next);
 }
 function mark(p:Property){setProperty(p);if(!at(p))edit(p,pose[p]);else replace({...c,keys:{...c.keys,[p]:c.keys[p]?.filter(f=>Math.abs(f.t-local)>=.004)}})}
 function paste(){
  if(clipboard.current?.frame){const f=clipboard.current.frame;replace(stamp(c,f.p,local,f.v,f.ease));return}
  const list=clipboard.current?.clips||[];if(!list.length)return;const first=Math.min(...list.map(x=>x.start)),added=list.map(x=>({...x,id:uid(),start:snapTime(time+x.start-first)}));const clips=[...s.clips,...added];
  if(added.some(x=>clips.some(y=>x!==y&&x.target===y.target&&x.start<y.start+y.duration-.001&&y.start<x.start+x.duration-.001))){toast('粘贴位置已有同一对象的片段，请移动播放头');return}setClips(clips);select(added[0].id)
 }
 function gesture(e:PointerEvent,clip:Clip,kind:'move'|'left'|'right',p?:Property,frameTime?:number){
  e.stopPropagation();if(e.button!==0)return;
  if(e.shiftKey)setMulti(prev=>prev.includes(clip.id)?prev.filter(id=>id!==clip.id):[...new Set([...prev,c.id,clip.id])]);else setMulti([]);
  select(clip.id);const lane=e.currentTarget.closest('.seq-lane') as HTMLElement;if(!lane)return;
  const sx=e.clientX,sy=e.clientY,w=lane.clientWidth,rect=lane.getBoundingClientRect();const el=e.currentTarget as HTMLElement;el.setPointerCapture(e.pointerId);
  const finish=(ev:globalThis.PointerEvent)=>{
   el.removeEventListener('pointerup',finish);el.removeEventListener('pointercancel',cancel);const delta=(ev.clientX-sx)/w*total;
   if(p&&frameTime!==undefined){if(Math.abs(ev.clientX-sx)<3){setProperty(p);seek(clip.start+frameTime);return}const f=clip.keys[p]?.find(k=>k.t===frameTime);if(f){const t=Math.min(clip.duration,snapTime(frameTime+delta));replace(stamp({...clip,keys:{...clip.keys,[p]:clip.keys[p]?.filter(k=>k.t!==frameTime)}},p,t,f.v,f.ease));seek(clip.start+t)}return}
   if(Math.abs(ev.clientX-sx)<3&&Math.abs(ev.clientY-sy)<3){seek(clip.start+Math.min(clip.duration,Math.max(0,(sx-rect.left)/w*total-clip.start)));return}
   if(kind==='right'){replace(resizeClip(clip,snapTime(clip.duration+delta)));return}
   if(kind==='left'){const start=Math.min(clip.start+clip.duration-.1,snapTime(clip.start+delta)),cut=start-clip.start;const keys={...clip.keys};for(const prop of Object.keys(keys) as Property[]){keys[prop]=[{t:0,v:sample(clip,cut)[prop]},...(keys[prop]||[]).filter(k=>k.t>cut).map(k=>({...k,t:k.t-cut}))]}replace({...clip,start,duration:clip.duration-cut,keys});return}
   const trackEl=document.elementFromPoint(ev.clientX,ev.clientY)?.closest<HTMLElement>('[data-track]'),track=trackEl?Number(trackEl.dataset.track):clip.track;
   const moved=moveClip(s.clips,clip.id,snapTime(clip.start+delta),track);if(moved===s.clips)toast('同一对象的片段不能重叠');else setClips(moved);
  };
  const cancel=()=>{el.removeEventListener('pointerup',finish);el.removeEventListener('pointercancel',cancel)};
  el.addEventListener('pointerup',finish);el.addEventListener('pointercancel',cancel);
 }
 const visibleProperties=(Object.keys(properties) as Property[]).filter(p=>node||!['width','height'].includes(p));
 return <div className="motion-timeline-editor">
  <div className="seq-tools"><strong>正在记录动效</strong><button onClick={()=>play(loop)}>{playing?'暂停':'播放这段'}</button><label><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/>循环</label><button onClick={undo}>撤销</button><button onClick={redo}>重做</button></div>
  <div className="seq-edit-body"><div><MotionScenePreview work={work} pageId={shownPage} sequence={s} time={time} recordTarget={c.target} onPick={id=>{const other=s.clips.find(x=>x.target===id);if(other)select(other.id)}} onMove={(dx,dy)=>{let changed=c;if(dx)changed=stamp(changed,'x',local,pose.x+dx);if(dy)changed=stamp(changed,'y',local,pose.y+dy);replace(changed)}}/><small>移动播放头后，拖动画面中的对象记录位置。</small></div>
  <div className="seq-props"><strong>{label(c)}</strong>{visibleProperties.map(p=><label key={p}><span>{properties[p]}</span><input type="number" step={p==='opacity'||p==='scale'?.05:1} value={Number(pose[p].toFixed(2))} onChange={e=>{if(e.target.value!=='')edit(p,Number(e.target.value))}}/><button title={at(p)?'此刻已记录，点击移除':c.keys[p]?.length?'其他时刻已记录':'未记录，点击记录'} aria-label={properties[p]+'关键帧'} className={c.keys[p]?.length?'marked':''} onClick={()=>mark(p)}>{at(p)?'◆':'◇'}</button></label>)}
  {node&&<label><input type="checkbox" checked={lock} onChange={e=>setLock(e.target.checked)}/>锁定宽高比例</label>}
  <button onClick={()=>{let n=c;for(const p of visibleProperties.filter(p=>pose[p]!==base[p]))n=stamp(n,p,local,base[p]);replace(n)}}>此刻回到原位</button>
  {at(property)&&<label>到下一帧<select value={at(property)?.ease||c.speed} onChange={e=>replace(stamp(c,property,local,pose[property],e.target.value as Speed))}>{Object.entries(speeds).map(([k,n])=><option key={k} value={k}>{n}</option>)}</select></label>}</div></div>
  <div className="seq-tools"><button onClick={()=>setExpanded(!expanded)}>{expanded?<ChevronDown size={14}/>:<ChevronRight size={14}/>}时间轴</button><label>播放头 s<input aria-label="播放头 s" type="number" step=".1" min={0} value={Number(time.toFixed(2))} onChange={e=>seek(Math.max(0,Number(e.target.value)))}/></label><button onClick={add}><Plus size={13}/>片段</button><button onClick={()=>setMoreTracks(tracks+1)}>加轨道</button><label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/>吸附</label><label>缩放<input type="range" min="1" max="4" step=".5" value={zoom} onChange={e=>setZoom(+e.target.value)}/></label></div>
  {expanded&&<div className="seq-horizontal"><div style={{width:zoom*100+'%'}}>{Array.from({length:tracks},(_,track)=><div key={track} className="seq-lane" data-track={track} onPointerDown={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();seek(snapTime((e.clientX-r.left)/r.width*total))}}}><small>轨道 {track+1}</small>
   {s.clips.filter(x=>x.track===track).map(x=><div role="button" tabIndex={0} key={x.id} className={'seq-clip '+(x.id===c.id||multi.includes(x.id)?'selected':'')} style={{left:x.start/total*100+'%',width:x.duration/total*100+'%'}} onKeyDown={e=>{if(e.key==='Enter')select(x.id)}} onPointerDown={e=>gesture(e,x,'move')}><i title="裁剪开始" onPointerDown={e=>gesture(e,x,'left')}/>{label(x)} · {x.preset}<i title="调整结束" onPointerDown={e=>gesture(e,x,'right')}/>{(x.keys[property]||[]).map(f=><b title={properties[property]+' · '+f.t+'秒'} key={f.t} style={{left:f.t/x.duration*100+'%'}} onPointerDown={e=>gesture(e,x,'move',property,f.t)}>◆</b>)}</div>)}
   <div className="seq-playhead" style={{left:Math.min(100,time/total*100)+'%'}}/></div>)}</div></div>}
  <div className="seq-tools"><button onClick={()=>{clipboard.current={clips:s.clips.filter(x=>[...multi,c.id].includes(x.id))};toast('已复制片段')}}><Copy size={13}/>复制片段</button><button disabled={!at(property)} onClick={()=>{const f=at(property)!;clipboard.current={frame:{p:property,v:f.v,ease:f.ease}};toast('已复制关键帧')}}>复制此帧</button><button onClick={paste}>粘贴到播放头</button><button onClick={()=>setClips(s.clips.filter(x=>![...multi,c.id].includes(x.id)))}><Trash2 size={13}/>删片段</button><button onClick={()=>{setMoreTracks(Math.max(0,tracks-1));setClips(s.clips.filter(x=>x.track!==c.track).map(x=>x.track>c.track?{...x,track:x.track-1}:x))}}>删除所在轨道</button></div>
  {s.clips.filter(x=>canJoin(c,x)).map(x=><label key={x.id}>与「{label(x)}」接缝<select value={s.joins.find(j=>j.left===c.id&&j.right===x.id)?.preset||''} onChange={e=>save({...s,joins:[...s.joins.filter(j=>j.left!==c.id||j.right!==x.id),...(e.target.value?[{left:c.id,right:x.id,preset:e.target.value}]:[])]})}><option value="">无转场</option>{presetGroups.交接.map(v=><option key={v}>{v}</option>)}</select></label>)}
 </div>
}
