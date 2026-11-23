import type {Skill} from './types';
import type {WorkspaceData} from './workspace-management';
import {getSkillMetadata} from './skill-metadata';
export type SkillAccessState=Pick<WorkspaceData,'workspaces'|'workspaceMembers'|'workspaceActors'>&{activeWorkspaceId:string};
/** Account-owned skills remain independent of their historical source workspace. */
export function skillHasActiveScope(skill:Skill,state:Pick<WorkspaceData,'workspaces'>):boolean {
 const metadata=getSkillMetadata(skill);
 return metadata.visibility!=='restricted'||metadata.allowedWorkspaceIds.some(id=>state.workspaces.some(space=>space.id===id&&!space.archivedAt&&!space.deletedAt&&!space.purgedAt));
}
export function skillActorAccount(state:SkillAccessState):string|undefined {
 if(state.activeWorkspaceId==='personal')return 'jiming';
 const actor=state.workspaceActors[state.activeWorkspaceId]||'self';
 return state.workspaceMembers[state.activeWorkspaceId]?.find(member=>member.id===actor&&member.status==='member')?.account;
}
export function skillAvailableToActor(skill:Skill,state:SkillAccessState):boolean {
 if(skill.public)return true;
 const account=skillActorAccount(state);if(!account||!skill.personal)return false;
 const m=getSkillMetadata(skill);
 if(m.visibility==='restricted')return m.allowedWorkspaceIds.some(id=>state.workspaces.some(space=>space.id===id&&!space.deletedAt&&!space.purgedAt)&&state.workspaceMembers[id]?.some(member=>member.account===account&&member.status==='member'));
 return m.visibility==='team'||m.ownerAccount===account;
}
export function skillCanManage(skill:Skill,state:SkillAccessState):boolean {
 if(skill.public||!skillAvailableToActor(skill,state))return false;
 const account=skillActorAccount(state),m=getSkillMetadata(skill);
 if(m.visibility==='restricted')return m.allowedWorkspaceIds.some(id=>state.workspaces.some(space=>space.id===id&&!space.archivedAt&&!space.deletedAt&&!space.purgedAt)&&state.workspaceMembers[id]?.some(member=>member.account===account&&member.status==='member'&&['owner','editor'].includes(member.role)));
 return m.ownerAccount===account;
}
