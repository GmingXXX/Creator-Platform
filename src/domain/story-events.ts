import type {StoryNode,StoryEdge} from './types';
import {storyKind,storyTriggers,type StoryTrigger} from './story-canvas';

export type VisitMode='visited'|'unvisited';
export function visitCondition(mode:VisitMode,nodeId:string){return mode+':'+nodeId;}
export function readVisitCondition(condition:string){
 const match=condition.match(/^(visited|unvisited):(.+)$/);
 return match?{mode:match[1] as VisitMode,nodeId:match[2]}:undefined;
}
export function conditionAllows(condition:string,history:string[],legacyPreference:string){
 const visit=readVisitCondition(condition);
 if(visit)return visit.mode==='visited'?history.includes(visit.nodeId):!history.includes(visit.nodeId);
 return condition==='any'||condition===legacyPreference;
}
export function eventSources(node:StoryNode,media:string,trigger:StoryTrigger){
 const kind=trigger==='videoEnd'?'video':trigger==='htmlComplete'?'html':undefined;
 if(!kind&&trigger!=='layerClick')return [];
 const layers=(node.layers||[]).filter(layer=>!kind||layer.kind===kind).map(layer=>({id:layer.id,name:layer.name}));
 return kind&&media===kind?[{id:'',name:'场景主素材'},...layers]:layers;
}
export function eventCaption(edge:StoryEdge,node?:StoryNode){
 const trigger=edge.trigger||'click';
 const layer=node?.layers?.find(l=>l.id===edge.layerId);
 if(trigger==='click')return '点击「'+(edge.label.split('\n')[0]||'继续')+'」';
 if(trigger==='delay')return '进入 '+(edge.delaySeconds||5)+' 秒后';
 if(trigger==='layerClick')return '点击「'+(layer?.name||'画面控件')+'」';
 if(trigger==='videoEnd'||trigger==='htmlComplete')return (layer?.name||'主素材')+' · '+storyTriggers[trigger];
 return storyTriggers[trigger];
}
export function cloneStoryScene(node:StoryNode,outgoing:StoryEdge[]){
 const id=crypto.randomUUID(),layerIds=new Map(node.layers?.map(l=>[l.id,crypto.randomUUID()]));
 const copy={...structuredClone(node),id,title:node.title+' 副本',x:node.x+48,y:node.y+96,
  type:storyKind(node.type)==='start'?'scene':node.type,
  layers:node.layers?.map(l=>({...structuredClone(l),id:layerIds.get(l.id)!}))};
 const edges=outgoing.filter(e=>e.source===node.id).map(e=>({...structuredClone(e),id:crypto.randomUUID(),source:id,
  layerId:e.layerId?layerIds.get(e.layerId):undefined,effects:e.effects?.map(f=>({...f,id:crypto.randomUUID(),layerId:layerIds.get(f.layerId)||f.layerId}))}));
 return {node:copy,edges};
}

function triggerProblem(node:StoryNode,edge:StoryEdge,media:string){
 const trigger=edge.trigger;
 if(trigger==='photoConfirm'||trigger==='photoSkip')return storyKind(node.type)==='photo'?'':'「'+storyTriggers[trigger]+'」仅适用于拍照节点';
 const expected=trigger==='videoEnd'?'video':trigger==='htmlComplete'?'html':undefined;
 const layer=edge.layerId?node.layers?.find(l=>l.id===edge.layerId):undefined;
 if(edge.layerId&&!layer||trigger==='layerClick'&&!layer)return '事件来源已变化，请重新选择画面控件';
 if(!expected)return '';
 const title=expected==='video'?'视频':'HTML 互动';
 if(!layer)return media===expected?'':'主素材不是'+title+'，请更换素材或事件';
 if(layer.kind!==expected||!layer.src&&!layer.resultSource)return '事件来源「'+layer.name+'」缺少可播放的'+title;
 if(trigger==='videoEnd'&&layer.loop)return '视频「'+layer.name+'」已开启循环，无法触发播放完毕';
 return '';
}

/** A layer initially hidden may be revealed by an earlier event that stays on the scene. */
export function revealableStoryLayers(node:StoryNode,outgoing:StoryEdge[],media:string){
 const visible=new Set(node.layers?.filter(layer=>!layer.hidden).map(layer=>layer.id));
 let previousSize=-1;
 while(previousSize!==visible.size){
  previousSize=visible.size;
  for(const rule of outgoing){
   if(!rule.stay||rule.source!==node.id||!rule.effects?.length||triggerProblem(node,rule,media)||rule.layerId&&!visible.has(rule.layerId))continue;
   // Playback applies the last visibility action for each target in a single event.
   const actions=new Map(rule.effects.map(f=>[f.layerId,f.kind]));
   for(const [id,kind] of actions)if(kind==='show')visible.add(id);
  }
 }
 return visible;
}
export function eventConfigurationIssues(node:StoryNode,edge:StoryEdge,condition:string,nodeIds:Set<string>,media:string,visible:Set<string>){
 const problems:string[]=[];
 const visit=readVisitCondition(condition);
 if(visit&&!nodeIds.has(visit.nodeId))problems.push('「'+node.title+'」的生效条件指向已移除的节点');
 const incompatible=triggerProblem(node,edge,media);
 if(incompatible)problems.push('「'+node.title+'」的'+incompatible);
 else if(edge.layerId&&!visible.has(edge.layerId))problems.push('「'+node.title+'」的事件来源「'+node.layers?.find(l=>l.id===edge.layerId)?.name+'」初始隐藏，需要添加能在本幕显示它的动作');
 if(edge.effects?.some(f=>!node.layers?.some(l=>l.id===f.layerId)))problems.push('「'+node.title+'」的控件动作指向已移除的图层');
 return problems;
}

export function parseBranch(label:string):{label:string;condition:string}{const parts=label.split('\n[条件] ');return {label:parts[0],condition:parts[1]||'any'}};
export function formatBranch(label:string,condition:string):string{return condition==='any'?label:`${label}\n[条件] ${condition}`;}

export function mapConditionNode(label:string,ids:Map<string,string>){
 const branch=parseBranch(label),visit=readVisitCondition(branch.condition);
 const copyId=visit&&ids.get(visit.nodeId);
 return visit&&copyId?formatBranch(branch.label,visitCondition(visit.mode,copyId)):label;
}
