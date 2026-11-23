import {set} from 'idb-keyval';
import {importFile} from '../../domain/upload';
import {describeAttachment} from '../../domain/attachment-intake';
import {parseSkillPackage} from '../../domain/skill-package';
import {attachAssetToDraft,useStudio} from '../../domain/store';
import type {Asset} from '../../domain/types';
import {demoPresetData} from './demo-preset-data';

export const demoPresets=demoPresetData;
export type DemoPresetId=typeof demoPresets[number]['id'];
type DemoFile={name:string;path:string;url:string;mime:string};
type AddedInputs={added:number;reused:number;skillName:string};
const pending=new Map<string,Promise<AddedInputs>>();
export function appendDemoPrompt(current:string,prompt:string){return current.includes(prompt)?current:current.trim()?`${current}\n\n${prompt}`:prompt;}
const inputKey=(preset:string,file:DemoFile)=>`${file.url.match(/\/(v\d+)\//)?.[1]||'v1'}:${preset}:${file.path}`;
function findInput(preset:string,file:DemoFile,workspaceId:string){return useStudio.getState().assets.find(a=>!a.deletedAt&&(a.workspaceId||'personal')===workspaceId&&a.package?.params.demoInputKey===inputKey(preset,file));}
function targetDraft(id:string){const draft=useStudio.getState().drafts.find(d=>d.id===id);if(!draft)throw new Error('原创作草稿已关闭，请回到首页重新添加示例资料。');return draft;}
async function download(file:DemoFile):Promise<File>{
 const response=await fetch(`${import.meta.env.BASE_URL}${file.url.replace(/^\//,'')}`.split('/').map(part=>part==='.'?part:encodeURIComponent(part)).join('/'));
 if(!response.ok)throw new Error(`示例资料「${file.name}」暂时无法读取，请重试。`);
 const blob=await response.blob();if(!blob.size)throw new Error(`示例资料「${file.name}」为空，请重试。`);
 return new File([blob],file.name,{type:file.mime});
}
export function addDemoInputs(presetId:DemoPresetId,draftId:string):Promise<AddedInputs>{
 const key=`${draftId}:${presetId}`,running=pending.get(key);if(running)return running;
 const operation=addInputs(presetId,draftId).finally(()=>pending.delete(key));pending.set(key,operation);return operation;
}
async function addInputs(presetId:DemoPresetId,draftId:string):Promise<AddedInputs>{
 const preset=demoPresets.find(p=>p.id===presetId);if(!preset)throw new Error('示例资料不存在');
 const workspaceId=targetDraft(draftId).workspaceId||'personal';
 const packageFile=await download(preset.skill);
 const parsed=await parseSkillPackage(new Uint8Array(await packageFile.arrayBuffer()),preset.skill.name);
 const needed=preset.files.filter(file=>!findInput(presetId,file,workspaceId));
 const downloaded=await Promise.all(needed.map(async file=>({source:file,file:await download(file)})));
 targetDraft(draftId);
 const existingSkill=useStudio.getState().skills.find(s=>s.personal&&!s.public&&(s.workspaceId||'personal')==='personal'&&s.sourcePackage?.instructions===parsed.sourcePackage.instructions);
 if(!existingSkill){
  const storageKey=`zhichuang-skill-package:${parsed.id}`;await set(storageKey,packageFile);targetDraft(draftId);
  useStudio.getState().addSkill({...parsed,workspaceId:'personal',source:'uploaded',sourcePackage:{...parsed.sourcePackage,storageKey}});
 }
 let added=0,reused=0;
 for(const file of preset.files){
  targetDraft(draftId);
  const existing=findInput(presetId,file,workspaceId);
  if(existing){attachAssetToDraft(draftId,existing);reused++;continue;}
  const item=downloaded.find(d=>d.source.path===file.path);if(!item)throw new Error('示例资料下载未完成，请重试补齐');
  const imported=await importFile(item.file),description=await describeAttachment(item.file);targetDraft(draftId);
  const folder=`${preset.title}示例资料`;
  const asset:Asset={...imported,...(file.url.includes('/v3/presentation/')?{source:'builtin' as const}:{}),workspaceId,intake:{relativePath:`${folder}/${file.path}`,folder,batchId:`demo-${preset.id}-${workspaceId}`,...description},description:`${preset.title} · 虚构演示资料`,tags:['模拟资料',preset.title],
   metadata:{...imported.metadata,analysis:{status:'ready',summary:`${preset.title}的模拟参考资料：${file.name}。内容为虚构演示，不代表真实企业事实。`,tags:['模拟资料'],basis:'demo'},business:{note:'虚构演示资料，仅供验证制作流程。',subject:'',confirmed:false,usage:'reusable',allowAi:true}},
   package:{id:`demo-${imported.id}`,version:'1.0',prompt:'虚构演示输入资料',files:[{name:file.name,type:imported.kind,src:imported.src}],skillIds:[],params:{demoInputKey:inputKey(presetId,file),relativePath:file.path},complete:true}};
  attachAssetToDraft(draftId,asset);added++;
 }
 return {added,reused,skillName:existingSkill?.name||parsed.name};
}
