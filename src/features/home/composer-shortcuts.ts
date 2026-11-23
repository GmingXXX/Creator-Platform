import type {Asset,ComposerDraft,Skill} from '../../domain/types';
import {assetAvailableInSpace} from '../../domain/asset-access';
import {assetDependencyError} from '../../domain/resource-permissions';
import {skillAvailableInSpace} from '../../domain/resource-sharing';
import {skillIsValid} from '../../domain/skill-publication';
import type {SkillAccessState} from '../../domain/skill-access';

export interface ComposerShortcut {kind:'skill'|'asset';start:number;end:number;query:string}
export interface ComposerShortcutChoice {id:string;kind:'skill'|'asset'|'references';name:string;description:string;disabledReason?:string}
interface ShortcutResources {skills:Skill[];assets:Asset[];draft:ComposerDraft;access:SkillAccessState}

/** Only a token beside the caret is a command; URLs and email addresses stay ordinary text. */
export function findComposerShortcut(text:string,caret:number,selectionEnd=caret):ComposerShortcut|undefined {
 if(caret<0||caret>text.length||selectionEnd!==caret)return;
 const match=text.slice(0,caret).match(/(?:^|[\s（(，,：:；;])([/@])([^\s/@]*)$/u);
 if(!match)return;
 return {kind:match[1]==='/'?'skill':'asset',start:caret-match[2].length-1,end:caret,query:match[2]};
}

export function removeComposerShortcut(text:string,token:ComposerShortcut):{text:string;caret:number} {
 return {text:text.slice(0,token.start)+text.slice(token.end),caret:token.start};
}

export function composerShortcutChoices(resources:ShortcutResources,kind:ComposerShortcut['kind'],query:string):ComposerShortcutChoice[] {
 const {skills,assets,draft}=resources,workspaceId=draft.workspaceId||'personal';
 const access={...resources.access,activeWorkspaceId:workspaceId};
 const matches=(text:string)=>text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
 if(kind==='skill')return skills.filter(skill=>skillAvailableInSpace(skill,workspaceId,access)&&matches(`${skill.name} ${skill.description}`)).map(skill=>({
  id:skill.id,kind:'skill',name:skill.name,description:skill.description,
  disabledReason:skill.enabled===false?'已停用':!skillIsValid(skill)?'技能信息不完整':draft.skillIds.includes(skill.id)?'已添加':undefined,
 }));
 const choices:ComposerShortcutChoice[]=assets.filter(asset=>assetAvailableInSpace(asset,workspaceId)&&!asset.deletedAt&&!asset.archived&&!asset.sourceWorkId&&!asset.workSnapshot&&matches(`${asset.name} ${asset.description} ${asset.tags.join(' ')}`)).map(asset=>({
  id:asset.id,kind:'asset',name:asset.name,description:`${asset.public?'社区素材':'空间素材'} · ${asset.description||asset.kind}`,
  disabledReason:assetDependencyError(assets,asset,workspaceId,'ai')?'未授权用于 AI 或依赖不可用':draft.attachmentIds.includes(asset.id)?'已添加':undefined,
 }));
 // Works use the existing visual reference picker, including its source scope and dimension validation.
 return [...choices,{id:'browse-references',kind:'references',name:'浏览作品与模板',description:'预览并选择参考范围'}];
}
