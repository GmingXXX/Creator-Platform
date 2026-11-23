import type {Asset,StudioData,Work} from './types';
import {workspaceCanEdit} from './workspace-management';
import {workspaceOf} from './workspaces';
import {assetAvailableInSpace} from './asset-access';
import {assetDependencyError,workDependencyError} from './resource-permissions';
import {assetVersion,existingAdoption} from './resource-adoption';
import {createDraft} from './fixtures';
import {now,uid} from './scenes';
import {validateReferences,type ExhibitReference} from './exhibit-references';

export interface WorkTransferPreview {work:Work;assetsToCopy:Asset[];runsCount:number;turnsCount:number;warnings:string[]}
const invalidDependency='作品依赖包含不可用或未授权资源，请先处理依赖后再移动。';
const sourceKeys=['src','image','backgroundImage','media','cover'];
const assetIdKeys=['imageAssetId','assetId','backgroundAssetId','mediaAssetId','coverAssetId'];
const ignoredKeys=['referenceSnapshots','references','referenceHistory','experience','skillSnapshots'];
const relatedAsset=(asset:Asset,work:Work)=>!asset.public&&workspaceOf(asset)===workspaceOf(work)&&(asset.sourceWorkId===work.id||asset.workSnapshot?.id===work.id||asset.package?.params.experienceWorkId===work.id);

function transferWork(state:StudioData,id:string,target:string):Work {
 const work=state.works.find(item=>item.id===id&&!item.deletedAt);
 if(!work)throw new Error('作品已不存在或已移入回收站。');
 if(workspaceOf(work)!=='personal'||target==='personal')throw new Error('请选择个人作品和目标项目空间。');
 if(!workspaceCanEdit(state,'personal')||!workspaceCanEdit(state,target))throw new Error('目标空间不存在或没有编辑权限。');
 if(state.runs.some(run=>run.workId===id&&(run.status==='running'||run.backgroundDraft?.status==='pending'||run.backgroundDraft?.status==='failed'&&run.backgroundDraft.retryable)))throw new Error('作品还有执行中或可恢复的背景任务，请等待完成或停止后再移动。');
 const dependency=workDependencyError(state.assets,work,'personal');if(dependency)throw new Error(dependency);
 return work;
}
function collectDependencies(state:StudioData,work:Work,includeContext=true):Asset[] {
 const sourceSpace=workspaceOf(work);
 const result=new Map<string,Asset>();
 const add=(id:string)=>{
  if(result.has(id))return;
  const asset=state.assets.find(item=>item.id===id);
  if(!asset||assetDependencyError(state.assets,asset,sourceSpace))throw new Error(invalidDependency);
  if(asset.sourceWorkId&&asset.sourceWorkId!==work.id)throw new Error('依赖了另一个私人作品工程，请先将需要的素材独立整理后移动。');
  result.set(id,asset);if(result.size>256)throw new Error('关联素材过多，请整理依赖后再移动。');
  scan(asset.package);scan(asset.workSnapshot);
 };
 const scan=(value:unknown,key=''):void=>{
  if(typeof value==='string'){
   if(assetIdKeys.includes(key))add(value);
   else if(key==='sourceId'){if(value)add(value);}
   else if(sourceKeys.includes(key)){
    const matches=state.assets.filter(asset=>(asset.src===value||key==='cover'&&asset.preview===value)&&!asset.deletedAt&&!asset.archived&&assetAvailableInSpace(asset,sourceSpace));
    const match=matches.find(asset=>workspaceOf(asset)==='personal'&&!asset.public)||matches[0];
    if(match)add(match.id);else if(/^(idb:|blob:)/.test(value))throw new Error(invalidDependency);
   }else if(key==='content'||key==='referenceAssetIds'){
    try{const parsed:unknown=JSON.parse(value);if(key==='referenceAssetIds'&&Array.isArray(parsed))parsed.forEach(id=>{if(typeof id==='string')add(id)});else scan(parsed);}catch(cause){if(cause instanceof SyntaxError)return;throw cause;}
   }
   return;
  }
  if(Array.isArray(value)){value.forEach(item=>scan(item));return;}
  if(value&&typeof value==='object'){
   const row=value as Record<string,unknown>;
   for(const [field,item] of Object.entries(row)){
    const paired=field==='src'||field==='image'?'assetId':field==='backgroundImage'?'backgroundAssetId':field==='media'?'mediaAssetId':field==='cover'?'coverAssetId':undefined;
    if(!ignoredKeys.includes(field)&&!(paired&&typeof row[paired]==='string'))scan(item,field);
   }
  }
 };
 scan(work);
 if(!includeContext)return [...result.values()];
 for(const run of state.runs.filter(item=>item.workId===work.id)){
  [...run.attachmentIds,...(run.generatedBackgroundIds||[]),...(run.assetId?[run.assetId]:[]),...(run.backgroundAssetId?[run.backgroundAssetId]:[]),...(run.backgroundDraft?.assetId?[run.backgroundDraft.assetId]:[])].forEach(add);
  scan(run.reference);scan(run.aiPlan);
 }
 for(const turn of state.conversationTurns.filter(item=>item.workId===work.id)){scan(turn.before);(turn.attachmentIds||[]).forEach(add);}
 state.assets.filter(asset=>relatedAsset(asset,work)).forEach(asset=>add(asset.id));
 return [...result.values()];
}
function workReferences(work:Work):ExhibitReference[]{return [...(work.referenceSnapshots||[]),...(work.references||[]),...(work.referenceHistory||[]),...(work.creationPackage?.references||[]),...(work.creationPackage?.referenceHistory||[])];}
function transferReferences(state:StudioData,work:Work,deps:Asset[]=[]):ExhibitReference[]{
 const refs=[...workReferences(work),...state.conversationTurns.filter(turn=>turn.workId===work.id&&turn.before).flatMap(turn=>workReferences(turn.before!)),...state.runs.filter(run=>run.workId===work.id).flatMap(run=>[...(run.references||[]),...(run.reference?.references||[]),...(run.reference?.referenceHistory||[])])];
 return [...refs,...deps.flatMap(asset=>[...(asset.package?.references||[]),...(asset.package?.referenceHistory||[]),...(asset.workSnapshot?workReferences(asset.workSnapshot):[])])];
}
export function previewWorkTransfer(state:StudioData,id:string,target:string):WorkTransferPreview {
 const work=transferWork(state,id,target),deps=collectDependencies(state,work);
 for(const ref of transferReferences(state,work,deps))validateReferences([ref],state,'personal');
 const assetsToCopy=deps.filter(asset=>!(asset.source==='builtin'&&!asset.workspaceId)&&asset.sourceWorkId!==id&&asset.workSnapshot?.id!==id&&!existingAdoption(state.assets,asset,target));
 return {work,assetsToCopy,runsCount:state.runs.filter(run=>run.workId===id).length,turnsCount:state.conversationTurns.filter(turn=>turn.workId===id).length,warnings:['目标空间的成员将能够查看此作品及随迁的制作记录。','实际依赖的个人素材会复制到空间；个人素材原件和其他作品保持不变。']};
}

/** Rewrites registered asset identifiers while retaining source text and unrelated metadata. */
export function remapAssetReferences<T>(value:T,mapping:ReadonlyMap<string,string>,transformReference:(ref:ExhibitReference)=>ExhibitReference=ref=>structuredClone(ref)):T {
 const rewrite=(value:unknown,key=''):unknown=>{
  if(typeof value==='string'){
   if(assetIdKeys.includes(key)||key==='sourceId')return mapping.get(value)||value;
   if(key==='content'||key==='referenceAssetIds')try{const data:unknown=JSON.parse(value);return JSON.stringify(key==='referenceAssetIds'&&Array.isArray(data)?data.map(id=>typeof id==='string'?mapping.get(id)||id:id):rewrite(data));}catch{/* Normal text is retained verbatim. */}
   return value;
  }
  if(Array.isArray(value))return value.map(item=>rewrite(item));
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).map(([field,item])=>[field,(field==='references'||field==='referenceHistory'||field==='referenceSnapshots')&&Array.isArray(item)?item.map(transformReference):field==='skillSnapshots'||field==='experience'?structuredClone(item):rewrite(item,field)]));
 };
 return rewrite(value) as T;
}

/** Used by explicit material adoption; does not gather unrelated work history or sibling outputs. */
export function collectAssetTreeDependencies(state:StudioData,asset:Asset):Asset[] {
 const work={id:asset.sourceWorkId||`asset-tree:${asset.id}`,workspaceId:asset.workspaceId||'personal',pages:[],creationPackage:{sourceId:asset.id,files:[],params:{},skillIds:[]}} as unknown as Work;
 return collectDependencies(state,work,false);
}

/** Build the entire transition in memory. Any validation error leaves all original state untouched. */
export function transferWorkToWorkspace<T extends StudioData>(state:T,id:string,target:string):T {
 const preview=previewWorkTransfer(state,id,target),work=preview.work,deps=collectDependencies(state,work),time=now();
 const mapping=new Map(deps.map(asset=>[asset.id,asset.sourceWorkId===id||asset.workSnapshot?.id===id||asset.source==='builtin'&&!asset.workspaceId?asset.id:existingAdoption(state.assets,asset,target)?.id||uid('asset')]));
 const portable=(ref:ExhibitReference):ExhibitReference=>ref.sourceKind==='work'&&ref.sourceId!==id?{...structuredClone(ref),transfer:{workspaceId:target,sourceWorkspaceId:'personal',workId:id}}:structuredClone(ref);
 const movedWork=(input:Work):Work=>({...remapAssetReferences(input,mapping,portable),workspaceId:target});
 const retained=transferReferences(state,work,deps).map(portable);
 const snapshots=retained.filter((ref,index,list)=>list.findIndex(other=>JSON.stringify(other)===JSON.stringify(ref))===index);
 const moved={...movedWork(work),referenceSnapshots:snapshots,revision:work.revision+1,updatedAt:time};
 const copyAsset=(asset:Asset):Asset=>{
  const mapped=mapping.get(asset.id)!;
  return {...remapAssetReferences(asset,mapping,portable),id:mapped,workspaceId:target,public:false,knowledgeTarget:undefined,createdAt:mapped===asset.id?asset.createdAt:time,updatedAt:time,
   ...(mapped!==asset.id?{origin:{assetId:asset.id,version:assetVersion(asset)}}:{}),
   ...(asset.workSnapshot?{workSnapshot:movedWork(asset.workSnapshot)}:{})};
 };
 const replacements=deps.filter(asset=>(asset.sourceWorkId===id||asset.workSnapshot?.id===id)&&mapping.get(asset.id)===asset.id);
 const copies=deps.filter(asset=>mapping.get(asset.id)!==asset.id&&!state.assets.some(existing=>existing.id===mapping.get(asset.id))).map(copyAsset);
 const assets=[...copies,...state.assets.map(asset=>replacements.some(item=>item.id===asset.id)?copyAsset(asset):asset)];
 const runs=state.runs.map(run=>run.workId!==id?run:{...remapAssetReferences(run,mapping,portable),workspaceId:target,draftId:undefined,attachmentIds:run.attachmentIds.map(id=>mapping.get(id)||id),generatedBackgroundIds:run.generatedBackgroundIds?.map(id=>mapping.get(id)||id)});
 const turns=state.conversationTurns.map(turn=>turn.workId!==id?turn:{...turn,before:turn.before?movedWork(turn.before):undefined,afterRevision:turn.afterRevision===work.revision?moved.revision:turn.afterRevision,attachmentIds:turn.attachmentIds?.map(id=>mapping.get(id)||id)});
 const existingDraft=state.drafts.find(draft=>workspaceOf(draft)===target),draft=existingDraft||createDraft({workspaceId:target});
 const next={...state,works:state.works.map(item=>item.id===id?moved:item),assets,runs,conversationTurns:turns,activeWorkspaceId:target,activeDraftId:draft.id,drafts:existingDraft?state.drafts:[draft,...state.drafts]};
 const dependency=workDependencyError(assets,moved,target);if(dependency)throw new Error(dependency);
 return next;
}
