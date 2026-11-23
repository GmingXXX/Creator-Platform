import {set} from 'idb-keyval';
import {useStudio} from './store';
import {importFile} from './upload';
import {describeAttachment} from './attachment-intake';
import {parseSkillPackage} from './skill-package';
import {prepareSkillSave} from './skill-store';
import {skillAvailableToActor} from './skill-access';
import {assetAvailableForAI} from './asset-access';
import {workspaceCanEdit} from './workspace-management';
import {captureKnowledgeTarget} from './workspace-knowledge';
import type {Asset,StudioStore,Skill} from './types';
import {demoKnowledgeCatalogId,matchDemoKnowledgePreset,type DemoKnowledgeFile,type DemoKnowledgePresetId} from './demo-knowledge-catalog';
export {demoKnowledgePresets,matchDemoKnowledgePreset} from './demo-knowledge-catalog';
type Result={presetId:DemoKnowledgePresetId;fileCount:number}|undefined;
type Snapshot={draftId:string;workspaceId:string;prompt:string;actor:string;fieldId:string;revision:number;fieldName:string};
const pending=new Map<string,Promise<Result>>();
const isKnowledge=(asset:Asset)=>asset.package?.params.knowledgeCatalogId===demoKnowledgeCatalogId;
const bindingMatches=(state:StudioStore,snapshot:Snapshot)=>{
 const binding=state.workspaceKnowledge[snapshot.workspaceId];
 return binding?.demoCatalogId===demoKnowledgeCatalogId&&binding.fieldId===snapshot.fieldId&&binding.revision===snapshot.revision;
};
function check(state:StudioStore,snapshot:Snapshot){
 const draft=state.drafts.find(item=>item.id===snapshot.draftId);
 if(!draft||state.activeDraftId!==snapshot.draftId||state.activeWorkspaceId!==snapshot.workspaceId||(draft.workspaceId||'personal')!==snapshot.workspaceId||draft.text!==snapshot.prompt||(state.workspaceActors[snapshot.workspaceId]||'self')!==snapshot.actor||!workspaceCanEdit(state,snapshot.workspaceId)||!bindingMatches(state,snapshot))throw new Error('空间、需求、权限或知识本地场绑定已变化，请在当前空间重新发送。');
 return draft;
}
function cleanReferences(state:StudioStore,attachmentIds:string[]){
 return attachmentIds.filter(id=>!state.assets.some(asset=>asset.id===id&&isKnowledge(asset)));
}
async function download(file:DemoKnowledgeFile){
 const base=import.meta.env.BASE_URL||'/';
 const url=`${base}${file.url.replace(/^\//,'')}`.split('/').map(part=>encodeURIComponent(part)).join('/');
 const response=await fetch(url);if(!response.ok)throw new Error(`模拟知识资料「${file.name}」无法读取，请重试。`);
 const blob=await response.blob();if(!blob.size)throw new Error(`模拟知识资料「${file.name}」为空，请重新检查演示包。`);
 return new File([blob],file.name,{type:file.mime});
}
function cachedAsset(state:StudioStore,snapshot:Snapshot,presetId:string,file:DemoKnowledgeFile){
 const asset=state.assets.find(item=>item.workspaceId===snapshot.workspaceId&&isKnowledge(item)&&item.package?.params.knowledgeFieldId===snapshot.fieldId&&item.package.params.knowledgeRevision===String(snapshot.revision)&&item.package.params.knowledgeCase===presetId&&item.package.params.knowledgePath===file.path);
 if(asset&&!assetAvailableForAI(asset,snapshot.workspaceId))throw new Error(`知识引用「${asset.name}」已不可用或禁止 AI 使用，请先检查素材权限。`);
 return asset;
}
export function prepareDemoKnowledge(draftId:string):Promise<Result>{
 const existing=pending.get(draftId);if(existing)return existing;
 const operation=prepare(draftId).finally(()=>pending.delete(draftId));pending.set(draftId,operation);return operation;
}
async function prepare(draftId:string):Promise<Result>{
 const state=useStudio.getState(),draft=state.drafts.find(item=>item.id===draftId);
 if(!draft||state.activeDraftId!==draftId||state.activeWorkspaceId!==(draft.workspaceId||'personal')||!workspaceCanEdit(state,draft.workspaceId||'personal'))throw new Error('原创作草稿已关闭或没有编辑权限，请在当前空间重新发送。');
 const binding=state.workspaceKnowledge[draft.workspaceId||'personal'],preset=matchDemoKnowledgePreset(draft.text);
 if(binding?.demoCatalogId!==demoKnowledgeCatalogId||!preset){
  const ids=cleanReferences(state,draft.attachmentIds);
  if(ids.length!==draft.attachmentIds.length)useStudio.setState({drafts:state.drafts.map(item=>item.id===draftId?{...item,attachmentIds:ids}:item)});
  return;
 }
 const snapshot:Snapshot={draftId,workspaceId:draft.workspaceId||'personal',prompt:draft.text,actor:state.workspaceActors[draft.workspaceId||'personal']||'self',fieldId:binding.fieldId,fieldName:binding.fieldName,revision:binding.revision};
 const initialCache=preset.files.map(file=>cachedAsset(state,snapshot,preset.id,file));
 const skillFile=await download(preset.skill);check(useStudio.getState(),snapshot);
 const parsed=await parseSkillPackage(new Uint8Array(await skillFile.arrayBuffer()),preset.skill.name);check(useStudio.getState(),snapshot);
 const existingSkill=findSkill(useStudio.getState(),parsed);
 if(existingSkill?.enabled===false)throw new Error(`配套 Skill「${existingSkill.name}」已停用，请启用后继续。`);
 const prepared=await Promise.all(preset.files.map(async(file,index)=>{
  if(initialCache[index])return initialCache[index]!;
  const downloaded=await download(file);check(useStudio.getState(),snapshot);
  const imported=await importFile(downloaded),description=await describeAttachment(downloaded);check(useStudio.getState(),snapshot);
  return knowledgeAsset(imported,description,file,snapshot,preset.id,preset.title);
 }));
 check(useStudio.getState(),snapshot);
 const storageKey=`zhichuang-skill-package:${parsed.id}`;
 if(!existingSkill){await set(storageKey,skillFile);check(useStudio.getState(),snapshot);}
 useStudio.setState(current=>{
  const target=check(current,snapshot);
  const resources=preset.files.map((file,index)=>cachedAsset(current,snapshot,preset.id,file)||prepared[index]);
  const skill=findSkill(current,parsed);if(skill?.enabled===false)throw new Error(`配套 Skill「${skill.name}」已停用，请启用后继续。`);
  const saved=skill||prepareSkillSave(current,{...parsed,enabled:true,workspaceId:'personal',source:'builtin',sourcePackage:{...parsed.sourcePackage!,storageKey}});
  const ids=resources.map(asset=>asset.id),assets=[...resources,...current.assets.filter(asset=>!ids.includes(asset.id))];
  return {assets,skills:skill?current.skills:[saved,...current.skills],drafts:current.drafts.map(item=>item.id===draftId?{...item,attachmentIds:[...new Set([...cleanReferences(current,target.attachmentIds),...ids])],updatedAt:new Date().toISOString()}:item)};
 });
 return {presetId:preset.id,fileCount:preset.files.length};
}
function findSkill(state:StudioStore,parsed:Skill){return state.skills.find(skill=>!skill.public&&skill.personal&&skill.sourcePackage?.instructions===parsed.sourcePackage?.instructions&&skillAvailableToActor(skill,state));}
function knowledgeAsset(imported:Asset,description:Awaited<ReturnType<typeof describeAttachment>>,file:DemoKnowledgeFile,snapshot:Snapshot,presetId:string,title:string):Asset{
 const params={knowledgeCatalogId:demoKnowledgeCatalogId,knowledgeFieldId:snapshot.fieldId,knowledgeFieldName:snapshot.fieldName,knowledgeRevision:String(snapshot.revision),knowledgeCase:presetId,knowledgePath:file.path};
 const folder=`模拟知识本地场/${title}`;
 return {...imported,source:'builtin',workspaceId:snapshot.workspaceId,knowledgeTarget:captureKnowledgeTarget(useStudio.getState(),snapshot.workspaceId),intake:{relativePath:`${folder}/${file.path}`,folder,batchId:`knowledge-${snapshot.fieldId}-${presetId}`,...description},description:`模拟知识本地场「${snapshot.fieldName}」引用 · ${title}`,tags:['模拟知识引用',title],
 metadata:{...imported.metadata,analysis:{status:'ready',summary:`${title}的模拟输入：${file.name}。企业信息与故事为虚构演示。`,tags:['模拟知识引用'],basis:'demo'},business:{note:'预置模拟知识资料，仅供验证制作流程；不是 ACP 实时检索结果。',subject:'',confirmed:false,usage:'reusable',allowAi:true}},
 package:{id:`knowledge-${imported.id}`,version:'1.0',prompt:'模拟知识本地场引用输入，非预生成成品',files:[{name:file.name,type:imported.kind,src:imported.src}],skillIds:[],params,complete:true}};
}
