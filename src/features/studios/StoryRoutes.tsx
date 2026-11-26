import {useState} from 'react';
import {ChevronDown,CornerDownRight,Plus,Timer,Trash2,Zap} from 'lucide-react';
import type {StoryNode,StoryEdge,Asset} from '../../domain/types';
import {storyKind,storyTriggers,type StoryTrigger} from '../../domain/story-canvas';
import {eventCaption,eventSources,readVisitCondition,visitCondition,type VisitMode} from '../../domain/story-events';
import {Button} from '../../components/ui';
import {parseBranch,formatBranch,reorder} from './studioLogic';
import {storyMediaKind} from './creationLogic';
import '../../styles/story-flow-properties.css';

interface Props {focusedLayerId?:string;activeEdgeId?:string;node:StoryNode;nodes:StoryNode[];edges:StoryEdge[];assets:Asset[];onChange:(next:StoryEdge[])=>void}
function RouteCondition({condition,node,nodes,onChange}:{condition:string;node:StoryNode;nodes:StoryNode[];onChange:(value:string)=>void}){
 const visit=readVisitCondition(condition),others=nodes.filter(n=>n.id!==node.id);
 const legacy=condition!=='any'&&!visit;
 return <div className="route-condition">
  <label>生效条件<select aria-label="生效条件" value={visit?.mode||condition} onChange={e=>{
   const mode=e.target.value;
   onChange(mode==='any'?mode:visitCondition(mode as VisitMode,visit?.nodeId||others[0]?.id||''));
  }}><option value="any">任何时候</option>
   {others.length>0&&<><option value="visited">观众已到过某一幕</option><option value="unvisited">观众还没到过某一幕</option></>}
   {legacy&&<option value={condition}>原有条件 · {condition==='green'?'绿色能源':condition==='technology'?'智能制造':condition}</option>}
  </select></label>
  {visit&&<label>判断哪一幕<select aria-label="判断哪一幕" value={visit.nodeId} onChange={e=>onChange(visitCondition(visit.mode,e.target.value))}>
   {!others.some(n=>n.id===visit.nodeId)&&<option value={visit.nodeId}>原节点已移除</option>}
   {others.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}
  </select></label>}
 </div>;
}
export function StoryRoutes({node,nodes,edges,assets,onChange,focusedLayerId,activeEdgeId}:Props){
 const [expanded,setExpanded]=useState<string>();
 if(storyKind(node.type)==='end')return <p className="studio-muted">观众在这一幕抵达结局。</p>;
 const targets=nodes.filter(n=>n.id!==node.id&&storyKind(n.type)!=='start');
 const media=node.media?storyMediaKind(node,assets):'';
 const triggers:StoryTrigger[]=['click','delay'];
 for(const t of ['layerClick','videoEnd','htmlComplete'] as const)if(eventSources(node,media,t).length)triggers.push(t);
 if(storyKind(node.type)==='photo')triggers.push('photoConfirm','photoSkip');
 const patch=(id:string,delta:Partial<StoryEdge>)=>onChange(edges.map(edge=>edge.id===id?{...edge,...delta}:edge));
 const addRoute=(automatic=false)=>{
  const id=crypto.randomUUID();
  const event:StoryEdge={id,source:node.id,target:'',label:automatic?'自动跳转':'选项 '+(edges.length+1)};
  const binding=automatic?{trigger:'delay' as const,delaySeconds:5}:focusedLayerId?{trigger:'layerClick' as const,layerId:focusedLayerId}:{};
  onChange([...edges,{...event,...binding}]);setExpanded(id);
 };
 return <section className="story-routes story-route-list">
  <header><h4>{activeEdgeId?'分支规则':'事件与去向'}</h4>{!activeEdgeId&&<span>{edges.length} 条</span>}</header>
  {edges.map((edge,index)=>{
   if(activeEdgeId&&edge.id!==activeEdgeId)return null;
   const trigger=edge.trigger||'click',sources=eventSources(node,media,trigger);
   const branch=parseBranch(edge.label),target=targets.find(n=>n.id===edge.target);
   const open=activeEdgeId===edge.id||expanded===edge.id;
   return <article key={edge.id} className="story-route-card">
    <button type="button" className="story-route-summary" aria-expanded={open} disabled={!!activeEdgeId} onClick={()=>setExpanded(open?undefined:edge.id)}>
     <Zap size={14}/><span><strong>{eventCaption(edge,node)}</strong><small><CornerDownRight size={12}/>{edge.stay?'留在本幕':target?.title||'待连接'}</small></span>{!activeEdgeId&&<ChevronDown size={14}/>}
    </button>
    {open&&<div className="story-event-fields">
     <label>触发时机<select value={trigger} onChange={e=>{
      const type=e.target.value as StoryTrigger,allowed=eventSources(node,media,type);
      const source=allowed.find(s=>s.id===focusedLayerId)||allowed[0];
      patch(edge.id,{trigger:type,layerId:source?.id||undefined,delaySeconds:type==='delay'?(edge.delaySeconds||5):undefined});
     }}>{!triggers.includes(trigger)&&<option value={trigger}>{storyTriggers[trigger]}（来源已移除）</option>}
      {triggers.map(t=><option key={t} value={t}>{storyTriggers[t]}</option>)}</select></label>
     {['layerClick','htmlComplete','videoEnd'].includes(trigger)&&<label>事件来自<select value={edge.layerId||''} onChange={e=>patch(edge.id,{layerId:e.target.value||undefined})}>
      {!sources.some(s=>s.id===(edge.layerId||''))&&<option value={edge.layerId||''}>重新选择来源</option>}
      {sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
     {trigger==='delay'&&<label>停留秒数<input type="number" min={1} max={3600} value={edge.delaySeconds||5} onChange={e=>patch(edge.id,{delaySeconds:Math.min(3600,Math.max(1,Math.round(Number(e.target.value)||1)))})}/></label>}
     {trigger==='click'&&<label>选项名称<input aria-label={'选项名称 '+(index+1)} value={branch.label} onChange={e=>patch(edge.id,{label:formatBranch(e.target.value,branch.condition)})}/></label>}
     <label>完成后<select value={edge.stay?'__stay__':edge.target} onChange={e=>patch(edge.id,{stay:e.target.value==='__stay__',target:e.target.value==='__stay__'?'':e.target.value})}><option value="">待连接</option><option value="__stay__">留在本幕</option>{targets.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
     <details><summary>生效条件{branch.condition!=='any'?' · 已设置':''}</summary>
      <RouteCondition condition={branch.condition} node={node} nodes={nodes} onChange={c=>patch(edge.id,{label:formatBranch(branch.label,c)})}/>
     </details>
     {!!node.layers?.length&&<details><summary>同时操作画面控件{edge.effects?.length?' · '+edge.effects.length:''}</summary>
      {edge.effects?.map((fx,i)=><div className="story-effect" key={fx.id}><label>动作 {i+1}<select value={fx.kind} onChange={e=>patch(edge.id,{effects:edge.effects?.map(f=>f.id===fx.id?{...f,kind:e.target.value as 'show'|'hide'}:f)})}><option value="show">显示控件</option><option value="hide">隐藏控件</option></select></label>
       <select aria-label="动作目标" value={fx.layerId} onChange={e=>patch(edge.id,{effects:edge.effects?.map(f=>f.id===fx.id?{...f,layerId:e.target.value}:f)})}>{node.layers?.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
       <Button size="sm" disabled={!i} onClick={()=>patch(edge.id,{effects:reorder(edge.effects||[],i,-1)})}>上移</Button>
       <Button size="sm" onClick={()=>patch(edge.id,{effects:edge.effects?.filter(f=>f.id!==fx.id)})}>移除动作</Button></div>)}
      <Button size="sm" onClick={()=>patch(edge.id,{effects:[...edge.effects||[],{id:crypto.randomUUID(),layerId:node.layers![0].id,kind:'show'}]})}>添加控件动作</Button></details>}
     <footer>{edges.length>1&&<Button size="sm" disabled={!index} onClick={()=>onChange(reorder(edges,index,-1))}>提高优先级</Button>}
      <Button size="sm" onClick={()=>onChange(edges.filter(e=>e.id!==edge.id))}><Trash2 size={13}/>删除事件</Button></footer>
    </div>}
   </article>;
  })}
  {!activeEdgeId&&<footer className="story-route-add"><Button size="sm" onClick={()=>addRoute()}><Plus size={14}/>添加事件</Button>{!focusedLayerId&&<Button size="sm" onClick={()=>addRoute(true)}><Timer size={14}/>自动跳转</Button>}</footer>}
 </section>;
}
