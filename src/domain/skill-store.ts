import {canonicalMemberAccount,catalogIsHidden} from './admin-management';
import type {Skill,StudioData} from './types';
import {skillActorAccount,skillAvailableToActor,skillCanManage,skillWorkspaceAccess} from './skill-access';
import {getSkillMetadata,validateSkillMetadata} from './skill-metadata';
import {normalizeSkill,skillIsValid,skillVersion} from './skill-publication';
/** A library entry is owned by an account; its source workspace is historical metadata. */
export function prepareSkillSave(state:StudioData,skill:Skill):Skill {
 const previous=state.skills.find(item=>item.id===skill.id),account=skillActorAccount(state);
 if(!account||previous&&!skillCanManage(previous,state)||!previous&&skill.public)throw new Error('当前身份不能修改此技能。');
 const metadata=getSkillMetadata(skill),old=previous?getSkillMetadata(previous):undefined;
 if(old&&(metadata.ownerAccount!==old.ownerAccount||JSON.stringify(metadata.allowedWorkspaceIds)!==JSON.stringify(old.allowedWorkspaceIds)))throw new Error('不能通过编辑元信息更改技能维护归属或原有成员范围。');
 // Existing project-restricted records cannot become global through a metadata edit.
 if(old?.visibility==='restricted'&&metadata.visibility!=='restricted')throw new Error('原空间技能保留既有成员范围；如需公开，请检查内容后投稿。');
 if(!old&&metadata.visibility==='restricted'&&metadata.allowedWorkspaceIds.some(id=>!skillWorkspaceAccess(state,id,account,true)))throw new Error('不能将技能保存到无权维护的成员范围。');
 const saved=normalizeSkill({...structuredClone(skill),workspaceId:previous?.workspaceId||'personal',personal:true,public:false,source:skill.source||(skill.origin?'community':'uploaded'),revision:(previous?.revision||0)+1,metadata:{...metadata,ownerAccount:old?.ownerAccount||account,visibility:old?.visibility==='restricted'?'restricted':metadata.visibility,allowedWorkspaceIds:old?.allowedWorkspaceIds||(metadata.visibility==='restricted'?metadata.allowedWorkspaceIds:[])}});
 // Permit the existing incomplete-draft workflow, while validating every complete definition.
 validateSkillMetadata(saved,true);
 return saved;
}
export function prepareSkillAdoption(state:StudioData,id:string):Skill|undefined {
 const skill=state.skills.find(item=>item.id===id),account=skillActorAccount(state);
 if(!skill||skill.public&&catalogIsHidden('skill',id)||!account||!skillIsValid(skill)||!skillAvailableToActor(skill,state))return;
 if(!skill.public)return skill;
 const version=skillVersion(skill);
 const existing=state.skills.find(item=>!item.public&&item.personal&&canonicalMemberAccount(getSkillMetadata(item).ownerAccount)===canonicalMemberAccount(account)&&item.origin?.skillId===id&&item.origin.version===version);
 if(existing)return existing;
 return {...structuredClone(skill),id:`skill-${crypto.randomUUID()}`,workspaceId:'personal',source:'community',personal:true,public:false,sourceSkillId:undefined,origin:{skillId:id,version},revision:1,metadata:{...getSkillMetadata(skill),visibility:'private',ownerAccount:account,allowedWorkspaceIds:[]}};
}
