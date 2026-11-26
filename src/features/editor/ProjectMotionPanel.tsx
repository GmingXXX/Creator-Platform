import {useEffect,useMemo,useRef,useState} from 'react';
import {Play,Pause,Plus,Search,SlidersHorizontal} from 'lucide-react';
import {Button,Modal,toast} from '../../components/ui';
import {focusCamera,lengthOf,makeClip,presetGroups,readSequences,resizeClip,speeds,storeSequences,tidyJoins,type Clip,type Sequence,type Speed} from '../../domain/motion-sequence';
import type {SceneNode,Work} from '../../domain/types';
import {MotionScenePreview} from './MotionScenePreview';
import {MotionTimeline} from './MotionTimeline';
import {consumeMotionRule} from './motion-rule-link';
import './motion-sequence.css';

const builtins:Record<string,string>={click:'点击时',videoStart:'视频开始播放时',videoEnd:'视频播放结束时',videoPause:'视频暂停时',pageEnter:'进入页面时',idle:'持续无操作时',allVisited:'全部看过时'};
const actionWords:Record<string,string>={navigate:'跳转页面',detail:'打开详情',show:'显示',hide:'隐藏',play:'播放',pause:'暂停',toggle:'切换显示'};
type Props={work:Work;pageId:string;node?:SceneNode;patchNode:(p:Partial<SceneNode>)=>void;onPreview:()=>void};
export function ProjectMotionPanel(props:Props){
 if(!props.node)return <p className="inspector-hint">在画布上选中触发动效的组件。</p>;
 return <Panel {...props} node={props.node}/>;
}
function Panel({work,pageId,node,patchNode,onPreview}:Props&{node:SceneNode}){
 const [mediaLength,setMediaLength]=useState(0);
 const original=useMemo(()=>readSequences(node).map(s=>s.mediaAuto&&mediaLength>0&&s.clips.length===1?{...s,clips:[resizeClip(s.clips[0],mediaLength)]}:s),[node.id,node.motion,mediaLength]);
 const [binding,setBinding]=useState(()=>consumeMotionRule()||original[0]?.binding||(node.type==='video'?'videoStart':'click'));
 const fallback=useMemo(()=>{
  const seq=readSequences({...node,motion:undefined})[0],r=node.interactions?.find(x=>x.id===binding);
  return r?{...seq,binding,clips:[makeClip(r.targetId||node.id,r.action==='detail'?'轻弹进入':'淡入',.6)]}:{...seq,binding};
 },[binding,node.id,node.interactions]);
 const sequence=original.find(v=>v.binding===binding)||fallback;
 const [id,setId]=useState(''),clip=sequence.clips.find(c=>c.id===id)||sequence.clips[0];const [panel,setPanel]=useState<''|'library'|'timeline'|'targets'>('');
 const [search,setSearch]=useState(''),[group,setGroup]=useState('全部'),[sampleName,setSampleName]=useState(''),[pending,setPending]=useState(''),[time,setTime]=useState(0),[playing,setPlaying]=useState(false);
 const [adding,setAdding]=useState(false);
 const undo=useRef<Sequence[][]>([]),redo=useRef<Sequence[][]>([]),frame=useRef(0),current=useRef(time);current.current=time;
 const page=work.pages.find(p=>p.id===pageId),targets=work.pages.flatMap(p=>[{id:p.id,name:p.name,page:p.id},...p.nodes.map(n=>({id:n.id,name:n.name,page:p.id}))]);
 const targetName=(target?:string)=>target==='@page'?'整个页面':targets.find(t=>t.id===target)?.name||'已移除对象';
 const rule=node.interactions?.find(r=>r.id===binding),bindings=Array.from(new Set(['click',...(node.type==='video'?['videoStart','videoEnd']:[]),...(node.interactions||[]).map(r=>r.id),...original.map(s=>s.binding)]));
 const bindingName=(b:string)=>{const r=node.interactions?.find(v=>v.id===b);return r?(builtins[r.event]||r.event)+' · '+(actionWords[r.action]||r.action)+(r.targetId?' '+targetName(r.targetId):''):builtins[b]||'原交互规则已移除'};
 const isPage=clip?.target==='@page'||work.pages.some(p=>p.id===clip?.target);
 const selectedPreset=(target:string,name:string,duration:number)=>focusCamera(makeClip(target,name,duration),node,work);
 const sampled=useMemo(()=>sampleName&&clip?{...sequence,clips:[{...selectedPreset(clip.target,sampleName,1.2),start:0}],joins:[]}:sequence,[sampleName,sequence,clip]);
 function stop(){cancelAnimationFrame(frame.current);setPlaying(false)}
 function seek(t:number){stop();setTime(t)}
 function save(next:Sequence){const list=[...original.filter(s=>s.binding!==binding),next];undo.current=[...undo.current.slice(-60),original];redo.current=[];patchNode({motion:storeSequences(node.motion,list)})}
 function history(back:boolean){const source=back?undo:redo,dest=back?redo:undo;const next=source.current.at(-1);if(!next)return;source.current=source.current.slice(0,-1);dest.current=[...dest.current,original];stop();patchNode({motion:storeSequences(node.motion,next)})}
 function clips(next:Clip[],extra:Partial<Sequence>={}){save({...sequence,...extra,clips:next,joins:tidyJoins(next,sequence.joins)})}
 function patch(c:Clip,extra:Partial<Sequence>={}){const list=sequence.clips.map(v=>v.id===c.id?c:v);if(list.some(x=>x.id!==c.id&&x.target===c.target&&x.start<c.start+c.duration-.001&&c.start<x.start+x.duration-.001)){toast('同一对象的两个片段不能重叠');return}clips(list,extra)}
 function play(loop=false,restart=false,overrideLength?:number){if(playing&&!restart){stop();return}cancelAnimationFrame(frame.current);const end=overrideLength||lengthOf(sampled),from=restart||current.current>=end?0:current.current,start=performance.now()-from*1000;setTime(from);setPlaying(true);const tick=(now:number)=>{const t=(now-start)/1000;if(t>=end&&!loop){setTime(end);setPlaying(false);return}setTime(t%end);frame.current=requestAnimationFrame(tick)};frame.current=requestAnimationFrame(tick)}
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 useEffect(()=>{const listener=(e:Event)=>{const id=(e as CustomEvent).detail?.id;if(typeof id==='string'){consumeMotionRule();setBinding(id);seek(0)}};window.addEventListener('studio:motion-rule',listener);return()=>window.removeEventListener('studio:motion-rule',listener)},[]);
 function previewPreset(name:string){setSampleName(name);play(false,true,1.2)}
 function apply(name:string){if(!clip)return;const c=selectedPreset(clip.target,name,clip.duration);patch({...c,id:clip.id,start:clip.start,track:clip.track});setPending('');setSampleName('');setPanel('');play(false,true,lengthOf(sequence))}
 function pick(target:string){
  const d=binding==='videoStart'&&sequence.mediaAuto?(mediaLength||10):1;
  if(!adding&&clip){patch({...clip,target});setPanel('');return}
  const c=makeClip(target,'淡入',d);const end=Math.max(0,...sequence.clips.filter(v=>v.target===target).map(v=>v.start+v.duration));
  const next={...c,start:end,track:Math.max(0,...sequence.clips.map(x=>x.track+(x.target===target?0:1)))};clips([...sequence.clips,next]);setId(next.id);setPanel('')
 }
 function chooseBinding(b:string){
  setBinding(b);setId('');seek(0);
  const r=node.interactions?.find(v=>v.id===b);
  if(r&&!original.some(s=>s.binding===b)){const target=r.targetId||(r.action==='detail'?node.id:'@page');const next={...fallback,binding:b,clips:[makeClip(target,r.action==='detail'?'轻弹进入':'淡入',.6)]};undo.current=[...undo.current,original];patchNode({motion:storeSequences(node.motion,[...original,next])})}
 }
 const allowed=Object.entries(presetGroups).filter(([k])=>(k!=='页面运镜'||isPage)&&(k!=='交接'||!!rule));
 const targetPage=targets.find(t=>t.id===clip?.target)?.page||pageId;
 const changePanel=(v:typeof panel)=>{stop();setPending('');setSampleName('');setPanel(v)};
 const summary=(bindingName(binding)+'，让'+targetName(clip?.target)+(clip?.preset==='无动效'?'保持原样':'「'+(clip?.preset||'无动效')+'」'));
 const renderPreview=()=><MotionScenePreview work={work} pageId={targetPage} sequence={sampled} time={time}/>;
 return <div className="project-motion" onLoadedMetadataCapture={e=>{const video=e.target;if(video instanceof HTMLVideoElement&&video.closest('[data-node-id]')?.getAttribute('data-node-id')===node.id&&Number.isFinite(video.duration))setMediaLength(video.duration)}}>
 <label>触发时机<select value={binding} onChange={e=>chooseBinding(e.target.value)}>{bindings.map(b=><option key={b} value={b}>{bindingName(b)}</option>)}</select></label>
 {clip?<><strong>{summary}</strong>{renderPreview()}<div className="seq-tools"><button onClick={()=>play(false,(!playing&&time>=lengthOf(sequence)))}>{playing?<Pause size={14}/>:<Play size={14}/>} {playing?'暂停':'播放这段'}</button><small>{time.toFixed(1)} / {lengthOf(sequence).toFixed(1)} 秒</small></div>
 {sequence.clips.length>1&&<label>当前片段<select value={clip.id} onChange={e=>setId(e.target.value)}>{sequence.clips.map((c,i)=><option key={c.id} value={c.id}>{i+1}. {targetName(c.target)} · {c.preset}</option>)}</select></label>}
 <label>谁发生变化<button onClick={()=>{setAdding(false);changePanel('targets')}}>{targetName(clip.target)} ›</button></label>
 <label>效果<button onClick={()=>{setGroup('全部');setSearch('');changePanel('library')}}>{clip.preset} ›</button></label>
 <label>时长（秒）<input min=".1" max="600" step=".1" type="number" value={clip.duration} onChange={e=>{if(e.target.value)patch(resizeClip(clip,Math.min(600,+e.target.value)),{mediaAuto:false})}}/></label>
 {binding==='videoStart'&&<button onClick={()=>patch(resizeClip(clip,mediaLength||clip.duration),{mediaAuto:true})}>{sequence.mediaAuto?'✓ ':''}跟随视频时长{mediaLength?'（'+mediaLength.toFixed(1)+' 秒）':''}</button>}
 <details><summary>播放设置</summary><label>开始时间（秒）<input type="number" min="0" max="600" step=".1" value={clip.start} onChange={e=>{if(e.target.value)patch({...clip,start:Math.max(0,+e.target.value)})}}/></label><label>速度变化<select value={clip.speed} onChange={e=>patch({...clip,speed:e.target.value as Speed})}>{Object.entries(speeds).map(([k,n])=><option key={k} value={k}>{n}</option>)}</select></label>
 {rule&&<label>与动作的顺序<select value={sequence.when} onChange={e=>save({...sequence,when:e.target.value as Sequence['when']})}><option value="before">先播效果，再执行动作</option><option value="together">同时开始</option>{rule.action!=='navigate'&&<option value="after">动作完成后再播</option>}</select></label>}
 <label><input type="checkbox" checked={sequence.hold} onChange={e=>save({...sequence,hold:e.target.checked})}/>保持结束状态</label></details>
 <Button onClick={()=>changePanel('timeline')}><SlidersHorizontal size={14}/>精调时间轴</Button></>:<p>这个触发时机尚未添加片段。</p>}
 <div className="seq-tools"><button onClick={()=>{setAdding(true);changePanel('targets')}}><Plus size={13}/>添加作用对象</button>{clip&&<button onClick={()=>{clips(sequence.clips.filter(c=>c.id!==clip.id));setId('')}}>移除片段</button>}<button disabled={!undo.current.length} onClick={()=>history(true)}>撤销</button></div>
 <Button onClick={()=>onPreview()}>交互预览</Button>
 <details><summary>查看动效示例</summary><a href={import.meta.env.BASE_URL+"motion/studio-v5.html"} target="_blank" rel="noreferrer">数学家展项 · 跳页、弹窗、视频运镜联动 ↗</a></details>
 <Modal open={panel==='targets'} onClose={()=>changePanel('')} title={adding?'添加作用对象':'选择作用对象'}><div className="seq-picker"><button onClick={()=>pick('@page')}>整个当前页面</button>{work.pages.map(p=><details open={p.id===page?.id} key={p.id}><summary>{p.name}</summary><button onClick={()=>pick(p.id)}>整页运镜 · {p.name}</button>{p.nodes.map(n=><button key={n.id} onClick={()=>pick(n.id)}>{n.name}</button>)}</details>)}</div></Modal>
 <Modal open={panel==='library'} onClose={()=>changePanel('')} title="选择动效"><div className="project-motion"><div className="seq-search"><Search size={15}/><input value={search} placeholder="搜索动效" onChange={e=>setSearch(e.target.value)}/></div><div className="seq-tools">{['全部',...allowed.map(([k])=>k)].map(g=><button className={group===g?'active':''} key={g} onClick={()=>setGroup(g)}>{g}</button>)}</div>{renderPreview()}<div className="seq-preset-list">{allowed.filter(([k])=>group==='全部'||group===k).flatMap(([,names])=>names.filter(n=>n.includes(search)).map(n=><button key={n} className={sampleName===n?'active':''} onPointerEnter={()=>previewPreset(n)} onFocus={()=>previewPreset(n)} onClick={()=>previewPreset(n)}>{n}</button>))}</div>{pending?<><p>应用「{pending}」将重建这个片段的关键帧。</p><Button onClick={()=>apply(pending)}>替换当前片段</Button></>:<Button disabled={!sampleName} onClick={()=>clip?.custom?setPending(sampleName):apply(sampleName)}>应用所选效果</Button>}</div></Modal>
 <Modal open={panel==='timeline'&&!!clip} onClose={()=>changePanel('')} wide title="精调动效时间轴" footer={<Button variant="primary" onClick={()=>changePanel('')}>完成编辑</Button>}>{clip&&<MotionTimeline work={work} pageId={pageId} sequence={sequence} clip={clip} time={time} seek={seek} save={save} select={setId} add={()=>{setAdding(true);changePanel('targets')}} play={play} playing={playing} undo={()=>history(true)} redo={()=>history(false)}/>}</Modal>
 </div>
}
