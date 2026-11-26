import type {Skill} from './types';
import {canonicalMemberAccount} from './admin-management';
import {isWorkspace} from './workspaces';
import {activeWorkspaceMember,matchingMemberships,type WorkspaceData} from './workspace-management';
import {getSkillMetadata} from './skill-metadata';
export type SkillAccessState=Pick<WorkspaceData,'workspaces'|'workspaceMembers'|'workspaceActors'>&{activeWorkspaceId:string};
/** Account-owned skills remain independent of their historical source workspace. */
export function skillHasActiveScope(skill:Skill,state:Pick<WorkspaceData,'workspaces'>):boolean {
 const metadata=getSkillMetadata(skill);
 return metadata.visibility!=='restricted'||metadata.allowedWorkspaceIds.some(id=>state.workspaces.some(space=>space.id===id&&!space.archivedAt&&!space.deletedAt&&!space.purgedAt));
}
export function skillActorAccount(state:SkillAccessState):string|undefined {
 if(state.activeWorkspaceId==='personal')return 'jiming';
 if(!isWorkspace(state.activeWorkspaceId,state.workspaces))return;
 return activeWorkspaceMember(state,state.activeWorkspaceId)?.account;
}
export function skillWorkspaceAccess(state:SkillAccessState,id:string,account:string,edit:boolean){
 const space=state.workspaces.find(s=>s.id===id&&!s.deletedAt&&!s.purgedAt);
 if(!space||edit&&space.archivedAt)return false;
 return matchingMemberships(state.workspaceMembers[id]||[],account).some(member=>member.status==='member'&&(!edit||member.role==='owner'||member.role==='editor'));
}
export function skillAvailableToActor(skill:Skill,state:SkillAccessState):boolean {
 if(skill.public)return true;
 const account=skillActorAccount(state);if(!account||!skill.personal)return false;
 const m=getSkillMetadata(skill);
 if(m.visibility==='restricted')return m.allowedWorkspaceIds.some(id=>skillWorkspaceAccess(state,id,account,false));
 return m.visibility==='team'||canonicalMemberAccount(m.ownerAccount)===canonicalMemberAccount(account);
}
export function skillCanManage(skill:Skill,state:SkillAccessState):boolean {
 if(skill.public||!skillAvailableToActor(skill,state))return false;
 const account=skillActorAccount(state),m=getSkillMetadata(skill);
 if(!account)return false;
 if(m.visibility==='restricted')return m.allowedWorkspaceIds.some(id=>skillWorkspaceAccess(state,id,account,true));
 return canonicalMemberAccount(m.ownerAccount)===canonicalMemberAccount(account);
}
