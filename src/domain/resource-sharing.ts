import {skillAvailableToActor,type SkillAccessState} from './skill-access';
import type {Asset,Skill} from './types';
export type ResourceView='mine'|'shared';
export function resourceInView(item:{workspaceId?:string;public?:boolean;source?:string},view:ResourceView,activeWorkspaceId:string):boolean {
 if(item.public)return false;
 if(item.source==='builtin'&&!item.workspaceId)return view==='mine';
 return view==='mine'?(item.workspaceId||'personal')==='personal':activeWorkspaceId!=='personal'&&item.workspaceId===activeWorkspaceId;
}
export function skillAvailableInSpace(skill:Skill,workspaceId='personal',state?:SkillAccessState):boolean {
 if(state)return skillAvailableToActor(skill,state);
 return Boolean(skill.public)||Boolean(skill.personal)&&((skill.workspaceId||'personal')==='personal'||skill.workspaceId===workspaceId);
}
export function canCopyResource(item:Pick<Asset,'workspaceId'|'public'|'source'>,fromWorkspace:string,targetWorkspace:string):boolean {
 const origin=item.workspaceId||'personal';
 return Boolean(item.public)||origin==='personal'||origin===targetWorkspace||(targetWorkspace==='personal'&&origin===fromWorkspace);
}

/** Keep the selected version with the engineering work, independent of the user's skill library. */
export function pinWorkSkills(work:import('./types').Work,skills:Skill[],workspaceId:string,copy:(id:string,workspaceId:string)=>Skill|undefined):import('./types').Work {
 const pack=work.creationPackage;if(!pack)return work;
 const snapshots=pack.skillIds.map(id=>pack.skillSnapshots?.find(skill=>skill.id===id)||skills.find(skill=>skill.id===id)).filter((skill):skill is Skill=>Boolean(skill));
 const pinned=snapshots;
 return {...work,creationPackage:{...structuredClone(pack),skillIds:pinned.map(skill=>skill.id),skillSnapshots:structuredClone(pinned)}};
}
