import type {NodeKind,StudioData,Work} from './types';
import {workspaceCanEdit} from './workspace-management';
import {useStudio} from './store';
import {workDependencyError} from './resource-permissions';

export const referenceDimensions={interaction:'交互方式',ui:'UI 风格',content:'内容组织',effect:'局部效果'} as const;
export type ReferenceDimension=keyof typeof referenceDimensions;
export interface ReferenceSnapshot {
 kind:Work['kind'];pageCount:number;nodeTypes:NodeKind[];itemGroupSizes:number[];
 interactions:{event:string;action:string;targetType:NodeKind|'page'|'node'|'unknown'}[];
 visuals:{background?:string;text?:string;accent?:string;fontSize?:number;radius?:number};
 layout:{type:NodeKind;x:number;y:number;w:number;h:number}[];motion:string[];
}
export interface ExhibitReference {
 transfer?:{workspaceId:string;sourceWorkspaceId:string;workId:string};
 id:string;sourceKind:'work'|'template';sourceId:string;sourceTitle:string;sourceRevision:number;
 dimension:ReferenceDimension;scope:string;scopeLabel:string;note:string;status:'reference'|'adopted';
 snapshot:ReferenceSnapshot;adoptionEvidence?:string;
}
export type ReferenceState=Pick<StudioData,'works'|'templates'|'assets'|'workspaces'|'workspaceMembers'|'workspaceActors'>;
export type ReferenceInput=Pick<ExhibitReference,'sourceKind'|'sourceId'|'dimension'>&Partial<Pick<ExhibitReference,'scope'|'note'>>;
const nodeTypes:NodeKind[]=['text','image','video','audio','shape','card','timeline','gallery','graph','map','flow','chart','bubble','button','html'];
const events=['click','videoStart'],actions=['detail','navigate','show','hide','toggle','play','state'];
const color=(value:unknown):value is string=>typeof value==='string'&&/^(#[a-f\d]{3}|#[a-f\d]{6}|#[a-f\d]{8}|transparent)$/i.test(value);
const bounded=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const cleanText=(value:unknown,max:number,fallback=''):string=>{
 if(value===undefined)return fallback;
 if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw new Error('参考说明格式无效或过长');
 return value.trim();
};

export function referenceSource(state:ReferenceState,workspaceId:string,kind:ExhibitReference['sourceKind'],id:string):Work {
 if(!workspaceCanEdit(state,workspaceId))throw new Error('当前空间为只读或已不可用，无法使用参考展项');
 const source=kind==='template'?state.templates.find(t=>t.id===id)?.work:kind==='work'?state.works.find(w=>w.id===id&&(w.workspaceId||'personal')===workspaceId):undefined;
 if(!source||source.deletedAt)throw new Error('参考展项已不可用或不属于当前空间，请移除或重新选择');
 const dependency=workDependencyError(state.assets,source,workspaceId,'ai');if(dependency)throw new Error(dependency);
 return source;
}
export function referenceScopeOptions(work:Work):{value:string;label:string}[]{
 return [{value:'work',label:'整个展项'},...work.pages.flatMap(page=>[
  {value:`page:${page.id}`,label:`页面 · ${page.name}`},
  ...page.nodes.map(node=>({value:`node:${page.id}:${node.id}`,label:`组件 · ${node.name}`})),
 ]),...(work.storyNodes||[]).map(node=>({value:`story:${node.id}`,label:`故事节点 · ${node.title}`})),...(work.shots||[]).map(shot=>({value:`shot:${shot.id}`,label:`分镜 · ${shot.title}`}))];
}
function scopedNodes(work:Work,scope:string){
 const option=referenceScopeOptions(work).find(item=>item.value===scope);
 if(!option)throw new Error('参考范围已不存在，请重新选择页面或组件');
 const pages=scope==='work'?work.pages:work.pages.filter(page=>scope===`page:${page.id}`||page.nodes.some(node=>scope===`node:${page.id}:${node.id}`));
 const nodes=pages.flatMap(page=>page.nodes.filter(node=>scope==='work'||scope===`page:${page.id}`||scope===`node:${page.id}:${node.id}`));
 return {pages,nodes,label:option.label};
}
function nativeSnapshot(work:Work,scope:string):ReferenceSnapshot|undefined {
 const empty={kind:work.kind,pageCount:0,nodeTypes:[] as NodeKind[],itemGroupSizes:[] as number[],interactions:[] as ReferenceSnapshot['interactions'],visuals:{},layout:[],motion:[]};
 if(work.kind==='story'&&(scope==='work'||scope.startsWith('story:'))){
  const nodes=(work.storyNodes||[]).filter(node=>scope==='work'||scope===`story:${node.id}`),ids=nodes.map(node=>node.id);
  const edges=(work.storyEdges||[]).filter(edge=>ids.includes(edge.source));
  return {...empty,pageCount:nodes.length,nodeTypes:edges.length?['button']:['text'],itemGroupSizes:nodes.map(node=>(work.storyEdges||[]).filter(edge=>edge.source===node.id).length),interactions:edges.slice(0,60).map(()=>({event:'click',action:'navigate',targetType:'node'}))};
 }
 if(work.kind==='video'&&(scope==='work'||scope.startsWith('shot:'))){
  const shots=(work.shots||[]).filter(shot=>scope==='work'||scope===`shot:${shot.id}`);
  return {...empty,pageCount:shots.length,nodeTypes:shots.length?['video','text']:[]};
 }
}
function createSnapshot(work:Work,scope:string):ReferenceSnapshot {
 const {pages,nodes}=scopedNodes(work,scope),native=nativeSnapshot(work,scope);if(native)return native;
 const visible=nodes.filter(node=>!node.hidden).slice(0,60);
 const text=visible.filter(node=>node.type==='text'&&bounded(node.fontSize,8,250)).sort((a,b)=>b.fontSize-a.fontSize)[0];
 const opaque=(value:unknown):value is string=>color(value)&&value!=='transparent'&&!/^#[a-f\d]{6}00$/i.test(value);
 const accent=visible.find(node=>['button','shape','timeline','card'].includes(node.type)&&(opaque(node.background)||opaque(node.color)));
 const visuals={
  ...(color(pages[0]?.background)?{background:pages[0].background}:{}),
  ...(color(text?.color)?{text:text.color}:{}),
  ...(opaque(accent?.background)?{accent:accent.background}:opaque(accent?.color)?{accent:accent.color}:{}),
  ...(bounded(text?.fontSize,8,250)?{fontSize:text.fontSize}:{}),
  ...(bounded(visible.find(node=>bounded(node.radius,0,1000))?.radius,0,1000)?{radius:visible.find(node=>bounded(node.radius,0,1000))!.radius}:{}),
 };
 const targetType=(id:string|undefined):ReferenceSnapshot['interactions'][number]['targetType']=>work.pages.some(p=>p.id===id)?'page':work.pages.flatMap(p=>p.nodes).find(n=>n.id===id)?.type||'unknown';
 const ratio=(value:number,size:number)=>Math.max(0,Math.min(1,Number.isFinite(value)&&size>0?value/size:0));
 return {kind:work.kind,pageCount:pages.length,nodeTypes:[...new Set(visible.map(node=>node.type))],
  itemGroupSizes:visible.filter(node=>node.items).map(node=>Math.min(1000,node.items!.length)),
  interactions:visible.flatMap(node=>(node.interactions||[]).filter(i=>events.includes(i.event)&&actions.includes(i.action)).map(i=>({event:i.event,action:i.action,targetType:targetType(i.targetId)}))).slice(0,60),
  visuals,layout:visible.map(node=>({type:node.type,x:ratio(node.x,work.width),y:ratio(node.y,work.height),w:ratio(node.w,work.width),h:ratio(node.h,work.height)})),
  motion:[...new Set(visible.map(node=>node.motion?.preset).filter((preset):preset is string=>Boolean(preset&&/^[a-z\d_-]{1,40}$/i.test(preset))))],
 };
}
function validateSnapshot(raw:ReferenceSnapshot):ReferenceSnapshot {
 if(!raw||!['exhibit','presentation','video','story'].includes(raw.kind)||!bounded(raw.pageCount,0,1000))throw new Error('参考快照无效');
 const list=<T>(value:T[],max=60)=>{if(!Array.isArray(value)||value.length>max)throw new Error('参考快照过大或无效');return value;};
 const types=list(raw.nodeTypes).map(type=>{if(!nodeTypes.includes(type))throw new Error('参考组件类型无效');return type;});
 const items=list(raw.itemGroupSizes).map(size=>{if(!bounded(size,0,1000))throw new Error('参考内容结构无效');return size;});
 const interactions=list(raw.interactions).map(item=>{if(!events.includes(item.event)||!actions.includes(item.action)||![...nodeTypes,'page','node','unknown'].includes(item.targetType))throw new Error('参考交互结构无效');return {event:item.event,action:item.action,targetType:item.targetType};});
 const visuals:ReferenceSnapshot['visuals']={};
 if(!raw.visuals||typeof raw.visuals!=='object')throw new Error('参考视觉参数无效');
 for(const key of ['background','text','accent'] as const){if(raw.visuals[key]!==undefined){if(!color(raw.visuals[key]))throw new Error('参考颜色参数无效');Object.assign(visuals,{[key]:raw.visuals[key]});}}
 for(const key of ['fontSize','radius'] as const){if(raw.visuals[key]!==undefined){if(!bounded(raw.visuals[key],key==='fontSize'?8:0,key==='fontSize'?250:1000))throw new Error('参考尺寸参数无效');Object.assign(visuals,{[key]:raw.visuals[key]});}}
 const layout=list(raw.layout).map(item=>{if(!nodeTypes.includes(item.type)||![item.x,item.y,item.w,item.h].every(n=>bounded(n,0,1)))throw new Error('参考布局无效');return {type:item.type,x:item.x,y:item.y,w:item.w,h:item.h};});
 const motion=list(raw.motion).map(value=>{if(typeof value!=='string'||!/^[a-z\d_-]{1,40}$/i.test(value))throw new Error('参考动效无效');return value;});
 return {kind:raw.kind,pageCount:raw.pageCount,nodeTypes:types,itemGroupSizes:items,interactions,visuals,layout,motion};
}
export function createExhibitReference(state:ReferenceState,workspaceId:string,input:ReferenceInput):ExhibitReference {
 const work=referenceSource(state,workspaceId,input.sourceKind,input.sourceId),scope=cleanText(input.scope,300,'work');
 if(!Object.hasOwn(referenceDimensions,input.dimension))throw new Error('请选择参考内容');
 const sourceTitle=input.sourceKind==='template'?state.templates.find(t=>t.id===input.sourceId)!.title:work.title;
 return {id:`ref-${input.sourceKind}-${input.sourceId}-${input.dimension}-${scope}`,sourceKind:input.sourceKind,sourceId:input.sourceId,
  sourceTitle,sourceRevision:work.revision,dimension:input.dimension,scope,scopeLabel:scopedNodes(work,scope).label,note:cleanText(input.note,1000),status:'reference',snapshot:createSnapshot(work,scope)};
}
export function mergeReferences(existing:ExhibitReference[],incoming:ExhibitReference):ExhibitReference[]{
 if(existing.some(ref=>ref.sourceKind===incoming.sourceKind&&ref.sourceId===incoming.sourceId&&ref.dimension===incoming.dimension&&ref.scope===incoming.scope))return [...existing];
 if(existing.length>=12)throw new Error('本次最多使用 12 项参考，请先移除不需要的来源');
 return [...existing,structuredClone(incoming)];
}
export function validateReferences(refs:ExhibitReference[]|undefined,state:ReferenceState,workspaceId:string):ExhibitReference[]{
 if(!refs)return [];
 if(!Array.isArray(refs)||refs.length>12)throw new Error('参考数量或格式无效');
 const seen=new Set<string>();
 return refs.map(ref=>{
  if(ref.transfer){
   if(!workspaceCanEdit(state,workspaceId)||ref.transfer.workspaceId!==workspaceId)throw new Error('参考快照不属于当前空间');
   const owner=state.works.find(work=>work.id===ref.transfer!.workId&&!work.deletedAt&&(work.workspaceId||'personal')===workspaceId);
   const pinned=owner&&[...(owner.referenceSnapshots||[]),...(owner.references||[]),...(owner.referenceHistory||[]),...(owner.creationPackage?.references||[]),...(owner.creationPackage?.referenceHistory||[])].find(item=>item.id===ref.id&&item.transfer?.workspaceId===workspaceId&&item.sourceId===ref.sourceId&&item.sourceKind===ref.sourceKind&&item.dimension===ref.dimension&&item.scope===ref.scope&&item.sourceRevision===ref.sourceRevision&&JSON.stringify(item.snapshot)===JSON.stringify(ref.snapshot));
   if(!pinned)throw new Error('参考快照已不可用或被更改，请重新选择来源');
  }else referenceSource(state,workspaceId,ref.sourceKind,ref.sourceId);
  if(!Object.hasOwn(referenceDimensions,ref.dimension)||!['reference','adopted'].includes(ref.status)||!Number.isSafeInteger(ref.sourceRevision)||ref.sourceRevision<0)throw new Error('参考版本或维度无效');
  const id=cleanText(ref.id,700);if(!id||seen.has(id))throw new Error('参考重复或缺少标识');seen.add(id);
  const scope=cleanText(ref.scope,300);if(!/^(work|page:.+|node:.+:.+|story:.+|shot:.+)$/.test(scope))throw new Error('参考范围无效');
  const evidence=cleanText(ref.adoptionEvidence,1000);
  if(ref.status==='adopted'&&!evidence)throw new Error('已采用参考缺少实际应用记录');
  return {id,sourceKind:ref.sourceKind,sourceId:cleanText(ref.sourceId,200),sourceTitle:cleanText(ref.sourceTitle,200),sourceRevision:ref.sourceRevision,
   dimension:ref.dimension,scope,scopeLabel:cleanText(ref.scopeLabel,200),note:cleanText(ref.note,1000),status:ref.status,snapshot:validateSnapshot(ref.snapshot),...(ref.transfer?{transfer:{workspaceId,sourceWorkspaceId:cleanText(ref.transfer.sourceWorkspaceId,200),workId:cleanText(ref.transfer.workId,200)}}:{}),...(evidence?{adoptionEvidence:evidence}:{})};
 });
}
export function referenceContext(refs:ExhibitReference[]=[]){
 return refs.map(ref=>({referenceId:ref.id,source:ref.sourceTitle,version:ref.sourceRevision,dimension:ref.dimension,dimensionLabel:referenceDimensions[ref.dimension],scope:ref.scopeLabel,note:ref.note,status:ref.status,
  patterns:ref.dimension==='ui'?{visuals:ref.snapshot.visuals,layout:ref.snapshot.layout}:ref.dimension==='interaction'?{nodeTypes:ref.snapshot.nodeTypes,interactions:ref.snapshot.interactions}:ref.dimension==='content'?{kind:ref.snapshot.kind,pageCount:ref.snapshot.pageCount,nodeTypes:ref.snapshot.nodeTypes,itemGroupSizes:ref.snapshot.itemGroupSizes}:{nodeTypes:ref.snapshot.nodeTypes,motion:ref.snapshot.motion,interactions:ref.snapshot.interactions},
  constraint:'仅参考指定方式，客户事实、文案和媒体须来自当前项目；不保证像素或交互完整还原。'}));
}
/** Freeform requirements need Agent interpretation; never infer a global application target from them. */
export function referenceHasScopeConstraint(ref:Pick<ExhibitReference,'scope'|'note'>):boolean {
 return ref.scope!=='work'||Boolean(ref.note.trim());
}
export function referenceConflicts(refs:ExhibitReference[]):string[]{
 const competing=(Object.keys(referenceDimensions) as ReferenceDimension[]).flatMap(dimension=>{
  const candidates=refs.filter(ref=>ref.dimension===dimension);
  return candidates.length>1?[`${referenceDimensions[dimension]}有 ${candidates.length} 项参考，当前不自动猜测主次。可让 Agent 按说明处理；需要自动整项应用时，请仅保留一项无局部限制的整体候选。`]:[];
 });
 const scoped=refs.some(referenceHasScopeConstraint)?['包含局部范围或补充说明的参考仅交给 Agent 按范围处理，不自动整项套用；请核对制作后的实际采用记录。']:[];
 return [...competing,...scoped];
}
export function appendReferenceToDraft(sourceKind:ExhibitReference['sourceKind'],sourceId:string,dimension:ReferenceDimension='interaction'){
 const state=useStudio.getState(),workspaceId=state.activeWorkspaceId;
 const ref=createExhibitReference(state,workspaceId,{sourceKind,sourceId,dimension});
 const draft=state.drafts.find(item=>item.id===state.activeDraftId&&(item.workspaceId||'personal')===workspaceId);
 if(!draft)return state.newDraft({workspaceId,references:[ref],text:`参考「${ref.sourceTitle}」，为当前项目制作展项。`});
 const references=mergeReferences(draft.references||[],ref);
 state.updateDraft({references,...(!draft.text.trim()?{text:`参考「${ref.sourceTitle}」，为当前项目制作展项。`}:{})});
 return {...draft,references};
}

/** Resolve only named, visible sources; prose without an explicit reference remains ordinary task data. */
export function referencesFromPrompt(prompt:string,state:ReferenceState,workspaceId:string,existing:ExhibitReference[]=[]):ExhibitReference[]{
 const portable=existing.filter(ref=>ref.transfer).map(ref=>{validateReferences([ref],state,workspaceId);return {kind:ref.sourceKind,id:ref.sourceId,title:ref.sourceTitle};});
 const candidates=[...portable,...state.works.filter(work=>!work.deletedAt&&(work.workspaceId||'personal')===workspaceId).map(work=>({kind:'work' as const,id:work.id,title:work.title})),...state.templates.filter(template=>!template.work.deletedAt).map(template=>({kind:'template' as const,id:template.id,title:template.title}))].filter((item,index,list)=>list.findIndex(other=>other.kind===item.kind&&other.id===item.id)===index);
 const dimension=(value:string):ReferenceDimension|undefined=>/交互/.test(value)?'interaction':/ui|视觉|界面|排版/i.test(value)?'ui':/内容组织|内容结构|组织方式/.test(value)?'content':/动效|局部效果|效果/.test(value)?'effect':undefined;
 let result=[...existing];
 for(const clause of prompt.split(/[，,；;。\n]/)){
  if(!/(?:参考|借鉴|沿用)/.test(clause))continue;
  const quoted=[...clause.matchAll(/(?:参考|借鉴|沿用)\s*[「“"]([^」”"]+)[」”"]/g)].map(match=>match[1]);
  for(const name of quoted){if(!candidates.some(candidate=>candidate.title===name))throw new Error(`未找到可用的参考展项「${name}」，请从参考列表选择`);}
  const titles=[...new Set(candidates.filter(candidate=>clause.includes(candidate.title)).map(candidate=>candidate.title))].sort((a,b)=>b.length-a.length);
  const matched=titles.filter(title=>!titles.some(longer=>longer!==title&&longer.includes(title)));
  for(const title of matched){
   const sources=candidates.filter(candidate=>candidate.title===title);
   if(sources.length!==1)throw new Error(`存在同名参考展项「${title}」，请从参考列表明确选择来源`);
   const at=clause.indexOf(title),before=clause.slice(0,at),after=clause.slice(at+title.length);
   const beforeDimension=[...before.matchAll(/(交互(?:方式)?|UI(?:风格)?|视觉(?:风格)?|界面(?:风格)?|排版|内容组织|内容结构|组织方式|动效|局部效果|效果)\s*(?:参考|借鉴|沿用)\s*[「“"]?/gi)].at(-1)?.[1];
   const afterDimension=after.match(/^[」”"]?的?(交互(?:方式)?|UI(?:风格)?|视觉(?:风格)?|界面(?:风格)?|排版|内容组织|内容结构|组织方式|动效|局部效果|效果)/i)?.[1];
   const chosen=dimension(beforeDimension||afterDimension||'');
   if(!chosen)continue;
   const source=sources[0];
   const remaining=clause.replace(title,'').replace(/(?:交互(?:方式)?|UI(?:风格)?|视觉(?:风格)?|界面(?:风格)?|排版|内容组织|内容结构|组织方式|动效|局部效果|效果|参考|借鉴|沿用|的|[「」“”"])/gi,'').trim();
   const note=remaining?cleanText(clause,1000):'';
   const prior=result.find(ref=>ref.sourceKind===source.kind&&ref.sourceId===source.id&&ref.dimension===chosen&&(ref.scope==='work'||ref.transfer));
   if(prior){
    if(!note)continue;
    const combined=prior.note.includes(note)?prior.note:cleanText([prior.note,note].filter(Boolean).join('\n'),1000);
    result=result.map(ref=>ref===prior?{...ref,note:combined,status:'reference' as const,adoptionEvidence:undefined}:ref);
   }else result=mergeReferences(result,createExhibitReference(state,workspaceId,{sourceKind:source.kind,sourceId:source.id,dimension:chosen,note}));
  }
 }
 return result;
}
