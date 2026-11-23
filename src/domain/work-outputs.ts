import type {Asset,StudioData,Submission,Template,Work} from './types';
import {normalizeSkill} from './skill-publication';

/** All editable engineering documents now belong to Projects. Kept for old route callers. */
export const isMaterialWork = (_work:Work):boolean => false;
export const isProjectWork = (work:Work):boolean => ['exhibit','presentation','video','story'].includes(work.kind);

type OutputState=Pick<StudioData,'works'|'assets'|'runs'> & Partial<Pick<StudioData,'templates'|'submissions'|'skills'|'favorites'|'projectSchemaVersion'>>;

function validSnapshot(value:unknown):value is Work {
 if(!value||typeof value!=='object')return false;
 const work=value as Work;
 return typeof work.id==='string'&&typeof work.title==='string'&&isProjectWork(work)&&Array.isArray(work.pages)
  &&work.pages.every(page=>page&&typeof page.id==='string'&&Array.isArray(page.nodes));
}
function engineeringSnapshot(asset:Asset):Work|undefined {
 if(asset.workSnapshot&&validSnapshot(asset.workSnapshot))return asset.workSnapshot;
 if(!asset.sourceWorkId)return undefined;
 for(const file of asset.package?.files||[]){
  if(!file.content||!/(?:可编辑工程|engineering|work)/i.test(file.name))continue;
  try{const parsed:unknown=JSON.parse(file.content);if(validSnapshot(parsed))return parsed;}catch{/* A legacy file may contain non-JSON instructions. */}
 }
}
/** Only fill missing provenance; each engineering snapshot owns an independent package. */
function withCreationPackage(work:Work,asset:Asset|undefined):Work {
 if(work.creationPackage||!asset?.package)return work;
 const creationPackage=structuredClone(asset.package);
 return {...work,creationPackage:{...creationPackage,files:creationPackage.files.filter(file=>file.generatedBy!=='work-output')}};
}
function asTemplate(asset:Asset,snapshot:Work):Template {
 return {id:asset.id,title:asset.name,type:snapshot.type,author:asset.author,tags:[...asset.tags],
  likes:Number(asset.package?.params.originalLikes)||0,uses:Number(asset.package?.params.originalUses)||0,
  work:structuredClone(withCreationPackage(snapshot,asset))};
}
function asTemplateSubmission(submission:Submission):Submission {
 const snapshot=submission.asset?.workSnapshot;
 if(!snapshot||!validSnapshot(snapshot))return submission;
 const {asset:_asset,...previous}=submission;
 return {...previous,kind:'template',work:structuredClone(withCreationPackage(snapshot,submission.asset))};
}

/** Preserve old links and dependency IDs as hidden aliases; never duplicate a canonical work. */
export function reconcileWorkOutputs<T extends OutputState>(state:T):T {
 const recovered=state.assets.filter(asset=>!asset.public).flatMap(asset=>{
  const snapshot=engineeringSnapshot(asset),id=asset.sourceWorkId||snapshot?.id;
  if(!snapshot||!id||state.works.some(work=>work.id===id))return [];
  return [{...structuredClone(withCreationPackage(snapshot,asset)),id,workspaceId:asset.workspaceId||snapshot.workspaceId||'personal',
   deletedAt:asset.deletedAt||snapshot.deletedAt,archived:asset.archived??snapshot.archived}];
 });
 const works=[...state.works.map(work=>withCreationPackage(work,state.assets.find(asset=>!asset.public
  &&(asset.sourceWorkId||asset.workSnapshot?.id)===work.id&&(asset.workspaceId||'personal')===(work.workspaceId||'personal')))),
  ...recovered.filter((work,index,list)=>list.findIndex(item=>item.id===work.id)===index)];
 const templates=(state.templates||[]).map(template=>({...template,work:withCreationPackage(template.work,
  state.assets.find(asset=>asset.public&&asset.workSnapshot?.id===template.work.id))}));
 const legacyTemplates=state.assets.filter(asset=>asset.public&&validSnapshot(asset.workSnapshot)).map(asset=>asTemplate(asset,asset.workSnapshot!));
 const appended=legacyTemplates.filter((template,index,list)=>!templates.some(existing=>existing.id===template.id||existing.work.id===template.work.id)
  &&list.findIndex(item=>item.id===template.id||item.work.id===template.work.id)===index);
 const nextTemplates=[...templates,...appended];
 const runs=state.runs.map(run=>{
  if(run.workId)return run;
  const alias=state.assets.find(asset=>asset.id===run.assetId&&!asset.public);
  const snapshot=alias&&engineeringSnapshot(alias),id=alias?.sourceWorkId||snapshot?.id;
  return id&&works.some(work=>work.id===id)?{...run,workId:id}:run;
 });
 return {...state,projectSchemaVersion:1,works,runs,
  ...(state.templates?{templates:nextTemplates}:{}),
  ...(state.submissions?{submissions:state.submissions.map(asTemplateSubmission)}:{}),
  ...(state.skills?{skills:state.skills.map(normalizeSkill)}:{}),
  ...(state.favorites?{favorites:[...new Set(state.favorites.map(id=>{
   const alias=state.assets.find(asset=>asset.public&&asset.id===id&&asset.workSnapshot);
   return alias?nextTemplates.find(template=>template.work.id===alias.workSnapshot!.id)?.id||id:id;
  }))]}:{}),
 };
}

/** A submitted resource cannot follow later edits to the creator's engineering document. */
export function snapshotMaterialAsset(asset:Asset,works:Work[]):Asset {
 const work=asset.sourceWorkId?works.find(item=>item.id===asset.sourceWorkId):asset.workSnapshot;
 return {...structuredClone(asset),sourceWorkId:undefined,workSnapshot:work?structuredClone(work):undefined,archived:undefined,deletedAt:undefined};
}
