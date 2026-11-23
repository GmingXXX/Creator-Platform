import {getSkillMetadata} from './skill-metadata';
import type {Skill} from './types';

export function skillVersion(skill:Skill):string {
 const value=JSON.stringify({name:skill.name,description:skill.description,version:skill.version,
  metadata:getSkillMetadata(skill),category:skill.category,styleId:skill.styleId,previewType:skill.previewType,input:skill.input,steps:skill.steps,package:skill.sourcePackage});
 let hash=2166136261;
 for(let index=0;index<value.length;index++)hash=Math.imul(hash^value.charCodeAt(index),16777619);
 return `${skill.version}-${(hash>>>0).toString(16)}`;
}
export function normalizeSkill(skill:Skill):Skill {
 const normalized={...skill,personal:Boolean(skill.personal),public:skill.public??!skill.personal,revision:skill.revision||1};
 return normalized.public?publicSkillSnapshot(normalized):{...normalized,metadata:getSkillMetadata(normalized)};
}
export function skillIsValid(skill:Skill):boolean {
 return [skill.name,skill.description,skill.input].every(value=>typeof value==='string'&&value.trim())
  &&Array.isArray(skill.steps)&&skill.steps.length>0&&skill.steps.every(step=>typeof step==='string'&&step.trim());
}

const internalKeys=new Set(['ownerAccount','allowedWorkspaceIds','provenance']);
/** Strip platform-only source/ownership records, preserving authored method and binary files. */
export function cleanPublicSkillManifest(value:Record<string,unknown>):Record<string,unknown> {
 return Object.fromEntries(Object.entries(value).filter(([key])=>!internalKeys.has(key)).map(([key,item])=>[key,key==='visibility'?'team':key==='metadata'&&item&&typeof item==='object'&&!Array.isArray(item)?cleanPublicSkillManifest(item as Record<string,unknown>):item]));
}
export function cleanPublicSkillInstructions(text:string):string {
 return text.replace(/(^|\n)---\s*\n([\s\S]*?)\n---(?=\s|$)/g,(_block,prefix,front:string)=>{
  const lines=front.split('\n'),kept:string[]=[];let omitIndent:number|undefined;
  for(const line of lines){
   const indent=line.match(/^\s*/)?.[0].length||0;
   if(omitIndent!==undefined&&line.trim()&&indent>omitIndent)continue;
   omitIndent=undefined;
   if(/^\s*(?:ownerAccount|allowedWorkspaceIds|provenance):/.test(line)){omitIndent=indent;continue;}
   kept.push(line);
  }
  return `${prefix}---\n${kept.join('\n')}\n---`;
 }).replace(/^来源作品：.*(?:\n|$)/gm,'');
}
export function publicSkillSnapshot(skill:Skill):Skill {
 const copy=structuredClone(skill),metadata=cleanPublicSkillManifest(getSkillMetadata(copy) as unknown as Record<string,unknown>),pack=copy.sourcePackage;
 if(!pack)return {...copy,metadata};
 const {storageKey,...resources}=pack;
 const files=pack.files.map(file=>{
  if(file.content===undefined)return file;
  let content=file.content;
  if(/(^|\/)(skill|manifest)\.json$/i.test(file.path)){
   try{const value=JSON.parse(content);if(value&&typeof value==='object'&&!Array.isArray(value))content=JSON.stringify(cleanPublicSkillManifest(value),null,2);}catch{throw new Error('技能包元信息清单无效，请修复后再投稿。');}
  }else if(/(^|\/)SKILL\.md$/i.test(file.path))content=cleanPublicSkillInstructions(content);
  return {...file,content,size:new TextEncoder().encode(content).length};
 });
 return {...copy,metadata,sourcePackage:{...resources,resourceStorageKey:storageKey||pack.resourceStorageKey,instructions:cleanPublicSkillInstructions(pack.instructions),files}};
}
