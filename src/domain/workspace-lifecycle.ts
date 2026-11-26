import type {Skill,StudioData,StudioStore} from './types';
import {activeWorkspaceMember,type WorkspaceData} from './workspace-management';
import {workspaceOf,type Workspace} from './workspaces';
import {createDraft} from './fixtures';
import {now} from './scenes';
import {getSkillMetadata} from './skill-metadata';

type AccessState=Pick<WorkspaceData,'workspaces'|'workspaceMembers'|'workspaceActors'>;
export function workspaceCanManageLifecycle(state:AccessState,id:string):boolean {
 const space=state.workspaces.find(item=>item.id===id);if(!space||id==='personal'||space.purgedAt)return false;
 return activeWorkspaceMember(state,id)?.role==='owner';
}
function exclusiveSpaceSkill(skill:Skill,id:string):boolean {
 const metadata=getSkillMetadata(skill);
 return !skill.public&&metadata.visibility==='restricted'&&metadata.allowedWorkspaceIds.length===1&&metadata.allowedWorkspaceIds[0]===id;
}
export function workspaceLifecycleSummary(state:StudioData,id:string) {
 return {sessions:state.creationSessions?.filter(chat=>chat.workspaceId===id).length||0,works:state.works.filter(item=>workspaceOf(item)===id).length,assets:state.assets.filter(item=>!item.public&&workspaceOf(item)===id).length,skills:state.skills.filter(item=>exclusiveSpaceSkill(item,id)).length,drafts:state.drafts.filter(item=>workspaceOf(item)===id).length,runs:state.runs.filter(item=>workspaceOf(item)===id).length};
}
const withoutKey=<T>(record:Record<string,T>,id:string)=>Object.fromEntries(Object.entries(record).filter(([key])=>key!==id));
function personalFallback(state:StudioData,id:string):Partial<StudioData> {
 if(state.activeWorkspaceId!==id)return {};
 const existing=state.drafts.find(draft=>workspaceOf(draft)==='personal'),draft=existing||createDraft({workspaceId:'personal'});
 return {activeWorkspaceId:'personal',activeDraftId:draft.id,drafts:existing?state.drafts:[draft,...state.drafts],workspaceRestoreNotice:'原空间已归档或移入回收站，已返回个人空间；原资料保持归属。'};
}
function pauseRuns(state:StudioData,id:string) {
 return state.runs.map(run=>workspaceOf(run)===id&&run.status!=='complete'?{...run,status:'stopped' as const,error:'空间已归档或删除，任务已停止；恢复空间后可重新发起创作。',...(run.backgroundDraft?{backgroundDraft:{...run.backgroundDraft,status:'failed' as const,retryable:false,error:'空间已归档或删除，任务已停止。'}}:{})}:run);
}
/** Active links must be resolved before removing private dependencies; fixed creative snapshots may remain. */
function referencesRemovedResources(value:unknown,ids:Set<string>,urls:Set<string>,key=''):boolean {
 if(['origin','references','referenceSnapshots','referenceHistory','experience','skillSnapshots'].includes(key))return false;
 if(typeof value==='string'){
  if(['assetId','backgroundAssetId','mediaAssetId','coverAssetId','sourceId'].includes(key)&&ids.has(value))return true;
  if(['src','image','backgroundImage','media','cover'].includes(key)&&urls.has(value))return true;
  if(key==='content'||key==='referenceAssetIds')try{return referencesRemovedResources(JSON.parse(value),ids,urls,key==='referenceAssetIds'?'attachmentIds':'');}catch{return false;}
  return false;
 }
 if(Array.isArray(value))return value.some(item=>typeof item==='string'&&['attachmentIds','skillIds','generatedBackgroundIds'].includes(key)?ids.has(item):referencesRemovedResources(item,ids,urls));
 return Boolean(value&&typeof value==='object'&&Object.entries(value).some(([field,item])=>referencesRemovedResources(item,ids,urls,field)));
}
// These browser drafts live outside Zustand. Retain them during archive and soft deletion.
export function removeCreationDraftCaches(state:StudioData,workspaceId?:string){
 const belongs=(owner:string|undefined)=>!workspaceId||(owner||'personal')===workspaceId;
 if(typeof sessionStorage!=='undefined'){
  const ids=[...(state.creationSessions||[]).filter(s=>belongs(s.workspaceId)).map(s=>s.id),
   ...state.works.filter(w=>belongs(w.workspaceId)).map(w=>w.id)];
  for(const id of ids)sessionStorage.removeItem('zc-followup-'+id);
 }
 if(typeof localStorage!=='undefined'){
  const prefix=workspaceId?'zc-creation-plan:'+workspaceId+':':'zc-creation-plan:';
  for(let i=localStorage.length-1;i>=0;i--){
   const key=localStorage.key(i);
   if(key?.startsWith(prefix))localStorage.removeItem(key);
  }
 }
}
function purgeState(state:StudioData,space:Workspace):Partial<StudioData> {
 const id=space.id,works=state.works.filter(item=>workspaceOf(item)!==id),removedWorks=new Set(state.works.filter(item=>workspaceOf(item)===id).map(item=>item.id));
 const assets=state.assets.filter(item=>item.public||workspaceOf(item)!==id),skills=state.skills.filter(item=>!exclusiveSpaceSkill(item,id)).map(skill=>{
  const metadata=getSkillMetadata(skill);
  return !skill.public&&metadata.visibility==='restricted'&&metadata.allowedWorkspaceIds.includes(id)?{...skill,metadata:{...metadata,allowedWorkspaceIds:metadata.allowedWorkspaceIds.filter(space=>space!==id)}}:skill;
 });
 const removedAssets=state.assets.filter(item=>!item.public&&workspaceOf(item)===id),removedSkills=state.skills.filter(item=>exclusiveSpaceSkill(item,id));
 const removedIds=new Set([...removedAssets,...removedSkills].map(item=>item.id)),urls=new Set(removedAssets.map(asset=>asset.src).filter(src=>/^(idb:|blob:)/.test(src)));
 const drafts=state.drafts.filter(item=>workspaceOf(item)!==id),runs=state.runs.filter(item=>workspaceOf(item)!==id);
 const creationSessions=(state.creationSessions||[]).filter(session=>session.workspaceId!==id);
 if([works,assets,state.templates,drafts,runs,creationSessions].some(value=>referencesRemovedResources(value,removedIds,urls)))throw new Error('其他作品、创作会话或已发布内容仍依赖此空间的私有素材或技能，请先替换或独立保存这些依赖，再彻底删除。');
 const submissions=state.submissions.filter(item=>item.status==='approved'||(item.skill?!removedIds.has(item.skill.id):workspaceOf(item.work||item.asset||{})!==id));
 const removedFavoriteIds=new Set([...removedIds,...removedWorks]);
 return {works,assets,skills,drafts,runs,creationSessions,submissions,conversationTurns:state.conversationTurns.filter(item=>!removedWorks.has(item.workId)),favorites:state.favorites.filter(item=>!removedFavoriteIds.has(item)),workspaceKnowledge:withoutKey(state.workspaceKnowledge,id),workspaceMembers:withoutKey(state.workspaceMembers,id),workspaceActors:withoutKey(state.workspaceActors,id)};
}
type Actions=Pick<StudioStore,'archiveWorkspace'|'unarchiveWorkspace'|'deleteWorkspace'|'restoreWorkspace'|'permanentlyDeleteWorkspace'>;
export function createWorkspaceLifecycleActions(set:(patch:Partial<StudioStore>)=>void,get:()=>StudioStore):Actions {
 const requireOwner=(id:string)=>{const state=get(),space=state.workspaces.find(item=>item.id===id);if(!space||!workspaceCanManageLifecycle(state,id))throw new Error('仅空间负责人可以管理此项目空间；个人空间不可归档或删除。');return {state,space};};
 const update=(state:StudioData,space:Workspace)=>state.workspaces.map(item=>item.id===space.id?space:item);
 return {
  archiveWorkspace:id=>{const {state,space}=requireOwner(id);if(space.deletedAt)throw new Error('请先从空间回收站恢复。');if(space.archivedAt)return;set({...personalFallback(state,id),workspaces:update(state,{...space,archivedAt:now()}),runs:pauseRuns(state,id)});},
  unarchiveWorkspace:id=>{const {state,space}=requireOwner(id);if(space.deletedAt)throw new Error('请先从空间回收站恢复。');set({workspaces:update(state,{...space,archivedAt:undefined})});},
  deleteWorkspace:id=>{const {state,space}=requireOwner(id);if(space.deletedAt)return;set({...personalFallback(state,id),workspaces:update(state,{...space,deletedAt:now()}),runs:pauseRuns(state,id)});},
  restoreWorkspace:id=>{const {state,space}=requireOwner(id);if(!space.deletedAt)throw new Error('此空间未在回收站。');set({workspaces:update(state,{...space,deletedAt:undefined})});},
  permanentlyDeleteWorkspace:(id,confirmationName)=>{const {state,space}=requireOwner(id);if(!space.deletedAt)throw new Error('请先将空间移入回收站。');if(confirmationName.trim()!==space.name)throw new Error('请输入完整空间名称以确认彻底删除。');const purged=purgeState(state,space);removeCreationDraftCaches(state,id);set({...purged,...personalFallback({...state,...purged},id),workspaces:update(state,{...space,purgedAt:now(),description:''})});},
 };
}
